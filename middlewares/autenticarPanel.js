const jwt = require("jsonwebtoken");
const { ParteTecnica } = require("../models/model"); // si la exportaste desde model.js

const SECRET_PANEL = process.env.SECRET_PANEL || "panel_super_secreto";

module.exports = async function autenticarPanel(req, res, next) {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ ok: false, error: "Falta token" });
  }

  const token = header.split(" ")[1];

  try {
    const payload = jwt.verify(token, SECRET_PANEL);
    const user = await ParteTecnica.findByPk(payload.id);

    if (!user) {
      return res.status(401).json({ ok: false, error: "Usuario no válido" });
    }

    req.panelUser = user; // 👈 guardamos el usuario del panel
    next();
  } catch (err) {
    console.error("❌ Error autenticarPanel:", err);
    return res.status(401).json({ ok: false, error: "Token inválido" });
  }
};
