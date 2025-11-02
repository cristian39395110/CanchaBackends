const jwt = require('jsonwebtoken');
const { uUsuariosNegocio } = require('../models/model');

function autenticarTokenNegocio(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.sendStatus(401);

  // 👇 Usa el mismo SECRET_KEY que el login
  const SECRET_KEY = process.env.SECRET_KEY || 'clave-ultra-secreta';

  jwt.verify(token, SECRET_KEY, async (err, decoded) => {
    if (err) return res.sendStatus(403);

    try {
      const negocio = await uUsuariosNegocio.findByPk(decoded.id);
      if (!negocio) return res.sendStatus(401);

      req.negocio = negocio; // igual que req.usuario
      next();
    } catch (e) {
      console.error('❌ Error en autenticarTokenNegocio:', e);
      res.sendStatus(500);
    }
  });
}

module.exports = { autenticarTokenNegocio };
