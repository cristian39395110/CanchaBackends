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
      radio = 3000,     // puede venir 1000, 3000, 6000, 10000 o personalizado
      categoria,
      soloPromo
    } = req.query;

    if (!lat || !lng) return res.json([]);

    const LAT = Number(lat);
    const LNG = Number(lng);
    const RADIO_METROS = Number(radio);
    const R = 6371; // radio de la Tierra en km

    // Armamos el filtro base
    const where = { activo: true };
    if (categoria && categoria !== 'todas') {
      where.rubro = categoria;
    }

    const negocios = await Negocio.findAll({
      where,
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

    const toRad = (v) => (v * Math.PI) / 180;

    const lista = negocios
      .map((n) => {
        const nLat = Number(n.lat);
        const nLng = Number(n.lng);
        if (isNaN(nLat) || isNaN(nLng)) return null;

        const dLat = toRad(nLat - LAT);
        const dLng = toRad(nLng - LNG);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(LAT)) *
            Math.cos(toRad(nLat)) *
            Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanciaKm = R * c;
        const distanciaM = distanciaKm * 1000;

        return {
          ...n,
          distancia: distanciaM,
          tienePromo: n.plan === 'premium' // ejemplo: sólo los premium tienen promo
        };
      })
      .filter(Boolean)
      .filter((n) => n.distancia <= RADIO_METROS)
      .filter((n) => (!soloPromo ? true : n.tienePromo))
      .sort((a, b) => a.distancia - b.distancia);

    res.json(lista);
  } catch (err) {
    console.error('❌ Error en /api/puntosNegocio/lugares:', err);
    res.status(500).json({ error: 'Error al buscar lugares con puntos' });
  }
});

module.exports = router;



