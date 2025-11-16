// models/RetoGanadorHist.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RetoGanadorHist = sequelize.define('RetoGanadorHist', {
  retoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  publicadoEn: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: true,
  tableName: 'RetoGanadoresHist',
});

module.exports = RetoGanadorHist;
