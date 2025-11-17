// routes/cuotaClub.js
const express = require('express');
const router = express.Router();

const { mpClient, Preference, Payment } = require('../config/mercadopago');
const { Usuario, PremiumOrden } = require('../models/model');
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
router.get('/', autenticarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id || req.usuarioId;

    console.log(usuarioId,"usuarioIdusuarioIdusuarioIdusuarioIdusuarioId")

    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const estado = calcularEstadoPremium(usuario);

    return res.json({ estado });
  } catch (error) {
    console.error('Error /cuota-club/estado-club:', error);
    res.status(500).json({ error: 'Error al obtener el estado.' });
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

    // 💰 precio del plan mensual (ajustá esto)
    const monto = 15;

    // 1) Crear orden en BD
    const orden = await PremiumOrden.create({
      usuarioId,
      monto,
      estado: 'pendiente',
      tipoPlan: 'establecimiento_premium',
    });

    // 2) Armar preferencia de Mercado Pago
    const preference = {
      items: [
        {
          title: 'Plan Establecimientos MatchClub',
          quantity: 1,
          unit_price: Number(monto),
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

    // 3) Crear preferencia con el SDK nuevo
    const prefClient = new Preference(mpClient);
    const mpResp = await prefClient.create({ body: preference });

    // mpResp ya es el body directo en el SDK nuevo
    await orden.update({ mpPreferenceId: mpResp.id });

    return res.json({
      initPoint: mpResp.init_point,
      sandboxInitPoint: mpResp.sandbox_init_point,
    });
  } catch (error) {
    console.error('Error /cuota-club/orden-club:', error);
    res.status(500).json({ error: 'Error al crear la orden de pago.' });
  }
});

// ================== POST /api/cuota-club/webhook-mp ==================
router.post('/webhook-mp', async (req, res) => {
  try {
    const topic = req.query.topic || req.query.type;
    const paymentId = req.query['data.id'] || req.query.id;

    if (topic !== 'payment') {
      return res.sendStatus(200);
    }

    // Obtener info del pago con el SDK nuevo
    const paymentClient = new Payment(mpClient);
    const info = await paymentClient.get({ id: paymentId });

    const ordenId = info.external_reference;
    if (!ordenId) {
      console.warn('Pago sin external_reference, ignorando');
      return res.sendStatus(200);
    }

    const orden = await PremiumOrden.findByPk(ordenId);
    if (!orden) {
      console.warn('No se encontró PremiumOrden para id:', ordenId);
      return res.sendStatus(200);
    }

    await orden.update({
      mpPaymentId: String(paymentId),
      mpPayload: info,
    });

    if (info.status === 'approved') {
      const ahora = new Date();
      const vence = new Date();
      vence.setMonth(vence.getMonth() + 1); // +1 mes

      await orden.update({
        estado: 'pagada',
        fechaPago: ahora,
      });

      const usuario = await Usuario.findByPk(orden.usuarioId);
      if (usuario) {
        await usuario.update({
          esPremiumEstablecimiento: true,
          premiumEstablecimientoVenceEl: vence,
        });
      }
    } else {
      await orden.update({
        estado: 'rechazada',
      });
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error('Error en webhook MP:', error);
    // siempre devolvemos 200 para que MP no reintente infinito
    return res.sendStatus(200);
  }
});

module.exports = router;
