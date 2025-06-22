
//Canchas2025Backend\app-partidos\routes\deporte.js
const express = require('express');
const router = express.Router();
const Deporte = require('../models/deporte');
const multer = require('multer');
const path = require('path');

// Configurar almacenamiento de imágenes
const storage = multer.diskStorage({
  
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Carpeta para guardar imágenes (debes crearla)
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // nombre único
  },
});

const upload = multer({ storage });

// Crear deporte con imagen
router.post('/', upload.single('imagen'), async (req, res) => {
  try {
    console.log("calabaza")
    const { nombre } = req.body;
    const imagen = req.file ? req.file.filename : null;

    const deporte = await Deporte.create({ nombre, imagen });
    res.status(201).json(deporte);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener todos los deportes
router.get('/', async (req, res) => {

  try {
    const deportes = await Deporte.findAll();
    res.json(deportes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
