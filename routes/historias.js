// routes/historias.js
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
require('dotenv').config();

// ✅ Modelos
const Historia = require('../models/Historia');
const HistoriaVisto = require('../models/HistoriaVisto');
const HistoriaComentario = require('../models/HistoriaComentario');
const HistoriaLike = require('../models/HistoriaLike');
const Usuario = require('../models/usuario');
const Mensaje = require('../models/Mensaje'); // para enviar al chat

// ⛑️ Si querés proteger con JWT, descomentá esto y poné el middleware en POST/DELETE:
// const { autenticarToken } = require('../middlewares/auth');

// 🔧 Multer memoria
const upload = multer({ storage: multer.memoryStorage() });

// 🔧 Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 🖼️ Helper: miniatura para videos (no persiste en DB)
const buildThumbUrl = (cloudinaryId, { w = 480, h = 848 } = {}) =>
  cloudinary.url(cloudinaryId, {
    resource_type: 'video',
    format: 'jpg',
    transformation: [
      { width: w, height: h, crop: 'fill', gravity: 'auto' },
      { quality: 'auto' },
    ],
  });

/**
 * GET /api/historias?usuarioId=123
 * Devuelve últimas 24h con:
 * - datos del usuario
 * - vistos / vistoPorMi
 * - likes / likedByMe
 * - comentariosCount
 * - thumbUrl si es video
 */
router.get('/', async (req, res) => {
  try {
    const usuarioId = Number(req.query.usuarioId);
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const historias = await Historia.findAll({
      where: { createdAt: { [Op.gt]: hace24h } },
      include: [
        { model: Usuario, as: 'Usuario', attributes: ['id', 'nombre', 'fotoPerfil'] },
        { model: HistoriaVisto, as: 'Vistos', attributes: ['usuarioId'] },
        { model: HistoriaLike, as: 'Likes', attributes: ['usuarioId'] },
        { model: HistoriaComentario, as: 'Comentarios', attributes: ['id'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    const data = historias.map(h => {
      const json = h.toJSON();
      const vistosCount = json.Vistos?.length || 0;
      const vistoPorMi = usuarioId ? (json.Vistos || []).some(v => v.usuarioId === usuarioId) : false;

      const likesCount = json.Likes?.length || 0;
      const likedByMe = usuarioId ? (json.Likes || []).some(l => l.usuarioId === usuarioId) : false;

      const comentariosCount = json.Comentarios?.length || 0;

      const thumbUrl =
        json.tipo === 'video' && json.cloudinaryId
          ? buildThumbUrl(json.cloudinaryId)
          : json.mediaUrl;

      return {
        id: json.id,
        usuarioId: json.usuarioId,
        usuarioNombre: json.Usuario?.nombre,
        usuarioFoto: json.Usuario?.fotoPerfil,
        mediaUrl: json.mediaUrl,
        tipo: json.tipo,
        createdAt: json.createdAt,
        cloudinaryId: json.cloudinaryId,
        duracionSegundos: json.duracionSegundos,

        // campos nuevos
        descripcion: json.descripcion,
        linkUrl: json.linkUrl,
        phoneNumber: json.phoneNumber,

        // contadores/flags
        vistos: vistosCount,
        vistoPorMi,
        likes: likesCount,
        likedByMe,
        comentariosCount,

        // ui
        thumbUrl,
      };
    });

    res.json(data);
  } catch (err) {
    console.error('GET /historias error:', err);
    res.status(500).json({ error: 'Error al listar historias' });
  }
});

/**
 * POST /api/historias
 * Subir imagen o video(mp4). Campo: "media"
 * Body: usuarioId, [descripcion], [linkUrl], [phoneNumber]
 */
router.post(
  '/',
  // autenticarToken,
  upload.single('media'),
  async (req, res) => {
    try {
      const { usuarioId, descripcion, linkUrl, phoneNumber } = req.body;
      const file = req.file;

      if (!usuarioId) return res.status(400).json({ error: 'usuarioId es requerido' });
      if (!file) return res.status(400).json({ error: 'No se envió archivo "media"' });

      const esVideo = file.mimetype.startsWith('video/');
      const esImagen = file.mimetype.startsWith('image/');
      if (!esImagen && !(esVideo && file.mimetype === 'video/mp4')) {
        return res.status(400).json({ error: 'Formato no permitido. Solo imagen/* o video/mp4' });
      }
      if (file.size > 50 * 1024 * 1024) {
        return res.status(400).json({ error: 'Archivo demasiado grande (máx 50MB)' });
      }

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'historias',
            resource_type: esVideo ? 'video' : 'image',
          },
          (error, result) => (result ? resolve(result) : reject(error))
        );
        streamifier.createReadStream(file.buffer).pipe(stream);
      });

      // limitar duración del video (ej 20s)
      if (esVideo && result.duration && result.duration > 20) {
        try { await cloudinary.uploader.destroy(result.public_id, { resource_type: 'video' }); } catch (_) {}
        return res.status(400).json({ error: 'Video demasiado largo (máx 20s)' });
      }

      // normalizar link/teléfono
      const safeDesc = (descripcion || '').trim().slice(0, 500) || null;
      const safeLink = (linkUrl && /^https?:\/\//i.test(linkUrl)) ? linkUrl.trim().slice(0, 600) : null;
      const safePhone = phoneNumber ? String(phoneNumber).trim().slice(0, 30) : null;

      const nueva = await Historia.create({
        usuarioId: Number(usuarioId),
        mediaUrl: result.secure_url,
        cloudinaryId: result.public_id,
        tipo: esVideo ? 'video' : 'imagen',
        duracionSegundos: esVideo && result.duration ? Math.round(result.duration) : null,
        descripcion: safeDesc,
        linkUrl: safeLink,
        phoneNumber: safePhone,
      });

      const usr = await Usuario.findByPk(usuarioId, {
        attributes: ['id', 'nombre', 'fotoPerfil'],
      });

      const payload = {
        id: nueva.id,
        usuarioId: nueva.usuarioId,
        usuarioNombre: usr?.nombre,
        usuarioFoto: usr?.fotoPerfil,
        mediaUrl: nueva.mediaUrl,
        tipo: nueva.tipo,
        createdAt: nueva.createdAt,
        cloudinaryId: nueva.cloudinaryId,
        duracionSegundos: nueva.duracionSegundos,

        descripcion: nueva.descripcion,
        linkUrl: nueva.linkUrl,
        phoneNumber: nueva.phoneNumber,

        vistos: 0,
        vistoPorMi: true,
        likes: 0,
        likedByMe: false,
        comentariosCount: 0,
        thumbUrl: esVideo ? buildThumbUrl(nueva.cloudinaryId) : nueva.mediaUrl,
      };

      try {
        const io = req.app.get('io');
        if (io) io.emit('nueva-historia', { historia: payload });
      } catch (_) {}

      res.status(201).json(payload);
    } catch (err) {
      console.error('POST /historias error:', err);
      res.status(500).json({ error: 'Error al subir historia' });
    }
  }
);

/**
 * POST /api/historias/:id/visto
 * Marca visto (único) para el usuario
 */
router.post('/:id/visto', async (req, res) => {
  try {
    const historiaId = Number(req.params.id);
    const usuarioId = Number(req.body.usuarioId);
    if (!historiaId || !usuarioId) {
      return res.status(400).json({ error: 'historiaId y usuarioId son requeridos' });
    }

    await HistoriaVisto.findOrCreate({
      where: { historiaId, usuarioId },
      defaults: { historiaId, usuarioId },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /historias/:id/visto error:', err);
    res.status(500).json({ error: 'Error al marcar visto' });
  }
});

/**
 * POST /api/historias/:id/like
 * Toggle like (crea/borrar)
 * Body: { usuarioId }
 */
router.post('/:id/like', async (req, res) => {
  try {
    const historiaId = Number(req.params.id);
    const usuarioId = Number(req.body.usuarioId);
    if (!historiaId || !usuarioId) return res.status(400).json({ error: 'Datos incompletos' });

    const [row, created] = await HistoriaLike.findOrCreate({
      where: { historiaId, usuarioId },
      defaults: { historiaId, usuarioId },
    });

    let liked;
    if (!created) {
      await row.destroy();
      liked = false;
    } else {
      liked = true;
    }

    const total = await HistoriaLike.count({ where: { historiaId } });

    // socket al dueño
    try {
      const historia = await Historia.findByPk(historiaId);
      const io = req.app.get('io');
      if (io && historia) {
        io.to(`usuario-${historia.usuarioId}`).emit('historia-like', {
          historiaId,
          liked,
          total,
          usuarioId,
        });
      }
    } catch (_) {}

    res.json({ ok: true, liked, total });
  } catch (e) {
    console.error('POST /historias/:id/like', e);
    res.status(500).json({ error: 'Error al like' });
  }
});

/**
 * GET /api/historias/:id/likes
 * Lista simple de quiénes dieron like (id, nombre, foto)
 */
router.get('/:id/likes', async (req, res) => {
  try {
    const historiaId = Number(req.params.id);
    const likes = await HistoriaLike.findAll({
      where: { historiaId },
      include: [{ model: Usuario, attributes: ['id', 'nombre', 'fotoPerfil'] }],
      order: [['createdAt', 'ASC']],
    });
    res.json(
      likes.map(l => ({
        usuarioId: l.usuarioId,
        nombre: l.Usuario?.nombre,
        fotoPerfil: l.Usuario?.fotoPerfil,
      }))
    );
  } catch (e) {
    console.error('GET /historias/:id/likes', e);
    res.status(500).json({ error: 'Error al listar likes' });
  }
});

/**
 * POST /api/historias/:id/comentarios
 * Body: { usuarioId, contenido, enviarAlChat?: boolean }
 */
router.post('/:id/comentarios', async (req, res) => {
  try {
    const historiaId = Number(req.params.id);
    const { usuarioId, contenido, enviarAlChat } = req.body;

    if (!historiaId || !usuarioId || !contenido?.trim()) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const historia = await Historia.findByPk(historiaId, {
      include: [{ model: Usuario, as: 'Usuario', attributes: ['id', 'nombre'] }],
    });
    if (!historia) return res.status(404).json({ error: 'Historia no encontrada' });

    const coment = await HistoriaComentario.create({
      historiaId,
      usuarioId,
      contenido: contenido.trim().slice(0, 600),
    });

    // socket al dueño
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`usuario-${historia.usuarioId}`).emit('historia-comentario', {
          historiaId,
          comentario: {
            id: coment.id,
            usuarioId,
            contenido: coment.contenido,
            createdAt: coment.createdAt,
          },
        });
      }
    } catch (_) {}

    // (opcional) mandar al chat
    if (enviarAlChat && Number(historia.usuarioId) !== Number(usuarioId)) {
      try {
        await Mensaje.create({
          emisorId: usuarioId,
          receptorId: historia.usuarioId,
          contenido: `💬 Comentó tu historia: "${coment.contenido}"`,
        });
        // Si ya tenés sockets de /mensajes, se disparará tu flujo normal.
      } catch (e) {
        console.warn('No se pudo guardar mensaje de chat para comentario de historia:', e.message);
      }
    }

    res.status(201).json(coment);
  } catch (e) {
    console.error('POST /historias/:id/comentarios', e);
    res.status(500).json({ error: 'Error al comentar' });
  }
});

/**
 * GET /api/historias/:id/comentarios
 */
router.get('/:id/comentarios', async (req, res) => {
  try {
    const historiaId = Number(req.params.id);
    const comentarios = await HistoriaComentario.findAll({
      where: { historiaId },
      include: [{ model: Usuario, as: 'Autor', attributes: ['id', 'nombre', 'fotoPerfil'] }],
      order: [['createdAt', 'ASC']],
    });
    res.json(comentarios);
  } catch (e) {
    console.error('GET /historias/:id/comentarios', e);
    res.status(500).json({ error: 'Error al listar comentarios' });
  }
});

/**
 * DELETE /api/historias/comentarios/:comentarioId
 * Solo el autor del comentario o el dueño de la historia
 * Body o query: { usuarioId }
 */
router.delete('/comentarios/:comentarioId', async (req, res) => {
  try {
    const comentarioId = Number(req.params.comentarioId);
    const usuarioId = Number(req.body?.usuarioId || req.query?.usuarioId);
    if (!comentarioId || !usuarioId) return res.status(400).json({ error: 'Datos incompletos' });

    const coment = await HistoriaComentario.findByPk(comentarioId);
    if (!coment) return res.status(404).json({ error: 'Comentario no encontrado' });

    const historia = await Historia.findByPk(coment.historiaId);
    if (!historia) return res.status(404).json({ error: 'Historia no encontrada' });

    if (coment.usuarioId !== usuarioId && historia.usuarioId !== usuarioId) {
      return res.status(403).json({ error: 'No autorizado para eliminar este comentario' });
    }

    await coment.destroy();
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /historias/comentarios/:comentarioId', e);
    res.status(500).json({ error: 'Error al eliminar comentario' });
  }
});

/**
 * DELETE /api/historias/:id
 * Elimina historia (dueño solamente)
 * Body o query: { usuarioId }
 */
router.delete('/:id', async (req, res) => {
  try {
    const historiaId = Number(req.params.id);
    const usuarioId = Number(req.body?.usuarioId || req.query?.usuarioId);

    if (!historiaId || !usuarioId) {
      return res.status(400).json({ error: 'historiaId y usuarioId son requeridos' });
    }

    const historia = await Historia.findByPk(historiaId);
    if (!historia) return res.status(404).json({ error: 'Historia no encontrada' });
    if (historia.usuarioId !== usuarioId) {
      return res.status(403).json({ error: 'No autorizado para eliminar esta historia' });
    }

    // Cloudinary
    if (historia.cloudinaryId) {
      try {
        await cloudinary.uploader.destroy(historia.cloudinaryId, {
          resource_type: historia.tipo === 'video' ? 'video' : 'image',
        });
      } catch (err) {
        console.warn('⚠️ No se pudo eliminar de Cloudinary:', err.message);
      }
    }

    // DB: limpiar dependencias
    await Promise.all([
      HistoriaVisto.destroy({ where: { historiaId } }),
      HistoriaLike.destroy({ where: { historiaId } }),
      HistoriaComentario.destroy({ where: { historiaId } }),
    ]);

    await historia.destroy();

    // socket
    try {
      const io = req.app.get('io');
      if (io) io.emit('historia-eliminada', { id: historiaId, usuarioId });
    } catch (_) {}

    res.json({ ok: true, mensaje: 'Historia eliminada correctamente' });
  } catch (err) {
    console.error('DELETE /historias/:id error:', err);
    res.status(500).json({ error: 'Error al eliminar la historia' });
  }
});

module.exports = router;
