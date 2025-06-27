// models/Bloqueo.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Bloqueo = sequelize.define('Bloqueo', {
  usuarioId: { // quien bloquea
    type: DataTypes.INTEGER,
    allowNull: false
  },
  bloqueadoId: { // a quién bloquea
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  timestamps: false
});

module.exports = Bloqueo;
