const express = require('express');
const router = express.Router();
const { Usuario, Concurso, VotoPremio } = require('../models/model');
const { autenticarToken } = require('../middlewares/auth');
const { Op, fn, col, literal } = require('sequelize');
const sequelize = require('../config/database');

// Función de seguridad: solo admins
function assertAdmin(req) {
  if (!req.usuario || !req.usuario.esAdmin) {
    const err = new Error('Solo los administradores pueden hacer esto');
    err.statusCode = 403;
    throw err;
  }
}

/* ======================================================
   📍 RUTAS PÚBLICAS (sin token)
   ====================================================== */

// GET /api/concursos/public/all
// Devuelve: { actual, ultimo }
router.get('/public/all', async (_req, res) => {
  try {
    const actual = await Concurso.findOne({
      where: { activo: true },
      order: [['fechaInicio', 'DESC']],
    });

    const ultimo = await Concurso.findOne({
      where: { activo: false },
      order: [['fechaFin', 'DESC']],
    });

    res.json({
      actual,
      ultimo,
    });
  } catch (e) {
    console.error('GET /concursos/public/all', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/concursos/public
// Versión resumida (activo + últimoCerrado con ganadores/premios)
router.get('/public', async (_req, res) => {
  try {
    const actual = await Concurso.findOne({
      where: { activo: true },
      order: [['fechaInicio', 'DESC']],
    });

    const ultimoCerrado = await Concurso.findOne({
      where: { activo: false },
      order: [['fechaFin', 'DESC']],
    });

    res.json({
      actual: actual
        ? {
            id: actual.id,
            nombre: actual.nombre,
            fechaInicio: actual.fechaInicio,
            fechaFin: actual.fechaFin,
            premios: actual.premiosJSON,
          }
        : null,

      ultimoCerrado: ultimoCerrado
        ? {
            id: ultimoCerrado.id,
            nombre: ultimoCerrado.nombre,
            fechaInicio: ultimoCerrado.fechaInicio,
            fechaFin: ultimoCerrado.fechaFin,
            premios: ultimoCerrado.premiosJSON,
            ganadores: ultimoCerrado.ganadoresJSON,
          }
        : null,
    });
  } catch (e) {
    console.error('GET /concursos/public', e);
    res.status(500).json({ error: 'Error al cargar concursos públicos' });
  }
});

// GET /api/concursos/:id/top20
// 🔓 Hacerlo público: NO requiere token ni admin
router.get('/:id/top20', async (req, res) => {
  try {
    const { id } = req.params;

    const concurso = await Concurso.findByPk(id, {
      attributes: ['id', 'activo', 'visiblePublico', 'fechaFin'],
    });
console.log(concurso)
    // si no cumple condiciones -> devolvés top vacío
const ahora = new Date();
const fechaFin = new Date(concurso.fechaFin);

// Convertir ambas al mismo huso horario
const cerradoPorFecha = fechaFin.getTime() <= ahora.getTime();
console.log(cerradoPorFecha,"cerrado  ")
    if (
      !concurso ||
      !concurso.activo ||
      !concurso.visiblePublico ||
      cerradoPorFecha
    ) {
      return res.json({ top: [] });
    }

    const top = await Usuario.findAll({
      attributes: ['id', 'nombre', 'fotoPerfil', 'puntuacion'],
      order: [['puntuacion', 'DESC']],
      limit: 20,
    });
 console.log(top, "fucking")
    res.json({ top });
  } catch (e) {
    console.error('GET /concursos/:id/top20', e);
    res.status(500).json({ error: 'Error al traer top20' });
  }
});


// GET /api/concursos/:id/votos
// 🔓 También público (cualquiera debe poder ver el ranking de votos)
router.get('/:id/votos', async (req, res) => {
  try {
    const { id } = req.params;

    const concurso = await Concurso.findByPk(id, {
      attributes: ['id', 'activo', 'visiblePublico', 'fechaFin'],
    });

    const cerradoPorFecha =
      concurso?.fechaFin && new Date(concurso.fechaFin).getTime() <= Date.now();

    if (
      !concurso ||
      !concurso.activo ||
      !concurso.visiblePublico ||
      cerradoPorFecha
    ) {
      return res.json({ ranking: [] });
    }

    const ranking = await VotoPremio.findAll({
      attributes: [
        'candidatoId',
        [fn('COUNT', col('candidatoId')), 'votos'],
      ],
      where: { concursoId: id },
      group: ['candidatoId'],
      order: [[literal('votos'), 'DESC']],
      raw: true,
    });

    const ids = ranking.map(r => r.candidatoId);
    const usuarios = await Usuario.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ['id', 'nombre', 'fotoPerfil'],
    });

    const resultado = ranking.map(r => ({
      id: r.candidatoId,
      nombre: usuarios.find(u => u.id === r.candidatoId)?.nombre || 'Desconocido',
      fotoPerfil: usuarios.find(u => u.id === r.candidatoId)?.fotoPerfil || null,
      votos: Number(r.votos),
    }));

    res.json({ ranking: resultado });
  } catch (e) {
    console.error('GET /concursos/:id/votos', e);
    res.status(500).json({ error: 'Error al traer votos' });
  }
});

/* ======================================================
   📍 RUTAS PROTEGIDAS (usuario logueado, pero NO hace falta admin)
   ====================================================== */

// GET /api/concursos/:id/mi-voto
router.get('/:id/mi-voto', autenticarToken, async (req, res) => {
  try {
    const concursoId = req.params.id;
    const usuarioId = req.usuario.id;

    const voto = await VotoPremio.findOne({
      where: { usuarioId, concursoId },
      attributes: ['candidatoId', 'createdAt'],
      raw: true,
    });

    if (!voto) {
      return res.json({
        yaVoto: false,
        candidato: null,
        fechaVoto: null,
      });
    }

    const candidato = await Usuario.findByPk(voto.candidatoId, {
      attributes: ['id', 'nombre', 'fotoPerfil', 'puntuacion'],
    });

    res.json({
      yaVoto: true,
      candidato: candidato
        ? {
            id: candidato.id,
            nombre: candidato.nombre,
            fotoPerfil: candidato.fotoPerfil,
            puntos: candidato.puntuacion,
          }
        : {
            id: voto.candidatoId,
            nombre: null,
            fotoPerfil: null,
            puntos: 0,
          },
      fechaVoto: voto.createdAt,
    });
  } catch (e) {
    console.error('GET /concursos/:id/mi-voto', e);
    res
      .status(500)
      .json({ error: e.message || 'Error al consultar mi voto' });
  }
});

// POST /api/concursos/:id/votar
router.post('/:id/votar', autenticarToken, async (req, res) => {
  try {
    const concursoId = req.params.id;
    const { candidatoId } = req.body || {};
    const usuarioId = req.usuario.id;

    if (!candidatoId) {
      return res.status(400).json({ error: 'candidatoId requerido' });
    }
    if (Number(usuarioId) === Number(candidatoId)) {
      return res.status(400).json({ error: 'No podés votarte a vos mismo' });
    }

    const concurso = await Concurso.findByPk(concursoId);
    if (
      !concurso ||
      !concurso.activo ||
      !concurso.visiblePublico || // 👈 agregado
      (concurso.fechaFin && new Date(concurso.fechaFin).getTime() <= Date.now())
    ) {
      return res.status(400).json({ error: 'La votación no está habilitada' });
    }

    await VotoPremio.create({
      usuarioId,
      candidatoId,
      concursoId,
    });

    const io = req.app.get('io');
    if (io) io.emit('votos-actualizados', { concursoId });

    res.json({ ok: true });
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Ya votaste en este concurso' });
    }
    console.error('POST /concursos/:id/votar', e);
    res.status(500).json({ error: e.message || 'Error al votar' });
  }
});


/* ======================================================
   📍 RUTAS SOLO ADMIN
   ====================================================== */

// POST /api/concursos
// POST /api/concursos
router.post('/', autenticarToken, async (req, res) => {
  try {
    assertAdmin(req);
    const { nombre, fechaInicio, fechaFin, premios } = req.body;

    // 1. Cerramos todos los concursos anteriores como "inactivos"
    //    PERO NO tocamos sus ganadores ni nada acá, eso pasa en /cerrar
    await Concurso.update({ activo: false }, { where: {} });

    // 2. Creamos el nuevo concurso y lo marcamos activo
    const nuevo = await Concurso.create({
      nombre: nombre || 'Concurso mensual',
      activo: true,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : new Date(),
      fechaFin: fechaFin ? new Date(fechaFin) : null,
      premiosJSON: premios || [],
      ganadoresJSON: [],
      visiblePublico: true,
    });

    // ❌ IMPORTANTE: NO RESETEAR PUNTOS ACA
    // ❌ NO hacer Usuario.update({ puntuacion: 0 })
    // ❌ NO hacer VotoPremio.destroy({})

    // 3. Respondemos con el concurso nuevo
    res.json(nuevo);
  } catch (e) {
    console.error('POST /concursos', e);
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// PATCH /api/concursos/:id/visibilidad
// body { visiblePublico: true/false }
router.patch('/:id/visibilidad', autenticarToken, async (req, res) => {
  try {
    assertAdmin(req);
    const { id } = req.params;
    const { visiblePublico } = req.body;

    const concurso = await Concurso.findByPk(id);
    if (!concurso) return res.status(404).json({ error: 'Concurso no encontrado' });

    concurso.visiblePublico = !!visiblePublico;
    await concurso.save();

    res.json(concurso);
  } catch (e) {
    console.error('PATCH /concursos/:id/visibilidad', e);
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});


// PATCH /api/concursos/:id/pausar
router.patch('/:id/pausar', autenticarToken, async (req, res) => {
  try {
    assertAdmin(req);
    const { id } = req.params;
    const concurso = await Concurso.findByPk(id);
    if (!concurso) {
      return res.status(404).json({ error: 'Concurso no encontrado' });
    }
    concurso.activo = false;
    await concurso.save();
    res.json(concurso);
  } catch (e) {
    console.error('PATCH /concursos/:id/pausar', e);
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// PATCH /api/concursos/:id/cerrar
router.patch('/:id/cerrar', autenticarToken, async (req, res) => {
  try {
    assertAdmin(req);
    const concursoId = req.params.id;

    const concurso = await Concurso.findByPk(concursoId);
    if (!concurso) {
      return res.status(404).json({ error: 'Concurso no encontrado' });
    }
    if (!concurso.activo) {
      return res.status(400).json({ error: 'Ya está cerrado' });
    }

    const premiosLista = concurso.premiosJSON || [];
    const cantGanadores = premiosLista.length || 4;

    // sacar top por votos
    const votos = await VotoPremio.findAll({
      attributes: [
        'candidatoId',
        [fn('COUNT', col('candidatoId')), 'votos'],
      ],
      where: { concursoId },
      group: ['candidatoId'],
      order: [[literal('votos'), 'DESC']],
      limit: cantGanadores,
      raw: true,
    });

    if (votos.length === 0) {
      return res.status(400).json({ error: 'No hay votos registrados' });
    }

    const ids = votos.map(v => v.candidatoId);
    const usuarios = await Usuario.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ['id', 'nombre', 'fotoPerfil', 'puntuacion'],
    });

    const ganadores = votos.map((v, i) => {
      const u = usuarios.find(u => u.id === v.candidatoId);
      const puesto = i + 1;
      const premioEntry = premiosLista.find(p => Number(p.puesto) === puesto);
      const montoPremio = premioEntry ? Number(premioEntry.monto) : 0;

      return {
        usuarioId: u?.id ?? null,
        nombre: u?.nombre ?? null,
        fotoPerfil: u?.fotoPerfil ?? null,
        puntos: u?.puntuacion || 0,
        votos: Number(v.votos),
        puesto,
        premio: montoPremio,
      };
    });

    concurso.ganadoresJSON = ganadores;
    concurso.activo = false;
    concurso.fechaFin = new Date();
    await concurso.save();

    // limpiar para el próximo
    await Usuario.update({ puntuacion: 0 }, { where: {} });
    await VotoPremio.destroy({ where: { concursoId } });

    res.json(concurso);
  } catch (e) {
    console.error('PATCH /concursos/:id/cerrar', e);
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// GET /api/concursos (panel admin)
router.get('/', autenticarToken, async (req, res) => {
  try {
    assertAdmin(req);
    const concursos = await Concurso.findAll({
      order: [['fechaInicio', 'DESC']],
    });
    res.json(concursos);
  } catch (e) {
    console.error('GET /concursos', e);
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

module.exports = router;
