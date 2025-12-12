
// api/ganador/
const express = require('express');
const router = express.Router();
const { Op, fn, col, literal } = require('sequelize');

const { autenticarTokenNegocio } = require('../middlewares/authNegocio');

const {
  uCheckinNegocio,
  uNegocio,
  uUsuarioNegocio, // para traer nombres de usuarios en la lista
  Ganador,         // si no lo tenés, ver snippet al final
} = require('../models/model'); // ajustá tu import centralizado

/* ===========================================================
   Helper: resolver negocio por ownerId (token)
   =========================================================== */
async function getNegocioByOwner(req) {
  const ownerId = req.negocio?.id;        // <- ID del dueño desde el token
  if (!ownerId) return null;
  return await uNegocio.findOne({ where: { ownerId } });
}

/* ===========================================================
   GET /api/estadisticas/compact
   → { visitasHoy, usuariosUnicosHoy, usuariosUnicosMes, puntosOtorgadosHoy }
   =========================================================== */
router.get('/estadisticas/compact', autenticarTokenNegocio, async (req, res) => {
  try {
    const ownerId = req.negocio.id; // dueño
    const negocio = await uNegocio.findOne({ where: { ownerId } });

    if (!negocio) return res.status(404).json({ error: 'No se encontró negocio asociado' });

    const negocioId = negocio.id;

    const inicioHoy = new Date(); inicioHoy.setHours(0,0,0,0);
    const finHoy = new Date(); finHoy.setHours(23,59,59,999);
    const hace30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const visitasHoy = await uCheckinNegocio.count({
      where: { negocioId, createdAt: { [Op.between]: [inicioHoy, finHoy] } },
    });

    const usuariosUnicosHoyRow = await uCheckinNegocio.findOne({
      attributes: [[fn('COUNT', fn('DISTINCT', col('usuarioNegocioId'))), 'cuenta']],
      where: { negocioId, createdAt: { [Op.between]: [inicioHoy, finHoy] } },
      raw: true,
    });
    const usuariosUnicosHoy = Number(usuariosUnicosHoyRow?.cuenta || 0);

    const usuariosUnicosMesRow = await uCheckinNegocio.findOne({
      attributes: [[fn('COUNT', fn('DISTINCT', col('usuarioNegocioId'))), 'cuenta']],
      where: { negocioId, createdAt: { [Op.gte]: hace30d } },
      raw: true,
    });
    const usuariosUnicosMes = Number(usuariosUnicosMesRow?.cuenta || 0);

    const puntosHoyRow = await uCheckinNegocio.findOne({
      attributes: [[fn('SUM', col('puntosGanados')), 'suma']],
      where: { negocioId, createdAt: { [Op.between]: [inicioHoy, finHoy] } },
      raw: true,
    });
    const puntosOtorgadosHoy = Number(puntosHoyRow?.suma || 0);

    res.json({ visitasHoy, usuariosUnicosHoy, usuariosUnicosMes, puntosOtorgadosHoy });
  } catch (err) {
    console.error('Error /estadisticas/compact:', err);
    res.status(500).json({ error: 'No se pudieron obtener las estadísticas.' });
  }
});


/* ===========================================================
   GET /api/canjeos/hoy?limit=50
   → lista de canjeos de HOY para ese negocio
   → [{ id, nombre?, createdAt, puntosGanados }]
   =========================================================== */
router.get('/canjeos/hoy', autenticarTokenNegocio, async (req, res) => {
  try {
    const negocio = await getNegocioByOwner(req);
    if (!negocio) return res.status(404).json({ error: 'No se encontró negocio para este usuario' });

    const negocioId = negocio.id;
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 200));

    const inicioHoy = new Date(); inicioHoy.setHours(0,0,0,0);
    const finHoy    = new Date(); finHoy.setHours(23,59,59,999);

    const filas = await uCheckinNegocio.findAll({
      where: {
        negocioId,
        createdAt: { [Op.between]: [inicioHoy, finHoy] },
      },
      include: [
        {
          model: uUsuarioNegocio,
          attributes: ['id', 'nombre'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
    });

    const salida = filas.map(f => ({
      id: f.id,
      nombre: f.uUsuarioNegocio?.nombre || null,
      createdAt: f.createdAt,
      puntosGanados: f.puntosGanados,
    }));

    res.json(salida);
  } catch (err) {
    console.error('Error /canjeos/hoy:', err);
    res.status(500).json({ error: 'No se pudieron obtener los canjeos de hoy.' });
  }
});

/* ===========================================================
   GET /api/ganadores?limit=10
   → [{ id, nombre, premio, fecha }]
   * Filtra por negocio del dueño
   =========================================================== */
router.get('/ganadores', autenticarTokenNegocio, async (req, res) => {
  try {
    const negocio = await getNegocioByOwner(req);
    if (!negocio) return res.status(404).json({ error: 'No se encontró negocio para este usuario' });

    const negocioId = negocio.id;
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 100));

    const filas = await Ganador.findAll({
      where: { negocioId },
      attributes: ['id', 'nombre', 'premio', 'fecha'],  // 👈 FIX FINAL
      order: [['fecha', 'DESC']],
      limit,
    });

    const salida = filas.map(g => ({
      id: g.id,
      nombre: g.nombre,
      premio: g.premio,
      fecha: g.fecha,
    }));

    res.json(salida);
  } catch (err) {
    console.error('Error /ganadores:', err);
    res.status(500).json({ error: 'No se pudieron obtener los ganadores.' });
  }
});


module.exports = router;
