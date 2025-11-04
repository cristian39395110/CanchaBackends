// routes/qr.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Op, fn, col } = require('sequelize'); // ← asegurate de tener fn/col

// ⚠️ Ajustá el case de los requires según tu FS (Linux/Mac es case-sensitive)
const { autenticarToken } = require('../middlewares/auth');
const Cancha = require('../models/cancha');              // 'Cancha' o 'cancha' según tu archivo
const QREmision = require('../models/QREmision');
const QRCheckin = require('../models/QRCheckin');
const Partido = require('../models/partido');            // 'Partido' o 'partido'
const UsuarioPartido = require('../models/usuarioPartido');
const Usuario = require('../models/usuario');

/* ===========================
   Helpers
   =========================== */

function todayDateOnlyTZ(date = new Date()) {
  // Queremos el día local de Argentina (GMT-3)
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const argentinaOffset = -3 * 60; // GMT-3
  const argentinaTime = new Date(utc + argentinaOffset * 60000);

  const year = argentinaTime.getFullYear();
  const month = String(argentinaTime.getMonth() + 1).padStart(2, '0');
  const day = String(argentinaTime.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// Código manual de 6 chars (A–Z + 2–9, sin I, L, O, 0, 1)
function genManualCode(len = 6) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

// Haversine: distancia en metros entre dos coords
function haversineMeters(lat1, lon1, lat2, lon2) {
  if (
    lat1 == null || lon1 == null || lat2 == null || lon2 == null ||
    isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)
  ) return null;

  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000; // m
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Combina fecha (YYYY-MM-DD) y hora (HH:mm:ss) a Date local (server)
// Reemplazá tu combineDateTime por este:
function combineDateTimeARG(dateOnly, timeStr) {
  const [Y, M, D] = String(dateOnly).split('-').map(Number);
  const [h, m, s = '0'] = String(timeStr).split(':');
  const hh = Number(h), mm = Number(m), ss = Number(s);

  // Creamos un UTC corrido para representar hora local AR (-03:00)
  // Local AR = UTC + (-3h) => UTC = Local + 3h
  const utcMs = Date.UTC(Y, M - 1, D, hh + 3, mm, ss);
  return new Date(utcMs);
}

function buildTimeWindow(partido, cancha) {
  const inicio = combineDateTimeARG(partido.fecha, partido.hora);


  const anticipoMin = Number(cancha?.minutosAnticipoCheckin ?? 30);
  const graciaMin   = Number(cancha?.minutosGraciaCheckin ?? 60);
  const desde = new Date(inicio.getTime() - anticipoMin * 60_000);
  const hasta = new Date(inicio.getTime() + graciaMin   * 60_000);

    console.log('[TW]', partido.id, partido.fecha, partido.hora, '→ inicio:', inicio.toISOString());
  return { desde, hasta, inicio };
}


/**
 * Busca el partido "válido ahora" en esa cancha.
 * Estrategia MVP:
 *  - Partidos de HOY en esa cancha
 *  - Que estén en ventana horaria según parámetros de cancha
 *  - Si hay varios, elige el más cercano a 'ahora' (por |inicio - now|)
 */
// firma nueva
// Selector robusto: cancha + ventana + confirmación
async function findMatchingPartidoForNow(
  canchaId,
  { usuarioId = null, partidoIdPreferido = null } = {}
) {
  const hoy = todayDateOnlyTZ();

  // 1) Traer partidos de HOY en esa cancha
  const partidos = await Partido.findAll({
    where: { canchaId, fecha: hoy },
    order: [['hora', 'ASC']],
  });
  if (!partidos.length) {
    return { ok: false, error: 'SIN_PARTIDOS_HOY' };
  }

  // 2) Filtrar por ventana horaria
  const cancha = await Cancha.findByPk(canchaId);
  const now = new Date();
  const candidatos = [];
  for (const p of partidos) {
    const { desde, hasta, inicio } = buildTimeWindow(p, cancha);
    if (now >= desde && now <= hasta) {
      candidatos.push({ partido: p, inicio, desde, hasta });
    }
  }
  if (!candidatos.length) {
    return { ok: false, error: 'FUERA_DE_VENTANA' };
  }

  // 3) Si viene un partido preferido y está en ventana, priorizarlo
  if (partidoIdPreferido) {
    const hit = candidatos.find(c => Number(c.partido.id) === Number(partidoIdPreferido));
    if (hit) return { ok: true, partido: hit.partido, ventana: { desde: hit.desde, hasta: hit.hasta } };
  }

  // 4) Si tenemos usuarioId: quedarse solo con los que esté CONFIRMADO
  if (usuarioId) {
    const confirmados = [];
    for (const c of candidatos) {
      const up = await UsuarioPartido.findOne({
        where: { UsuarioId: usuarioId, PartidoId: c.partido.id, estado: 'confirmado' },
        attributes: ['UsuarioId'],
      });
      if (up) confirmados.push(c);
    }

    if (confirmados.length === 0) {
      return { ok: false, error: 'NO_PERMITIDO' }; // no está confirmado en ningún partido activo
    }

    if (confirmados.length === 1) {
      const c = confirmados[0];
      return { ok: true, partido: c.partido, ventana: { desde: c.desde, hasta: c.hasta } };
    }

    // 4.b Varios confirmados a la vez: elegir el más cercano a "ahora"
    confirmados.sort((a, b) => Math.abs(a.inicio - now) - Math.abs(b.inicio - now));
    const c = confirmados[0];
    return { ok: true, partido: c.partido, ventana: { desde: c.desde, hasta: c.hasta } };
  }

  // 5) Sin usuarioId (fallback): si hay uno, usar; si hay varios, elegir el más cercano
  if (candidatos.length === 1) {
    const c = candidatos[0];
    return { ok: true, partido: c.partido, ventana: { desde: c.desde, hasta: c.hasta } };
  }
  candidatos.sort((a, b) => Math.abs(a.inicio - now) - Math.abs(b.inicio - now));
  const c = candidatos[0];
  return { ok: true, partido: c.partido, ventana: { desde: c.desde, hasta: c.hasta } };
}

/**
 * Valida y registra el check-in:
 *  - Emision activa de hoy
 *  - Cancha existe (geofence)
 *  - Partido "válido ahora" en esa cancha
 *  - Usuario aceptado en ese partido (UsuarioPartido.estado='aceptado')
 *  - No duplicado aprobado
 *  - Distancia <= radioGeofence
 *  - Registra QRCheckin y suma puntos al usuario
 */
// ✅ validarYRegistrarCheckin: Política B (check-in por partido)
async function validarYRegistrarCheckin({ emision, usuarioId, lat, lng, deviceId, partidoId = null }) {
  try {
    const cancha = await Cancha.findByPk(emision.canchaId);
    if (!cancha) {
      return { ok: false, error: 'CANCHA_NO_ENCONTRADA', mensaje: 'La cancha no existe.' };
    }

    // 1) Resolver partido en esta cancha y ventana (con desambiguación)
    const match = await findMatchingPartidoForNow(cancha.id, {
      usuarioId,
      partidoIdPreferido: partidoId ?? null, // si viene del frontend, mejor
    });

    if (!match) {
      return { ok: false, error: 'FUERA_DE_VENTANA', mensaje: 'No hay un partido activo en esta cancha en este momento.' };
    }
    if (match.ok === false) {
      // Ambigüedad o fuera de ventana (según imple de findMatchingPartidoForNow)
      if (match.error === 'VARIOS_PARTIDOS_EN_VENTANA' || match.error === 'VARIOS_PARTIDOS_CONFIRMADOS_EN_VENTANA') {
        return {
          ok: false,
          error: match.error,
          mensaje: 'Hay más de un partido activo. Elegí uno.',
          candidatos: match.candidatos || []
        };
      }
      if (match.error === 'FUERA_DE_VENTANA') {
        return { ok: false, error: 'FUERA_DE_VENTANA', mensaje: 'No hay un partido activo en este momento.' };
      }
      return { ok: false, error: match.error || 'SIN_PARTIDO', mensaje: 'No se pudo identificar el partido.' };
    }

    const partido = match.partido ?? match; // por si tu función sigue devolviendo el partido directo

    // 2) Confirmación del usuario en ese partido
    const up = await UsuarioPartido.findOne({
      where: { UsuarioId: usuarioId, PartidoId: partido.id, estado: 'confirmado' }
    });
    if (!up) {
      return { ok: false, error: 'NO_PERMITIDO', mensaje: 'No estás confirmado en este partido (no podés hacer check-in).' };
    }

    // 3) Geofence
    const distancia = haversineMeters(Number(lat), Number(lng), Number(cancha.latitud), Number(cancha.longitud));
    if (distancia == null) {
      return { ok: false, error: 'SIN_UBICACION', mensaje: 'Falta ubicación para validar el check-in.' };
    }
    const radio = Number(cancha.radioGeofence ?? 100);
    if (distancia > radio) {
      return {
        ok: false,
        error: 'FUERA_GEOFENCE',
        mensaje: `Estás a ${Math.round(distancia)} m. Acercate a la cancha (radio ${radio} m).`,
        distancia: Math.round(distancia),
      };
    }

    // 4) Duplicado por partido
    const dup = await QRCheckin.findOne({ where: { usuarioId, partidoId: partido.id, resultado: 'aprobado' } });
    if (dup) {
      return { ok: false, error: 'DUPLICADO', mensaje: 'Ya registraste tu check-in para este partido.', checkinId: dup.id };
    }

    // 4.b (opcional) Anti-abuso por establecimiento+ventana
    // const { desde, hasta } = buildTimeWindow(partido, cancha);
    // const dupCancha = await QRCheckin.findOne({
    //   where: {
    //     usuarioId,
    //     canchaId: cancha.id,
    //     resultado: 'aprobado',
    //     createdAt: { [Op.between]: [desde, hasta] },
    //   }
    // });
    // if (dupCancha) {
    //   return { ok: false, error: 'YA_CHECKEADO_EN_CANCHA', mensaje: 'Ya hiciste check-in en este establecimiento en esta ventana.' };
    // }

    // 5) Sanidad de vínculo partido-cancha
    if (!partido.canchaId || Number(partido.canchaId) !== Number(cancha.id)) {
      return { ok: false, error: 'PARTIDO_SIN_CANCHA', mensaje: 'El partido no está vinculado correctamente a la cancha.' };
    }

    // 6) Regla x2 (corregida): organizador + dueño + premium (del jugador)
    const jugador = await Usuario.findByPk(usuarioId, { attributes: ['id', 'premium'] });
    const esPremium = Boolean(jugador?.premium);
    const esOrganizadorDelPartido = Number(partido.organizadorId) === Number(usuarioId);
    const esPropietarioDeLaCancha = Number(cancha.propietarioUsuarioId) === Number(usuarioId);

    const puntosBase = Number(emision.puntosOtorga ?? 0);
    const multiplicador = (esOrganizadorDelPartido && esPropietarioDeLaCancha && esPremium) ? 2 : 1;
    const puntosFinales = puntosBase * multiplicador;

    // 7) Registrar aprobado
    const check = await QRCheckin.create({
      usuarioId,
      partidoId: partido.id,
      canchaId: cancha.id,
      emisionId: emision.id,
      deviceId: deviceId ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      distancia: Math.round(distancia),
      resultado: 'aprobado',
      motivoDenegado: null,
      puntosOtorgados: puntosFinales,
    });

    // 8) Sumar puntos al usuario (ciclo + histórico)
    if (puntosFinales > 0) {
      await Usuario.increment(
        { puntuacion: puntosFinales, puntosHistorico: puntosFinales },
        { where: { id: usuarioId } }
      );
    }

    // 9) Respuesta OK
    return {
      ok: true,
      mensaje: `Check-in OK: +${puntosFinales} puntos${multiplicador === 2 ? ' (x2: organizador + dueño + premium)' : ''}`,
      puntos: puntosFinales,
      puntosBase,
      multiplicador,
      esDoble: multiplicador === 2,
      checkinId: check.id,
      partidoId: partido.id,
      canchaId: cancha.id,
      distancia: Math.round(distancia),
    };

  } catch (e) {
    console.error('validarYRegistrarCheckin()', e);
    return { ok: false, error: 'ERROR_INTERNO', mensaje: 'Error al registrar el check-in.' };
  }
}


/* ===========================
   Endpoints
   =========================== */

/**
 * POST /api/qr/emision/:canchaId
 * Crea (o devuelve) la emisión del DÍA para la cancha, con código único de 6 letras.
 * El QR ES ese código, y también se muestra en texto (ingreso manual).
 * Permisos: propietario de la cancha o admin.
 */
router.post('/emision/:canchaId', autenticarToken, async (req, res) => {
  try {
    const { canchaId } = req.params;
    const usuarioId = req.usuario?.id;
    const hoy = todayDateOnlyTZ();

    // 1) Cancha + permisos
    const cancha = await Cancha.findByPk(canchaId);
    if (!cancha) return res.status(404).json({ error: 'Cancha no encontrada' });

    const esPropietario = cancha.propietarioUsuarioId && cancha.propietarioUsuarioId === usuarioId;
    const esAdmin = !!req.usuario?.esAdmin;
    if (!esPropietario && !esAdmin) {
      return res.status(403).json({ error: 'No tenés permisos para generar el QR de esta cancha' });
    }

    // (Opcional) exigir premium/verificada:
    // if (!req.usuario?.premium) return res.status(403).json({ error: 'Solo premium' });
    // if (!cancha.verificada) return res.status(403).json({ error: 'La cancha debe estar verificada' });

    // 2) Asegurar qrSecret por si luego querés firmar/rotar
    if (!cancha.qrSecret) {
      cancha.qrSecret = uuidv4();
      await cancha.save();
    }

    // 3) Emisión del día (única por cancha)
    let emision = await QREmision.findOne({ where: { canchaId: cancha.id, fecha: hoy } });
    if (!emision) {
      emision = await QREmision.create({
        canchaId: cancha.id,
        fecha: hoy,
        puntosOtorga: Number(cancha.puntosAsociada || 0),

        rotacionSegundos: 60,
        activo: true,
      });
    }

    // 4) Generar manualCode 6 si no existe (único en el día globalmente)
    if (!emision.manualCode) {
      let code, clash = true;
      while (clash) {
        code = genManualCode(6);
        const exists = await QREmision.findOne({ where: { fecha: emision.fecha, manualCode: code } });
        clash = !!exists;
      }
      emision.manualCode = code;
      await emision.save();
    }

    // 5) Responder (payload del QR = manualCode)
    return res.json({
      emision: {
        id: emision.id,
        canchaId: emision.canchaId,
        fecha: emision.fecha,
        puntosOtorga: emision.puntosOtorga,
        activo: emision.activo,
        manualCode: emision.manualCode,
      },
      qr: {
        payload: emision.manualCode,        // encodeás esto como imagen QR
        expiresInSec: emision.rotacionSegundos,
        scheme: 'MCQR.<MANUALCODE>',
      },
    });
  } catch (e) {
    console.error('POST /api/qr/emision/:canchaId', e);
    return res.status(500).json({ error: 'Error al generar la emisión QR' });
  }
});

/**
 * GET /api/qr/emision/:canchaId/refresh
 * Devuelve el mismo código del día (para refrescar UI).
 */
router.get('/emision/:canchaId/refresh', autenticarToken, async (req, res) => {
  try {
    const { canchaId } = req.params;
    const hoy = todayDateOnlyTZ();

    const cancha = await Cancha.findByPk(canchaId);
    if (!cancha) return res.status(404).json({ error: 'Cancha no encontrada' });

    const emision = await QREmision.findOne({ where: { canchaId: cancha.id, fecha: hoy, activo: true } });
    if (!emision) return res.status(404).json({ error: 'No hay emisión activa para hoy' });

    return res.json({
      qr: {
        payload: emision.manualCode,
        expiresInSec: emision.rotacionSegundos,
      },
      manualCode: emision.manualCode,
    });
  } catch (e) {
    console.error('GET /api/qr/emision/:canchaId/refresh', e);
    return res.status(500).json({ error: 'Error al refrescar el QR' });
  }
});

/**
 * POST /api/qr/validar-manual
 * body: { manualCode, lat, lng, deviceId }
 * El jugador ingresa el código de 6 letras (sin cámara).
 */
router.post('/validar-manual', autenticarToken, async (req, res) => {
  try {
    const { manualCode, lat, lng, deviceId } = req.body;
    const usuarioId = req.usuario?.id;
    if (!manualCode || !usuarioId) return res.status(400).json({ error: 'Datos incompletos' });

    const hoy = todayDateOnlyTZ();
    const emision = await QREmision.findOne({
      where: { fecha: hoy, manualCode: String(manualCode).toUpperCase(), activo: true }
    });
    if (!emision) return res.status(404).json({ error: 'Código inválido o emisión no activa' });
  console.log(lat)
  console.log(lng)
    const result = await validarYRegistrarCheckin({ emision, usuarioId, lat, lng, deviceId });
    if (result.ok) return res.json(result);
    return res.status(400).json(result);
  } catch (e) {
    console.error('POST /api/qr/validar-manual', e);
    return res.status(500).json({ error: 'Error al validar código' });
  }
});

/**
 * POST /api/qr/validar-qr
 * body: { payload, lat, lng, deviceId }
 * El jugador escaneó el QR: el payload ES el mismo manualCode.
 */
router.post('/validar-qr', autenticarToken, async (req, res) => {
  try {
    const { payload, lat, lng, deviceId } = req.body;
    const usuarioId = req.usuario?.id;
    if (!payload || !usuarioId) return res.status(400).json({ error: 'Datos incompletos' });

    const hoy = todayDateOnlyTZ();
    const emision = await QREmision.findOne({
      where: { fecha: hoy, manualCode: String(payload).toUpperCase(), activo: true }
    });
    if (!emision) return res.status(404).json({ error: 'QR inválido o emisión no activa' });

    const result = await validarYRegistrarCheckin({ emision, usuarioId, lat, lng, deviceId });
    if (result.ok) return res.json(result);
    return res.status(400).json(result);
  } catch (e) {
    console.error('POST /api/qr/validar-qr', e);
    return res.status(500).json({ error: 'Error al validar QR' });
  }
});

/**
 * GET /api/qr/emision/:canchaId/resumen
 * ---------------------------------------------------------------------------
 * Devuelve un RESUMEN de los check-ins de una cancha para una fecha dada
 * (por defecto HOY). Incluye:
 *  - Totales (aprobados/denegados)
 *  - Suma de puntos otorgados
 *  - Distancia promedio (m)
 *  - Listado paginado de check-ins con datos de usuario y partido
 *
 * Permisos: propietario de la cancha o admin.
 *
 * Query params:
 *   - fecha=YYYY-MM-DD (opcional, default: HOY)
 *   - resultado=aprobado|denegado (opcional, filtra el listado)
 *   - page=1..N (opcional, default 1)
 *   - pageSize=10..100 (opcional, default 20)
 * ---------------------------------------------------------------------------
 *
 * Ejemplo:
 *   GET /api/qr/emision/15/resumen?fecha=2025-10-21&resultado=aprobado&page=1&pageSize=20
 */
router.get('/emision/:canchaId/resumen', autenticarToken, async (req, res) => {
  try {
    const { canchaId } = req.params;
    const usuarioId = req.usuario?.id;

    // ----------- 1) Permisos del solicitante -----------
    const cancha = await Cancha.findByPk(canchaId);
    if (!cancha) return res.status(404).json({ error: 'Cancha no encontrada' });

    const esPropietario = cancha.propietarioUsuarioId && cancha.propietarioUsuarioId === usuarioId;
    const esAdmin = !!req.usuario?.esAdmin;
    if (!esPropietario && !esAdmin) {
      return res.status(403).json({ error: 'No tenés permisos para ver este resumen' });
    }

    // ----------- 2) Parámetros de consulta -----------
    const fecha = req.query.fecha || todayDateOnlyTZ(); // por defecto HOY
    const resultado = req.query.resultado && ['aprobado','denegado'].includes(req.query.resultado)
      ? req.query.resultado
      : undefined;

    // Paginación (defaults seguros)
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '20', 10), 1), 100);
    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    // Ventana de tiempo del día [00:00, 23:59:59] en TZ del server (MVP)
    const desde = new Date(`${fecha}T00:00:00`);
    const hasta = new Date(`${fecha}T23:59:59.999`);

    // ----------- 3) Filtros base para QRCheckin -----------
    const baseWhere = {
      canchaId: cancha.id,
      createdAt: { [Op.between]: [desde, hasta] },
    };
    if (resultado) baseWhere.resultado = resultado;

    // ----------- 4) Agregados (totales y KPIs del día) -----------
    // Totales por resultado (aprobado / denegado)
    const totalAprobados = await QRCheckin.count({
      where: { canchaId: cancha.id, resultado: 'aprobado', createdAt: { [Op.between]: [desde, hasta] } },
    });
    const totalDenegados = await QRCheckin.count({
      where: { canchaId: cancha.id, resultado: 'denegado', createdAt: { [Op.between]: [desde, hasta] } },
    });

    // Suma de puntos otorgados
    const puntosTotales = await QRCheckin.sum('puntosOtorgados', {
      where: { canchaId: cancha.id, resultado: 'aprobado', createdAt: { [Op.between]: [desde, hasta] } },
    }) || 0;

    // Distancia promedio (solo en aprobados con distancia no nula)
    const aprobadosConDistancia = await QRCheckin.findAll({
      where: {
        canchaId: cancha.id,
        resultado: 'aprobado',
        distancia: { [Op.ne]: null },
        createdAt: { [Op.between]: [desde, hasta] },
      },
      attributes: ['distancia'],
    });
    const distanciaPromedio = aprobadosConDistancia.length
      ? Math.round(aprobadosConDistancia.reduce((acc, r) => acc + Number(r.distancia || 0), 0) / aprobadosConDistancia.length)
      : null;

    // ----------- 5) Listado paginado con joins útiles -----------
    // Incluimos datos básicos del Usuario y del Partido para cada check-in
    const { rows, count } = await QRCheckin.findAndCountAll({
      where: baseWhere,
      include: [
        {
          model: Usuario,
          attributes: ['id', 'nombre', 'email', 'telefono', 'fotoPerfil'],
        },
        {
          model: Partido,
          attributes: [
            'id', 'nombre', 'fecha', 'hora', 'lugar',
            'canchaId', 'cantidadJugadores', 'deporteId'
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit,
    });

    // ----------- 6) Estructura de respuesta -----------
    return res.json({
      cancha: {
        id: cancha.id,
        nombre: cancha.nombre,
        direccion: cancha.direccion,
      },
      fecha,
      kpis: {
        totalAprobados,
        totalDenegados,
        puntosTotales,
        distanciaPromedio, // en metros (puede ser null si no hay data)
      },
      paginacion: {
        page,
        pageSize,
        totalItems: count,
        totalPages: Math.max(Math.ceil(count / pageSize), 1),
      },
      items: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        resultado: r.resultado,          // 'aprobado' | 'denegado'
        motivoDenegado: r.motivoDenegado,
        puntosOtorgados: r.puntosOtorgados,
        distancia: r.distancia,          // en metros (puede ser null)
        deviceId: r.deviceId,

        usuario: r.Usuario ? {
          id: r.Usuario.id,
          nombre: r.Usuario.nombre,
          email: r.Usuario.email,
          telefono: r.Usuario.telefono,
          fotoPerfil: r.Usuario.fotoPerfil,
        } : null,

        partido: r.Partido ? {
          id: r.Partido.id,
          nombre: r.Partido.nombre,
          fecha: r.Partido.fecha,
          hora: r.Partido.hora,
          lugar: r.Partido.lugar,
          canchaId: r.Partido.canchaId,
          cantidadJugadores: r.Partido.cantidadJugadores,
          deporteId: r.Partido.deporteId,
        } : null,
      })),
    });
  } catch (e) {
    console.error('GET /api/qr/emision/:canchaId/resumen', e);
    return res.status(500).json({ error: 'Error al obtener el resumen de check-ins' });
  }
});

// PUNTOS DEL USUARIO LOGUEADO
router.get('/mis-puntos', autenticarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario?.id;
    if (!usuarioId) return res.status(401).json({ error: 'No autenticado' });

    // Trae usuario con su acumulado
    const user = await Usuario.findByPk(usuarioId, {
      attributes: ['id', 'nombre', 'puntuacion']
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Puntos de HOY (aprobados)
    const hoy = todayDateOnlyTZ();
    const desde = new Date(`${hoy}T00:00:00`);
    const hasta = new Date(`${hoy}T23:59:59.999`);

    const puntosHoy =
      (await QRCheckin.sum('puntosOtorgados', {
        where: {
          usuarioId,
          resultado: 'aprobado',
          createdAt: { [Op.between]: [desde, hasta] },
        },
      })) || 0;

    // Últimos 5 check-ins del usuario
    const ultimos = await QRCheckin.findAll({
      where: { usuarioId },
      order: [['createdAt', 'DESC']],
      limit: 5,
      attributes: ['id', 'createdAt', 'resultado', 'puntosOtorgados', 'distancia'],
      include: [
        {
          model: Cancha,
          attributes: ['id', 'nombre'],
          required: false,
        },
        {
          model: Partido,
          attributes: ['id', 'fecha', 'hora', 'lugar'],
          required: false,
        },
      ],
    });

    return res.json({
      usuario: { id: user.id, nombre: user.nombre },
      puntosTotales: Number(user.puntuacion || 0),
      puntosHoy: Number(puntosHoy || 0),
      ultimosCheckins: ultimos.map((c) => ({
        id: c.id,
        fechaHora: c.createdAt,
        resultado: c.resultado,               // 'aprobado' | 'denegado'
        puntos: c.puntosOtorgados || 0,
        distancia: c.distancia,               // en metros (puede ser null)
        cancha: c.Cancha
          ? { id: c.Cancha.id, nombre: c.Cancha.nombre }
          : null,
        partido: c.Partido
          ? {
              id: c.Partido.id,
              fecha: c.Partido.fecha,
              hora: c.Partido.hora,
              lugar: c.Partido.lugar,
            }
          : null,
      })),
    });
  } catch (e) {
    console.error('GET /api/qr/mis-puntos', e);
    return res.status(500).json({ error: 'Error al obtener puntos' });
  }
});

// === VER MIS PUNTOS (ciclo + histórico) ===
// GET /api/qr/puntos/mis
router.get('/puntos/mis', autenticarToken, async (req, res) => {
  try {
    const u = await Usuario.findByPk(req.usuario.id, {
      attributes: ['id', 'puntuacion', 'puntosHistorico']
    });
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });

    return res.json({
      usuarioId: u.id,
      sorteo: Number(u.puntuacion || 0),          // puntos del sorteo (ciclo)
      historico: Number(u.puntosHistorico || 0),  // puntos históricos
    });
  } catch (e) {
    console.error('GET /api/qr/puntos/mis', e);
    return res.status(500).json({ error: 'Error al obtener puntos' });
  }
});

// === (ADMIN) RESETEAR PUNTOS DEL SORTEO A 0 (cuando gana) ===
// POST /api/qr/puntos/reset
// body: { usuarioId, motivo? }
router.post('/puntos/reset', autenticarToken, async (req, res) => {
  try {
    if (!req.usuario?.esAdmin) {
      return res.status(403).json({ error: 'Solo administradores pueden resetear puntos' });
    }
    const { usuarioId, motivo } = req.body;
    if (!usuarioId) return res.status(400).json({ error: 'usuarioId requerido' });

    const u = await Usuario.findByPk(usuarioId);
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });

    const puntosPrevios = Number(u.puntuacion || 0);

    // Solo resetea el ciclo, NO toca el histórico
    u.puntuacion = 0;
    await u.save();

    return res.json({
      ok: true,
      mensaje: 'Puntos del sorteo reseteados a 0',
      usuarioId: u.id,
      puntosPrevios,
      motivo: motivo || null
    });
  } catch (e) {
    console.error('POST /api/qr/puntos/reset', e);
    return res.status(500).json({ error: 'Error al resetear puntos' });
  }
});


// === HISTORIAL DE PUNTOS (usuario o admin) ===
// GET /api/qr/puntos/historial?usuarioId=123&meses=6&limit=50
// routes/qr.js


router.get('/puntos/historial', autenticarToken, async (req, res) => {
  try {
    const usuarioIdQuery = req.query.usuarioId ? Number(req.query.usuarioId) : null;
    const usuarioId = usuarioIdQuery || req.usuario?.id;
    const meses = Math.min(Math.max(Number(req.query.meses || 6), 1), 24);
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);

    if (!req.usuario?.esAdmin && usuarioId !== req.usuario?.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const user = await Usuario.findByPk(usuarioId, {
      attributes: ['id', 'nombre', 'puntuacion', 'puntosHistorico']
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // 🔢 🔴 HISTÓRICO CALCULADO (robusto)
    const historicoCalc =
      (await QRCheckin.sum('puntosOtorgados', {
        where: { usuarioId, resultado: 'aprobado' }
      })) || 0;

    // (Opcional) sincronizar si guardás caché en Usuarios
    // if (Number(user.puntosHistorico || 0) !== Number(historicoCalc)) {
    //   await Usuario.update(
    //     { puntosHistorico: historicoCalc },
    //     { where: { id: usuarioId } }
    //   );
    // }

    // ----- lo demás queda igual -----
    const ahora = new Date();
    const desde = new Date(ahora);
    desde.setMonth(desde.getMonth() - (meses - 1));
    desde.setDate(1);
    desde.setHours(0, 0, 0, 0);

    const checks = await QRCheckin.findAll({
      where: {
        usuarioId,
        resultado: 'aprobado',
        createdAt: { [Op.gte]: desde },
      },
      order: [['createdAt', 'DESC']],
      limit,
      attributes: ['id', 'createdAt', 'puntosOtorgados', 'distancia', 'canchaId', 'partidoId'],
      include: [
        { model: Cancha, attributes: ['id', 'nombre'], required: false },
        { model: Partido, attributes: ['id', 'fecha', 'hora', 'lugar'], required: false },
      ]
    });

    const resumenMensualMap = new Map();
    for (const c of checks) {
      const d = new Date(c.createdAt);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${y}-${m}`;
      resumenMensualMap.set(key, (resumenMensualMap.get(key) || 0) + Number(c.puntosOtorgados || 0));
    }

    const mesesOrdenados = [];
    const cursor = new Date(desde);
    for (let i = 0; i < meses; i++) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const key = `${y}-${m}`;
      mesesOrdenados.push({
        ym: key,
        label: `${m}/${String(y).slice(-2)}`,
        total: Number(resumenMensualMap.get(key) || 0)
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return res.json({
      usuario: { id: user.id, nombre: user.nombre },
      actuales: {
        sorteo: Number(user.puntuacion || 0),   // ciclo actual (se resetea al premiar)
        historico: Number(historicoCalc),       // 👈 ACUMULADO REAL calculado
        // historicoDB: Number(user.puntosHistorico || 0), // (opcional) para debug
      },
      meses: mesesOrdenados,
      items: checks.map(c => ({
        id: c.id,
        fechaHora: c.createdAt,
        puntos: Number(c.puntosOtorgados || 0),
        distancia: c.distancia,
        cancha: c.Cancha ? { id: c.Cancha.id, nombre: c.Cancha.nombre } : null,
        partido: c.Partido ? {
          id: c.Partido.id,
          fecha: c.Partido.fecha,
          hora: c.Partido.hora,
          lugar: c.Partido.lugar
        } : null,
      })),
    });
  } catch (e) {
    console.error('GET /api/qr/puntos/historial', e);
    return res.status(500).json({ error: 'Error al obtener el historial' });
  }
});


module.exports = router;
