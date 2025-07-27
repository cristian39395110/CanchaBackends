//mensajes.js

const express = require('express');
const router = express.Router();
const { Usuario, UsuarioPartido, Mensaje, Suscripcion,Partido,Deporte,MensajePartido } = require('../models/model');
const { Op } = require('sequelize');
const admin = require('firebase-admin');

// Obtener una conversación entre dos usuarios


// DELETE /api/mensajes/conversacion/:usuarioId1/:usuarioId2
router.delete('/conversacion/:usuarioId1/:usuarioId2', async (req, res) => {
  const { usuarioId1, usuarioId2 } = req.params;
  try {
    await Mensaje.destroy({
      where: {
        [Op.or]: [
          { emisorId: usuarioId1, receptorId: usuarioId2 },
          { emisorId: usuarioId2, receptorId: usuarioId1 }
        ]
      }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar conversación' });
  }
});




// DELETE /api/mensajes/partido/:partidoId
// DELETE /api/mensajes/partido/:partidoId?usuarioId=123
router.delete('/partido/:partidoId', async (req, res) => {
  const { partidoId } = req.params;
  const usuarioId = req.query.usuarioId;

  if (!usuarioId) {
    return res.status(400).json({ error: 'Falta el usuarioId' });
  }

  try {
    console.log(`🚪 Usuario ${usuarioId} saliendo del partido ${partidoId}...`);

    // Eliminar mensajes del usuario en ese partido
    await MensajePartido.destroy({
      where: {
        partidoId,
        usuarioId
      }
    });

    // Eliminar la relación en UsuarioPartido (ya no está en el grupo)
    await UsuarioPartido.destroy({
      where: {
        PartidoId: partidoId,
        UsuarioId: usuarioId
      }
    });

    res.json({ success: true, message: 'Saliste del partido y eliminaste el chat' });
  } catch (err) {
    console.error('❌ Error al salir del partido:', err);
    res.status(500).json({ error: 'Error al salir del partido' });
  }
});


// Obtener partidos con mensajes no leídos
// ✅ Este es correcto
router.get('/no-leidos/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;
  try {
    const mensajes = await Mensaje.findAll({
      where: {
        receptorId: Number(usuarioId),
        leido: false
      }
    });

    const usuariosConMensajes = [...new Set(mensajes.map(m => m.emisorId))];

    res.json({ usuariosConMensajes });
  } catch (error) {
    console.error('❌ Error al contar mensajes no leídos:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});



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

// DELETE /api/mensajes/eliminar/:id
router.delete('/eliminar/:id', async (req, res) => {
  const { id } = req.params;
  const { usuarioId } = req.query; 

  try {
    const mensaje = await Mensaje.findByPk(id);
    if (!mensaje) {
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }
  if (mensaje.emisorId !== Number(usuarioId)) {
      return res.status(403).json({ error: 'No autorizado para eliminar este mensaje' });
    }
    await mensaje.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error al eliminar mensaje:', err);
    res.status(500).json({ error: 'Error al eliminar mensaje' });
  }
});


// Contar mensajes no leídos


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
  const { emisorId, receptorId, mensaje,frontendId  } = req.body;

  if (!emisorId || !receptorId || !mensaje) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

 try {

  const emisor = await Usuario.findByPk(emisorId);
  const nombreEmisor = emisor?.nombre || `Usuario ${emisorId}`;

    // 🔄 Verificar si ya existe un mensaje con ese frontendId
    if (frontendId) {
      const mensajeExistente = await Mensaje.findOne({ where: { frontendId } });
      if (mensajeExistente) {
        console.log('⚠️ Mensaje duplicado ignorado (mismo frontendId)');
        return res.status(200).json(mensajeExistente); // Devolvemos el existente
      }
    }

    // 📝 Guardar nuevo mensaje
    const nuevoMensaje = await Mensaje.create({
      emisorId,
      receptorId,
      contenido: mensaje,
      leido: false,
      frontendId: frontendId || null
    });

    const io = req.app.get('io');

    if (io) {
      // ✅ Emitir al emisor con esMio: true
      io.to(`usuario-${emisorId}`).emit('mensajeNuevo', {
        ...nuevoMensaje.toJSON(),
        esMio: true,
      });

      // ✅ Emitir al receptor normal
      io.to(`usuario-${receptorId}`).emit('mensajeNuevo', nuevoMensaje);

io.to(`noti-${receptorId}`).emit('alertaVisual', {
  tipo: 'usuario',
  usuarioId: emisorId, // 👈 Por si querés usarlo también
  nombre: nombreEmisor,
  mensaje: mensaje.length > 60 ? mensaje.slice(0, 60) + '...' : mensaje
});



      // 🔁 Contadores si usás
      io.to(`usuario-${emisorId}`).emit('actualizar-contadores');
    }
    // Enviar notificación push si hay token FCM
    const suscripcion = await Suscripcion.findOne({ where: { usuarioId: receptorId } });

    if (suscripcion?.fcmToken) {
     await admin.messaging().send({
  token: suscripcion.fcmToken,
  notification: {
    title: `📩 Mensaje de ${nombreEmisor}`,
    body: mensaje.length > 40 ? mensaje.slice(0, 40) + '...' : mensaje
  },
  data: {
    url: `/chat/${emisorId}`,
    tipo: 'mensaje',
    emisorId: String(emisorId),
    nombre: nombreEmisor
  }
});

    }

    // Emitir mensaje vía WebSocket SOLO al receptor
   

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
    // Solo partidos donde este usuario tenga mensajes
    const mensajes = await MensajePartido.findAll({
      where: { usuarioId },
      attributes: ['partidoId'],
      group: ['partidoId']
    });

    const partidoIds = mensajes.map(m => m.partidoId);

    if (partidoIds.length === 0) return res.json([]);

    // Obtener detalles de los partidos (aunque ya no esté en UsuarioPartido)
    const partidos = await Partido.findAll({
      where: { id: { [Op.in]: partidoIds } },
      include: [
        { model: Deporte },
        { model: Usuario, as: 'organizador', attributes: ['id', 'nombre'] }
      ]
    });

    const resultado = partidos.map((partido) => {
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
        organizador: partido.organizador?.nombre || ''
      };
    });

    res.json(resultado);
  } catch (error) {
    console.error('❌ Error al obtener partidos confirmados:', error);
    res.status(500).json({ error: 'Error al obtener partidos con chat' });
  }
});


module.exports = router;
