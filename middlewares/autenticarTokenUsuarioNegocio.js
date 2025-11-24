// middlewares/autenticarTokenUsuarioNegocio.js
const jwt = require('jsonwebtoken');

function autenticarTokenUsuarioNegocio(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Falta token' });

  const SECRET_KEY = process.env.SECRET_KEY || 'clave-ultra-secreta';

  try {
    const decoded = jwt.verify(token, SECRET_KEY);

    // 👉 este token DEBE venir con rol 'usuario_negocio'
    if (decoded.rol !== 'usuario_negocio') {
      return res.status(403).json({ error: 'Solo usuarios pueden acceder.' });
    }

    // guardamos el usuario en req.usuarioNegocio
    req.usuarioNegocio = {
      id: decoded.id,
      email: decoded.email,
      nombre: decoded.nombre,
      esPremium: !!decoded.esPremium,
      esAdmin: !!decoded.esAdmin,
    };

    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = { autenticarTokenUsuarioNegocio };
