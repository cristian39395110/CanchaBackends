// models/UsuarioRetoCumplido.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UsuarioRetoCumplido = sequelize.define('UsuarioRetoCumplido', {
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  retoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  fechaCumplido: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  puntosOtorgados: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

module.exports = UsuarioRetoCumplido;
