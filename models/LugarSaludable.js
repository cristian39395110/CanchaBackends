const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LugarSaludable = sequelize.define('LugarSaludable', {

  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  latitud: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
  },

  longitud: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
  },

  radioMetros: {
    type: DataTypes.INTEGER,
    defaultValue: 50,
  },

  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },

}, {
  tableName: 'LugarSaludable',
  timestamps: true,
});

module.exports = LugarSaludable;
