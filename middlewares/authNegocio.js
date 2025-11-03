// middlewares/authNegocio.js
const jwt = require('jsonwebtoken');

function autenticarTokenNegocio(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Falta token' });

  const SECRET_KEY = process.env.SECRET_KEY || 'clave-ultra-secreta';

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    if (decoded.rol !== 'negocio') {
      return res.status(403).json({ error: 'Rol inválido' });
    }

    // 👇 queda disponible en req.negocio
    req.negocio = {
      id: decoded.id,
      esAdmin: !!decoded.esAdmin,
      esPremium: !!decoded.esPremium,
      email: decoded.email,
      nombre: decoded.nombre,
    };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = { autenticarTokenNegocio };
