const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PublicacionLeida = sequelize.define('PublicacionLeida', {
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true
  },
  publicacionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true
  },
  fecha: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'PublicacionLeida',
  timestamps: false
});

module.exports = PublicacionLeida;
