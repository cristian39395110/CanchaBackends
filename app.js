require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const http = require('http');
const server = http.createServer(app);
const socketIo = require('socket.io');
const sequelize = require('./config/database');

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

  socket.on('join', (usuarioId) => {
    socket.join(`usuario-${usuarioId}`);
    console.log(`📡 Usuario ${usuarioId} unido a su canal privado`);
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

app.use('/api/mensajes', mensajesRouter);
app.use('/api/usuariodeporte', usuarioDeporteRoutes);
app.use('/api/solicitudes', solicitudesRouter);
app.use('/api/notificaciones', notificacionesRouter);
app.use('/api/partidos', partidoRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/deportes', deporteRoutes);
app.use('/api/suscripcion', suscripcionRoutes);

// Iniciar servidor
sequelize.sync({ alter: true }).then(() => {
  console.log('Base de datos sincronizada');
  server.listen(3000, '0.0.0.0', () => {
    console.log('✅ Servidor con Socket.io corriendo en puerto 3000');
  });
});
