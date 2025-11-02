// routes/puntosnegociosqr.js
const express = require('express');
const router = express.Router();
const { Op, fn, col } = require('sequelize');

const { autenticarToken } = require('../middlewares/auth'); 

const {
  uQRCompraNegocio,
  uCheckinNegocio,
  uNegocio,
  uUsuarioNegocio,
  Reto,
  UsuarioRetoCumplido,
  // Usuario, // si después querés sumar puntos al usuario-app
} = require('../models/model');

/* ===========================================================
   helper para generar códigos tipo "MCQR-ABC123"
   =========================================================== */
function generarCodigoQR() {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `MCQR-${rand}`;
}

/* ===========================================================
   1) GET /api/puntosnegociosqr/historial
   → historial del usuario logueado (para PuntosPage.tsx)
   =========================================================== */
router.get('/historial', autenticarToken, async (req, res) => {
  const usuarioNegocioId = req.usuario.id; // viene del token

  try {
    const checkins = await uCheckinNegocio.findAll({
      where: { usuarioNegocioId },
      include: [
        {
          model: uNegocio,
          foreignKey: 'negocioId',
          attributes: ['id', 'nombre', 'direccion'],
        },
      ],
      order: [['fecha', 'DESC']],
    });

    const respuesta = checkins.map((c) => ({
      id: c.id,
      negocioNombre: c.uNegocio?.nombre || c.negocio?.nombre || 'Negocio',
      puntosGanados: c.puntosGanados,
      fecha: c.fecha,
      lat: c.latitudUsuario,
      lng: c.longitudUsuario,
    }));

    return res.json(respuesta);
  } catch (error) {
    console.error('Error en /historial:', error);
    return res.status(500).json({ error: 'No se pudo obtener el historial.' });
  }
});

/* ===========================================================
   2) POST /api/puntosnegociosqr/emitir
   → el negocio genera un QR para dar puntos
   =========================================================== */
router.post('/emitir', autenticarToken, async (req, res) => {
  try {
    const { negocioId, puntosOtorga = 10, minutosValidez } = req.body;

    if (!negocioId) {
      return res.status(400).json({ error: 'Falta negocioId' });
    }

    let fechaExpiracion = null;
    if (minutosValidez) {
      const ahora = new Date();
      fechaExpiracion = new Date(ahora.getTime() + minutosValidez * 60 * 1000);
    }

    const codigoQR = generarCodigoQR();

    const qrCreado = await uQRCompraNegocio.create({
      negocioId,
      codigoQR,
      puntosOtorga,
      fechaExpiracion,
    });

    return res.json({
      mensaje: '✅ QR generado',
      qr: qrCreado,
    });
  } catch (error) {
    console.error('Error en /emitir:', error);
    return res.status(500).json({ error: 'Error al emitir QR' });
  }
});

/* ===========================================================
   3) POST /api/puntosnegociosqr/canjear
   → el usuario escanea / escribe el código
   → valida QR
   → crea checkin
   → verifica retos
   body: { qr, negocioId, lat, lng }
   =========================================================== */
router.post('/canjear', autenticarToken, async (req, res) => {
  const usuarioNegocioId = req.usuario.id;
  const { qr, negocioId, lat, lng } = req.body;

  if (!qr || !negocioId) {
    return res.status(400).json({ error: 'Faltan datos: qr o negocioId' });
  }

  try {
    // 1) buscar QR
    const qrRow = await uQRCompraNegocio.findOne({
      where: {
        codigoQR: qr,
        negocioId,
      },
    });

    if (!qrRow) {
      return res.status(404).json({ error: 'QR no válido para este negocio.' });
    }

    if (qrRow.usado) {
      return res.status(400).json({ error: 'Este QR ya fue usado.' });
    }

    // opcional: validar expiración
    if (qrRow.fechaExpiracion && qrRow.fechaExpiracion < new Date()) {
      return res.status(400).json({ error: 'QR vencido.' });
    }

    const puntosDelCanje = qrRow.puntosOtorga || 0;

    // 2) marcar QR como usado
    qrRow.usado = true;
    await qrRow.save();

    // 3) crear checkin
    const nuevoCheckin = await uCheckinNegocio.create({
      usuarioNegocioId,
      negocioId,
      qrId: qrRow.id,
      puntosGanados: puntosDelCanje,
      latitudUsuario: lat,
      longitudUsuario: lng,
      fecha: new Date(),
    });

    // 4) verificar retos simples (ejemplo)
    // 👇 ojo: esto es DEMO, deberías moverlo a un helper si se complica
    const ahora = new Date();
    const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);

    // checkins del último día
    const checkinsUltimoDia = await uCheckinNegocio.findAll({
      where: {
        usuarioNegocioId,
        fecha: { [Op.gte]: hace24h },
      },
      attributes: ['negocioId'],
    });

    const localesDistintos = new Set(checkinsUltimoDia.map((c) => c.negocioId)).size;

    // ejemplo de reto fijo
    const reto = await Reto.findOne({
      where: { titulo: 'Visitá 3 locales distintos en 24h', activo: true },
    });

    if (reto && localesDistintos >= 3) {
      const yaCumplido = await UsuarioRetoCumplido.findOne({
        where: { usuarioId: usuarioNegocioId, retoId: reto.id },
      });

      if (!yaCumplido) {
        await UsuarioRetoCumplido.create({
          usuarioId: usuarioNegocioId,
          retoId: reto.id,
          puntosOtorgados: reto.puntos,
        });

        // si querés devolver los puntos extra en la respuesta
        return res.json({
          mensaje: '✅ Canje registrado. Reto completado 🎯',
          puntosCanje: puntosDelCanje,
          puntosExtraReto: reto.puntos,
          totalSumado: puntosDelCanje + (reto.puntos || 0),
          checkin: nuevoCheckin,
        });
      }
    }

    // respuesta normal sin reto
    return res.json({
      mensaje: '✅ Canje registrado.',
      puntosCanje: puntosDelCanje,
      checkin: nuevoCheckin,
    });
  } catch (error) {
    console.error('Error en /canjear:', error);
    return res.status(500).json({ error: 'No se pudo canjear.' });
  }
});

/* ===========================================================
   4) GET /api/puntosnegociosqr/mis-puntos
   → suma de puntos del usuario (por checkins)
   =========================================================== */
router.get('/mis-puntos', autenticarToken, async (req, res) => {
  const usuarioNegocioId = req.usuario.id;
  try {
    const total = await uCheckinNegocio.findOne({
      attributes: [[fn('SUM', col('puntosGanados')), 'totalPuntos']],
      where: { usuarioNegocioId },
      raw: true,
    });

    const totalPuntos = total?.totalPuntos ? Number(total.totalPuntos) : 0;

    return res.json({
      usuarioId: usuarioNegocioId,
      totalPuntos,
    });
  } catch (error) {
    console.error('Error en /mis-puntos:', error);
    return res.status(500).json({ error: 'No se pudieron obtener los puntos.' });
  }
});

/* ===========================================================
   5) GET /api/puntosnegociosqr/mis-checkins
   → historial crudo (por si lo querés en admin)
   =========================================================== */
router.get('/mis-checkins', autenticarToken, async (req, res) => {
  const usuarioNegocioId = req.usuario.id;
  try {
    const checkins = await uCheckinNegocio.findAll({
      where: { usuarioNegocioId },
      order: [['fecha', 'DESC']],
    });

    return res.json(checkins);
  } catch (error) {
    console.error('Error en /mis-checkins:', error);
    return res.status(500).json({ error: 'No se pudo obtener el historial.' });
  }
});

/* ===========================================================
   6) GET /api/puntosnegociosqr/negocio/:negocioId/checkins
   → para que el dueño vea quién canjeó
   =========================================================== */
router.get('/negocio/:negocioId/checkins', autenticarToken, async (req, res) => {
  const { negocioId } = req.params;

  try {
    const checkins = await uCheckinNegocio.findAll({
      where: { negocioId },
      order: [['fecha', 'DESC']],
    });

    return res.json(checkins);
  } catch (error) {
    console.error('Error en /negocio/:negocioId/checkins:', error);
    return res.status(500).json({ error: 'No se pudo obtener el historial del negocio.' });
  }
});






router.get('/ranking', autenticarToken, async (req, res) => {
  try {
    const filas = await uCheckinNegocio.findAll({
      attributes: [
        'usuarioNegocioId',
        [fn('SUM', col('puntosGanados')), 'totalPuntos'],
      ],
      include: [
        {
          model: uUsuarioNegocio,
          attributes: ['id', 'nombre'],
        },
      ],
      group: ['usuarioNegocioId', 'uUsuarioNegocio.id'],
      order: [[literal('totalPuntos'), 'DESC']],
      limit: 20,
    });

    const data = filas.map((row) => ({
      id: row.uUsuarioNegocio ? row.uUsuarioNegocio.id : row.usuarioNegocioId,
      nombre: row.uUsuarioNegocio ? row.uUsuarioNegocio.nombre : 'Usuario',
      puntos: Number(row.get('totalPuntos') || 0),
    }));

    return res.json(data);
  } catch (err) {
    console.error('Error en /api/puntosnegociosqr/ranking', err);
    return res.status(500).json({ error: 'No se pudo obtener el ranking.' });
  }
}); 
module.exports = router;
