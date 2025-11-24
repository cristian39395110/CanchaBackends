// models/TarifaPublicidad.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TarifaPublicidad = sequelize.define(
  'TarifaPublicidad',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    precioPorSemana: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    precioMinimo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.00,
    },

    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'tarifa_publicidad',
    timestamps: true,   // 👈 createdAt / updatedAt
  }
);

module.exports = TarifaPublicidad;
