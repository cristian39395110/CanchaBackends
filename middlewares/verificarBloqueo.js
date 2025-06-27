const { Bloqueo } = require('../models/model');
const { Op } = require('sequelize');

const verificarBloqueo = async (req, res, next) => {
  try {
    const body = req.body || {};
    const query = req.query || {};
    const params = req.params || {};

    const usuarioId = Number(
      body.usuarioId || body.emisorId || query.usuarioId || params.usuarioId
    );
    const otroUsuarioId = Number(
      body.receptorId || body.bloqueadoId || query.receptorId || params.receptorId || body.destinatarioId
    );

    // Si no hay dos ids válidos, seguimos
    if (!usuarioId || !otroUsuarioId || usuarioId === otroUsuarioId) return next();

    const bloqueo = await Bloqueo.findOne({
      where: {
        usuarioId: otroUsuarioId,
        bloqueadoId: usuarioId
      }
    });

    if (bloqueo) {
      return res.status(403).json({ error: '⛔ Estás bloqueado por este usuario.' });
    }

    next();
  } catch (err) {
    console.error('❌ Error en verificarBloqueo:', err);
    res.status(500).json({ error: 'Error interno en middleware de bloqueo' });
  }
};

module.exports = verificarBloqueo;
