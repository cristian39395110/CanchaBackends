function requirePremiumNegocio(req, res, next) {
  if (!req.negocio?.esPremium || req.negocio?.premiumVencido) {
    return res.status(403).json({ ok: false, error: "Requiere Premium" });
  }
  next();
}
