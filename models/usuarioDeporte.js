// models/usuarioDeporte.js
const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

const Usuario = require('./usuario');
const Deporte = require('./deporte');

const UsuarioDeporte = sequelize.define('UsuarioDeporte', {
  usuarioId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'Usuarios',
      key: 'id'
    }
  },
  deporteId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'Deportes',
      key: 'id'
    }
  },
  localidad: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  timestamps: false,
  // id: false  // opcional quitar para que Sequelize cree una PK automática o
  // si quieres que la PK sea compuesta por usuarioId + deporteId + localidad:
  primaryKey: true
});

// Nota: Sequelize no soporta bien claves primarias compuestas que incluyan más de dos columnas sin usar opciones avanzadas,
// podrías manejar una clave primaria simple con un id autoincremental y poner un índice único compuesto
// o manejar validaciones en código para evitar duplicados.

module.exports = UsuarioDeporte;
