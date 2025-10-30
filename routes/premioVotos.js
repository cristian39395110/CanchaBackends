const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { autenticarToken } = require('../middlewares/auth');
const { Usuario, Concurso, VotoPremio } = require('../models');

function assertActivo(c) {
  if (!c || !c.activo) throw new Error('No hay votación activa');
}

// obtener o crear concurso base
async function ensureConcurso() {
  const [c] = await Concurso.findOrCreate({ where: { id: 1 }, defaults: { activo: true } });
  return c;
}

// POST /api/premio/votar
router.post('/votar', autenticarToken, async (req, res) => {
  try {
    const { candidatoId } = req.body;
    const usuarioId = req.usuario.id;
    const c = await ensureConcurso();
    assertActivo(c);

    if (usuarioId === candidatoId)
      return res.status(400).json({ error: 'No podés votarte a vos mismo' });

    await VotoPremio.create({ usuarioId, candidatoId, concursoId: c.id });

    // Emitimos a todos los clientes conectados (Socket.IO)
    req.io.emit('votos-actualizados');
    res.json({ ok: true });
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError')
      return res.status(400).json({ error: 'Ya votaste en este concurso' });
    console.error('POST /votar', e);
    res.status(500).json({ error: e.message || 'Error al votar' });
  }
});

// GET /api/premio/votos
router.get('/votos', async (_req, res) => {
  try {
    const votos = await VotoPremio.findAll({
      attributes: ['candidatoId', [sequelize.fn('COUNT', sequelize.col('candidatoId')), 'votos']],
      group: ['candidatoId'],
      raw: true,
    });

    // unimos con nombre/foto
    const candidatos = await Usuario.findAll({
      attributes: ['id', 'nombre', 'fotoPerfil'],
      where: { id: { [Op.in]: votos.map(v => v.candidatoId) } },
    });

    const ranking = votos.map(v => {
      const u = candidatos.find(c => c.id === v.candidatoId);
      return { ...u?.toJSON(), votos: Number(v.votos) };
    }).sort((a, b) => b.votos - a.votos);

    res.json({ ranking });
  } catch (e) {
    console.error('GET /votos', e);
    res.status(500).json({ error: 'Error al contar votos' });
  }
});

module.exports = router;
