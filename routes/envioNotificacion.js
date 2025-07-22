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

    // ✅ Obtener io desde la app
    const io = req.app.get('io');
    io.to(`usuario-${usuarioId}`).emit('nuevaNotificacion', nueva);

    res.json(nueva);
  } catch (error) {
    console.error('❌ Error al crear notificación', error);
    res.status(500).json({ error: 'Error al crear notificación' });
  }
});



// GET /api/notificaciones/:usuarioId
router.get('/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const notificaciones = await envioNotificacion.findAll({
      where: { usuarioId },
      order: [['createdAt', 'DESC']],
      limit: 50, // opcional: limitar a las últimas 50
      include: [
        {
          model: Usuario,
          as: 'emisor',
          attributes: ['id', 'nombre', 'fotoPerfil']
        },
        {
          model: Publicacion,
          attributes: ['id', 'contenido', 'foto'] // si querés mostrar algo de la publi
        }
      ]
    });

    res.json(notificaciones);
  } catch (error) {
    console.error('❌ Error al obtener notificaciones:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// PATCH /api/notificaciones/marcar-leida/:id
router.patch('/marcar-leida/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const noti = await envioNotificacion.findByPk(id);
    if (!noti) return res.status(404).json({ error: 'Notificación no encontrada' });

    noti.leida = true;
    await noti.save();

    res.json({ mensaje: '✅ Notificación marcada como leída' });
  } catch (error) {
    console.error('❌ Error al marcar notificación como leída:', error);
    res.status(500).json({ error: 'Error al actualizar notificación' });
  }
});

// DELETE /api/notificaciones/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const noti = await envioNotificacion.findByPk(id);
    if (!noti) return res.status(404).json({ error: 'Notificación no encontrada' });

    await noti.destroy();
    res.json({ mensaje: '🗑️ Notificación eliminada correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar notificación:', error);
    res.status(500).json({ error: 'Error al eliminar notificación' });
  }
});


// PATCH /api/notificaciones/marcar-todas/:usuarioId
router.patch('/marcar-todas/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    await envioNotificacion.update(
      { leida: true },
      { where: { usuarioId, leida: false } }
    );

    res.json({ mensaje: '✅ Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    console.error('❌ Error al marcar todas como leídas:', error);
    res.status(500).json({ error: 'Error al actualizar notificaciones' });
  }
});
