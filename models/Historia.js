const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Historia = sequelize.define('Historia', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false },
  mediaUrl: { type: DataTypes.STRING(600), allowNull: false },
  tipo: { type: DataTypes.ENUM('imagen', 'video'), allowNull: false },
  cloudinaryId: { type: DataTypes.STRING(300), allowNull: true },
  duracionSegundos: { type: DataTypes.INTEGER, allowNull: true },

  // nuevos
  descripcion: { type: DataTypes.STRING(500), allowNull: true },
  linkUrl: { type: DataTypes.STRING(600), allowNull: true },
  phoneNumber: { type: DataTypes.STRING(30), allowNull: true }, // ej: +54..., 11-xxxx
}, {
  tableName: 'Historias',
  timestamps: true,
});

module.exports = Historia;
