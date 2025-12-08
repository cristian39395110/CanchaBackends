
// routes/planesNegocio.js
const express = require("express");
const router = express.Router();

const { PlanNegocio, uNegocio, uUsuarioNegocio } = require("../models/model");

// SDK nuevo de MercadoPago
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const { autenticarTokenNegocio, autenticarUsuarioNegocio } = require("../middlewares/authNegocio");

const {autenticarUsuarioNegocio } = require("../middlewares/authUsuarioNegocio");

// ⚙️ Config MP (poné tu access token en .env)
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// Clientes para crear preferencias y leer pagos
const preferenceClient = new Preference(mpClient);
const paymentClient = new Payment(mpClient);



router.get("/mi-plan", autenticarTokenNegocio, async (req, res) => {
  try {
    const usuarioNegocioId = req.negocio.id;

    // 1) Buscamos algún negocio que pertenezca a este dueño
    const negocio = await uNegocio.findOne({
      where: { ownerId: usuarioNegocioId },
    });

    // 2) Si no tiene negocio, pero es premium => devolvemos plan "activo" genérico
    const usuario = await uUsuarioNegocio.findByPk(usuarioNegocioId);

    if (!negocio) {
      if (usuario?.esPremium) {
        return res.json({
          ok: true,
          planActual: {
            id: 0, // o null, da igual para el front
            nombre: "Plan activo",
            venceEl: null,
            activo: true,
          },
        });
      }

      // no tiene plan ni negocio
      return res.json({ ok: true, planActual: null });
    }

    // 3) Tiene negocio, miramos el plan
    let plan = null;
    if (negocio.planId) {
      plan = await PlanNegocio.findByPk(negocio.planId);
    }

    if (!plan) {
      // tiene negocio pero sin plan asociado
      return res.json({
        ok: true,
        planActual: null,
      });
    }

    // Si tenés lógica de vencimiento, acá la metés. Por ahora lo dejamos siempre activo.
    const planActual = {
      id: plan.id,
      nombre: plan.nombre,
      venceEl: null, // si luego guardás fecha de vencimiento, la ponés acá
      activo: true,
    };

    return res.json({ ok: true, planActual });
  } catch (err) {
    console.error("❌ GET /api/negocios/mi-plan:", err);
    return res.status(500).json({ ok: false, error: "Error al obtener plan" });
  }
});


/**
 * POST /api/planes-negocio/crear-orden
 * Crea la preferencia de pago para el plan de negocio.
 */
router.post("/crear-orden", autenticarUsuarioNegocio, async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = await PlanNegocio.findByPk(planId);

    if (!plan) {
      return res.status(404).json({ ok: false, error: "Plan no encontrado" });
    }

    // 👤 dueño del negocio (logueado con token de negocio)
    const usuarioNegocioId = req.negocio.id;

    // URL de front y back desde .env
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
    const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

    const body = {
      items: [
        {
          title: `Plan negocio: ${plan.nombre}`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: Number(plan.precioMensual),
        },
      ],
      back_urls: {
        success: `${FRONTEND_URL}/negocio/alta?planId=${plan.id}`,
        failure: `${FRONTEND_URL}/planes-negocio?error=1`,
        pending: `${FRONTEND_URL}/planes-negocio?pending=1`,
      },
      auto_return: "approved",

      // 👇 A ESTA URL te va a pegar MercadoPago cuando cambie el estado del pago
      notification_url: `${BACKEND_URL}/api/planes-negocio/webhook`,

      // 👇 Acá encodeamos quién es y qué plan pagó
      // formato: negocio-plan-<usuarioNegocioId>-<planId>
      external_reference: `negocio-plan-${usuarioNegocioId}-${plan.id}`,
    };

    const mpResponse = await preferenceClient.create({ body });

    const pagoUrl = mpResponse.init_point || mpResponse.sandbox_init_point;

    return res.json({ ok: true, pagoUrl });
  } catch (err) {
    console.error("❌ Error creando orden MP:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Error al crear orden de pago" });
  }
});

/**
 * POST /api/planes-negocio/webhook
 * Webhook que recibe las notificaciones de MercadoPago.
 * IMPORTANTE: configurá esta URL en la preferencia (notification_url)
 * y/o en el panel de credenciales de MercadoPago.
 */
router.post("/webhook", async (req, res) => {
  try {
    console.log("🔔 Webhook MP recibido:", req.query, req.body);

    // MercadoPago nuevo suele mandar ?data.id=<payment_id>&type=payment
    // En otros casos manda ?id=<payment_id>&topic=payment
    let paymentId = null;

    if (req.query["data.id"]) {
      paymentId = req.query["data.id"];
    } else if (req.query.id) {
      paymentId = req.query.id;
    }

    if (!paymentId) {
      console.log("ℹ️ Webhook sin paymentId, respondo 200 igual.");
      return res.sendStatus(200);
    }

    // 👇 Consultamos el pago en MP
    const pago = await paymentClient.get({ id: paymentId });

    // Según versión del SDK, los datos vienen en root o en .body
    const status = pago.status || pago.body?.status;
    const externalReference =
      pago.external_reference || pago.body?.external_reference;

    console.log("💳 Pago consultado:", status, externalReference);

    // Solo actuamos si está APROBADO y viene nuestro formato de referencia
    if (
      status === "approved" &&
      externalReference &&
      externalReference.startsWith("negocio-plan-")
    ) {
      const parts = externalReference.split("-"); 
      // ['negocio', 'plan', '<usuarioNegocioId>', '<planId>']
      const usuarioNegocioId = Number(parts[2]);
      const planId = Number(parts[3]);

      if (usuarioNegocioId && planId) {
        // 👉 1) Buscamos el plan (por si después tenés 1, 3, 6 meses, etc.)
        let meses = 1; // por ahora un mes fijo
        const plan = await PlanNegocio.findByPk(planId);
        if (plan && plan.duracionMeses) {
          meses = plan.duracionMeses; // si existe el campo, lo usamos
        }

        // 👉 2) Buscamos el usuario-negocio para saber si ya tenía premium vigente
        const usuarioNegocio = await uUsuarioNegocio.findByPk(usuarioNegocioId);
        const ahora = new Date();

        let inicio;

        // Si ya tiene premium y NO venció, extendemos desde la fechaFin actual
        if (
          usuarioNegocio?.fechaFinPremium &&
          new Date(usuarioNegocio.fechaFinPremium) > ahora
        ) {
          inicio = new Date(usuarioNegocio.fechaFinPremium);
        } else {
          // Si no tenía o ya venció, arranca desde ahora
          inicio = ahora;
        }

        const fechaInicioPremium = inicio;
        const fechaFinPremium = new Date(inicio);
        fechaFinPremium.setMonth(fechaFinPremium.getMonth() + meses);

        // 👉 3) Marcamos al usuario-negocio como premium con fechas
        await uUsuarioNegocio.update(
          {
            esPremium: true,
            fechaInicioPremium,
            fechaFinPremium,
          },
          { where: { id: usuarioNegocioId } }
        );

        // 👉 4) Actualizamos todos los negocios de ese dueño al plan pagado
        await uNegocio.update(
          { planId },
          { where: { ownerId: usuarioNegocioId } }
        );

        console.log(
          `✅ Plan negocio aprobado. usuarioNegocioId=${usuarioNegocioId}, planId=${planId}, meses=${meses}, desde=${fechaInicioPremium.toISOString()}, hasta=${fechaFinPremium.toISOString()}`
        );
      } else {
        console.warn("⚠️ external_reference con formato raro:", externalReference);
      }
    } else {
      console.log("ℹ️ Pago no aprobado todavía o external_reference vacío.");
    }

    // SIEMPRE devolvés 200 a MP para que no reintente infinito
    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error en webhook MP:", err);
    // Devolvés 200 igual para no entrar en loop de reintentos
    return res.sendStatus(200);
  }
});

/**
 * GET /api/planes-negocio
 * Lista de planes para el frontend
 */
router.get("/", async (req, res) => {
  try {
    const planes = await PlanNegocio.findAll({
      order: [["precioMensual", "ASC"]],
    });
    res.json({ ok: true, planes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Error al obtener planes" });
  }
});

module.exports = router;

