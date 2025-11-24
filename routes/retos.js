// routes/retos.js
// ===========================================================
// RUTAS PARA MANEJO DE RETOS / CONCURSOS / SORTEOS
// ===========================================================
const express = require('express');
const router = express.Router();

const {
  Reto,
  uUsuarioNegocio,
  RetoParticipante,
  RetoGanador,
  RetoPremio,
  RetoGanadorHist,
  RetoGanadorHistDet,
  SorteoConfig,
  MovimientoSaludable,

  UsuarioRetoCumplido,

  MovimientoSaludablePunto,
  LugarSaludable,
  // si más adelante agregás un modelo de tracking saludable (distancia, posiciones, etc)
  // MovimientoSaludable,  // 👈 ejemplo, dejar comentado hasta que exista
  uCheckinNegocio,         // 👈 ya lo usabas en /progreso original
} = require('../models/model');

const { autenticarTokenNegocio } = require('../middlewares/authNegocio');
const { soloAdminNegocio } = require('../middlewares/soloAdminNegocio');
const { autenticarTokenUsuarioNegocio } = require('../middlewares/autenticarTokenUsuarioNegocio');
const { Op, fn, col } = require('sequelize');


/**
 * ===========================================================
 * GET /api/retos
 * → Devuelve todos los retos (cualquiera logueado de negocio)
 * ===========================================================
 */
router.get('/', async (req, res) => {
  try {
const retos = await Reto.findAll({
  attributes: [
    'id',
    'titulo',
    'descripcion',
    'puntos',
    'activo',
    'version',
    'tipo',
    'meta',
    'rangoDias',
    'destinoLatitud',
    'destinoLongitud',
    'destinoRadioMetros',
  ],
  order: [['id','DESC']],
  limit: 100,
});

    res.json(retos);
  } catch (err) {
    console.error('❌ GET /api/retos:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudieron cargar los retos' });
  }
});


// ===========================================================
// GET /api/retos/activo  (público)
// → Devuelve el reto marcado como "activo = true"
// ===========================================================
router.get('/activo', async (req, res) => {
  try {
    const activo = await Reto.findOne({ where: { activo: true } });
    res.json(activo || null);
  } catch (err) {
    console.error('❌ GET /api/retos/activo:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudo obtener el reto activo' });
  }
});


// ===========================================================
// GET /api/retos/ranking/top?limit=100  (público)
// → Ranking global por puntos acumulados
// ===========================================================
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





// routes/retos.js (fragmento)

router.get('/disponibles', autenticarTokenNegocio, async (req, res) => {
  try {
    // Sacar usuarioNegocioId del token
    const usuarioId =
      req.usuarioNegocioId ??
      req.user?.usuarioNegocioId ??
      req.negocio?.id ??
      null;

    if (!usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // ➤ Traer todos los retos (SIN fechaInicio / fechaFin)
    const retos = await Reto.findAll({
      attributes: [
        'id',
        'titulo',
        'descripcion',
        'puntos',
        'activo',
        'tipo',
        'meta',
        'rangoDias',
        'destinoLatitud',
        'destinoLongitud',
        'destinoRadioMetros'
      ],
      order: [['id', 'DESC']]
    });

    // ➤ Traer progreso del usuario por cada reto
    const progresos = await Promise.all(
      retos.map(async (r) => {
        try {
          const prog = await RetoParticipante.findOne({
            where: { retoId: r.id, usuarioId }
          });

          return { retoId: r.id, iniciado: !!prog };
        } catch {
          return { retoId: r.id, iniciado: false };
        }
      })
    );

    const progMap = Object.fromEntries(
      progresos.map((p) => [p.retoId, p.iniciado])
    );

    // ➤ Clasificación simple sin fechas
    const activosVigentes = [];
    const inactivos = [];

    for (const r of retos) {
      const base = { ...r.toJSON(), iniciado: progMap[r.id] };

      if (r.activo) {
        activosVigentes.push(base);
      } else {
        inactivos.push(base);
      }
    }

    // futuros y vencidos vacíos para no romper el front
    const futuros = [];
    const vencidos = [];

    res.json({
      activosVigentes,
      futuros,
      vencidos,
      inactivos
    });

  } catch (err) {
    console.error('❌ GET /api/retos/disponibles', err);
    res.status(500).json({ error: 'No se pudieron obtener los retos disponibles' });
  }
});


/**
 * ===========================================================
 * POST /api/retos/crear
 * → Crear nuevo reto (solo admin de negocios)
 * body: {
 *   titulo, descripcion, puntos,
 *   tipo,       // 'visitas' | 'movimiento_distancia' | 'movimiento_destino' | 'general' | ...
 *   meta,       // número objetivo: ej 3000 (metros), 5 (lugares), 10 (visitas)
 *   rangoDias,  // ej: 1 = últimas 24h, 7 = última semana
 *   fechaInicio, fechaFin   // si los usás
 * }
 * ===========================================================
 */
router.post('/crear', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  try {
    const {
      titulo,
      descripcion,
      puntos,
      fechaInicio,
      fechaFin,
      tipo,              // 'visitas' | 'movimiento_distancia' | 'puntos' | 'destino_unico' | 'general'
      meta,              // según el tipo (cantidad, metros, puntos)
      rangoDias,         // en cuántos días lo tiene que lograr
      destinoLatitud,    // solo para destino_unico
      destinoLongitud,
      destinoRadioMetros,
    } = req.body;

    if (!titulo || !descripcion || !puntos) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const ultimaVersion = await Reto.max('version');
    const nuevaVersion = (ultimaVersion || 0) + 1;

    const nuevo = await Reto.create({
      titulo,
      descripcion,
      puntos,
      tipo: tipo || 'general',
      meta: meta ?? null,
      rangoDias: rangoDias ?? null,
      destinoLatitud: destinoLatitud ?? null,
      destinoLongitud: destinoLongitud ?? null,
      destinoRadioMetros: destinoRadioMetros ?? null,
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




// ===========================================================
// PATCH /api/retos/:id/activar  (solo admin negocio)
// → Deja solo un reto como activo = true
// ===========================================================
// PATCH /api/retos/:id/activar  (solo admin negocio)
// → Activa SOLO este reto, sin tocar los otros
router.patch('/:id/activar', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  const { id } = req.params;

  try {
    const [count] = await Reto.update(
      { activo: true },
      { where: { id } }
    );

    if (!count) {
      return res.status(404).json({ error: 'Reto no encontrado' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('❌ PATCH /api/retos/:id/activar:', err?.message, err?.stack);
    return res.status(500).json({ error: 'No se pudo activar el reto' });
  }
});

// ===========================================================
// PUT /api/retos/:id  (solo admin negocio)
// → Actualizar un reto existente
//  - Permite cambiar tipo, meta, rangoDias, etc
// ===========================================================
router.put('/:id', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  const { id } = req.params;
  try {
    const reto = await Reto.findByPk(id);
    if (!reto) return res.status(404).json({ error: 'Reto no encontrado' });

    // Podés hacer validaciones similares a /crear si querés
    await reto.update(req.body);
    res.json(reto);
  } catch (err) {
    console.error('❌ PUT /api/retos/:id:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudo actualizar el reto' });
  }
});


// ===========================================================
// DELETE /api/retos/:id  (solo admin negocio)
// → Borrar un reto
// ===========================================================
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


// ===========================================================
// GET /api/retos/:id/participantes  (público/admin)
// → Lista usuarios anotados en el reto (RetoParticipante)
// ===========================================================
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


// ===========================================================
// POST /api/retos/:id/participantes  (solo admin negocio)
// body: { usuarioIds: number[] }
// → Agrega participantes manualmente a un reto
// ===========================================================
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


// ===========================================================
// DELETE /api/retos/:id/participantes/:usuarioId  (solo admin negocio)
// → Quita un participante de un reto
// ===========================================================
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


// ===========================================================
// GET /api/retos/:id/ganadores  (público)
// → Lista ganadores actuales del reto (RetoGanador)
// ===========================================================
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


// ===========================================================
// POST /api/retos/:id/publicar-ganadores  (solo admin negocio)
// body:
//  {
//    ganadores: [{ usuarioId, puesto }],
//    premios:   [{ puesto, monto }]
//  }
// → Publica ganadores fijos para un reto puntual
// ===========================================================
router.post('/:id/publicar-ganadores', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  const { id } = req.params;
  const { ganadores = [], premios = [] } = req.body;

  if (!Array.isArray(ganadores) || ganadores.length === 0) {
    return res.status(400).json({ error: 'Debe enviar ganadores' });
  }

  const t = await Reto.sequelize.transaction();

  try {
    await RetoGanador.destroy({ where: { retoId: id }, transaction: t });
    await RetoPremio.destroy({ where: { retoId: id }, transaction: t });

    for (const g of ganadores) {
      if (!g.usuarioId || !g.puesto) continue;
      await RetoGanador.create(
        { retoId: id, usuarioId: g.usuarioId, puesto: g.puesto, publicadoEn: new Date() },
        { transaction: t }
      );
    }

    for (const p of premios) {
      if (!p.puesto && p.puesto !== 0) continue;
      await RetoPremio.create(
        { retoId: id, puesto: p.puesto, monto: p.monto || 0 },
        { transaction: t }
      );
    }

    const hist = await RetoGanadorHist.create(
      { retoId: id, publicadoEn: new Date() },
      { transaction: t }
    );
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


// ===========================================================
// GET /api/retos/:id/historial-ganadores  (público)
// → Historial de publicaciones de ganadores para un reto
// ===========================================================
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


// ===========================================================
// GET /api/retos/usuarios-premium   (solo admin negocio)
// → Lista de usuarios con flags de premium/admin
// ===========================================================
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


// ===========================================================
// PATCH /api/retos/usuarios-premium/:id  (solo admin negocio)
// → Cambia el flag esPremium de un usuario
// ===========================================================
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


// ===========================================================
// GET /api/retos/meta  (público)
// → Devuelve versión de retos (para invalidar cache en frontend)
// ===========================================================
// ===========================================================
// GET /api/retos/meta  (público)
// → Devuelve solo la versión más alta de retos
// ===========================================================
router.get('/meta', async (req, res) => {
  try {
    const ultimo = await Reto.findOne({
      order: [['updatedAt', 'DESC']],
      attributes: ['version'],
    });

    const version = ultimo ? Number(ultimo.version) : 1;

    res.json({ version });
  } catch (err) {
    console.error('❌ GET /api/retos/meta:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudo obtener meta de retos' });
  }
});
// ===========================================================
// Edita Reto
// 
// ===========================================================
router.put('/editar/:id', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  try {
    const id = req.params.id;

    const ultimaVersion = await Reto.max('version');
    const nuevaVersion = (ultimaVersion || 0) + 1;

    const [rows, [actualizado]] = await Reto.update(
      {
        ...req.body,
        version: nuevaVersion,
      },
      {
        where: { id },
        returning: true,
      }
    );

    if (!rows) {
      return res.status(404).json({ error: 'Reto no encontrado' });
    }

    res.json(actualizado);
  } catch (err) {
    console.error('❌ PUT /api/retos/editar:', err);
    res.status(500).json({ error: 'No se pudo editar el reto' });
  }
});

// ===========================================================
// BLOQUE SORTEO GLOBAL
// Premios globales, publicación, historial, reset de puntos
// ===========================================================

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
    res.json(premios);
  } catch (err) {
    console.error('❌ GET /api/retos/:id/premios:', err?.message, err?.stack);
    res.status(500).json({ error: 'No se pudieron obtener los premios' });
  }
});


// PUT /api/retos/:id/premios  (admin negocio)
//  - Si id === 'sorteo', aplica sobre GLOBAL_PREMIOS
router.put('/:id/premios', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  let { id } = req.params;
  const { premios = [] } = req.body;

  const list = Array.isArray(premios)
    ? premios
        .map(p => ({ puesto: Number(p.puesto), monto: Number(p.monto) }))
        .filter(p => Number.isFinite(p.puesto) && p.puesto > 0 && Number.isFinite(p.monto) && p.monto >= 0)
    : [];

  try {
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
      meta = await Reto.create({
        titulo: 'PROXIMA_PUBLICACION',
        descripcion: fecha,
        puntos: 0,
        tipo: 'general',
        activo: false,
        version: 1,
      });
    else await meta.update({ descripcion: fecha });
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ PUT /api/retos/sorteo/proximo:', err?.message);
    res.status(500).json({ error: 'No se pudo actualizar la fecha' });
  }
});

// POST /api/retos/sorteo/publicar  (solo admin)
//  - Publica un sorteo mensual usando ranking de puntos o lista explícita
router.post('/sorteo/publicar', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  try {
    const cant = Math.max(1, Number(req.body?.cantidad) || 3);
    const resetPuntos = Boolean(req.body?.resetPuntos);
    let lista = Array.isArray(req.body?.ganadores) ? req.body.ganadores : [];

    if (!lista.length) {
      const top = await uUsuarioNegocio.findAll({
        attributes: ['id', 'nombre', 'puntos'],
        order: [['puntos', 'DESC']],
        limit: cant,
      });
      lista = top.map((u, i) => ({ usuarioId: Number(u.id), puesto: i + 1 }));
    }

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

    const ids = lista.map(g => g.usuarioId);
    const existentes = await uUsuarioNegocio.findAll({ where: { id: ids }, attributes: ['id'] });
    const okIds = new Set(existentes.map(x => Number(x.id)));
    const faltantes = ids.filter(id => !okIds.has(id));
    if (faltantes.length) {
      return res.status(409).json({
        error: 'Algunos usuarioId no existen en uUsuarioNegocio',
        faltantes,
      });
    }

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

    const hist = await RetoGanadorHist.create({ retoId: concurso.id, publicadoEn });
    await RetoGanadorHistDet.bulkCreate(
      lista.map(g => ({ histId: hist.id, usuarioId: g.usuarioId, puesto: g.puesto }))
    );

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
router.get('/sorteo/ultimo', async (req, res) => {
  try {
    const ult = await RetoGanadorHist.findOne({
      order: [['publicadoEn', 'DESC']],
      include: [
        { model: Reto, attributes: ['id', 'titulo'] },
        {
          model: RetoGanadorHistDet,
          as: 'detalles',
          separate: true,
          order: [['puesto', 'ASC']],
          include: [
            {
              model: uUsuarioNegocio,
              as: 'usuario',
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
        nombre: d.usuario?.nombre,
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


// ===========================================================
// Config de visibilidad del sorteo (qué mostrar al público)
// ===========================================================
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
  autenticarTokenNegocio,
  soloAdminNegocio,
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

  // ===========================================================
  // POST /api/retos/:id/empezar   (usuario de la app)
  // → Marca que el usuario comenzó un reto (solo hace falta
  //   para tipos como 'movimiento_distancia' o 'destino_unico')
  // ===========================================================
  router.post('/:id/empezar', autenticarTokenNegocio, async (req, res) => {
    try {
      const { id } = req.params;

      // Mismo criterio que usaste en /:id/progreso para identificar al usuario
      const fromQuery =
        req.query.usuarioId !== undefined && req.query.usuarioId !== ''
          ? parseInt(String(req.query.usuarioId), 10)
          : null;

      const usuarioNegocioId =
        req.usuarioNegocioId ??
        req.user?.usuarioNegocioId ??
        req.user?.id ??
        req.negocio?.id ??
        fromQuery ??
        null;

      if (!usuarioNegocioId || Number.isNaN(usuarioNegocioId)) {
        return res.status(401).json({ error: 'No autenticado' });
      }

      const reto = await Reto.findByPk(id);
      if (!reto) return res.status(404).json({ error: 'Reto no encontrado' });

      // Tipos de reto que NO necesitan inicio manual (se llenan solos)
      const tiposAuto = ['visitas', 'puntos', 'compras_qr'];

      if (tiposAuto.includes(reto.tipo)) {
        return res.json({
          ok: true,
          mensaje: 'Este tipo de reto se completa automáticamente, no requiere empezar.',
        });
      }

      // Para retos manuales (movimiento_distancia, destino_unico, etc.)
      const [participante, creado] = await RetoParticipante.findOrCreate({
        where: {
          retoId: reto.id,
          usuarioId: usuarioNegocioId,
        },
      });

      return res.json({
        ok: true,
        retoId: reto.id,
        usuarioId: usuarioNegocioId,
        creado, // true si se creó ahora, false si ya estaba anotado
      });
    } catch (err) {
      console.error('❌ POST /api/retos/:id/empezar:', err?.message, err);
      res.status(500).json({ error: 'No se pudo iniciar el reto' });
    }
  });

// ===========================================================
// GET /api/retos/:id/progreso  (requiere token negocio)
// → Calcula el progreso del USUARIO logueado en un reto puntual
//    - Soporta varios tipos de reto:
//      * 'visitas'
//      * 'visitas_distintas'
//      * 'puntos'
//      * 'distancia'      (TODO, ver comentario interno)
//      * 'destino'        (TODO, ver comentario interno)
// ===========================================================
// Ejemplo de endpoint progreso
// GET /api/retos/:id/progreso
// Ejemplo: GET /api/retos/:id/progreso
router.get('/:id/progreso', autenticarTokenNegocio, async (req, res) => {
  try {
    const { id } = req.params;

    // LOG para debug
    console.log('auth payload:', {
      user: req.user,
      negocio: req.negocio,
      usuarioNegocioId: req.usuarioNegocioId,
    });

    // 1) Sacamos el usuarioNegocioId de forma robusta
    const fromQuery =
      req.query.usuarioId !== undefined && req.query.usuarioId !== ''
        ? parseInt(String(req.query.usuarioId), 10)
        : null;

    const usuarioNegocioId =
      req.usuarioNegocioId ??
      req.user?.usuarioNegocioId ??
      req.user?.id ??
      req.negocio?.id ??
      fromQuery ??
      null;

    if (!usuarioNegocioId || Number.isNaN(usuarioNegocioId)) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // 2) Buscamos el reto
    const reto = await Reto.findByPk(id);
    if (!reto) return res.status(404).json({ error: 'Reto no encontrado' });

    // 3) Filtro por rango de días (si el reto lo tiene configurado)
    const whereFecha = {};
    if (reto.rangoDias && Number(reto.rangoDias) > 0) {
      const desde = new Date();
      desde.setDate(desde.getDate() - Number(reto.rangoDias));
      whereFecha.createdAt = { [Op.gte]: desde };
    }

    let completado = 0;
    let requisitos = [];

    // 4) Lógica según tipo de reto
    switch (reto.tipo) {
      case 'visitas':
        // ✅ Reto: "Visitá X negocios" (usa check-in en negocios)
        completado = await uCheckinNegocio.count({
          where: {
            usuarioNegocioId,
            ...(Object.keys(whereFecha).length ? whereFecha : {}),
          },
        });
        break;

      case 'movimiento_distancia':
        // ✅ Reto: "Caminá / movete X km"
        completado =
          (await MovimientoSaludable.sum('distanciaMetros', {
            where: {
              usuarioNegocioId,
              ...(Object.keys(whereFecha).length ? whereFecha : {}),
            },
          })) || 0;
        // (en el frontend si querés lo mostrás en km: completado / 1000)
        break;

    case 'destino_unico':
case 'movimiento_destino': { // por si quedó viejo en la BD
  // armamos filtro de fecha para los puntos
  const wherePunto = {};
  if (whereFecha.createdAt) {
    wherePunto.createdAt = whereFecha.createdAt;
  }

  const puntos = await MovimientoSaludablePunto.findAll({
    where: wherePunto,
    include: [
      {
        model: MovimientoSaludable,
        as: 'movimiento',        // 👈 alias como en model.js
        where: { usuarioNegocioId },
        attributes: [],          // no necesitamos campos del movimiento
      },
      {
        model: LugarSaludable,
        as: 'lugar',
        attributes: ['id', 'nombre'],
      },
    ],
  });

  // Distintos lugares (por si pasa varias veces por el mismo)
  const porLugar = new Map();
  for (const p of puntos) {
    const lid = p.lugarId;       // 👈 este es el campo real
    if (!lid) continue;
    if (!porLugar.has(lid)) {
      porLugar.set(lid, p);
    }
  }

  completado = porLugar.size;
  requisitos = Array.from(porLugar.values()).map((row) => ({
    lugarId: row.lugarId,
    nombre: row.lugar?.nombre || 'Lugar saludable',
  }));
  break;
}

      case 'compras_qr':
        // ✅ Reto: "Hacé X compras escaneando QR"
        // Ajustá el campo 'tipo' si en tu modelo es otro nombre
        completado = await uCheckinNegocio.count({
          where: {
            usuarioNegocioId,
            tipo: 'compra',
            ...(Object.keys(whereFecha).length ? whereFecha : {}),
          },
        });
        break;

      case 'puntos':
        // ✅ Reto: "Juntá X puntos"
        // Usamos los puntos totales del usuarioNegocio
        {
          const user = await uUsuarioNegocio.findByPk(usuarioNegocioId, {
            attributes: ['puntos'],
          });
          completado = Number(user?.puntos || 0);
        }
        break;

      case 'general':
      default:
        // ✅ Reto genérico (todavía sin lógica específica)
        completado = 0;
        requisitos = [];
        break;
    }

    // 5) Respondemos al frontend
    res.json({
      retoId: reto.id,
      tipo: reto.tipo,
      completado,
      objetivo: reto.meta ?? 0,
      requisitos, // array vacío o con info (ej. lugares visitados)
    });
  } catch (e) {
    console.error('GET /api/retos/:id/progreso', e);
    res.status(500).json({ error: 'No se pudo calcular el progreso' });
  }
});



router.post('/registrar', autenticarTokenNegocio, async (req, res) => {
  try {
    // ⚙️ Identificar al usuario de negocios desde el token
    const usuarioNegocioId =
      req.usuarioNegocioId ??
      req.user?.usuarioNegocioId ??
      req.user?.id ??
      null;

    if (!usuarioNegocioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const {
      distanciaMetros,
      duracionSegundos,
      modoDetectado = 'desconocido',
      origen,
      destino,
      lugarSaludableId,
    } = req.body || {};

    // ✅ Validaciones básicas
    if (!distanciaMetros || distanciaMetros <= 0) {
      return res.status(400).json({ error: 'distanciaMetros inválida' });
    }
    if (!duracionSegundos || duracionSegundos <= 0) {
      return res.status(400).json({ error: 'duracionSegundos inválida' });
    }

    // 🧮 Calcular velocidad para descartar auto/moto
    const velocidadKmH = (distanciaMetros / duracionSegundos) * 3.6;

    // Umbral configurable: por encima de 20 km/h lo consideramos NO saludable (auto/moto)
    const ES_AUTO = velocidadKmH > 20;

    if (ES_AUTO) {
      // Registramos igual el intento por auditoría, pero no damos puntos
      await MovimientoSaludable.create({
        usuarioNegocioId,
        distanciaMetros,
        duracionSegundos,
        velocidadKmH,
        modoDetectado: 'sospechoso',
        origenLat: origen?.lat ?? null,
        origenLng: origen?.lng ?? null,
        destinoLat: destino?.lat ?? null,
        destinoLng: destino?.lng ?? null,
        lugarSaludableId: lugarSaludableId ?? null,
        valido: false,
      });

      return res.json({
        ok: true,
        puntosGanados: 0,
        motivo: 'Velocidad demasiado alta, se considera vehículo. No suma puntos.',
      });
    }

    // 💾 Registrar movimiento válido
    const movimiento = await MovimientoSaludable.create({
      usuarioNegocioId,
      distanciaMetros,
      duracionSegundos,
      velocidadKmH,
      modoDetectado,
      origenLat: origen?.lat ?? null,
      origenLng: origen?.lng ?? null,
      destinoLat: destino?.lat ?? null,
      destinoLng: destino?.lng ?? null,
      lugarSaludableId: lugarSaludableId ?? null,
      valido: true,
    });

    // 🎯 Calcular puntos por distancia (regla simple: 1 punto cada 100 m)
    const puntosPorDistancia = Math.max(0, Math.floor(distanciaMetros / 100));

    // 🎁 Bonus por llegar a un lugar saludable (si viene lugarSaludableId)
    let puntosBonusLugar = 0;
    if (lugarSaludableId) {
      // evitamos duplicar en el mismo día el bonus del mismo lugar
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const mañana = new Date(hoy);
      mañana.setDate(hoy.getDate() + 1);

      const yaTiene = await MovimientoSaludablePunto.findOne({
        where: {
          usuarioNegocioId,
          lugarSaludableId,
          createdAt: { [Op.between]: [hoy, mañana] },
        },
      });

      if (!yaTiene) {
        puntosBonusLugar = 10; // ej: 10 puntos extra por visitar el punto
        await MovimientoSaludablePunto.create({
          usuarioNegocioId,
          lugarSaludableId,
          movimientoId: movimiento.id,
        });
      }
    }

    const puntosGanados = puntosPorDistancia + puntosBonusLugar;

    // 🔢 Actualizar puntos del usuarioNegocio
    if (puntosGanados > 0) {
      await uUsuarioNegocio.increment(
        { puntos: puntosGanados },
        { where: { id: usuarioNegocioId } }
      );
    }

    // (opcional) calcular distancia total del día para mostrar feedback
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const mañana = new Date(hoy);
    mañana.setDate(hoy.getDate() + 1);

    const totalHoyRow = await MovimientoSaludable.findOne({
      where: {
        usuarioNegocioId,
        valido: true,
        createdAt: { [Op.between]: [hoy, mañana] },
      },
      attributes: [[fn('SUM', col('distanciaMetros')), 'total']],
      raw: true,
    });

    const totalDistanciaHoy = Number(totalHoyRow?.total || 0);

    return res.json({
      ok: true,
      puntosGanados,
      puntosPorDistancia,
      puntosBonusLugar,
      velocidadKmH: Number(velocidadKmH.toFixed(2)),
      totalDistanciaHoy,
    });
  } catch (err) {
    console.error('❌ POST /api/retos/registrar:', err?.message, err);
    res.status(500).json({ error: 'No se pudo registrar el movimiento' });
  }

});




function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// POST /api/retos/cobrar
router.post('/cobrar', autenticarTokenNegocio, async (req, res) => {
  try {
    const { retoId, distanciaMetros, latitud, longitud } = req.body;

    // Sacar usuario negocio
    const fromQuery =
      req.query.usuarioId !== undefined && req.query.usuarioId !== ''
        ? parseInt(String(req.query.usuarioId), 10)
        : null;

    const usuarioNegocioId =
      req.usuarioNegocioId ??
      req.user?.usuarioNegocioId ??
      req.user?.id ??
      req.negocio?.id ??
      fromQuery ??
      null;

    if (!usuarioNegocioId || Number.isNaN(usuarioNegocioId)) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const reto = await Reto.findByPk(retoId);
    if (!reto) {
      return res.status(404).json({ error: 'Reto no encontrado' });
    }

    // evitar doble cobro
    const yaCumplido = await UsuarioRetoCumplido.findOne({
      where: { retoId: reto.id, usuarioId: usuarioNegocioId },
    });

    if (yaCumplido) {
      return res.status(400).json({ error: 'Este reto ya fue cobrado.' });
    }

    let valido = false;

    switch (reto.tipo) {
      case 'movimiento_distancia': {
        const meta = Number(reto.meta || 0);
        const dist = Number(distanciaMetros || 0);
        if (meta > 0 && dist >= meta) {
          valido = true;
        }
        break;
      }

      case 'destino_unico':
      case 'lugar_especifico': {
        if (
          reto.destinoLatitud == null ||
          reto.destinoLongitud == null ||
          reto.destinoRadioMetros == null
        ) {
          return res.status(400).json({
            error: 'El reto de destino no tiene coordenadas configuradas.',
          });
        }

        if (latitud == null || longitud == null) {
          return res.status(400).json({
            error: 'Faltan coordenadas actuales del usuario.',
          });
        }

        const dist = calcularDistanciaMetros(
          Number(latitud),
          Number(longitud),
          Number(reto.destinoLatitud),
          Number(reto.destinoLongitud)
        );

        if (dist <= Number(reto.destinoRadioMetros)) {
          valido = true;
        }
        break;
      }

      default:
        return res.status(400).json({
          error: `Tipo de reto no soportado para cobro automático: ${reto.tipo}`,
        });
    }

    if (!valido) {
      return res.status(400).json({
        error: 'Las condiciones del reto aún no fueron cumplidas.',
      });
    }

    const puntos = Number(reto.puntos || 0);

    const usuario = await uUsuarioNegocio.findByPk(usuarioNegocioId);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario negocio no encontrado.' });
    }

    usuario.puntos = Number(usuario.puntos || 0) + puntos;
    await usuario.save();

    // 👇 Registro en el historial de retos cumplidos
    await UsuarioRetoCumplido.create({
      usuarioId: usuarioNegocioId,
      retoId: reto.id,
      // ajustá el nombre del campo según tu modelo:
      puntosOtorgados: puntos, // o puntosGanados si así se llama en tu tabla
    });

    res.json({
      ok: true,
      retoId: reto.id,
      titulo: reto.titulo,
      puntosGanados: puntos,
      puntosTotales: usuario.puntos,
    });
  } catch (e) {
    console.error('POST /api/retos/cobrar', e);
    res.status(500).json({ error: 'No se pudo cobrar el reto' });
  }
});

module.exports = router;
