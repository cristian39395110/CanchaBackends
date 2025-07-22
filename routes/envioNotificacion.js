//envioNotificacion.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');


const { Publicacion, Usuario, Amistad, Comentario, Like ,PublicacionLeida,envioNotificacion} = require('../models/model');

// routes/notificaciones.js
router.post('/crear', async (req, res) => {
  const { usuarioId, emisorId, tipo, mensaje, fotoEmisor, publicacionId } = req.body;
  try {
    const nueva = await envioNotificacion.create({
      usuarioId,
      emisorId,
      tipo,
      mensaje,
      fotoEmisor,
      publicacionId
    });
    
    // Emitir por socket si está conectado
    io.to(`usuario-${usuarioId}`).emit('nuevaNotificacion', nueva);

    res.json(nueva);
  } catch (error) {
    console.error('❌ Error al crear notificación', error);
    res.status(500).json({ error: 'Error al crear notificación' });
  }
});
