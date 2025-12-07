// routes/supervisor.js
const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");

const bcrypt = require("bcryptjs");


const {
  ParteTecnica,
  VentaVendedor,
  uNegocio,
  AlertasSupervisor,
} = require("../models/model");

const autenticarPanel = require("../middlewares/autenticarPanel");
const { soloSupervisor } = require("../middlewares/rolesPanel");

// 🔐 todos los endpoints de acá requieren login de panel
router.use(autenticarPanel);
router.use(soloSupervisor);

// =====================================================
// 1️⃣ LISTA DE TODAS LAS VENTAS (Dashboard Supervisor)
//     👉 usada por SupervisorHomePage (GET /api/supervisor/ventas)
// =====================================================
router.get("/ventas", async (req, res) => {
  try {
    const ventas = await VentaVendedor.findAll({
      include: [
        {
          model: ParteTecnica,
          attributes: ["id", "nombre", "email", "localidad"],
        },
        {
          model: uNegocio,
          attributes: ["id", "nombre", "email"],
        },
      ],
      order: [["fechaVenta", "DESC"]],
    });

    const formato = ventas.map((v) => ({
      id: v.id,
      nombreNegocio: v.uNegocio ? v.uNegocio.nombre : null,
      fechaVenta: v.fechaVenta,
      vendedorNombre: v.ParteTecnica ? v.ParteTecnica.nombre : null,
      comisionSupervisor: v.comisionSupervisor,
      pagadoSupervisor: v.pagadoSupervisor,
      fechaPagoSupervisor: v.fechaPagoSupervisor,
    }));

    res.json({ ok: true, ventas: formato });
  } catch (err) {
    console.error("❌ Error supervisor/ventas:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// =====================================================
// 2️⃣ LISTA DE VENDEDORES + RESUMEN (SupervisorVendedorPage)
//     GET /api/supervisor/vendedores-resumen
//     filtros: q (email/nombre), localidad, desde, hasta
// =====================================================
// =====================================================
// RESUMEN DE VENDEDORES (con filtro por provincia, fechas y vendedorId)
// =====================================================
router.get("/vendedores-resumen", async (req, res) => {
  try {
    // ahora leemos también vendedorId
    const { q, localidad, provincia, desde, hasta, vendedorId } = req.query;

    const whereVendedor = {
      rol: "vendedor",
    };

    // buscar por nombre o email
    if (q) {
      whereVendedor[Op.or] = [
        { email: { [Op.like]: `%${q}%` } },
        { nombre: { [Op.like]: `%${q}%` } },
      ];
    }

    // filtro por localidad si lo usás en algún lado
    if (localidad) {
      whereVendedor.localidad = { [Op.like]: `%${localidad}%` };
    }

    // filtro por provincia (el que estás usando ahora desde el front)
    if (provincia) {
      whereVendedor.provincia = { [Op.like]: `%${provincia}%` };
      // si querés que sea exacto:
      // whereVendedor.provincia = provincia;
    }

    // 🆕 filtro por vendedor puntual
    if (vendedorId) {
      whereVendedor.id = vendedorId; // OJO: viene como string, pero Sequelize lo castea sin drama
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
      attributes: ["id", "nombre", "email", "localidad", "provincia"],
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

      // 💰 COMISIONES DEL SUPERVISOR
      const totalComisionSupervisor = ventas.reduce(
        (acc, x) => acc + (x.comisionSupervisor || 0),
        0
      );

      const totalPagadoSupervisor = ventas
        .filter((x) => x.pagadoSupervisor)
        .reduce((acc, x) => acc + (x.comisionSupervisor || 0), 0);

      const totalPendienteSupervisor =
        totalComisionSupervisor - totalPagadoSupervisor;

      // 💵 COMISIONES DEL VENDEDOR
      const totalComisionVendedor = ventas.reduce(
        (acc, x) => acc + (x.comision || 0),
        0
      );

      const totalPagadoVendedor = ventas
        .filter((x) => x.pagado)
        .reduce((acc, x) => acc + (x.comision || 0), 0);

      const totalPendienteVendedor =
        totalComisionVendedor - totalPagadoVendedor;

      return {
        id: v.id,
        nombre: v.nombre,
        email: v.email,
        localidad: v.localidad,
        provincia: v.provincia,
        totalVentas,

        // supervisor
        totalComisionSupervisor,
        totalPagadoSupervisor,
        totalPendienteSupervisor,

        // vendedor
        totalComisionVendedor,
        totalPagadoVendedor,
        totalPendienteVendedor,
      };
    });

    res.json({ ok: true, vendedores: resultado });
  } catch (err) {
    console.error("❌ supervisor/vendedores-resumen:", err);
    res.status(500).json({ ok: false, error: "Error interno" });
  }
});

// =====================================================
// 3️⃣ ENVIAR ALERTA AL ADMINISTRADOR
//     POST /api/supervisor/alertas
// =====================================================
router.post("/alertas", async (req, res) => {
  try {
    const { vendedorId, tipo, mensaje } = req.body;

    if (!mensaje || !tipo) {
      return res
        .status(400)
        .json({ error: "Falta mensaje o tipo de alerta" });
    }

    const alerta = await AlertasSupervisor.create({
      supervisorId: req.panelUser.id,
      vendedorId: vendedorId || null,
      tipo,
      mensaje,
    });

    res.json({ ok: true, alerta });
  } catch (err) {
    console.error("❌ Error enviando alerta:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// =====================================================
// 4️⃣ LISTAR ALERTAS ENVIADAS POR EL SUPERVISOR
//     GET /api/supervisor/alertas
// =====================================================
// GET /api/supervisor/alertas?estado=pendientes|resueltas|todas&provincia=...&email=...

// GET /api/supervisor/alertas
// routes/supervisor.js (dentro del GET /alertas)


router.get("/alertas", async (req, res) => {
  try {
    const supervisorId = req.panelUser.id;
    const { estado, provincia, email } = req.query;

    const whereAlertas = { supervisorId };

    if (estado === "pendientes") whereAlertas.leida = false;
    else if (estado === "resueltas") whereAlertas.leida = true;

    const alertas = await AlertasSupervisor.findAll({
      where: whereAlertas,
      include: [
        {
          model: ParteTecnica,
          as: "vendedor", // 👈 alias EXACTO al de models/model.js
          attributes: [
            "id",
            "nombre",
            "email",
            "documento",
            "provincia",
            "localidad",
            "bloqueado",
            "telefono",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // filtros extra en memoria
    let filtradas = alertas;

    if (provincia) {
      const provLower = String(provincia).toLowerCase();
      filtradas = filtradas.filter((a) => {
        const v = a.vendedor;
        const zona = (v?.provincia || v?.localidad || "").toLowerCase();
        return zona.includes(provLower);
      });
    }

    if (email) {
      const emailLower = String(email).toLowerCase();
      filtradas = filtradas.filter((a) =>
        a.vendedor?.email?.toLowerCase().includes(emailLower)
      );
    }

    return res.json({ ok: true, alertas: filtradas });
  } catch (err) {
    console.error("❌ Error en GET /supervisor/alertas:", err);
    return res.status(500).json({
      ok: false,
      error: "Error interno al cargar alertas",
    });
  }
});



// POST /api/supervisor/alertas/:alertaId/marcar-leida
router.post("/alertas/:alertaId/marcar-leida", async (req, res) => {
  try {
    const supervisorId = req.panelUser.id;
    const { alertaId } = req.params;
    const { observacion } = req.body;
    const { AlertasSupervisor } = require("../models/model");

    if (!observacion || observacion.trim().length < 3) {
      return res.status(400).json({
        ok: false,
        error: "Debés escribir una observación de al menos 3 caracteres.",
      });
    }

    const alerta = await AlertasSupervisor.findOne({
      where: { id: alertaId, supervisorId },
    });

    if (!alerta) {
      return res
        .status(404)
        .json({ ok: false, error: "Alerta no encontrada." });
    }

    alerta.leida = true;
    alerta.observacion = observacion; // 👈 guarda cómo la resolvió
    await alerta.save();

    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ Error marcar-leida:", err);
    return res.status(500).json({
      ok: false,
      error: "Error interno al marcar alerta como resuelta.",
    });
  }
});


// POST /api/supervisor/alertas/:alertaId/desbloquear-vendedor
router.post("/alertas/:alertaId/desbloquear-vendedor", async (req, res) => {
  try {
    const supervisorId = req.panelUser.id;
    const { alertaId } = req.params;
    const { observacion } = req.body;

    const { AlertasSupervisor, ParteTecnica } = require("../models/model");

    if (!observacion || observacion.trim().length < 3) {
      return res.status(400).json({
        ok: false,
        error: "Debés escribir una observación de al menos 3 caracteres.",
      });
    }

    // Buscar alerta original
    const alerta = await AlertasSupervisor.findOne({
      where: { id: alertaId, supervisorId },
    });

    if (!alerta || !alerta.vendedorId) {
      return res.status(404).json({ ok: false, error: "Alerta no encontrada." });
    }

    // Buscar vendedor
    const vendedor = await ParteTecnica.findByPk(alerta.vendedorId);
    if (!vendedor) {
      return res.status(404).json({ ok: false, error: "Vendedor no encontrado." });
    }

    // Desbloquear
    vendedor.bloqueado = false;
    vendedor.intentosFallidos = 0;
    await vendedor.save();

    // Marcar alerta original como resuelta + guardar observación
    alerta.leida = true;
    alerta.observacion = observacion;
    await alerta.save();

    // Buscar supervisor para poner su nombre en la nota
    const supervisor = await ParteTecnica.findByPk(supervisorId);

    // Crear alerta al admin avisando del desbloqueo
    const admin = await ParteTecnica.findOne({ where: { rol: "admin" } });
    if (admin) {
      await AlertasSupervisor.create({
        supervisorId: admin.id, // se la mostramos al admin
        vendedorId: vendedor.id,
        tipo: "vendedor_desbloqueado",
        mensaje: `El supervisor ${supervisor?.nombre || supervisorId} desbloqueó al vendedor ${vendedor.nombre}.`,
        observacion: `Motivo informado por el supervisor: ${observacion}`,
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ Error al desbloquear vendedor:", err);
    return res.status(500).json({
      ok: false,
      error: "Error interno al desbloquear vendedor.",
    });
  }
});

// =====================================================
// 5️⃣ DETALLE DE UN VENDEDOR (datos + lista de ventas)
//     GET /api/supervisor/vendedor/:id
// =====================================================
router.get("/vendedor/:id", async (req, res) => {
  try {
    const vendedor = await ParteTecnica.findByPk(req.params.id, {
      attributes: [
        "id",
        "nombre",
        "email",
        "documento",
        "telefono",
        "provincia",
        "localidad",
        "bloqueado",
      ],
    });

    if (!vendedor) {
      return res.status(404).json({ ok: false, error: "Vendedor no encontrado" });
    }

const ventas = await VentaVendedor.findAll({
  where: { vendedorId: vendedor.id },
  include: [
    {
      model: uNegocio,
      attributes: ["id", "nombre", "provincia", "localidad"],
    },
  ],
  order: [["fechaVenta", "DESC"]],
})


    return res.json({ ok: true, vendedor, ventas });
  } catch (err) {
    console.error("❌ Error detalle vendedor:", err);
    return res.status(500).json({ ok: false, error: "Error interno" });
  }
});


// =====================================================
// 6️⃣ VENTAS DE UN VENDEDOR POR FECHAS
//     GET /api/supervisor/ventas-vendedor/:id?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// =====================================================
router.get("/ventas-vendedor/:id", async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const where = { vendedorId: req.params.id };

    if (desde && hasta) {
      where.fechaVenta = { [Op.between]: [desde, hasta] };
    } else if (desde) {
      where.fechaVenta = { [Op.gte]: desde };
    } else if (hasta) {
      where.fechaVenta = { [Op.lte]: hasta };
    }

    const ventas = await VentaVendedor.findAll({
      where,
      include: [{ model: uNegocio, attributes: ["nombre", "email"] }],
      order: [["fechaVenta", "DESC"]],
    });

    res.json({ ok: true, ventas });
  } catch (err) {
    console.error("❌ Error ventas-vendedor:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// =====================================================
// 7️⃣ GESTIÓN DE VENDEDORES POR PROVINCIA (Supervisor)
//     - Listar por provincia + búsqueda
//     - Dar de alta
//     - Dar de baja / reactivar
// =====================================================

/**
 * GET /api/supervisor/gestion-vendedores?provincia=San%20Luis&q=juan
 * Lista vendedores de una provincia, con filtro opcional por nombre/email.
 */
// =====================================================
// 7️⃣ GESTIÓN DE VENDEDORES POR PROVINCIA (Supervisor)
//     - Listar por provincia + búsqueda
//     - Dar de alta (password = documento, debeCambiarPassword = true)
//     - Dar de baja / reactivar (bloqueado)
// =====================================================

/**
 * GET /api/supervisor/gestion-vendedores?provincia=San%20Luis&q=juan
 * Lista vendedores de una provincia, con filtro opcional por nombre/email.
 */
router.get("/gestion-vendedores", async (req, res) => {
  try {
    const { provincia, q } = req.query;

    if (!provincia) {
      return res
        .status(400)
        .json({ error: "Tenés que enviar la provincia en el query." });
    }

    const where = {
      rol: "vendedor",
      provincia: provincia, // 👈 ahora usamos la columna provincia
    };

    if (q) {
      where[Op.or] = [
        { nombre: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
      ];
    }

    const vendedores = await ParteTecnica.findAll({
      where,
      attributes: [
        "id",
        "nombre",
        "email",
        "provincia",
        "aliasPago",
        "documento",
        "bloqueado",
      ],
      order: [["nombre", "ASC"]],
    });

    const resultado = vendedores.map((v) => ({
      id: v.id,
      nombre: v.nombre,
      email: v.email,
      provincia: v.provincia,
      aliasPago: v.aliasPago,
      documento: v.documento,
      activo: !v.bloqueado,
    }));

    res.json({ ok: true, vendedores: resultado });
  } catch (err) {
    console.error("❌ supervisor/gestion-vendedores (GET):", err);
    res.status(500).json({ error: "Error interno" });
  }
});

/**
 * POST /api/supervisor/gestion-vendedores
 * body: { nombre, email, provincia, documento, aliasPago? }
 * Crea un nuevo vendedor:
 *  - password inicial = documento (hasheado)
 *  - debeCambiarPassword = true  → al primer login lo obligás a cambiarla
 */
router.post("/gestion-vendedores", async (req, res) => {
  try {
    const { nombre, email, provincia, documento, aliasPago ,telefono} = req.body;

    if (!nombre || !email || !provincia || !documento || !telefono) {
      return res.status(400).json({
        error: "Faltan datos. Enviá nombre, email, provincia, telefono y documento.",
      });
    }

    // Evitar duplicados por email
    const existe = await ParteTecnica.findOne({
      where: { email, rol: "vendedor" },
    });

    if (existe) {
      return res
        .status(400)
        .json({ error: "Ya existe un vendedor con ese email." });
    }

    // 🔐 Password inicial = documento (hasheado)
    const passwordHash = await bcrypt.hash(documento, 10);

    const nuevo = await ParteTecnica.create({
      nombre,
      email,
      documento,
      provincia,
      telefono,
      aliasPago: aliasPago || null,
      localidad: null, // si después querés usar ciudad, la cargás aparte
      rol: "vendedor",
      password: passwordHash,
      bloqueado: false,
      intentosFallidos: 0,
      debeCambiarPassword: true, // 👈 importantísimo
    });

    res.json({
      ok: true,
      vendedor: {
        id: nuevo.id,
        nombre: nuevo.nombre,
        email: nuevo.email,
        telefono:nuevo.telefono,
        provincia: nuevo.provincia,
        aliasPago: nuevo.aliasPago,
        documento: nuevo.documento,
        activo: !nuevo.bloqueado,
      },
    });
  } catch (err) {
    console.error("❌ supervisor/gestion-vendedores (POST):", err);
    res.status(500).json({ error: "Error interno" });
  }
});

/**
 * PATCH /api/supervisor/gestion-vendedores/:id/estado
 * body: { activo: true/false }
 * Sirve para dar de baja (activo=false) o reactivar (activo=true).
 */
router.patch("/gestion-vendedores/:id/estado", async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    if (typeof activo !== "boolean") {
      return res
        .status(400)
        .json({ error: "Tenés que enviar 'activo' true o false en el body." });
    }

    const vendedor = await ParteTecnica.findByPk(id);

    if (!vendedor || vendedor.rol !== "vendedor") {
      return res.status(404).json({ error: "Vendedor no encontrado." });
    }

    vendedor.bloqueado = !activo;
    await vendedor.save();

    res.json({
      ok: true,
      vendedor: {
        id: vendedor.id,
        nombre: vendedor.nombre,
        email: vendedor.email,
        provincia: vendedor.provincia,
        aliasPago: vendedor.aliasPago,
        documento: vendedor.documento,
        activo: !vendedor.bloqueado,
      },
    });
  } catch (err) {
    console.error("❌ supervisor/gestion-vendedores/:id/estado (PATCH):", err);
    res.status(500).json({ error: "Error interno" });
  }
});

router.get("/alertas/no-leidas", async (req, res) => {
  try {
    const supervisorId = req.panelUser.id;

    const cantidad = await AlertasSupervisor.count({
      where: {
        supervisorId,
        leida: false,
      },
    });

    return res.json({ ok: true, noLeidas: cantidad });
  } catch (err) {
    console.error("❌ Error en /alertas/no-leidas:", err);
    return res.status(500).json({
      ok: false,
      error: "Error interno verificando alertas",
    });
  }
});



module.exports = router;
