// models/QREmision.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Cancha = require('./cancha');

const QREmision = sequelize.define('QREmision', {
  canchaId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: Cancha, key: 'id' },
  },
  fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  puntosOtorga: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
  },
  rotacionSegundos: {
    type: DataTypes.INTEGER,
    defaultValue: 60,
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },

  // NUEVO: código manual del día (A–Z + 2–9, sin I, L, O, 0, 1)
  manualCode: {
    type: DataTypes.STRING(6),
    allowNull: true, // se completa al crear la emisión
  },
}, {
  indexes: [
    { unique: true, fields: ['canchaId', 'fecha'] },           // 1 emisión por día
    { unique: true, fields: ['fecha', 'manualCode'] },         // código único en el día
  ],
});

module.exports = QREmision;
