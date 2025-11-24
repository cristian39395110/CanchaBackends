// routes/puntosnegociosqr.js
const express = require('express');
const router = express.Router();
const { Op, fn, col } = require('sequelize');


const { autenticarTokenNegocio } = require('../middlewares/authNegocio'); 

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
// SIN cambiar asociaciones
router.get('/historial', autenticarTokenNegocio, async (req, res) => {
  const usuarioNegocioId = req.negocio.id;

  try {
    // ✅ 1) Historial de checkins en negocios
    const checkins = await uCheckinNegocio.findAll({
      where: { usuarioNegocioId },
      include: [
        {
          model: uNegocio,
          attributes: ['id','nombre','provincia','localidad','latitud','longitud'],
        },
      ],
      order: [['fecha', 'DESC']],
    });

    const historialCheckins = checkins.map((c) => ({
      id: c.id,
      tipo: 'negocio',
      negocioId: c.Negocio?.id ?? c.negocioId,
      negocioNombre: c.Negocio?.nombre ?? 'Negocio',
      puntosGanados: c.puntosGanados,
      fecha: c.fecha,
      lat: c.latitudUsuario,
      lng: c.longitudUsuario,
      negocioLocalidad: c.Negocio?.localidad ?? null,
      negocioProvincia: c.Negocio?.provincia ?? null,
    }));

    // ✅ 2) Historial de retos cobrados
    const retos = await UsuarioRetoCumplido.findAll({
      where: { usuarioId: usuarioNegocioId },
      include: [
        {
          model: Reto,
          as: 'reto',
          attributes: ['id', 'titulo'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const historialRetos = retos.map((r) => ({
      id: 1000000 + r.id, // para que no choque con ids de checkins
      tipo: 'reto',
      negocioId: null,
      negocioNombre: r.reto?.titulo
        ? `Reto: ${r.reto.titulo}`
        : 'Reto saludable',
      puntosGanados:
        r.puntosOtorgados ?? r.puntosGanados ?? 0,
      fecha: r.createdAt,
      lat: null,
      lng: null,
      negocioLocalidad: null,
      negocioProvincia: null,
    }));

    // ✅ 3) Unir y ordenar por fecha
    const combinado = [...historialCheckins, ...historialRetos].sort(
      (a, b) => new Date(b.fecha) - new Date(a.fecha)
    );

    res.json(combinado);
  } catch (error) {
    console.error('Error en /historial:', error);
    res.status(500).json({ error: 'No se pudo obtener el historial.' });
  }
});


/* ===========================================================
   2) POST /api/puntosnegociosqr/emitir
   → el negocio genera un QR para dar puntos
   =========================================================== */
// POST /api/puntosnegociosqr/emitir
// routes/puntosnegociosqr.js  (fragmento)
router.post('/emitir', autenticarTokenNegocio, async (req, res) => {
  try {
    // 1) Tomamos lo que venga del body
    let { negocioId, modo = 'compra', minutosValidez } = req.body;

        const ownerId = req.negocio?.id;
     
    if (!ownerId) return res.status(401).json({ error: 'No autenticado' });

    // 2) Si no vino, lo inferimos desde el usuario del token
    if (!negocioId) {
      const ownerId = req.negocio?.id || req.user?.id;
      if (!ownerId) return res.status(401).json({ error: 'No autenticado' });

      const negocioDelOwner = await uNegocio.findOne({
        where: { ownerId, activo: true },
        attributes: ['id', 'puntosPorCompra', 'plan'],
      });

      if (!negocioDelOwner) {
        return res.status(400).json({ error: 'No se pudo inferir el negocio del usuario' });
      }
      negocioId = negocioDelOwner.id;

      // dejamos el negocio resuelto para calcular puntos
      req._negocioResuelto = negocioDelOwner;
    }

    // 3) Buscar el negocio (si no lo resolvimos recién)
    const negocio = req._negocioResuelto || await uNegocio.findByPk(negocioId);
    if (!negocio) return res.status(404).json({ error: 'Negocio no encontrado' });

    // 4) Calcular puntos según plan
    let puntosOtorga = negocio.puntosPorCompra || 100;
    if (negocio.plan === 'premium') puntosOtorga *= 2;

    // 5) Armar expiración según modo
    let fechaExpiracion = null;

    if (modo === 'dia') {
      const inicioHoy = new Date(); inicioHoy.setHours(0,0,0,0);
      const finHoy = new Date();   finHoy.setHours(23,59,59,999);

      // Reutilizar si ya existe uno del día
      const qrExistente = await uQRCompraNegocio.findOne({
        where: {
          negocioId,
          modo: 'dia',
          fechaExpiracion: { [Op.between]: [inicioHoy, finHoy] },
        },
      });

      if (qrExistente) {
        return res.json({
          mensaje: '📅 Ya existe un QR del día. Se reutiliza.',
          qr: qrExistente,
        });
      }
      fechaExpiracion = finHoy; // vence hoy 23:59
    }

    if (modo === 'compra') {
      if (minutosValidez) {
        const ahora = new Date();
        fechaExpiracion = new Date(ahora.getTime() + minutosValidez * 60000);
      }
    }

    // 6) Crear el QR
    const codigoQR = generarCodigoQR();

    const qrCreado = await uQRCompraNegocio.create({
      negocioId,
      codigoQR,
      puntosOtorga,
      fechaExpiracion,
      modo,
      usado: false,
    });

    return res.json({
      mensaje: modo === 'compra'
        ? '✅ QR por compra generado con éxito.'
        : '✅ QR del día generado con éxito.',
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




router.post('/canjear', autenticarTokenNegocio, async (req, res) => {
  const usuarioNegocioId = req.negocio?.id || null;
  const { qr, negocioId: negocioIdBody, lat, lng } = req.body;

  if (!usuarioNegocioId) return res.status(401).json({ error: 'No autenticado' });
  if (!qr) return res.status(400).json({ error: 'Falta el código QR' });

  try {
    // 1) Leer QR (si mandan negocioId lo validamos contra el QR)
    const whereQR = negocioIdBody
      ? { codigoQR: qr, negocioId: negocioIdBody }
      : { codigoQR: qr };

    const qrRow = await uQRCompraNegocio.findOne({ where: whereQR });
    if (!qrRow) {
      return res.status(404).json({ error: 'QR no válido o no corresponde a este negocio.' });
    }

    const negocioId = qrRow.negocioId; // fuente de verdad
    const modoQR = qrRow.modo || null; // 'compra' | 'dia' | null

    // 2) Validaciones básicas
    if (modoQR === 'compra' && qrRow.usado) {
      return res.status(409).json({ error: 'Este QR ya fue usado.' });
    }
    if (qrRow.fechaExpiracion && qrRow.fechaExpiracion < new Date()) {
      return res.status(400).json({ error: 'QR vencido.' });
    }

    // 3) Cooldown 4h por negocio
    const COOLDOWN_HORAS = 4;
    const limiteTiempo = new Date(Date.now() - COOLDOWN_HORAS * 60 * 60 * 1000);

    const checkinReciente = await uCheckinNegocio.findOne({
      where: {
        usuarioNegocioId,
        negocioId,
        createdAt: { [Op.gte]: limiteTiempo },
      },
      order: [['createdAt', 'DESC']],
    });

    if (checkinReciente) {
      return res.status(429).json({
        error: `Debés esperar ${COOLDOWN_HORAS}h para volver a canjear en este negocio.`,
      });
    }

    const puntosDelCanje = Number(qrRow.puntosOtorga) || 0;

    // 4) Marcar usado SOLO si es QR de compra
    if (modoQR === 'compra' && !qrRow.usado) {
      await qrRow.update({ usado: true });
    }

    // 5) Crear checkin
    const nuevoCheckin = await uCheckinNegocio.create({
      usuarioNegocioId,
      negocioId,
      qrId: qrRow.id,
      puntosGanados: puntosDelCanje,
      latitudUsuario: lat ?? null,
      longitudUsuario: lng ?? null,
    });

    // 6) Sumar puntos al usuario
    if (puntosDelCanje > 0) {
      await uUsuarioNegocio.increment('puntos', {
        by: puntosDelCanje,
        where: { id: usuarioNegocioId },
      });
    }

    // 7) Reto demo (24h, 3 locales distintos)
    let puntosExtraReto = 0;
    const reto = await Reto.findOne({
      where: { titulo: 'Visitá 3 locales distintos en 24h', activo: true },
    });

    if (reto) {
      const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const checkinsUltimoDia = await uCheckinNegocio.findAll({
        where: { usuarioNegocioId, createdAt: { [Op.gte]: hace24h } },
        attributes: ['negocioId'],
      });

      const localesDistintos = new Set(checkinsUltimoDia.map((c) => c.negocioId)).size;

      if (localesDistintos >= 3) {
        const yaCumplido = await UsuarioRetoCumplido.findOne({
          where: { usuarioId: usuarioNegocioId, retoId: reto.id },
        });

        if (!yaCumplido) {
          await UsuarioRetoCumplido.create({
            usuarioId: usuarioNegocioId,
            retoId: reto.id,
            puntosOtorgados: Number(reto.puntos) || 0,
          });

          puntosExtraReto = Number(reto.puntos) || 0;
          if (puntosExtraReto > 0) {
            await uUsuarioNegocio.increment('puntos', {
              by: puntosExtraReto,
              where: { id: usuarioNegocioId },
            });
          }
        }
      }
    }

    return res.json({
      mensaje:
        puntosExtraReto > 0
          ? '✅ Canje registrado. Reto completado 🎯'
          : '✅ Canje registrado.',
      puntosCanje: puntosDelCanje,
      puntosExtraReto,
      totalSumado: puntosDelCanje + puntosExtraReto,
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
router.get('/mis-puntos', autenticarTokenNegocio, async (req, res) => {
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
router.get('/mis-checkins', autenticarTokenNegocio, async (req, res) => {
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
router.get('/negocio/:negocioId/checkins', autenticarTokenNegocio, async (req, res) => {
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






router.get('/ranking', autenticarTokenNegocio, async (req, res) => {
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



// GET /api/puntosnegociosqr/politica
router.get('/politica', autenticarTokenNegocio, async (req, res) => {
  try {
    const negocioId =
      req.negocio?.id ;
     
    if (!negocioId) return res.status(400).json({ error: 'Falta negocioId' });

    const negocio = await uNegocio.findByPk(negocioId);
    if (!negocio) return res.status(404).json({ error: 'Negocio no encontrado' });

    // Regla: primero puntosPorCompra; si no hay, map por plan
    const PLAN_TO_PUNTOS = { basico: 100, premium: 200 };
    let puntos = Number(negocio.puntosPorCompra) || 0;
    if (!puntos) {
      puntos = PLAN_TO_PUNTOS[(negocio.plan || 'basico').toLowerCase()] ?? 100;
    }

    return res.json({
      negocioId: negocio.id,
      plan: negocio.plan,
      puntosPorCompra: puntos,
    });
  } catch (e) {
    console.error('GET /politica', e);
    return res.status(500).json({ error: 'No se pudo obtener la política' });
  }
});

module.exports = router;
