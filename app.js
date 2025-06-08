// app.js
require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const http = require('http'); // 👉 Primero importás http
const server = http.createServer(app);
const socketIo = require('socket.io');
const sequelize = require('./config/database');
const { Usuario, Deporte, Partido, Suscripcion, UsuarioDeporte, UsuarioPartido } = require('./models');

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Configuración de Socket.IO
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('🟢 Usuario conectado');

  socket.on('disconnect', () => {
    console.log('🔴 Usuario desconectado');
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

// Iniciar servidor y sincronizar base de datos
sequelize.sync({ alter: true }).then(() => {
  console.log('Base de datos sincronizada');
  server.listen(3000, '0.0.0.0', () => {
    console.log('✅ Servidor con Socket.io corriendo en puerto 3000');
  });
});
