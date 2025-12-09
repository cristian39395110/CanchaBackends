// routes/admin.js
const express = require("express");
const router = express.Router();
const { Op ,fn, col } = require("sequelize");

const {
  ParteTecnica,
  VentaVendedor,
  uNegocio,
  uCheckinNegocio,
  UsuarioRetoCumplido,
  Reto,
    RetoGanadorHist,
  RetoGanadorHistDet,
  PlanNegocio,
  SorteoMensualProvincia,
  uUsuarioNegocio, // 👈 usuarios de la app (dueños de negocios, tienen premium/fechas)
} = require("../models/model");

const autenticarPanel = require("../middlewares/autenticarPanel");

// Primero autenticamos el panel
router.use(autenticarPanel);

// Luego chequeamos que sea admin
router.use((req, res, next) => {
  if (!req.panelUser || req.panelUser.rol !== "admin") {
    return res.status(403).json({ error: "Acceso solo para administradores" });
  }
  next();
});

/**
 * POST /api/admin/sorteos/provincia/ejecutar
 * body: { provincia, mes?, anio? }
 * - Si no mandás mes/anio → usa el MES PASADO.
 * - Saca top 2 por puntos y el 3º al azar entre el resto (mín. 10 canjes).
 */


/**
 * 🟢 CREAR RETO POR PROVINCIA
 */
router.post("/retos/crear", async (req, res) => {
  try {
    const {
      titulo,
      descripcion,
      puntos,
      tipo,
      meta,
      rangoDias,
      destinoLatitud,
      destinoLongitud,
      destinoRadioMetros,
      provincia,
      localidad,
    } = req.body;

    // permitimos provincia = null para "🌎 todas las provincias"
    if (provincia === undefined) {
      return res.status(400).json({ error: "Falta provincia" });
    }

    const nuevo = await Reto.create({
      titulo,
      descripcion,
      puntos,
      tipo,
      meta,
      rangoDias,
      destinoLatitud,
      destinoLongitud,
      destinoRadioMetros,
      provincia,   // puede ser string o null
      localidad,
      activo: true,
    });

    return res.json({ ok: true, reto: nuevo });
  } catch (error) {
    console.error("❌ POST /retos/crear:", error);
    return res.status(500).json({ error: "Error creando reto" });
  }
});


/**
 * 🟡 LISTAR RETOS POR PROVINCIA
 */



router.get("/retos", async (req, res) => {
  try {
    const { provincia } = req.query;

    // 👇 Si viene provincia, traemos:
    // - retos específicos de esa provincia
    // - retos nacionales (provincia = null)
    let whereReto = {};
    if (provincia) {
      whereReto = {
        [Op.or]: [
          { provincia: null },        // retos para todas las provincias
          { provincia: provincia },   // retos específicos de esa provincia
        ],
      };
    }

    // 1) Traemos los retos
    const retos = await Reto.findAll({
      where: whereReto,
      order: [["createdAt", "DESC"]],
    });

    if (!retos.length) {
      return res.json({ ok: true, retos: [] });
    }

    const retoIds = retos.map((r) => r.id);

    // 2) Armamos where para las stats
    const whereStats = {
      retoId: {
        [Op.in]: retoIds,
      },
    };

    // 👉 Si filtrás por provincia, las stats se calculan SOLO
    // con usuarios de esa provincia (San Luis, Córdoba, etc.)
    if (provincia) {
      whereStats["$usuario.provincia$"] = provincia;
    }

    // 3) Stats de usuarios que sumaron puntos en cada reto
    const filasStats = await UsuarioRetoCumplido.findAll({
      attributes: [
        "retoId",
        [fn("COUNT", fn("DISTINCT", col("usuarioId"))), "usuariosConPuntos"],
        [col("usuario.provincia"), "provinciaUsuario"],
      ],
      include: [
        {
          model: uUsuarioNegocio,
          as: "usuario",
          attributes: [],
        },
      ],
      where: whereStats,
      group: ["retoId", "usuario.provincia"],
      raw: true,
    });

    const mapaStats = new Map();

    for (const row of filasStats) {
      const retoId = row.retoId;
      const cant = Number(row.usuariosConPuntos) || 0;
      const prov = row.provinciaUsuario || "Sin provincia";

      if (!mapaStats.has(retoId)) {
        mapaStats.set(retoId, {
          total: 0,
          porProvincia: {},
        });
      }

      const stats = mapaStats.get(retoId);
      stats.total += cant;
      stats.porProvincia[prov] = (stats.porProvincia[prov] || 0) + cant;
    }

    const retosConStats = retos.map((r) => {
      const base = r.toJSON();
      const stats = mapaStats.get(r.id) || { total: 0, porProvincia: {} };
      return {
        ...base,
        statsUsuarios: stats,
      };
    });

    return res.json({ ok: true, retos: retosConStats });
  } catch (error) {
    console.error("❌ GET /retos:", error);
    return res.status(500).json({ error: "Error obteniendo retos" });
  }
});


/**
 * 🔴 DESACTIVAR RETO
 */
router.patch("/retos/:id/desactivar", async (req, res) => {
  try {
    const { id } = req.params;

    await Reto.update({ activo: false }, { where: { id } });

    return res.json({ ok: true });
  } catch (error) {
    console.error("❌ PATCH /retos/:id/desactivar:", error);
    return res.status(500).json({ error: "Error desactivando reto" });
  }
});

/**
 * 🟢 ACTIVAR RETO
 */
router.patch("/retos/:id/activar", async (req, res) => {
  try {
    const { id } = req.params;

    await Reto.update({ activo: true }, { where: { id } });

    return res.json({ ok: true });
  } catch (error) {
    console.error("❌ PATCH /retos/:id/activar:", error);
    return res.status(500).json({ error: "Error activando reto" });
  }
});

/**
 * 🔍 VER PROGRESO POR RETO
 *  → te lista cada usuario con su puntaje acumulado para ese reto
 */
router.get("/retos/:id/progreso", async (req, res) => {
  try {
    const { id } = req.params;

    const reto = await Reto.findByPk(id);
    if (!reto) return res.status(404).json({ error: "Reto no encontrado" });

    const progresos = await UsuarioRetoCumplido.findAll({
      where: { retoId: id },
      include: [
        {
          model: uUsuarioNegocio,
          as: "usuario",
          attributes: ["id", "nombre", "localidad", "provincia"],
        },
      ],
      order: [["puntosOtorgados", "DESC"]],
    });

    return res.json({ ok: true, reto, progresos });
  } catch (error) {
    console.error("❌ GET /retos/:id/progreso:", error);
    return res.status(500).json({ error: "Error obteniendo progreso" });
  }
});

/**
 * 🏆 EJECUTAR GANADORES DEL RETO
 * Guarda en historial RetoGanadorHist y RetoGanadorHistDet
 */
router.post("/retos/:id/ganadores", async (req, res) => {
  try {
    const { id } = req.params;

    const reto = await Reto.findByPk(id);
    if (!reto) return res.status(404).json({ error: "Reto no encontrado" });

    // Buscar usuarios que completaron el reto
    const progresos = await UsuarioRetoCumplido.findAll({
      where: { retoId: id },
      include: [{ model: uUsuarioNegocio, as: "usuario" }],
      order: [["puntosOtorgados", "DESC"]],
    });

    if (progresos.length === 0) {
      return res.json({ ok: false, msj: "Nadie completó este reto" });
    }

    // Guardar historial
    const hist = await RetoGanadorHist.create({
      retoId: id,
      fecha: new Date(),
    });

    for (const p of progresos) {
      await RetoGanadorHistDet.create({
        histId: hist.id,
        usuarioId: p.usuarioId,
        puntos: p.puntosOtorgados,
      });
    }

    return res.json({
      ok: true,
      reto,
      ganadores: progresos,
    });
  } catch (error) {
    console.error("❌ POST /retos/:id/ganadores:", error);
    return res.status(500).json({ error: "Error generando ganadores" });
  }
});





// PATCH /api/admin/sorteos/provincia/:id/premio
// body: { premio: "Tele 50 pulgadas", notaOpcional? }
router.patch('/sorteos/provincia/:id/premio', async (req, res) => {
  try {
    const { id } = req.params;
    const { premio } = req.body;

    if (!premio || !premio.trim()) {
      return res.status(400).json({ error: 'Falta premio' });
    }

    const fila = await SorteoMensualProvincia.findByPk(id);
    if (!fila) {
      return res.status(404).json({ error: 'Ganador no encontrado' });
    }

    fila.premio = premio.trim();
    await fila.save();

    return res.json({ ok: true, ganador: fila });
  } catch (err) {
    console.error('❌ PATCH /api/admin/sorteos/provincia/:id/premio', err);
    return res
      .status(500)
      .json({ error: 'Error al actualizar el premio del ganador' });
  }
});








// POST /api/admin/sorteos/provincia/ejecutar
// body: { provincia, mes?, anio?, cantidadGanadores?, premiosPorPuesto? }
router.post('/sorteos/provincia/ejecutar', async (req, res) => {
  try {
    let { provincia, mes, anio, cantidadGanadores, premiosPorPuesto } = req.body;

    if (!provincia) {
      return res.status(400).json({ error: 'Falta provincia' });
    }

    const hoy = new Date();

    // Si no mandan mes/año, usamos el mes anterior
    if (!mes || !anio) {
      const m = hoy.getMonth(); // 0-11
      if (m === 0) {
        mes = 12;
        anio = hoy.getFullYear() - 1;
      } else {
        mes = m; // ej: hoy es diciembre (11) → mes pasado = 11
        anio = hoy.getFullYear();
      }
    }

    mes = Number(mes);
    anio = Number(anio);

    // Cantidad de ganadores configurable (1–20, default 3)
    let cant = Number(cantidadGanadores) || 3;
    if (cant < 1) cant = 1;
    if (cant > 20) cant = 20;

    // Normalizamos premiosPorPuesto (puede venir como objeto { "1": "...", "2": "..." })
    const premiosMap =
      premiosPorPuesto && typeof premiosPorPuesto === 'object'
        ? premiosPorPuesto
        : {};

    // Rango de fechas del mes [inicio, fin)
    const inicioMes = new Date(anio, mes - 1, 1, 0, 0, 0, 0);
    const finMes = new Date(anio, mes, 1, 0, 0, 0, 0); // primer día del mes siguiente

    // 1) CHECKINS del mes, filtrados por provincia del usuario
    const filasCheckins = await uCheckinNegocio.findAll({
      attributes: [
        'usuarioNegocioId',
        [fn('COUNT', col('*')), 'comprasMes'],
        [fn('SUM', col('puntosGanados')), 'puntosCheckinMes'],
      ],
      include: [
        {
          model: uUsuarioNegocio,
          attributes: ['id', 'nombre', 'provincia', 'localidad'],
          where: { provincia },
        },
      ],
      where: {
        createdAt: {
          [Op.gte]: inicioMes,
          [Op.lt]: finMes,
        },
      },
      group: [
        'usuarioNegocioId',
        'uUsuariosNegocio.id',
        'uUsuariosNegocio.nombre',
        'uUsuariosNegocio.provincia',
        'uUsuariosNegocio.localidad',
      ],
      subQuery: false,
    });

    // 2) Puntos por retos del mes (UsuarioRetoCumplido)
    const filasRetos = await UsuarioRetoCumplido.findAll({
      attributes: [
        'usuarioId',
        [fn('SUM', col('puntosOtorgados')), 'puntosRetosMes'],
      ],
      where: {
        fechaCumplido: {
          [Op.gte]: inicioMes,
          [Op.lt]: finMes,
        },
      },
      group: ['usuarioId'],
      raw: true,
    });

    const mapaRetos = new Map();
    for (const fila of filasRetos) {
      const uid = Number(fila.usuarioId);
      const puntos = Number(fila.puntosRetosMes || 0);
      mapaRetos.set(uid, puntos);
    }

    // 3) Armamos ranking
    let ranking = filasCheckins.map((row) => {
      const usuario = row.uUsuariosNegocio; // alias del include
      const comprasMes = Number(row.get('comprasMes') || 0);
      const puntosCheck = Number(row.get('puntosCheckinMes') || 0);
      const puntosReto = mapaRetos.get(usuario.id) || 0;
      const puntosMes = puntosCheck + puntosReto;

      return {
        usuarioId: usuario.id,
        nombre: usuario.nombre,
        provincia: usuario.provincia,
        localidad: usuario.localidad,
        comprasMes,
        puntosMes,
      };
    });

    // Regla: mínimo 10 compras y más de 0 puntos
    ranking = ranking.filter((r) => r.comprasMes >= 10 && r.puntosMes > 0);

    if (ranking.length === 0) {
      return res.status(400).json({
        error:
          'No hay usuarios que cumplan condiciones (mínimo 10 canjes) para este mes/provincia.',
      });
    }

    // Ordenamos por puntos (desc)
    ranking.sort((a, b) => b.puntosMes - a.puntosMes);

  const maxGanadores = Math.min(cant, ranking.length);
const ganadores = [];


    // 4) Elegimos ganadores:
    //  - Puesto 1 → ranking
    //  - Puesto 2 → ranking
    //  - Resto (3..N) → al azar entre los que quedan
    let restantes = [...ranking];

    if (maxGanadores >= 1 && restantes[0]) {
      const top1 = restantes[0];
      ganadores.push({
        ...top1,
        puesto: 1,
        metodoSeleccion: 'ranking',
      });
      restantes = restantes.slice(1);
    }

    if (maxGanadores >= 2 && restantes[0]) {
      const top2 = restantes[0];
      ganadores.push({
        ...top2,
        puesto: 2,
        metodoSeleccion: 'ranking',
      });
      restantes = restantes.slice(1);
    }

    for (let puesto = ganadores.length + 1; puesto <= maxGanadores; puesto++) {
      if (!restantes.length) break;

      const idxRandom = Math.floor(Math.random() * restantes.length);
      const elegido = restantes[idxRandom];

      ganadores.push({
        ...elegido,
        puesto,
        metodoSeleccion: 'azar',
      });

      restantes.splice(idxRandom, 1);
    }

    // 5) Borramos ganadores previos de ese mes/provincia y guardamos nuevos
    await SorteoMensualProvincia.destroy({
      where: {
        provincia,
        localidad: null, // por ahora usamos sólo provincia
        mes,
        anio,
      },
    });

    // Creamos filas en la tabla SorteoMensualProvincia
    await SorteoMensualProvincia.bulkCreate(
      ganadores.map((g) => ({
        provincia: g.provincia,
        localidad: null,
        mes,
        anio,
        usuarioId: g.usuarioId,
        puesto: g.puesto,
        puntosMes: g.puntosMes,
        comprasMes: g.comprasMes,
        premio: premiosMap[g.puesto] || null,
        // metodoSeleccion NO se guarda porque tu tabla no lo tiene
        // fechaSorteo: new Date(), // solo si tu modelo tiene esta columna
      }))
    );

    // Adjuntamos el premio también en la respuesta
    const ganadoresConPremio = ganadores.map((g) => ({
      ...g,
      premio: premiosMap[g.puesto] || null,
    }));

    return res.json({
      ok: true,
      provincia,
      mes,
      anio,
      cantidadGanadores: maxGanadores,
      ganadores: ganadoresConPremio,
      top20: ranking.slice(0, 20),
    });
  } catch (err) {
    console.error('❌ POST /api/admin/sorteos/provincia/ejecutar', err);
    return res
      .status(500)
      .json({ error: 'Error al ejecutar el sorteo por provincia' });
  }
});


/**
 * GET /api/admin/sorteos/provincia
 * query: { provincia, mes, anio }
 * Devuelve ganadores ya guardados + ranking si querés enriquecer después.
 */
router.get('/sorteos/provincia', async (req, res) => {
  try {
    let { provincia, mes, anio } = req.query;
    if (!provincia || !mes || !anio) {
      return res
        .status(400)
        .json({ error: 'Faltan provincia, mes o anio en el query' });
    }

    mes = Number(mes);
    anio = Number(anio);

    const ganadores = await SorteoMensualProvincia.findAll({
      where: { provincia, localidad: null, mes, anio },
      include: [
        {
          model: uUsuarioNegocio,
          as: 'usuario',
          attributes: ['id', 'nombre', 'provincia', 'localidad', 'fotoPerfil'],
        },
      ],
      order: [['puesto', 'ASC']],
    });

    return res.json({ ok: true, provincia, mes, anio, ganadores });
  } catch (err) {
    console.error('❌ GET /api/admin/sorteos/provincia', err);
    return res
      .status(500)
      .json({ error: 'Error al obtener ganadores del sorteo' });
  }
});





// Helper para sacar límites de meses
function getRangosMes() {
  const ahora = new Date();

  const inicioMesActual = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    1,
    0,
    0,
    0,
    0
  );
  const inicioMesSiguiente = new Date(
    ahora.getFullYear(),
    ahora.getMonth() + 1,
    1,
    0,
    0,
    0,
    0
  );
  const inicioMesAnterior = new Date(
    ahora.getFullYear(),
    ahora.getMonth() - 1,
    1,
    0,
    0,
    0,
    0
  );

  return {
    ahora,
    inicioMesActual,
    inicioMesSiguiente,
    inicioMesAnterior,
  };
}

// ✅ DASHBOARD RESUMEN + INGRESOS
router.get("/dashboard-resumen", async (req, res) => {
  try {
    // =============================
    // BASE
    // =============================
    const totalNegociosActivos = await uNegocio.count({ where: { activo: true } });
    const totalNegociosInactivos = await uNegocio.count({ where: { activo: false } });

    const totalVendedores = await ParteTecnica.count({
      where: { rol: "vendedor" },
    });

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const ventasMes = await VentaVendedor.findAll({
      where: { fechaVenta: { [Op.gte]: inicioMes } },
    });

    const ventasMesMonto = ventasMes.reduce(
      (acc, v) => acc + (Number(v.monto) || 0),
      0
    );
    const ventasMesComision = ventasMes.reduce(
      (acc, v) => acc + (Number(v.comisionVendedor) || 0),
      0
    );

    const puntosMesTotales = (await uNegocio.sum("puntosMes")) || 0;

    // =============================
    // PLAN PREMIUM
    // =============================
    let planPremium = await PlanNegocio.findOne({
      where: { id: { [Op.gt]: 1 } },
      order: [["precioMensual", "DESC"]],
    });

    if (!planPremium) {
      planPremium = await PlanNegocio.findOne({
        order: [["precioMensual", "DESC"]],
      });
    }

    const precioPlan = Number(planPremium?.precioMensual || 0);

    const { ahora, inicioMesActual, inicioMesSiguiente, inicioMesAnterior } =
      getRangosMes();

    // 📌 PREMIUM ACTIVOS (vigentes + con fecha)
    const negociosPremiumActivos = await uNegocio.count({
      where: {
        activo: true,
        planId: { [Op.gte]: 1 },
      },
      include: [
        {
          model: uUsuarioNegocio,
          as: "duenio",
          required: true,
          where: {
            esPremium: true,
            fechaFinPremium: { [Op.gt]: ahora },
          },
        },
      ],
    });

    // 📌 PREMIUM VENCIDOS
    const negociosPremiumVencidos = await uNegocio.count({
      where: {
        activo: true,
        planId: { [Op.gte]: 1 },
      },
      include: [
        {
          model: uUsuarioNegocio,
          as: "duenio",
          required: true,
          where: {
            fechaFinPremium: { [Op.lte]: ahora },
          },
        },
      ],
    });

    // 📌 PREMIUM POR VENCER (vigentes dentro de 7 días)
    const negociosPremiumPorVencer = await uNegocio.count({
      where: {
        activo: true,
        planId: { [Op.gte]: 1 },
      },
      include: [
        {
          model: uUsuarioNegocio,
          as: "duenio",
          required: true,
          where: {
            esPremium: true,
            fechaFinPremium: {
              [Op.gt]: ahora,
              [Op.lte]: new Date(ahora.getTime() + 7 * 86400000),
            },
          },
        },
      ],
    });

    // 📌 PREMIUM AL DÍA = activos - por vencer
    const negociosPremiumAlDia = negociosPremiumActivos - negociosPremiumPorVencer;

    // 📌 INGRESOS MES ACTUAL = ALTAS este mes
    const negociosMesActual = await uNegocio.count({
      where: {
        planId: { [Op.gt]: 1 },
        createdAt: {
          [Op.gte]: inicioMesActual,
          [Op.lt]: inicioMesSiguiente,
        },
        activo: true,
      },
    });

    // 📌 INGRESOS MES ANTERIOR = ALTAS mes anterior
    const negociosMesAnterior = await uNegocio.count({
      where: {
        planId: { [Op.gt]: 1 },
        createdAt: {
          [Op.gte]: inicioMesAnterior,
          [Op.lt]: inicioMesActual,
        },
        activo: true,
      },
    });

    // 💵 INGRESOS
    const ingresosMesActual = negociosMesActual * precioPlan;
    const ingresosMesAnterior = negociosMesAnterior * precioPlan;

    // 💵 MRR REAL HOY (suscripciones vigentes)
    const ingresosEstimadoProximoMes = negociosPremiumActivos * precioPlan;

    res.json({
      totalNegociosActivos,
      totalNegociosInactivos,
      totalVendedores,
      ventasMesMonto,
      ventasMesComision,
      puntosMesTotales,

      // premium totals
      totalNegociosPremium: negociosPremiumActivos + negociosPremiumVencidos,
      negociosPremiumActivos,
      negociosPremiumVencidos,
      negociosPremiumPorVencer,
      negociosPremiumAlDia,

      // ingresos
      precioPlanMensual: precioPlan,
      ingresosMesActual,
      ingresosMesAnterior,
      ingresosEstimadoProximoMes,

      // altas
      negociosMesActual,
      negociosMesAnterior,
    });
  } catch (err) {
    console.error("❌ /api/admin/dashboard-resumen:", err);
    res.status(500).json({ error: "Error al obtener el resumen" });
  }
});



module.exports = router;
