// models/Reto.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Reto = sequelize.define('Reto', {
  titulo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  puntos: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  // si el reto requiere cumplir algo específico (por ejemplo, cantidad de locales)
  tipo: {
    type: DataTypes.STRING, // ejemplo: 'visitas', 'canjes', 'puntos'
    allowNull: false,
  },
  meta: {
    type: DataTypes.INTEGER, // ejemplo: 3 locales, 5 canjes, 100 puntos
    allowNull: true,
  },
  rangoDias: {
    type: DataTypes.INTEGER, // ejemplo: 1 => 24 h, 7 => una semana
    allowNull: true,
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
});

module.exports = Reto;
