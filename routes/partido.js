const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const admin = require('firebase-admin');

// en el endpoint (./) puse  latitud y lkongitud harckodeado;
// en   isPremium (./isPremium)  lo mismo

const {
  UsuarioPartido,
  Suscripcion,
  Usuario,
  UsuarioDeporte,
  Partido,
  Deporte
} = require('../models/model');

const Mensaje = require('../models/Mensaje'); // Asegurate de tener este modelo

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

// 📤 Función para enviar notificaciones FCM
async function enviarNotificacionesFCM(tokens, payload) {
  try {
    for (const token of tokens) {
      const message = {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        android: {
          notification: { channelId: 'default', sound: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default' } },
        },
        data: {
          url: payload.url || '/invitaciones',
        }
      };

      const response = await admin.messaging().send(message);
      console.log(`✅ Notificación enviada a ${token}`, response);
    }
  } catch (err) {
    console.error('❌ Error enviando notificaciones FCM:', err);
  }
}

// 🔁 Envío escalonado
const MAX_POR_TANDA = 6;
const ESPERA_MS = 2 * 60 * 1000;

async function enviarEscalonado(partido, deporteNombre, organizadorId) {
  let enviados = new Set();
  const { latitud, longitud } = partido;
  const distanciaKm = 13;

  const candidatosCercanos = await UsuarioDeporte.sequelize.query(
    `
    SELECT ud.usuarioId
    FROM UsuarioDeportes ud
    JOIN Usuarios u ON ud.usuarioId = u.id
    WHERE ud.deporteId = :deporteId
      AND ud.usuarioId != :organizadorId
      AND u.latitud IS NOT NULL AND u.longitud IS NOT NULL
      AND (
        6371 * acos(
          cos(radians(:lat)) * cos(radians(u.latitud)) *
          cos(radians(u.longitud) - radians(:lon)) +
          sin(radians(:lat)) * sin(radians(u.latitud))
        )
      ) < :distanciaKm
    `,
    {
      replacements: {
        deporteId: partido.deporteId,
        lat: latitud,
        lon: longitud,
        organizadorId,
        distanciaKm
      },
      type: UsuarioDeporte.sequelize.QueryTypes.SELECT
    }
  );

  let candidatos = candidatosCercanos.map(row => row.usuarioId).filter(id => id !== organizadorId);

  async function enviarTanda() {
    const aceptados = await UsuarioPartido.count({
      where: { PartidoId: partido.id, estado: 'aceptado' }
    });

    const faltan = partido.cantidadJugadores - aceptados;
    if (faltan <= 0 || candidatos.length === 0) return;

    const siguiente = candidatos.filter(id => !enviados.has(id)).slice(0, MAX_POR_TANDA);
    if (siguiente.length === 0) return;

    const relaciones = siguiente.map(usuarioId => ({
      UsuarioId: usuarioId,
      PartidoId: partido.id,
      estado: 'pendiente'
    }));
    await UsuarioPartido.bulkCreate(relaciones);

    const suscripciones = await Suscripcion.findAll({
      where: { usuarioId: { [Op.in]: siguiente } }
    });

    const fcmTokens = suscripciones.map(s => s.fcmToken).filter(Boolean);

    const payload = {
      title: '🎯 ¡Nuevo partido disponible!',
      body: `Partido de ${deporteNombre} en ${partido.lugar} el ${partido.fecha} a las ${partido.hora}`,
      url: '/invitaciones'
    };

    if (fcmTokens.length > 0) {
      await enviarNotificacionesFCM(fcmTokens, payload);
    }
/*
    for (const usuarioId of siguiente) {
      const contenido = `Fuiste invitado al partido de ${partido.fecha} a las ${partido.hora} en ${partido.lugar} acordate de aceptar la invitacion para confirmar la asistencia y`;
      await Mensaje.create({
        emisorId: organizadorId,
        receptorId: usuarioId,
        contenido,
        leido: false,
        fecha: new Date()
      });

      if (global.io) {
        global.io.to(`usuario-${usuarioId}`).emit('mensaje:nuevo', {
          contenido,
          emisorId: organizadorId,
          receptorId: usuarioId,
          partidoId: partido.id,
          tipo: 'invitacion'
        });
      }
    }
*/
    siguiente.forEach(id => enviados.add(id));

    if (faltan - siguiente.length > 0 && enviados.size < candidatos.length) {
      setTimeout(enviarTanda, ESPERA_MS);
    }
  }

  enviarTanda(); // Ejecutamos la tanda
}

// 🚫 Rechazar jugador
router.post('/rechazar-jugador', async (req, res) => {
  const { usuarioId, partidoId } = req.body;

  try {
    await UsuarioPartido.update(
      { estado: 'rechazado' },
      { where: { UsuarioId: usuarioId, PartidoId: partidoId } }
    );
    res.json({ mensaje: 'Jugador rechazado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al rechazar jugador' });
  }
});

// ✅ Confirmar jugador
router.post('/confirmar-jugador', async (req, res) => {
  const { usuarioId, partidoId, organizadorId } = req.body;

  try {
    const partido = await Partido.findByPk(partidoId);
    if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });

    if (partido.organizadorId != organizadorId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await UsuarioPartido.update(
      { estado: 'confirmado' },
      { where: { UsuarioId: usuarioId, PartidoId: partidoId } }
    );

    const contenido = `Fuiste aceptado para el partido de ${partido.fecha} a las ${partido.hora} en ${partido.lugar}`;
    await Mensaje.create({
      emisorId: organizadorId,
      receptorId: usuarioId,
      contenido,
      leido: false,
      fecha: new Date()
    });

    const suscripcion = await Suscripcion.findOne({ where: { usuarioId } });
    const token = suscripcion?.fcmToken;

    if (token) {
      const mensaje = {
        token,
        notification: {
          title: '✅ Has sido aceptado',
          body: contenido
        },
        data: {
          url: '/mensajes'
        },
        android: { notification: { sound: 'default' } },
        apns: { payload: { aps: { sound: 'default' } } }
      };

      await admin.messaging().send(mensaje);
    }

    res.json({ mensaje: 'Jugador confirmado, mensaje enviado y FCM enviada' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al confirmar jugador' });
  }
});

// 🚀 Crear partido NO PREMIUM
router.post('/', async (req, res) => {
  const {
    deporteId,
    cantidadJugadores,
    lugar,
    fecha,
    hora,
    organizadorId,
    localidad,
    nombre
    
  } = req.body;
 
  const latitud=-33.2857344;
  const longitud=-66.3552000;

  if (!deporteId || !cantidadJugadores || !lugar || !fecha || !hora || !organizadorId || !nombre) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para crear el partido.' });
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
    enviarEscalonado(partido, deporte?.nombre || 'deporte', organizadorId);

    res.status(201).json({
      mensaje: '✅ Partido creado correctamente (No Premium)',
      partido
    });

  } catch (error) {
    console.error('❌ Error creando partido no premium:', error);
    res.status(500).json({ error: 'Error al crear el partido o enviar notificaciones.' });
  }
});

// 👑 Crear partido PREMIUM
router.post('/ispremium', async (req, res) => {
  const {
    deporteId,
    cantidadJugadores,
    lugar,
    fecha,
    hora,
    organizadorId,
    localidad,
    nombre
   
  } = req.body;

   
  const latitud=-33.2857344;
  const longitud=-66.3552000;

  if (!deporteId || !cantidadJugadores || !lugar || !fecha || !hora || !organizadorId || !nombre) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para crear el partido.' });
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

    res.status(201).json({ mensaje: 'Partido creado para premium.', partido });

  } catch (error) {
    console.error('❌ Error al crear partido premium:', error);
    res.status(500).json({ error: 'Error interno al crear el partido premium.' });
  }
});



router.post('/reenviar-invitacion', async (req, res) => {
  const { partidoId } = req.body;
  console.log("helllloooooooooooooooooooooo")

  try {
    const partido = await Partido.findByPk(partidoId, {
      include: [{ model: Deporte }, { model: Usuario, as: 'organizador' }]
    });
    if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });

    const interesados = await UsuarioDeporte.findAll({
      where: {
        deporteId: partido.deporteId,
        usuarioId: { [Op.ne]: partido.organizadorId },
      },
      limit: 10
    });

    const usuariosFiltrados = await Promise.all(interesados.map(async (ud) => {
      const usuario = await Usuario.findByPk(ud.usuarioId);
      if (!usuario || usuario.localidad !== partido.localidad) return null;

      const yaInvitado = await UsuarioPartido.findOne({ where: { usuarioId: usuario.id, partidoId } });
      if (yaInvitado) return null;

      const suscripcion = await Suscripcion.findOne({ where: { usuarioId: usuario.id } });
      if (!suscripcion) return null;

      return { usuario, token: suscripcion.fcmToken };
    }));

    const candidatos = usuariosFiltrados.filter(Boolean).slice(0, 3);

    for (const candidato of candidatos) {
      await UsuarioPartido.create({ usuarioId: candidato.usuario.id, partidoId, estado: 'pendiente' });
      await enviarNotificacionFCM(candidato.token, {
        title: '🏟️ Nueva invitación',
        body: `Te invitaron a un partido de ${partido.deporte.nombre} en ${partido.lugar}. ¡Aceptá antes que otro!`,
      });
    }

    res.json({ mensaje: 'Se enviaron invitaciones a 3 jugadores' });

    // 💡 Opción avanzada: repetir este proceso cada 5 minutos si nadie acepta (usando setTimeout, cola o cron job)
  } catch (err) {
    console.error('❌ Error al reenviar invitación:', err);
    res.status(500).json({ error: 'Error al reenviar invitación' });
  }
});


module.exports = router;
