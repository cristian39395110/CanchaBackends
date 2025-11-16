// models/SorteoConfig.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SorteoConfig = sequelize.define('SorteoConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  verPremioPublico: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  verFechaPublica: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  mostrarGanadoresPublico: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  mostrarRankingPublico: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'SorteoConfigs',
  timestamps: false,
});

module.exports = SorteoConfig;
