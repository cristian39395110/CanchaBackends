// routes/cuotaClub.js
const express = require('express');
const router = express.Router();

const { mpClient, Preference, Payment } = require('../config/mercadopago');
const { Usuario, PremiumOrden,Cancha } = require('../models/model');
const { autenticarToken } = require('../middlewares/auth'); // ajustá el path si tu middleware está en otro archivo

// ===== Helper: calcular estado premium =====
function calcularEstadoPremium(usuario) {
  const hoy = new Date();
  const esPremium = usuario.esPremiumEstablecimiento;
  const vence = usuario.premiumEstablecimientoVenceEl
    ? new Date(usuario.premiumEstablecimientoVenceEl)
    : null;

  if (!esPremium || !vence) return 'noPremium';
  if (vence < hoy) return 'premiumVencido';

  return 'premiumConEstablecimientoVigente';
}

// ================== GET /api/cuota-club/estado-club ==================
// ================== GET /api/cuota-club ==================
router.get('/', autenticarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id || req.usuarioId;
    console.log(usuarioId, "usuarioId /cuota-club");

    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // 1) Estado base (solo mira fechas y flag premium)
    let estado = calcularEstadoPremium(usuario);

    // 2) Si es premium vigente, ver si tiene canchas cargadas
    if (estado === 'premiumConEstablecimientoVigente') {
      const cantidadCanchas = await Cancha.count({
        where: { propietarioUsuarioId: usuarioId },
      });

      if (cantidadCanchas === 0) {
        estado = 'premiumSinEstablecimiento';
      }
    }

    return res.json({ estado });
  } catch (error) {
    console.error('Error /cuota-club:', error);
    res.status(500).json({ error: 'Error al obtener el estado.' });
  }
});

// ================== GET /api/cuota-club/precio-plan ==================
router.get('/precio-plan', autenticarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id || req.usuarioId;

    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // 💰 Tomar el valor desde la BD (campo nuevo precioPlanClub)
    const precio = usuario.precioPlanClub
      ? Number(usuario.precioPlanClub)
      : Number(process.env.PRECIO_PLAN_CLUB || 15000); // fallback si está null

    return res.json({ precio });
  } catch (error) {
    console.error('Error /cuota-club/precio-plan:', error);
    return res.status(500).json({ error: 'No se pudo obtener el precio.' });
  }
});

// ================== POST /api/cuota-club/orden-club ==================
router.post('/orden-club', autenticarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id || req.usuarioId;

    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // 💰 1) Tomar el valor desde la BD (campo nuevo precioPlanClub)
    const monto = usuario.precioPlanClub
      ? Number(usuario.precioPlanClub)
      : Number(process.env.PRECIO_PLAN_CLUB || 15000); // fallback

    // 2) Crear orden en BD
    const orden = await PremiumOrden.create({
      usuarioId,
      monto,
      estado: 'pendiente',
      tipoPlan: 'establecimiento_premium',
    });

    // 3) Armar preferencia de Mercado Pago
    const preference = {
      items: [
        {
          title: 'Plan Establecimientos MatchClub',
          quantity: 1,
          unit_price: monto,
          currency_id: 'ARS',
        },
      ],
      payer: {
        email: usuario.email,
      },
      external_reference: orden.id.toString(), // muy importante
      back_urls: {
        success: `${process.env.FRONTEND_URL}/club/pago-exitoso`,
        failure: `${process.env.FRONTEND_URL}/club/pago-fallido`,
        pending: `${process.env.FRONTEND_URL}/club/pago-pendiente`,
      },
      auto_return: 'approved',
      notification_url: `${process.env.BACKEND_URL}/api/cuota-club/webhook-mp`,
      // 👆 asegurate que BACKEND_URL coincida con la URL pública del backend
    };

    // 4) Crear preferencia con el SDK nuevo
    const prefClient = new Preference(mpClient);
    const mpResp = await prefClient.create({ body: preference });

    // mpResp ya es el body directo en el SDK nuevo
    await orden.update({ mpPreferenceId: mpResp.id });

    return res.json({
      initPoint: mpResp.init_point, // 👈 solo este, nada de sandbox en prod
      precio: monto,
    });
  } catch (error) {
    console.error('Error /cuota-club/orden-club:', error);
    res.status(500).json({ error: 'Error al crear la orden de pago.' });
  }
});

// ================== POST /api/cuota-club/webhook-mp ==================
router.post('/webhook-mp', async (req, res) => {
  try {
    console.log('🟨 Webhook recibido:', req.query);

    const topic = req.query.topic || req.query.type;
    const paymentId = req.query['data.id'] || req.query.id;

    if (topic !== 'payment') {
      console.log('🟫 Webhook ignorado: topic no es payment');
      return res.sendStatus(200);
    }

    const paymentClient = new Payment(mpClient);
    const info = await paymentClient.get({ id: paymentId });

    console.log('🟩 Pago obtenido:', info.id, 'Estado:', info.status);

    const ordenId = info.external_reference;
    if (!ordenId) {
      console.warn('⚠️ Pago sin external_reference:', info);
      return res.sendStatus(200);
    }

    console.log('🟦 Buscando orden:', ordenId);
    const orden = await PremiumOrden.findByPk(ordenId);

    if (!orden) {
      console.warn('⚠️ Orden no encontrada en BD:', ordenId);
      return res.sendStatus(200);
    }

  console.log('🟦 Actualizando orden:', ordenId);
await orden.update({
  mpPaymentId: String(paymentId),
  mpPayload: info,
});
if (info.status === 'approved') {
  console.log('🟩 Pago APROBADO. Orden:', ordenId);
  const ahora = new Date();
  const vence = new Date();
  vence.setMonth(vence.getMonth() + 1);

  await orden.update({
    estado: 'pagada',
    fechaPago: ahora,
  });

  const usuario = await Usuario.findByPk(orden.usuarioId);
  if (usuario) {
    console.log('🟦 Activando premium al usuario:', usuario.id);
    await usuario.update({
      esPremiumEstablecimiento: true,
      premiumEstablecimientoVenceEl: vence,
      precioPlanClub: orden.monto   // 🔥 ESTE ES EL QUE FALTA
    });
  }
}
else {
  console.log('🟥 Pago RECHAZADO. Orden:', ordenId);
  await orden.update({ estado: 'rechazada' });
}

    return res.sendStatus(200);

  } catch (error) {
    console.error('🟥 ERROR webhook MP:', error);
    return res.sendStatus(200);
  }
});


module.exports = router;
