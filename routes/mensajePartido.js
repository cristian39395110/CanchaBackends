//routes mensaje partido
const express = require('express');
const router = express.Router();
const { MensajePartido, Usuario, Suscripcion,UsuarioPartido} = require('../models/model');
const admin = require('../firebase');



const { Op } = require('sequelize');


// ✅ POST: Enviar mensaje grupal de partido
router.post('/partido/enviar', async (req, res) => {
  const { partidoId, usuarioId, mensaje,frontendId } = req.body;

if (!partidoId || !usuarioId || !mensaje) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

try {
    // Evitar duplicados si llega el mismo frontendId

    if (frontendId) {
      const yaExiste = await MensajePartido.findOne({ where: { frontendId } });
      if (yaExiste) {
        console.log('⚠️ Mensaje duplicado ignorado (frontendId)');
        return res.status(200).json(yaExiste);
      }
    }


    const nuevoMensaje = await MensajePartido.create({
      partidoId,
      usuarioId,
      mensaje,
      tipo: 'texto',
     frontendId: frontendId || null
    });
const io = req.app.get('io');
    // 🔄 Emitir por WebSocket a todos en la sala del partido
   // 🔄 Emitir por WebSocket a todos en la sala del partido, marcando esMio solo al emisor
const sockets = await io.in(`partido-${partidoId}`).allSockets();
  let emisor = await Usuario.findByPk(usuarioId); 
const mensajeConUsuario = {
  ...nuevoMensaje.toJSON(),
  Usuario: { nombre: emisor?.nombre || 'Jugador' } // 👈 le agregamos el nombre para el frontend
};


for (const socketId of sockets) {
  const socketInstance = io.sockets.sockets.get(socketId);

  if (socketInstance?.usuarioId === Number(usuarioId)) {
    socketInstance.emit('nuevo-mensaje-partido', {
      ...mensajeConUsuario,
      esMio: true
    });
  } else {
    socketInstance?.emit('nuevo-mensaje-partido', mensajeConUsuario);
  }
}


    // 🔔 Obtener jugadores confirmados (excepto el emisor)
   const jugadores = await UsuarioPartido.findAll({
  where: {
    partidoId,
    estado: { [Op.in]: ['confirmado', 'organizador'] }, // 🎯 Incluye al organizador
    usuarioId: { [Op.ne]: usuarioId } // excluye al que escribió el mensaje
  },
  include: [{ model: Usuario, attributes: ['nombre'] }]
});
    //let emisor = await Usuario.findByPk(usuarioId); // << nombre del que escribe
let nombreEmisor = emisor?.nombre || 'Jugador';

    for (const jugador of jugadores) {
      const suscripcion = await Suscripcion.findOne({ where: { usuarioId: jugador.UsuarioId } });


  io.to(`noti-${jugador.UsuarioId}`).emit('alertaVisual', {
  tipo: 'partido',
  partidoId,
  nombre: nombreEmisor,
  mensaje: mensaje.length > 60 ? mensaje.slice(0, 60) + '...' : mensaje
});


     
     
      if (suscripcion && suscripcion.fcmToken) {
        const payload = {
          notification: {
            title: `💬 Nuevo mensaje en el partido`,
           body: `${nombreEmisor}: ${mensaje}`, // ✅ Correcto


          }
        };

        try {
          await admin.messaging().send({ token: suscripcion.fcmToken, ...payload });
        } catch (error) {
          if (error.code === 'messaging/registration-token-not-registered') {
            await Suscripcion.destroy({ where: { fcmToken: suscripcion.fcmToken } });
          } else {
            console.error('❌ Error al enviar notificación:', error);
          }
        }
      }
    }

    res.json(nuevoMensaje);
  } catch (err) {
    console.error('❌ Error al enviar mensaje de partido:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ✅ Obtener IDs de partidos con mensajes no leídos (para el usuario)
router.get('/no-leidos/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const mensajes = await MensajePartido.findAll({
      where: {
        usuarioId: { [Op.ne]: usuarioId }, // que no sean escritos por él
        leido: false
      },
      attributes: ['partidoId']
    });

    const partidosConMensajes = [...new Set(mensajes.map(m => m.partidoId))];

    res.json({ partidosConMensajes });
  } catch (error) {
    console.error('❌ Error en /mensajes-partido/no-leidos:', error);
    res.status(500).json({ error: 'Error al obtener mensajes no leídos' });
  }
});

// PUT /api/mensajes-partido/marcar-leido/:partidoId/:usuarioId
router.put('/marcar-leido/:partidoId/:usuarioId', async (req, res) => {
  const { partidoId, usuarioId } = req.params;
  try {
    await MensajePartido.update(
      { leido: true },
      {
        where: {
          partidoId,
          usuarioId: { [Op.ne]: usuarioId }, // solo los mensajes que no escribió él
          leido: false
        }
      }
    );
    res.status(200).json({ mensaje: 'Mensajes marcados como leídos' });
  } catch (error) {
    console.error('❌ Error al marcar como leídos (partido):', error);
    res.status(500).json({ error: 'Error interno' });
  }
});


router.get('/partido/:partidoId', async (req, res) => {
  const { partidoId } = req.params;

  console.log("estoy en partidoid a ver que onda");
  console.log(partidoId);

  try {
    const mensajes = await MensajePartido.findAll({
      where: { partidoId },
      include: [{
        model: Usuario,
        attributes: ['id', 'nombre', 'fotoPerfil'],
        required: false, // importante para permitir mensajes sin usuario (sistema)
      }],
      order: [['createdAt', 'ASC']]
    });
    res.json(mensajes);
  } catch (error) {
    console.error('❌ Error al obtener mensajes del partido:', error.message);
    console.error(error);
    res.status(500).json({ error: 'Error al obtener mensajes', detalle: error.message });
  }
});




// 👉 Obtener mensajes de un partido
router.get('/:partidoId', async (req, res) => {
  const { partidoId } = req.params;
  try {
    const mensajes = await MensajePartido.findAll({
      where: { partidoId },
      include: [{ model: Usuario, attributes: ['id', 'nombre', 'fotoPerfil'] }],
      order: [['createdAt', 'ASC']]
    });
    res.json(mensajes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});



// 👉 Guardar mensaje y enviar notificación si corresponde
router.post('/', async (req, res) => {
  const { partidoId, usuarioId, mensaje } = req.body;

  try {
    const nuevo = await MensajePartido.create({ partidoId, usuarioId, mensaje });

    // 🧠 Lógica para FCM (enviar a todos los jugadores excepto emisor)
    const jugadores = await Suscripcion.findAll({
      where: {
        usuarioId: { [require('sequelize').Op.ne]: usuarioId }
      }
    });

    const tokens = jugadores.map(j => j.fcmToken).filter(Boolean);
    if (tokens.length > 0) {
      await admin.messaging().sendEach(
        tokens.map(token => ({
          token,
          notification: {
            title: 'Nuevo mensaje del partido',
            body: mensaje.length > 60 ? mensaje.slice(0, 60) + '...' : mensaje
          },
          data: {
            tipo: 'mensaje_partido',
            partidoId: partidoId.toString()
          }
        }))
      );
    }

    res.json(nuevo);
  } catch (error) {
    console.error('❌ Error al guardar mensaje o enviar FCM:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// routes/mensajesPartido.js
router.get('/chats-partidos/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const partidos = await UsuarioPartido.findAll({
      where: { UsuarioId: usuarioId, estado: 'confirmado' },
      include: [
        {
          model: Partido,
          include: [
            { model: Deporte, attributes: ['nombre'] },
            { model: Usuario, as: 'organizador', attributes: ['nombre'] },
          ],
        },
      ],
    });

    const resultado = partidos.map((up) => ({
      id: up.Partido.id,
      nombre: `${up.Partido.Deporte.nombre} en ${up.Partido.lugar}`,
      esGrupal: true,
    }));

    res.json(resultado);
  } catch (error) {
    console.error('❌ Error al obtener chats de partidos:', error);
    res.status(500).json({ error: 'Error al obtener chats de partidos' });
  }
});
// ✅ Obtener mensajes grupales de un partido (nuevo endpoint seguro)

module.exports = router;
