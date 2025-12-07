// models/SorteoMensualProvincia.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SorteoMensualProvincia = sequelize.define('SorteoMensualProvincia', {
  provincia: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  localidad: {
    type: DataTypes.STRING,
    allowNull: true, // por ahora sorteamos por provincia, pero queda preparado
  },
  mes: {
    type: DataTypes.INTEGER, // 1-12
    allowNull: false,
  },
  anio: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  usuarioId: {
    type: DataTypes.INTEGER, // id de uUsuariosNegocio
    allowNull: false,
  },
  puesto: {
    type: DataTypes.INTEGER, // 1, 2, 3
    allowNull: false,
  },
  puntosMes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  comprasMes: {
    type: DataTypes.INTEGER, // cantidad de canjeos (checkins) en ese mes
    allowNull: false,
    defaultValue: 0,
  },
    premio: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'SorteoMensualProvincia',
});

module.exports = SorteoMensualProvincia;
