const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HistoriaLike = sequelize.define('HistoriaLike', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  historiaId: { type: DataTypes.INTEGER, allowNull: false },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'HistoriaLikes',
  timestamps: true,
  indexes: [{ unique: true, fields: ['historiaId', 'usuarioId'] }],
});

module.exports = HistoriaLike;
