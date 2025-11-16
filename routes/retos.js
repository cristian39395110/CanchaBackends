// routes/retos.js
const express = require('express');
const router = express.Router();

const {
  Reto,
  uUsuarioNegocio,
  // 👇 modelos nuevos para participantes/ganadores/premios/historial
  RetoParticipante,
  RetoGanador,
  RetoPremio,
  RetoGanadorHist,
  RetoGanadorHistDet,
  SorteoConfig,
  // 👇 transacciones
  
} = require('../models/model');

const { autenticarTokenNegocio } = require('../middlewares/authNegocio');
const { soloAdminNegocio } = require('../middlewares/soloAdminNegocio');

/**
 * ===========================================================
 * GET /api/retos
 * → Devuelve todos los retos (cualquiera logueado de negocio)
 * ===========================================================
 */
router.get('/', async (req, res) => {
  try {
    const retos = await Reto.findAll({

     attributes: ['id','titulo','descripcion','puntos','activo','version'],
     order: [['id','DESC']],
      limit: 100,
    });
    res.json(retos);
  } catch (err) {
    console.error('❌ GET /api/retos:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudieron cargar los retos' });
  }
});

/**
 * ===========================================================
 * GET /api/retos/activo  (público)
 * ===========================================================
 */
router.get('/activo', async (req, res) => {
  try {
    const activo = await Reto.findOne({ where: { activo: true } });
    res.json(activo || null);
  } catch (err) {
    console.error('❌ GET /api/retos/activo:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudo obtener el reto activo' });
  }
});

/**
 * ===========================================================
 * GET /api/retos/ranking/top?limit=100  (público)
 * ===========================================================
 */
router.get('/ranking/top', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 100);
    const rows = await uUsuarioNegocio.findAll({
      attributes: ['id', 'nombre', 'email', 'puntos', 'esPremium'],
      order: [['puntos', 'DESC']],
      limit,
    });
    res.json(rows);
  } catch (err) {
    console.error('❌ GET /api/retos/ranking/top:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudo obtener el ranking' });
  }
});

/**
 * ===========================================================
 * POST /api/retos/crear
 * → Crear nuevo reto (solo admin de negocios)
 * body: { titulo, descripcion, puntos, fechaInicio, fechaFin }
 * ===========================================================
 */
router.post('/crear', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  try {
    const { titulo, descripcion, puntos, fechaInicio, fechaFin } = req.body;
    if (!titulo || !descripcion || !puntos) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const ultimaVersion = await Reto.max('version');
    const nuevaVersion = (ultimaVersion || 0) + 1;

    const nuevo = await Reto.create({
      titulo,
      descripcion,
      puntos,
      tipo: 'general',
      fechaInicio,
      fechaFin,
      version: nuevaVersion,
      activo: false,
    });

    res.json(nuevo);
  } catch (err) {
    console.error('❌ POST /api/retos/crear:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudo crear el reto' });
  }
});

/**
 * ===========================================================
 * PATCH /api/retos/:id/activar  (solo admin negocio)
 * → Setea un reto como activo y desactiva los demás
 * ===========================================================
 */
router.patch('/:id/activar', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  const { id } = req.params;
 const t = await Reto.sequelize.transaction();

  try {
    await Reto.update({ activo: false }, { where: {}, transaction: t });
    const [count] = await Reto.update({ activo: true }, { where: { id }, transaction: t });
    await t.commit();
    if (!count) return res.status(404).json({ error: 'Reto no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    await t.rollback();
    console.error('❌ PATCH /api/retos/:id/activar:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudo activar el reto' });
  }
});

/**
 * ===========================================================
 * PUT /api/retos/:id  (solo admin negocio)
 * ===========================================================
 */
router.put('/:id', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  const { id } = req.params;
  try {
    const reto = await Reto.findByPk(id);
    if (!reto) return res.status(404).json({ error: 'Reto no encontrado' });

    await reto.update(req.body);
    res.json(reto);
  } catch (err) {
    console.error('❌ PUT /api/retos/:id:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudo actualizar el reto' });
  }
});

/**
 * ===========================================================
 * DELETE /api/retos/:id  (solo admin negocio)
 * ===========================================================
 */
router.delete('/:id', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  const { id } = req.params;
  try {
    const reto = await Reto.findByPk(id);
    if (!reto) return res.status(404).json({ error: 'Reto no encontrado' });

    await reto.destroy();
    res.json({ mensaje: 'Reto eliminado correctamente' });
  } catch (err) {
    console.error('❌ DELETE /api/retos/:id:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudo eliminar el reto' });
  }
});

/**
 * ===========================================================
 * GET /api/retos/:id/participantes  (público o con token)
 * ===========================================================
 */
router.get('/:id/participantes', async (req, res) => {
  const { id } = req.params;
  try {
    const participantes = await uUsuarioNegocio.findAll({
      include: [{ model: RetoParticipante, where: { retoId: id }, required: true }],
      attributes: ['id', 'nombre', 'email', 'puntos', 'esPremium', 'fotoPerfil'],
      order: [['nombre', 'ASC']],
    });
    res.json(participantes);
  } catch (err) {
    console.error('❌ GET /api/retos/:id/participantes:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudieron obtener los participantes' });
  }
});

/**
 * ===========================================================
 * POST /api/retos/:id/participantes  (solo admin negocio)
 * body: { usuarioIds: number[] }
 * ===========================================================
 */
router.post('/:id/participantes', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  const { id } = req.params;
  const { usuarioIds = [] } = req.body;
  try {
    if (!Array.isArray(usuarioIds) || usuarioIds.length === 0) {
      return res.status(400).json({ error: 'usuarioIds vacío' });
    }
    await Promise.all(
      usuarioIds.map((uid) =>
        RetoParticipante.findOrCreate({ where: { retoId: id, usuarioId: uid } })
      )
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ POST /api/retos/:id/participantes:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudieron agregar participantes' });
  }
});

/**
 * ===========================================================
 * DELETE /api/retos/:id/participantes/:usuarioId  (solo admin negocio)
 * ===========================================================
 */
router.delete('/:id/participantes/:usuarioId', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  const { id, usuarioId } = req.params;
  try {
    await RetoParticipante.destroy({ where: { retoId: id, usuarioId } });
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ DELETE /api/retos/:id/participantes/:usuarioId:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudo quitar el participante' });
  }
});

/**
 * ===========================================================
 * GET /api/retos/:id/ganadores  (público)
 * ===========================================================
 */
router.get('/:id/ganadores', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await RetoGanador.findAll({
      where: { retoId: id },
      include: [{ model: uUsuarioNegocio, attributes: ['id', 'nombre', 'puntos'] }],
      order: [['puesto', 'ASC']],
    });
    const data = rows.map((r) => ({
      usuarioId: r.usuarioId,
      puesto: r.puesto,
      nombre: r.uUsuarioNegocio?.nombre,
      puntos: r.uUsuarioNegocio?.puntos,
    }));
    res.json(data);
  } catch (err) {
    console.error('❌ GET /api/retos/:id/ganadores:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudieron obtener los ganadores' });
  }
});

/**
 * ===========================================================
 * POST /api/retos/:id/publicar-ganadores  (solo admin negocio)
 * body:
 *  {
 *    ganadores: [{ usuarioId, puesto }],
 *    premios:   [{ puesto, monto }]
 *  }
 * ===========================================================
 */
router.post('/:id/publicar-ganadores', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  const { id } = req.params;
  const { ganadores = [], premios = [] } = req.body;

  if (!Array.isArray(ganadores) || ganadores.length === 0) {
    return res.status(400).json({ error: 'Debe enviar ganadores' });
  }

  const t = await Reto.sequelize.transaction();

  try {
    // idempotencia: limpiar actuales
    await RetoGanador.destroy({ where: { retoId: id }, transaction: t });
    await RetoPremio.destroy({ where: { retoId: id }, transaction: t });

    // guardar ganadores
    for (const g of ganadores) {
      if (!g.usuarioId || !g.puesto) continue;
      await RetoGanador.create(
        { retoId: id, usuarioId: g.usuarioId, puesto: g.puesto, publicadoEn: new Date() },
        { transaction: t }
      );
    }

    // guardar premios
    for (const p of premios) {
      if (!p.puesto && p.puesto !== 0) continue;
      await RetoPremio.create({ retoId: id, puesto: p.puesto, monto: p.monto || 0 }, { transaction: t });
    }

    // historial
    const hist = await RetoGanadorHist.create({ retoId: id, publicadoEn: new Date() }, { transaction: t });
    for (const g of ganadores) {
      if (!g.usuarioId || !g.puesto) continue;
      await RetoGanadorHistDet.create(
        { histId: hist.id, usuarioId: g.usuarioId, puesto: g.puesto },
        { transaction: t }
      );
    }

    await t.commit();
    res.json({ ok: true, publicadoEn: new Date().toISOString() });
  } catch (err) {
    await t.rollback();
    console.error('❌ POST /api/retos/:id/publicar-ganadores:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudieron publicar los ganadores' });
  }
});

/**
 * ===========================================================
 * GET /api/retos/:id/historial-ganadores  (público)
 * ===========================================================
 */
router.get('/:id/historial-ganadores', async (req, res) => {
  const { id } = req.params;
  try {
    const hs = await RetoGanadorHist.findAll({
      where: { retoId: id },
      include: [
        {
          model: RetoGanadorHistDet,
          as: 'detalles',
          include: [{ model: uUsuarioNegocio, attributes: ['id', 'nombre', 'puntos'] }],
        },
      ],
      order: [['publicadoEn', 'DESC']],
    });

    const payload = hs.map((h) => ({
      concursoId: Number(id),
      titulo: null,
      fecha: h.publicadoEn,
      ganadores: (h.detalles || [])
        .sort((a, b) => a.puesto - b.puesto)
        .map((d) => ({
          usuarioId: d.usuarioId,
          puesto: d.puesto,
          nombre: d.uUsuarioNegocio?.nombre,
          puntos: d.uUsuarioNegocio?.puntos,
        })),
    }));

    res.json(payload);
  } catch (err) {
    console.error('❌ GET /api/retos/:id/historial-ganadores:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudo obtener el historial' });
  }
});

/**
 * ===========================================================
 * GET /api/retos/usuarios-premium   (solo admin negocio)
 * ===========================================================
 */
router.get('/usuarios-premium', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  try {
    const lista = await uUsuarioNegocio.findAll({
      attributes: ['id', 'nombre', 'email', 'puntos', 'esPremium', 'esAdmin'],
      order: [['nombre', 'ASC']],
    });
    res.json(lista);
  } catch (err) {
    console.error('❌ GET /api/retos/usuarios-premium:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudo obtener la lista de usuarios' });
  }
});

/**
 * ===========================================================
 * PATCH /api/retos/usuarios-premium/:id  (solo admin negocio)
 * ===========================================================
 */
router.patch('/usuarios-premium/:id', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  const { id } = req.params;
  const { esPremium } = req.body;
  try {
    const user = await uUsuarioNegocio.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    await user.update({ esPremium });
    res.json({ mensaje: 'Usuario actualizado', user });
  } catch (err) {
    console.error('❌ PATCH /api/retos/usuarios-premium/:id:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudo actualizar el usuario' });
  }
});

/**
 * ===========================================================
 * GET /api/retos/meta  (público)
 * ===========================================================
 */
router.get('/meta', async (req, res) => {
  try {
    const ultimo = await Reto.findOne({
      order: [['updatedAt', 'DESC']],
      attributes: ['version'],
    });

    const version = ultimo ? Number(ultimo.version) : 1;

    res.json({
      version,
      hayNuevos: true,
    });
  } catch (err) {
    console.error('❌ GET /api/retos/meta:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudo obtener meta de retos' });
  }
});
//-------------------------------
// ========================= SORTEO GLOBAL =========================
const { Op } = require('sequelize');

// GET /api/retos/sorteo/premios  (público)
router.get('/sorteo/premios', async (req, res) => {
  try {
    let reto = await Reto.findOne({ where: { titulo: 'GLOBAL_PREMIOS' } });
    if (!reto)
      reto = await Reto.create({
        titulo: 'GLOBAL_PREMIOS',
        descripcion: 'Premios globales',
        puntos: 0,
        tipo: 'general',
        activo: false,
        version: 1,
      });

    const premios = await RetoPremio.findAll({
      where: { retoId: reto.id },
      attributes: ['puesto', 'monto'],
      order: [['puesto', 'ASC']],
    });
    res.json(premios);
  } catch (err) {
    console.error('❌ GET /api/retos/sorteo/premios:', err?.message);
    res.status(500).json({ error: 'No se pudieron obtener los premios' });
  }
});

// PUT /api/retos/sorteo/premios  (solo admin)
router.put('/sorteo/premios', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  const { premios = [] } = req.body;
  const list = Array.isArray(premios)
    ? premios
        .map(p => ({ puesto: Number(p.puesto), monto: Number(p.monto) }))
        .filter(p => Number.isFinite(p.puesto) && p.puesto > 0 && Number.isFinite(p.monto) && p.monto >= 0)
    : [];
  const t = await Reto.sequelize.transaction();

  try {
    let reto = await Reto.findOne({ where: { titulo: 'GLOBAL_PREMIOS' }, transaction: t });
    if (!reto)
      reto = await Reto.create(
        { titulo: 'GLOBAL_PREMIOS', descripcion: 'Premios globales', puntos: 0, tipo: 'general', activo: false, version: 1 },
        { transaction: t }
      );

    await RetoPremio.destroy({ where: { retoId: reto.id }, transaction: t });
    if (list.length) {
      await RetoPremio.bulkCreate(
        list.map(p => ({ retoId: reto.id, puesto: p.puesto, monto: p.monto })),
        { transaction: t }
      );
    }
    await t.commit();
    res.json({ ok: true });
  } catch (err) {
    await t.rollback();
    console.error('❌ PUT /api/retos/sorteo/premios:', err?.message);
    res.status(500).json({ error: 'No se pudieron guardar los premios' });
  }
});




// GET /api/retos/:id/premios  (público)
router.get('/:id/premios', async (req, res) => {
  const { id } = req.params;
  try {
    const premios = await RetoPremio.findAll({
      where: { retoId: id },
      attributes: ['puesto', 'monto'],
      order: [['puesto', 'ASC']],
    });
    res.json(premios); // [] si no hay
  } catch (err) {
    console.error('❌ GET /api/retos/:id/premios:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudieron obtener los premios' });
  }
});


// PUT /api/retos/:id/premios  (admin negocio)
// PUT /api/retos/:id/premios  (admin negocio)
router.put('/:id/premios', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  let { id } = req.params;                 // puede venir 'sorteo' o '123'
  const { premios = [] } = req.body;

  // normalizo y valido premios
  const list = Array.isArray(premios)
    ? premios
        .map(p => ({ puesto: Number(p.puesto), monto: Number(p.monto) }))
        .filter(p => Number.isFinite(p.puesto) && p.puesto > 0 && Number.isFinite(p.monto) && p.monto >= 0)
    : [];

  try {
    // 🔁 compat: si id === 'sorteo', mapeo al reto GLOBAL_PREMIOS (lo creo si no existe)
    if (id === 'sorteo') {
      let retoGlobal = await Reto.findOne({ where: { titulo: 'GLOBAL_PREMIOS' } });
      if (!retoGlobal) {
        retoGlobal = await Reto.create({
          titulo: 'GLOBAL_PREMIOS',
          descripcion: 'Premios globales',
          puntos: 0,
          tipo: 'general',
          activo: false,
          version: 1,
        });
      }
      id = String(retoGlobal.id);
    }

    // ✅ desde acá, id es SIEMPRE numérico válido
    const idNum = Number(id);
    if (!Number.isFinite(idNum)) {
      return res.status(400).json({ error: 'retoId inválido' });
    }
    const existe = await Reto.findByPk(idNum);
    if (!existe) {
      return res.status(404).json({ error: 'Reto no encontrado' });
    }

    const t = await Reto.sequelize.transaction();
    try {
      await RetoPremio.destroy({ where: { retoId: idNum }, transaction: t });
      if (list.length) {
        const rows = list.map(p => ({ retoId: idNum, puesto: p.puesto, monto: p.monto }));
        await RetoPremio.bulkCreate(rows, { transaction: t });
      }
      await t.commit();
      res.json({ ok: true });
    } catch (err) {
      await t.rollback();
      console.error('❌ PUT /api/retos/:id/premios:', err?.message, err?.stack);
      res.status(500).json({ error: 'No se pudieron guardar los premios' });
    }
  } catch (err) {
    console.error('❌ PUT /api/retos/:id/premios (pre):', err?.message, err?.stack);
    res.status(500).json({ error: 'Error interno' });
  }
});




// GET /api/retos/sorteo/proximo  (público)
router.get('/sorteo/proximo', async (req, res) => {
  try {
    const meta = await Reto.findOne({ where: { titulo: 'PROXIMA_PUBLICACION' } });
    res.json({ fecha: meta?.descripcion || null });
  } catch (err) {
    console.error('❌ GET /api/retos/sorteo/proximo:', err?.message);
    res.status(500).json({ error: 'No se pudo obtener la fecha' });
  }
});

// PUT /api/retos/sorteo/proximo  (solo admin)
router.put('/sorteo/proximo', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  const { fecha = null } = req.body;
  try {
    let meta = await Reto.findOne({ where: { titulo: 'PROXIMA_PUBLICACION' } });
    if (!meta)
      meta = await Reto.create({ titulo: 'PROXIMA_PUBLICACION', descripcion: fecha, puntos: 0, tipo: 'general', activo: false, version: 1 });
    else await meta.update({ descripcion: fecha });
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ PUT /api/retos/sorteo/proximo:', err?.message);
    res.status(500).json({ error: 'No se pudo actualizar la fecha' });
  }
});

// POST /api/retos/sorteo/publicar  (solo admin)
router.post('/sorteo/publicar', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  try {
    const cant = Math.max(1, Number(req.body?.cantidad) || 3);
    const resetPuntos = Boolean(req.body?.resetPuntos);
    let lista = Array.isArray(req.body?.ganadores) ? req.body.ganadores : [];

    // 1) Si no mandan ganadores, tomar Top N
    if (!lista.length) {
      const top = await uUsuarioNegocio.findAll({
        attributes: ['id', 'nombre', 'puntos'],
        order: [['puntos', 'DESC']],
        limit: cant,
      });
      lista = top.map((u, i) => ({ usuarioId: Number(u.id), puesto: i + 1 }));
    }

    // Normalizar: numéricos, sin duplicados, asignar puestos faltantes
    const seen = new Set();
    lista = lista
      .map(g => ({ usuarioId: Number(g.usuarioId), puesto: Number(g.puesto) || 0 }))
      .filter(g => Number.isFinite(g.usuarioId) && g.usuarioId > 0)
      .filter(g => (seen.has(g.usuarioId) ? false : (seen.add(g.usuarioId), true)))
      .sort((a, b) => (a.puesto || 0) - (b.puesto || 0))
      .map((g, i) => ({ ...g, puesto: g.puesto > 0 ? g.puesto : i + 1 }));

    if (!lista.length) {
      return res.status(400).json({ error: 'No hay ganadores para publicar' });
    }

    // 2) Validar que todos los usuarioId existan en uUsuariosNegocio
    const ids = lista.map(g => g.usuarioId);
    const existentes = await uUsuarioNegocio.findAll({ where: { id: ids }, attributes: ['id'] });
    const okIds = new Set(existentes.map(x => Number(x.id)));
    const faltantes = ids.filter(id => !okIds.has(id));
    if (faltantes.length) {
      return res.status(409).json({
        error: 'Algunos usuarioId no existen en uUsuariosNegocio',
        faltantes,
      });
    }

    // 3) Crear o reutilizar reto mensual
    const hoy = new Date();
    const titulo = `Concurso ${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    let concurso = await Reto.findOne({ where: { titulo } });
    if (!concurso) {
      concurso = await Reto.create({
        titulo,
        descripcion: `Publicación mensual ${titulo}`,
        puntos: 0,
        tipo: 'general',
        activo: false,
        version: 1,
      });
    }

    // 4) Copiar premios globales (si existen). Primero limpiamos los actuales del concurso
    await RetoPremio.destroy({ where: { retoId: concurso.id } }).catch(() => {});
    const global = await Reto.findOne({ where: { titulo: 'GLOBAL_PREMIOS' } });
    if (global) {
      const premiosGlobales = await RetoPremio.findAll({ where: { retoId: global.id } });
      if (premiosGlobales.length) {
        await RetoPremio.bulkCreate(
          premiosGlobales.map(p => ({ retoId: concurso.id, puesto: p.puesto, monto: p.monto }))
        );
      }
    }

    // 5) Limpiar ganadores previos de este concurso e insertar los nuevos
    await RetoGanador.destroy({ where: { retoId: concurso.id } }).catch(() => {});
    const publicadoEn = new Date();
    await RetoGanador.bulkCreate(
      lista.map(g => ({
        retoId: concurso.id,
        usuarioId: g.usuarioId,
        puesto: g.puesto,
        publicadoEn,
      }))
    );

    // 6) Registrar historial
    const hist = await RetoGanadorHist.create({ retoId: concurso.id, publicadoEn });
    await RetoGanadorHistDet.bulkCreate(
      lista.map(g => ({ histId: hist.id, usuarioId: g.usuarioId, puesto: g.puesto }))
    );

    // 7) Resetear puntos si lo piden (sin transacción; si falla, no afecta lo anterior)
    if (resetPuntos) {
      await uUsuarioNegocio.update({ puntos: 0 }, { where: {} }).catch(err => {
        console.warn('Reset puntos falló (se ignora):', err?.message || err);
      });
    }

    return res.json({
      ok: true,
      retoId: concurso.id,
      publicadoEn: publicadoEn.toISOString(),
      ganadores: lista,
    });
  } catch (err) {
    console.error('❌ POST /api/retos/sorteo/publicar (no-tx):', err?.message || err);
    return res.status(500).json({ error: 'No se pudieron publicar los ganadores' });
  }
});


// GET /api/retos/sorteo/ultimo  (público)
// GET /api/retos/sorteo/ultimo
router.get('/sorteo/ultimo', async (req, res) => {
  try {
    const ult = await RetoGanadorHist.findOne({
      order: [['publicadoEn', 'DESC']],
      include: [
        { model: Reto, attributes: ['id', 'titulo'] },
        {
          model: RetoGanadorHistDet,
          as: 'detalles',
          separate: true,               // permite ordenar el include
          order: [['puesto', 'ASC']],
          include: [
            {
              model: uUsuarioNegocio,
              as: 'usuario',            // 👈 mismo alias que en model.js
              attributes: ['id', 'nombre', 'puntos'],
            },
          ],
        },
      ],
    });

    if (!ult) return res.json(null);

    res.json({
      retoId: ult.retoId,
      titulo: ult.Reto?.titulo,
      fecha: ult.publicadoEn,
      ganadores: (ult.detalles || []).map(d => ({
        usuarioId: d.usuarioId,
        puesto: d.puesto,
        nombre: d.usuario?.nombre,      // 👈 ahora llega
        puntos: d.usuario?.puntos,
       
      })),
    });
  } catch (err) {
    console.error('❌ GET /api/retos/sorteo/ultimo:', err?.message || err);
    res.status(500).json({ error: 'No se pudo obtener el último sorteo' });
  }
});


// GET /api/retos/sorteo/historial  (público)
router.get('/sorteo/historial', async (req, res) => {
  try {
    const hs = await RetoGanadorHist.findAll({
      order: [['publicadoEn', 'DESC']],
      include: [{ model: Reto, attributes: ['id', 'titulo'] }],
      limit: 12,
    });

    const out = [];
    for (const h of hs) {
      const det = await RetoGanadorHistDet.findAll({
        where: { histId: h.id },
        include: [{ model: uUsuarioNegocio, attributes: ['id', 'nombre', 'puntos'] }],
        order: [['puesto', 'ASC']],
      });
      out.push({
        retoId: h.retoId,
        titulo: h.Reto?.titulo,
        fecha: h.publicadoEn,
        ganadores: det.map(d => ({
          usuarioId: d.usuarioId,
          puesto: d.puesto,
          nombre: d.uUsuarioNegocio?.nombre,
          puntos: d.uUsuarioNegocio?.puntos,
        })),
      });
    }
    res.json(out);
  } catch (err) {
    console.error('❌ GET /api/retos/sorteo/historial:', err?.message);
    res.status(500).json({ error: 'No se pudo obtener el historial' });
  }
});

// POST /api/retos/sorteo/reset-puntos  (solo admin)
router.post('/sorteo/reset-puntos', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  const { confirmar = false } = req.body || {};
  if (!confirmar) return res.status(400).json({ error: 'Debe confirmar el reseteo' });
  try {
    await uUsuarioNegocio.update({ puntos: 0 }, { where: {} });
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ POST /api/retos/sorteo/reset-puntos:', err?.message);
    res.status(500).json({ error: 'No se pudo resetear los puntos' });
  }
});



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
router.put(
  '/mirarsorteo/visibilidad',
  autenticarTokenNegocio,   // ⬅️ primero autenticar
  soloAdminNegocio,         // ⬅️ luego validar admin
  async (req, res) => {
    try {
      const { verPremioPublico, verFechaPublica, mostrarGanadoresPublico, mostrarRankingPublico } = req.body;

      const isBoolOrUndef = (v) => typeof v === 'boolean' || typeof v === 'undefined';
      if (![verPremioPublico, verFechaPublica, mostrarGanadoresPublico, mostrarRankingPublico].every(isBoolOrUndef)) {
        return res.status(400).json({ error: 'Los campos deben ser booleanos' });
      }

      const cfg = await getOrCreateConfig();

      if (typeof verPremioPublico !== 'undefined') cfg.verPremioPublico = !!verPremioPublico;
      if (typeof verFechaPublica !== 'undefined') cfg.verFechaPublica = !!verFechaPublica;
      if (typeof mostrarGanadoresPublico !== 'undefined') cfg.mostrarGanadoresPublico = !!mostrarGanadoresPublico;
      if (typeof mostrarRankingPublico !== 'undefined') cfg.mostrarRankingPublico = !!mostrarRankingPublico;

      await cfg.save();

      res.json({
        ok: true,
        verPremioPublico: cfg.verPremioPublico,
        verFechaPublica: cfg.verFechaPublica,
        mostrarGanadoresPublico: cfg.mostrarGanadoresPublico,
        mostrarRankingPublico: cfg.mostrarRankingPublico,
      });
    } catch (err) {
      console.error('PUT visibilidad error:', err);
      res.status(500).json({ error: 'No se pudo actualizar la visibilidad' });
    }
  }
);

router.get('/mirarsorteo/visibilidad', async (_req, res) => {
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


// Ejemplo de endpoint progreso
// GET /api/retos/:id/progreso

router.get('/:id/progreso', autenticarTokenNegocio, async (req, res) => {
  try {
    const { id } = req.params;

    // LOG para ver qué trae el middleware
    console.log('auth payload:', {
      user: req.user,
      negocio: req.negocio,
      usuarioNegocioId: req.usuarioNegocioId
    });

    // extrae el id de forma robusta
    const fromQuery = (req.query.usuarioId !== undefined && req.query.usuarioId !== '')
      ? parseInt(String(req.query.usuarioId), 10)
      : null;

    const usuarioNegocioId =
      req.usuarioNegocioId ??                // muchos middlewares lo ponen así
      req.user?.usuarioNegocioId ??         // o así
      req.user?.id ??                       // o así
      req.negocio?.id ??                    // a veces lo guardan en req.negocio
      fromQuery ??                          // fallback explícito y seguro
      null;

    if (!usuarioNegocioId || Number.isNaN(usuarioNegocioId)) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const reto = await Reto.findByPk(id);
    if (!reto) return res.status(404).json({ error: 'Reto no encontrado' });

    const whereFecha = {};
    if (reto.rangoDias && Number(reto.rangoDias) > 0) {
      const desde = new Date();
      desde.setDate(desde.getDate() - Number(reto.rangoDias));
      whereFecha.createdAt = { [Op.gte]: desde };
    }

    let completado = 0;
    if (reto.tipo === 'visitas') {
      completado = await uCheckinNegocio.count({
        where: { usuarioNegocioId, ...(Object.keys(whereFecha).length ? whereFecha : {}) },
      });
    }

    res.json({
      retoId: reto.id,
      completado,
      objetivo: reto.meta ?? 0,
      requisitos: [],
    });
  } catch (e) {
    console.error('GET /retos/:id/progreso', e);
    res.status(500).json({ error: 'No se pudo calcular el progreso' });
  }
});


module.exports = router;
