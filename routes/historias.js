// routes/historias.js
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
require('dotenv').config();

// ✅ Modelos (según tu estilo actual)
const Historia = require('../models/Historia');
const HistoriaVisto = require('../models/HistoriaVisto');
const Usuario = require('../models/usuario');

// ⛑️ Si querés proteger POST con token, descomentá:
// const { autenticarToken } = require('../middlewares/auth');

// 🔧 Multer igual que en /usuarios (memoria)
const upload = multer({ storage: multer.memoryStorage() });

// 🔧 Cloudinary igual que en /usuarios
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 🖼️ Helper: generar miniatura JPG para videos usando public_id (sin tocar DB)
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
 * Devuelve historias de las últimas 24h con:
 * - datos del usuario
 * - contador de vistos
 * - vistoPorMi (si pasás usuarioId)
 * - thumbUrl (si el tipo es 'video')
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
      ],
      order: [['createdAt', 'DESC']],
    });

    const data = historias.map(h => {
      const json = h.toJSON();
      const vistosCount = json.Vistos?.length || 0;
      const vistoPorMi = usuarioId
        ? (json.Vistos || []).some(v => v.usuarioId === usuarioId)
        : false;

      const thumbUrl =
        json.tipo === 'video' && json.cloudinaryId
          ? buildThumbUrl(json.cloudinaryId)  // miniatura para videos
          : json.mediaUrl;                    // imágenes usan la misma URL

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
        vistos: vistosCount,
        vistoPorMi,
        thumbUrl, // 👈 NUEVO
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
 */
router.post(
  '/',
  // autenticarToken, // ← descomentar si querés forzar login
  upload.single('media'),
  async (req, res) => {
    try {
      const { usuarioId } = req.body;
      const file = req.file;

      if (!usuarioId) return res.status(400).json({ error: 'usuarioId es requerido' });
      if (!file) return res.status(400).json({ error: 'No se envió archivo "media"' });

      // Validaciones simples
      const esVideo = file.mimetype.startsWith('video/');
      const esImagen = file.mimetype.startsWith('image/');
      if (!esImagen && !(esVideo && file.mimetype === 'video/mp4')) {
        return res.status(400).json({ error: 'Formato no permitido. Solo imagen/* o video/mp4' });
      }
      // Peso máximo 50 MB
      if (file.size > 50 * 1024 * 1024) {
        return res.status(400).json({ error: 'Archivo demasiado grande (máx 50MB)' });
      }

      // 📤 Subir a Cloudinary con upload_stream (igual que en /usuarios)
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

      // (Opcional) limitar duración del video (p. ej. máx 20s)
      if (esVideo && result.duration && result.duration > 20) {
        try {
          await cloudinary.uploader.destroy(result.public_id, { resource_type: 'video' });
        } catch (_) {}
        return res.status(400).json({ error: 'Video demasiado largo (máx 20s)' });
      }

      // 💾 Crear registro en DB
      const nueva = await Historia.create({
        usuarioId: Number(usuarioId),
        mediaUrl: result.secure_url,
        cloudinaryId: result.public_id,
        tipo: esVideo ? 'video' : 'imagen',
        duracionSegundos: esVideo && result.duration ? Math.round(result.duration) : null,
      });

      // 👤 Datos del usuario para el front
      const usr = await Usuario.findByPk(usuarioId, {
        attributes: ['id', 'nombre', 'fotoPerfil'],
      });

      // Miniatura si es video (sin tocar DB)
      const thumbUrl = esVideo ? buildThumbUrl(nueva.cloudinaryId) : nueva.mediaUrl;

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
        vistos: 0,
        vistoPorMi: true, // el que la sube la ve automáticamente
        thumbUrl,         // 👈 NUEVO
      };

      // 🔊 Emitir por socket (si configuraste app.set('io', io))
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
 * Marca vista única para el usuarioId enviado
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
 * DELETE /api/historias/:id
 * Elimina la historia si pertenece al usuario (por seguridad, se envía usuarioId en el body)
 */
router.delete('/:id', async (req, res) => {
  try {
    const historiaId = Number(req.params.id);
    const usuarioId = Number(req.body?.usuarioId || req.query?.usuarioId);

    if (!historiaId || !usuarioId) {
      return res.status(400).json({ error: 'historiaId y usuarioId son requeridos' });
    }

    // Buscar la historia
    const historia = await Historia.findByPk(historiaId);
    if (!historia) return res.status(404).json({ error: 'Historia no encontrada' });

    // Solo el dueño puede eliminarla
    if (historia.usuarioId !== usuarioId) {
      return res.status(403).json({ error: 'No autorizado para eliminar esta historia' });
    }

    // 🧹 Eliminar archivo de Cloudinary (si existe)
    if (historia.cloudinaryId) {
      try {
        await cloudinary.uploader.destroy(historia.cloudinaryId, {
          resource_type: historia.tipo === 'video' ? 'video' : 'image',
        });
      } catch (err) {
        console.warn('⚠️ No se pudo eliminar de Cloudinary:', err.message);
      }
    }

    // 🗑️ Eliminar de la base de datos
    await historia.destroy();

    // 🧽 Eliminar los registros de vistos (opcional)
    await HistoriaVisto.destroy({ where: { historiaId } });

    // 🔊 Emitir evento por socket (si querés)
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
