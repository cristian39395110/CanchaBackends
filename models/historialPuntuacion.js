// models/HistorialPuntuacion.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HistorialPuntuacion = sequelize.define('HistorialPuntuacion', {
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  partidoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  puntaje: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  comentario: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  puntuadoId: {
  type: DataTypes.INTEGER,
  allowNull: false
},

}, {
  timestamps: true,
  tableName: 'historialpuntuacions'
});

module.exports = HistorialPuntuacion;
