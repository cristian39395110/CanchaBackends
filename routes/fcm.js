const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const Usuario = require('../models/usuario');
const Suscripcion = require('../models/Suscripcion');
const admin = require('firebase-admin');
const UsuarioDeporte = require('../models/usuarioDeporte');
const Partido = require('../models/partido');
const Deporte = require('../models/deporte');
const UsuarioPartido=require('../models/usuarioPartido');
// ✅ Inicializar Firebase Admin solo una vez
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



// Agregalo en el mismo archivo `routes/fcm.js`



//...............................................................................................

// 📮 Ruta para enviar notificaciones a todos los jugadores de un deporte
router.post('/deporte', async (req, res) => {
  const { deporteId, mensaje } = req.body;

  if (!deporteId) {
    return res.status(400).json({ error: 'deporteId es requerido' });
  }

  try {
    // 🔍 Buscar todos los usuarios inscriptos en ese deporte
    const inscripciones = await UsuarioDeporte.findAll({
      where: { deporteId },
    });

    const usuarioIds = inscripciones.map(i => i.usuarioId);

    if (usuarioIds.length === 0) {
      return res.status(404).json({ error: 'No hay usuarios en este deporte' });
    }

    // 🔐 Buscar los tokens de esos usuarios
    const suscripciones = await Suscripcion.findAll({
      where: { usuarioId: usuarioIds },
    });

    const tokens = suscripciones.map(s => s.fcmToken).filter(Boolean);

    if (tokens.length === 0) {
      return res.status(404).json({ error: 'No hay tokens disponibles para este deporte' });
    }

    // 🚀 Enviar notificaciones
    const result = await enviarNotificacionesFCM(
      tokens,
      '¡Hay un partido disponible!',
      mensaje || '¡Un nuevo partido te espera!'
    );

    res.json({
      enviados: result.successCount,
      fallidos: result.failureCount,
    });
  } catch (err) {
   
    res.status(500).json({ error: 'Error al enviar notificaciones por deporte' });
  }
});


// 📮 Ruta para enviar a usuarios seleccionados


router.post('/individual', async (req, res) => {
  const { usuarios, mensaje, partidoId } = req.body;

  if (!Array.isArray(usuarios) || usuarios.length === 0) {
    return res.status(400).json({ error: 'Debe enviar al menos un usuario' });
  }

  try {
    if (!partidoId) {
      return res.status(400).json({ error: 'Falta el ID del partido' });
    }

    const partido = await Partido.findByPk(partidoId);
    if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });

    const deporte = await Deporte.findByPk(partido.deporteId);
    const nombreDeporte = deporte ? deporte.nombre : 'Deporte';

    const titulo = `⚽ ${nombreDeporte} | ¡Nuevo partido!`;
    const mensajeFinal = mensaje || `📍 ${partido.lugar} - 🕒 ${partido.fecha} ${partido.hora}`;

    const totalInvitados = await UsuarioPartido.count({
      where: {
        PartidoId: partidoId,
        estado: { [Op.in]: ['pendiente', 'aceptado'] }
      }
    });

    const disponibles = partido.cantidadJugadores - totalInvitados;
    if (disponibles <= 0) {
      return res.status(400).json({ error: 'El partido ya está lleno' });
    }

    const usuariosAEnviar = usuarios.slice(0, disponibles);

    const yaInvitados = await UsuarioPartido.findAll({
      where: {
        PartidoId: partidoId,
        UsuarioId: { [Op.in]: usuariosAEnviar }
      }
    });

    const yaInvitadosIds = yaInvitados.map(i => i.UsuarioId);
    const nuevosUsuarios = usuariosAEnviar.filter(id => !yaInvitadosIds.includes(id));

    const nuevosRegistros = nuevosUsuarios.map(usuarioId => ({
      UsuarioId: usuarioId,
      PartidoId: partidoId,
      estado: 'pendiente'
    }));
    await UsuarioPartido.bulkCreate(nuevosRegistros);

    const suscripciones = await Suscripcion.findAll({
      where: { usuarioId: nuevosUsuarios }
    });

    const tokens = suscripciones.map(s => s.fcmToken).filter(Boolean);
    if (tokens.length === 0) {
      return res.status(404).json({ error: 'No se encontraron tokens disponibles' });
    }

    const result = await enviarNotificacionesFCM(tokens, titulo, mensajeFinal, {
      tipo: 'invitacion',
      partidoId: partidoId.toString()
    });

    res.json({
      enviados: result.successCount,
      fallidos: result.failureCount,
      restantes: disponibles - nuevosUsuarios.length
    });

  } catch (err) {
    console.error('❌ Error al enviar notificaciones:', err);
    res.status(500).json({ error: 'Error al enviar notificaciones' });
  }
});


module.exports = router;
