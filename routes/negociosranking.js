// routes/negociosranking.js
const express = require('express');
const router = express.Router();

const { uNegocio,uCheckinNegocio } = require('../models/model');
const { autenticarTokenNegocio } = require('../middlewares/authNegocio');
const { autenticarUsuarioNegocio } = require("../middlewares/authUsuarioNegocio");
const { Op } = require('sequelize');

// GET /api/negocios/ranking
router.get("/ranking", autenticarTokenNegocio, async (req, res) => {
  try {
    // ✅ req.negocio.id ES el id del usuario (dueño), o sea ownerId
    const ownerId = req.negocio.id;

    // ✅ 1) Buscar MI negocio (solo 1 negocio por dueño)
    const miNegocio = await uNegocio.findOne({
      where: { ownerId },
      attributes: ["id", "nombre", "puntosMes"],
    });

    if (!miNegocio) {
      return res.status(404).json({ error: "No tenés un negocio asociado" });
    }

    const miNegocioId = miNegocio.id;

    // ✅ 2) Traer TODOS los negocios ordenados por puntosMes (ranking global)
    const lista = await uNegocio.findAll({
      attributes: ["id", "nombre", "puntosMes"],
      order: [["puntosMes", "DESC"]],
    });

    if (!lista || lista.length === 0) {
      return res.json({
        negocioPropio: null,
        top3: [],
        faltanParaTop: null,
        faltanParaArriba: null,
      });
    }

    // ✅ 3) Buscar mi negocio dentro del ranking global por ID REAL de negocio
    const index = lista.findIndex((n) => Number(n.id) === Number(miNegocioId));
    if (index === -1) {
      return res.status(404).json({ error: "Negocio no encontrado en ranking" });
    }

    const mi = lista[index];

    // ✅ 4) Cuántos puntos le faltan para pasar al de arriba
    let faltanParaArriba = null;
    if (index > 0) {
      const anterior = lista[index - 1];
      const diff = Number(anterior.puntosMes || 0) - Number(mi.puntosMes || 0);
      faltanParaArriba = diff > 0 ? diff : 0;
    }

    // ✅ 5) Top 3
    const top3 = lista.slice(0, 3).map((n, i) => ({
      id: n.id,
      nombre: n.nombre,
      puntosMes: Number(n.puntosMes || 0),
      posicion: i + 1,
    }));

    // ✅ 6) Cuántos puntos faltan para entrar al top 3
    let faltanParaTop = null;
    if (top3.length === 3) {
      const tercero = top3[2];
      const diff = Number(tercero.puntosMes || 0) - Number(mi.puntosMes || 0);
      faltanParaTop = diff > 0 ? diff : 0;
    }

    // ✅ 7) Respuesta final
    return res.json({
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
    console.error("Error en /api/negocios/ranking:", err);
    return res.status(500).json({ error: "Error interno" });
  }
});

router.get("/ranking-propio", autenticarUsuarioNegocio, async (req, res) => {
  try {
    const usuarioNegocioId = req.negocio.id; // viene del middleware

    // 1) Buscar el negocio del dueño (ownerId = usuarioNegocioId)
    const negocio = await uNegocio.findOne({
      where: { ownerId: usuarioNegocioId },
      attributes: ["id", "nombre", "rubroId"],
    });

    if (!negocio) {
      return res.status(404).json({ error: "No tenés ningún negocio asociado" });
    }

    const negocioId = negocio.id;

    // 2) Rango fechas mes actual y mes anterior
    const ahora = new Date();

    const inicioMesActual = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const finMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth(), 0); // día 0 = último día mes anterior

    // 3) Puntos del mes actual (sumando checkins)
    const puntosMesActual =
      (await uCheckinNegocio.sum("puntosGanados", {
        where: {
          negocioId,
          createdAt: {
            [Op.between]: [inicioMesActual, ahora],
          },
        },
      })) || 0;

    // 4) Puntos del mes anterior
    const puntosMesAnterior =
      (await uCheckinNegocio.sum("puntosGanados", {
        where: {
          negocioId,
          createdAt: {
            [Op.between]: [inicioMesAnterior, finMesAnterior],
          },
        },
      })) || 0;

    // 5) Meta mensual (puede ser campo nuevo en la tabla uNegocio, si querés)
    //    Estrategia: si hay datos del mes anterior => meta = +20%,
    //    si no hay nada => meta fija 1000 para arrancar.
    let metaPuntos;
    if (puntosMesAnterior > 0) {
      metaPuntos = Math.round(puntosMesAnterior * 1.2); // +20%
    } else {
      metaPuntos = 1000; // valor base para arrancar
    }

    // 6) Progreso hacia la meta
    let progresoPorcentaje = null;
    let faltanPuntos = null;

    if (metaPuntos > 0) {
      progresoPorcentaje = Math.round((puntosMesActual * 100) / metaPuntos);
      if (progresoPorcentaje > 100) progresoPorcentaje = 100;
      faltanPuntos = Math.max(0, metaPuntos - puntosMesActual);
    }

    // 7) Crecimiento vs mes anterior
    let crecimientoPorcentaje = null;
    if (puntosMesAnterior > 0) {
      crecimientoPorcentaje = Math.round(
        ((puntosMesActual - puntosMesAnterior) / puntosMesAnterior) * 100
      );
    }

    // 8) Respuesta
    return res.json({
      negocio: {
        id: negocio.id,
        nombre: negocio.nombre,
        rubroId: negocio.rubroId,
      },
      mesActual: {
        desde: inicioMesActual.toISOString(),
        hasta: ahora.toISOString(),
        puntos: puntosMesActual,
      },
      mesAnterior: {
        desde: inicioMesAnterior.toISOString(),
        hasta: finMesAnterior.toISOString(),
        puntos: puntosMesAnterior,
      },
      meta: {
        objetivoPuntos: metaPuntos,
        progresoPorcentaje, // 0–100
        faltanPuntos,
      },
      crecimiento: {
        porcentaje: crecimientoPorcentaje, // puede ser negativo, null si no hay historial
      },
    });
  } catch (err) {
    console.error("Error en /api/negocio/ranking-propio:", err);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/negocios/mis-negocios
// GET /api/negocios/mis-negocios
router.get("/mis-negocios", autenticarTokenNegocio, async (req, res) => {
  try {
    // ✅ req.negocio.id = ID del usuario (dueño) => ownerId
    const ownerId = req.negocio.id;

    // ✅ Si en tu sistema es 1 negocio por usuario, igual devolvemos array
    const negocio = await uNegocio.findOne({
      where: { ownerId },
    });

    return res.json({
      ok: true,
      negocios: negocio ? [negocio] : [], // 👈 mantiene el formato del frontend
    });
  } catch (err) {
    console.error("❌ GET /api/negocios/mis-negocios:", err);
    return res.status(500).json({
      ok: false,
      error: "Error al obtener negocios",
    });
  }
});


module.exports = router;
