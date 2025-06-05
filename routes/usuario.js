//C:\canchascapacitor2025\Canchas2025Backend\app-partidos\routes\usuario.js

const express = require('express');
const router = express.Router();
const Usuario = require('../models/usuario');
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'mi_secreto_super_seguro'; // 🔥 Mejor: ponlo en una variable de entorno

// Crear un usuario

router.get('/test', (req, res) => {
  res.send('El backend está funcionandosoooo');
});

router.post('/', async (req, res) => {
  console.log(req.body);
  try {
    const nuevoUsuario = await Usuario.create(req.body);
    res.status(201).json(nuevoUsuario);
  } catch (error) {
    res.status(500).json({ error: error.message });
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

// routes/usuario.js o en tu controlador
// Importar JWT


router.post('/login', async (req, res) => {
  const { email, password } = req.body;
console.log("hola");
  try {
    const usuario = await Usuario.findOne({ where: { email } });

    if (!usuario || usuario.password !== password) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Generar token JWT
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email },
      SECRET_KEY,
      { expiresIn: '1h' } // Expira en 1 hora
    );

    res.json({ 
      message: 'Login exitoso',
      token, 
      usuarioId: usuario.id 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});


module.exports = router;
