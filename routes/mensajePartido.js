//routes mensaje partido
const express = require('express');
const router = express.Router();
const { MensajePartido, Usuario, Suscripcion } = require('../models/model');
const admin = require('../firebase');


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

router.post('/partido/enviar', async (req, res) => {
  const { partidoId, usuarioId, mensaje } = req.body;

  if (!partidoId || !usuarioId || !mensaje) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  try {
    // 1. Guardar el mensaje
    const nuevoMensaje = await MensajePartido.create({ partidoId, usuarioId, mensaje });

    // 2. Emitir mensaje por WebSocket
    req.io.to(`partido-${partidoId}`).emit('nuevo-mensaje-partido', nuevoMensaje);

    // 3. Obtener usuarios confirmados en ese partido (excepto el que envía)
    const usuarios = await UsuarioPartido.findAll({
      where: {
        partidoId,
        estado: 'confirmado',
        UsuarioId: { [Op.ne]: usuarioId }
      },
      include: [{ model: Usuario }]
    });

    // 4. Obtener tokens FCM
    const tokens = usuarios
      .map(u => u.Usuario?.fcmToken)
      .filter(token => token);

    // 5. Enviar notificaciones FCM
    const payload = {
      notification: {
        title: 'Nuevo mensaje en el grupo',
        body: mensaje,
      },
      data: {
        tipo: 'mensajePartido',
        partidoId: partidoId.toString(),
      }
    };

    for (const token of tokens) {
      try {
        await admin.messaging().send({ ...payload, token });
      } catch (error) {
        if (error.code === 'messaging/registration-token-not-registered') {
          console.log('🧹 Token FCM no válido, debería eliminarse:', token);
          // Acá podrías eliminarlo si querés, como ya hiciste en otros endpoints
        }
      }
    }

    res.json(nuevoMensaje);
  } catch (error) {
    console.error('❌ Error al enviar mensaje de partido:', error);
    res.status(500).json({ error: 'Error interno al enviar mensaje' });
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
