// 📁 routes/suscripcion.js (versión final con firebase-admin)
const express = require('express');
const router = express.Router();
const Suscripcion = require('../models/Suscripcion');
const { UsuarioDeporte, UsuarioPartido, Partido } = require('../models');
const { Op } = require('sequelize');
const admin = require('../firebase'); // Inicialización con tu firebase-admin-sdk.json

// ✅ Guardar o actualizar FCM token
router.post('/', async (req, res) => {
  const { fcmToken, usuarioId } = req.body;
 console.log("fcmToken")
 console.log(fcmToken)

  if (!fcmToken || !usuarioId) {
    return res.status(400).json({ error: 'Faltan datos: fcmToken o usuarioId' });
  }

  try {
    let suscripcion = await Suscripcion.findOne({ where: { usuarioId } });

    if (suscripcion) {
      suscripcion.fcmToken = fcmToken;
      await suscripcion.save();
      return res.status(200).json({ mensaje: 'FCM token actualizado' });
    }

    await Suscripcion.create({ usuarioId, fcmToken });
    res.status(201).json({ mensaje: 'FCM token guardado' });
  } catch (error) {
    console.error('❌ Error al guardar token FCM:', error);
    res.status(500).json({ error: 'No se pudo guardar el token' });
  }
});

// ✅ Consultar si un usuario está suscripto
router.get('/usuario/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const suscripcion = await Suscripcion.findOne({ where: { usuarioId } });
    res.json({ suscrito: !!suscripcion });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar la suscripción' });
  }
});

// ❌ Eliminar token FCM
router.delete('/usuario/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    await Suscripcion.destroy({ where: { usuarioId } });
    res.json({ mensaje: 'Suscripción eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo eliminar la suscripción' });
  }
});

// ⚽ Crear partido y notificar usuarios por FCM
router.post('/partido', async (req, res) => {
  const { deporteId, cantidadJugadores, lugar, fecha, hora, organizadorId } = req.body;

  try {
    const partido = await Partido.create({ deporteId, cantidadJugadores, lugar, fecha, hora, organizadorId });

    const inscritos = await UsuarioDeporte.findAll({
      where: { deporteId },
      attributes: ['usuarioId']
    });

    const usuarioIds = inscritos.map(i => i.usuarioId).filter(id => id !== organizadorId);

    if (usuarioIds.length === 0) {
      return res.json({ mensaje: 'Partido creado, pero no hay usuarios suscriptos al deporte', partido });
    }

    const suscripciones = await Suscripcion.findAll({
      where: { usuarioId: { [Op.in]: usuarioIds } }
    });

    for (const sub of suscripciones) {
      try {
        await admin.messaging().send({
          token: sub.fcmToken,
          notification: {
            title: '🎉 ¡Nuevo partido disponible!',
            body: `Se creó un partido en ${lugar} para ${cantidadJugadores} jugadores. ¿Te sumás?`,
          },
          webpush: {
            fcmOptions: {
              link: 'https://tu-app.com/mis-juegos'
            }
          }
        });
      } catch (error) {
        console.error('❌ Error enviando FCM:', error.message);
      }
    }

    const notificaciones = usuarioIds.map(usuarioId => ({
      UsuarioId: usuarioId,
      PartidoId: partido.id,
      estado: 'pendiente'
    }));

    await UsuarioPartido.bulkCreate(notificaciones);

    res.json({ mensaje: 'Partido creado y notificaciones enviadas', partido });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


/*
const express = require('express');
const router = express.Router();
const Suscripcion = require('../models/Suscripcion');

// 📦 Crear o actualizar FCM Token
router.post('/', async (req, res) => {
  const { fcmToken, usuarioId } = req.body;
  console.log("loco");

  if (!fcmToken || !usuarioId) {
    return res.status(400).json({ error: 'Faltan datos: fcmToken o usuarioId' });
  }

  try {
    let suscripcion = await Suscripcion.findOne({ where: { usuarioId } });

    if (suscripcion) {
      suscripcion.fcmToken = fcmToken;
      await suscripcion.save();
      return res.status(200).json({ mensaje: 'FCM token actualizado' });
    }

    await Suscripcion.create({
      usuarioId,
      fcmToken,
    });

    res.status(201).json({ mensaje: 'FCM token guardado' });
  } catch (error) {
    console.error('❌ Error al guardar token FCM:', error);
    res.status(500).json({ error: 'No se pudo guardar el token' });
  }
});

// ✅ Consultar si un usuario ya tiene FCM token
router.get('/usuario/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const suscripcion = await Suscripcion.findOne({ where: { usuarioId } });
    res.json({ suscripto: !!suscripcion });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar la suscripción' });
  }
});

// ❌ Eliminar token FCM de un usuario
router.delete('/usuario/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    await Suscripcion.destroy({ where: { usuarioId } });
    res.json({ mensaje: 'Suscripción eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo eliminar la suscripción' });
  }
});

module.exports = router;


// ⚽ Crear partido + notificar a usuarios suscriptos
router.post('/partido', async (req, res) => {
  
  const { deporteId, cantidadJugadores, lugar, fecha, hora, organizadorId } = req.body;

  try {
    const partido = await Partido.create({ deporteId, cantidadJugadores, lugar, fecha, hora, organizadorId });

    const inscritos = await UsuarioDeporte.findAll({
      where: { deporteId },
      attributes: ['usuarioId'],
    });

    const usuarioIds = inscritos
      .map(i => i.usuarioId)
      .filter(id => id !== organizadorId);

    if (usuarioIds.length === 0) {
      return res.json({ mensaje: 'Partido creado, pero no hay usuarios suscriptos al deporte', partido });
    }

    const suscripciones = await Suscripcion.findAll({
  where: { usuarioId: { [Op.in]: usuarioIds } }
});


    const payload = {
      title: '🎉 ¡Nuevo partido disponible!',
      body: `Se creó un partido en ${lugar} para ${cantidadJugadores} jugadores. ¿Te sumás?`,
      url: 'http://tu-app.com/mis-juegos'
    };

    suscripciones.forEach(sub => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      webpush.sendNotification(pushConfig, JSON.stringify(payload))
        .catch(err => console.error('Error enviando notificación:', err));
    });

    const notificaciones = usuarioIds.map(usuarioId => ({
      UsuarioId: usuarioId,
      PartidoId: partido.id,
      estado: 'pendiente',
    }));

    await UsuarioPartido.bulkCreate(notificaciones);

    res.json({ mensaje: 'Partido creado y notificaciones enviadas', partido });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

*/