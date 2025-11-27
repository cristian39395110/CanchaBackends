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

    // 2) Calcular estado de premium
    let esPremiumReal = !!usuario.esPremium;
    let diasRestantes = null;
    let premiumVencido = false;

    if (usuario.fechaFinPremium) {
      const hoy = new Date();
      const fin = new Date(usuario.fechaFinPremium);

      const diffMs = fin.getTime() - hoy.getTime();
      const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24)); // redondeo hacia arriba

      if (diffDias < 0) {
        // Premium vencido → bajar bandera en la base si seguía true
        if (usuario.esPremium) {
          usuario.esPremium = false;
          await usuario.save();
        }
        esPremiumReal = false;
        premiumVencido = true;
        diasRestantes = 0;
      } else {
        diasRestantes = diffDias;
      }
    }

    // 3) Meter en req.negocio el estado real
    req.negocio = {
      id: usuario.id,
      esAdmin: usuario.esAdmin,
      esPremium: esPremiumReal,
      email: usuario.email,
      nombre: usuario.nombre,
      fechaFinPremium: usuario.fechaFinPremium,
      diasRestantesPremium: diasRestantes,
      premiumVencido,
    };

    return next();
  } catch (err) {
    console.error("authNegocio", err);
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

module.exports = { autenticarTokenNegocio };
