// routes/publicidadNegocio.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

const { PartnerPublicidad, TarifaPublicidad } = require("../models/model");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

// ✅ USUARIO COMÚN
const { autenticarUsuarioNegocio } = require("../middlewares/authUsuarioNegocio");

// ✅ Cloudinary + streamifier
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 🔐 Mercado Pago SDK
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});
const preferenceClient = new Preference(mpClient);
const paymentClient = new Payment(mpClient);

// helper
function getUsuarioIdFromReq(req) {
  // tu middleware deja req.negocio y req.user
  return req?.negocio?.id ?? req?.user?.id ?? null;
}

// ======================================================
// ✅ TARIFA ACTIVA (PUBLICA)
// GET /api/publicidad-negocio/tarifa
// ======================================================
router.get("/tarifa", async (req, res) => {
  try {
    const tarifa = await TarifaPublicidad.findOne({ where: { activo: true } });
    if (!tarifa) {
      return res.status(404).json({ ok: false, error: "No hay tarifa activa configurada." });
    }

    return res.json({
      ok: true,
      precioPorSemana: Number(tarifa.precioPorSemana),
      precioMinimo: tarifa.precioMinimo != null ? Number(tarifa.precioMinimo) : null,
    });
  } catch (error) {
    console.error("❌ Error obteniendo tarifa:", error);
    return res.status(500).json({ ok: false, error: "Error interno del servidor" });
  }
});

// ======================================================
// ✅ CREAR PUBLICIDAD (pendiente) + LINK MP
// POST /api/publicidad-negocio/crear
// Auth: usuario común
// ======================================================
router.post(
  "/crear",
  autenticarUsuarioNegocio,
  upload.single("imagen"),
  async (req, res) => {
    try {
      const usuarioId = getUsuarioIdFromReq(req);
      if (!usuarioId) {
        return res.status(401).json({ ok: false, error: "No autenticado" });
      }

      const { titulo, descripcion, urlWeb, telefono, whatsapp, lat, lng, semanas } = req.body;

      if (!titulo || !semanas) {
        return res
          .status(400)
          .json({ ok: false, error: "Faltan datos obligatorios (titulo, semanas)." });
      }

      const semanasNum = Number(semanas);
      if (!Number.isFinite(semanasNum) || semanasNum <= 0) {
        return res.status(400).json({ ok: false, error: "Semanas inválidas." });
      }

      const tarifa = await TarifaPublicidad.findOne({ where: { activo: true } });
      if (!tarifa) {
        return res
          .status(500)
          .json({ ok: false, error: "No hay tarifa activa configurada." });
      }

      const precioPorSemana = Number(tarifa.precioPorSemana);
      const monto = semanasNum * precioPorSemana;

      // ✅ URLs igual que planesNegocio.js (consistente)
      const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
      const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

      // fechas
      const fechaInicio = new Date();
      const fechaFin = new Date();
      fechaFin.setDate(fechaFin.getDate() + semanasNum * 7);

      // imagen opcional
      let imagenUrl = null;
      if (req.file) {
        const resultado = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "publicidades" },
            (error, result) => (result ? resolve(result) : reject(error))
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });

        // @ts-ignore (si estás en JS puro, ignorá esto)
        imagenUrl = resultado.secure_url;
      }

      // ✅ guardo en BD como pendiente
      const nuevaPublicidad = await PartnerPublicidad.create({
        negocioId: usuarioId,
        titulo,
        descripcion: descripcion || "",
        imagen: imagenUrl,
        urlWeb: urlWeb || "",
        telefono: telefono || "",
        whatsapp: whatsapp || "",
        lat: lat || null,
        lng: lng || null,
        duracionSemanas: semanasNum,
        fechaInicio,
        fechaFin,
        montoCobrado: monto,
        estadoPago: "pendiente",
        activo: false,
      });

      // external_reference robusto
      const externalReference = `publicidad-${nuevaPublicidad.id}-${usuarioId}`;

      // si existe la columna, perfecto; si no existe, esto te va a tirar error (ojo)
      await nuevaPublicidad.update({ externalReference });

      const mpResponse = await preferenceClient.create({
        body: {
          items: [
            {
              title: `Publicidad: ${titulo}`,
              quantity: 1,
              currency_id: "ARS",
              unit_price: monto,
            },
          ],

          // ✅ webhook a tu backend
          notification_url: `${BACKEND_URL}/api/publicidad-negocio/webhook`,

          // ✅ retorno al front
          back_urls: {
            success: `${FRONTEND_URL}/publicidad/success?id=${nuevaPublicidad.id}`,
            failure: `${FRONTEND_URL}/publicidad/failure?id=${nuevaPublicidad.id}`,
            pending: `${FRONTEND_URL}/publicidad/pending?id=${nuevaPublicidad.id}`,
          },

          auto_return: "approved",
          external_reference: externalReference,
        },
      });

      const pagoUrl = mpResponse.init_point || mpResponse.sandbox_init_point;

      return res.json({
        ok: true,
        pagoUrl,
        idPublicidad: nuevaPublicidad.id,
        monto,
      });
    } catch (error) {
      console.error("❌ Error creando publicidad:", error);
      return res.status(500).json({ ok: false, error: "Error interno del servidor" });
    }
  }
);


// ======================================================
// ✅ CONFIRMAR PAGO (NO DEPENDE DEL WEBHOOK)
// POST /api/publicidad-negocio/confirmar
// body: { paymentId, idPublicidad }
// Auth: usuario común
// ======================================================
router.post("/confirmar", autenticarUsuarioNegocio, async (req, res) => {
  try {
    const usuarioId = getUsuarioIdFromReq(req);
    if (!usuarioId) return res.status(401).json({ ok: false, error: "No autenticado" });

    const { paymentId, idPublicidad } = req.body;
    if (!paymentId || !idPublicidad) {
      return res.status(400).json({ ok: false, error: "Faltan paymentId o idPublicidad" });
    }

    const publicidad = await PartnerPublicidad.findByPk(Number(idPublicidad));
    if (!publicidad) return res.status(404).json({ ok: false, error: "Publicidad no encontrada" });

    // seguridad: la publicidad debe ser del usuario
    if (Number(publicidad.negocioId) !== Number(usuarioId)) {
      return res.status(403).json({ ok: false, error: "No autorizado" });
    }

    // consultar MP
    const pago = await paymentClient.get({ id: String(paymentId) });
    const status = pago?.status ?? pago?.body?.status;
    const externalReference = pago?.external_reference ?? pago?.body?.external_reference;

    const esperado = `publicidad-${publicidad.id}-${usuarioId}`;
    if (externalReference && externalReference !== esperado) {
      return res.status(400).json({ ok: false, error: "Pago no corresponde a esta publicidad" });
    }

    if (status !== "approved") {
      // marcar coherente
      if (status === "rejected" || status === "cancelled") {
        await publicidad.update({ estadoPago: "rechazado", activo: false });
      } else {
        await publicidad.update({ estadoPago: "pendiente", activo: false });
      }
      return res.json({ ok: true, aprobado: false, status });
    }

    // activar campaña
    await publicidad.update({
      estadoPago: "aprobado",
      activo: true,
      paymentId: String(paymentId),
      externalReference: externalReference || publicidad.externalReference || esperado,
    });

    return res.json({ ok: true, aprobado: true, publicidad });
  } catch (err) {
    console.error("❌ confirmar publicidad:", err);
    return res.status(500).json({ ok: false, error: "Error confirmando pago" });
  }
});

// ======================================================
// ✅ WEBHOOK (BACKUP)
// POST /api/publicidad-negocio/webhook
// ======================================================
router.post("/webhook", async (req, res) => {
  try {
    const evento = req.body;
    if (!evento?.data?.id) return res.sendStatus(200);

    const paymentId = evento.data.id;

    const pago = await paymentClient.get({ id: String(paymentId) });
    const status = pago?.status ?? pago?.body?.status;
    const externalReference = pago?.external_reference ?? pago?.body?.external_reference;

    if (!externalReference || !String(externalReference).startsWith("publicidad-")) {
      return res.sendStatus(200);
    }

    const parts = String(externalReference).split("-");
    const idPublicidad = Number(parts[1]);
    if (!idPublicidad) return res.sendStatus(200);

    const publicidad = await PartnerPublicidad.findByPk(idPublicidad);
    if (!publicidad) return res.sendStatus(200);

    if (status === "approved") {
      await publicidad.update({
        estadoPago: "aprobado",
        activo: true,
        paymentId: String(paymentId),
        externalReference: String(externalReference),
      });
    } else if (status === "rejected" || status === "cancelled") {
      await publicidad.update({
        estadoPago: "rechazado",
        activo: false,
        paymentId: String(paymentId),
        externalReference: String(externalReference),
      });
    } else {
      await publicidad.update({
        estadoPago: "pendiente",
        activo: false,
        paymentId: String(paymentId),
        externalReference: String(externalReference),
      });
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ WEBHOOK ERROR:", err);
    return res.sendStatus(500);
  }
});

// ======================================================
// ✅ LISTAR MIS CAMPAÑAS (SEGURO)
// GET /api/publicidad-negocio/mis-campanias
// Auth: usuario común
// ======================================================
router.get("/mis-campanias", autenticarUsuarioNegocio, async (req, res) => {
  try {
    const usuarioId = getUsuarioIdFromReq(req);
    if (!usuarioId) return res.status(401).json({ ok: false, error: "No autenticado" });

    const campanias = await PartnerPublicidad.findAll({
      where: { negocioId: usuarioId },
      order: [["createdAt", "DESC"]],
    });

    return res.json({ ok: true, campanias });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, error: "Error al obtener campañas" });
  }
});

module.exports = router;
