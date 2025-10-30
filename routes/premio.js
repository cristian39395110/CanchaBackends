const express = require('express');
const router = express.Router();
const { Op, fn, col } = require('sequelize');

const sequelize = require('../config/database');
const Usuario = require('../models/usuario');
const Concurso = require('../models/Concurso');
const VotoPremio = require('../models/VotoPremio');
const { autenticarToken } = require('../middlewares/auth');
const SorteoHistorico = require('../models/SorteoHistorico');

function assertAdmin(req) {
  if (!req.usuario || req.usuario.esAdmin !== true) {
    const err = new Error('Solo administradores');
    err.statusCode = 403;
    throw err;
  }
}

// crea/asegura concurso base id=1
async function ensureConcursoBase() {
  const [c] = await Concurso.findOrCreate({
    where: { id: 1 },
    defaults: {
      nombre: 'Concurso mensual',
      activo: true,
      mostrarTop: false,
      mostrarProximoPremio: false,        // 👈 importante para el toggle
      fechaInicio: null,
      fechaFin: null,
      ganadores: null,

      // modelos viejos:
      premios: [
        { puesto: 1, monto: 200000 },
        { puesto: 2, monto: 100000 },
        { puesto: 3, monto: 50000 },
        { puesto: 4, monto: 50000 },
      ],

      // modelos nuevos:
      premiosActuales: [
        { puesto: 1, monto: 200000 },
        { puesto: 2, monto: 100000 },
        { puesto: 3, monto: 50000 },
        { puesto: 4, monto: 50000 },
      ],
      premiosProximo: [],
    },
  });
  return c;
}

/* ============================
   CONFIG
   ============================ */

// GET /api/premio/config
router.get('/config', async (_req, res) => {
  try {
    const c = await ensureConcursoBase();
    res.json({
      id: c.id,
      nombre: c.nombre,
      activo: c.activo,
      mostrarTop: c.mostrarTop,
      mostrarProximoPremio: !!c.mostrarProximoPremio, // 👈 agregar esto
      fechaInicio: c.fechaInicio,
      fechaFin: c.fechaFin,
    });
  } catch (e) {
    console.error('GET /premio/config', e);
    res.status(500).json({ error: 'Error al leer config' });
  }
});

// PATCH /api/premio/config
// usado por AdminPremioPage.handleGuardarConfig
router.patch('/config', autenticarToken, async (req, res) => {
  try {
    assertAdmin(req);

    const {
      nombre,
      activo,
      mostrarTop,
      mostrarProximoPremio,
      fechaFin,
    } = req.body || {};

    const c = await ensureConcursoBase();

    if (nombre !== undefined) c.nombre = nombre;
    if (activo !== undefined) c.activo = !!activo;
    if (mostrarTop !== undefined) c.mostrarTop = !!mostrarTop;
    if (mostrarProximoPremio !== undefined)
      c.mostrarProximoPremio = !!mostrarProximoPremio;

    if (fechaFin !== undefined) {
      // si viene null o '' la limpiamos, si viene fecha la guardamos
      c.fechaFin = fechaFin ? new Date(fechaFin) : null;
    }

    await c.save();

    res.json({
      ok: true,
      id: c.id,
      nombre: c.nombre,
      activo: c.activo,
      mostrarTop: c.mostrarTop,
      mostrarProximoPremio: !!c.mostrarProximoPremio,
      fechaInicio: c.fechaInicio,
      fechaFin: c.fechaFin,
    });
  } catch (e) {
    console.error('PATCH /premio/config', e);
    res
      .status(e.statusCode || 500)
      .json({ error: e.message || 'Error al guardar configuración' });
  }
});


/* ============================
   PREMIOS
   ============================ */

// GET /api/premio/premios
// el admin usa esto para inicializar los formularios de premiosActuales / premiosProximo
router.get('/premios', autenticarToken, async (req, res) => {
  try {
    assertAdmin(req);
    const c = await ensureConcursoBase();

    // normalizamos porque en DB podría estar guardado como string
    const parseField = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return [];
        }
      }
      return [];
    };

    res.json({
      premiosActuales: parseField(c.premiosActuales),
      premiosProximo: parseField(c.premiosProximo),
    });
  } catch (e) {
    console.error('GET /premio/premios', e);
    res.status(500).json({ error: 'Error al leer premios' });
  }
});

// PATCH /api/premio/premios
// guarda premiosActuales y premiosProximo
router.patch('/premios', autenticarToken, async (req, res) => {
  try {
    assertAdmin(req);

    const { premiosActuales, premiosProximo } = req.body || {};
    const c = await ensureConcursoBase();

    function normalizePremios(arr) {
      if (!Array.isArray(arr)) return [];
      return arr
        .filter(p => p && p.puesto != null && p.monto != null)
        .map(p => ({
          puesto: Number(p.puesto),
          monto: Number(p.monto),
        }))
        .sort((a, b) => a.puesto - b.puesto);
    }

    if (premiosActuales !== undefined) {
      c.premiosActuales = normalizePremios(premiosActuales);
    }

    if (premiosProximo !== undefined) {
      c.premiosProximo = normalizePremios(premiosProximo);
    }

    await c.save();

    res.json({
      ok: true,
      premiosActuales: c.premiosActuales || [],
      premiosProximo: c.premiosProximo || [],
    });
  } catch (e) {
    console.error('PATCH /premio/premios', e);
    res
      .status(e.statusCode || 500)
      .json({ error: e.message || 'Error al guardar premios' });
  }
});


/* ============================
   TOP 20 público
   ============================ */

router.get('/top20', async (_req, res) => {
  try {
    const c = await ensureConcursoBase();
    if (!c.mostrarTop) {
      return res.status(403).json({ error: 'Top oculto por configuración' });
    }

    const top = await Usuario.findAll({
      attributes: ['id', 'nombre', 'fotoPerfil', 'puntuacion'],
      where: { puntuacion: { [Op.gt]: 0 } },
      order: [['puntuacion', 'DESC'], ['id', 'ASC']],
      limit: 20,
    });

    res.json({ top, total: top.length });
  } catch (e) {
    console.error('GET /premio/top20', e);
    res.status(500).json({ error: 'Error al traer el Top 20' });
  }
});


/* ============================
   GANADORES (guardar manual / listar público)
   ============================ */

// POST /api/premio/ganadores (admin opcional manual)
router.post('/ganadores', autenticarToken, async (req, res) => {
  try {
    assertAdmin(req);
    const { ganadores } = req.body || {};
    if (!Array.isArray(ganadores) || ganadores.length === 0) {
      return res
        .status(400)
        .json({ error: 'Formato de ganadores inválido' });
    }
    const c = await ensureConcursoBase();
    c.ganadores = ganadores;
    await c.save();
    res.json({ ok: true, ganadores: c.ganadores });
  } catch (e) {
    console.error('POST /premio/ganadores', e);
    res
      .status(e.statusCode || 500)
      .json({ error: e.message || 'Error al guardar ganadores' });
  }
});

// GET /api/premio/ganadores (público)
router.get('/ganadores', async (_req, res) => {
  try {
    const c = await ensureConcursoBase();

    const parseField = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return [];
        }
      }
      return [];
    };

    const ganadoresParsed       = parseField(c.ganadores);
    const premiosActualesParsed = parseField(c.premiosActuales);
    const premiosProximoParsed  = parseField(c.premiosProximo);

    // 👇 NUEVO: aseguramos que cada ganador tenga su premio
    const ganadoresConPremio = ganadoresParsed.map(g => {
      // si ya tiene premio, lo dejamos como está
      if (g.premio != null) return g;

      // si NO tiene premio, lo buscamos por puesto en premiosActualesParsed
      const match = premiosActualesParsed.find(
        p => Number(p.puesto) === Number(g.puesto)
      );

      return {
        ...g,
        premio: match ? Number(match.monto) : 0,
      };
    });

    res.json({
      ganadores: ganadoresConPremio,
      fechaFin: c.fechaFin || null,
      premiosActuales: premiosActualesParsed,
      premiosProximo: premiosProximoParsed,
      mostrarProximoPremio: !!c.mostrarProximoPremio,
    });
  } catch (e) {
    console.error('GET /premio/ganadores', e);
    res.status(500).json({ error: 'Error al leer ganadores' });
  }
});

/* ============================
   RESET PUNTOS
   ============================ */

router.post('/reset', autenticarToken, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    assertAdmin(req);

    await Usuario.update({ puntuacion: 0 }, { where: {}, transaction: t });

    const { inactivar } = req.body || {};
    const c = await ensureConcursoBase();
    if (inactivar === true) {
      c.activo = false;
      c.mostrarTop = false;
      await c.save({ transaction: t });
    }

    await t.commit();
    res.json({ ok: true, msg: 'Puntos reseteados' });
  } catch (e) {
    await t.rollback();
    console.error('POST /premio/reset', e);
    res
      .status(e.statusCode || 500)
      .json({ error: e.message || 'Error al resetear puntos' });
  }
});


/* ============================
   GENERAR TOP MANUAL (admin)
   ============================ */

router.post('/generar-top', autenticarToken, async (req, res) => {
  try {
    assertAdmin(req);

    const c = await ensureConcursoBase();
    const top = await Usuario.findAll({
      attributes: ['id', 'nombre', 'fotoPerfil', 'puntuacion'],
      where: { puntuacion: { [Op.gt]: 0 } },
      order: [['puntuacion', 'DESC'], ['id', 'ASC']],
      limit: 20,
    });

    const ganadores = top.map((u, i) => ({
      usuarioId: u.id,
      nombre: u.nombre,
      fotoPerfil: u.fotoPerfil,
      puesto: i + 1,
      puntos: u.puntuacion,
    }));

    c.ganadores = ganadores;
    c.mostrarTop = true;
    await c.save();

    res.json({ ok: true, ganadores });
  } catch (e) {
    console.error('POST /premio/generar-top', e);
    res
      .status(e.statusCode || 500)
      .json({ error: e.message || 'Error al generar Top 20' });
  }
});


/* ============================
   VOTAR / VOTOS
   ============================ */

function assertVotacionActiva(c) {
  if (!c || !c.activo) throw new Error('No hay votación activa');
  if (c.fechaFin && new Date(c.fechaFin).getTime() <= Date.now()) {
    throw new Error('La votación ya cerró');
  }
}

router.post('/votar', autenticarToken, async (req, res) => {
  try {
    const { candidatoId } = req.body || {};
    const usuarioId = req.usuario.id;

    if (!candidatoId)
      return res.status(400).json({ error: 'candidatoId requerido' });
    if (Number(usuarioId) === Number(candidatoId)) {
      return res
        .status(400)
        .json({ error: 'No podés votarte a vos mismo' });
    }

    const c = await ensureConcursoBase();
    assertVotacionActiva(c);

    await VotoPremio.create({ usuarioId, candidatoId, concursoId: c.id });

    const io = req.app.get('io');
    if (io) io.emit('votos-actualizados');

    res.json({ ok: true });
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res
        .status(400)
        .json({ error: 'Ya votaste en este concurso' });
    }
    console.error('POST /premio/votar', e);
    res
      .status(500)
      .json({ error: e.message || 'Error al votar' });
  }
});

router.get('/votos', async (_req, res) => {
  try {
    const votos = await VotoPremio.findAll({
      attributes: [
        'candidatoId',
        [fn('COUNT', col('candidatoId')), 'votos'],
      ],
      group: ['candidatoId'],
      raw: true,
    });

    const ids = votos.map(v => v.candidatoId);
    const candidatos = ids.length
      ? await Usuario.findAll({
          attributes: ['id', 'nombre', 'fotoPerfil'],
          where: { id: { [Op.in]: ids } },
        })
      : [];

    const byId = new Map(candidatos.map(c => [c.id, c.toJSON()]));

    const ranking = votos
      .map(v => {
        const u = byId.get(v.candidatoId) || {};
        return {
          id: Number(v.candidatoId),
          nombre: u.nombre || 'Usuario',
          fotoPerfil: u.fotoPerfil || null,
          votos: Number(v.votos) || 0,
        };
      })
      .sort((a, b) => b.votos - a.votos);

    res.json({ ranking });
  } catch (e) {
    console.error('GET /premio/votos', e);
    res.status(500).json({ error: 'Error al contar votos' });
  }
});


/* ============================
   PUBLICAR GANADORES
   ============================ */

router.post('/publicar-ganadores', autenticarToken, async (req, res) => {
  try {
    assertAdmin(req);

    const c = await ensureConcursoBase();

    // premiosActuales (puede ser array o string)
    const premiosActuales = Array.isArray(c.premiosActuales)
      ? c.premiosActuales
      : (typeof c.premiosActuales === 'string'
          ? JSON.parse(c.premiosActuales || '[]')
          : []);

    // cuantos ganadores saco -> cantidad de premios actuales
    const limitGanadores = premiosActuales.length || 4;

    // 1. top N por votos
    const votos = await VotoPremio.findAll({
      attributes: [
        'candidatoId',
        [sequelize.fn('COUNT', sequelize.col('candidatoId')), 'votos'],
      ],
      group: ['candidatoId'],
      order: [[sequelize.literal('votos'), 'DESC']],
      limit: limitGanadores,
      raw: true,
    });

    if (votos.length === 0) {
      return res.status(400).json({ error: 'No hay votos registrados' });
    }

    // 2. datos de esos usuarios
    const ids = votos.map(v => v.candidatoId);
    const usuarios = await Usuario.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ['id', 'nombre', 'fotoPerfil', 'puntuacion'],
    });

    // 3. armar ganadores con premio segun puesto
    const ganadores = votos.map((v, i) => {
      const u = usuarios.find(u => u.id === v.candidatoId);
      const puesto = i + 1;
      const premioEntry = premiosActuales.find(
        p => Number(p.puesto) === puesto
      );
      const montoPremio = premioEntry ? Number(premioEntry.monto) : 0;

      return {
        usuarioId: u?.id ?? null,
        nombre: u?.nombre ?? null,
        fotoPerfil: u?.fotoPerfil ?? null,
        puntos: u?.puntuacion || 0,
        puesto,
        votos: Number(v.votos),
        premio: montoPremio,
      };
    });

    // 4. guardar resultados del sorteo actual
    c.ganadores = ganadores;
    c.fechaFin = new Date();
    c.activo = false;
    c.mostrarTop = true;

    // 5. rotar premiosProximo -> premiosActuales
    const premiosProximoParsed = Array.isArray(c.premiosProximo)
      ? c.premiosProximo
      : (typeof c.premiosProximo === 'string'
          ? JSON.parse(c.premiosProximo || '[]')
          : []);

    c.premiosActuales = premiosProximoParsed;
    c.premiosProximo = [];

    await c.save();

    // 6. resetear puntajes y votos
    await Usuario.update({ puntuacion: 0 }, { where: {} });
    await VotoPremio.destroy({ where: {} });

    // 7. reabrir el concurso nuevo
    c.activo = true;
    c.fechaInicio = new Date();
    await c.save();

    res.json({ ok: true, ganadores });
  } catch (e) {
    console.error('POST /premio/publicar-ganadores', e);
    res
      .status(e.statusCode || 500)
      .json({ error: e.message || 'Error al publicar ganadores' });
  }
});


/* ============================
   HISTÓRICO
   ============================ */

router.get('/historico', async (_req, res) => {
  try {
    const rows = await SorteoHistorico.findAll({
      order: [['fechaCierre', 'DESC']],
      limit: 12,
      attributes: ['id', 'fechaCierre', 'ganadores', 'premios'],
    });

    res.json({
      sorteos: rows.map(r => ({
        id: r.id,
        fechaCierre: r.fechaCierre,
        ganadores: r.ganadores,
        premios: r.premios,
      })),
    });
  } catch (e) {
    console.error('GET /premio/historico', e);
    res.status(500).json({ error: 'Error al leer histórico' });
  }
});

router.get('/historico/:id', async (req, res) => {
  try {
    const sorteo = await SorteoHistorico.findByPk(req.params.id, {
      attributes: ['id', 'fechaCierre', 'ganadores', 'premios'],
    });

    if (!sorteo) {
      return res.status(404).json({ error: 'Sorteo no encontrado' });
    }

    res.json({
      id: sorteo.id,
      fechaCierre: sorteo.fechaCierre,
      ganadores: sorteo.ganadores,
      premios: sorteo.premios,
    });
  } catch (e) {
    console.error('GET /premio/historico/:id', e);
    res.status(500).json({ error: 'Error al leer sorteo histórico' });
  }
});

module.exports = router;
