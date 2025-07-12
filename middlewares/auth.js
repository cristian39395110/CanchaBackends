function autenticarToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, usuario) => {
    if (err) return res.sendStatus(403);
    req.usuario = usuario; // Guarda { id, email, premium, esAdmin }
    next();
  });
}

module.exports = { autenticarToken };
