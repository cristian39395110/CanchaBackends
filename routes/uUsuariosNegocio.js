// routes/usuariosNegocio.js (o como lo llamaste)
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const {uUsuarioNegocio} = require('../models/model');
const { autenticarTokenNegocio } = require('../middlewares/authNegocio');
const { autenticarUsuarioNegocio } = require('../middlewares/authUsuarioNegocio'); 

const SECRET_KEY = process.env.SECRET_KEY || 'clave-ultra-secreta';
// routes/usuariosNegocio.js (o como se llame tu router de negocio)

const router = express.Router();

const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');


require('dotenv').config();

const upload = multer({ storage: multer.memoryStorage() });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  family: 4,
});



router.get("/estado-premium", autenticarTokenNegocio, (req, res) => {
  const {
    esPremium,
    fechaFinPremium,
    diasRestantesPremium,
    premiumVencido,
  } = req.negocio;

  const porVencer =
    esPremium &&
    diasRestantesPremium !== null &&
    diasRestantesPremium <= 7; // por ej. 7 días o menos

  return res.json({
    ok: true,
    esPremium,
    fechaFinPremium,
    diasRestantes: diasRestantesPremium,
    estaVencida: premiumVencido,
    porVencer,
  });
});
/**
 * GET /api/loginusuario/mi-perfil
 * Devuelve los datos del usuario-negocio logueado
 */
router.get("/mi-perfil", autenticarUsuarioNegocio, async (req, res) => {
  try {
    const usuarioNegocio = req.negocio; // viene del middleware

    if (!usuarioNegocio) {
      return res.status(401).json({
        ok: false,
        error: "No autenticado",
      });
    }

    const perfil = await uUsuarioNegocio.findByPk(usuarioNegocio.id, {
      attributes: {
        exclude: ["password", "tokenVerificacion"], // no mandamos cosas sensibles
      },
    });

    if (!perfil) {
      return res.status(404).json({
        ok: false,
        error: "Usuario de negocio no encontrado",
      });
    }

    return res.json({
      ok: true,
      perfil,
    });
  } catch (error) {
    console.error("Error en GET /mi-perfil:", error);
    return res.status(500).json({
      ok: false,
      error: "Error al obtener el perfil",
    });
  }
});

/**
 * PUT /api/loginusuario/mi-perfil
 * Actualiza datos básicos + foto de perfil
 * Acepta multipart/form-data con campo "fotoPerfil"
 */
router.put(
  "/mi-perfil",
  autenticarUsuarioNegocio,
  upload.single("fotoPerfil"),
  async (req, res) => {
    try {
      const usuarioNegocio = req.negocio;

      if (!usuarioNegocio) {
        return res.status(401).json({
          ok: false,
          error: "No autenticado",
        });
      }

      const usuario = await uUsuarioNegocio.findByPk(usuarioNegocio.id);
      if (!usuario) {
        return res.status(404).json({
          ok: false,
          error: "Usuario de negocio no encontrado",
        });
      }

      const { nombre, email, telefono, provincia, localidad } = req.body;

      // 🔹 Validaciones básicas
      if (!nombre || !nombre.trim()) {
        return res.status(400).json({
          ok: false,
          error: "El nombre es obligatorio",
        });
      }

      // 🔹 Verificar que el email no esté en uso por otro user
      if (email && email !== usuario.email) {
        const existente = await uUsuarioNegocio.findOne({
          where: { email },
        });

        if (existente && existente.id !== usuario.id) {
          return res.status(400).json({
            ok: false,
            error: "Ese email ya está en uso por otro usuario",
          });
        }

        usuario.email = email;
      }

      // 🔹 Campos simples
      usuario.nombre = nombre;
      usuario.telefono = telefono || null;
      usuario.provincia = provincia || null;
      usuario.localidad = localidad || null;

      // 🔹 Foto de perfil (opcional)
      if (req.file) {
        // Si ya tenía una foto en Cloudinary, la borramos
        if (usuario.cloudinaryId) {
          try {
            await cloudinary.uploader.destroy(usuario.cloudinaryId);
          } catch (err) {
            console.warn(
              "No se pudo eliminar la foto anterior de Cloudinary:",
              err
            );
          }
        }

        // Subimos la nueva
        const resultado = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "usuarios-negocio" },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });

        usuario.fotoPerfil = resultado.secure_url;
        usuario.cloudinaryId = resultado.public_id;
      }

      await usuario.save();

      // Devolvemos el perfil ya limpio
      const perfilActualizado = await uUsuarioNegocio.findByPk(
        usuario.id,
        {
          attributes: {
            exclude: ["password", "tokenVerificacion"],
          },
        }
      );

      return res.json({
        ok: true,
        perfil: perfilActualizado,
      });
    } catch (error) {
      console.error("Error en PUT /mi-perfil:", error);
      return res.status(500).json({
        ok: false,
        error: "Error al actualizar el perfil",
      });
    }
  }
);

// POST /api/usuarios-negocio/registro
router.post('/registro', upload.single('fotoPerfil'), async (req, res) => {
  try {
    const {
      nombre,
      telefono,
      email,
      password,
      provincia,
      localidad,
      deviceId,
    } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Faltan datos obligatorios.' });
    }

    const existente = await uUsuarioNegocio.findOne({ where: { email } });
    if (existente) {
      return res.status(400).json({ error: 'Ya existe un negocio con ese email.' });
    }

    // si querés limitar 1 negocio por device:
    if (deviceId) {
      const negocioDevice = await uUsuarioNegocio.findOne({ where: { deviceId } });
      if (negocioDevice) {
        return res.status(400).json({
          error: 'Ya hay un negocio registrado desde este dispositivo.',
        });
      }
    }

    // FOTO CLOUDINARY
    let fotoPerfil = null;
    let cloudinaryId = null;

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'negocios' },
          (error, result) => (result ? resolve(result) : reject(error))
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

      fotoPerfil = result.secure_url;
      cloudinaryId = result.public_id;
    } else {
      // PODÉS USAR MISMA IMAGEN DEFAULT QUE EN MATCHCLUB O OTRA
      fotoPerfil = 'https://res.cloudinary.com/dvmwo5mly/image/upload/v1753793634/fotoperfil_rlqxqn.png';
    }

    const hashed = await bcrypt.hash(password, 10);
    const tokenVerificacion = uuidv4();

    const nuevo = await uUsuarioNegocio.create({
      nombre,
      telefono,
      email,
      password: hashed,
      provincia,
      localidad,
      deviceId: deviceId || null,
      fotoPerfil,
      cloudinaryId,
      verificado: false,
      tokenVerificacion,
      esAdmin: false,
    });

    // link verificación (podés usar el mismo BACKEND_URL que en MatchClub)
    const base = process.env.BACKEND_URL || 'https://canchabackends-1.onrender.com';
    const link = `${base}/api/loginusuario/verificar/${tokenVerificacion}`;

    let emailEnviado = true;
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Verificá tu cuenta de negocio',
        html: `<h2>Bienvenido/a ${nombre}</h2>
               <p>Hacé clic en el siguiente enlace para verificar tu cuenta:</p>
               <a href="${link}">${link}</a>`,
      });
    } catch (err) {
      emailEnviado = false;
      console.error('❌ No se pudo enviar correo verificación negocio:', err);
    }

    res.status(201).json({
      mensaje: emailEnviado
        ? 'Negocio creado. Revisá tu correo para confirmar la cuenta.'
        : 'Negocio creado. No pudimos enviar el correo, intentá reenviar desde la app.',
      emailEnviado,
      negocioId: nuevo.id,
    });
  } catch (error) {
    console.error('❌ Error al crear negocio:', error);
    res.status(500).json({ error: 'Error interno al crear negocio.' });
  }
});

module.exports = router;

/* ===============================
   ✅ Verificación del correo
   =============================== */
router.get('/verificar/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const usuario = await uUsuarioNegocio.findOne({ where: { tokenVerificacion: token } });

    if (!usuario) return res.status(400).send('Token inválido o expirado.');

    usuario.verificado = true;
    usuario.tokenVerificacion = null;
    await usuario.save();

    res.send('✅ Tu cuenta fue verificada. Ahora podés iniciar sesión.');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al verificar la cuenta.');
  }
});

/* ===============================
   🔐 Login con token JWT
   =============================== */
// routes/usuariosNegocio.js  (dentro de /login)
router.post('/login', async (req, res) => {
  try {
    const { email, password, deviceId } = req.body;

    const usuario = await uUsuarioNegocio.findOne({ where: { email } });
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (!usuario.verificado) {
      return res.status(403).json({ message: 'Verificá tu correo antes de iniciar sesión' });
    }

    const valido = await bcrypt.compare(password, usuario.password);
    if (!valido) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    // ✅ opcional: guardar deviceId si no tenía
    if (!usuario.deviceId && deviceId) {
      usuario.deviceId = deviceId;
      await usuario.save();
    }

    // 👇 ACA definimos el rol según premium
    const rol = usuario.esPremium ? 'negocio' : 'usuarioNegocio';

    const payload = {
      id: usuario.id,
      rol, // 'negocio' o 'usuarioNegocio'
      esAdmin: !!usuario.esAdmin,
      esPremium: !!usuario.esPremium,
      email: usuario.email,
      nombre: usuario.nombre,
    };

    const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '30d' });


    res.json({
      token,
      usuarioId: usuario.id,
      rol,                       // 👈 si querés usarlo en el frontend
      esAdmin: !!usuario.esAdmin,
      esPremium: !!usuario.esPremium,
      nombre: usuario.nombre,
      email: usuario.email,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al iniciar sesión' });
  }
});

/* ===============================
   🙋 Obtener usuario autenticado
   =============================== */
// GET /api/auth/yo
router.get('/yo', autenticarUsuarioNegocio, async (req, res) => {
  try {
    const usuarioNegocioId = req.negocio.id; // ← viene del middleware

    const usuario = await uUsuarioNegocio.findByPk(usuarioNegocioId, {
      attributes: { exclude: ['password'] },
    });

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(usuario);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener el usuario' });
  }
});

/* ===============================
   🆕 Recuperar contraseña (modo viejo)
   =============================== */
router.post('/recuperar', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Falta el email.' });

  try {
    const usuario = await uUsuarioNegocio.findOne({ where: { email } });
    if (!usuario) {
      // no decimos "no existe" para no dar info
      return res.json({ mensaje: 'Si el correo existe, te enviamos una nueva contraseña.' });
    }

    // generamos una nueva pass temporal
    const nuevaPassword = generarPasswordAleatoria(8);
    const hash = await bcrypt.hash(nuevaPassword, 10);

    await usuario.update({ password: hash });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Recuperación de contraseña - CompraPuntos',
      text: `Hola ${usuario.nombre || ''},\n\nTu nueva contraseña temporal es: ${nuevaPassword}\n\nIniciá sesión y cambiala desde tu perfil.`,
      html: `<p>Hola ${usuario.nombre || ''},</p>
             <p>Tu nueva contraseña temporal es:</p>
             <p><b>${nuevaPassword}</b></p>
             <p>Te recomendamos cambiarla apenas ingreses.</p>`,
    });

    res.json({ mensaje: 'Se envió una nueva contraseña a tu correo electrónico.' });
  } catch (error) {
    console.error('❌ Error en recuperación negocio:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
