// middlewares/authNegocio.js
const jwt = require("jsonwebtoken");
const { uUsuarioNegocio } = require("../models/model");

async function autenticarTokenNegocio(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Falta token" });

  const SECRET_KEY = process.env.SECRET_KEY || "clave-ultra-secreta";

  try {
    const decoded = jwt.verify(token, SECRET_KEY);

    // ✅ Solo necesito el id, NO me interesa el rol del token
    const usuario = await uUsuarioNegocio.findByPk(decoded.id);
    if (!usuario) return res.status(401).json({ error: "Usuario no encontrado" });

    // ✅ Premium real desde BD
    let esPremiumReal = !!usuario.esPremium;

    // (tu lógica de vencimiento igual)
    let diasRestantes = null;
    let premiumVencido = false;

    if (usuario.fechaFinPremium) {
      const hoy = new Date();
      const fin = new Date(usuario.fechaFinPremium);
      const diffMs = fin.getTime() - hoy.getTime();
      const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDias < 0) {
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

    // ✅ ACA BLOQUEÁS: si no es premium real, afuera
    if (!esPremiumReal) {
      return res.status(403).json({ ok: false, error: "Premium requerido" });
    }

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
