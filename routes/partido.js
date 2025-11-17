const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const admin = require('firebase-admin');
const crypto = require('crypto');

// en el endpoint (./) puse  latitud y lkongitud harckodeado;
// en   isPremium (./isPremium)  lo mismo

const {
  UsuarioPartido,
  Suscripcion,
  Usuario,
  UsuarioDeporte,
  Partido,
  Deporte,
  MensajePartido
} = require('../models/model');

const Mensaje = require('../models/Mensaje'); // Asegurate de tener este modelo

// 🔐 Inicializar Firebase Admin SDK una sola vez
try {
  const serviceAccount = require('../firebase-admin-sdk.json');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (error) {
  console.error('❌ Error al inicializar Firebase Admin SDK:', error);
}

// 📤 Función para enviar notificaciones FCM
async function enviarNotificacionesFCM(tokens, payload) {
  for (const token of tokens) {
    const message = {
      token,
      notification: {
        title: payload.title,
        body: payload.body
      },
      data: {
        url: payload.url || '/invitaciones',
        tipo: 'partido' // podés agregar más datos si querés
      },
      android: {
        notification: {
          sound: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default'
          }
        }
      }
    };

    try {
      const response = await admin.messaging().send(message);
      console.log(`✅ Notificación enviada a ${token}`, response);
    } catch (error) {
      console.error(`❌ Error al enviar FCM a ${token}:`, error.message);

      if (
        error.errorInfo?.code === 'messaging/registration-token-not-registered'
      ) {
        await Suscripcion.destroy({ where: { fcmToken: token } });
      }
    }
  }
}

const MAX_POR_TANDA = 6;
const ESPERA_MS = 2 * 60 * 1000;

async function enviarEscalonado(partido, deporteNombre, organizadorId) {
  const { latitud, longitud, sexo, rangoEdad } = partido;
  const distanciaKm = 20;
console.log('✅ Entró a enviarEscalonado - partido ID:', partido.id);
console.log('📍 Coordenadas recibidas:', partido.latitud, partido.longitud);
console.log('📍 Rango edad:',rangoEdad );

  try {
    // 🔍 Buscar candidatos cercanos
    const candidatosCercanos = await UsuarioDeporte.sequelize.query(
      `
      SELECT ud.usuarioId
      FROM UsuarioDeportes ud
      JOIN Usuarios u ON ud.usuarioId = u.id
      WHERE ud.deporteId = :deporteId
        AND ud.usuarioId != :organizadorId
        AND u.latitud IS NOT NULL AND u.longitud IS NOT NULL
        AND (
          6371 * acos(
            cos(radians(:lat)) * cos(radians(u.latitud)) *
            cos(radians(u.longitud) - radians(:lon)) +
            sin(radians(:lat)) * sin(radians(u.latitud))
          )
        ) < :distanciaKm
      `,
      {
        replacements: {
          deporteId: partido.deporteId,
          lat: latitud,
          lon: longitud,
          organizadorId,
          distanciaKm
        },
        type: UsuarioDeporte.sequelize.QueryTypes.SELECT
      }
    );

    let candidatos = candidatosCercanos.map(row => row.usuarioId);

    console.log('🔍 Usuarios cercanos:', candidatosCercanos);


    // ❌ Filtrar suspendidos
    const suspendidos = await Usuario.findAll({
      where: {
        id: { [Op.in]: candidatos },
        suspensionHasta: { [Op.gt]: new Date() }
      }
    });
    const suspendidosIds = suspendidos.map(u => u.id);
    candidatos = candidatos.filter(id => !suspendidosIds.includes(id));

    // 🔎 Filtro por sexo
    if (sexo && sexo !== 'todos') {
      const usuariosFiltradosPorSexo = await Usuario.findAll({
        where: {
          id: { [Op.in]: candidatos },
          sexo: sexo // 'masculino' o 'femenino'
        }
      });
      const idsFiltradosSexo = usuariosFiltradosPorSexo.map(u => u.id);
      candidatos = candidatos.filter(id => idsFiltradosSexo.includes(id));
    }
// 🔎 Filtro por edad (usando campo edad)

// 🔎 Filtro por edad (usando campo edad)
if (rangoEdad && Array.isArray(rangoEdad) && rangoEdad.length > 0) {
  let rangos = [];

  if (rangoEdad.includes('adolescente')) rangos.push({ min: 10, max: 20 });
  if (rangoEdad.includes('joven')) rangos.push({ min: 21, max: 40 });
  if (rangoEdad.includes('veterano')) rangos.push({ min: 41, max: 120 });

  console.log('🎂 Filtro por edad activado:', rangos);

  const usuariosFiltradosPorEdad = await Usuario.findAll({
    where: {
      id: { [Op.in]: candidatos },
      edad: {
        [Op.ne]: null
      }
    }
  });

  const idsFiltradosEdad = usuariosFiltradosPorEdad
    .filter(usuario =>
      rangos.some(r => usuario.edad >= r.min && usuario.edad <= r.max)
    )
    .map(u => u.id);

  candidatos = candidatos.filter(id => idsFiltradosEdad.includes(id));

  console.log('✅ Usuarios que pasaron el filtro de edad:', idsFiltradosEdad.length);
  console.log('👥 Candidatos después del filtro edad:', candidatos.length);
}

// 🔎 Filtro por categoría
// 🔎 Filtro por categoría
if (partido.categorias && Array.isArray(partido.categorias) && partido.categorias.length > 0) {
  console.log('🏷️ Filtro por nivel/categorías activado:', partido.categorias);

  const usuariosFiltradosPorNivel = await Usuario.findAll({
    where: {
      id: { [Op.in]: candidatos }
    },
    include: [
      {
        model: UsuarioDeporte,
        as: 'UsuarioDeportes', // tiene que coincidir con tu alias en las asociaciones
        where: {
          deporteId: partido.deporteId,
          nivel: {
            [Op.in]: partido.categorias
          }
        }
      }
    ]
  });

  const idsFiltradosNivel = usuariosFiltradosPorNivel.map(u => u.id);
  candidatos = candidatos.filter(id => idsFiltradosNivel.includes(id));

  console.log('✅ Usuarios que pasaron el filtro por nivel:', idsFiltradosNivel.length);
  console.log('👥 Candidatos después del filtro por nivel:', candidatos.length);
}





    // 🔐 Evitar duplicados
    const yaContactados = await UsuarioPartido.findAll({
      where: { PartidoId: partido.id }
    });
    const yaContactadosIds = yaContactados.map(r => r.UsuarioId);
    candidatos = candidatos.filter(id => !yaContactadosIds.includes(id));

    let enviados = new Set();
    let intentos = 0;


    console.log('🎯 Candidatos finales listos para invitar:', candidatos.length);


    async function enviarTanda() {
      const aceptados = await UsuarioPartido.count({
        where: { PartidoId: partido.id, estado: 'aceptado' }
      });

      const faltan = partido.cantidadJugadores - aceptados;
      if (faltan <= 0 || candidatos.length === 0) return false;


 const multiplicador = 2.5; // Probá con 2.5 y ajustá si querés más
  const cantidadASolicitar = Math.ceil(faltan * multiplicador);

      const siguiente = candidatos
        .filter(id => !enviados.has(id))
        .slice(0, cantidadASolicitar);

      if (siguiente.length === 0) return false;

      const relaciones = siguiente.map(usuarioId => ({
        UsuarioId: usuarioId,
        PartidoId: partido.id,
        estado: 'pendiente'
      }));

      await UsuarioPartido.bulkCreate(relaciones);

      const suscripciones = await Suscripcion.findAll({
        where: { usuarioId: { [Op.in]: siguiente } }
      });

      console.log('📦 Usuarios en esta tanda:', siguiente);
console.log('📬 Suscripciones encontradas:', suscripciones.length);

const fcmTokens = suscripciones.map(s => s.fcmToken).filter(Boolean);

console.log('🔑 Tokens FCM válidos:', fcmTokens);

const esEncuentro = ['Trekking', 'Ciclismo'].includes(
  String(deporteNombre).trim()
);


const payload = esEncuentro
  ? {
      title: '🎯 ¡Nuevo Encuentro disponible!',
      body: `Encuentro para hacer ${deporteNombre} en ${partido.lugar} el ${partido.fecha} a las ${partido.hora}`,
      url: '/invitaciones',
    }
  : {
      title: '🎯 ¡Nuevo partido disponible!',
      body: `Partido de ${deporteNombre} en ${partido.lugar} el ${partido.fecha} a las ${partido.hora}`,
      url: '/invitaciones',
    };


      if (fcmTokens.length === 0) {
  console.log('🚫 No hay tokens FCM válidos para esta tanda.');
} else {
  console.log('📲 Enviando notificación FCM a:', fcmTokens);
}

      if (fcmTokens.length > 0) {
        await enviarNotificacionesFCM(fcmTokens, payload);
      }

      siguiente.forEach(id => enviados.add(id));
      return true;
    }

    while (true) {
      const huboEnvio = await enviarTanda();
      intentos++;

      if (!huboEnvio || enviados.size >= candidatos.length || intentos >= 10) break;

      console.log(`⏳ Esperando ${ESPERA_MS / 1000} segundos para siguiente tanda...`);
      await new Promise(resolve => setTimeout(resolve, ESPERA_MS));
    }

    console.log(`✅ Proceso escalonado terminado. Total invitados: ${enviados.size}`);
  } catch (error) {
    console.error('❌ Error en enviarEscalonado:', error);
  }
}

router.post('/cantidad', async (req, res) => {
  const { usuarioId, fecha } = req.body;

  if (!usuarioId || !fecha) {
    return res.status(400).json({ error: 'Faltan usuarioId o fecha' });
  }

  try {
    const inicioDia = new Date(`${fecha}T00:00:00`);
    const finDia = new Date(`${fecha}T23:59:59.999`);

    const cantidad = await Partido.count({
      where: {
        organizadorId: usuarioId,
        createdAt: {
          [Op.between]: [inicioDia, finDia],
        },
      },
    });

    res.json({ cantidad });
  } catch (error) {
    console.error('❌ Error al contar partidos:', error);
    res.status(500).json({ error: 'Error al contar los partidos del día' });
  }
});

// 🚫 Rechazar jugador
router.post('/rechazar-jugador', async (req, res) => {
  const { usuarioId, partidoId } = req.body;

  try {
    await UsuarioPartido.update(
      { estado: 'rechazado' },
      { where: { UsuarioId: usuarioId, PartidoId: partidoId } }
    );
    res.json({ mensaje: 'Jugador rechazado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al rechazar jugador' });
  }
});

// ✅ Verificar si un usuario sigue en un partido
// GET /api/partido/sigue-en-el-partido?partidoId=...&usuarioId=...
// ✅ Verificar si el usuario sigue en el partido (jugador confirmado o es el organizador)
router.get('/sigue-en-el-partido', async (req, res) => {
  const { partidoId, usuarioId } = req.query;

  try {
    // Validaciones básicas
    if (!partidoId || !usuarioId) {
      return res.status(400).json({ error: 'Faltan parámetros', sigue: false });
    }

    const partido = await Partido.findByPk(partidoId);

    if (!partido) {
      return res.status(404).json({ error: 'Partido no encontrado', sigue: false });
    }

    // ✅ El organizador siempre puede hablar
    if (Number(partido.organizadorId) === Number(usuarioId)) {
      return res.json({ sigue: true });
    }

    // ✅ Si es jugador confirmado, también puede hablar
    const relacion = await UsuarioPartido.findOne({
      where: {
        partidoId,
        usuarioId,
        estado: 'confirmado' // asegurate que este estado sea el correcto
      }
    });

    if (relacion) {
      return res.json({ sigue: true });
    }

    // ⛔ Fue eliminado o nunca estuvo
    return res.json({ sigue: false });

  } catch (err) {
    console.error('❌ Error al verificar si sigue en el partido:', err);
    res.status(500).json({ error: 'Error interno', sigue: false });
  }
});


// ✅ Confirmar jugador
router.post('/confirmar-jugador', async (req, res) => {
  const { usuarioId, partidoId, organizadorId } = req.body;

  try {
    const partido = await Partido.findByPk(partidoId);
    if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });

    if (partido.organizadorId != organizadorId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await UsuarioPartido.update(
      { estado: 'confirmado' },
      { where: { UsuarioId: usuarioId, PartidoId: partidoId } }
    );

    const contenido = `Fuiste aceptado para el partido de ${partido.fecha} a las ${partido.hora} en ${partido.lugar}`;
    await Mensaje.create({
      emisorId: organizadorId,
      receptorId: usuarioId,
      contenido,
      leido: false,
      fecha: new Date()
    });

    const suscripcion = await Suscripcion.findOne({ where: { usuarioId } });
    const token = suscripcion?.fcmToken;

    if (token) {
      const mensaje = {
        token,
        notification: {
          title: '✅ Has sido aceptado',
          body: contenido
        },
        data: {
          url: '/mensajes'
        },
        android: { notification: { sound: 'default' } },
        apns: { payload: { aps: { sound: 'default' } } }
      };

      await admin.messaging().send(mensaje);
    }

    res.json({ mensaje: 'Jugador confirmado, mensaje enviado y FCM enviada' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al confirmar jugador' });
  }
});


router.post('/reenviar-invitacion', async (req, res) => {
  const { partidoId } = req.body;

  try {
    const partido = await Partido.findByPk(partidoId, {
      attributes: [
        'id', 'latitud', 'longitud', 'sexo', 'rangoEdad', 'categorias',
        'lugar', 'hora', 'fecha', 'cantidadJugadores', 'deporteId'
      ],
      include: [
        { model: Deporte },
        { model: Usuario, as: 'organizador' }
      ]
    });

    if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });

    const organizadorId = partido.organizador.id;

    const organizador = await Usuario.findByPk(organizadorId);
    if (organizador?.suspensionHasta && new Date(organizador.suspensionHasta) > new Date()) {
      return res.status(403).json({ error: '⛔ Estás suspendido temporalmente.' });
    }

    // 🎯 Todo el trabajo de filtros, relaciones y FCM lo hace esta función
    await enviarEscalonado(partido, partido.Deporte.nombre, organizadorId);

    res.json({ mensaje: '🔁 Reenvío de invitaciones escalonado iniciado correctamente.' });

  } catch (err) {
    console.error('❌ Error al reenviar invitación:', err);
    res.status(500).json({ error: 'Error al reenviar invitación' });
  }
});


// 🚀 Crear partido NO PREMIUM
const { v4: uuidv4 } = require('uuid');


function tienePlanEstablecimientoVigente(usuario) {
  if (!usuario.esPremiumEstablecimiento || !usuario.premiumEstablecimientoVenceEl) {
    return false;
  }
  const hoy = new Date();
  return new Date(usuario.premiumEstablecimientoVenceEl) > hoy;
}

router.post('/', async (req, res) => {
  const {
    deporteId,
    cantidadJugadores,
    lugar,
    fecha,
    hora,
    organizadorId,
    localidad,
    nombre,
    latitud,
    longitud,
    sexo,
    rangoEdad,
    categorias,
    ubicacionManual,
    precio,
    esPrivado
  } = req.body;


  // antes de crear el partido:
let tokenPrivadoGenerado = null;
if (esPrivado === true) {
  tokenPrivadoGenerado = crypto.randomBytes(12).toString('hex'); // ej "a3fd9c1e7b2f4d..."
}

  if (!deporteId || !cantidadJugadores || !lugar || !fecha || !hora || !organizadorId || !nombre) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para crear el partido.' });
  }

  try {
const organizador = await Usuario.findByPk(organizadorId);
if (!organizador) {
  return res.status(404).json({ error: 'Organizador no encontrado.' });
}

// ⚠️ si viene con canchaId => lo tomamos como partido de club / establecimiento
const esPartidoDeClub = !!req.body.canchaId;

if (esPartidoDeClub) {
  if (!tienePlanEstablecimientoVigente(organizador)) {
    return res.status(403).json({
      error: 'Tu plan de establecimiento no está activo. Renovalo para crear partidos desde tu club.'
    });
  }
}

    // suspensiones
    if (
      organizador?.suspensionHasta &&
      new Date(organizador.suspensionHasta) > new Date()
    ) {
      return res.status(403).json({
        error: '⛔ Estás suspendido por baja calificación. No podés crear partidos temporalmente.'
      });
    }

    // límites no premium
    if (!organizador?.premium) {
      if (cantidadJugadores > 12) {
        return res.status(403).json({
          error: 'Como usuario no premium, solo podés ingresar hasta 12 jugadores.'
        });
      }

      const partidosHoy = await Partido.count({
        where: {
          organizadorId,
          fecha // mismo día
        }
      });

      if (partidosHoy >= 1) {
        return res.status(403).json({
          error: 'Solo podés crear 1 partidos por día siendo usuario no premium.'
        });
      }
    }

    // limpiar arrays
    const categoriasSanitizadas = Array.isArray(categorias)
      ? categorias.filter(c => typeof c === 'string')
      : [];

    const rangoEdadSanitizado = Array.isArray(rangoEdad)
      ? rangoEdad.filter(r => typeof r === 'string')
      : [];

    // crear partido
    const partido = await Partido.create({
      deporteId,
      cantidadJugadores,
      lugar, // referencia / dirección específica dentro del lugar
      fecha: new Date(fecha),
      hora,
      nombre, // nombre del complejo / potrero
      organizadorId,
      localidad: localidad || '',
      latitud: latitud || null,
      longitud: longitud || null,
      sexo,
      rangoEdad: rangoEdadSanitizado,
      categorias: categoriasSanitizadas,
      canchaId: req.body.canchaId || null,
      precio: precio || null,
      ubicacionManual,
      esPrivado: esPrivado === true,
      tokenPrivado: tokenPrivadoGenerado 
    });

    // el organizador ya figura en el partido
    await UsuarioPartido.create({
      UsuarioId: organizadorId,
      PartidoId: partido.id,
      estado: 'organizador'
    });

    // mensaje inicial del partido
    await MensajePartido.create({
      partidoId: partido.id,
      usuarioId: organizadorId,
      mensaje: `📢 El organizador ${organizador?.nombre || 'desconocido'} ha creado el partido.`
    });

    // si el partido NO es privado → mandar invitaciones auto
    if (!esPrivado) {
      const deporte = await Deporte.findByPk(deporteId);

      try {
        await enviarEscalonado(
          partido,
          deporte?.nombre || 'deporte',
          organizadorId
        );
        console.log('📩 Envío escalonado ejecutado correctamente');
      } catch (err) {
        console.error('❌ Error durante el envío escalonado:', err);
      }
    } else {
      console.log('🔒 Partido privado: no se envían invitaciones automáticas.');
    }

    // generar link de invitación para compartir
    // ejemplo simple: /unirse/:partidoId
    let linkInvitacion = null;
if (esPrivado === true) {
  linkInvitacion = `/unirse/${partido.tokenPrivado}`;
}

return res.status(201).json({
  mensaje: '✅ Partido creado correctamente',
  partido,
  redirect: '/aceptaciones',
  linkInvitacion // puede ser null si es público
});
  } catch (error) {
    console.error('❌ Error creando partido :', error);
    return res.status(500).json({
      error: 'Error al crear el partido o enviar notificaciones.'
    });
  }
});



// 👑 Crear partido PREMIUM
router.post('/ispremium', async (req, res) => {
  const {
    deporteId,
    cantidadJugadores,
    lugar,
    fecha,
    hora,
    organizadorId,
    localidad,
    nombre,
    latitud,
    longitud,
    sexo,
    rangoEdad,
    ubicacionManual
  } = req.body;

  const organizador = await Usuario.findByPk(organizadorId);
  if (organizador?.suspensionHasta && new Date(organizador.suspensionHasta) > new Date()) {
    return res.status(403).json({ error: '⛔ Estás suspendido por baja calificación. No podés crear partidos temporalmente.' });
  }

  if (!deporteId || !cantidadJugadores || !lugar || !fecha || !hora || !organizadorId || !nombre) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para crear el partido.' });
  }

  const fechaAjustada = new Date(fecha);
  fechaAjustada.setHours(fechaAjustada.getHours() + 3);

  try {
    const partido = await Partido.create({
      deporteId,
      cantidadJugadores,
      lugar,
      fecha: fechaAjustada,
      hora,
      nombre,
      organizadorId,
      localidad: localidad || '',
      latitud: latitud || null,
      longitud: longitud || null,
      sexo,
      rangoEdad,
      ubicacionManual
    });

    const deporte = await Deporte.findByPk(deporteId);

    try {
      await enviarEscalonado(partido, deporte?.nombre || 'deporte', organizadorId);
      console.log('📩 Envío escalonado ejecutado correctamente');
    } catch (err) {
      console.error('❌ Error durante el envío escalonado (premium):', err);
    }

    res.status(201).json({ mensaje: 'Partido creado para premium.', partido });

  } catch (error) {
    console.error('❌ Error al crear partido premium:', error);
    res.status(500).json({ error: 'Error interno al crear el partido premium.' });
  }
}); // ✅ ESTA LÍNEA FALTABA (cierro el router.post)



// routes/partidos.js (o el archivo donde definas las rutas de partidos)
router.put('/:partidoId/actualizar-cantidad', async (req, res) => {
  const { partidoId } = req.params;
  const { cantidadJugadores } = req.body;

  try {
    const partido = await Partido.findByPk(partidoId);
    if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });

    partido.cantidadJugadores = cantidadJugadores;
    await partido.save();

    res.json({ mensaje: 'Cantidad de jugadores actualizada correctamente' });
  } catch (error) {
    console.error('❌ Error al actualizar la cantidad:', error);
    res.status(500).json({ error: 'Error del servidor al actualizar la cantidad' });
  }
});

// GET /api/partidos/:partidoId/invite-link
// GET /api/partidos/:partidoId/invite-link
router.get('/:partidoId/invite-link', async (req, res) => {
  try {
    const { partidoId } = req.params;

    // Buscamos el partido en la base
    const partido = await Partido.findByPk(partidoId);
    if (!partido) {
      return res.status(404).json({ ok: false, error: 'Partido no encontrado' });
    }

    // IMPORTANTE:
    // acá usá el nombre REAL de la columna donde guardás "07b4951ad974b897eedfc58b"
    // Ejemplos comunes: partido.tokenPrivado / partido.linkPrivado / partido.inviteToken / partido.codigoUnirse
    const token = partido.tokenPrivado; // <-- CAMBIAR ESTO AL NOMBRE REAL DE TU CAMPO

    if (!token) {
      return res.status(400).json({
        ok: false,
        error: 'Este partido no tiene un token privado asignado todavía'
      });
    }

    // armamos la URL que tus amigos van a abrir
    // ejemplo final: /unirse/07b4951ad974b897eedfc58b
    const invitePath = `/unirse/${token}`;

    return res.json({
      ok: true,
      inviteLink: invitePath,
    });
  } catch (error) {
    console.error('Error al obtener invite-link:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error interno del servidor'
    });
  }
});

// POST /api/partidos/unirse-con-token
// POST /api/partidos/unirse-con-token
router.post('/unirse-con-token', async (req, res) => {
  console.log('>>> /unirse-con-token BODY:', req.body);

  try {
    const { usuarioId, token } = req.body;

    console.log('usuarioId =', usuarioId);
    console.log('token     =', token);

    if (!usuarioId || !token) {
      console.log('Falta usuarioId o token');
      return res.status(400).json({ ok: false, error: 'Falta usuarioId o token' });
    }

    // 1. Buscar el partido por tokenPrivado
    const partido = await Partido.findOne({
      where: { tokenPrivado: token }
    });

    console.log('partido encontrado =>', partido ? partido.id : null);

    if (!partido) {
      return res.status(404).json({ ok: false, error: 'Partido no encontrado para ese link' });
    }

    // sanity check: si el partido no es privado, ni deberías usar esta ruta
    if (partido.esPrivado !== true) {
      return res.status(400).json({
        ok: false,
        error: 'Este partido no requiere token (no es privado).'
      });
    }

    // 2. Si el que entra es el organizador, devolver ok directo
    if (Number(partido.organizadorId) === Number(usuarioId)) {
      console.log('es organizador, devuelvo ok sin crear solicitud');
      return res.json({
        ok: true,
        partidoId: partido.id,
        yaOrganizador: true,
      });
    }

    // 3. Contar cuántos jugadores CONFIRMADOS ya hay en este partido
    //    Sólo cuentan las personas que van seguro.
    const confirmadosCount = await UsuarioPartido.count({
      where: {
        PartidoId: partido.id,
        estado: 'confirmado' // <- ajustá si usás otro string tipo 'aceptado'
      }
    });

    console.log('confirmadosCount =', confirmadosCount);
    console.log('cupo max (partido.cantidadJugadores) =', partido.cantidadJugadores);

    // 4. Si ya se alcanzó el cupo, rechazamos la unión
    if (
      typeof partido.cantidadJugadores === 'number' &&
      partido.cantidadJugadores > 0 &&
      confirmadosCount >= partido.cantidadJugadores
    ) {
      console.log('❌ Partido lleno, no se puede unir');
      return res.status(403).json({
        ok: false,
        error: 'El partido ya está completo.'
      });
    }

    // 5. Buscar si el usuario YA tiene una entrada en UsuarioPartido para este partido
    let solicitud = await UsuarioPartido.findOne({
      where: {
        UsuarioId: usuarioId,
        PartidoId: partido.id
      }
    });

    console.log('solicitud previa =>', solicitud ? solicitud.estado : 'ninguna');

    // 6. Si no tiene, lo creamos en "pendiente"
    if (!solicitud) {
      console.log('creando solicitud pendiente...');
      solicitud = await UsuarioPartido.create({
        UsuarioId: usuarioId,
        PartidoId: partido.id,
        estado: 'pendiente',
      });
    } else {
      // ya existe
      // edge case: si alguien estaba "rechazado" o "cancelado" y vuelve a entrar con el link
      // y todavía hay lugar => lo pasamos otra vez a "pendiente"
      if (solicitud.estado !== 'pendiente' && solicitud.estado !== 'confirmado') {
        console.log('actualizando solicitud existente a pendiente...');
        solicitud.estado = 'pendiente';
        await solicitud.save();
      }
      // si ya estaba "confirmado", lo dejamos confirmado
      // si ya estaba "pendiente", lo dejamos igual
    }

    console.log('OK ✅ unión registrada/actualizada');
    return res.json({
      ok: true,
      partidoId: partido.id,
      estado: solicitud.estado,
      cupoUsado: confirmadosCount,
      cupoMax: partido.cantidadJugadores
    });

  } catch (err) {
    console.error('*** ERROR en /unirse-con-token ***');
    console.error(err);
    return res.status(500).json({
      ok: false,
      error: 'Error interno al unirse con token'
    });
  }
});


module.exports = router;
