const jwt = require('jsonwebtoken');
const { uUsuarioNegocio } = require('../models/model');

/**
 * Middleware para autenticar usuarios de negocio
 */
async function autenticarTokenNegocio(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Falta token' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    // Buscar en tabla uUsuariosNegocio
    const negocioUser = await uUsuarioNegocio.findByPk(decoded.id);
    if (!negocioUser) {
      return res.status(401).json({ error: 'Usuario negocio no encontrado' });
    }

    req.negocio = negocioUser;
    next();
  } catch (err) {
    console.error('❌ Error en autenticarTokenNegocio:', err);
    return res.status(403).json({ error: 'Token no válido' });
  }
}

module.exports = { autenticarTokenNegocio };
