// models/HistoriaVisto.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HistoriaVisto = sequelize.define('HistoriaVisto', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  historiaId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'HistoriasVistas',
  timestamps: true,   // createdAt = momento de la vista
  updatedAt: false,
  indexes: [
    { unique: true, fields: ['historiaId', 'usuarioId'] }, // evita duplicados
    { fields: ['usuarioId'] },
    { fields: ['historiaId'] },
  ],
});

module.exports = HistoriaVisto;
