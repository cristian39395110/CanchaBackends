// routes/puntos.js
const express = require('express');
const router = express.Router();
const Negocio = require('../models/uNegocio'); // 👈 el que mostraste

// GET /api/puntos/lugares?lat=-33.3&lng=-66.3&radio=3000&categoria=...&soloPromo=1
router.get('/lugares', async (req, res) => {
  try {
    const {
      lat,
      lng,
      radio = 3000,          // metros
      categoria,             // opcional
      soloPromo              // opcional (1 ó true)
    } = req.query;

    // si no hay lat/lng, devolvé vacío
    if (!lat || !lng) {
      return res.json([]);
    }

    // pasamos a número
    const LAT = Number(lat);
    const LNG = Number(lng);
    const RADIO_METROS = Number(radio);
    const RADIO_KM = RADIO_METROS / 1000;

    // armamos WHERE básico
    const where = { activo: true };
    if (categoria) {
      // tu modelo lo llama "rubro"
      where.rubro = categoria;
    }

    // traigo TODO lo que está activo, y después filtro por distancia
    const negocios = await Negocio.findAll({
      where,
      // solo lo que necesitamos
      attributes: [
        'id',
        'nombre',
        ['rubro', 'categoria'],
        ['provincia', 'provincia'],
        ['localidad', 'localidad'],
        ['latitud', 'lat'],
        ['longitud', 'lng'],
        ['puntosPorCompra', 'puntosOtorga'],
        ['plan', 'plan'],
        'activo'
      ],
      raw: true
    });

    // función para calcular distancia
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371; // km

    const lista = negocios
      .map((n) => {
        const nLat = Number(n.lat);
        const nLng = Number(n.lng);
        if (!nLat || !nLng) return null;

        const dLat = toRad(nLat - LAT);
        const dLng = toRad(nLng - LNG);

        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(LAT)) *
            Math.cos(toRad(nLat)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanciaKm = R * c;
        const distanciaM = distanciaKm * 1000;

        return {
          ...n,
          distancia: distanciaM,
          // si querés marcar promo solo a los premium:
          tienePromo: n.plan === 'premium'
        };
      })
      .filter(Boolean) // saco nulls
      // filtro por radio
      .filter((n) => n.distancia <= RADIO_METROS)
      // si pidió soloPromo
      .filter((n) => {
        if (!soloPromo) return true;
        return n.tienePromo;
      })
      // orden por distancia
      .sort((a, b) => a.distancia - b.distancia);

    res.json(lista);
  } catch (err) {
    console.error('❌ Error en /api/puntos/lugares:', err);
    res.status(500).json({ error: 'Error al buscar lugares con puntos' });
  }
});

module.exports = router;
