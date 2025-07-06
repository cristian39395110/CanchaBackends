const express = require('express');
const router = express.Router();
const { Cancha } = require('../models/model');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


// Middleware para subir imágenes
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ GET /api/canchas — todas las canchas
router.get('/', async (req, res) => {
  try {
    const canchas = await Cancha.findAll();
    res.json(canchas);
  } catch (error) {
    console.error('❌ Error al obtener canchas:', error);
    res.status(500).json({ error: 'Error al obtener canchas' });
  }
});

// ✅ POST /api/canchas — crear nueva cancha (solo admin)
router.post('/', upload.single('foto'), async (req, res) => {
  const { nombre, direccion, latitud, longitud, deportes, telefono, whatsapp } = req.body;

  try {
    let fotoUrl = null;

    if (req.file) {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'canchas' },
        (error, result) => {
          if (error) {
            console.error('❌ Error al subir imagen:', error);
            return res.status(500).json({ error: 'Error al subir imagen' });
          }

          fotoUrl = result.secure_url;

          Cancha.create({
            nombre,
            direccion,
            latitud,
            longitud,
            deportes,
            telefono,
            whatsapp,
            foto: fotoUrl,
          })
            .then((nuevaCancha) => res.json(nuevaCancha))
            .catch((err) => {
              console.error('❌ Error al guardar cancha:', err);
              res.status(500).json({ error: 'Error al guardar la cancha' });
            });
        }
      );

      streamifier.createReadStream(req.file.buffer).pipe(stream);
    } else {
      const nuevaCancha = await Cancha.create({
        nombre,
        direccion,
        latitud,
        longitud,
        deportes,
        telefono,
        whatsapp,
        foto: null,
      });
      res.json(nuevaCancha);
    }
  } catch (error) {
    console.error('❌ Error en POST cancha:', error);
    res.status(500).json({ error: 'Error al crear la cancha' });
  }
});

module.exports = router;
