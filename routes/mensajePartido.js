const express = require('express');
const router = express.Router();
const { MensajePartido, Usuario, Suscripcion } = require('../models');
const admin = require('../firebase');

// 👉 Obtener mensajes de un partido
router.get('/:partidoId', async (req, res) => {
  const { partidoId } = req.params;
  try {
    const mensajes = await MensajePartido.findAll({
      where: { partidoId },
      include: [{ model: Usuario, attributes: ['id', 'nombre', 'foto'] }],
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

module.exports = router;
