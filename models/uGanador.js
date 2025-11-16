// models/Ganador.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ganador = sequelize.define('Ganador', {
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
});

module.exports = Ganador;
