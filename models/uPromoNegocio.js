const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const uPromoNegocio = sequelize.define('uPromoNegocio', {
  negocioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  titulo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tipo: {
    type: DataTypes.ENUM('puntos', 'descuento', 'combo'),
    allowNull: false,
    defaultValue: 'puntos',
  },
  porcentajePuntos: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  porcentajeDescuento: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  desde: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  hasta: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  prioridad: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  visibilidad: {
    type: DataTypes.ENUM('publica', 'oculta'),
    defaultValue: 'publica',
  },
  activa: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'uPromoNegocio',
});

module.exports = uPromoNegocio;
