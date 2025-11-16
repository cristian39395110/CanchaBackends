// routes/retosVisibilidad.js
const express = require('express');
const router = express.Router();

const SorteoConfig = require('../models/SorteoConfig');

// ── IMPORTS ROBUSTOS (default o named) ────────────────────────────────────────
let authNegocioMod = null;
try {
  authNegocioMod = require('../middlewares/authNegocio'); // ajustá la ruta si tu carpeta es 'middleware'
} catch (e) {
  console.error('[retosVisibilidad] No se pudo require ../middlewares/authNegocio:', e.message);
}
let requireAdminMod = null;
try {
  requireAdminMod = require('../middlewares/requireAdmin');
} catch (e) {
  console.error('[retosVisibilidad] No se pudo require ../middlewares/requireAdmin:', e.message);
}

// Soportar export default o export con nombre
let autenticarToken =
  (authNegocioMod && typeof authNegocioMod === 'function' && authNegocioMod) ||
  (authNegocioMod && typeof authNegocioMod.autenticarToken === 'function' && authNegocioMod.autenticarToken) ||
  null;

let requireAdmin =
  (requireAdminMod && typeof requireAdminMod === 'function' && requireAdminMod) ||
  (requireAdminMod && typeof requireAdminMod.requireAdmin === 'function' && requireAdminMod.requireAdmin) ||
  null;

if (typeof autenticarToken !== 'function') {
  console.error('[retosVisibilidad] autenticarToken NO es función. Verificá el export/import.');
  // fallback para no crashear mientras corregís el import (borralo cuando esté bien)
  autenticarToken = (req, _res, next) => next();
}
if (typeof requireAdmin !== 'function') {
  console.error('[retosVisibilidad] requireAdmin NO es función. Verificá el export/import.');
  // fallback para no crashear mientras corregís el import (borralo cuando esté bien)
  requireAdmin = (_req, _res, next) => next();
}

// ── Helper: asegurar fila 1 ───────────────────────────────────────────────────
async function getOrCreateConfig() {
  let cfg = await SorteoConfig.findByPk(1);
  if (!cfg) {
    cfg = await SorteoConfig.create({
      id: 1,
      verPremioPublico: true,
      verFechaPublica: true,
      mostrarGanadoresPublico: true,
      mostrarRankingPublico: true,
    });
  }
  return cfg;
}

// ── GET /api/retos/sorteo/visibilidad (público) ───────────────────────────────
router.get('/visibilidad', async (req, res) => {
  try {
    const cfg = await getOrCreateConfig();
    res.json({
      verPremioPublico: cfg.verPremioPublico,
      verFechaPublica: cfg.verFechaPublica,
      mostrarGanadoresPublico: cfg.mostrarGanadoresPublico,
      mostrarRankingPublico: cfg.mostrarRankingPublico,
    });
  } catch (err) {
    console.error('GET visibilidad error:', err);
    res.status(500).json({ error: 'No se pudo obtener la visibilidad' });
  }
});

// ── PUT /api/retos/sorteo/visibilidad (admin) ─────────────────────────────────


module.exports = router;
