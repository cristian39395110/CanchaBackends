// routes/upublicidadNegocio.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

const { PartnerPublicidad, TarifaPublicidad } = require("../models/model");
const { MercadoPagoConfig, Preference } = require("mercadopago");
const { autenticarTokenNegocio } = require('../middlewares/authNegocio');

// ✅ Cloudinary + streamifier (igual que en usuarios)
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 🔐 Mercado Pago SDK Nuevo
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// ======================================================
// 📌 CREAR PUBLICIDAD (RECIBE FORM-DATA)
// ======================================================
// POST /api/publicidad-negocio/forzar-pago
router.post("/forzar-pago", autenticarTokenNegocio, async (req, res) => {
  try {
    const { idPublicidad } = req.body;


    const publicidad = await PartnerPublicidad.findByPk(idPublicidad);
    if (!publicidad) {
      return res.status(404).json({ ok: false, error: "Publicidad no encontrada" });
    }

    publicidad.estadoPago = "approved";
    publicidad.activo = true;
    await publicidad.save();

    return res.json({ ok: true, mensaje: "Pago forzado como aprobado", publicidad });
  } catch (err) {
    console.error("Error forzar pago:", err);
    return res.status(500).json({ ok: false, error: "Error interno" });
  }
});



router.post(
  "/crear",
  autenticarTokenNegocio,
  upload.single("imagen"),
  async (req, res) => {
    try {
      console.log("BODY RECIBIDO:", req.body);
      console.log("FILE RECIBIDO:", req.file);

      const usuarioId =
        req.usuarioNegocioId ??
        req.user?.usuarioNegocioId ??
        req.negocio?.id ??
        null;

      const negocioId = usuarioId;

      const {
        titulo,
        descripcion,
        urlWeb,
        telefono,
        whatsapp,
        lat,
        lng,
        semanas,
      } = req.body;

      // ⚠️ Validación
      if (!negocioId || !titulo || !semanas) {
        return res
          .status(400)
          .json({ ok: false, error: "Faltan datos obligatorios." });
      }

      const semanasNum = Number(semanas);

      // 📌 Buscar tarifa activa
      const tarifa = await TarifaPublicidad.findOne({ where: { activo: true } });
      if (!tarifa) {
        return res
          .status(500)
          .json({ ok: false, error: "No hay tarifa activa configurada." });
      }

      const precioPorSemana = Number(tarifa.precioPorSemana);
      const monto = semanasNum * precioPorSemana;

      // 📅 Fechas
      const fechaInicio = new Date();
      const fechaFin = new Date();
      fechaFin.setDate(fechaFin.getDate() + semanasNum * 7);

      // 🖼️ Subida de imagen opcional
      let imagenUrl = null;

      if (req.file) {
        const resultado = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "publicidades" },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });

        imagenUrl = resultado.secure_url;
      }

      // 💾 Crear registro en la BD en estado pendiente
      const nuevaPublicidad = await PartnerPublicidad.create({
        negocioId,
        titulo,
        descripcion,
        imagen: imagenUrl,
        urlWeb,
        telefono,
        whatsapp,
        lat: lat || null,
        lng: lng || null,
        duracionSemanas: semanasNum,
        fechaInicio,
        fechaFin,
        montoCobrado: monto,
        estadoPago: "pendiente",
        activo: false, // se activa cuando MP avisa "approved"
      });

      // 🧾 Generar preferencia de pago
      const preference = new Preference(mpClient);

      const mpResponse = await preference.create({
        body: {
          items: [
            {
              title: `Publicidad: ${titulo}`,
              quantity: 1,
              currency_id: "ARS",
              unit_price: monto,
            },
          ],
          notification_url: `${process.env.API_URL}/api/publicidad-negocio/webhook`,
          back_urls: {
            success: `${process.env.FRONT_URL}/publicidad/success?id=${nuevaPublicidad.id}`,
            failure: `${process.env.FRONT_URL}/publicidad/failure`,
            pending: `${process.env.FRONT_URL}/publicidad/pending`,
          },
          auto_return: "approved",
          external_reference: String(nuevaPublicidad.id),
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
      return res
        .status(500)
        .json({ ok: false, error: "Error interno del servidor" });
    }
  }
);

// ======================================================
// 📌 WEBHOOK MERCADOPAGO (SDK NUEVO)
// ======================================================
router.post("/webhook", async (req, res) => {
  try {
    const evento = req.body;

    if (!evento || !evento.data || !evento.data.id) {
      return res.sendStatus(200);
    }

    const paymentId = evento.data.id;

    const resp = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      }
    );

    const pagoInfo = await resp.json();

    const status = pagoInfo.status;
    const external_reference = pagoInfo.external_reference;

    if (!external_reference) return res.sendStatus(200);

    const publicidad = await PartnerPublicidad.findByPk(external_reference);
    if (!publicidad) return res.sendStatus(200);

    if (status === "approved") {
      publicidad.estadoPago = "aprobado";
      publicidad.activo = true;
      await publicidad.save();
    } else {
      publicidad.estadoPago = "rechazado";
      await publicidad.save();
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ WEBHOOK ERROR:", err);
    return res.sendStatus(500);
  }
});

// ======================================================
// 📌 LISTAR CAMPAÑAS DE UN NEGOCIO
// ======================================================
router.get("/mis-campanias/:negocioId", async (req, res) => {
  try {
    const { negocioId } = req.params;

    const campanias = await PartnerPublicidad.findAll({
      where: { negocioId },
      order: [["createdAt", "DESC"]],
    });

    return res.json({ ok: true, campanias });
  } catch (error) {
    console.error(error);
    return res.json({ ok: false, error: "Error al obtener campañas" });
  }
});


// ======================================================
// 📌 OBTENER TARIFA ACTIVA
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


module.exports = router;
