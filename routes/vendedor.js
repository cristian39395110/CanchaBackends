// routes/vendedor.js
const express = require("express");
const router = express.Router();

const {
  ParteTecnica,
  VentaVendedor,
  uNegocio,

  uUsuarioNegocio,
  AlertasSupervisor,
} = require("../models/model");

const autenticarPanel = require("../middlewares/autenticarPanel");

// 🔐 Primero exigimos que esté logueado en el panel
router.use(autenticarPanel);

// 🔐 Y que el rol sea "vendedor"
router.use((req, res, next) => {
  try {
    if (!req.panelUser || req.panelUser.rol !== "vendedor") {
      return res.status(403).json({ error: "Acceso solo para vendedores" });
    }
    next();
  } catch (err) {
    console.error("Error en middleware vendedor:", err);
    return res.status(500).json({ error: "Error de autenticación de vendedor" });
  }
});

/**
 * GET /api/ventas/mias
 * Lista de ventas del vendedor logueado
 */
router.get("/mias", async (req, res) => {
  try {
    const panelUserId = req.panelUser.id;

    // En tu modelo ParteTecnica el id ES el usuario de panel
    const parteTecnica = await ParteTecnica.findByPk(panelUserId);

    if (!parteTecnica) {
      // Si el vendedor no tiene ParteTecnica asociada, devolvemos lista vacía
      return res.json({ ok: true, ventas: [] });
    }

    const ventasDB = await VentaVendedor.findAll({
      where: {
        vendedorId: parteTecnica.id, // 👈 coincide con el modelo VentaVendedor
      },
      include: [
        {
          model: uNegocio,
          as: "uNegocio",                 // 👈 ALIAS OBLIGATORIO
          attributes: ["id", "nombre"],   // uNegocio NO tiene email
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const ventas = ventasDB.map((v) => ({
      id: v.id,
      nombreNegocio: v.uNegocio
        ? v.uNegocio.nombre
        : "Negocio sin nombre",          // 👈 usar v.uNegocio, no v.Negocio
      fechaVenta: v.fechaVenta || v.createdAt,
      comision: v.comision || 0,
      pagado: !!v.pagado,
    }));

    return res.json({ ok: true, ventas });
  } catch (err) {
    console.error("❌ GET /api/ventas/mias:", err?.message, err?.stack);
    return res
      .status(500)
      .json({ ok: false, error: "Error al cargar ventas" });
  }
});

/**
 * POST /api/ventas/registrar
 * Body: { email }
 * Registra una venta para el negocio cuyo email se envía.
 */
router.post("/registrar", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ ok: false, error: "El email es obligatorio" });
  }

  try {
    const panelUserId = req.panelUser.id;

    // 1) Buscamos al vendedor del panel
    const parteTecnica = await ParteTecnica.findByPk(panelUserId);

    if (!parteTecnica) {
      return res
        .status(400)
        .json({ ok: false, error: "No se encontró el perfil del vendedor" });
    }

    if (parteTecnica.bloqueado) {
      return res.status(403).json({
        ok: false,
        error: "Tu usuario está bloqueado. Contactá a tu supervisor.",
      });
    }

    // Función para registrar intento fallido
    const registrarIntentoFallido = async () => {
      parteTecnica.intentosFallidos = (parteTecnica.intentosFallidos || 0) + 1;

      let seBloqueoAhora = false;

      if (parteTecnica.intentosFallidos >= 3) {
        parteTecnica.bloqueado = true;
        seBloqueoAhora = true;
      }

      await parteTecnica.save();

      // Crear alerta si se bloqueó
      if (seBloqueoAhora) {
      const supervisor = await ParteTecnica.findOne({
  where: {
    rol: "supervisor",
  },
});

        if (supervisor) {
          await AlertasSupervisor.create({
            supervisorId: supervisor.id,
            vendedorId: parteTecnica.id,
            tipo: "vendedor_bloqueado",
            mensaje: `El vendedor ${parteTecnica.nombre} fue bloqueado por ingresar 3 veces mal el email de negocio.`,
          });
        }
      }

      return seBloqueoAhora;
    };

    // 2) Buscar usuario del negocio (uUsuarioNegocio)
    const usuarioNegocio = await uUsuarioNegocio.findOne({
      where: { email },
    });

    if (!usuarioNegocio) {
      const seBloqueo = await registrarIntentoFallido();

      return res.status(404).json({
        ok: false,
        error: seBloqueo
          ? "Ingresaste mal el email 3 veces. Tu usuario fue bloqueado."
          : "No existe un usuario con ese email.",
      });
    }

    // 3) Validar premium dentro de 3 horas
    if (!usuarioNegocio.esPremium || !usuarioNegocio.fechaInicioPremium) {
      return res.status(400).json({
        ok: false,
        error: "Solo se pueden registrar ventas de usuarios premium activos.",
      });
    }

    const ahora = new Date();
    const fechaInicio = new Date(usuarioNegocio.fechaInicioPremium);
    const horasPasadas = (ahora - fechaInicio) / (1000 * 60 * 60);

    if (horasPasadas > 3) {
      return res.status(400).json({
        ok: false,
        error:
          "Solo se puede registrar la venta dentro de las primeras 3 horas desde que el negocio activó su premium.",
      });
    }

    // 4) Obtener el negocio (uNegocio)
    const negocio = await uNegocio.findOne({
      where: { ownerId: usuarioNegocio.id },
    });

    if (!negocio) {
      return res.status(404).json({
        ok: false,
        error: "No existe un negocio asociado a este usuario.",
      });
    }

    // 5) Evitar doble registro
    const ventaExistente = await VentaVendedor.findOne({
      where: { negocioId: negocio.id },
    });

    if (ventaExistente) {
      return res.status(400).json({
        ok: false,
        error: "Ya existe una venta registrada para este negocio.",
      });
    }

    // 6) Crear venta
    const nuevaVenta = await VentaVendedor.create({
      vendedorId: parteTecnica.id,
      negocioId: negocio.id,
      fechaVenta: new Date(),
    });

    // 7) Resetear intentos fallidos si había
    if (parteTecnica.intentosFallidos > 0) {
      parteTecnica.intentosFallidos = 0;
      await parteTecnica.save();
    }

    return res.json({
      ok: true,
      mensaje: "Venta registrada correctamente",
      venta: {
        id: nuevaVenta.id,
        nombreNegocio: negocio.nombre,
        fechaVenta: nuevaVenta.fechaVenta,
        comision: nuevaVenta.comision,
        pagado: nuevaVenta.pagado,
      },
    });
  } catch (err) {
    console.error("❌ POST /api/ventas/registrar:", err);
    return res.status(500).json({
      ok: false,
      error: "Error interno al registrar la venta",
    });
  }
});

module.exports = router;
