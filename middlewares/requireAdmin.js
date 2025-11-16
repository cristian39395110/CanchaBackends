// middleware/requireAdmin.js
const { Usuario } = require('../models/model') || {};
const sequelize = require('../config/database');

module.exports = async function requireAdmin(req, res, next) {
  try {
    // `autenticarToken` debe haber seteado req.usuarioId
    const usuarioId = req.usuarioId || req.userId || req.usuario?.id;

    if (!usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Obtené el usuario (ajustá según tu estructura real)
    let esAdmin = false;

    if (Usuario) {
      const u = await Usuario.findByPk(usuarioId);
      esAdmin = !!u?.esAdmin;
    } else if (req.usuario && typeof req.usuario.esAdmin !== 'undefined') {
      esAdmin = !!req.usuario.esAdmin;
    }

    if (!esAdmin) {
      return res.status(403).json({ error: 'Solo administradores' });
    }

    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    res.status(500).json({ error: 'Error validando admin' });
  }
};
