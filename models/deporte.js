const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { Usuario, Partido, Suscripcion, UsuarioDeporte, UsuarioPartido } = require('../models');


const Deporte = sequelize.define('Deporte', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  imagen: {
    type: DataTypes.STRING, // Solo guardamos el nombre del archivo
    allowNull: true,
  },
    categoria: {
    type: DataTypes.ENUM('barato', 'estandar', 'caro'),
    allowNull: false,
    defaultValue: 'estandar'
  }
});

module.exports = Deporte;
