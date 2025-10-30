const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Usuario = require('./usuario');
const Cancha = require('./cancha');
const QREmision = require('./QREmision');

const QRCheckin = sequelize.define('QRCheckin', {
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Usuario,
      key: 'id',
    },
  },
  partidoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  canchaId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Cancha,
      key: 'id',
    },
  },
  emisionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: QREmision,
      key: 'id',
    },
  },
  deviceId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  lat: {
    type: DataTypes.DECIMAL(9,6),
    allowNull: true,
  },
  lng: {
    type: DataTypes.DECIMAL(9,6),
    allowNull: true,
  },
  distancia: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  resultado: {
    type: DataTypes.ENUM('aprobado', 'denegado'),
    allowNull: false,
  },
  motivoDenegado: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  puntosOtorgados: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

module.exports = QRCheckin;
