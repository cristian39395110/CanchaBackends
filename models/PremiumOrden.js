// models/PremiumOrden.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PremiumOrden = sequelize.define('PremiumOrden', {
  id: {
       type: DataTypes.INTEGER, 
    autoIncrement: true,
    primaryKey: true,
  },
  usuarioId: {
     type: DataTypes.INTEGER,  
    allowNull: false,
  },
  tipoPlan: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'establecimiento_premium', // por ahora uno solo
  },
  monto: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  estado: {
    type: DataTypes.ENUM('pendiente', 'pagada', 'rechazada'),
    allowNull: false,
    defaultValue: 'pendiente',
  },
  mpPreferenceId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  mpPaymentId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  mpPayload: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  fechaPago: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'premium_ordenes',
  timestamps: true, // si usás createdAt/updatedAt; si no, poné false
});

module.exports = PremiumOrden;
