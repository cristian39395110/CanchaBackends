// models/RetoGanador.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RetoGanador = sequelize.define('RetoGanador', {
  retoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  puesto: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  publicadoEn: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: true,
  tableName: 'RetoGanadores',
  indexes: [
    { unique: true, fields: ['retoId', 'usuarioId'] },
  ],
});

module.exports = RetoGanador;
