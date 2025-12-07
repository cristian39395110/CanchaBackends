// routes/adminSupervisor.js
const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");

const {
  ParteTecnica,
  VentaVendedor,
  uNegocio,
  AlertasSupervisor,
  uUsuarioNegocio,
  PlanNegocio
} = require("../models/model");

const autenticarPanel = require("../middlewares/autenticarPanel");
const { soloAdmin } = require("../middlewares/rolesPanel"); 
// 👆 asegurate que soloAdmin verifique req.panelUser.rol === 'admin'

// Todos estos endpoints requieren login de panel + rol admin
router.use(autenticarPanel);
router.use(soloAdmin);

/* =====================================================
   1️⃣ RESUMEN POR VENDEDOR (igual que supervisor, pero admin)
   GET /api/admin-supervisor/vendedores-resumen
   filtros: q (email/nombre), localidad, desde, hasta
   ===================================================== */
/* 1️⃣ RESUMEN POR VENDEDOR */
router.get("/vendedores-resumen", async (req, res) => {
  try {
    const { q, localidad, provincia, desde, hasta } = req.query;

    const whereVendedor = {
      rol: "vendedor",
    };

    // 🆕 FILTRO por nombre o email
    if (q) {
      whereVendedor[Op.or] = [
        { email: { [Op.like]: `%${q}%` } },
        { nombre: { [Op.like]: `%${q}%` } },
      ];
    }

    // 🆕 FILTRO por localidad
    if (localidad) {
      whereVendedor.localidad = { [Op.like]: `%${localidad}%` };
    }

    // 🆕 FILTRO por provincia (EL QUE TE FALTABA)
    if (provincia) {
      whereVendedor.provincia = { [Op.like]: `%${provincia}%` };
    }

    const whereVentas = {};
    if (desde && hasta) {
      whereVentas.fechaVenta = { [Op.between]: [desde, hasta] };
    } else if (desde) {
      whereVentas.fechaVenta = { [Op.gte]: desde };
    } else if (hasta) {
      whereVentas.fechaVenta = { [Op.lte]: hasta };
    }

    const vendedores = await ParteTecnica.findAll({
      where: whereVendedor,
      attributes: ["id", "nombre", "email", "localidad", "provincia"], // 🆕 importante
      include: [
        {
          model: VentaVendedor,
          required: false,
          where: whereVentas,
        },
      ],
      order: [["nombre", "ASC"]],
    });

    const resultado = vendedores.map((v) => {
      const ventas = v.VentaVendedors || [];

      const totalVentas = ventas.length;

      const totalComisionVendedor = ventas.reduce(
        (acc, x) => acc + (x.comision || 0),
        0
      );

      const totalPagadoVendedor = ventas
        .filter((x) => x.pagado)
        .reduce((acc, x) => acc + (x.comision || 0), 0);

      const totalPendienteVendedor = totalComisionVendedor - totalPagadoVendedor;

      const totalComisionSupervisor = ventas.reduce(
        (acc, x) => acc + (x.comisionSupervisor || 0),
        0
      );

      const totalPagadoSupervisor = ventas
        .filter((x) => x.pagadoSupervisor)
        .reduce((acc, x) => acc + (x.comisionSupervisor || 0), 0);

      const totalPendienteSupervisor =
        totalComisionSupervisor - totalPagadoSupervisor;

      return {
        id: v.id,
        nombre: v.nombre,
        email: v.email,
        localidad: v.localidad,
        provincia: v.provincia,       // 🆕 ahora sí te llega

        totalVentas,
        totalComisionVendedor,
        totalPagadoVendedor,
        totalPendienteVendedor,
        totalComisionSupervisor,
        totalPagadoSupervisor,
        totalPendienteSupervisor,
      };
    });

    res.json({ ok: true, vendedores: resultado });
  } catch (err) {
    console.error("❌ admin-supervisor/vendedores-resumen:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

/* =====================================================
   2️⃣ VENTAS DE UN VENDEDOR (detalle para marcar pagado)
   GET /api/admin-supervisor/ventas-vendedor/:id
   filtros opcionales: desde, hasta
   ===================================================== */
router.get("/ventas-vendedor/:id", async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const vendedorId = req.params.id;

    const where = { vendedorId };

    if (desde && hasta) {
      where.fechaVenta = { [Op.between]: [desde, hasta] };
    } else if (desde) {
      where.fechaVenta = { [Op.gte]: desde };
    } else if (hasta) {
      where.fechaVenta = { [Op.lte]: hasta };
    }

    const ventas = await VentaVendedor.findAll({
      where,
      include: [
        {
          model: uNegocio,
          attributes: ["id", "nombre", "localidad"],
        },
      ],
      order: [["fechaVenta", "DESC"]],
    });

    const formato = ventas.map((v) => ({
      id: v.id,
      negocioId: v.negocioId,
      nombreNegocio: v.uNegocio ? v.uNegocio.nombre : null,
      localidadNegocio: v.uNegocio ? v.uNegocio.localidad : null,
      fechaVenta: v.fechaVenta,
      comisionSupervisor: v.comisionSupervisor,
      pagadoSupervisor: v.pagadoSupervisor,
      fechaPagoSupervisor: v.fechaPagoSupervisor,
    }));

    res.json({ ok: true, ventas: formato });
  } catch (err) {
    console.error("❌ admin-supervisor/ventas-vendedor:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

/* =====================================================
   3️⃣ MARCAR UNA VENTA COMO PAGADA (SUPERVISOR)
   PATCH /api/admin-supervisor/ventas/:id/pagar-supervisor
   ===================================================== */
router.patch("/ventas/:id/pagar-supervisor", async (req, res) => {
  try {
    const id = req.params.id;

    const venta = await VentaVendedor.findByPk(id);
    if (!venta) {
      return res.status(404).json({ error: "Venta no encontrada" });
    }

    if (venta.pagadoSupervisor) {
      return res
        .status(400)
        .json({ error: "Esta comisión ya figura como pagada" });
    }

    venta.pagadoSupervisor = true;
    venta.fechaPagoSupervisor = new Date();

    await venta.save();

    res.json({ ok: true, venta });
  } catch (err) {
    console.error("❌ admin-supervisor/ventas/:id/pagar-supervisor:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// PAGAR VARIAS VENTAS AL VENDEDOR (15.000 c/u)
router.patch("/ventas/pagar-multiple-vendedor", async (req, res) => {
  try {
    const { ventasIds } = req.body;

    if (!Array.isArray(ventasIds) || ventasIds.length === 0) {
      return res
        .status(400)
        .json({ error: "Debes enviar un array ventasIds con IDs de ventas" });
    }

    const ventas = await VentaVendedor.findAll({
      where: {
        id: ventasIds,
        pagado: false, // solo las que todavía no se pagaron al vendedor
      },
    });

    if (ventas.length === 0) {
      return res
        .status(400)
        .json({ error: "No hay ventas pendientes de pago al vendedor" });
    }

    let totalComision = 0;

    for (const v of ventas) {
      v.pagado = true;
      v.fechaPago = new Date();
      totalComision += v.comision || 0;
      await v.save();
    }

    res.json({
      ok: true,
      cantidadActualizada: ventas.length,
      totalComisionPagada: totalComision,
    });
  } catch (err) {
    console.error("❌ admin-supervisor/ventas/pagar-multiple-vendedor:", err);
    res.status(500).json({ error: "Error interno" });
  }
});


/* =====================================================
   4️⃣ MARCAR VARIAS VENTAS COMO PAGADAS (en lote)
   PATCH /api/admin-supervisor/ventas/pagar-multiple
   body: { ventasIds: [1,2,3] }
   ===================================================== */
router.patch("/ventas/pagar-multiple", async (req, res) => {
  try {
    const { ventasIds } = req.body;

    if (!Array.isArray(ventasIds) || ventasIds.length === 0) {
      return res
        .status(400)
        .json({ error: "Debes enviar un array ventasIds con IDs de ventas" });
    }

    const ventas = await VentaVendedor.findAll({
      where: {
        id: ventasIds,
        pagadoSupervisor: false, // solo las que aún no están pagadas
      },
    });

    if (ventas.length === 0) {
      return res
        .status(400)
        .json({ error: "No hay ventas pendientes de pago con esos IDs" });
    }

    let totalComision = 0;

    for (const v of ventas) {
      v.pagadoSupervisor = true;
      v.fechaPagoSupervisor = new Date();
      totalComision += v.comisionSupervisor || 0;
      await v.save();
    }

    res.json({
      ok: true,
      cantidadActualizada: ventas.length,
      totalComisionPagada: totalComision,
    });
  } catch (err) {
    console.error("❌ admin-supervisor/ventas/pagar-multiple:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

/* =====================================================
   5️⃣ LISTAR ALERTAS DEL SUPERVISOR (vista ADMIN)
   GET /api/admin-supervisor/alertas?estado=pending|resuelta
   ===================================================== */
router.get("/alertas", async (req, res) => {
  try {
    const { estado } = req.query;
    const where = {};

    // estado = pendiente | resuelta | (undefined → todas)
    if (estado === "pendiente") {
      where.leida = false;
    } else if (estado === "resuelta") {
      where.leida = true;
    }

    const alertas = await AlertasSupervisor.findAll({
      where,
      include: [
        {
          model: ParteTecnica,
          as: "supervisor",
          attributes: ["id", "nombre", "email"],
        },
        {
          model: ParteTecnica,
          as: "vendedor",
          attributes: ["id", "nombre", "email", "localidad"],
        },
      ],
      order: [["id", "DESC"]],
    });

    res.json({ ok: true, alertas });
  } catch (err) {
    console.error("❌ admin-supervisor/alertas:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

/* =====================================================
   6️⃣ MARCAR ALERTA COMO RESUELTA
   PATCH /api/admin-supervisor/alertas/:id/resolver
   body opcional: { notaAdmin: "texto" }
   (necesitarías campos estado / notaAdmin en el modelo si querés guardarlo)
   ===================================================== */
router.patch("/alertas/:id/resolver", async (req, res) => {
  try {
    const id = req.params.id;
    const { notaAdmin } = req.body;

    const alerta = await AlertasSupervisor.findByPk(id);
    if (!alerta) {
      return res.status(404).json({ error: "Alerta no encontrada" });
    }

    // marcar como resuelta
    alerta.leida = true;

    if (notaAdmin && notaAdmin.trim()) {
      alerta.notaAdmin = notaAdmin.trim();
    }

    await alerta.save();

    return res.json({ ok: true, alerta });
  } catch (err) {
    console.error("❌ admin-supervisor/alertas/:id/resolver:", err);
    return res.status(500).json({ error: "Error interno" });
  }
});



router.get("/alertas/count-pendientes", async (req, res) => {
  try {
    const count = await AlertasSupervisor.count({
      where: { leida: false }
    });

    res.json({ ok: true, count });
  } catch (err) {
    console.error("❌ Error alertas count:", err);
    res.status(500).json({ error: "Error interno" });
  }
});


/* =====================================================
   X️⃣ DETALLE COMPLETO DE UN VENDEDOR (para el admin)
   GET /api/admin-supervisor/vendedor/:id/detalle
   ===================================================== */
router.get("/vendedor/:id/detalle", async (req, res) => {
  try {
    const vendedorId = req.params.id;

    const vendedor = await ParteTecnica.findByPk(vendedorId, {
      attributes: ["id", "nombre", "email", "localidad", "provincia"],
    });

    if (!vendedor) {
      return res.status(404).json({ error: "Vendedor no encontrado" });
    }

const ventas = await VentaVendedor.findAll({
  where: { vendedorId },
  include: [
    {
      model: uNegocio,
      as: "uNegocio", // 👈 mismo alias que en belongsTo
      attributes: ["id", "nombre", "localidad", "provincia"],
    },
  ],
  order: [["fechaVenta", "DESC"]],
});


    const totalVentas = ventas.length;

    // 💰 vendedor (usamos comision guardada, por si ya la tenés)
    const totalComisionVendedor = ventas.reduce(
      (acc, v) => acc + (v.comision || 0),
      0
    );
    const totalPagadoVendedor = ventas
      .filter((v) => v.pagado)
      .reduce((acc, v) => acc + (v.comision || 0), 0);
    const totalPendienteVendedor =
      totalComisionVendedor - totalPagadoVendedor;

    // 💰 supervisor (5.000 por venta por defecto si no hay dato)
    const totalComisionSupervisor = ventas.reduce(
      (acc, v) => acc + (v.comisionSupervisor || 0),
      0
    );
    const totalPagadoSupervisor = ventas
      .filter((v) => v.pagadoSupervisor)
      .reduce((acc, v) => acc + (v.comisionSupervisor || 0), 0);
    const totalPendienteSupervisor =
      totalComisionSupervisor - totalPagadoSupervisor;

    // Detalle de ventas que va al frontend
    const ventasDetalle = ventas.map((v) => ({
      id: v.id,
      fecha: v.fechaVenta,
      negocioNombre: v.uNegocio ? v.uNegocio.nombre : null,       // 👈 ojo acá
      negocioLocalidad: v.uNegocio ? v.uNegocio.localidad : null, // 👈
      negocioProvincia: v.uNegocio ? v.uNegocio.provincia : null, // 👈
      montoVenta: v.montoVenta ?? null,

      // valores que usa el frontend
      comisionVendedor: 15000,                  // fijo por venta
      comisionSupervisor: v.comisionSupervisor || 5000,

      pagadaVendedor: v.pagado || false,
      pagadaSupervisor: v.pagadoSupervisor || false,
    }));

    const pagosSupervisor = ventas
      .filter((v) => v.pagadoSupervisor && v.fechaPagoSupervisor)
      .map((v) => ({
        id: v.id,
        fechaPago: v.fechaPagoSupervisor,
        monto: v.comisionSupervisor || 0,
        observacion: `Pago comisión supervisor venta #${v.id}`,
      }));

    return res.json({
      vendedor: {
        id: vendedor.id,
        nombre: vendedor.nombre,
        email: vendedor.email,
        localidad: vendedor.localidad,
        provincia: vendedor.provincia || null,
        totalVentas,
        totalComisionVendedor,
        totalPagadoVendedor,
        totalPendienteVendedor,
        totalComisionSupervisor,
        totalPagadoSupervisor,
        totalPendienteSupervisor,
      },
      ventas: ventasDetalle,
      pagosSupervisor,
    });
  } catch (err) {
    console.error("❌ admin-supervisor/vendedor/:id/detalle:", err);
    res.status(500).json({ error: "Error interno" });
  }
});



// =====================================================
// 7️⃣ LISTA DE NEGOCIOS ADHERIDOS (para el admin)
// GET /api/admin-supervisor/negocios
// query: q, provincia, vendedorId, estadoPlan, origen, orden
// =====================================================
// =====================================================
// 7️⃣ LISTA DE NEGOCIOS ADHERIDOS (para el admin)
// GET /api/admin-supervisor/negocios
// query: q, provincia, vendedorId, estadoPlan, origen, orden
// =====================================================
router.get("/negocios", async (req, res) => {
  try {
    const {
      q,
      provincia,
      vendedorId,
      estadoPlan,
      origen,
      orden,
    } = req.query;

    const whereNegocio = {};

    if (q) {
      whereNegocio[Op.or] = [
        { nombre:    { [Op.like]: `%${q}%` } },
        { localidad: { [Op.like]: `%${q}%` } },
        { provincia: { [Op.like]: `%${q}%` } },
      ];
    }

    if (provincia) {
      whereNegocio.provincia = provincia;
    }

    const negocios = await uNegocio.findAll({
      where: whereNegocio,
      include: [
        // 👇 DUEÑO
        {
          model: uUsuarioNegocio,
          as: "duenio",
          attributes: [
            "id",
            "nombre",
            "email",
            "telefono",
            "puntos",
            "esPremium",
            "fechaFinPremium",
          ],
          required: false,
        },
        // 👇 Ventas: ahora con alias "ventas"
        {
          model: VentaVendedor,
          as: "ventas",              // 👈 IMPORTANTE: mismo alias que en hasMany
          include: [
            {
              model: ParteTecnica,
              attributes: ["id", "nombre", "email"],
            },
          ],
          required: false,
        },
        // 👇 Plan
        PlanNegocio
          ? {
              model: PlanNegocio,
              as: "plan",
              attributes: ["id", "nombre"],
              required: false,
            }
          : null,
      ].filter(Boolean),
      order: [["createdAt", "DESC"]],
    });

    const ahora = new Date();

    const formateados = negocios
      .map((n) => {
        // 👇 AHORA las ventas vienen en n.ventas
        const ventasNegocio = Array.isArray(n.ventas) ? n.ventas : [];
        const ventaAlta = ventasNegocio[0] || null;
        const vendedor = ventaAlta ? ventaAlta.ParteTecnica : null;

        // ==========================
        // Estado del plan (dueño + plan)
        // ==========================
        let estadoPlanCalc = "sin_plan";
        let planNombre = null;
        let planId = null;

        const duenio = n.duenio;

        if (n.plan) {
          planNombre = n.plan.nombre;
          planId = n.plan.id;
        }

        if (duenio && duenio.esPremium && duenio.fechaFinPremium) {
          const fin = new Date(duenio.fechaFinPremium);
          const finTime = fin.getTime();

          if (!isNaN(finTime)) {
            if (fin < ahora) {
              estadoPlanCalc = "vencido";
            } else {
              const diffMs = finTime - ahora.getTime();
              const dias = diffMs / (1000 * 60 * 60 * 24);
              if (dias <= 7) {
                estadoPlanCalc = "por_vencer";
              } else {
                estadoPlanCalc = "al_dia";
              }
            }
          } else {
            estadoPlanCalc = "sin_plan";
          }
        }

        // Origen: vendedor vs app
        let origenCalc = "desconocido";
        if (ventaAlta && vendedor) origenCalc = "vendedor";
        else origenCalc = "app";

        return {
          id: n.id,
          nombre: n.nombre,
          rubro: n.rubro,
          provincia: n.provincia,
          localidad: n.localidad,
          direccion: n.direccion,
          telefono: n.telefono,
          whatsapp: n.whatsapp,
          fechaAlta: n.createdAt,
          planId,
          planNombre,
          estadoPlan: estadoPlanCalc,
          origen: origenCalc,
          vendedor: vendedor
            ? {
                id: vendedor.id,
                nombre: vendedor.nombre,
                email: vendedor.email,
              }
            : null,
          owner: n.duenio
            ? {
                id: n.duenio.id,
                nombre: n.duenio.nombre,
                email: n.duenio.email,
                telefono: n.duenio.telefono,
                puntos: n.duenio.puntos,
                esPremium: n.duenio.esPremium,
                fechaFinPremium: n.duenio.fechaFinPremium,
              }
            : null,
          puntosMes: n.puntosMes || (n.duenio ? n.duenio.puntos : 0),
        };
      })
      .filter((n) => {
        if (vendedorId && n.vendedor?.id != vendedorId) return false;
        if (estadoPlan && n.estadoPlan !== estadoPlan) return false;
        if (origen && n.origen !== origen) return false;
        return true;
      });

    // Orden
    if (orden === "crecimiento") {
      formateados.sort((a, b) => (b.puntosMes || 0) - (a.puntosMes || 0));
    } else {
      formateados.sort(
        (a, b) =>
          new Date(b.fechaAlta).getTime() - new Date(a.fechaAlta).getTime()
      );
    }

    const provinciasSet = new Set();
    const vendedoresMap = new Map();

    formateados.forEach((n) => {
      if (n.provincia) provinciasSet.add(n.provincia);
      if (n.vendedor) vendedoresMap.set(n.vendedor.id, n.vendedor);
    });

    return res.json({
      ok: true,
      negocios: formateados,
      filtrosAux: {
        provincias: Array.from(provinciasSet),
        vendedores: Array.from(vendedoresMap.values()),
      },
    });
  } catch (err) {
    console.error("❌ admin-supervisor/negocios:", err);
    return res.status(500).json({ ok: false, error: "Error interno" });
  }
});



// =====================================================
// 8️⃣ EXPORTAR NEGOCIOS A CSV
// GET /api/admin-supervisor/negocios/export
// (reutiliza la lógica de /negocios pero arma CSV simple)
// =====================================================
router.get("/negocios/export", async (req, res) => {
  try {
    req.query.orden = req.query.orden || "recientes";

    // llamamos internamente al handler de /negocios
    const fakeRes = {
      json(payload) {
        this.payload = payload;
      },
    };

    await new Promise((resolve, reject) => {
      // envolvemos el anterior endpoint sin repetir código
      router.handle(
        {
          ...req,
          url: "/negocios",
          method: "GET",
        },
        {
          ...fakeRes,
          status: () => fakeRes,
          json: (p) => {
            fakeRes.payload = p;
            resolve(true);
          },
        },
        (err) => (err ? reject(err) : resolve(true))
      );
    });

    const negocios = fakeRes.payload?.negocios || [];

    const headers = [
      "id",
      "nombre",
      "rubro",
      "provincia",
      "localidad",
      "direccion",
      "telefono",
      "whatsapp",
      "plan",
      "estadoPlan",
      "origen",
      "vendedorNombre",
      "vendedorEmail",
      "fechaAlta",
      "puntosMes",
    ];

    const lines = [headers.join(";")];

    negocios.forEach((n) => {
      const row = [
        n.id,
        n.nombre,
        n.rubro || "",
        n.provincia || "",
        n.localidad || "",
        n.direccion || "",
        n.telefono || "",
        n.whatsapp || "",
        n.planNombre || "",
        n.estadoPlan || "",
        n.origen || "",
        n.vendedor ? n.vendedor.nombre : "",
        n.vendedor ? n.vendedor.email : "",
        n.fechaAlta,
        n.puntosMes || 0,
      ].map((v) =>
        String(v)
          .replace(/;/g, ",")
          .replace(/\n/g, " ")
      );
      lines.push(row.join(";"));
    });

    const csv = lines.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=\"negocios_puntomas.csv\""
    );
    return res.send(csv);
  } catch (err) {
    console.error("❌ admin-supervisor/negocios/export:", err);
    return res.status(500).send("Error interno exportando CSV");
  }
});


module.exports = router;
