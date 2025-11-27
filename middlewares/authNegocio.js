// middlewares/authNegocio.js
const jwt = require("jsonwebtoken");
const { uUsuarioNegocio } = require("../models/model");

async function autenticarTokenNegocio(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Falta token" });
  }

  const SECRET_KEY = process.env.SECRET_KEY || "clave-ultra-secreta";

  try {
    const decoded = jwt.verify(token, SECRET_KEY);

    if (decoded.rol !== "negocio") {
      return res.status(403).json({ error: "Rol inválido" });
    }

    // 1) Buscar el usuario real en la base
    const usuario = await uUsuarioNegocio.findByPk(decoded.id);

    if (!usuario) {
      return res.status(401).json({ error: "Negocio no encontrado" });
    }

    // 2) Verificar fecha de premium
    let esPremiumReal = usuario.esPremium;

    if (usuario.esPremium && usuario.fechaFinPremium) {
      const hoy = new Date();
      const fin = new Date(usuario.fechaFinPremium);

      if (hoy > fin) {
        // Premium vencido → bajar en la base
        await uUsuarioNegocio.update(
          { esPremium: false },
          { where: { id: usuario.id }
        });

        esPremiumReal = false;
      }
    }

    // 👉 Si ya NO es premium (nunca tuvo o venció) devolvés 403 acá
    if (!esPremiumReal) {
      return res
        .status(403)
        .json({ error: "Requiere cuenta premium vigente." });
    }

    // 3) Meter en req.negocio el estado real
    req.negocio = {
      id: usuario.id,
      esAdmin: usuario.esAdmin,
      esPremium: esPremiumReal,
      email: usuario.email,
      nombre: usuario.nombre,
    };

    return next();
  } catch (err) {
    console.error("authNegocio", err);
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

module.exports = { autenticarTokenNegocio };
