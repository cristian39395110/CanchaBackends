//deporte.js
const express = require('express');
const router = express.Router();
const Deporte = require('../models/deporte');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// 📦 Config Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


// 📸 Config Multer (almacena temporalmente)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // carpeta local temporal
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// 📤 Crear deporte y subir imagen a Cloudinary
router.post('/', upload.single('imagen'), async (req, res) => {
  try {
    const { nombre, categoria } = req.body;  // 👈 agregamos categoria
    const imagenLocal = req.file?.path;

    if (!imagenLocal)
      return res.status(400).json({ error: 'Imagen faltante' });

    // Subir a Cloudinary
    const subida = await cloudinary.uploader.upload(imagenLocal, {
      folder: 'deportes',
    });

    // Crear registro en la base
    const nuevo = await Deporte.create({
      nombre,
      imagen: subida.secure_url,
      categoria: categoria || 'estandar', // 👈 ENUM barato, estandar, caro
    });

    // Borrar imagen temporal local
    fs.unlinkSync(imagenLocal);

    res.status(201).json(nuevo);

  } catch (error) {
    console.error('❌ Error al subir imagen o crear deporte:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});


// 🧾 Obtener todos los deportes
router.get('/', async (req, res) => {
  try {
    const deportes = await Deporte.findAll();
    res.json(deportes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
