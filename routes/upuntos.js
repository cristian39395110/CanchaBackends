// routes/puntosNegocio
const express = require('express');
const router = express.Router();
const {uNegocio,RubroNegocio,uUsuarioNegocio} = require('../models/model'); // 👈 el que mostraste

// GET /api/puntos/lugares?lat=-33.3&lng=-66.3&radio=3000&categoria=...&soloPromo=1
// GET /api/puntosNegocio/categorias
router.get('/categorias', async (req, res) => {
  try {
    const rubros = await RubroNegocio.findAll({
      attributes: ['id', 'nombre', 'icono', 'orden'],
      include: [
        {
          model: uNegocio,
          attributes: [],
          where: { activo: true },
          required: true, // 👈 solo rubros que tengan al menos un negocio activo
        },
      ],
      group: ['RubroNegocio.id', 'RubroNegocio.nombre', 'RubroNegocio.icono', 'RubroNegocio.orden'],
      order: [
        ['orden', 'ASC'],
        ['nombre', 'ASC'],
      ],
    });
console.log(rubros)
    return res.json(rubros);
  } catch (err) {
    console.error('❌ Error al obtener categorías:', err);
    return res.status(500).json({ error: 'No se pudieron cargar las categorías' });
  }
});



router.get('/lugares', async (req, res) => {
  try {
    const { lat, lng, radio = 3000, categoria, soloPromo } = req.query;

    // Si no viene ubicación, no devolvemos nada
    if (!lat || !lng) return res.json([]);

    const LAT = Number(lat);
    const LNG = Number(lng);
    const RADIO_METROS = Number(radio);
    const R = 6371; // radio de la Tierra en km

    // 👇 SOLO negocios activos
    const where = {
      activo: true,
    };

    // 👇 si viene categoría distinta de 'todas' filtramos por rubroId
    if (categoria && categoria !== 'todas') {
      const rubroId = Number(categoria);
      if (!Number.isNaN(rubroId)) {
        where.rubroId = rubroId;
      }
    }

    // 👇 cargamos negocios:
    //   - activos
    //   - cuyo DUEÑO (uUsuarioNegocio) tiene esPremium = true
    const negocios = await uNegocio.findAll({
      where,
      include: [
        {
          model: uUsuarioNegocio,
          as: 'duenio',        // 👈 usa la asociación que ya definiste
          where: { esPremium: true }, // 🔥 dueño premium obligatorio
          attributes: [],      // no agregamos campos del dueño al resultado
          required: true,      // INNER JOIN: si no tiene dueño premium, no aparece
        },
      ],
      attributes: [
        'id',
        'nombre',
        ['rubro', 'categoria'],
        ['provincia', 'provincia'],
        ['localidad', 'localidad'],
        ['latitud', 'lat'],
        ['longitud', 'lng'],
        ['puntosPorCompra', 'puntosOtorga'],
        ['foto', 'fotoPerfil'],
        'planId',
        'activo',
        'rubroId',
      ],
      raw: true,
    });

    const toRad = (v) => (v * Math.PI) / 180;

    // 👇 interpretamos soloPromo (viene como string)
    const soloPromoBool =
      soloPromo === '1' || soloPromo === 'true' || soloPromo === 'on';

    const lista = negocios
      .map((n) => {
        const nLat = Number(n.lat);
        const nLng = Number(n.lng);
        if (Number.isNaN(nLat) || Number.isNaN(nLng)) return null;

        const dLat = toRad(nLat - LAT);
        const dLng = toRad(nLng - LNG);

        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(LAT)) *
            Math.cos(toRad(nLat)) *
            Math.sin(dLng / 2) ** 2;

        const distanciaKm =
          R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
        const distanciaM = distanciaKm * 1000;

        return {
          ...n,
          distancia: distanciaM,
          // Si querés que el filtro soloPromo funcione,
          // marcamos true para todos estos (son todos premium por dueño).
          tienePromo: true,
        };
      })
      .filter(Boolean)
      .filter((n) => n.distancia <= RADIO_METROS)
      .filter((n) => (!soloPromoBool ? true : n.tienePromo))
      .sort((a, b) => a.distancia - b.distancia);

    res.json(lista);
  } catch (err) {
    console.error('❌ Error en /api/puntosNegocio/lugares:', err);
    res.status(500).json({ error: 'Error al buscar lugares con puntos' });
  }
});




module.exports = router;



