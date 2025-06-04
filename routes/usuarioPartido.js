  const express = require('express');
  const router = express.Router();
  const { UsuarioPartido, Partido } = require('../models');

  // Aceptar o rechazar una invitación

  // GET /solicitudes/:usuarioId
router.get('/solicitudes/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;
  try {
    const solicitudes = await UsuarioPartido.findAll({
      where: {
        UsuarioId: usuarioId,
        estado: 'pendiente'
      },
      include: [
        {
          model: Partido,
          include: [
            // opcional, incluir info del deporte, organizador, etc.
          ]
        }
      ]
    });

    res.json(solicitudes);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});


// PUT /solicitudes/:id (id es el id de UsuarioPartido)
router.put('/solicitudes/:id', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body; // debe ser 'aceptado' o 'rechazado'

  if (!['aceptado', 'rechazado'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  try {
    const solicitud = await UsuarioPartido.findByPk(id);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });

    solicitud.estado = estado;
    await solicitud.save();

    res.json({ mensaje: `Solicitud ${estado}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar solicitud' });
  }
});

  router.put('/:id', async (req, res) => {
    const { id } = req.params; // id de UsuarioPartido
    const { estado } = req.body; // "aceptado" o "rechazado"

    try {
      const notificacion = await UsuarioPartido.findByPk(id);

      if (!notificacion) return res.status(404).json({ error: 'No se encontró la notificación' });

      // Actualizar el estado (aceptado o rechazado)
      notificacion.estado = estado;
      await notificacion.save();

      if (estado === 'aceptado') {
        // Descontar 1 jugador del partido
        const partido = await Partido.findByPk(notificacion.PartidoId);
        if (partido && partido.cantidadJugadores > 0) {
          partido.cantidadJugadores -= 1;
          await partido.save();
        }
      }

      res.json({ mensaje: `Notificación actualizada a ${estado}` });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Obtener notificaciones para un usuario específico
  router.get('/', async (req, res) => {
    const { usuarioId } = req.query;
    if (!usuarioId) return res.status(400).json({ error: 'usuarioId es requerido' });

    try {
      const notificaciones = await UsuarioPartido.findAll({
        where: { UsuarioId: usuarioId },
        include: { model: Partido },
      });

      res.json(notificaciones);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });


  module.exports = router;
