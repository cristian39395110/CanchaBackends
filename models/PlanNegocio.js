const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PlanNegocio = sequelize.define('PlanNegocio', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  puntosPorCompra: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  precioMensual: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false,
  },
  multiplicadorPuntos: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  descripcion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'plannegocios',
  timestamps: false   // 👈👈👈 ESTO FALTABA
});


module.exports = PlanNegocio;
