const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

const { Publicacion, Usuario, Amistad, Comentario, Like } = require('../models/model');

// 🖼️ Configuración de multer para subir imágenes
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configurar Cloudinary con tus datos del .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage para publicaciones (carpeta Cloudinary: publicaciones)
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'publicaciones',
    allowed_formats: ['jpg', 'jpeg', 'png', 'mp4'],
  },
});

const upload = multer({ storage });


// ✅ GET publicaciones de un usuario (perfil)
router.get('/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const publicaciones = await Publicacion.findAll({
      where: { usuarioId },
      include: [
        {
          model: Comentario,
          include: [{ model: Usuario, attributes: ['id', 'nombre'] }]
        },
        {
          model: Like,
          include: [{ model: Usuario, attributes: ['id', 'nombre'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(publicaciones);
  } catch (err) {
    console.error('❌ Error al obtener publicaciones:', err);
    res.status(500).json({ error: 'Error al obtener publicaciones' });
  }
});

// ✅ GET publicaciones de amigos + uno mismo (muro general)
router.get('/amigos/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const amistades = await Amistad.findAll({
      where: {
        estado: 'aceptado',
        [Op.or]: [
          { usuarioId },
          { amigoId: usuarioId }
        ]
      }
    });

    const amigosIds = amistades.map(a =>
      a.usuarioId == usuarioId ? a.amigoId : a.usuarioId
    );

    const idsParaBuscar = [...amigosIds, Number(usuarioId)];

    const publicaciones = await Publicacion.findAll({
      where: {
        usuarioId: { [Op.in]: idsParaBuscar }
      },
      include: [
        {
          model: Usuario, // ✅ sin alias
          attributes: ['id', 'nombre', 'fotoPerfil']
        },
        {
          model: Comentario,
          include: [{ model: Usuario, attributes: ['id', 'nombre'] }]
        },
        {
          model: Like,
          include: [{ model: Usuario, attributes: ['id', 'nombre'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(publicaciones);
  } catch (error) {
    console.error('❌ Error en /amigos/:usuarioId', error);
    res.status(500).json({ error: 'Error al obtener publicaciones del muro' });
  }
});

// ✅ POST nueva publicación
router.post('/', upload.single('foto'), async (req, res) => {
  const { contenido, usuarioId } = req.body;

  try {
    const nueva = await Publicacion.create({
      usuarioId,
      contenido,
      foto: req.file ? req.file.path : null, // ✅ URL pública de Cloudinary
      esPublica: true
    });

    res.status(201).json({
      ...nueva.toJSON(),
      foto: req.file ? req.file.path : null // ✅ Devuelve la URL de la imagen
    });
  } catch (err) {
    console.error('❌ Error al crear publicación:', err);
    res.status(500).json({ error: 'Error al crear publicación' });
  }
});

// ✅ DELETE publicación
router.delete('/:id', async (req, res) => {
  try {
    await Publicacion.destroy({ where: { id: req.params.id } });
    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar publicación' });
  }
});

// ✅ POST dar/quitar like
router.post('/:publicacionId/like', async (req, res) => {
  const { publicacionId } = req.params;
  const { usuarioId } = req.body;

  try {
    const existente = await Like.findOne({
      where: { publicacionId, usuarioId }
    });

    if (existente) {
      // Si ya existe el like, lo eliminamos (quitar like)
      await existente.destroy();
    } else {
      // Si no existe, lo creamos (dar like)
      await Like.create({ publicacionId, usuarioId });
    }

    // Devolver la publicación actualizada con los nuevos likes
    const publicacionActualizada = await Publicacion.findByPk(publicacionId, {
      include: [{ model: Like }]
    });

    res.json(publicacionActualizada);
  } catch (error) {
    console.error('❌ Error al dar/quitar like:', error);
    res.status(500).json({ error: 'Error al procesar el like' });
  }
});

// ✅ POST comentar
router.post('/:publicacionId/comentarios', async (req, res) => {
  const { publicacionId } = req.params;
  const { usuarioId, contenido } = req.body;

  try {
    const nuevoComentario = await Comentario.create({
      publicacionId,
      usuarioId,
      contenido
    });

    const comentarioConUsuario = await Comentario.findByPk(nuevoComentario.id, {
      include: [{ model: Usuario, attributes: ['id', 'nombre'] }]
    });

    res.status(201).json(comentarioConUsuario);
  } catch (error) {
    console.error('❌ Error al comentar:', error);
    res.status(500).json({ error: 'Error al agregar comentario' });
  }
});

module.exports = router;
