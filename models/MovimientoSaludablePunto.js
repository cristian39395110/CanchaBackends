const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MovimientoSaludablePunto = sequelize.define('MovimientoSaludablePunto', {

  movimientoId: {
    type: DataTypes.INTEGER,
    allowNull: false, // FK a MovimientoSaludable
  },

  latitud: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
  },

  longitud: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
  },

  precisionMetros: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },

  velocidadMps: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true,
  },

  origen: {
    type: DataTypes.ENUM('gps', 'fused', 'mock'),
    defaultValue: 'gps',
  },

  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
  },

  // 🆕 AGREGAR ESTO
  lugarId: {
    type: DataTypes.INTEGER,
    allowNull: true,  // puede ser null si el punto no pertenece a un lugar específico
  },

}, {
  tableName: 'MovimientoSaludablePunto',
  timestamps: true,
});

module.exports = MovimientoSaludablePunto;
