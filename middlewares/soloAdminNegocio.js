// middlewares/soloAdminNegocio.js
function soloAdminNegocio(req, res, next) {
  if (!req.negocio?.esAdmin) {
    return res.status(403).json({ error: 'Solo administradores pueden acceder.' });
  }
  next();
}

function soloPremiumNegocio(req, res, next) {
  if (!req.negocio?.esPremium) {
    return res.status(403).json({ error: 'Requiere cuenta premium.' });
  }
  next();
}

module.exports = { soloAdminNegocio, soloPremiumNegocio };
