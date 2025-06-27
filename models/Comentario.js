const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Comentario = sequelize.define('Comentario', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  contenido: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  publicacionId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  updatedAt: false
});

module.exports = Comentario;
