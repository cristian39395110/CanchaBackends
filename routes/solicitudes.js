// routes/solicitudes.js

const express = require('express');
const router = express.Router();
const { Partido, Usuario, Deporte, UsuarioPartido, UsuarioDeporte ,Mensaje,Suscripcion,MensajePartido} = require('../models/model');
const admin = require('firebase-admin');

const { Sequelize, Op } = require('sequelize');

// ✅ Inicializar Firebase Admin solo una vez
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('✅ Firebase Admin inicializado desde variable de entorno');
  } catch (error) {
    console.error('❌ Error al inicializar Firebase Admin desde variable:', error);
  }
}
// 📤 Función auxiliar para enviar notificaciones a varios tokens
async function enviarNotificacionesFCM(tokens, title, body, data = {}) {
  const results = [];

  console.log("📨 Enviando notificaciones a tokens:", tokens);

  if (!tokens.length) {
    console.log("❌ No hay tokens disponibles.");
    return { successCount: 0, failureCount: 0 };
  }

  for (const token of tokens) {
    try {
      const message = {
        token,
        notification: { title, body },
        android: { notification: { channelId: 'default', sound: 'default' }},
        apns: { payload: { aps: { sound: 'default' } } },
        data: {
          tipo: data.tipo || '',
          partidoId: data.partidoId || '',
          url: data.url || '/invitaciones'
        }
      };

      console.log("📤 Enviando mensaje FCM:", message);

      const response = await admin.messaging().send(message);
      results.push({ token, success: true, response });

    } catch (err) {
      console.error("❌ Error enviando FCM:", err);
      results.push({ token, success: false, error: err.message });
    }
  }

  return {
    successCount: results.filter(r => r.success).length,
    failureCount: results.filter(r => !r.success).length,
    details: results,
  };
}







// Función para calcular distancia entre dos puntos en km (Fórmula Haversine)
function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
//routes solicitudes.js
router.get('/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;
  const { estado } = req.query;

  try {
    // Traemos la ubicación del usuario (lat/lng)
    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario || !usuario.latitud || !usuario.longitud) {
      return res.status(400).json({ error: 'Usuario sin ubicación registrada' });
    }

    // Deportes del usuario (para filtrar por intereses)
    const usuarioDeportes = await UsuarioDeporte.findAll({
      where: { usuarioId },
      attributes: ['deporteId'],
    });

    const deportesIds = usuarioDeportes.map(d => d.deporteId);

    // Traemos todos los partidos a los que fue invitado ese usuario
    const usuarioPartidos = await UsuarioPartido.findAll({
      where: {
        UsuarioId: usuarioId,
        ...(estado ? { estado } : {}),
      },
      include: [
        {
          model: Partido,
          include: [
            { model: Deporte, attributes: ['id', 'nombre'] },
            { model: Usuario, as: 'organizador', attributes: ['id', 'nombre'] },
          ]
        }
      ],
      order: [['Partido', 'fecha', 'ASC']]
    });

    const resultado = usuarioPartidos
  .filter(up => {
    const partido = up.Partido;
    const mismoDeporte = deportesIds.includes(partido.deporteId);
    const distancia = calcularDistanciaKm(
      Number(usuario.latitud),
      Number(usuario.longitud),
      Number(partido.latitud),
      Number(partido.longitud)
    );
    return mismoDeporte && distancia <= 15;
  })
  .map(up => {
    const partido = up.Partido;
    return {
      id: partido.id,
      fecha: partido.fecha,
      hora: partido.hora,
      lugar: partido.lugar,
      nombreCancha: partido.nombre,
      cantidadJugadores: partido.cantidadJugadores,
      deporte: partido.Deporte?.nombre || 'Desconocido',
      organizador: partido.organizador?.nombre || 'Desconocido',
      latitud: partido.latitud,
      longitud: partido.longitud,
      localidad: partido.localidad,
      sexo: partido.sexo || 'todos',
      rangoEdad: partido.rangoEdad || 'sin restricción',
      estado: up.estado,
      precio:partido.precio
    };
  });

    res.json(resultado);
  } catch (error) {
    console.error('❌ Error al obtener solicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});


// POST /api/solicitudes/cancelar
router.post('/cancelar', async (req, res) => {
  const { usuarioId, partidoId } = req.body;

  if (!usuarioId || !partidoId) {
    return res.status(400).json({ error: 'Faltan datos obligatorios.' });
  }

  try {
    const usuarioPartido = await UsuarioPartido.findOne({
      where: { UsuarioId: usuarioId, PartidoId: partidoId, estado: 'confirmado' }
    });

    if (!usuarioPartido) {
      return res.status(404).json({ error: 'No se encontró la participación confirmada para cancelar.' });
    }

    // Eliminar la relación
    await usuarioPartido.destroy();

    // Buscar datos del partido y jugadores
    const partido = await Partido.findByPk(partidoId, {
      include: [
        { model: Usuario, as: 'organizador', attributes: ['id', 'nombre'] },
        { model: Deporte, attributes: ['nombre'] }
      ]
    });

    const jugador = await Usuario.findByPk(usuarioId);
    if (!partido || !jugador) return res.status(404).json({ error: 'Datos del partido o jugador no encontrados.' });

    const mensajeParaOrganizador = `⚠️ ${jugador.nombre} canceló su asistencia al partido de ${partido.Deporte.nombre} en ${partido.lugar} el ${partido.fecha} a las ${partido.hora} hs.`;

    // Guardar el mensaje en la base
    const mensaje = await Mensaje.create({
      emisorId: jugador.id,
      receptorId: partido.organizador.id,
      contenido: mensajeParaOrganizador,
      leido: false
    });

    // Notificación FCM
    const organizadorSuscripcion = await Suscripcion.findOne({ where: { usuarioId: partido.organizador.id } });
    if (organizadorSuscripcion?.fcmToken) {
      await admin.messaging().send({
        token: organizadorSuscripcion.fcmToken,
        notification: {
          title: 'Cancelación de asistencia',
          body: mensajeParaOrganizador
        },
        data: {
          tipo: 'mensaje',
          emisorId: jugador.id.toString(),
          partidoId: partido.id.toString()
        }
      });
    }

    // Emitir vía WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`usuario-${partido.organizador.id}`).emit('mensajeNuevo', mensaje);
      io.to(`usuario-${partido.organizador.id}`).emit('actualizar-contadores');
    }
    if (io) {
  io.to(`noti-${usuarioId}`).emit('actualizar-notificaciones', { receptorId: usuarioId });
}

    res.json({ mensaje: '✅ Asistencia cancelada y notificación enviada.' });
  } catch (error) {
    console.error('❌ Error al cancelar asistencia:', error);
    res.status(500).json({ error: 'Error interno al cancelar asistencia.' });
  }
});



// POST /solicitudes/aceptar/:id
// POST /solicitudes/aceptar


// POST /solicitudes/aceptar
// routes/solicitudes.js
// POST /solicitudes/aceptar  
    router.post('/aceptar', async (req, res) => {
      const { usuarioId, partidoId } = req.body;

      try {
        const partido = await Partido.findByPk(partidoId, {
          include: [
            { model: Usuario, as: 'organizador', attributes: ['id', 'nombre'] },
            { model: Deporte, attributes: ['nombre'] }
          ]
        });

        if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });

        const confirmados = await UsuarioPartido.count({
          where: {
            PartidoId: partidoId,
            estado: 'confirmado'
          }
        });

        if (confirmados >= Number(partido.cantidadJugadores)) {
          return res.status(400).json({ error: '❌ Ya se alcanzó el número máximo de jugadores' });
        }

        const actualizado = await UsuarioPartido.update(
          { estado: 'confirmado' },
          { where: { UsuarioId: usuarioId, PartidoId: partidoId } }
        );

        if (actualizado[0] === 0) {
          return res.status(404).json({ error: 'No se encontró la invitación' });
        }

        const jugador = await Usuario.findByPk(usuarioId);
        if (!jugador) return res.status(404).json({ error: 'Jugador no encontrado' });

        const io = req.app.get('io');

        // 💬 Crear mensaje grupal de sistema
        const mensajeGrupal = await MensajePartido.create({
          partidoId: partido.id,
          usuarioId: jugador.id,
          mensaje: `✅ ${jugador.nombre} se unió al partido.`,
          tipo: 'sistema'
        });

        // ✅ Obtener IDs de jugadores confirmados
        const confirmadosData = await UsuarioPartido.findAll({
          where: {
            PartidoId: partidoId,
            estado: 'confirmado'
          },
          attributes: ['UsuarioId']
        });

        const ids = confirmadosData.map(p => p.UsuarioId);

        // 🔔 Notificación FCM al grupo (excepto al que se unió)
        const suscripciones = await Suscripcion.findAll({
          where: {
            usuarioId: {
              [Op.in]: ids
            }
          }
        });

        for (const sus of suscripciones) {
          if (sus.fcmToken && sus.usuarioId !== jugador.id) {
            await admin.messaging().send({
              token: sus.fcmToken,
              notification: {
                title: '👥 Nuevo jugador confirmado',
                body: `${jugador.nombre} se unió al partido de ${partido.Deporte.nombre} el ${partido.fecha} a las ${partido.hora} hs`
              },
              data: {
                tipo: 'grupo',
                partidoId: partido.id.toString(),
                 url: `/chat/partido/${partido.id}`
              }
            });
          }
        }

        // 🔔 Notificar al organizador (si no es el mismo que se unió)
  if (partido.organizador.id !== jugador.id) {
    const susOrganizador = await Suscripcion.findOne({
      where: { usuarioId: partido.organizador.id }
    });

    if (susOrganizador && susOrganizador.fcmToken) {
      await admin.messaging().send({
        token: susOrganizador.fcmToken,
        notification: {
          title: '📥 Jugador confirmado',
          body: `${jugador.nombre} aceptó la invitación al partido que organizaste el ${partido.fecha} a las ${partido.hora} hs`
        },
      data: {
    tipo: 'organizador',
    partidoId: partido.id.toString(),
       url: `/chat/partido/${partido.id}`
   // 👈 Esto activa la navegación en Android
  }



      });
    }
io.to(`noti-${partido.organizador.id}`).emit('alertaVisual', {
  tipo: 'partido',
  partidoId: partido.id,
  nombre: jugador.nombre,
  mensaje: `${jugador.nombre} aceptó la invitación al partido`
});


  }
  


      // 📡 Emitir mensaje al grupo por WebSocket
      if (io) {
        io.to(`partido-${partido.id}`).emit('nuevo-mensaje-partido', mensajeGrupal);
      }
     
      if (io) {
  io.to(`noti-${usuarioId}`).emit('actualizar-notificaciones', { receptorId: usuarioId });
}
      res.json({ mensaje: '✅ Invitación aceptada y notificada al grupo' });

    } catch (error) {
      console.error('❌ Error al aceptar invitación:', error);
      res.status(500).json({ error: 'Error al aceptar la invitación' });
    }
  });


// POST /solicitudes/rechazar/:id
router.post('/rechazar/:partidoId', async (req, res) => {
  const { usuarioId } = req.body; // viene en el body
  const { partidoId } = req.params; // viene por la URL
console.log('UsuarioId------------------------------:');
console.log('UsuarioId:', usuarioId);
console.log('PartidoId:', partidoId);


  try {
    await UsuarioPartido.update(
      { estado: 'rechazada' },
      { where: { UsuarioId: usuarioId, PartidoId: partidoId } }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`noti-${usuarioId}`).emit('actualizar-notificaciones', { receptorId: usuarioId });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error al rechazar invitación:', error);
    res.status(500).json({ error: 'Error al rechazar invitación' });
  }
});

module.exports = router;