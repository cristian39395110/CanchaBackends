// app.js
const express = require('express');
const app = express();
const sequelize = require('./config/database');
const cors = require('cors');
const { Usuario, Deporte, Partido, Suscripcion, UsuarioDeporte, UsuarioPartido } = require('./models');
app.use(cors({
  origin: '*'
}));

const http = require('http');
const socketIo = require('socket.io');
const app = require('./app'); // tu express app

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*', // ajustá según tu frontend
    methods: ['GET', 'POST']
  }
});

// Mantenelo disponible en otros módulos
app.set('io', io);

// Escuchá eventos personalizados
io.on('connection', (socket) => {
  console.log('🟢 Usuario conectado');

  socket.on('disconnect', () => {
    console.log('🔴 Usuario desconectado');
  });
});

server.listen(3000, () => {
  console.log('✅ Servidor con Socket.io corriendo en puerto 3000');
});



require('dotenv').config();
app.use(express.json());
app.use('/uploads', express.static('uploads'));


// Importar modelos para que se carguen relaciones
require('./models/usuario');
require('./models/deporte');
require('./models/partido');
require('./models/usuarioDeporte');
require('./models/usuarioPartido');
require('./models/Mensaje');




// Rutas (las puedes crear después)
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


sequelize.sync({ alter: true }).then(() => {
  console.log('Base de datos sincronizada');
 app.listen(3000, '0.0.0.0', () => {
  console.log('Servidor corriendo en puerto 3000');
});

});
