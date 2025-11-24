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
   rubroId: {
    type: DataTypes.INTEGER,
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
  planId: {
  type: DataTypes.INTEGER,
  allowNull: false,
  defaultValue: 1, // arranca con el básico
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
  foto: {
    type: DataTypes.STRING,
    allowNull: true,
  },

});

module.exports = uNegocio;
