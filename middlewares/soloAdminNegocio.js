/**
 * Middleware para permitir solo a administradores de negocio
 */
function soloAdminNegocio(req, res, next) {
  if (!req.negocio || !req.negocio.esAdmin) {
    return res.status(403).json({ error: 'Solo administradores pueden acceder.' });
  }
  next();
}

module.exports = { soloAdminNegocio };
