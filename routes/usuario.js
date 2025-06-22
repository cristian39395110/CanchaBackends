const express = require('express');
const router = express.Router();
const Usuario = require('../models/usuario');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
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

    const link = `https://tusitio.com/api/usuarios/verificar/${tokenVerificacion}`;

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
  const id = req.params.id;
  try {
    const usuario = await Usuario.findByPk(id);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });

    const usuarioJson = usuario.toJSON();
    if (usuarioJson.fotoPerfil) {
      usuarioJson.fotoPerfil = `${req.protocol}://${req.get('host')}/uploads/${usuarioJson.fotoPerfil}`;
    }

    res.json(usuarioJson);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;
