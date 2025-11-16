// models/RetoParticipante.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RetoParticipante = sequelize.define('RetoParticipante', {
  retoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  timestamps: true,
  tableName: 'RetoParticipantes',
  indexes: [
    { unique: true, fields: ['retoId', 'usuarioId'] },
  ],
});

module.exports = RetoParticipante;
