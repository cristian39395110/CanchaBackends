// routes/solicitudes.js
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Partido, Usuario, UsuarioPartido, Deporte ,HistorialPuntuacion,Mensaje,Suscripcion,MensajePartido} = require('../models/model');
const admin = require('firebase-admin');

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
// ✅ Obtener partidos organizados por el usuario donde hay jugadores que aceptaron o están pendientes
router.get('/aceptadas/:organizadorId', async (req, res) => {
  const { organizadorId } = req.params;
 

  try {
    // 1. Buscar los partidos organizados por el usuario
    const partidos = await Partido.findAll({
      where: { organizadorId },
      include: [{ model: Deporte }],
      order: [['fecha', 'DESC']]
    });

    const resultado = [];

    for (const partido of partidos) {
      // 2. Traer los usuarios con su estado (relación UsuarioPartido) para ese partido
      const relaciones = await UsuarioPartido.findAll({
        where: { partidoId: partido.id },
        include: [{ model: Usuario, attributes: ['id', 'nombre'] }]
      });

      const usuariosAceptaron = relaciones
  .filter(r => r.estado === 'aceptado' || r.estado === 'confirmado')
  .map(r => ({
    id: r.Usuario.id,
    nombre: r.Usuario.nombre,
    estado: r.estado // 👈 importante
  }));


      const usuariosPendientes = relaciones
        .filter(r => r.estado === 'pendiente')
        .map(r => r.Usuario);

   resultado.push({
  id: partido.id,
  lugar: partido.lugar,
  fecha: partido.fecha,
  hora: partido.hora,
  deporte: partido.Deporte,
  cantidadJugadores: partido.cantidadJugadores,
  organizadorId: partido.organizadorId,
  latitud: partido.latitud,
  longitud: partido.longitud,
  usuariosAceptaron,
  usuariosPendientes,

  // 🆕 Agregar estos campos:
  localidad: partido.localidad,
  canchaNombreManual: partido.canchaNombreManual,
  sexo: partido.sexo,
  rangoEdad: partido.rangoEdad
});


    }

    res.json(resultado);
  } catch (error) {
    console.error('❌ Error en /aceptadas:', error);
    res.status(500).json({ error: 'Error al obtener partidos con aceptaciones' });
  }
});
router.get('/invitaciones-auto/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    // Buscar partidos creados por el usuario donde haya jugadores asignados automáticamente
    const partidos = await Partido.findAll({
      where: { organizadorId: usuarioId },
      include: [
        {
          model: Usuario,
          through: { where: { estado: 'aceptado' },
          },
          attributes: ['id', 'nombre'],
        },
        {
          model: Deporte,
          attributes: ['nombre']
        }
      ]
    });

    const resultado = await Promise.all(
      partidos.map(async (partido) => {
        const usuariosConPuntaje = await Promise.all(
          partido.Usuarios.map(async (u) => {
            const historial = await HistorialPuntuacion.findAll({
              where: { usuarioId: u.id },
              attributes: ['puntos']
            });

            const puntaje =
              historial.length > 0
                ? historial.reduce((acc, h) => acc + h.puntaje, 0) / historial.length
                : 0;

            return {
              id: u.id,
              nombre: u.nombre,
              puntaje: puntaje.toFixed(1)
            };
          })
        );

        return {
          id: partido.id,
          deporte: partido.Deporte?.nombre || 'Desconocido',
          localidad: partido.localidad,
          lugar: partido.lugar,
          fecha: partido.fecha,
          hora: partido.hora,
          usuariosAceptados: usuariosConPuntaje.sort((a, b) => b.puntaje - a.puntaje)
        };
      })
    );

    res.json(resultado);
  } catch (error) {
    console.error('Error en invitaciones-auto:', error);
    res.status(500).json({ error: 'Error al obtener jugadores sugeridos' });
  }
});








// ✅ Aceptar una invitación
router.post('/aceptar', async (req, res) => {
  const { usuarioId, partidoId } = req.body;
  try {
    const resultado = await UsuarioPartido.update(
      { estado: 'aceptado' },
      { where: { usuarioId, partidoId } }
    );
    res.json({ mensaje: 'Invitación aceptada', resultado });
  } catch (err) {
    console.error('❌ Error al aceptar:', err);
    res.status(500).json({ error: 'Error al aceptar la invitación' });
  }
});

// ✅ Rechazar una invitación (opcional: podrías eliminarla o marcar como "rechazado")
router.post('/rechazar', async (req, res) => {
  const { usuarioId, jugadorId, partidoId } = req.body;
  const io = req.app.get('io');

  try {
    const partido = await Partido.findByPk(partidoId, {
      include: [{ model: Usuario, as: 'organizador' }, { model: Deporte }]
    });

    if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });
  // Si el organizador NO es premium y ya usó el rechazo, no puede volver a hacerlo
if (!partido.organizador.premium && !partido.rechazoDisponible) {
  return res.status(400).json({ error: '❌ Ya usaste el cupo de rechazo para este partido' });
}


    // Eliminar jugador del partido
await UsuarioPartido.update(
  { estado: 'rechazado' },
  { where: { usuarioId: jugadorId, partidoId } }
);

    // Marcar como ya usado el rechazo
    partido.rechazoDisponible = false;
    await partido.save();

    // Buscar jugador expulsado
    const jugador = await Usuario.findByPk(jugadorId);
    const mensajeSistema = `⚠ ${jugador.nombre} fue removido del partido de ${partido.Deporte.nombre} en ${partido.lugar}.`;

    // 👉 Crear mensaje de sistema en el chat grupal
    const nuevoMensaje = await MensajePartido.create({
      partidoId,
      usuarioId: null, // mensaje del sistema
      mensaje: mensajeSistema,
      tipo: 'sistema'
    });

    // 🔔 Emitir por socket al grupo
   io.to(`partido-${partidoId}`).emit('nuevo-mensaje-partido', {
  ...nuevoMensaje.toJSON(),
  Usuario: { nombre: 'Sistema' }, // 👈 ESTO es lo que cambia
  esMio: false
});

io.to(`noti-${jugadorId}`).emit('alertaVisual', {
  tipo: 'expulsado',
  partidoId,
  mensaje: `Fuiste removido del partido de ${partido.Deporte.nombre} en ${partido.lugar}.`
});
    // 🔥 Enviar FCM al jugador expulsado
    const suscripcion = await Suscripcion.findOne({ where: { usuarioId: jugadorId } });
    if (suscripcion?.fcmToken) {
      await admin.messaging().send({
        token: suscripcion.fcmToken,
        notification: {
          title: '⛔ Has sido removido de un partido',
          body: `El organizador ajustó el equipo en el partido de ${partido.Deporte.nombre}.`
        }
      });
    }
    for (const socket of io.sockets.sockets.values()) {
  if (socket.usuarioId === jugadorId) {
    socket.leave(`partido-${partidoId}`);
    break;
  }
}

    res.json({ mensaje: '✅ Jugador removido, notificado y mensaje enviado al grupo' });

  } catch (err) {
    console.error('❌ Error al rechazar:', err);
    res.status(500).json({ error: 'Error al rechazar la invitación' });
  }
});


module.exports = router;
