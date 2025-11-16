// models/RetoGanadorHistDet.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RetoGanadorHistDet = sequelize.define('RetoGanadorHistDet', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, // explícito
  histId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'RetoGanadoresHist', // nombre EXACTO de la tabla padre (tu model RetoGanadorHist usa tableName 'RetoGanadoresHist')
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'uUsuariosNegocio', // tabla correcta (usuarios del módulo negocio)
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'NO ACTION',
  },
  puesto: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  timestamps: true,
  tableName: 'RetoGanadoresHistDet',
  freezeTableName: true,
  indexes: [
    { unique: true, fields: ['histId', 'usuarioId'] },
  ],
});

module.exports = RetoGanadorHistDet;
