
// routes/planesNegocio.js
const express = require("express");
const router = express.Router();

const { PlanNegocio, uNegocio, uUsuarioNegocio } = require("../models/model");

// SDK nuevo de MercadoPago
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");


const {autenticarUsuarioNegocio } = require("../middlewares/authUsuarioNegocio");

// ⚙️ Config MP (poné tu access token en .env)
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// Clientes para crear preferencias y leer pagos
const preferenceClient = new Preference(mpClient);
const paymentClient = new Payment(mpClient);



router.get("/mi-plan", autenticarUsuarioNegocio, async (req, res) => {
  try {
    const usuarioNegocioId = req.negocio.id;

    const usuario = await uUsuarioNegocio.findByPk(usuarioNegocioId);
    if (!usuario) return res.status(404).json({ ok:false, error:"Usuario no encontrado" });


    // 1) Buscamos negocio del dueño
    const negocio = await uNegocio.findOne({
      where: { ownerId: usuarioNegocioId },
    });

    // función helper para pasar fecha a string ISO (o null)
    const getVenceEl = () => {
      if (!usuario?.fechaFinPremium) return null;
       
      return usuario.fechaFinPremium; // si ya es Date en Sequelize, se serializa solo
    };

    // 🚩 Caso: no tiene negocio, pero es premium (ya pagó)
    if (!negocio) {
      if (usuario?.esPremium) {
        return res.json({
          ok: true,
          planActual: {
            id: 1, // tu único plan básico
            nombre: "Plan Básico",
            venceEl: getVenceEl(),   // 👈 ahora sí
            activo: true,
          },
        });
      }
      return res.json({ ok: true, planActual: null });
    }

    // 3) Tiene negocio, miramos el plan
    let plan = null;
    if (negocio.planId) {
      plan = await PlanNegocio.findByPk(negocio.planId);
    }

    if (!plan) {
      return res.json({
        ok: true,
        planActual: null,
      });
    }

    const planActual = {
      id: plan.id,
      nombre: plan.nombre,
      venceEl: getVenceEl(), // 👈 usar fechaFinPremium del usuario
      activo: !!usuario?.esPremium,
    };

    return res.json({ ok: true, planActual });
  } catch (err) {
    console.error("❌ GET /api/planes-negocio/mi-plan:", err);
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
         success: `${FRONTEND_URL}/planes-negocio?mp=success`,
  failure: `${FRONTEND_URL}/planes-negocio?mp=failure`,
  pending: `${FRONTEND_URL}/planes-negocio?mp=pending`,
      },
    

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

router.post("/confirmar", autenticarUsuarioNegocio, async (req, res) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ ok: false, error: "Falta paymentId" });

    const pago = await paymentClient.get({ id: String(paymentId) });
    const status = pago?.status ?? pago?.body?.status;
    const externalReference =
      pago?.external_reference ?? pago?.body?.external_reference;

    if (!externalReference || !externalReference.startsWith("negocio-plan-")) {
      return res.status(400).json({ ok: false, error: "external_reference inválido" });
    }

    // negocio-plan-<usuarioNegocioId>-<planId>
    const parts = externalReference.split("-");
    const usuarioNegocioId = Number(parts[2]);
    const planId = Number(parts[3]);

    // seguridad: el que confirma debe ser el mismo dueño logueado
    if (req.negocio.id !== usuarioNegocioId) {
      return res.status(403).json({ ok: false, error: "No autorizado" });
    }

    // Si NO está aprobado, NO activar nada
    if (status !== "approved") {
      return res.json({ ok: true, aprobado: false, status });
    }

    // Activar (misma lógica que webhook)
    let meses = 1;
    const plan = await PlanNegocio.findByPk(planId);
    if (plan?.duracionMeses) meses = Number(plan.duracionMeses) || 1;

    const usuarioNegocio = await uUsuarioNegocio.findByPk(usuarioNegocioId);
    const ahora = new Date();

    let inicio = ahora;
    if (usuarioNegocio?.fechaFinPremium && new Date(usuarioNegocio.fechaFinPremium) > ahora) {
      inicio = new Date(usuarioNegocio.fechaFinPremium);
    }

    const fechaInicioPremium = inicio;
    const fechaFinPremium = new Date(inicio);
    fechaFinPremium.setMonth(fechaFinPremium.getMonth() + meses);

    await uUsuarioNegocio.update(
      { esPremium: true, fechaInicioPremium, fechaFinPremium },
      { where: { id: usuarioNegocioId } }
    );

    await uNegocio.update({ planId }, { where: { ownerId: usuarioNegocioId } });

    return res.json({ ok: true, aprobado: true });
  } catch (err) {
    console.error("❌ confirmar:", err);
    return res.status(500).json({ ok: false, error: "Error confirmando pago" });
  }
});


/**
 * POST /api/planes-negocio/webhook
 * Webhook que recibe las notificaciones de MercadoPago.
 * IMPORTANTE: configurá esta URL en la preferencia (notification_url)
 * y/o en el panel de credenciales de MercadoPago.
 */
router.all("/webhook", async (req, res) => {
  try {
    console.log("🔔 Webhook MP recibido:", {
      query: req.query,
      body: req.body,
    });

    // MP puede mandar el ID por query o por body (según configuración / versión)
    const paymentId =
      req.query["data.id"] ||
      req.query.id ||
      req.body?.data?.id ||
      req.body?.id;

    // A veces MP manda type/topic
    const type = req.query.type || req.query.topic || req.body?.type;

    // Si no es payment, igual devolvemos 200
    if (type && type !== "payment") {
      console.log("ℹ️ Webhook ignorado (no es payment):", type);
      return res.sendStatus(200);
    }

    if (!paymentId) {
      console.log("ℹ️ Webhook sin paymentId, respondo 200 igual.");
      return res.sendStatus(200);
    }

    // Consultamos el pago en MP (id como string por las dudas)
    const pago = await paymentClient.get({ id: String(paymentId) });

    const status = pago?.status ?? pago?.body?.status;
    const externalReference =
      pago?.external_reference ?? pago?.body?.external_reference;

    console.log("💳 Pago consultado:", {
      paymentId,
      status,
      externalReference,
    });

    // Solo actuamos si aprobado y es nuestro formato
    if (
      status !== "approved" ||
      !externalReference ||
      !externalReference.startsWith("negocio-plan-")
    ) {
      console.log("ℹ️ Pago no aprobado todavía o external_reference no válido.");
      return res.sendStatus(200);
    }

    // formato esperado: negocio-plan-<usuarioNegocioId>-<planId>
    const parts = externalReference.split("-");
    const usuarioNegocioId = Number(parts[2]);
    const planId = Number(parts[3]);

    if (!usuarioNegocioId || !planId) {
      console.warn("⚠️ external_reference con formato raro:", externalReference);
      return res.sendStatus(200);
    }

    // 1) Traemos plan para duración (si existe)
    let meses = 1;
    const plan = await PlanNegocio.findByPk(planId);
    if (plan?.duracionMeses) meses = Number(plan.duracionMeses) || 1;

    // 2) Traemos usuario negocio y calculamos fechas
    const usuarioNegocio = await uUsuarioNegocio.findByPk(usuarioNegocioId);
    const ahora = new Date();

    let inicio = ahora;

    if (
      usuarioNegocio?.fechaFinPremium &&
      new Date(usuarioNegocio.fechaFinPremium) > ahora
    ) {
      // si aún estaba vigente, extendemos desde la fecha fin actual
      inicio = new Date(usuarioNegocio.fechaFinPremium);
    }

    const fechaInicioPremium = inicio;
    const fechaFinPremium = new Date(inicio);
    fechaFinPremium.setMonth(fechaFinPremium.getMonth() + meses);

    // 3) Actualizamos usuario (premium + fechas)
    await uUsuarioNegocio.update(
      {
        esPremium: true,
        fechaInicioPremium,
        fechaFinPremium,
      },
      { where: { id: usuarioNegocioId } }
    );

    // 4) Actualizamos negocios del dueño al plan pagado
    await uNegocio.update({ planId }, { where: { ownerId: usuarioNegocioId } });

    console.log(
      `✅ Plan aprobado. usuarioNegocioId=${usuarioNegocioId}, planId=${planId}, meses=${meses}, desde=${fechaInicioPremium.toISOString()}, hasta=${fechaFinPremium.toISOString()}`
    );

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error en webhook MP:", err);
    // Siempre 200 para evitar reintentos infinitos
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

