const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// Si exportás ParteTecnica desde models/model.js:
const { ParteTecnica } = require("../models/model");

// Middlewares que vos ya tenés
const autenticarPanel = require("../middlewares/autenticarPanel");
const { soloAdmin } = require("../middlewares/rolesPanel");

const SECRET_PANEL = process.env.SECRET_PANEL || "panel_super_secreto";



router.post("/cambiar-password", autenticarPanel, async (req, res) => {
  try {
    const { passwordNueva } = req.body;

    if (!passwordNueva || passwordNueva.length < 6) {
      return res
        .status(400)
        .json({ ok: false, error: "La contraseña debe tener al menos 6 caracteres." });
    }

    const usuario = await ParteTecnica.findByPk(req.panelUser.id);

    if (!usuario) {
      return res.status(404).json({ ok: false, error: "Usuario no encontrado." });
    }

    // 👇 Ya NO puede cambiarla: solo supervisor
    if (!usuario.debeCambiarPassword) {
      return res.status(403).json({
        ok: false,
        error:
          "Ya configuraste tu contraseña. Si necesitás cambiarla, contactá a tu supervisor.",
      });
    }

    const hash = await bcrypt.hash(passwordNueva, 10);
    usuario.password = hash;
    usuario.debeCambiarPassword = false; // ✅ Ya no se vuelve a mostrar
    usuario.intentosFallidos = 0;
    await usuario.save();

    return res.json({ ok: true, mensaje: "Contraseña actualizada correctamente." });
  } catch (err) {
    console.error("❌ POST /api/tecnicocomercio/cambiar-password:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Error interno al cambiar la contraseña." });
  }
});



// POST /api/supervisor/vendedor/:id/reset-password
router.post("/vendedor/:id/reset-password", async (req, res) => {
  try {
    const { id } = req.params;
    const { nuevaPassword } = req.body; // o podés generar una fija tipo "123456"

    const vendedor = await ParteTecnica.findByPk(id);

    if (!vendedor || vendedor.rol !== "vendedor") {
      return res
        .status(404)
        .json({ ok: false, error: "Vendedor no encontrado." });
    }

    const passwordFinal = nuevaPassword || "PuntoMas123"; // por ejemplo
    const hash = await bcrypt.hash(passwordFinal, 10);

    vendedor.password = hash;
    vendedor.debeCambiarPassword = true; // 👈 lo volvés a obligar al entrar
    await vendedor.save();

    return res.json({
      ok: true,
      mensaje:
        "Contraseña reseteada. El vendedor deberá cambiarla en su próximo ingreso.",
    });
  } catch (err) {
    console.error("❌ POST /api/supervisor/vendedor/:id/reset-password:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Error interno al resetear contraseña." });
  }
});


// ==============================
// 🔐 LOGIN TECNICO / COMERCIO
// POST /api/tecnicocomercio/login
// ==============================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

        console.log("📥 Login panel:", email);
    if (!email || !password)
      return res.status(400).json({ error: "Faltan datos" });

    const user = await ParteTecnica.findOne({ where: { email } });

    if (!user)
      return res.status(404).json({ error: "Usuario no encontrado" });

    // Si está bloqueado
    if (user.bloqueado) {
      return res.status(423).json({
        ok: false,
        error: "Usuario bloqueado. Contacte al administrador.",
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      // Suma intento
      user.intentosFallidos += 1;

      // Si llega a 5 → bloquear
      if (user.intentosFallidos >= 5) {
        user.bloqueado = true;
      }

      await user.save();

      return res.status(401).json({
        ok: false,
        error:
          user.bloqueado
            ? "Usuario bloqueado por muchos intentos. Contacte al administrador."
            : `Contraseña incorrecta. Intentos: ${user.intentosFallidos}/5`,
      });
    }

    // Si la contraseña es correcta → resetear intentos
    user.intentosFallidos = 0;
    await user.save();

    // Token del panel admin
    const token = jwt.sign(
      {
        id: user.id,
        rol: user.rol,
        nombre: user.nombre,
      },
      SECRET_PANEL,
      { expiresIn: "30d" }
    );

    return res.json({
      ok: true,
      token,
      rol: user.rol,
      nombre: user.nombre,
      localidad: user.localidad,
      debeCambiarPassword: user.debeCambiarPassword,
    });
  } catch (err) {
    console.error("❌ Error en /tecnicocomercio/login:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});


// ==============================
// 👑 CREAR USUARIO PANEL (solo admin)
// POST /api/tecnicocomercio/crear
// ==============================
router.post("/crear", autenticarPanel, soloAdmin, async (req, res) => {
  try {
    const {
      nombre,
      email,
      documento,
      rol,              // 'admin' | 'supervisor' | 'vendedor'
      localidad,
      provincia,
      idVendedorAsignado,
    } = req.body;

    if (!nombre || !email || !documento || !rol  || !provincia ) {
      return res
        .status(400)
        .json({ ok: false, error: "Faltan datos obligatorios" });
    }

    const rolesValidos = ["admin", "supervisor", "vendedor"];
    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({ ok: false, error: "Rol inválido" });
    }

    const yaExiste = await ParteTecnica.findOne({ where: { email } });
    if (yaExiste) {
      return res
        .status(409)
        .json({ ok: false, error: "Ese email ya está registrado" });
    }

    // Primera contraseña = DOCUMENTO (encriptada)
    const passwordHasheada = await bcrypt.hash(documento, 10);

    const nuevo = await ParteTecnica.create({
      nombre,
      email,
      documento,
      password: passwordHasheada,
      rol,
        provincia,
      localidad: localidad || null,
      idVendedorAsignado: idVendedorAsignado || null,
      debeCambiarPassword: true, // 👈 obliga a cambiar en el primer login
    });

    return res.status(201).json({
      ok: true,
      usuario: {
        id: nuevo.id,
        nombre: nuevo.nombre,
        email: nuevo.email,
        documento: nuevo.documento,
        rol: nuevo.rol,
        provincia: nuevo.provincia,
        localidad: nuevo.localidad,
        debeCambiarPassword: nuevo.debeCambiarPassword,
      },
    });
  } catch (err) {
    console.error("❌ Error en /tecnicocomercio/crear:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Error interno al crear usuario" });
  }
});


router.post("/desbloquear", autenticarPanel, soloAdmin, async (req, res) => {
  try {
    const { id } = req.body;

    const user = await ParteTecnica.findByPk(id);
    if (!user) return res.status(404).json({ ok: false, error: "No encontrado" });

    user.bloqueado = false;
    user.intentosFallidos = 0;
    await user.save();

    return res.json({ ok: true, mensaje: "Usuario desbloqueado" });
  } catch (err) {
    console.error("❌ Error al desbloquear:", err);
    return res.status(500).json({ ok: false, error: "Error interno" });
  }
});


// ==============================
// 🔁 CAMBIAR CONTRASEÑA PANEL
// POST /api/tecnicocomercio/cambiar-password
// ==============================
router.post("/cambiar-password", autenticarPanel, async (req, res) => {
  try {
    const { passwordActual, passwordNueva } = req.body;

    if (!passwordNueva) {
      return res
        .status(400)
        .json({ ok: false, error: "Falta la nueva contraseña" });
    }

    const user = req.panelUser;

    // Si NO es primer login, pedimos la actual
    if (!user.debeCambiarPassword) {
      if (!passwordActual) {
        return res
          .status(400)
          .json({ ok: false, error: "Falta la contraseña actual" });
      }

      const ok = await bcrypt.compare(passwordActual, user.password);
      if (!ok) {
        return res
          .status(401)
          .json({ ok: false, error: "Contraseña actual incorrecta" });
      }
    }

    const nuevaHasheada = await bcrypt.hash(passwordNueva, 10);

    user.password = nuevaHasheada;
    user.debeCambiarPassword = false;
    await user.save();

    return res.json({ ok: true, mensaje: "Contraseña actualizada" });
  } catch (err) {
    console.error("❌ Error en /tecnicocomercio/cambiar-password:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Error al cambiar contraseña" });
  }
});


// (Opcional) para que el front pregunte quién soy
router.get("/me", autenticarPanel, (req, res) => {
  const u = req.panelUser;
  return res.json({
    ok: true,
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    provinvia:u.provincia,
    localidad: u.localidad,
  });
});

module.exports = router;
