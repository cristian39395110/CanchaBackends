// models/historialPuntuacion.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Usuario = require('./usuario'); // Importamos Usuario para las relaciones

const HistorialPuntuacion = sequelize.define('HistorialPuntuacion', {
  tipo: {
    type: DataTypes.ENUM('pulgar_arriba', 'pulgar_abajo', 'asistio', 'cancelacion', 'comportamiento'),
    allowNull: false,
  },
  puntos: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  timestamps: true, // Para que tenga createdAt y updatedAt
});

module.exports = HistorialPuntuacion;
