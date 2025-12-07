const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ParteTecnica = sequelize.define('ParteTecnica', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  documento: {
    type: DataTypes.STRING,
    allowNull: true,
  },
    telefono: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  rol: {
    type: DataTypes.ENUM('admin', 'supervisor', 'vendedor'),
    defaultValue: 'vendedor',
  },



  // 📍 ciudad/localidad
  localidad: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  // 🗺 provincia (para filtrar por provincia en el panel)
  provincia: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  // 💰 alias / CBU / CVU para pagarle al vendedor
  aliasPago: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  // opcional: si un supervisor controla un vendedor puntual
  idVendedorAsignado: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  debeCambiarPassword: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  intentosFallidos: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  bloqueado: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'parte_tecnica',
});

module.exports = ParteTecnica;
