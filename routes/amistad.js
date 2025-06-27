// 📁 routes/publicaciones.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { Publicacion, Usuario, Amistad } = require('../models/model');

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

// ✅ GET publicaciones de un usuario
router.get('/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;
  const solicitanteId = req.query.solicitanteId; // quién está viendo el perfil

  try {
    // Buscar publicaciones del usuario
    let publicaciones = await Publicacion.findAll({
      where: { usuarioId },
      order: [['createdAt', 'DESC']]
    });

    if (solicitanteId !== usuarioId) {
      // Si no es el dueño, filtrar las publicaciones privadas
      publicaciones = await Promise.all(publicaciones.map(async (publi) => {
        if (publi.esPublica) return publi;

        // Si no es pública, verificar si son amigos
        const esAmigo = await Amistad.findOne({
          where: {
            usuarioId,
            amigoId: solicitanteId,
            estado: 'aceptado'
          }
        });

        return esAmigo ? publi : null;
      }));

      publicaciones = publicaciones.filter(p => p); // eliminar nulls
    }

    // Agregar la ruta completa a la imagen si existe
    publicaciones = publicaciones.map(publi => {
      const obj = publi.toJSON();
      if (obj.foto) {
        obj.foto = `${req.protocol}://${req.get('host')}/uploads/publicaciones/${obj.foto}`;
      }
      return obj;
    });

    res.json(publicaciones);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener publicaciones' });
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
      esPublica: true // más adelante podés agregar esta opción como editable
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


// Solicitudes de amistad pendientes RECIBIDAS por el usuario
router.get('/recibidas/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const solicitudes = await Amistad.findAll({
      where: {
        amigoId: usuarioId,
        estado: 'pendiente'
      },
      include: [{
        model: Usuario,
        as: 'Usuario', // quien la envió
        attributes: ['id', 'nombre', 'fotoPerfil', 'localidad']
      }]
    });

    const emisores = solicitudes.map(s => s.Usuario);

    res.json(emisores);
  } catch (error) {
    console.error('❌ Error al obtener solicitudes recibidas:', error.message);
    res.status(500).json({ error: 'Error al obtener solicitudes recibidas' });
  }
});


// ✅ ENDPOINTS DE AMISTAD

// Enviar solicitud de amistad
router.post('/solicitar', async (req, res) => {
  const { usuarioId, amigoId } = req.body;

  try {
    const existente = await Amistad.findOne({ where: { usuarioId, amigoId } });
    if (existente) return res.status(400).json({ error: 'Ya existe una solicitud o amistad' });

    const solicitud = await Amistad.create({ usuarioId, amigoId, estado: 'pendiente' });
    res.status(201).json(solicitud);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar solicitud' });
  }
});

// Aceptar solicitud
router.post('/aceptar', async (req, res) => {
  const { usuarioId, amigoId } = req.body;
  try {
    const solicitud = await Amistad.findOne({ where: { usuarioId: amigoId, amigoId: usuarioId, estado: 'pendiente' } });
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });

    solicitud.estado = 'aceptado';
    await solicitud.save();

    // Crear la amistad inversa
    await Amistad.create({ usuarioId, amigoId, estado: 'aceptado' });

    res.json({ mensaje: 'Amistad aceptada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al aceptar solicitud' });
  }
});

// Ver amigos
router.get('/lista/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const amistades = await Amistad.findAll({
      where: {
        estado: 'aceptado',
        [Op.or]: [
          { usuarioId },
          { amigoId: usuarioId }
        ]
      },
      include: [
        {
          model: Usuario,
          as: 'Usuario',
          attributes: ['id', 'nombre', 'fotoPerfil', 'localidad']
        },
        {
          model: Usuario,
          as: 'Amigo',
          attributes: ['id', 'nombre', 'fotoPerfil', 'localidad']
        }
      ]
    });

    const amigos = amistades.map(a => {
      // Devuelve siempre "el otro usuario"
      if (a.usuarioId.toString() === usuarioId) {
        return a.Amigo;
      } else {
        return a.Usuario;
      }
    });
    

    res.json(amigos);
  } catch (error) {
    console.error('❌ Error al obtener la lista de amigos:', error.message);
    res.status(500).json({ error: 'Error al obtener la lista de amigos' });
  }
});


// 📁 routes/publicaciones.js o routes/amistad.js

// 👉 Solicitudes de amistad pendientes ENVIADAS por el usuario
router.get('/pendientes/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const pendientes = await Amistad.findAll({
      where: {
        usuarioId,
        estado: 'pendiente'
      },
      include: [
        {
          model: Usuario,
          as: 'Amigo',
          attributes: ['id', 'nombre', 'fotoPerfil', 'localidad']
        }
      ]
    });

    // Devolvemos solo el usuario receptor (a quien le mandaron la solicitud)
    const enviados = pendientes.map(p => p.Amigo);

    res.json(enviados);
  } catch (error) {
    console.error('❌ Error al obtener solicitudes pendientes:', error.message);
    res.status(500).json({ error: 'Error al obtener solicitudes pendientes' });
  }
});
router.delete('/:usuarioId/:amigoId', async (req, res) => {
  const { usuarioId, amigoId } = req.params;
  try {
    await Amistad.destroy({
      where: {
        [Op.or]: [
          { usuarioId, amigoId },
          { usuarioId: amigoId, amigoId: usuarioId }
        ]
      }
    });
    res.json({ mensaje: 'Amistad eliminada' });
  } catch (err) {
    console.error('❌ Error al eliminar amistad:', err);
    res.status(500).json({ error: 'Error interno al eliminar amistad' });
  }
});


module.exports = router;
