const jwt = require('jsonwebtoken');
const { uUsuariosNegocio } = require('../models/model');

function autenticarTokenNegocio(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.sendStatus(403);

    try {
      // Buscamos el usuario de negocio
      const negocio = await uUsuariosNegocio.findByPk(decoded.id);
      if (!negocio) return res.sendStatus(401);

      req.negocio = negocio; // similar a req.usuario
      next();
    } catch (e) {
      console.error('❌ Error en autenticarTokenNegocio:', e);
      res.sendStatus(500);
    }
  });
}

module.exports = { autenticarTokenNegocio };
