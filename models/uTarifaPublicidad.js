// models/TarifaPublicidad.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TarifaPublicidad = sequelize.define(
  'TarifaPublicidad',
  {
    // 💰 Precio base por semana
    precioPorSemana: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    // opcional: un mínimo por campaña
    precioMinimo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },

    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'tarifa_publicidad',
  }
);

module.exports = TarifaPublicidad;
