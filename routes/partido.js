//C:\canchascapacitor2025\Canchas2025Backend\app-partidos\routes\partido.js
// aca cuando ujno pide jugadores y tendria quee enviar las notificacion a los dispoitivos andoird 

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const admin = require('firebase-admin');

const { UsuarioPartido, Suscripcion, Usuario, UsuarioDeporte, Partido, Deporte } = require('../models/model');

// 🔐 Inicializar Firebase Admin SDK una sola vez
try {
  const serviceAccount = require('../firebase-admin-sdk.json');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (error) {
  console.error('❌ Error al inicializar Firebase Admin SDK:', error);
}

// 📤 Función reutilizable para enviar notificaciones FCM
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
    console.log(`✅ Notificaciones FCM: ${response.successCount} enviadas, ${response.failureCount} fallidas`);
  } catch (err) {
    console.error('❌ Error enviando notificaciones:', err);
  }
}

// 🏟️ Crear partido y notificar
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

  if (!deporteId || !cantidadJugadores || !lugar || !fecha || !hora || !organizadorId || !nombre) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para crear el partido.' });
  }

  try {
    // 1. Crear el partido
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

    // 2. Obtener nombre del deporte
    const deporte = await Deporte.findByPk(deporteId);

    // 3. Buscar usuarios que se inscribieron a ese deporte y localidad
    const inscriptos = await UsuarioDeporte.findAll({
      where: { deporteId, localidad },
      include: [{ model: Usuario, attributes: ['id'] }],
    });

    const notificaciones = [];
    const usuariosIds = [];

    for (const inscripto of inscriptos) {
      const usuarioId = inscripto.Usuario.id;
      if (usuarioId !== organizadorId) {
        notificaciones.push({
          UsuarioId: usuarioId,
          PartidoId: partido.id,
          estado: 'pendiente',
        });
        usuariosIds.push(usuarioId);
      }
    }

    // 4. Crear relación UsuarioPartido
    await UsuarioPartido.bulkCreate(notificaciones);

    // 5. Obtener FCM tokens de usuarios suscriptos
    const suscripciones = await Suscripcion.findAll({
      where: { usuarioId: { [Op.in]: usuariosIds } },
    });

    const fcmTokens = suscripciones.map(sub => sub.fcmToken).filter(Boolean);

    // 6. Preparar y enviar la notificación
    const payload = {
      title: '🎯 ¡Nuevo partido disponible!',
      body: `Partido de ${deporte?.nombre || 'deporte'} en ${lugar} el ${fecha} a las ${hora}.`,
      url: '/invitaciones'
    };

    if (fcmTokens.length > 0) {
      await enviarNotificacionesFCM(fcmTokens, payload);
    }

    // 7. Respuesta final
    res.status(201).json({
      mensaje: '✅ Partido creado y notificaciones FCM enviadas',
      partido
    });

  } catch (error) {
    console.error('❌ Error creando partido:', error);
    res.status(500).json({ error: 'Error al crear el partido o enviar notificaciones.' });
  }
});

module.exports = router;
