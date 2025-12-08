// routes/puntosnegociosqr.js
const express = require('express');
const router = express.Router();
const { Op, fn, col ,literal  } = require('sequelize');


const { autenticarTokenNegocio } = require('../middlewares/authNegocio'); 
const { autenticarUsuarioNegocio } = require('../middlewares/authUsuarioNegocio'); 





const {
  uQRCompraNegocio,
  uCheckinNegocio,
  uNegocio,
  uUsuarioNegocio,
  Reto, 
  UsuarioRetoCumplido,
  
  // Usuario, // si después querés sumar puntos al usuario-app
} = require('../models/model');

/* ===========================================================
   helper para generar códigos tipo "MCQR-ABC123"
   =========================================================== */
function generarCodigoQR() {
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let codigo = "";

  for (let i = 0; i < 6; i++) {
    codigo += letras.charAt(Math.floor(Math.random() * letras.length));
  }

  return codigo;
}



// 👈 usás el mismo que en /historial

// ---------- helpers de fechas ----------
function getInicioMes(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1, 0, 0, 0, 0);
}

function addMeses(fecha, meses) {
  return new Date(fecha.getFullYear(), fecha.getMonth() + meses, 1, 0, 0, 0, 0);
}

/* =====================================
   A) RESUMEN: MES ACTUAL vs MES ANTERIOR
   Incluye:
   - Checkins (uCheckinNegocio)
   - Retos (UsuarioRetoCumplido)
   ===================================== */
router.get('/resumen', autenticarUsuarioNegocio, async (req, res) => {
  // ⚠️ así lo usás en /historial
  const usuarioNegocioId = req.negocio.id;
  console.log(usuarioNegocioId,"seuuuuuuuu")

  try {
    const hoy = new Date();

    const inicioMesActual = getInicioMes(hoy);
    const inicioMesSiguiente = addMeses(inicioMesActual, 1);

    const inicioMesAnterior = addMeses(inicioMesActual, -1);
    const inicioMesAnteriorSiguiente = inicioMesActual;

    // ---------- MES ACTUAL ----------
    // 1) puntos por checkins
    const puntosCheckinsActual =
      (await uCheckinNegocio.sum('puntosGanados', {
        where: {
          usuarioNegocioId,
          fecha: {
            [Op.gte]: inicioMesActual,
            [Op.lt]: inicioMesSiguiente,
          },
        },
      })) || 0;

    // 2) puntos por retos (sumo en JS por seguridad)
    const retosActual = await UsuarioRetoCumplido.findAll({
      where: {
        usuarioId: usuarioNegocioId,
        createdAt: {
          [Op.gte]: inicioMesActual,
          [Op.lt]: inicioMesSiguiente,
        },
      },
      attributes: ['puntosOtorgados', 'puntosGanados'],
      raw: true,
    });

    const puntosRetosActual = retosActual.reduce((acc, r) => {
      const puntos =
        (r.puntosOtorgados ?? r.puntosGanados ?? 0);
      return acc + Number(puntos);
    }, 0);

    const puntosMesActual = puntosCheckinsActual + puntosRetosActual;

    // ---------- MES ANTERIOR ----------
    const puntosCheckinsAnterior =
      (await uCheckinNegocio.sum('puntosGanados', {
        where: {
          usuarioNegocioId,
          fecha: {
            [Op.gte]: inicioMesAnterior,
            [Op.lt]: inicioMesAnteriorSiguiente,
          },
        },
      })) || 0;

    const retosAnterior = await UsuarioRetoCumplido.findAll({
      where: {
        usuarioId: usuarioNegocioId,
        createdAt: {
          [Op.gte]: inicioMesAnterior,
          [Op.lt]: inicioMesAnteriorSiguiente,
        },
      },
      attributes: ['puntosOtorgados', 'puntosGanados'],
      raw: true,
    });

    const puntosRetosAnterior = retosAnterior.reduce((acc, r) => {
      const puntos =
        (r.puntosOtorgados ?? r.puntosGanados ?? 0);
      return acc + Number(puntos);
    }, 0);

    const puntosMesAnterior = puntosCheckinsAnterior + puntosRetosAnterior;

    const diferencia = puntosMesActual - puntosMesAnterior;

    return res.json({
      puntosMesActual,
      puntosMesAnterior,
      diferencia,
      detalle: {
        checkins: {
          actual: puntosCheckinsActual,
          anterior: puntosCheckinsAnterior,
        },
        retos: {
          actual: puntosRetosActual,
          anterior: puntosRetosAnterior,
        },
      },
    });
  } catch (err) {
    console.error('Error en GET /api/puntos/resumen:', err);
    return res
      .status(500)
      .json({ error: 'Error al obtener resumen de puntos' });
  }
});

/* =====================================
   C) HISTORIAL MENSUAL (últimos N meses)
   Suma:
   - puntos de uCheckinNegocio (fecha)
   - puntos de UsuarioRetoCumplido (createdAt)
   ===================================== */
router.get('/historial-mensual', autenticarUsuarioNegocio, async (req, res) => {
  const usuarioNegocioId = req.negocio.id;

  try {
    const meses = Number(req.query.meses) || 6;
    const hoy = new Date();

    const inicioMesActual = getInicioMes(hoy);
    const inicioRango = addMeses(inicioMesActual, -(meses - 1));
    const finRango = addMeses(inicioMesActual, 1);

    // ---------- CHECKINS AGRUPADOS POR MES ----------
    const rowsCheckins = await uCheckinNegocio.findAll({
      attributes: [
        [fn('YEAR', col('fecha')), 'anio'],
        [fn('MONTH', col('fecha')), 'mes'],
        [fn('SUM', col('puntosGanados')), 'totalPuntos'],
      ],
      where: {
        usuarioNegocioId,
        fecha: {
          [Op.gte]: inicioRango,
          [Op.lt]: finRango,
        },
      },
      group: ['anio', 'mes'],
      order: [
        [literal('anio'), 'ASC'],
        [literal('mes'), 'ASC'],
      ],
      raw: true,
    });

    // ---------- RETOS AGRUPADOS POR MES ----------
    const rowsRetos = await UsuarioRetoCumplido.findAll({
      attributes: [
        [fn('YEAR', col('createdAt')), 'anio'],
        [fn('MONTH', col('createdAt')), 'mes'],
        // SUM(COALESCE(puntosOtorgados, puntosGanados, 0))
        [fn('SUM', literal('COALESCE(puntosOtorgados, puntosGanados, 0)')), 'totalPuntos'],
      ],
      where: {
        usuarioId: usuarioNegocioId,
        createdAt: {
          [Op.gte]: inicioRango,
          [Op.lt]: finRango,
        },
      },
      group: ['anio', 'mes'],
      order: [
        [literal('anio'), 'ASC'],
        [literal('mes'), 'ASC'],
      ],
      raw: true,
    });

    // ---------- COMBINAR CHECKINS + RETOS POR MES ----------
    const mapa = new Map(); // key: `${anio}-${mes}` → { anio, mes, checkins, retos }

    for (const row of rowsCheckins) {
      const anio = Number(row.anio);
      const mes = Number(row.mes);
      const key = `${anio}-${mes}`;
      const total = Number(row.totalPuntos) || 0;

      if (!mapa.has(key)) {
        mapa.set(key, { anio, mes, checkins: 0, retos: 0 });
      }
      const item = mapa.get(key);
      item.checkins += total;
    }

    for (const row of rowsRetos) {
      const anio = Number(row.anio);
      const mes = Number(row.mes);
      const key = `${anio}-${mes}`;
      const total = Number(row.totalPuntos) || 0;

      if (!mapa.has(key)) {
        mapa.set(key, { anio, mes, checkins: 0, retos: 0 });
      }
      const item = mapa.get(key);
      item.retos += total;
    }

    // ---------- ARMAR SALIDA CONTINUA POR MES ----------
    const resultado = [];
    for (let i = 0; i < meses; i++) {
      const fecha = addMeses(inicioRango, i);
      const anio = fecha.getFullYear();
      const mes = fecha.getMonth() + 1; // 1-12
      const key = `${anio}-${mes}`;

      const item = mapa.get(key) || {
        anio,
        mes,
        checkins: 0,
        retos: 0,
      };

      resultado.push({
        anio,
        mes,
        totalPuntos: item.checkins + item.retos,
        detalle: {
          checkins: item.checkins,
          retos: item.retos,
        },
      });
    }

    return res.json(resultado);
  } catch (err) {
    console.error('Error en GET /api/puntos/historial-mensual:', err);
    return res
      .status(500)
      .json({ error: 'Error al obtener historial mensual' });
  }
});







/* ===========================================================
   1) GET /api/puntosnegociosqr/historial
   → historial del usuario logueado (para PuntosPage.tsx)
   =========================================================== */
// SIN cambiar asociaciones
router.get('/historial', autenticarUsuarioNegocio, async (req, res) => {
  const usuarioNegocioId = req.negocio.id;

  try {
    // ✅ 1) Historial de checkins en negocios
    const checkins = await uCheckinNegocio.findAll({
      where: { usuarioNegocioId },
      include: [
        {
          model: uNegocio,
          attributes: ['id','nombre','provincia','localidad','latitud','longitud'],
        },
      ],
      order: [['fecha', 'DESC']],
    });

    const historialCheckins = checkins.map((c) => ({
      id: c.id,
      tipo: 'negocio',
      negocioId: c.Negocio?.id ?? c.negocioId,
      negocioNombre: c.Negocio?.nombre ?? 'Negocio',
      puntosGanados: c.puntosGanados,
      fecha: c.fecha,
      lat: c.latitudUsuario,
      lng: c.longitudUsuario,
      negocioLocalidad: c.Negocio?.localidad ?? null,
      negocioProvincia: c.Negocio?.provincia ?? null,
    }));

    // ✅ 2) Historial de retos cobrados
    const retos = await UsuarioRetoCumplido.findAll({
      where: { usuarioId: usuarioNegocioId },
      include: [
        {
          model: Reto,
          as: 'reto',
          attributes: ['id', 'titulo'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const historialRetos = retos.map((r) => ({
      id: 1000000 + r.id, // para que no choque con ids de checkins
      tipo: 'reto',
      negocioId: null,
      negocioNombre: r.reto?.titulo
        ? `Reto: ${r.reto.titulo}`
        : 'Reto saludable',
      puntosGanados:
        r.puntosOtorgados ?? r.puntosGanados ?? 0,
      fecha: r.createdAt,
      lat: null,
      lng: null,
      negocioLocalidad: null,
      negocioProvincia: null,
    }));

    // ✅ 3) Unir y ordenar por fecha
    const combinado = [...historialCheckins, ...historialRetos].sort(
      (a, b) => new Date(b.fecha) - new Date(a.fecha)
    );

    res.json(combinado);
  } catch (error) {
    console.error('Error en /historial:', error);
    res.status(500).json({ error: 'No se pudo obtener el historial.' });
  }
});


/* =======================================================  ====
   2) POST /api/puntosnegociosqr/emitir
   → el negocio genera un QR para dar puntos
   =========================================================== */
// POST /api/puntosnegociosqr/emitir
// routes/puntosnegociosqr.js  (fragmento)
// POST /api/puntosnegociosqr/emitir
router.post('/emitir', autenticarTokenNegocio, async (req, res) => {
  try {
    let { negocioId } = req.body;

    const ownerId = req.negocio?.id;
    if (!ownerId) return res.status(401).json({ error: 'No autenticado' });

    // 1) Si no vino negocioId, lo inferimos por ownerId (como antes)
    if (!negocioId) {
      const negocioDelOwner = await uNegocio.findOne({
        where: { ownerId, activo: true },
        attributes: ['id', 'puntosPorCompra', 'plan'],
      });

      if (!negocioDelOwner) {
        return res
          .status(400)
          .json({ error: 'No se pudo inferir el negocio del usuario' });
      }

      negocioId = negocioDelOwner.id;
      req._negocioResuelto = negocioDelOwner;
    }

    // 2) Buscar negocio (si no lo resolvimos recién)
    const negocio =
      req._negocioResuelto || (await uNegocio.findByPk(negocioId));

    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    // 3) ¿Ya tiene un QR fijo?
    const qrExistente = await uQRCompraNegocio.findOne({
      where: {
        negocioId,
        modo: 'fijo',
      },
    });

    if (qrExistente) {
      return res.json({
        mensaje: '♾️ Ya tenés un QR fijo, se reutiliza.',
        qr: qrExistente,
      });
    }

    // 4) Calcular puntos iniciales según política (solo para guardar de referencia)
    const PLAN_TO_PUNTOS = { basico: 100, premium: 200 };
    let puntos = Number(negocio.puntosPorCompra) || 0;
    if (!puntos) {
      puntos = PLAN_TO_PUNTOS[(negocio.plan || 'basico').toLowerCase()] ?? 100;
    }

    // 5) Crear QR fijo (sin fecha de expiración, sin uso único)
    const codigoQR = generarCodigoQR();

    const qrCreado = await uQRCompraNegocio.create({
      negocioId,
      codigoQR,
      puntosOtorga: puntos,   // referencia, pero en canjear recalculamos
      fechaExpiracion: null,  // ♾️ sin vencimiento
      modo: 'fijo',
      usado: false,           // no se usa nunca como “one-shot”
    });

    return res.json({
      mensaje: '✅ QR fijo generado con éxito.',
      qr: qrCreado,
    });
  } catch (error) {
    console.error('Error en /emitir (QR fijo):', error);
    return res.status(500).json({ error: 'Error al emitir QR' });
  }
});




/* ===========================================================
   3) POST /api/puntosnegociosqr/canjear
   → el usuario escanea / escribe el código
   → valida QR
   → crea checkin
   → verifica retos
   body: { qr, negocioId, lat, lng }
   =========================================================== */


// Helper para distancia en metros (Haversine)
function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000; // metros
  const toRad = (v) => (v * Math.PI) / 180;

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

router.post('/canjear', autenticarUsuarioNegocio, async (req, res) => {
  const usuarioNegocioId = req.negocio?.id || null;   // EL USUARIO QUE ESCANEA
  const { qr, negocioId: negocioIdBody, lat, lng } = req.body;

  if (!usuarioNegocioId) return res.status(401).json({ error: 'No autenticado' });
  if (!qr) return res.status(400).json({ error: 'Falta el código QR' });

  try {
    // 1) Leer QR (si mandan negocioId lo validamos contra el QR)
    const whereQR = negocioIdBody
      ? { codigoQR: qr, negocioId: negocioIdBody }
      : { codigoQR: qr };

    const qrRow = await uQRCompraNegocio.findOne({ where: whereQR });
    if (!qrRow) {
      return res.status(404).json({ error: 'QR no válido o no corresponde a este negocio.' });
    }

    const negocioId = qrRow.negocioId; // fuente de verdad
    const modoQR = qrRow.modo || null; // 'compra' | 'dia' | 'fijo' | null

    // 2) Traemos el negocio (para validar dueño y ubicación)
    const negocio = await uNegocio.findByPk(negocioId, {
      attributes: ['id', 'ownerId', 'latitud', 'longitud'], // ajustá nombres si difieren
    });

    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado.' });
    }

    // 2.a) Bloquear al dueño del local: NO puede canjear en su propio negocio
    if (negocio.ownerId && Number(negocio.ownerId) === Number(usuarioNegocioId)) {
      return res.status(403).json({
        error: 'No podés sumar puntos escaneando el QR de tu propio negocio.',
      });
    }

    // 2.b) Validaciones básicas del QR
    if (modoQR === 'compra' && qrRow.usado) {
      return res.status(409).json({ error: 'Este QR ya fue usado.' });
    }
    if (qrRow.fechaExpiracion && qrRow.fechaExpiracion < new Date()) {
      return res.status(400).json({ error: 'QR vencido.' });
    }

    // 2.c) Validar distancia si tenemos lat/lng del usuario y del negocio
    if (lat != null && lng != null && negocio.latitud != null && negocio.longitud != null) {
      const dist = distanciaMetros(
        Number(lat),
        Number(lng),
        Number(negocio.latitud),
        Number(negocio.longitud)
      );

      const MAX_DISTANCIA = 20; // podés subirlo a 30 si ves problemas

      if (dist > MAX_DISTANCIA) {
        return res.status(400).json({
          error: `Tenés que estar dentro de ${MAX_DISTANCIA}m del negocio para canjear. Distancia detectada: ${Math.round(dist)}m.`,
        });
      }
    }
    // Si querés obligar SIEMPRE ubicación, descomentá este bloque:
    // else {
    //   return res.status(400).json({ error: 'Falta ubicación para canjear.' });
    // }

    // 3) Cooldown 4h por negocio
    const COOLDOWN_HORAS = 4;
    const limiteTiempo = new Date(Date.now() - COOLDOWN_HORAS * 60 * 60 * 1000);

    const checkinReciente = await uCheckinNegocio.findOne({
      where: {
        usuarioNegocioId,
        negocioId,
        createdAt: { [Op.gte]: limiteTiempo },
      },
      order: [['createdAt', 'DESC']],
    });

    if (checkinReciente) {
      return res.status(429).json({
        error: `Debés esperar ${COOLDOWN_HORAS}h para volver a canjear en este negocio.`,
      });
    }

    const puntosDelCanje = Number(qrRow.puntosOtorga) || 0;

    // 4) Marcar usado SOLO si es QR de compra
    if (modoQR === 'compra' && !qrRow.usado) {
      await qrRow.update({ usado: true });
    }

    // 5) Crear checkin
    const nuevoCheckin = await uCheckinNegocio.create({
      usuarioNegocioId,
      negocioId,
      qrId: qrRow.id,
      puntosGanados: puntosDelCanje,
      latitudUsuario: lat ?? null,
      longitudUsuario: lng ?? null,
    });

    // 6) Sumar puntos al usuario
    if (puntosDelCanje > 0) {
      await uUsuarioNegocio.increment('puntos', {
        by: puntosDelCanje,
        where: { id: usuarioNegocioId },
      });
    }

    // 7) Reto demo (24h, 3 locales distintos)
    let puntosExtraReto = 0;
    const reto = await Reto.findOne({
      where: { titulo: 'Visitá 3 locales distintos en 24h', activo: true },
    });

    if (reto) {
      const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const checkinsUltimoDia = await uCheckinNegocio.findAll({
        where: { usuarioNegocioId, createdAt: { [Op.gte]: hace24h } },
        attributes: ['negocioId'],
      });

      const localesDistintos = new Set(checkinsUltimoDia.map((c) => c.negocioId)).size;

      if (localesDistintos >= 3) {
        const yaCumplido = await UsuarioRetoCumplido.findOne({
          where: { usuarioId: usuarioNegocioId, retoId: reto.id },
        });

        if (!yaCumplido) {
          await UsuarioRetoCumplido.create({
            usuarioId: usuarioNegocioId,
            retoId: reto.id,
            puntosOtorgados: Number(reto.puntos) || 0,
          });

          puntosExtraReto = Number(reto.puntos) || 0;
          if (puntosExtraReto > 0) {
            await uUsuarioNegocio.increment('puntos', {
              by: puntosExtraReto,
              where: { id: usuarioNegocioId },
            });
          }
        }
      }
    }

    return res.json({
      mensaje:
        puntosExtraReto > 0
          ? '✅ Canje registrado. Reto completado 🎯'
          : '✅ Canje registrado.',
      puntosCanje: puntosDelCanje,
      puntosExtraReto,
      totalSumado: puntosDelCanje + puntosExtraReto,
      checkin: nuevoCheckin,
    });
  } catch (error) {
    console.error('Error en /canjear:', error);
    return res.status(500).json({ error: 'No se pudo canjear.' });
  }
});


/* ===========================================================
   4) GET /api/puntosnegociosqr/mis-puntos
   → suma de puntos del usuario (por checkins)
   =========================================================== */
router.get('/mis-puntos', autenticarUsuarioNegocio, async (req, res) => {
  const usuarioNegocioId =req.negocio.id;
  try {
    const total = await uCheckinNegocio.findOne({
      attributes: [[fn('SUM', col('puntosGanados')), 'totalPuntos']],
      where: { usuarioNegocioId },
      raw: true,
    });

    const totalPuntos = total?.totalPuntos ? Number(total.totalPuntos) : 0;

    return res.json({
      usuarioId: usuarioNegocioId,
      totalPuntos,
    });
  } catch (error) {
    console.error('Error en /mis-puntos:', error);
    return res.status(500).json({ error: 'No se pudieron obtener los puntos.' });
  }
});

/* ===========================================================
   5) GET /api/puntosnegociosqr/mis-checkins
   → historial crudo (por si lo querés en admin)
   =========================================================== */
router.get('/mis-checkins', autenticarUsuarioNegocio, async (req, res) => {
  const usuarioNegocioId =req.negocio.id;
  try {
    const checkins = await uCheckinNegocio.findAll({
      where: { usuarioNegocioId },
      order: [['fecha', 'DESC']],
    });

    return res.json(checkins);
  } catch (error) {
    console.error('Error en /mis-checkins:', error);
    return res.status(500).json({ error: 'No se pudo obtener el historial.' });
  }
});

/* ===========================================================
   6) GET /api/puntosnegociosqr/negocio/:negocioId/checkins
   → para que el dueño vea quién canjeó
   =========================================================== */
router.get('/negocio/:negocioId/checkins', autenticarTokenNegocio, async (req, res) => {
  const { negocioId } = req.params;

  try {
    const checkins = await uCheckinNegocio.findAll({
      where: { negocioId },
      order: [['fecha', 'DESC']],
    });

    return res.json(checkins);
  } catch (error) {
    console.error('Error en /negocio/:negocioId/checkins:', error);
    return res.status(500).json({ error: 'No se pudo obtener el historial del negocio.' });
  }
});






// GET /api/puntosnegociosqr/ranking
// Ranking por ciudad (provincia + localidad del usuario logueado)
// GET /api/puntosnegociosqr/ranking
// Ranking por ciudad (provincia + localidad del usuario logueado)
router.get('/ranking', autenticarUsuarioNegocio, async (req, res) => {
  try {
    const usuarioNegocioId = req.negocio?.id;
    if (!usuarioNegocioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // 1) Buscamos los datos del usuario logueado (su ciudad)
    const yo = await uUsuarioNegocio.findByPk(usuarioNegocioId, {
      attributes: ['id', 'nombre', 'provincia', 'localidad'],
    });

    if (!yo) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { provincia, localidad } = yo;

    if (!provincia || !localidad) {
      return res.status(400).json({
        error:
          'Tu usuario no tiene provincia/localidad cargada. Completá tus datos de ciudad para ver el ranking.',
      });
    }

    // 2) Filtro por ciudad
    const filtroCiudad = {
      provincia,
      localidad,
    };

    // 3) Ranking solo con usuarios de esa ciudad
    const filas = await uCheckinNegocio.findAll({
      attributes: [
        'usuarioNegocioId',
        [fn('SUM', col('puntosGanados')), 'totalPuntos'],
      ],
      include: [
        {
          model: uUsuarioNegocio, // 👈 este es el modelo que importás
          attributes: ['id', 'nombre', 'provincia', 'localidad'],
          where: filtroCiudad,    // solo misma ciudad
        },
      ],
      group: [
        'usuarioNegocioId',
        'uUsuariosNegocio.id',
        'uUsuariosNegocio.nombre',
        'uUsuariosNegocio.provincia',
        'uUsuariosNegocio.localidad',
      ],
      // ordenamos por la suma de puntos
      order: [[fn('SUM', col('puntosGanados')), 'DESC']],
      limit: 20,
      subQuery: false,
    });

    // 4) Map al formato que devuelve la API
    const data = filas.map((row) => {
      const usuario = row.uUsuariosNegocio; // 👈 alias correcto según el nombre del modelo

      return {
        id: usuario ? usuario.id : row.usuarioNegocioId,
        nombre: usuario ? usuario.nombre : 'Usuario',
        provincia: usuario ? usuario.provincia : provincia,
        localidad: usuario ? usuario.localidad : localidad,
        puntos: Number(row.get('totalPuntos') || 0),
      };
    });

    return res.json({
      ciudad: {
        provincia,
        localidad,
      },
      ranking: data,
    });
  } catch (err) {
    console.error('Error en /api/puntosnegociosqr/ranking', err);
    return res
      .status(500)
      .json({ error: 'No se pudo obtener el ranking.' });
  }
});





// GET /api/puntosnegociosqr/politica
// GET /api/puntosnegociosqr/politica
router.get('/politica', autenticarTokenNegocio, async (req, res) => {
  try {
    // 1) sacamos el ownerId desde el token (usuario-negocio logueado)
    const ownerId = req.negocio?.id || req.user?.id;

    if (!ownerId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // 2) buscamos el negocio del dueño (igual que en /emitir)
    const negocio = await uNegocio.findOne({
      where: { ownerId, activo: true },
    });

    if (!negocio) {
      return res
        .status(404)
        .json({ error: 'Negocio no encontrado para este usuario.' });
    }

    // 3) regla de puntos: primero puntosPorCompra, si no, por plan
    const PLAN_TO_PUNTOS = { basico: 100, premium: 200 };

    let puntos = Number(negocio.puntosPorCompra) || 0;
    if (!puntos) {
      puntos =
        PLAN_TO_PUNTOS[(negocio.plan || 'basico').toLowerCase()] ?? 100;
    }

    return res.json({
      negocioId: negocio.id,
      plan: negocio.plan,
      puntosPorCompra: puntos,
    });
  } catch (e) {
    console.error('GET /politica', e);
    return res
      .status(500)
      .json({ error: 'No se pudo obtener la política' });
  }
});

module.exports = router;
  