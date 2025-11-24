// routes/puntosNegocio
const express = require('express');
const router = express.Router();
const Negocio = require('../models/uNegocio'); // 👈 el que mostraste

// GET /api/puntos/lugares?lat=-33.3&lng=-66.3&radio=3000&categoria=...&soloPromo=1
// GET /api/puntosNegocio/categorias
router.get('/categorias', async (req, res) => {
  try {
    // Traemos solo la columna "rubro"
    const rubros = await Negocio.findAll({
      attributes: ['rubro'],
      where: { activo: true },
      raw: true
    });

    // Extraemos, limpiamos y filtramos duplicados
    const categorias = Array.from(
      new Set(
        rubros
          .map(r => (r.rubro || '').toString().trim())
          .filter(r => r.length > 0)
      )
    );

    return res.json(categorias);
  } catch (err) {
    console.error('❌ Error al obtener categorías:', err);
    return res.status(500).json({ error: 'No se pudieron cargar las categorías' });
  }
});


router.get('/lugares', async (req, res) => {
  try {
    const { lat, lng, radio = 3000, categoria, soloPromo } = req.query;

    if (!lat || !lng) return res.json([]);

    const LAT = Number(lat);
    const LNG = Number(lng);
    const RADIO_METROS = Number(radio);
    const R = 6371;

    const where = { activo: true };
    if (categoria && categoria !== 'todas') where.rubro = categoria;

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
    ['foto', 'fotoPerfil'],   // 👈 alias para el front
    'planId',
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

        const distanciaKm = R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
        const distanciaM = distanciaKm * 1000;

        return {
          ...n,
          distancia: distanciaM,
          tienePromo: n.planId === 2 // 👈 ejemplo: 2 = premium
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



