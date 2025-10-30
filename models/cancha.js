// models/Cancha.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Tu instancia global

const Cancha = sequelize.define('Cancha', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  direccion: {
    type: DataTypes.STRING,
    allowNull: false,
  },
   latitud: { 
    type: DataTypes.DECIMAL(10, 7), 
    allowNull: true 
  },  // opcional para mapa
  longitud: { 
    type: DataTypes.DECIMAL(10, 7),
     allowNull: true 
    },
  deportes: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  telefono: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  foto: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  whatsapp: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  // 🔒 Nuevos campos para QR y control
  qrSecret: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  radioGeofence: {
    type: DataTypes.INTEGER,
    defaultValue: 100, // metros
  },
  verificada: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  propietarioUsuarioId: {
    type: DataTypes.INTEGER,
    allowNull: true, // FK hacia Usuario
  },
  esAsociada: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  puntosBase: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
  },
  puntosAsociada: {
    type: DataTypes.INTEGER,
    defaultValue: 20,
  },
  minutosAnticipoCheckin: {
    type: DataTypes.INTEGER,
    defaultValue: 30, // minutos antes del partido
  },
  minutosGraciaCheckin: {
    type: DataTypes.INTEGER,
    defaultValue: 60, // minutos después del partido
  },
});

module.exports = Cancha;
