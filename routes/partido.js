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

const MAX_POR_TANDA = 6;
const ESPERA_MS = 2 * 60 * 1000;

async function enviarEscalonado(partido, deporteNombre, organizadorId) {
  const { latitud, longitud } = partido;
  const distanciaKm = 13;

  try {
    // 🔍 Buscar candidatos cercanos
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

    // 🧠 Extraer IDs únicos
    let candidatos = candidatosCercanos.map(row => row.usuarioId);

    console.log('👀 Candidatos cercanos encontrados:', candidatos);

    // 🔐 Buscar a quién ya se le envió invitación
    const yaContactados = await UsuarioPartido.findAll({
      where: {
        PartidoId: partido.id
      }
    });

    const yaContactadosIds = yaContactados.map(r => r.UsuarioId);

    // ❌ Filtrar para evitar repetir invitaciones
    candidatos = candidatos.filter(id => !yaContactadosIds.includes(id));

    console.log('📤 Candidatos válidos después del filtro:', candidatos);

    // 🧪 Variables internas de control (aisladas por ejecución)
    let enviados = new Set();
    let intentos = 0;

    async function enviarTanda() {
      // ¿Cuántos ya aceptaron?
      const aceptados = await UsuarioPartido.count({
        where: { PartidoId: partido.id, estado: 'aceptado' }
      });

      const faltan = partido.cantidadJugadores - aceptados;
      if (faltan <= 0 || candidatos.length === 0) return false;

      // Seleccionamos la próxima tanda de usuarios a invitar
      const siguiente = candidatos
        .filter(id => !enviados.has(id))
        .slice(0, MAX_POR_TANDA);

      if (siguiente.length === 0) return false;

      // 📝 Guardar relaciones en UsuarioPartido
      const relaciones = siguiente.map(usuarioId => ({
        UsuarioId: usuarioId,
        PartidoId: partido.id,
        estado: 'pendiente'
      }));

      await UsuarioPartido.bulkCreate(relaciones);

      // 🔑 Obtener tokens FCM
      const suscripciones = await Suscripcion.findAll({
        where: { usuarioId: { [Op.in]: siguiente } }
      });

      const fcmTokens = suscripciones.map(s => s.fcmToken).filter(Boolean);

      // 📤 Armar payload de notificación
      const payload = {
        title: '🎯 ¡Nuevo partido disponible!',
        body: `Partido de ${deporteNombre} en ${partido.lugar} el ${partido.fecha} a las ${partido.hora}`,
        url: '/invitaciones'
      };

      if (fcmTokens.length > 0) {
        await enviarNotificacionesFCM(fcmTokens, payload);
      }

      siguiente.forEach(id => enviados.add(id));
      return true;
    }

    // 🔁 Envío escalonado hasta llenar cupos o quedarse sin candidatos
    while (true) {
      const huboEnvio = await enviarTanda();
      intentos++;

      if (!huboEnvio || enviados.size >= candidatos.length || intentos >= 10) break;

      console.log(`⏳ Esperando ${ESPERA_MS / 1000} segundos para siguiente tanda...`);
      await new Promise(resolve => setTimeout(resolve, ESPERA_MS));
    }

    console.log(`✅ Proceso escalonado terminado. Total invitados: ${enviados.size}`);
    
  } catch (error) {
    console.error('❌ Error en enviarEscalonado:', error);
  }
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
    nombre,
    latitud,
    longitud
    
  } = req.body;
 


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
 try {
  await enviarEscalonado(partido, deporte?.nombre || 'deporte', organizadorId);
  console.log('📩 Envío escalonado ejecutado correctamente');
} catch (err) {
  console.error('❌ Error durante el envío escalonado:', err);
}


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
    nombre,
    latitud,
    longitud
   
  } = req.body;

   
 

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

  try {
    const partido = await Partido.findByPk(partidoId, {
      include: [{ model: Deporte }, { model: Usuario, as: 'organizador' }]
    });
    
    if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });
    
    
    const organizadorId=partido.organizador.id

    const distanciaMaxKm = 15;

    const candidatosCercanos = await UsuarioDeporte.sequelize.query(
      `
      SELECT ud.usuarioId
      FROM UsuarioDeportes ud
      JOIN Usuarios u ON ud.usuarioId = u.id
      WHERE ud.deporteId = :deporteId
        AND ud.usuarioId != :organizadorId
        AND ud.usuarioId NOT IN (
          SELECT UsuarioId FROM UsuarioPartidos WHERE PartidoId = :partidoId
        )
        AND u.latitud IS NOT NULL AND u.longitud IS NOT NULL
        AND (
          6371 * acos(
            cos(radians(:lat)) * cos(radians(u.latitud)) *
            cos(radians(u.longitud) - radians(:lon)) +
            sin(radians(:lat)) * sin(radians(u.latitud))
          )
        ) < :distancia
      `,
      {
        replacements: {
          deporteId: partido.deporteId,
          organizadorId: partido.organizadorId,
          partidoId: partido.id,
          lat: partido.latitud,
          lon: partido.longitud,
          distancia: distanciaMaxKm
        },
        type: UsuarioDeporte.sequelize.QueryTypes.SELECT
      }
    );

    const candidatos = candidatosCercanos.map(row => row.usuarioId);

    // Filtramos bien los usuarios válidos
    const usuariosFiltrados = await Promise.all(
      candidatos.map(async (usuarioId) => {
        // ✅ Reforzamos que no sea el organizador
        if (usuarioId === partido.organizadorId) return null;

        const suscripcion = await Suscripcion.findOne({ where: { usuarioId } });
        if (!suscripcion) return null;

        const usuario = await Usuario.findByPk(usuarioId);
        return usuario ? { usuario, token: suscripcion.fcmToken } : null;
      })
    );

    const seleccionados = usuariosFiltrados.filter(Boolean).slice(0, 3);

   

    for (const candidato of seleccionados) {
      if (!candidato?.usuario?.id) continue;

      await UsuarioPartido.create({
        UsuarioId: candidato.usuario.id,
        PartidoId: partidoId,
        estado: 'pendiente'
      });

      await enviarNotificacionesFCM(candidato.token, {
        title: '🏟️ Nueva invitación',
        body: `Te invitaron a un partido de ${partido.Deporte.nombre} en ${partido.lugar}. ¡Aceptá antes que otro!`,
        url: '/invitaciones'
      });
    }

    res.json({ mensaje: `Se enviaron ${seleccionados.length} invitaciones basadas en distancia` });

  } catch (err) {
    console.error('❌ Error al reenviar invitación:', err);
    res.status(500).json({ error: 'Error al reenviar invitación' });
  }
});

// routes/partidos.js (o el archivo donde definas las rutas de partidos)
router.put('/partidos/:partidoId/actualizar-cantidad', async (req, res) => {
  const { partidoId } = req.params;
  const { cantidadJugadores } = req.body;

  try {
    const partido = await Partido.findByPk(partidoId);
    if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });

    partido.cantidadJugadores = cantidadJugadores;
    await partido.save();

    res.json({ mensaje: 'Cantidad de jugadores actualizada correctamente' });
  } catch (error) {
    console.error('❌ Error al actualizar la cantidad:', error);
    res.status(500).json({ error: 'Error del servidor al actualizar la cantidad' });
  }
});



module.exports = router;
