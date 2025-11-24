// models/Ganador.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ganador = sequelize.define('Ganador', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },

  negocioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  premio: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'Ganador',
  timestamps: true, // incluye createdAt y updatedAt
});

module.exports = Ganador;
