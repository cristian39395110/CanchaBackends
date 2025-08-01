// models/usuario.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Usuario = sequelize.define('Usuario', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  telefono: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: false
  },
  esAdmin: {
  type: DataTypes.BOOLEAN,
  defaultValue: false
},
    localidad: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: false
  },
   premium: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  puntuacion: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10
  },
  fotoPerfil: {
  type: DataTypes.STRING,
  allowNull: true
  },
  cloudinaryId: {
  type: DataTypes.STRING,
  allowNull: true
},
  verificado: {
  type: DataTypes.BOOLEAN,
  defaultValue: false
},
tokenVerificacion: {
  type: DataTypes.STRING,
  allowNull: true
},
   latitud: { 
    type: DataTypes.DECIMAL(10, 7), 
    allowNull: true 
  },  // opcional para mapa
  longitud: { 
    type: DataTypes.DECIMAL(10, 7),
     allowNull: true 
    },
    partidosJugados: {
  type: DataTypes.INTEGER,
  defaultValue: 0,
},
suspensionHasta: {
  type: DataTypes.DATE,
  allowNull: true,
},
sexo: {
  type: DataTypes.ENUM('masculino', 'femenino'),
  allowNull: false
},
edad: {
  type: DataTypes.INTEGER,
  allowNull: false
},
deviceId: {
  type: DataTypes.STRING,
  allowNull: true
},
ultimoCambioDevice: {
  type: DataTypes.DATE,
  allowNull: true,
},

      perfilPublico: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  } // opcional para mapa
});

module.exports = Usuario;
