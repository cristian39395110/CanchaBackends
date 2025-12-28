// routes/partners.js
const express = require('express');
const router = express.Router();
const { PartnerPublicidad } = require('../models/model');
// si tenés auth de admin, lo podés usar después
// const { autenticarTokenNegocio } = require('../middlewares/authNegocio');
// const { soloAdminNegocio } = require('../middlewares/soloAdminNegocio');

// GET /api/partners  → lista de publicidades activas para el carrusel
const { Op } = require("sequelize");

router.get("/", async (req, res) => {
  try {
    const hoy = new Date();

    const partners = await PartnerPublicidad.findAll({
      where: {
        activo: true,
        estadoPago: "aprobado",
        fechaInicio: { [Op.lte]: hoy },
        fechaFin: { [Op.gte]: hoy },
      },
      order: [["prioridad", "DESC"], ["createdAt", "DESC"]],
      attributes: [
        "id",
        "titulo",
        "descripcion",
        "imagen",
        "urlWeb",
        "telefono",
        "whatsapp",
        "lat",
        "lng",
        "badge",
      ],
    });

    res.json(partners);
  } catch (err) {
    console.error("❌ GET /api/partners", err);
    res.status(500).json({ error: "No se pudieron obtener las publicidades" });
  }
});


// GET /api/partners/destacado  → uno solo "del mes"
router.get('/destacado', async (req, res) => {
  try {
    const dest = await PartnerPublicidad.findOne({
      where: { activo: true, esDestacadoMes: true },
      order: [['updatedAt', 'DESC']],
      attributes: [
        'id',
        'titulo',
        'descripcion',
        'imagen',
        'lat',
        'lng',
      ],
    });

    if (!dest) return res.json(null);

    res.json(dest);
  } catch (err) {
    console.error('❌ GET /api/partners/destacado', err);
    res.status(500).json({ error: 'No se pudo obtener el destacado del mes' });
  }
});

module.exports = router;
