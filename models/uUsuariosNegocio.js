const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const uUsuariosNegocio = sequelize.define('uUsuariosNegocio', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  telefono: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  provincia: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  localidad: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  puntos: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  esPremium: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },

  // 👇 estos 3 son los que usa tu router
  tokenVerificacion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  verificado: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  deviceId: {
    type: DataTypes.STRING,
    allowNull: true,
  },

// agregar esto a la base de dato 
  esAdmin: {
  type: DataTypes.BOOLEAN,
  defaultValue: false,
},

}, {
  tableName: 'uUsuariosNegocio', // opcional, para que no cambie el nombre
});

module.exports = uUsuariosNegocio;
