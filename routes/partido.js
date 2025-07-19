const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const admin = require('firebase-admin');

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
  const distanciaKm = 13;
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


      const payload = {
        title: '🎯 ¡Nuevo partido disponible!',
        body: `Partido de ${deporteNombre} en ${partido.lugar} el ${partido.fecha} a las ${partido.hora}`,
        url: '/invitaciones'
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

// 🚀 Crear partido NO PREMIUM
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
    ubicacionManual
  } = req.body;


const fechaAjustada = new Date(fecha); // ya viene con la hora correcta


  if (!deporteId || !cantidadJugadores || !lugar || !fecha || !hora || !organizadorId || !nombre) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para crear el partido.' });
  }

  try {
    const organizador = await Usuario.findByPk(organizadorId);

    if (organizador?.suspensionHasta && new Date(organizador.suspensionHasta) > new Date()) {
      return res.status(403).json({ error: '⛔ Estás suspendido por baja calificación. No podés crear partidos temporalmente.' });
    }
if (!organizador?.premium) {
  if (cantidadJugadores > 12) {
    return res.status(403).json({ error: 'Como usuario no premium, solo podés ingresar hasta 12 jugadores.' });
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const partidosHoy = await Partido.count({
    where: {
      organizadorId,
      fecha: fechaHoy
    }
  });

  if (partidosHoy >= 1) {
    return res.status(403).json({ error: 'Solo podés crear 2 partidos por día siendo usuario no premium.' });
  }
}

const categoriasSanitizadas = Array.isArray(categorias) ? categorias.filter(c => typeof c === 'string') : [];
const rangoEdadSanitizado = Array.isArray(rangoEdad) ? rangoEdad.filter(r => typeof r === 'string') : [];
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
      rangoEdad: rangoEdadSanitizado,
categorias: categoriasSanitizadas,
      canchaId: req.body.canchaId || null,
canchaNombreManual: req.body.canchaNombreManual || null,

      ubicacionManual
    });
// Crear relación del organizador al partido (pero con estado distinto)
await UsuarioPartido.create({
  UsuarioId: organizadorId,
  PartidoId: partido.id,
  estado: 'organizador' // para distinguirlo de 'confirmado'
});

    const deporte = await Deporte.findByPk(deporteId);

    try {
      await enviarEscalonado(partido, deporte?.nombre || 'deporte', organizadorId);
      console.log('📩 Envío escalonado ejecutado correctamente');
    } catch (err) {
      console.error('❌ Error durante el envío escalonado:', err);
    }

   await MensajePartido.create({
  partidoId: partido.id,
  usuarioId: req.body.organizadorId,
  mensaje: `📢 El organizador ${organizador?.nombre || 'desconocido'} ha creado el partido.`,
});

console.log(`🎉 Partido creado por ${organizador?.nombre} (premium: ${organizador?.premium})`);

    res.status(201).json({
    mensaje: '✅ Partido creado correctamente',

      partido
    });

  } catch (error) {
    console.error('❌ Error creando partido :', error);
    res.status(500).json({ error: 'Error al crear el partido o enviar notificaciones.' });
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

router.post('/reenviar-invitacion', async (req, res) => {
  const { partidoId } = req.body;

  try {
    const partido = await Partido.findByPk(partidoId, {
      include: [{ model: Deporte }, { model: Usuario, as: 'organizador' }]
    });
    
    if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });
    
    
    const organizadorId=partido.organizador.id

      const organizador = await Usuario.findByPk(organizadorId);
  if (organizador?.suspensionHasta && new Date(organizador.suspensionHasta) > new Date()) {
    return res.status(403).json({ error: '⛔ Estás suspendido por baja calificación. No podés crear partidos temporalmente.' });
  }

    const distanciaMaxKm = 15;

    const candidatosCercanos = await UsuarioDeporte.sequelize.query(
      `
      SELECT ud.usuarioId
      FROM UsuarioDeportes ud
      JOIN Usuarios u ON ud.usuarioId = u.id
      WHERE ud.deporteId = :deporteId
        AND ud.usuarioId != :organizadorId
        AND ud.usuarioId NOT IN (
          SELECT UsuarioId FROM UsuarioPartidos WHERE PartidoId = :partidoId
        )
        AND u.latitud IS NOT NULL AND u.longitud IS NOT NULL
        AND (
          6371 * acos(
            cos(radians(:lat)) * cos(radians(u.latitud)) *
            cos(radians(u.longitud) - radians(:lon)) +
            sin(radians(:lat)) * sin(radians(u.latitud))
          )
        ) < :distancia
      `,
      {
        replacements: {
          deporteId: partido.deporteId,
          organizadorId: partido.organizadorId,
          partidoId: partido.id,
          lat: partido.latitud,
          lon: partido.longitud,
          distancia: distanciaMaxKm
        },
        type: UsuarioDeporte.sequelize.QueryTypes.SELECT
      }
    );

    const candidatos = candidatosCercanos.map(row => row.usuarioId);
    // ❌ Filtrar usuarios suspendidos
const suspendidos = await Usuario.findAll({
  where: {
    id: { [Op.in]: candidatos },
    suspensionHasta: { [Op.gt]: new Date() }
  }
});
const suspendidosIds = suspendidos.map(u => u.id);
const candidatosFiltrados = candidatos.filter(id => !suspendidosIds.includes(id));


    // Filtramos bien los usuarios válidos
   const usuariosFiltrados = await Promise.all(
  candidatosFiltrados.map(async (usuarioId) => {

        // ✅ Reforzamos que no sea el organizador
        if (usuarioId === partido.organizadorId) return null;

        const suscripcion = await Suscripcion.findOne({ where: { usuarioId } });
        if (!suscripcion) return null;

        const usuario = await Usuario.findByPk(usuarioId);
        return usuario ? { usuario, token: suscripcion.fcmToken } : null;
      })
    );

    const seleccionados = usuariosFiltrados.filter(Boolean).slice(0, 3);

   

    for (const candidato of seleccionados) {
      if (!candidato?.usuario?.id) continue;

      await UsuarioPartido.create({
        UsuarioId: candidato.usuario.id,
        PartidoId: partidoId,
        estado: 'pendiente'
      });

      await enviarNotificacionesFCM(candidato.token, {
        title: '🏟️ Nueva invitación',
        body: `Te invitaron a un partido de ${partido.Deporte.nombre} en ${partido.lugar}. ¡Aceptá antes que otro!`,
        url: '/invitaciones'
      });
    }

    res.json({ mensaje: `Se enviaron ${seleccionados.length} invitaciones basadas en distancia` });

  } catch (err) {
    console.error('❌ Error al reenviar invitación:', err);
    res.status(500).json({ error: 'Error al reenviar invitación' });
  }
});

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



module.exports = router;
