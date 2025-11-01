const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const uConcursosNegocio = sequelize.define('ConcursosNegocio', {
  titulo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  fechaInicio: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  fechaFin: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  visiblePublico: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

module.exports = uConcursosNegocio;
