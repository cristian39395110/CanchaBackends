// middlewares/authUsuarioNegocio.js
const jwt = require("jsonwebtoken");
const { uUsuarioNegocio } = require("../models/model");

async function autenticarUsuarioNegocio(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Falta token" });

  try {
    const SECRET_KEY = process.env.SECRET_KEY || "clave-ultra-secreta";
    const decoded = jwt.verify(token, SECRET_KEY);

    // 💡 Por las dudas, dejamos pasar tanto "usuarioNegocio" como "negocio"
    if (decoded.rol !== "usuarioNegocio" && decoded.rol !== "negocio") {
      return res.status(403).json({ error: "Rol inválido" });
    }

    const usuario = await uUsuarioNegocio.findByPk(decoded.id);
    if (!usuario) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    // 👇 para código nuevo
    req.user = usuario;

    // 👇 compatibilidad con rutas viejas que usan req.negocio.id
    req.negocio = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      // si en algún lado esperás provincia/localidad también podés pasarlas:
      provincia: usuario.provincia,
      localidad: usuario.localidad,
    };

    next();
  } catch (err) {
    console.error("authUsuarioNegocio", err);
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

module.exports = { autenticarUsuarioNegocio };
