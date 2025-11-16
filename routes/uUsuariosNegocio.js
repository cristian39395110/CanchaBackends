// routes/usuariosNegocio.js (o como lo llamaste)
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const uUsuarioNegocio = require('../models/uUsuariosNegocio');

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY || 'clave-ultra-secreta';

// 📧 Configuración del envío de mails (igual que la tuya)
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

// 👉 la misma función que usabas en /routes/usuario
function generarPasswordAleatoria(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

/* ===============================
   📌 Registro de nuevo usuario
   =============================== */
router.post('/registro', async (req, res) => {
  try {
    const { nombre, email, password, telefono, provincia, localidad, deviceId } = req.body;

    const existente = await uUsuarioNegocio.findOne({ where: { email } });
    if (existente) return res.status(400).json({ message: 'El correo ya está registrado' });

    const hash = await bcrypt.hash(password, 10);
    const tokenVerificacion = uuidv4();

    const nuevo = await uUsuarioNegocio.create({
      nombre,
      email,
      password: hash,
      telefono,
      provincia,
      localidad,
      deviceId,
      tokenVerificacion,
      verificado: false,
    });

    const link = `${process.env.FRONT_URL || 'http://localhost:5173'}/verificar/${tokenVerificacion}`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verificá tu cuenta - CompraPuntos',
      html: `<h2>Hola ${nombre} 👋</h2><p>Confirmá tu cuenta haciendo clic aquí:</p><a href="${link}">${link}</a>`,
    });

    res.json({ message: 'Usuario registrado. Revisá tu correo para verificar la cuenta.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
});

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
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (!usuario.verificado) return res.status(403).json({ message: 'Verificá tu correo antes de iniciar sesión' });

    const valido = await bcrypt.compare(password, usuario.password);
    if (!valido) return res.status(401).json({ message: 'Contraseña incorrecta' });

    // deviceId (igual que ya tenías)
    if (usuario.deviceId && usuario.deviceId !== deviceId) {
      return res.status(403).json({ message: 'Este correo ya está vinculado a otro celular.' });
    }
    if (!usuario.deviceId && deviceId) {
      usuario.deviceId = deviceId;
      await usuario.save();
    }

    // 👇 payload con flags y rol
    const payload = {
      id: usuario.id,
      rol: 'negocio',
      esAdmin: !!usuario.esAdmin,
      esPremium: !!usuario.esPremium,
      email: usuario.email,
      nombre: usuario.nombre,
    };

    const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '12h' });

    // 👇 devolvé también los flags por comodidad del FE
    res.json({
      token,
      usuarioId: usuario.id,
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
router.get('/yo', async (req, res) => {
  try {


    const header = req.headers['authorization'];
 

    if (!header) return res.status(401).json({ message: 'Token requerido' });

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, SECRET_KEY);

    const usuario = await uUsuarioNegocio.findByPk(decoded.id, {
      attributes: { exclude: ['password'] },
    });

    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json(usuario);
  } catch (error) {
    res.status(401).json({ message: 'Token inválido o expirado' });
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
