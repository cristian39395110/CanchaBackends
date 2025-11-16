// models/NegocioDestacado.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NegocioDestacado = sequelize.define('NegocioDestacado', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  // negocio dueño (uNegocio)
  negocioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'uNegocios', // 👈 poné acá el nombre REAL de la tabla de negocios
      key: 'id',
    },
  },

  // mes y año del ranking (ej: noviembre 2025 → mes = 11, anio = 2025)
  mes: {
    type: DataTypes.INTEGER,
    allowNull: false, // 1–12
  },
  anio: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  // puesto dentro de los destacados de ese mes (1,2,3…)
  puesto: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  // puntos que tenía ese mes cuando se cerró el ranking
  puntosMes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'NegocioDestacado',
  timestamps: true,
  indexes: [
    {
      // para no repetir el mismo negocio dos veces en el mismo mes/año
      unique: true,
      fields: ['negocioId', 'mes', 'anio'],
    },
  ],
});

module.exports = NegocioDestacado;
