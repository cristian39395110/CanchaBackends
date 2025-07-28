//routes mensaje partido
const express = require('express');
const router = express.Router();
const { MensajePartido, Usuario, Suscripcion,UsuarioPartido,MensajePartidoLeido,Partido} = require('../models/model');
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

      const estaEnElPartido = await UsuarioPartido.findOne({
      where: {
        partidoId,
        usuarioId,
        estado: { [Op.in]: ['confirmado', 'organizador'] }
      }
    });

    if (!estaEnElPartido) {
      return res.status(403).json({ error: 'No estás autorizado para enviar mensajes en este partido' });
    } 
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

router.get('/no-leidos/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    // 1. Buscar mensajes NO leídos por este usuario
    const mensajesLeidos = await MensajePartidoLeido.findAll({
      where: { usuarioId },
      attributes: ['mensajePartidoId']
    });

    const idsLeidos = new Set(mensajesLeidos.map(m => m.mensajePartidoId));

    // 2. Buscar mensajes que NO están en esa lista de leídos
    const mensajesNoLeidos = await MensajePartido.findAll({
      where: {
        id: { [Op.notIn]: Array.from(idsLeidos) },
        usuarioId: { [Op.ne]: usuarioId }, // que no los haya escrito él
        usuarioId: { [Op.ne]: null }       // que tengan autor
      },
      attributes: ['id', 'partidoId']
    });

    if (mensajesNoLeidos.length === 0) {
      return res.json({ partidosConMensajes: [] });
    }

    // 3. Filtrar por partidos donde el usuario todavía está
    const partidosConMensajes = [...new Set(mensajesNoLeidos.map(m => m.partidoId))];

  const relaciones = await UsuarioPartido.findAll({
  where: {
    UsuarioId: usuarioId, // 🔁 mayúscula
    estado: { [Op.in]: ['confirmado', 'organizador'] },
    PartidoId: { [Op.in]: partidosConMensajes } // 🔁 mayúscula
  },
  attributes: ['PartidoId'] // 🔁 mayúscula
});

   
 const partidosValidos = relaciones.map(r => r.PartidoId);

 console.log("wiiiiiiiii",partidosValidos)

res.json({ partidosConMensajes: partidosValidos });


  } catch (error) {
    console.error('❌ Error en /mensajes-partido/no-leidos:', error);
    res.status(500).json({ error: 'Error al obtener mensajes no leídos' });
  }
});


// PUT /api/mensajes-partido/marcar-leido/:partidoId/:usuarioId
// PUT /api/mensajes-partido/marcar-leido/:partidoId/:usuarioId

router.put('/marcar-leido/:partidoId/:usuarioId', async (req, res) => {
  const partidoId = Number(req.params.partidoId);
  const usuarioId = Number(req.params.usuarioId);
  const io = req.app.get('io');

  try {
    // 🔐 Verificamos si el partido existe
    const partido = await Partido.findByPk(partidoId);
    if (!partido) {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }

    // 🔒 Validamos si el usuario sigue en el partido o es el organizador
    const esOrganizador = Number(partido.organizadorId) === usuarioId;
    const relacion = await UsuarioPartido.findOne({
      where: {
        partidoId,
        usuarioId,
        estado: 'confirmado',
      },
    });

    if (!esOrganizador && !relacion) {
      return res.status(403).json({ error: 'No podés marcar mensajes como leídos. Fuiste removido.' });
    }

    // ✅ Traemos todos los mensajes del partido que no sean del usuario
    const mensajes = await MensajePartido.findAll({
      where: {
        partidoId,
        usuarioId: { [Op.ne]: usuarioId },
      },
      attributes: ['id'],
    });

    const mensajeIds = mensajes.map(m => m.id);
    if (mensajeIds.length === 0) {
      return res.status(200).json({ mensaje: 'No hay mensajes nuevos para marcar como leídos' });
    }

    // 🔍 Filtramos los que aún no fueron marcados como leídos
    const yaLeidos = await MensajePartidoLeido.findAll({
      where: {
        mensajePartidoId: mensajeIds,
        usuarioId,
      },
      attributes: ['mensajePartidoId'],
    });

    const yaLeidosIds = yaLeidos.map(m => m.mensajePartidoId);
    const nuevosLeidos = mensajeIds
      .filter(id => !yaLeidosIds.includes(id))
      .map(id => ({
        mensajePartidoId: id,
        usuarioId,
      }));

    if (nuevosLeidos.length > 0) {
      await MensajePartidoLeido.bulkCreate(nuevosLeidos);
    }

    // 🔔 Emitimos por WebSocket
    io.to(`noti-${usuarioId}`).emit('mensajes-leidos-partido', { partidoId });

    res.status(200).json({ mensaje: 'Mensajes marcados como leídos' });
  } catch (error) {
    console.error('❌ Error al marcar como leídos (partido):', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


router.get('/partido/:partidoId', async (req, res) => {
  const { partidoId } = req.params;
  const { usuarioId } = req.query; // asegurate de pasarlo desde el frontend

  try {
    // 🧠 Buscar el partido
    const partido = await require('../models/model').Partido.findByPk(partidoId);
    if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });

    // ✅ El organizador puede ver
    if (Number(partido.organizadorId) === Number(usuarioId)) {
      const mensajes = await MensajePartido.findAll({
        where: { partidoId },
        include: [{
          model: Usuario,
          attributes: ['id', 'nombre', 'fotoPerfil'],
          required: false
        }],
        order: [['createdAt', 'ASC']]
      });
      return res.json(mensajes);
    }

    // 🔒 Verificar si el usuario sigue en el partido
    const relacion = await UsuarioPartido.findOne({
      where: {
        partidoId,
        usuarioId,
        estado: 'confirmado'
      }
    });

    if (!relacion) {
      return res.status(403).json({ error: 'Fuiste removido del partido' });
    }

    // ✅ Si todo bien, devolver los mensajes
    const mensajes = await MensajePartido.findAll({
      where: { partidoId },
      include: [{
        model: Usuario,
        attributes: ['id', 'nombre', 'fotoPerfil'],
        required: false
      }],
      order: [['createdAt', 'ASC']]
    });
    res.json(mensajes);
  } catch (error) {
    console.error('❌ Error al obtener mensajes del partido:', error.message);
    res.status(500).json({ error: 'Error interno', detalle: error.message });
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
