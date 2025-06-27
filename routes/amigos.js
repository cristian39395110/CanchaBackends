const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Amistad,Usuario } = require('../models/model');

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
      }
    });

    // Obtener los IDs de amigos (excluyendo el propio ID)
    const amigoIds = amistades.map(a =>
      a.usuarioId === parseInt(usuarioId) ? a.amigoId : a.usuarioId
    );

    const amigos = await Usuario.findAll({
      where: { id: amigoIds },
      attributes: ['id', 'nombre', 'localidad', 'fotoPerfil']
    });

    res.json(amigos);
  } catch (err) {
    console.error('❌ Error al obtener amigos:', err);
    res.status(500).json({ error: 'Error interno al obtener amigos' });
  }
});

// POST /api/amigos/solicitud
router.post('/solicitud', async (req, res) => {
  const { emisorId, receptorId } = req.body;

  try {
    if (parseInt(emisorId) === parseInt(receptorId)) {
      return res.status(400).json({ error: 'No podés enviarte una solicitud a vos mismo' });
    }

    // Verificar si ya existe una relación de amistad (en cualquier dirección)
    const amistadExistente = await Amistad.findOne({
      where: {
        [Op.or]: [
          { usuarioId: emisorId, amigoId: receptorId },
          { usuarioId: receptorId, amigoId: emisorId }
        ],
        estado: { [Op.in]: ['pendiente', 'aceptado'] }
      }
    });

    if (amistadExistente) {
      if (amistadExistente.estado === 'aceptado') {
        return res.status(400).json({ error: 'Ya son amigos' });
      } else {
        return res.status(400).json({ error: 'Ya enviaste una solicitud pendiente' });
      }
    }

    // Crear nueva solicitud
    await Amistad.create({
      usuarioId: emisorId,
      amigoId: receptorId,
      estado: 'pendiente'
    });

    res.json({ mensaje: '✅ Solicitud enviada correctamente' });

  } catch (error) {
    console.error('❌ Error al procesar solicitud:', error);
    res.status(500).json({ error: 'Error del servidor al enviar la solicitud' });
  }
});


  router.get('/solicitudes/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const solicitudes = await Amistad.findAll({
      where: {
        amigoId: usuarioId,
        estado: 'pendiente'
      },
      include: [{ model: Usuario, as: 'emisor', attributes: ['id', 'nombre', 'fotoPerfil'] }]
    });

const formateado = solicitudes.map(s => ({
  usuarioId: s.usuarioId, // 👈
  amigoId: s.amigoId,     // 👈
  emisorNombre: s.emisor?.nombre || 'Desconocido',
  fotoPerfil: s.emisor?.fotoPerfil || null
}));





    res.json(formateado);
  } catch (error) {
    console.error('❌ Error al obtener solicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});


// ✅ Aceptar solicitud
// ✅ Aceptar solicitud
router.post('/aceptar', async (req, res) => {
  const { usuarioId, amigoId } = req.body;

  try {
    const solicitud = await Amistad.findOne({
      where: {
        usuarioId,
        amigoId,
        estado: 'pendiente'
      }
    });

    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });

    solicitud.estado = 'aceptado';
    await solicitud.save();

    res.json({ mensaje: '✅ Amistad aceptada' });
  } catch (error) {
    console.error('❌ Error al aceptar solicitud:', error);
    res.status(500).json({ error: 'Error al aceptar solicitud' });
  }
});

// ❌ Cancelar solicitud
router.post('/cancelar', async (req, res) => {
  const { usuarioId, amigoId } = req.body;

  try {
    const solicitud = await Amistad.findOne({
      where: {
        usuarioId,
        amigoId,
        estado: 'pendiente'
      }
    });

    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });

    await solicitud.destroy();

    res.json({ mensaje: '❌ Solicitud cancelada' });
  } catch (error) {
    console.error('❌ Error al cancelar solicitud:', error);
    res.status(500).json({ error: 'Error al cancelar solicitud' });
  }
});

module.exports = router;
