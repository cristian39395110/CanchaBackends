const express = require('express');
const router = express.Router();
const Usuario = require('../models/usuario');
const UsuarioDeporte = require('../models/usuarioDeporte');
const Deporte = require('../models/deporte');
const Amistad = require('../models/amistad');
const Bloqueo = require('../models/Bloqueo');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const SECRET_KEY = process.env.JWT_SECRET;

// Configuración de multer para guardar archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/';
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Configuración de Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Crear un usuario (registro con verificación)
router.post('/', upload.single('fotoPerfil'), async (req, res) => {
  try {
    const {
      nombre,
      telefono,
      email,
      password,
      localidad,
      latitud,
      longitud
    } = req.body;

    const tokenVerificacion = uuidv4();

    const nuevoUsuario = await Usuario.create({
      nombre,
      telefono,
      email,
      password,
      localidad,
      latitud,
      longitud,
      fotoPerfil: req.file ? req.file.filename : null,
      verificado: false,
      tokenVerificacion
    });

    const link = `https://canchabackends-1.onrender.com/api/usuarios/verificar/${tokenVerificacion}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verifica tu cuenta',
      html: `<h2>Bienvenido/a ${nombre}</h2><p>Haz clic en el siguiente enlace para verificar tu cuenta:</p><a href="${link}">${link}</a>`
    });

    res.status(201).json({ mensaje: 'Usuario creado. Revisa tu correo para confirmar la cuenta.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



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
});// Verificación de cuenta
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
  const { email, password } = req.body;

  try {
    const usuario = await Usuario.findOne({ where: { email } });
   

    if (!usuario || usuario.password !== password) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    if (!usuario.verificado) {
      return res.status(403).json({ message: 'Debes verificar tu correo electrónico antes de iniciar sesión.' });
    }

    const token = jwt.sign({ id: usuario.id, email: usuario.email, premium: usuario.premium }, SECRET_KEY, { expiresIn: '1h' });

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

// Obtener un usuario por ID (con URL completa de la imagen)


router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const usuario = await Usuario.findByPk(id, {
      attributes: ['id', 'nombre', 'email', 'fotoPerfil', 'localidad', 'perfilPublico', 'partidosJugados'],
      include: [{
        model: UsuarioDeporte,
        include: [{ model: Deporte }],
      }],
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const deportes = usuario.UsuarioDeportes?.map(ud => ud.Deporte?.nombre) || [];

    res.json({
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      fotoPerfil: usuario.fotoPerfil,
      localidad: usuario.localidad,
      perfilPublico: usuario.perfilPublico,
      partidosJugados: usuario.partidosJugados || 0,
      deportes,
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


module.exports = router;
