const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const uNegocio = sequelize.define('Negocio', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  rubro: {
    type: DataTypes.STRING, // Ej: almacén, ropa, comidas
    allowNull: true,
  },
  provincia: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  localidad: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  latitud: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  longitud: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  puntosPorCompra: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  plan: {
    type: DataTypes.STRING,
    defaultValue: 'basico', // o 'premium'
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: true, // FK hacia UsuariosNegocio
  },
  puntosMes: {
  type: DataTypes.INTEGER,
  defaultValue: 0,
},

});

module.exports = uNegocio;
