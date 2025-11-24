// routes/promoNegocio.js
const express = require('express');
const { Op } = require('sequelize');
const { uPromoNegocio, uNegocio } = require('../models/model');
const { autenticarTokenNegocio } = require('../middlewares/authNegocio');

const router = express.Router();

// =================== Helpers ===================

// Validar porcentajes 1–100
function validarPorcentaje(n) {
  return Number.isFinite(n) && n >= 1 && n <= 100;
}

// Distancia Haversine en km
function distanciaKm(lat1, lon1, lat2, lon2) {
  const toRad = v => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ===============================================
// GET /api/promoNegocio/vigentes?lat&lng&radio&rubro
// Devuelve negocios con promos vigentes cerca tuyo
// ===============================================
router.get('/vigentes', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    // soportamos radio y radioKm
    const radioKm =
      Number(req.query.radio) ||
      Number(req.query.radioKm) ||
      3;

    const rubro =
      req.query.rubro && req.query.rubro !== 'todos'
        ? String(req.query.rubro)
        : null;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat/lng inválidos' });
    }

    const now = new Date();

    const whereNegocio = {
      activo: true,
      latitud: { [Op.ne]: null },
      longitud: { [Op.ne]: null },
    };

    if (rubro) {
      whereNegocio.rubro = rubro;
    }

    const negocios = await uNegocio.findAll({
      where: whereNegocio,
      include: [
        {
          model: uPromoNegocio,
          as: 'uPromoNegocios',   // 👈 alias CORRECTO
          where: {
            activa: true,
            visibilidad: 'publica',
            desde: { [Op.lte]: now },
            hasta: { [Op.gte]: now },
          },
          required: true,
        },
      ],
    });

    const resultado = [];

    for (const negocio of negocios) {
      const nLat = Number(negocio.latitud);
      const nLng = Number(negocio.longitud);
      if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) continue;

      const dKm = distanciaKm(lat, lng, nLat, nLng);
      if (dKm > radioKm) continue;

      // 👇 OJO: ahora las promos vienen en negocio.uPromoNegocios
      const promos = (negocio.uPromoNegocios || []).slice();

      // ordenamos por prioridad y fecha de fin
      promos.sort((a, b) => {
        const pa = a.prioridad || 0;
        const pb = b.prioridad || 0;
        if (pa !== pb) return pb - pa;
        return new Date(a.hasta) - new Date(b.hasta);
      });

      const top = promos.slice(0, 3).map((p) => ({
        id: p.id,
        titulo: p.titulo,
        tipo: p.tipo,
        porcentajePuntos: p.porcentajePuntos,
        porcentajeDescuento: p.porcentajeDescuento,
      }));

      resultado.push({
        negocioId: negocio.id,
        nombre: negocio.nombre,
        rubro: negocio.rubro || null,
        lat: nLat,
        lng: nLng,
        distancia: dKm,
        totalOfertas: promos.length,
        promosResumen: top,
      });
    }

    // orden final por cercanía
    resultado.sort((a, b) => a.distancia - b.distancia);

    res.json(resultado);
  } catch (err) {
    console.error('Error en GET /api/promoNegocio/vigentes:', err);
    res.status(500).json({ error: 'Error al obtener promos cercanas' });
  }
});

// ===============================================
// POST /api/promoNegocio
// Crea una promo para el negocio logueado
// ===============================================
router.post('/', autenticarTokenNegocio, async (req, res) => {
  try {
    const negocioId = req.negocio?.id || req.negocioId;
    if (!negocioId) {
      return res.status(401).json({ error: 'Negocio no autenticado' });
    }

    const {
      titulo,
      descripcion,
      tipo,
      desde,
      hasta,
      porcentajePuntos,
      porcentajeDescuento,
      prioridad,
      visibilidad,
    } = req.body;

    if (!titulo || !tipo || !desde || !hasta) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const d1 = new Date(desde);
    const d2 = new Date(hasta);
    if (!d1.getTime() || !d2.getTime() || d1 >= d2) {
      return res.status(400).json({ error: 'Rango de fechas inválido' });
    }

    if (tipo === 'puntos') {
      const n = Number(porcentajePuntos);
      if (!validarPorcentaje(n)) {
        return res
          .status(400)
          .json({ error: 'Porcentaje de puntos inválido (1–100)' });
      }
    }

    if (tipo === 'descuento') {
      const n = Number(porcentajeDescuento);
      if (!validarPorcentaje(n)) {
        return res
          .status(400)
          .json({ error: 'Porcentaje de descuento inválido (1–100)' });
      }
    }

    const promo = await uPromoNegocio.create({
      negocioId,
      titulo: String(titulo).trim(),
      descripcion: descripcion ? String(descripcion).trim() : null,
      tipo,
      desde: d1,
      hasta: d2,
      porcentajePuntos:
        tipo === 'puntos' ? Number(porcentajePuntos) || null : null,
      porcentajeDescuento:
        tipo === 'descuento' ? Number(porcentajeDescuento) || null : null,
      prioridad: Number.isFinite(Number(prioridad)) ? Number(prioridad) : 0,
      visibilidad: visibilidad || 'publica',
      activa: true,
    });

    res.status(201).json(promo);
  } catch (err) {
    console.error('Error creando promo negocio:', err);
    res.status(500).json({ error: 'Error al crear la promoción' });
  }
});

// ===============================================
// GET /api/promoNegocio/mias
// Lista promos del negocio logueado
// ===============================================
router.get('/mias', autenticarTokenNegocio, async (req, res) => {
  try {
    const negocioId = req.negocio?.id || req.negocioId;
    if (!negocioId) {
      return res.status(401).json({ error: 'Negocio no autenticado' });
    }

    const soloVigentes =
      String(req.query.soloVigentes || '').toLowerCase() === 'true';
    const now = new Date();

    const where = { negocioId };

    if (soloVigentes) {
      where.activa = true;
      where.visibilidad = 'publica';
      where.desde = { [Op.lte]: now };
      where.hasta = { [Op.gte]: now };
    }

    const promos = await uPromoNegocio.findAll({
      where,
      order: [
        ['activa', 'DESC'],
        ['prioridad', 'DESC'],
        ['hasta', 'ASC'],
      ],
    });

    res.json(promos);
  } catch (err) {
    console.error('Error listando promos propias:', err);
    res.status(500).json({ error: 'Error al listar promociones' });
  }
});

// ===============================================
// GET /api/promoNegocio/negocio/:negocioId/vigentes
// Lista promos vigentes de un negocio específico
// ===============================================
router.get('/negocio/:negocioId/vigentes', async (req, res) => {
  try {
    const { negocioId } = req.params;
    const now = new Date();

    const promos = await uPromoNegocio.findAll({
      where: {
        negocioId: Number(negocioId),
        activa: true,
        visibilidad: 'publica',
        desde: { [Op.lte]: now },
        hasta: { [Op.gte]: now },
      },
      order: [
        ['prioridad', 'DESC'],
        ['hasta', 'ASC'],
      ],
    });

    res.json(promos);
  } catch (err) {
    console.error('Error listando promos de negocio:', err);
    res
      .status(500)
      .json({ error: 'Error al obtener las promociones del negocio' });
  }
});

// ===============================================
// GET /api/promoNegocio/cerca?lat=...&lng=...&radioKm=...
// Lista negocios con promos vigentes cerca
// ===============================================
router.get('/cerca', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radioKm = Number(req.query.radioKm) || 10;
    const now = new Date();

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat y lng son obligatorios' });
    }

    const negocios = await uNegocio.findAll({
      where: {
        activo: true,
        latitud: { [Op.ne]: null },
        longitud: { [Op.ne]: null },
      },
      include: [
        {
          model: uPromoNegocio,
          as: 'promos',
          where: {
            activa: true,
            visibilidad: 'publica',
            desde: { [Op.lte]: now },
            hasta: { [Op.gte]: now },
          },
          required: true,
        },
      ],
    });

    const resultado = [];

    for (const negocio of negocios) {
      const nLat = Number(negocio.latitud);
      const nLng = Number(negocio.longitud);
      if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) continue;

      const dKm = distanciaKm(lat, lng, nLat, nLng);
      if (dKm > radioKm) continue;

      const promos = (negocio.promos || []).slice();

      promos.sort((a, b) => {
        const pa = a.prioridad || 0;
        const pb = b.prioridad || 0;
        if (pa !== pb) return pb - pa;
        return new Date(a.hasta) - new Date(b.hasta);
      });

      const top = promos.slice(0, 3).map(p => ({
        id: p.id,
        titulo: p.titulo,
        tipo: p.tipo,
        porcentajePuntos: p.porcentajePuntos,
        porcentajeDescuento: p.porcentajeDescuento,
      }));

      resultado.push({
        negocioId: negocio.id,
        nombre: negocio.nombre,
        rubro: negocio.rubro || null,
        lat: nLat,
        lng: nLng,
        distancia: dKm,
        totalOfertas: promos.length,
        promosResumen: top,
      });
    }

    resultado.sort((a, b) => a.distancia - b.distancia);

    res.json(resultado);
  } catch (err) {
    console.error('Error en /promoNegocio/cerca:', err);
    res.status(500).json({ error: 'Error al obtener promociones cercanas' });
  }
});

module.exports = router;
