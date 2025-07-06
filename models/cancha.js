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
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  longitud: {
    type: DataTypes.FLOAT,
    allowNull: false,
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
});

module.exports = Cancha;
