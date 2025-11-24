  //app.js

    require('dotenv').config();
    const express = require('express');
    const app = express();
  const cors = require('cors');
  const http = require('http');
  const server = http.createServer(app);
  const socketIo = require('socket.io');
  const sequelize = require('./config/database');
  const verificarBloqueo = require('./middlewares/verificarBloqueo');
  const { autenticarToken } = require('./middlewares/auth');
const { UsuarioPartido, Partido } = require('./models/model'); // Asegurate de importar bien tus modelos
  // Middlewares
  app.use(cors({ origin: '*' }));
  app.use(express.json());
  app.use('/uploads', express.static('uploads'));

  // Configuración de Socket.IO (✅ Primero creamos io)
  const io = socketIo(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // ✅ Luego lo seteamos en la app
  app.set('io', io);

  // 👂 Socket.IO escuchando
  io.on('connection', (socket) => {
  console.log('✅ Nuevo cliente conectado');

  // 👉 Canal privado del usuario
socket.on('join', (sala) => {
  if (sala.startsWith('usuario-')) {
    const idExtraido = sala.split('-')[1];
    socket.usuarioId = Number(idExtraido);
    socket.join(sala);
    console.log(`📡 Usuario unido a sala ${sala}`);
  }

  if (sala.startsWith('noti-')) {
    socket.join(sala);
    console.log(`🔔 Usuario unido a sala de notificaciones ${sala}`);
  }
});




socket.on('leave', (sala) => {
  socket.leave(sala);
  console.log(`👋 Usuario salió de la sala ${sala}`);
});

  // 👉 Canal grupal del partido


socket.on('join-partido', async (partidoId) => {
  const usuarioId = socket.usuarioId;

  if (!usuarioId) {
    console.log('⛔ join-partido rechazado: socket no tiene usuarioId');
    return;
  }

  try {
    // ✅ También dejamos pasar si es el organizador
    const partido = await Partido.findByPk(partidoId);

    if (!partido) {
      console.log(`⛔ Partido ${partidoId} no encontrado`);
      return;
    }

    const esOrganizador = Number(partido.organizadorId) === Number(usuarioId);

    const relacion = await UsuarioPartido.findOne({
      where: {
        usuarioId,
        partidoId,
        estado: 'confirmado'
      }
    });

    if (!esOrganizador && !relacion) {
      console.log(`⛔ Usuario ${usuarioId} fue expulsado o no pertenece al partido ${partidoId}`);
      return;
    }

    socket.join(`partido-${partidoId}`);
    console.log(`✅ Usuario ${usuarioId} unido al chat del partido ${partidoId}`);

  } catch (err) {
    console.error('❌ Error en join-partido:', err);
  }
});
  // 👉 Evento: enviar mensaje al grupo del partido
  socket.on('mensaje-partido', async ({ partidoId, usuarioId, mensaje }) => {
    try {
      // Guardar en DB
      const nuevo = await require('./models/MensajePartido').create({ partidoId, usuarioId, mensaje });

      // Emitir mensaje a todos los conectados al partido
  const sockets = await io.in(`partido-${partidoId}`).allSockets();

for (const socketId of sockets) {
  const socketInstance = io.sockets.sockets.get(socketId);

  if (socketInstance?.usuarioId === Number(usuarioId)) {
    socketInstance.emit('nuevo-mensaje-partido', {
      id: nuevo.id,
      partidoId,
      usuarioId,
      mensaje,
      createdAt: nuevo.createdAt,
      esMio: true, // 👈 Solo a él se lo mandamos así
    });
  } else {
    socketInstance?.emit('nuevo-mensaje-partido', {
      id: nuevo.id,
      partidoId,
      usuarioId,
      mensaje,
      createdAt: nuevo.createdAt,
    });
  }
}


      // Enviar notificaciones FCM (excepto al emisor)
      const { Suscripcion, Usuario } = require('./models');
      const admin = require('./firebase');

      const jugadores = await Suscripcion.findAll({
        where: { usuarioId: { [require('sequelize').Op.ne]: usuarioId } },
        include: [{ model: Usuario, attributes: ['id', 'nombre'] }]
      });

      const tokens = jugadores.map(j => j.fcmToken).filter(Boolean);

      if (tokens.length > 0) {
        await admin.messaging().sendEach(
          tokens.map(token => ({
            token,
            notification: {
              title: '💬 Nuevo mensaje en el grupo del partido',
              body: mensaje.length > 60 ? mensaje.slice(0, 60) + '...' : mensaje,
            },
            data: {
              tipo: 'mensaje_partido',
              partidoId: partidoId.toString()
            }
          }))
        );
      }

    } catch (err) {
      console.error('❌ Error en mensaje-partido:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Cliente desconectado');
  });
});


  // Importar modelos para cargar relaciones
  require('./models/usuario');
  require('./models/deporte');
  require('./models/partido');
  require('./models/usuarioDeporte');
  require('./models/usuarioPartido');
  require('./models/Mensaje');


  // Rutas
  const usuarioDeporteRoutes = require('./routes/usuarioDeporte');
  const mensajesRouter = require('./routes/mensajes');
  const partidoRoutes = require('./routes/partido');
  const usuarioRoutes = require('./routes/usuario');
  const deporteRoutes = require('./routes/deporte');
  const suscripcionRoutes = require('./routes/suscripcion');
  const notificacionesRouter = require('./routes/notificaciones');
  const solicitudesRouter = require('./routes/solicitudes');
  const premiumRouter = require('./routes/premium');
  const fcmRouter = require('./routes/fcm');
  const pendientesRouter = require('./routes/pendientes');
  const publicacionRouter = require('./routes/publicacion');
  const amistadRouter = require('./routes/amistad');
  const amigoRouter = require('./routes/amigos');
  const canchasRoutes = require('./routes/canchas');
  const puntuacionRoutes = require('./routes/puntuacion');
  const historialdeposicionesRoutes = require('./routes/historialpuntuacion');
  const mensajePartidoRouter = require('./routes/mensajePartido');
  const envioNotificacionRouter = require('./routes/envioNotificacion');
  const historiasRoutes = require('./routes/historias');
  const qrRoutes = require('./routes/qr')
  const premioRoutes = require('./routes/premio');
    const concursoRoutes = require('./routes/concursos');





app.use('/api/concursos', concursoRoutes);



app.use('/api/premio', premioRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/historias', historiasRoutes);
app.use('/api/envio-notificaciones', envioNotificacionRouter);
app.use('/api/mensajes-partido', mensajePartidoRouter);
app.use('/api/historialpuntuacion', historialdeposicionesRoutes);

  app.use('/api/canchas', canchasRoutes);
  app.use('/api/puntuacion', puntuacionRoutes);
  app.use('/api/amigos',verificarBloqueo, amigoRouter);
  app.use('/api/amistad', amistadRouter);
  app.use('/api/publicaciones', verificarBloqueo,publicacionRouter);
  app.use('/api/pendientes', verificarBloqueo,pendientesRouter);
  app.use('/api/mensajes', verificarBloqueo,mensajesRouter);
  app.use('/api/usuariodeporte',verificarBloqueo, usuarioDeporteRoutes);
  app.use('/api/solicitudes',verificarBloqueo, solicitudesRouter);
  app.use('/api/notificaciones',verificarBloqueo, notificacionesRouter);
  app.use('/api/partidos', verificarBloqueo,partidoRoutes);
  app.use('/api/usuarios',usuarioRoutes);
  app.use('/api/deportes', deporteRoutes);
  app.use('/api/suscripcion', suscripcionRoutes);
  app.use('/api/premium', verificarBloqueo,premiumRouter);
  app.use('/api/fcm', fcmRouter);

  //---------------------------Mercado Pago MatchClub--------------------------

  const cuotaClubRoutes = require('./routes/cuotaClub');
app.use('/api/cuota-club', cuotaClubRoutes);

//------------------------------Fin mercado Pago






//------------------------------------------------------------
// Empieza los endpoint del Negocio
//-----------------------------------------------------------//------------------------------------------------------------
// Empieza los endpoint del Negocio
//-----------------------------------------------------------//------------------------------------------------------------
// Empieza los endpoint del Negocio
//-----------------------------------------------------------



const uUsuariosNegocioRoutes = require('./routes/uUsuariosNegocio');
app.use('/api/loginusuario', uUsuariosNegocioRoutes);


const NegocioRoutes = require('./routes/negocios');
app.use('/api/negocios', NegocioRoutes);



const promoNegocioRoutes = require('./routes/promoNegocio');
app.use('/api/promoNegocio', promoNegocioRoutes);



//______________________________-----------------------------


const puntosNegociosqrRoutes = require('./routes/upuntosNegociosqr');
app.use('/api/puntosnegociosqr', puntosNegociosqrRoutes);

//______________________________-----------------------------


const ganadorRoutes = require('./routes/uganador');
app.use('/api/ganador', ganadorRoutes);


//______________________________-----------------------------
const retosRoutes = require('./routes/retos');
app.use('/api/retos', retosRoutes);
  


const partnersRoutes = require('./routes/partners');
app.use('/api/partners', partnersRoutes);



    const puntosRoutes = require('./routes/upuntos');

app.use('/api/puntosNegocio', puntosRoutes);



  const publicidadRoutes = require('./routes/upublicidadNegocio');

app.use('/api/publicidad-negocio', publicidadRoutes);





  const planRoutes = require('./routes/planesNegocio');

app.use("/api/planes-negocio", planRoutes);



const negociosRankingRoutes = require('./routes/negociosranking');
app.use('/api/negocio', negociosRankingRoutes);





//------------------------------------------------------------------
//Fin de Negocio 
  //---------------------------


  // 📤 Ruta de test para enviar notificación FCM
app.post('/api/test-fcm', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Falta el token FCM' });
  }

  const admin = require('./firebase');

  const message = {
    token,
    notification: {
      title: '🚀 Notificación de prueba',
      body: 'Este es un mensaje de test FCM desde el backend 😎'
    },
    data: {
      tipo: 'test',
      url: '/invitaciones'
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
    console.log('✅ Test FCM enviada correctamente:', response);
    res.json({ mensaje: '✅ Notificación enviada', response });
  } catch (error) {
    console.error('❌ Error al enviar test FCM:', error.message);
    res.status(500).json({ error: 'Error enviando notificación', detalle: error.message });
  }
});


/*
  // Iniciar servidor
  sequelize.sync({ alter: true })
  

  sequelize.sync().then(() => {
  console.log('✅ Base de datos sincronizada (sin alter)');
  server.listen(3000, '0.0.0.0', () => {

    console.log('✅ Servidor con Socket.io corriendo en puerto 3000');
  });
});

*/
sequelize
  .sync({
    force: false,  // nunca borrar tablas
    alter: false,  // nunca tratar de ajustar columnas automáticamente
  })
  .then(() => {
    console.log('✅ DB conectada sin tocar estructura');
    server.listen(3000, '0.0.0.0', () => {
      console.log('✅ Servidor listo en puerto 3000');
    });
  })
  .catch(err => {
    console.error('❌ Error al sincronizar sequelize:', err);
  });

/*
  
  sequelize.sync({ alter: true }).then(() => {
    console.log('Base de datos sincronizada');
    server.listen(3000, '0.0.0.0', () => {
      console.log('✅ Servidor con Socket.io corriendo en puerto 3000');
    });
  });
  
*/