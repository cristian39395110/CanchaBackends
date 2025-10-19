//routes/usuario
const express = require('express');
const router = express.Router();
const Usuario = require('../models/usuario');
const UsuarioDeporte = require('../models/usuarioDeporte');
const Deporte = require('../models/deporte');
const Amistad = require('../models/amistad');
const Bloqueo = require('../models/Bloqueo');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
require('dotenv').config();
const upload = multer({ storage: multer.memoryStorage() });
const storage = multer.memoryStorage();
const { autenticarToken } = require('../middlewares/auth'); // ajustá la ruta si está en otro archivo
// ✅ Ponelo UNA vez arriba del archivo (debajo de imports)
const isTrue = v => v === '1' || v === 'true' || v === true;

// Obtener un usuario por ID (con URL completa de la imagen)
// donde sea que tengas configurado Cloudinary




const SECRET_KEY = process.env.JWT_SECRET;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});





const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,               // SSL directo
  auth: {
    user: process.env.EMAIL_USER,   // tu@gmail.com
    pass: process.env.EMAIL_PASS,   // App Password (16)
  },
  // claves para evitar timeouts por red/IPv6
  family: 4,                  // 👈 fuerza IPv4
  connectionTimeout: 60000,   // 60s
  greetingTimeout: 30000,
  socketTimeout: 120000,
  // logger: true, debug: true, // (opcional) ver handshake en logs
});

function generarPasswordAleatoria(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}


// 🧠 Devuelve los datos del usuario actual logueado
router.get('/yo', autenticarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id; // ← Viene del token
    const usuario = await Usuario.findByPk(usuarioId, {
      attributes: ['id', 'nombre', 'email', 'fotoPerfil', 'localidad', 'sexo', 'edad', 'premium'],
    });

    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json(usuario);
  } catch (error) {
    console.error('❌ Error en /usuarios/yo:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/recuperar', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Falta el email.' });

  try {
    const usuario = await Usuario.findOne({ where: { email } });
    if (!usuario) return res.status(404).json({ error: 'No se encontró un usuario con ese correo.' });

    const nuevaPassword = generarPasswordAleatoria();
    const hash = await bcrypt.hash(nuevaPassword, 10);
    await Usuario.update({ password: hash }, { where: { email } });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Recuperación de contraseña',
      text: `Hola ${usuario.nombre || ''},\n\nTu nueva contraseña temporal es: ${nuevaPassword}\n\nTe recomendamos cambiarla al ingresar.`,
    });

    res.json({ mensaje: 'Se envió una nueva contraseña a tu correo electrónico.' });
  } catch (error) {
    console.error('❌ Error en recuperación:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});


function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Crear un usuario (registro con verificación y Cloudinary usando streamifier)
// routes/usuarios.js

// PATCH para cambiar foto de perfil

router.patch('/:id/foto', autenticarToken, upload.single('foto'), async (req, res) => {
  const usuarioTokenId = parseInt(req.usuario.id); // ID del usuario autenticado
  const idParametro = parseInt(req.params.id);     // ID del usuario a modificar

  if (usuarioTokenId !== idParametro) {
    return res.status(403).json({ error: 'No tienes permiso para modificar esta foto de perfil.' });
  }

  try {
    const usuario = await Usuario.findByPk(idParametro);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!req.file) return res.status(400).json({ error: 'No se envió imagen' });

    // 🧹 Eliminar imagen anterior si existía
    if (usuario.cloudinaryId) {
      try {
        await cloudinary.uploader.destroy(usuario.cloudinaryId);
      } catch (error) {
        console.warn('⚠️ Error al eliminar imagen anterior en Cloudinary:', error.message);
      }
    }

    // 📤 Subir nueva imagen
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'usuarios' },
        (error, result) => {
          if (result) resolve(result);
          else reject(error);
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    // 💾 Guardar nueva imagen y public_id
    usuario.fotoPerfil = result.secure_url;
    usuario.cloudinaryId = result.public_id;
    await usuario.save();

    res.json({ mensaje: '✅ Foto actualizada', fotoPerfil: result.secure_url });

  } catch (error) {
    console.error('❌ Error al subir foto:', error);
    res.status(500).json({ error: 'Error al subir imagen' });
  }
});

router.post('/:id/cambiar-password', autenticarToken, async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) !== parseInt(req.usuario.id)) {
    return res.status(403).json({ error: 'No tienes permiso para cambiar esta contraseña.' });
  }

  const { actual, nueva } = req.body;
  if (!actual || !nueva) {
    return res.status(400).json({ error: 'Faltan datos: actual y nueva contraseña.' });
  }

  try {
    const usuario = await Usuario.findByPk(id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const coincide = await bcrypt.compare(actual, usuario.password);
    if (!coincide) return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });

    const nuevaHash = await bcrypt.hash(nueva, 10);
    await usuario.update({ password: nuevaHash });

    res.json({ mensaje: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    console.error('❌ Error al cambiar contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ❌ Eliminar foto de perfil


// ✅ Endpoint único y protegido
router.delete('/:id/foto', autenticarToken, async (req, res) => {
  const usuarioTokenId = parseInt(req.usuario.id); // ID autenticado
  const idParametro = parseInt(req.params.id);     // ID del usuario a modificar

  // Solo el dueño puede eliminar su foto
  if (usuarioTokenId !== idParametro) {
    return res.status(403).json({ error: 'No tienes permiso para eliminar esta foto de perfil.' });
  }

  try {
    const usuario = await Usuario.findByPk(idParametro);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

   if (usuario.cloudinaryId) {
  await cloudinary.uploader.destroy(usuario.cloudinaryId);
}

usuario.fotoPerfil = null;
usuario.cloudinaryId = null;
await usuario.save();


    res.json({ mensaje: '✅ Foto eliminada correctamente', fotoPerfil: null });
  } catch (err) {
    console.error('❌ Error al eliminar foto:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});
//------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------

router.post('/', upload.single('fotoPerfil'), async (req, res) => {
  try {
    const {
      nombre, telefono, email, password, localidad,
      latitud, longitud, sexo, edad, deviceId
    } = req.body;

    const rawRef = (req.body.ref || req.body.codigoRef || '').trim();
    const ref = rawRef.toUpperCase();

    const existente = await Usuario.findOne({ where: { email } });
    if (existente) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese email.' });
    }

    const dispositivoExistente = await Usuario.findOne({ where: { deviceId } });
    if (dispositivoExistente) {
      return res.status(400).json({ error: 'Ya existe una cuenta registrada desde este dispositivo.' });
    }

    let urlImagen = null;
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'usuarios' },
          (error, result) => (result ? resolve(result) : reject(error))
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
      urlImagen = result.secure_url;
    } else {
      urlImagen = 'https://res.cloudinary.com/dvmwo5mly/image/upload/v1753793634/fotoperfil_rlqxqn.png';
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const tokenVerificacion = uuidv4();

    let referidoPorId = null;
    if (ref) {
      let referente = await Usuario.findOne({ where: { codigoReferencia: ref } });
      if (!referente && /^\d+$/.test(ref)) {
        referente = await Usuario.findByPk(Number(ref));
      }
      if (referente) {
        referidoPorId = referente.id;
      } else {
        console.warn('⚠️ Código de referido inválido, se ignora:', ref);
      }
    }

    const lat = (latitud !== undefined && latitud !== '') ? parseFloat(latitud) : null;
    const lng = (longitud !== undefined && longitud !== '') ? parseFloat(longitud) : null;
    const edadNum = Number.isFinite(Number(edad)) ? parseInt(edad, 10) : null;

    // Código temporal para cumplir NOT NULL + UNIQUE
   const tempCodigo = ('TP' + Math.random().toString(36).slice(2, 10)).toUpperCase();

    const nuevoUsuario = await Usuario.create({
      nombre,
      telefono,
      email,
      password: hashedPassword,
      localidad,
     latitud: (lat === null || Number.isNaN(lat)) ? null : lat,
longitud: (lng === null || Number.isNaN(lng)) ? null : lng,

      sexo,
      edad: edadNum,
      deviceId,
      fotoPerfil: urlImagen,
      verificado: false,
      tokenVerificacion,
      referidoPorId,
      codigoReferencia: tempCodigo,
    });

    // Generar el definitivo con el ID real
    const codigoFinal = `MC${String(nuevoUsuario.id).padStart(8, '0')}`;
    await nuevoUsuario.update({ codigoReferencia: codigoFinal });

    const base = process.env.BACKEND_URL || 'https://canchabackends-1.onrender.com';
    const link = `${base}/api/usuarios/verificar/${tokenVerificacion}`;

    let emailEnviado = true;
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Verifica tu cuenta',
        html: `<h2>Bienvenido/a ${nombre}</h2>
               <p>Haz clic en el siguiente enlace para verificar tu cuenta:</p>
               <a href="${link}">${link}</a>`,
      });
    } catch (err) {
      emailEnviado = false;
      console.error('❌ No se pudo enviar el correo de verificación:', err);
    }

    return res.status(201).json({
      mensaje: emailEnviado
        ? 'Usuario creado. Revisa tu correo para confirmar la cuenta.'
        : 'Usuario creado. No pudimos enviar el correo, intentá reenviar desde la app.',
      emailEnviado,
      usuarioId: nuevoUsuario.id,
      codigoReferencia: codigoFinal,
      linkReferido: `https://play.google.com/store/apps/details?id=com.canchas.app&referrer=${encodeURIComponent('ref=' + codigoFinal)}`
    });

  } catch (error) {
    console.error('❌ Error al crear usuario:', error);
    return res.status(500).json({ error: 'Error interno al crear usuario.' });
  }
});





//------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------


router.get('/buscar', async (req, res) => {
  const {
    nombre,
    deporte,
    localidad,
    latitud,
    longitud,
    usuarioId,
    pagina = 1,
    soloAmigos
  } = req.query;

  const pageSize = 5;
  const offset = (pagina - 1) * pageSize;

  let where = {};
  if (nombre) where.nombre = { [Op.like]: `%${nombre}%` };
  if (localidad) where.localidad = { [Op.like]: `%${localidad}%` };

  try {
    let amigosIds = [];

    if (soloAmigos === 'true') {
      const amistades = await Amistad.findAll({
        where: {
          estado: 'aceptado',
          [Op.or]: [
            { usuarioId },
            { amigoId: usuarioId }
          ]
        }
      });

      amigosIds = amistades.map(a =>
        a.usuarioId === parseInt(usuarioId) ? a.amigoId : a.usuarioId
      );

      where.id = amigosIds.length > 0 ? amigosIds : -1; // -1 evita devolver todos si está vacío
    } else if (usuarioId) {
      // Excluirse a sí mismo
      where.id = { [Op.not]: usuarioId };
    }

    const usuarios = await Usuario.findAll({
      where,
      limit: pageSize,
      offset,
      include: [{
        model: UsuarioDeporte,
        include: ['deporte']
      }]
    });

    // Agregar deportes al array
    const resultado = usuarios.map(user => ({
      id: user.id,
      nombre: user.nombre,
      localidad: user.localidad,
      fotoPerfil: user.fotoPerfil,
      deportes: user.UsuarioDeportes?.map(ud => ud.deporte.nombre) || []
    }));

    res.json(resultado);
  } catch (err) {
    console.error('❌ Error al buscar usuarios:', err);
    res.status(500).json({ error: 'Error interno al buscar usuarios' });
  }
});


// Verificación de cuenta
router.get('/verificar/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const usuario = await Usuario.findOne({ where: { tokenVerificacion: token } });

    if (!usuario) return res.status(400).send('Token inválido');

    usuario.verificado = true;
    usuario.tokenVerificacion = null;
    await usuario.save();

    res.send('✔️ Cuenta verificada correctamente. Ya podés iniciar sesión.');
  } catch (error) {
    res.status(500).send('Error en la verificación');
  }
});

// Login con verificación
router.post('/login', async (req, res) => {
  const { email, password, deviceId } = req.body;

  try {
    const usuario = await Usuario.findOne({ where: { email } });

    if (!usuario || !(await bcrypt.compare(password, usuario.password))) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

        if (!usuario.verificado) {
      return res.status(403).json({ message: 'Debes verificar tu correo electrónico antes de iniciar sesión.' });
    }
      
  // ✅ Si aún no tiene un deviceId (primer login desde celular nuevo)
    if (!usuario.deviceId && deviceId) {
      await usuario.update({ deviceId, ultimoCambioDevice: new Date() });
    }

    // 🛑 Si el usuario ya tiene un deviceId registrado, lo comparamos
    if (usuario.deviceId && usuario.deviceId !== deviceId) {
      const ahora = new Date();
      const ultimaVez = new Date(usuario.ultimoCambioDevice || 0);
      const diferenciaEnDias = (ahora - ultimaVez) / (1000 * 60 * 60 * 24);

      if (diferenciaEnDias < 7) {
        return res.status(403).json({
          message: 'Solo podés iniciar sesión en un nuevo dispositivo una vez cada 7 días.',
        });
      }

      // ✅ Si pasaron los días, se actualiza el device y la fecha
      await usuario.update({ deviceId, ultimoCambioDevice: ahora });
    }



    
const token = jwt.sign(
  {
    id: usuario.id,
    email: usuario.email,
    premium: usuario.premium,
    esAdmin: usuario.esAdmin  // 👈 Agregado
  },
  SECRET_KEY,
  { expiresIn: '365d' }
);


    res.json({ message: 'Login exitoso', token, usuarioId: usuario.id, esPremium: usuario.premium });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});
// Obtener todos los usuarios
router.get('/', async (req, res) => {
  try {
    const usuarios = await Usuario.findAll();
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.put('/:id', autenticarToken, upload.single('fotoPerfil'), async (req, res) => {
  const { id } = req.params;

  if (parseInt(id) !== parseInt(req.usuario.id)) {
    return res.status(403).json({ error: 'No tienes permiso para modificar este perfil.' });
  }

  try {
    const usuario = await Usuario.findByPk(id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Helpers
    const toBool = (v) => String(v) === 'true';
    const toNullIfEmpty = (v) => (v === '' || v === undefined ? null : v);

    // --- Campos BÁSICOS (valores) ---
    const { nombre, localidad, sexo, edad } = req.body;
    if (nombre !== undefined) usuario.nombre = nombre;
    if (localidad !== undefined) usuario.localidad = localidad;
    if (sexo !== undefined && sexo !== '') usuario.sexo = sexo; // 'masculino' | 'femenino'
    if (edad !== undefined && edad !== '') usuario.edad = parseInt(edad, 10);

    // --- Campos OPCIONALES (valores) ---
    const opcionales = [
      'fechaNacimiento',  // DATEONLY (yyyy-mm-dd)
      'lugarNacimiento',
      'nacionalidad',
      'estadoCivil',
      'dondeVivo',
      'profesion',
      'empleo',
      'religion',
      'musicaFavorita',
      'institucion',
    ];
    for (const key of opcionales) {
      if (key in req.body) {
        // fechaNacimiento acepta '' => null
        usuario[key] = toNullIfEmpty(req.body[key]);
      }
    }

    // --- Flags de visibilidad (básicos + opcionales) ---
    const flags = [
      // básicos
      'mostrar_edad',
      'mostrar_sexo',
      'mostrar_localidad',
      // opcionales
      'mostrar_fechaNacimiento',
      'mostrar_lugarNacimiento',
      'mostrar_nacionalidad',
      'mostrar_estadoCivil',
      'mostrar_dondeVivo',
      'mostrar_profesion',
      'mostrar_empleo',
      'mostrar_religion',
      'mostrar_musicaFavorita',
      'mostrar_institucion',
    ];
    for (const key of flags) {
      if (key in req.body) {
        usuario[key] = toBool(req.body[key]);
      }
    }

    // --- Foto de perfil (Cloudinary) ---
    if (req.file) {
      // si ya tenías cloudinaryId, borrá la anterior (opcional)
      if (usuario.cloudinaryId) {
        try { await cloudinary.uploader.destroy(usuario.cloudinaryId); } catch (e) { /* noop */ }
      }

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'usuarios' },
          (error, result) => (result ? resolve(result) : reject(error))
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

      usuario.fotoPerfil = result.secure_url;
      // guardá el public_id para borrados futuros
      if (result.public_id) usuario.cloudinaryId = result.public_id;
    }

    await usuario.save();

    res.json({
      mensaje: '✅ Usuario actualizado correctamente',
      fotoPerfil: usuario.fotoPerfil,
    });
  } catch (error) {
    console.error('❌ Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:id/ubicacion', async (req, res) => {
  const { id } = req.params;

  try {
    const usuario = await Usuario.findByPk(id, {
      attributes: ['latitud', 'longitud']
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      latitud: usuario.latitud,
      longitud: usuario.longitud
    });
  } catch (error) {
    console.error('❌ Error al obtener ubicación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}); 

// PUT /api/usuarios/:id/ubicacion
router.put('/:id/ubicacion', autenticarToken, async (req, res) => {
  if (parseInt(req.params.id) !== req.usuario.id) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const { latitud, longitud } = req.body;

  if (!latitud || !longitud) {
    return res.status(400).json({ error: 'Latitud y longitud son requeridas' });
  }

  try {
    await Usuario.update({ latitud, longitud }, { where: { id: req.usuario.id } });
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error al actualizar ubicación:', error);
    res.status(500).json({ error: 'Error al actualizar ubicación' });
  }
});


router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const solicitanteId = req.query.solicitanteId;

  try {
    const usuario = await Usuario.findByPk(id, {
      attributes: ['id', 'nombre', 'email', 'fotoPerfil', 'localidad', 'perfilPublico', 'partidosJugados','sexo', 'edad'],
      include: [{
        model: UsuarioDeporte,
        include: [{ model: Deporte }]
      }]
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const deportes = usuario.UsuarioDeportes?.map(ud => ud.Deporte?.nombre) || [];

    let esAmigo = false;
    let haySolicitudPendiente = false;

    if (solicitanteId && solicitanteId !== id) {
      // Primero revisamos si ya son amigos
      const amistad = await Amistad.findOne({
        where: {
          [Op.or]: [
            { usuarioId: solicitanteId, amigoId: id },
            { usuarioId: id, amigoId: solicitanteId }
          ],
          estado: 'aceptado' // 👈 clave
        }
      });

      if (amistad) {
        esAmigo = true;
      } else {
        // Solo si no son amigos, revisamos si hay una solicitud pendiente
        const pendiente = await Amistad.findOne({
          where: {
            [Op.or]: [
              { usuarioId: solicitanteId, amigoId: id },
              { usuarioId: id, amigoId: solicitanteId }
            ],
            estado: 'pendiente'
          }
        });

        if (pendiente) {
          haySolicitudPendiente = true;
        }
      }
    }

    res.json({
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      fotoPerfil: usuario.fotoPerfil,
      localidad: usuario.localidad,
      perfilPublico: usuario.perfilPublico,
      partidosJugados: usuario.partidosJugados || 0,
      sexo: usuario.sexo,
      edad: usuario.edad,
      deportes,
      esAmigo,
      haySolicitudPendiente
    });

  } catch (error) {
    console.error('❌ Error al obtener perfil de usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/usuarios/bloquear
router.post('/bloquear', async (req, res) => {
  const { usuarioId, bloqueadoId } = req.body;

  const yaExiste = await Bloqueo.findOne({ where: { usuarioId, bloqueadoId } });
  if (yaExiste) return res.status(400).json({ error: 'Ya bloqueado' });

  await Bloqueo.create({ usuarioId, bloqueadoId });
  res.json({ mensaje: 'Usuario bloqueado' });
});

// POST /api/usuarios/desbloquear
router.post('/desbloquear', async (req, res) => {
  const { usuarioId, bloqueadoId } = req.body;

  await Bloqueo.destroy({ where: { usuarioId, bloqueadoId } });
  res.json({ mensaje: 'Usuario desbloqueado' });
});

// GET /api/usuarios/:usuarioId/bloqueo/:bloqueadoId
router.get('/:usuarioId/bloqueo/:bloqueadoId', async (req, res) => {
  const { usuarioId, bloqueadoId } = req.params;

  const existe = await Bloqueo.findOne({ where: { usuarioId, bloqueadoId } });
  res.json({ bloqueado: !!existe });
});


router.put('/:id/password', autenticarToken, async (req, res) => {
  const { id } = req.params;

  if (parseInt(id) !== parseInt(req.usuario.id)) {
    return res.status(403).json({ error: 'No tienes permiso para cambiar esta contraseña.' });
  }

  const { passwordActual, passwordNueva } = req.body;

  if (!passwordActual || !passwordNueva) {
    return res.status(400).json({ error: 'Faltan datos: contraseña actual y nueva.' });
  }

  try {
    const usuario = await Usuario.findByPk(id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const coincide = await bcrypt.compare(passwordActual, usuario.password);
    if (!coincide) return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });

    const nuevaHash = await bcrypt.hash(passwordNueva, 10);
    await usuario.update({ password: nuevaHash });

    res.json({ mensaje: '✅ Contraseña actualizada correctamente.' });
  } catch (err) {
    console.error('❌ Error al cambiar contraseña:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/limpiar-device', async (req, res) => {
  const { email, password, deviceId } = req.body;

  if (!email || !password || !deviceId) {
    return res.status(400).json({ message: 'Faltan datos' });
  }

  try {
    const usuario = await Usuario.findOne({ where: { email } });
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const coincide = await bcrypt.compare(password, usuario.password);
    if (!coincide) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    // 🛑 Verificar si ya cambió el dispositivo hoy
    const ahora = new Date();
    const ultimaVez = new Date(usuario.ultimoCambioDevice || 0);
    const diferenciaEnHoras = (ahora.getTime() - ultimaVez.getTime()) / (1000 * 60 * 60);

    if (diferenciaEnHoras < 24) {
      return res.status(403).json({
        message: 'Ya realizaste un cambio de dispositivo hoy. Intentá nuevamente mañana.',
      });
    }

    // 🔄 Actualizar device y fecha del cambio
    await usuario.update({
      deviceId,
      ultimoCambioDevice: ahora,
    });

    res.json({ message: '✅ Dispositivo actualizado correctamente. Ahora podés iniciar sesión.' });
  } catch (error) {
    console.error('❌ Error al limpiar deviceId:', error);
    res.status(500).json({ message: 'Error al limpiar deviceId' });
  }
});

// GET /api/usuarios/:id/perfil  (perfil con privacidad aplicada)
router.get('/:id/perfil', async (req, res) => {
  const { id } = req.params;
  const solicitanteId = req.query.solicitanteId;

  try {
    const usuario = await Usuario.findByPk(id, {
      attributes: [
        'id','nombre','email','fotoPerfil','perfilPublico','partidosJugados',
        // valores básicos
        'localidad','sexo','edad',
        // valores opcionales
        'fechaNacimiento','lugarNacimiento','nacionalidad','estadoCivil',
        'dondeVivo','profesion','empleo','religion','musicaFavorita','institucion',
        // flags
        'mostrar_localidad','mostrar_sexo','mostrar_edad',
        'mostrar_fechaNacimiento','mostrar_lugarNacimiento','mostrar_nacionalidad',
        'mostrar_estadoCivil','mostrar_dondeVivo','mostrar_profesion','mostrar_empleo',
        'mostrar_religion','mostrar_musicaFavorita','mostrar_institucion',
      ],
      include: [{
        model: UsuarioDeporte,
        include: [{ model: Deporte }]
      }]
    });

    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const deportes = usuario.UsuarioDeportes?.map(ud => ud.Deporte?.nombre) || [];

    // Estado amistad/pendiente (igual que tu /:id)
    let esAmigo = false;
    let haySolicitudPendiente = false;
    if (solicitanteId && solicitanteId !== id) {
      const amistad = await Amistad.findOne({
        where: {
          [Op.or]: [
            { usuarioId: solicitanteId, amigoId: id },
            { usuarioId: id, amigoId: solicitanteId }
          ],
          estado: 'aceptado'
        }
      });
      if (amistad) {
        esAmigo = true;
      } else {
        const pendiente = await Amistad.findOne({
          where: {
            [Op.or]: [
              { usuarioId: solicitanteId, amigoId: id },
              { usuarioId: id, amigoId: solicitanteId }
            ],
            estado: 'pendiente'
          }
        });
        haySolicitudPendiente = !!pendiente;
      }
    }

    const u = usuario.toJSON();
    const esPropioPerfil = String(solicitanteId) === String(id);

    if (esPropioPerfil) {
      // Dueño del perfil → todo
      return res.json({
        ...u,
        deportes,
        esAmigo,
        haySolicitudPendiente
      });
    }

    // Terceros → aplicar flags
    const safe = {
      id: u.id,
      nombre: u.nombre,
      email: u.email, // si querés, podés agregar un flag para el email también
      fotoPerfil: u.fotoPerfil,
      perfilPublico: u.perfilPublico,
      partidosJugados: u.partidosJugados || 0,

      // básicos
      localidad: u.mostrar_localidad ? u.localidad : null,
      sexo: u.mostrar_sexo ? u.sexo : null,
      edad: u.mostrar_edad ? u.edad : null,

      // opcionales
      fechaNacimiento: u.mostrar_fechaNacimiento ? u.fechaNacimiento : null,
      lugarNacimiento: u.mostrar_lugarNacimiento ? u.lugarNacimiento : null,
      nacionalidad: u.mostrar_nacionalidad ? u.nacionalidad : null,
      estadoCivil: u.mostrar_estadoCivil ? u.estadoCivil : null,
      dondeVivo: u.mostrar_dondeVivo ? u.dondeVivo : null,
      profesion: u.mostrar_profesion ? u.profesion : null,
      empleo: u.mostrar_empleo ? u.empleo : null,
      religion: u.mostrar_religion ? u.religion : null,
      musicaFavorita: u.mostrar_musicaFavorita ? u.musicaFavorita : null,
      institucion: u.mostrar_institucion ? u.institucion : null,

      // también devolvemos las flags para que el front pinte “Visible/Oculto”
      mostrar_localidad: u.mostrar_localidad,
      mostrar_sexo: u.mostrar_sexo,
      mostrar_edad: u.mostrar_edad,
      mostrar_fechaNacimiento: u.mostrar_fechaNacimiento,
      mostrar_lugarNacimiento: u.mostrar_lugarNacimiento,
      mostrar_nacionalidad: u.mostrar_nacionalidad,
      mostrar_estadoCivil: u.mostrar_estadoCivil,
      mostrar_dondeVivo: u.mostrar_dondeVivo,
      mostrar_profesion: u.mostrar_profesion,
      mostrar_empleo: u.mostrar_empleo,
      mostrar_religion: u.mostrar_religion,
      mostrar_musicaFavorita: u.mostrar_musicaFavorita,
      mostrar_institucion: u.mostrar_institucion,

      deportes,
      esAmigo,
      haySolicitudPendiente
    };

    res.json(safe);
  } catch (error) {
    console.error('❌ Error en GET /usuarios/:id/perfil:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// routes/usuarios.js
router.get('/:id/perfil-completo', autenticarToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id !== parseInt(req.usuario.id, 10)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const usuario = await Usuario.findByPk(id, {
    attributes: [
      'id','nombre','email','fotoPerfil','localidad','sexo','edad',
      // opcionales:
      'fechaNacimiento','lugarNacimiento','nacionalidad','estadoCivil',
      'dondeVivo','profesion','empleo','religion','musicaFavorita','institucion',
      // flags:
      'mostrar_edad','mostrar_sexo','mostrar_localidad',
      'mostrar_fechaNacimiento','mostrar_lugarNacimiento','mostrar_nacionalidad',
      'mostrar_estadoCivil','mostrar_dondeVivo','mostrar_profesion','mostrar_empleo',
      'mostrar_religion','mostrar_musicaFavorita','mostrar_institucion',
    ]
  });
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(usuario);
});


// GET /api/usuarios/:id/referidos?soloVerificados=1&distinctDevice=1&limit=50&offset=0
// ✅ GET /api/usuarios/:id/referidos  (lista con filtros consistentes)
router.get('/:id/referidos', async (req, res) => {
  try {
    const { soloVerificados, distinctDevice, limit = 50, offset = 0 } = req.query;
    const userId = parseInt(req.params.id, 10);

    const where = { referidoPorId: userId };
    if (isTrue(soloVerificados)) where.verificado = true;

    let lista = await Usuario.findAll({
      where,
      attributes: ['id', 'nombre', 'email', 'codigoReferencia', 'deviceId', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: Number(offset),
      raw: true
    });

    if (isTrue(distinctDevice)) {
      const referente = await Usuario.findByPk(userId, { attributes: ['deviceId'], raw: true });
      const deviceReferente = referente?.deviceId || null;

      const vistos = new Set();
      lista = lista.filter(r => {
        const dev = r.deviceId || '';
        if (!dev || dev === deviceReferente) return false;
        if (vistos.has(dev)) return false;
        vistos.add(dev);
        return true;
      });
    }

    res.json(lista);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar referidos' });
  }
});

// ✅ NUEVO: GET /api/usuarios/:id/referidos/count  (para el badge)
router.get('/:id/referidos/count', async (req, res) => {
  try {
    const { soloVerificados, distinctDevice } = req.query;
    const userId = parseInt(req.params.id, 10);

    const where = { referidoPorId: userId };
    if (isTrue(soloVerificados)) where.verificado = true;

    if (isTrue(distinctDevice)) {
      const referidos = await Usuario.findAll({ where, attributes: ['deviceId'], raw: true });
      const referente = await Usuario.findByPk(userId, { attributes: ['deviceId'], raw: true });
      const deviceReferente = referente?.deviceId || null;

      const setUnicos = new Set(
        referidos
          .map(r => r.deviceId)
          .filter(d => d && d !== deviceReferente)
      );
      return res.json({ total: setUnicos.size });
    }

    const total = await Usuario.count({ where });
    res.json({ total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al contar referidos' });
  }
});
// --- Constantes/ayudas (dejá estas donde ya las tenías) ---
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'rv98478@gmail.com';
const PRIZE_THRESHOLD = 40;
const limpiar = (v) => (v || '').trim();

// ✅ ÚNICO endpoint para reclamar premio (sin campo documento)
router.post('/:id/referidos/reclamar', autenticarToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    // 🔒 Solo el propio usuario puede reclamar
    if (req.usuario.id !== userId) {
      return res.status(403).json({ error: 'No autorizado para reclamar este premio.' });
    }

    // 🧍 Usuario (ya SIN campos de documento)
    const usuario = await Usuario.findByPk(userId, {
      attributes: ['id', 'email', 'nombre', 'deviceId', 'premioReclamado', 'codigoReferencia'],
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (usuario.premioReclamado) {
      return res.status(400).json({ error: 'Ya reclamaste tu premio.' });
    }

    // 📊 Recalcular referidos válidos (verificados + 1 por device distinto al del referente)
    const deviceReferente = limpiar(usuario.deviceId);
    const referidos = await Usuario.findAll({
      where: { referidoPorId: userId, verificado: true },
      attributes: ['deviceId'],
      raw: true,
    });

    const unicos = new Set(
      referidos
        .map((r) => limpiar(r.deviceId))
        .filter((d) => d && d !== deviceReferente)
    );
    const totalDistinct = unicos.size;

    if (totalDistinct < PRIZE_THRESHOLD) {
      return res.status(400).json({
        error: `Aún no alcanzaste los ${PRIZE_THRESHOLD} referidos verificados.`,
        totalDistinct,
      });
    }

    // 🏅 Marcar premio como reclamado (antes de enviar mails)
    usuario.premioReclamado = true;
    await usuario.save();

    // Datos para emails
    const nombreUsuario = usuario.nombre || `Usuario #${usuario.id}`;
    const codigoRef = usuario.codigoReferencia || `MC${String(usuario.id).padStart(8, '0')}`;
    const fechaAR = new Date().toLocaleString('es-AR');

    // 📧 1) Email al ADMIN con nombre y correo del ganador
    try {
      await transporter.sendMail({
        from: `"MatchClub Premios" <${process.env.EMAIL_USER}>`,
        to: ADMIN_EMAIL,
        subject: '🎉 Usuario reclamó premio de referidos',
        html: `
          <h2>🎁 Reclamo de premio</h2>
          <p><b>Nombre:</b> ${nombreUsuario}</p>
          <p><b>Email:</b> ${usuario.email}</p>
          <p><b>Código de Referencia:</b> ${codigoRef}</p>
          <p><b>Referidos válidos (distinct):</b> ${totalDistinct}</p>
          <p><b>Fecha:</b> ${fechaAR}</p>
          <hr/>
          <p>Este usuario alcanzó ${PRIZE_THRESHOLD}+ referidos verificados y reclamó su premio.</p>
        `,
      });
      console.log(`📩 Email enviado a ADMIN (${ADMIN_EMAIL}) por reclamo de ${usuario.email}`);
    } catch (err) {
      console.error('❌ Error al enviar correo al admin:', err);
      // no cortamos el flujo si falla
    }

    // 📧 2) Email al USUARIO: felicitación
    try {
      await transporter.sendMail({
        from: `"MatchClub Premios" <${process.env.EMAIL_USER}>`,
        to: usuario.email,
        subject: '🎉 ¡Felicitaciones! Registramos tu reclamo de premio',
        html: `
          <h2>¡Felicitaciones ${nombreUsuario}!</h2>
          <p>Tu reclamo por el premio de referidos fue registrado correctamente.</p>
          <p>En breve te contactaremos con los pasos siguientes para la entrega del premio.</p>
          <p><b>Tu código de referencia:</b> ${codigoRef}</p>
          <p><b>Referidos válidos:</b> ${totalDistinct}</p>
          <br/>
          <p>¡Gracias por hacer crecer la comunidad de MatchClub! 💚</p>
        `,
      });
      console.log(`📩 Email de confirmación enviado a usuario (${usuario.email})`);
    } catch (err) {
      console.error('❌ Error al enviar correo al usuario:', err);
    }

    // ✅ Respuesta al cliente
    return res.json({
      mensaje: `🎉 ¡Felicitaciones ${usuario.nombre || ''}! Tu reclamo fue registrado correctamente.`,
      totalDistinct,
    });
  } catch (error) {
    console.error('❌ Error al reclamar premio:', error);
    res.status(500).json({ error: 'Error interno al reclamar el premio.' });
  }
});


module.exports = router;
