//routes/publicacion

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');


const { Publicacion, Usuario, Amistad, Comentario, Like ,PublicacionLeida,envioNotificacion} = require('../models/model');

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
  params: async (req, file) => ({
    folder: 'publicaciones',
    resource_type: 'auto', // 👈 Esto permite subir tanto imágenes como videos
    allowed_formats: ['jpg', 'jpeg', 'png', 'mp4'],
  }),
});


const upload = multer({ storage });


// ✅ GET publicaciones que aparecen en el muro de un perfil
router.get('/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const publicaciones = await Publicacion.findAll({
      where: { perfilId: usuarioId }, // 👈 cambio clave
      include: [
        {
          model: Usuario,
          attributes: ['id', 'nombre', 'fotoPerfil']
        },
        {
          model: Comentario,
          include: [{ model: Usuario, attributes: ['id', 'nombre', 'fotoPerfil'] }]
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

// POST /api/publicaciones/leidas
router.post('/leidas', async (req, res) => {
  const { usuarioId } = req.body;

  if (!usuarioId) return res.status(400).json({ error: 'Falta usuarioId' });

  try {
    const amistades = await Amistad.findAll({
      where: {
        [Op.or]: [
          { usuarioId },
          { amigoId: usuarioId }
        ],
        estado: 'aceptado'
      }
    });

    const idsAmigos = amistades.map(a =>
      a.usuarioId === Number(usuarioId) ? a.amigoId : a.usuarioId
    );

    const publicaciones = await Publicacion.findAll({
      where: {
        usuarioId: { [Op.in]: idsAmigos }
      }
    });

    for (const pub of publicaciones) {
      const yaLeida = await PublicacionLeida.findOne({
        where: {
          usuarioId,
          publicacionId: pub.id
        }
      });

      if (!yaLeida) {
        await PublicacionLeida.create({
          usuarioId,
          publicacionId: pub.id
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error al marcar publicaciones como leídas:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/publicaciones/nuevas/:usuarioId
router.get('/nuevas/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  if (!usuarioId) return res.status(400).json({ error: 'Falta usuarioId' });

  try {
    const amistades = await Amistad.findAll({
      where: {
        [Op.or]: [
          { usuarioId },
          { amigoId: usuarioId }
        ],
        estado: 'aceptado'
      }
    });

    const idsAmigos = amistades.map(a =>
      a.usuarioId === Number(usuarioId) ? a.amigoId : a.usuarioId
    );

    const publicaciones = await Publicacion.findAll({
      where: {
        usuarioId: { [Op.in]: idsAmigos }
      }
    });

    let noVistas = 0;

    for (const pub of publicaciones) {
      const leida = await PublicacionLeida.findOne({
        where: {
          usuarioId,
          publicacionId: pub.id
        }
      });

      if (!leida) noVistas++;
    }

    res.json({ nuevas: noVistas });
  } catch (err) {
    console.error('❌ Error al contar nuevas publicaciones:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ✅ POST nueva publicación
router.post('/', upload.single('foto'), async (req, res) => {
  const { contenido, usuarioId, perfilId } = req.body;

  try {
    const idUsuario = Number(usuarioId);
    const idPerfil = Number(perfilId);

    if (!idUsuario || !idPerfil) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    if (idUsuario !== idPerfil) {
      const amistad = await Amistad.findOne({
        where: {
          estado: 'aceptado',
          [Op.or]: [
            { usuarioId: idUsuario, amigoId: idPerfil },
            { usuarioId: idPerfil, amigoId: idUsuario }
          ]
        }
      });

      if (!amistad) {
        return res.status(403).json({ error: 'No tenés permiso para publicar en este perfil' });
      }
    }

    const usuario = await Usuario.findByPk(idUsuario);

    const nueva = await Publicacion.create({
      usuarioId: idUsuario,
      contenido,
      perfilId: idPerfil,
      foto: req.file ? req.file.path : null,
      cloudinaryId: req.file ? req.file.filename : null,
      esPublica: true
    });

    const nuevaConUsuario = await Publicacion.findByPk(nueva.id, {
      include: [
        {
          model: Usuario,
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
      ]
    });

    const amistades = await Amistad.findAll({
      where: {
        estado: 'aceptado',
        [Op.or]: [
          { usuarioId: idUsuario },
          { amigoId: idUsuario }
        ]
      }
    });

    const amigos = amistades.map(a =>
      a.usuarioId === idUsuario ? a.amigoId : a.usuarioId
    );

    const io = req.app.get('io');

    for (const amigoId of amigos) {
      await envioNotificacion.create({
        usuarioId: amigoId,
        emisorId: idUsuario,
        tipo: 'publicacion',
        mensaje: `🆕 ${usuario.nombre} publicó algo nuevo`,
        fotoEmisor: usuario.fotoPerfil,
        publicacionId: nueva.id
      });

      io.to(`usuario-${amigoId}`).emit('nueva-publicacion', {
        publicacion: nuevaConUsuario
      });

      io.to(`usuario-${amigoId}`).emit('nuevaNotificacion', {
        tipo: 'publicacion',
        mensaje: `🆕 ${usuario.nombre} publicó algo nuevo`,
        foto: usuario.fotoPerfil,
        publicacionId: nueva.id
      });
    }

    res.status(201).json(nuevaConUsuario);
  } catch (err) {
    console.error('❌ Error al crear publicación:', err);
    res.status(500).json({ error: 'Error al crear publicación' });
  }
});


// ✅ DELETE publicación
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { usuarioId } = req.query;

  try {
    const publicacion = await Publicacion.findByPk(id);
    if (!publicacion) return res.status(404).json({ error: 'No encontrada' });

    // ✅ Verificar que el usuario es el dueño del perfil o el autor
    if (
      String(publicacion.usuarioId) !== String(usuarioId) &&
      String(publicacion.perfilId) !== String(usuarioId)
    ) {
      return res.status(403).json({ error: 'No autorizado para eliminar esta publicación' });
    }

    // ✅ Eliminar notificaciones relacionadas a esta publicación
    await envioNotificacion.destroy({
      where: { publicacionId: id }
    });

    // ✅ Eliminar de Cloudinary si corresponde
    if (publicacion.cloudinaryId) {
      try {
        await cloudinary.uploader.destroy(publicacion.cloudinaryId);
      } catch (err) {
        console.warn('⚠️ No se pudo eliminar de Cloudinary:', err.message);
      }
    }

    // ✅ Eliminar publicación
    await publicacion.destroy();

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

// o usá req.app.get('io') si lo tenés así

router.post('/:publicacionId/comentarios', async (req, res) => {
  const ioInstance = req.app.get('io'); 
  const { publicacionId } = req.params;
  const { usuarioId, contenido } = req.body;

  try {
    const nuevoComentario = await Comentario.create({
      publicacionId,
      usuarioId,
      contenido,
    });

    const comentarioConUsuario = await Comentario.findByPk(nuevoComentario.id, {
      include: [{ model: Usuario, attributes: ['id', 'nombre', 'fotoPerfil'] }],
    });

    const publicacion = await Publicacion.findByPk(publicacionId, {
      include: [{ model: Usuario, attributes: ['id', 'nombre'] }]
    });

    if (!publicacion) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }

    const receptorId = publicacion.usuarioId;
    const emisorId = Number(usuarioId);

    if (emisorId !== receptorId) {
      const nuevaNotificacion = await envioNotificacion.create({
        usuarioId: receptorId,
        emisorId,
        tipo: 'comentario',
        leida: false,
        publicacionId: publicacion.id,
        mensaje: `💬 ${comentarioConUsuario.Usuario.nombre} comentó tu publicación.`,
      });

      ioInstance.to(`usuario-${receptorId}`).emit('nuevaNotificacion', {
        id: nuevaNotificacion.id,
        tipo: 'comentario',
        mensaje: nuevaNotificacion.mensaje,
        foto: comentarioConUsuario.Usuario.fotoPerfil,
        publicacionId: publicacion.id,
        emisorId: emisorId
      });
    }

    res.status(201).json(comentarioConUsuario);
  } catch (error) {
    console.error('❌ Error al comentar:', error);
    res.status(500).json({ error: 'Error al agregar comentario' });
  }
});
// ✅ GET /api/publicaciones/detalle/:id
router.get('/detalle/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const publicacion = await Publicacion.findByPk(id, {
      include: [
        {
          model: Usuario,
          attributes: ['id', 'nombre', 'fotoPerfil']
        },
        {
          model: Comentario,
          include: [
            {
              model: Usuario,
              attributes: ['id', 'nombre', 'fotoPerfil']
            }
          ]
        },
        {
          model: Like,
          include: [
            {
              model: Usuario,
              attributes: ['id', 'nombre']
            }
          ]
        }
      ]
    });

    if (!publicacion) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }

    res.json(publicacion);
  } catch (err) {
    console.error('❌ Error al obtener detalle de publicación:', err);
    res.status(500).json({ error: 'Error al obtener la publicación' });
  }
});



router.delete('/comentarios/:comentarioId', async (req, res) => {
  const { comentarioId } = req.params;
  const { usuarioId } = req.query;

  try {
    const comentario = await Comentario.findByPk(comentarioId);
    if (!comentario) return res.status(404).json({ error: 'Comentario no encontrado' });

    if (comentario.usuarioId !== Number(usuarioId)) {
      return res.status(403).json({ error: 'No tenés permiso para borrar este comentario' });
    }

    // 🧽 Eliminar notificaciones del tipo 'comentario' asociadas a esta publicación y este emisor
    await envioNotificacion.destroy({
      where: {
        tipo: 'comentario',
        publicacionId: comentario.publicacionId,
        emisorId: comentario.usuarioId
      }
    });

    await comentario.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error al borrar comentario y notificación:', error);
    res.status(500).json({ error: 'Error al borrar el comentario' });
  }
});


module.exports = router;
