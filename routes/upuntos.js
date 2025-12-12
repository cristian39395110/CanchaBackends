// routes/puntosNegocio
const express = require('express');
const router = express.Router();
const {uNegocio,RubroNegocio,uUsuarioNegocio,uCheckinNegocio} = require('../models/model'); // 👈 el que mostraste

const {
  autenticarUsuarioNegocio,
} = require('../middlewares/authUsuarioNegocio');
// GET /api/puntos/lugares?lat=-33.3&lng=-66.3&radio=3000&categoria=...&soloPromo=1
// GET /api/puntosNegocio/categorias
router.get('/categorias', async (req, res) => {
  try {
    const rubros = await RubroNegocio.findAll({
      attributes: ['id', 'nombre', 'icono', 'orden'],
      include: [
        {
          model: uNegocio,
          attributes: [],
          where: { activo: true },
          required: true, // 👈 solo rubros que tengan al menos un negocio activo
        },
      ],
      group: ['RubroNegocio.id', 'RubroNegocio.nombre', 'RubroNegocio.icono', 'RubroNegocio.orden'],
      order: [
        ['orden', 'ASC'],
        ['nombre', 'ASC'],
      ],
    });
console.log(rubros)
    return res.json(rubros);
  } catch (err) {
    console.error('❌ Error al obtener categorías:', err);
    return res.status(500).json({ error: 'No se pudieron cargar las categorías' });
  }
});



router.get('/lugares', async (req, res) => {
  try {
    const { lat, lng, radio = 3000, categoria, soloPromo } = req.query;

    // Si no viene ubicación, no devolvemos nada
    if (!lat || !lng) return res.json([]);

    const LAT = Number(lat);
    const LNG = Number(lng);
    const RADIO_METROS = Number(radio);
    const R = 6371; // radio de la Tierra en km

    // 👇 SOLO negocios activos
    const where = {
      activo: true,
    };

    // 👇 si viene categoría distinta de 'todas' filtramos por rubroId
    if (categoria && categoria !== 'todas') {
      const rubroId = Number(categoria);
      if (!Number.isNaN(rubroId)) {
        where.rubroId = rubroId;
      }
    }

    // 👇 cargamos negocios:
    //   - activos
    //   - cuyo DUEÑO (uUsuarioNegocio) tiene esPremium = true
    const negocios = await uNegocio.findAll({
      where,
      include: [
        {
          model: uUsuarioNegocio,
          as: 'duenio',        // 👈 usa la asociación que ya definiste
          where: { esPremium: true }, // 🔥 dueño premium obligatorio
          attributes: [],      // no agregamos campos del dueño al resultado
          required: true,      // INNER JOIN: si no tiene dueño premium, no aparece
        },
      ],
      attributes: [
        'id',
        'nombre',
        ['rubro', 'categoria'],
        ['provincia', 'provincia'],
        ['localidad', 'localidad'],
        ['latitud', 'lat'],
        ['longitud', 'lng'],
        ['puntosPorCompra', 'puntosOtorga'],
        ['foto', 'fotoPerfil'],
        'planId',
        'activo',
        'rubroId',
      ],
      raw: true,
    });

    const toRad = (v) => (v * Math.PI) / 180;

    // 👇 interpretamos soloPromo (viene como string)
    const soloPromoBool =
      soloPromo === '1' || soloPromo === 'true' || soloPromo === 'on';

    const lista = negocios
      .map((n) => {
        const nLat = Number(n.lat);
        const nLng = Number(n.lng);
        if (Number.isNaN(nLat) || Number.isNaN(nLng)) return null;

        const dLat = toRad(nLat - LAT);
        const dLng = toRad(nLng - LNG);

        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(LAT)) *
            Math.cos(toRad(nLat)) *
            Math.sin(dLng / 2) ** 2;

        const distanciaKm =
          R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
        const distanciaM = distanciaKm * 1000;

        return {
          ...n,
          distancia: distanciaM,
          // Si querés que el filtro soloPromo funcione,
          // marcamos true para todos estos (son todos premium por dueño).
          tienePromo: true,
        };
      })
      .filter(Boolean)
      .filter((n) => n.distancia <= RADIO_METROS)
      .filter((n) => (!soloPromoBool ? true : n.tienePromo))
      .sort((a, b) => a.distancia - b.distancia);

    res.json(lista);
  } catch (err) {
    console.error('❌ Error en /api/puntosNegocio/lugares:', err);
    res.status(500).json({ error: 'Error al buscar lugares con puntos' });
  }
});

router.post('/canjear', autenticarUsuarioNegocio, async (req, res) => {
  const usuarioNegocioId = req.user?.id || null;   // ✔ EL USUARIO QUE ESCANEA (REAL)
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
      attributes: ['id', 'ownerId', 'latitud', 'longitud'],
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

    // 2.b) Validaciones del QR
    if (modoQR === 'compra' && qrRow.usado) {
      return res.status(409).json({ error: 'Este QR ya fue usado.' });
    }
    if (qrRow.fechaExpiracion && qrRow.fechaExpiracion < new Date()) {
      return res.status(400).json({ error: 'QR vencido.' });
    }

    // 2.c) Validar distancia si tenemos lat/lng
    if (lat != null && lng != null && negocio.latitud != null && negocio.longitud != null) {
      const dist = distanciaMetros(
        Number(lat),
        Number(lng),
        Number(negocio.latitud),
        Number(negocio.longitud)
      );

      const MAX_DISTANCIA = 20;

      if (dist > MAX_DISTANCIA) {
        return res.status(400).json({
          error: `Tenés que estar dentro de ${MAX_DISTANCIA}m del negocio para canjear. Distancia detectada: ${Math.round(dist)}m.`,
        });
      }
    }

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

    // 7) Reto 24h (3 locales distintos)
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

      const localesDistintos = new Set(checkinsUltimoDia.map(c => c.negocioId)).size;

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





module.exports = router;



