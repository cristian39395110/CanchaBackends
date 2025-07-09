const express = require('express');
const router = express.Router();
const Usuario = require('../models/usuario');
const HistorialPuntuacion = require('../models/historialPuntuacion');
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




router.get('/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;
   console.log("usuarioId------------")
  console.log(usuarioId)

  try {
    const reseñas = await HistorialPuntuacion.findAll({
      where: { puntuadoId: usuarioId },
      include: [{ model: Usuario, as: 'Calificador', attributes: ['nombre'] }]
    });

    res.json(reseñas);
  } catch (err) {
    console.error('❌ Error al obtener reseñas:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});



module.exports = router;