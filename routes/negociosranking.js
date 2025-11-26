// routes/negociosranking.js
const express = require('express');
const router = express.Router();

const { uNegocio } = require('../models/model');
const { autenticarTokenNegocio } = require('../middlewares/authNegocio');

router.get('/ranking', autenticarTokenNegocio, async (req, res) => {
  try {
    const negocioId = req.negocio.id;

    // Traer TODOS ordenados por puntos
    const lista = await uNegocio.findAll({
      attributes: ['id', 'nombre', 'puntosMes'],
      order: [['puntosMes', 'DESC']],
    });

    if (!lista || lista.length === 0) {
      return res.json({
        negocioPropio: null,
        top3: [],
        faltanParaTop: null,
        faltanParaArriba: null,
      });
    }

    // Buscar el negocio del usuario
    const index = lista.findIndex(n => Number(n.id) === Number(negocioId));
    if (index === -1) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    const mi = lista[index];

    // → Cuántos puntos le faltan para pasar al de arriba
    let faltanParaArriba = null;
    if (index > 0) {
      const anterior = lista[index - 1];
      const diff = Number(anterior.puntosMes) - Number(mi.puntosMes);
      faltanParaArriba = diff > 0 ? diff : 0;
    }

    // → Top 3
    const top3 = lista.slice(0, 3).map((n, i) => ({
      id: n.id,
      nombre: n.nombre,
      puntosMes: Number(n.puntosMes || 0),
      posicion: i + 1,
    }));

    // → Cuántos puntos faltan para entrar al top3
    let faltanParaTop = null;
    if (top3.length === 3) {
      const tercero = top3[2];
      const diff = Number(tercero.puntosMes) - Number(mi.puntosMes);
      faltanParaTop = diff > 0 ? diff : 0;
    }

    res.json({
      negocioPropio: {
        id: mi.id,
        nombre: mi.nombre,
        puntosMes: Number(mi.puntosMes || 0),
        posicion: index + 1,
      },
      top3,
      faltanParaTop,
      faltanParaArriba,
    });

  } catch (err) {
    console.error("Error en /api/negocio/ranking:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/negocios/mis-negocios
router.get("/mis-negocios", autenticarTokenNegocio, async (req, res) => {
  try {
    const usuarioNegocioId = req.negocio.id;

    const negocios = await uNegocio.findAll({
      where: { ownerId: usuarioNegocioId },
    });

    return res.json({
      ok: true,
      negocios, // 👈 importante que se llame negocios o lista
    });
  } catch (err) {
    console.error("❌ GET /api/negocios/mis-negocios:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Error al obtener negocios" });
  }
});


module.exports = router;
