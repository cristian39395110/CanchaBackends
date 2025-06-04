// ✅ Nuevo enfoque con FCM para notificaciones push en lugar de Web Push API

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const admin = require('firebase-admin');

const { UsuarioPartido, Suscripcion, Usuario, UsuarioDeporte, Partido, Deporte } = require('../models/model');

// Inicializa Firebase Admin SDK solo una vez
try {
  const serviceAccount = require('../firebase-admin-sdk.json');

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (error) {
  console.error('❌ No se pudo inicializar Firebase Admin SDK:', error);
}

async function enviarNotificacionesFCM(tokens, payload) {
  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      url: payload.url || '/invitaciones',
    },
    tokens,
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    console.log(`✅ Notificaciones enviadas: ${response.successCount} exitosas, ${response.failureCount} fallidas`);
  } catch (err) {
    console.error('❌ Error enviando notificaciones FCM:', err);
  }
}

router.post('/', async (req, res) => {
  const {
    deporteId,
    cantidadJugadores,
    lugar,
    fecha,
    hora,
    organizadorId,
    localidad,
    nombre,
    latitud,
    longitud
  } = req.body;

  if (!deporteId || !cantidadJugadores || !lugar || !fecha || !hora || !organizadorId) {
    return res.status(400).json({ error: 'Faltan datos para crear el partido' });
  }

  try {
    const partido = await Partido.create({
      deporteId,
      cantidadJugadores,
      lugar,
      fecha,
      hora,
      nombre,
      organizadorId,
      localidad: localidad || '',
      latitud: latitud || null,
      longitud: longitud || null
    });

    const deporte = await Deporte.findByPk(deporteId);

    const inscritos = await UsuarioDeporte.findAll({
      where: { deporteId, localidad },
      include: [{ model: Usuario, attributes: ['id'] }],
    });

    const notificaciones = [];
    const usuariosIds = [];

    for (const inscripto of inscritos) {
      const usuarioId = inscripto.Usuario.id;
      if (usuarioId !== organizadorId) {
        notificaciones.push({ UsuarioId: usuarioId, PartidoId: partido.id, estado: 'pendiente' });
        usuariosIds.push(usuarioId);
      }
    }

    await UsuarioPartido.bulkCreate(notificaciones);

    const suscripciones = await Suscripcion.findAll({
      where: { usuarioId: { [Op.in]: usuariosIds } },
    });

    const fcmTokens = suscripciones.map(sub => sub.fcmToken).filter(Boolean);

    const payload = {
      title: 'Nuevo partido disponible',
      body: `Se ha creado un partido de ${deporte?.nombre || 'este deporte'} en ${partido.lugar} el ${partido.fecha} a las ${partido.hora}. ¿Querés unirte?`,
      url: '/invitaciones'
    };

    if (fcmTokens.length > 0) {
      await enviarNotificacionesFCM(fcmTokens, payload);
    }

    res.json({ mensaje: 'Partido creado y notificaciones FCM enviadas', partido });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
