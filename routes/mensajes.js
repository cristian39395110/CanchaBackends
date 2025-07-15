//mensajes.js

const express = require('express');
const router = express.Router();
const { Usuario, UsuarioPartido, Mensaje, Suscripcion,Partido,Deporte } = require('../models/model');
const { Op } = require('sequelize');
const admin = require('firebase-admin');

// Obtener una conversación entre dos usuarios
router.get('/conversacion/:emisorId/:receptorId', async (req, res) => {
  const { emisorId, receptorId } = req.params;
  try {
    const mensajes = await Mensaje.findAll({
      where: {
        [Op.or]: [
          { emisorId, receptorId },
          { emisorId: receptorId, receptorId: emisorId }
        ]
      },
      order: [['fecha', 'ASC']]
    });
    res.json(mensajes);
  } catch (error) {
    console.error('❌ Error al obtener la conversación:', error);
    res.status(500).json({ error: 'Error al obtener los mensajes' });
  }
});

// Contar mensajes no leídos
router.get('/no-leidos/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;
  try {
    const mensajes = await Mensaje.findAll({
      where: {
        receptorId: usuarioId,
        leido: false
      }
    });
    res.json({ total: mensajes.length });
  } catch (error) {
    console.error('❌ Error al contar mensajes no leídos:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Obtener lista de chats
router.get('/chats/:usuarioId', async (req, res) => {
  const usuarioId = Number(req.params.usuarioId);

  try {
    // Buscar todos los mensajes donde esté involucrado
    const mensajes = await Mensaje.findAll({
      where: {
        [Op.or]: [
          { emisorId: usuarioId },
          { receptorId: usuarioId }
        ]
      },
      order: [['fecha', 'DESC']]
    });

    // Sacar todos los IDs de los otros usuarios con los que habló
    const idsOtrosUsuarios = [
      ...new Set(
        mensajes.map(m =>
          m.emisorId === usuarioId ? m.receptorId : m.emisorId
        )
      )
    ];

    // Para cada usuario, buscar si hay al menos un mensaje no leído hacia el usuario actual
    const resultado = await Promise.all(
      idsOtrosUsuarios.map(async (otroId) => {
        const usuario = await Usuario.findByPk(otroId);

        const tieneNoLeidos = await Mensaje.findOne({
          where: {
            emisorId: otroId,
            receptorId: usuarioId,
            leido: false
          }
        });

        return {
          id: usuario.id,
          nombre: usuario.nombre,
          tieneNoLeidos: !!tieneNoLeidos
        };
      })
    );

    res.json(resultado);
  } catch (error) {
    console.error('❌ Error al cargar chats:', error);
    res.status(500).json({ message: 'Error al obtener los chats' });
  }
});

// Marcar mensajes como leídos
// Marcar mensajes como leídos
router.put('/marcar-leido/:usuarioId/:otroId', async (req, res) => {
  const { usuarioId, otroId } = req.params;
  try {
    await Mensaje.update(
      { leido: true },
      {
        where: {
          receptorId: usuarioId,
          emisorId: otroId,
          leido: false
        }
      }
    );
    res.status(200).json({ mensaje: 'Mensajes marcados como leídos' });
  } catch (error) {
    console.error('❌ Error al marcar como leídos:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Enviar mensaje
router.post('/enviar', async (req, res) => {
  const { emisorId, receptorId, mensaje } = req.body;

  if (!emisorId || !receptorId || !mensaje) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  try {
    // Guardar el mensaje en la BD
    const nuevoMensaje = await Mensaje.create({
      emisorId,
      receptorId,
      contenido: mensaje,
      leido: false
    });

    // Enviar notificación push si hay token FCM
    const suscripcion = await Suscripcion.findOne({ where: { usuarioId: receptorId } });

    if (suscripcion?.fcmToken) {
      await admin.messaging().send({
        token: suscripcion.fcmToken,
        notification: {
          title: '📩 Nuevo mensaje',
          body: mensaje.length > 40 ? mensaje.slice(0, 40) + '...' : mensaje
        },
        data: {
          url: '/chat',
          tipo: 'mensaje',
          emisorId: String(emisorId)
        }
      });
    }

    // Emitir mensaje vía WebSocket SOLO al receptor
    const io = req.app.get('io');
    if (io) {

      io.to(`usuario-${receptorId}`).emit('mensajeNuevo', nuevoMensaje);
      io.to(`usuario-${emisorId}`).emit('actualizar-contadores');
        io.to(`usuario-${emisorId}`).emit('mensajeNuevo', nuevoMensaje);

    }

    res.status(201).json(nuevoMensaje);
  } catch (error) {
    console.error('❌ Error al enviar el mensaje:', error);
    res.status(500).json({ error: 'Error al enviar el mensaje' });
  }
});

// Buscar usuarios por filtro
router.get('/usuarios', async (req, res) => {
  const { filtro, localidad, usuarioId } = req.query;
  try {
    if (filtro === 'localidad') {
      if (!localidad) return res.status(400).json({ error: 'Localidad requerida' });
      const usuarios = await Usuario.findAll({
        where: { localidad, id: { [Op.ne]: usuarioId } },
        attributes: ['id', 'nombre']
      });
      return res.json(usuarios);
    }

    if (filtro === 'partido') {
      const partidos = await UsuarioPartido.findAll({
        where: { usuarioId },
        attributes: ['partidoId']
      });

      const partidoIds = partidos.map(p => p.partidoId);
      const otrosUsuarios = await UsuarioPartido.findAll({
        where: {
          partidoId: partidoIds,
          usuarioId: { [Op.ne]: usuarioId }
        },
        include: [{ model: Usuario, attributes: ['id', 'nombre'] }]
      });

      const resultado = otrosUsuarios.map(p => p.Usuario);
      return res.json(resultado);
    }

    return res.status(400).json({ error: 'Filtro inválido' });
  } catch (err) {
    console.error('Error en /usuarios:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});


//  este endpoint es el final cuando tengo el usuario confirmado  , y se le envia un mensaje 
router.post('/confirmacion', async (req, res) => {
  const { emisorId, receptorId, partidoId } = req.body;

  try {
    // 1. Cambiar estado a 'confirmado'
    await UsuarioPartido.update(
      { estado: 'confirmado' },
      { where: { usuarioId: receptorId, partidoId } }
    );

    // 2. Obtener partido con relaciones existentes
    const partido = await Partido.findByPk(partidoId, {
      include: [
        { model: Deporte, foreignKey: 'deporteId' },
        { model: Usuario, as: 'organizador', foreignKey: 'organizadorId' }
      ]
    });

    if (!partido) {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }

    const deporteNombre = partido.deporte?.nombre || 'deporte';
    const lugar = partido.lugar || 'lugar no especificado';
    const fecha = partido.fecha;
    const hora = partido.hora;
    const nombreOrganizador = partido.organizador?.nombre || 'el organizador';

    // 3. Armar mensaje personalizado
    const mensajeTexto = `✅ ¡Fuiste confirmado para jugar ${deporteNombre} en ${lugar} el día ${fecha} a las ${hora} hs! Organizado por ${nombreOrganizador}.`;

    // 4. Guardar mensaje en la base de datos
    const nuevoMensaje = await Mensaje.create({
      emisorId,
      receptorId,
      contenido: mensajeTexto,
      leido: false
    });

    // 5. Buscar token FCM del receptor
    const suscripcion = await Suscripcion.findOne({ where: { usuarioId: receptorId } });

    if (suscripcion?.fcmToken) {
      await admin.messaging().send({
        token: suscripcion.fcmToken,
        notification: {
          title: '🎉 Fuiste confirmado en un partido',
          body: mensajeTexto
        },
        data: {
          tipo: 'mensaje',
          emisorId: emisorId.toString(),
          partidoId: partidoId.toString()
        }
      });
    }

    // 6. Emitir el mensaje por WebSocket (chat en tiempo real)
    const io = req.app.get('io');
    if (io) {
      io.to(`usuario-${receptorId}`).emit('mensajeNuevo', nuevoMensaje);
      io.to(`usuario-${emisorId}`).emit('actualizar-contadores');
    }

    res.status(200).json({ mensaje: 'Jugador confirmado, mensaje enviado y notificado' });
  } catch (error) {
    console.error('❌ Error al confirmar jugador:', error);
    res.status(500).json({ error: 'Error interno al confirmar jugador' });
  }
});

router.get('/partidos-confirmados/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
   const partidos = await UsuarioPartido.findAll({
      where: {
        usuarioId,
        estado: { [Op.in]: ['confirmado', 'organizador'] } // 🎯 incluimos los dos
      },
      include: [
        {
          model: Partido,
          include: [
            { model: Deporte },
            { model: Usuario, as: 'organizador', attributes: ['id', 'nombre'] },
          ],
        },
      ],
    });
    const resultado = partidos.map((up) => {
  const partido = up.Partido;

  const fechaFormateada = new Date(`${partido.fecha}T${partido.hora}`).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return {
    id: partido.id,
    nombre: `${partido.Deporte.nombre} - ${fechaFormateada}`,
    organizador: partido.organizador?.nombre || '',
  };
});

    res.json(resultado);
  } catch (error) {
    console.error('❌ Error al obtener partidos con chat:', error);
    res.status(500).json({ error: 'Error al obtener partidos con chat' });
  }
});

module.exports = router;
