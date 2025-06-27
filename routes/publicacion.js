const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

const { Publicacion, Usuario, Amistad, Comentario, Like } = require('../models/model');

// 🖼️ Configuración de multer para subir imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/publicaciones');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + file.originalname;
    cb(null, unique);
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

    const amigosIds = amistades.map(a => (
      a.usuarioId == usuarioId ? a.amigoId : a.usuarioId
    ));
    const idsParaBuscar = [...amigosIds, Number(usuarioId)];

    let publicaciones = await Publicacion.findAll({
      where: {
  usuarioId: {
    [Op.in]: idsParaBuscar
  }
},

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
      ],
      order: [['createdAt', 'DESC']]
    });

    // Agregar URL completa a la imagen
    publicaciones = publicaciones.map(publi => {
      const obj = publi.toJSON();
      if (obj.foto && !obj.foto.startsWith('http')) {
        obj.foto = `${req.protocol}://${req.get('host')}/uploads/publicaciones/${obj.foto}`;
      }
      return obj;
    });
   console.log(publicaciones)
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
      foto: req.file ? req.file.filename : null,
      esPublica: true
    });

    res.status(201).json({
      ...nueva.toJSON(),
      foto: req.file ? `${req.protocol}://${req.get('host')}/uploads/publicaciones/${req.file.filename}` : null
    });
  } catch (err) {
    console.error(err);
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
      await existente.destroy();
      return res.json({ liked: false });
    }

    await Like.create({ publicacionId, usuarioId });
    res.json({ liked: true });
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
