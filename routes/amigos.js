const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Amistad,Usuario } = require('../models/model');


// para saber ubicacion 10 min 


router.post('/ubicacion', async (req, res) => {
  const { usuarioId, latitud, longitud, precision } = req.body;

  if (!usuarioId || !latitud || !longitud) {
    return res.status(400).json({ error: 'Faltan datos: usuarioId, latitud o longitud' });
  }

  try {
    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    await usuario.update({
      latitud,
      longitud,
      precision,
      ultimaUbicacion: new Date()
    });

    return res.json({ mensaje: '📍 Ubicación actualizada correctamente' });
  } catch (error) {
    console.error('❌ Error actualizando ubicación:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
});


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
// GET /api/amigos/sonAmigos/:id1/:id2
router.get('/sonAmigos/:id1/:id2', async (req, res) => {
  const { id1, id2 } = req.params;

  try {
    const sonAmigos = await Amistad.findOne({
      where: {
        [Op.or]: [
          { usuarioId: id1, amigoId: id2 },
          { usuarioId: id2, amigoId: id1 },
        ],
        estado: 'aceptado',
      },
    });

    res.json({ sonAmigos: !!sonAmigos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al verificar amistad' });
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
// ✅ Aceptar solicitud y crear relación inversa
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

    // 👉 Verificamos si ya existe la relación inversa
    const inversa = await Amistad.findOne({
      where: {
        usuarioId: amigoId,
        amigoId: usuarioId
      }
    });

    // Si no existe, la creamos
    if (!inversa) {
      await Amistad.create({
        usuarioId: amigoId,
        amigoId: usuarioId,
        estado: 'aceptado'
      });
    }

    res.json({ mensaje: '✅ Amistad aceptada correctamente' });

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
