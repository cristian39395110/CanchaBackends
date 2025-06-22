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
  },
  nivel: {
    type: DataTypes.ENUM('amateur', 'medio', 'alto', 'pro'),
    allowNull: false,
    defaultValue: 'amateur'
  }
}, {
  timestamps: false
});

module.exports = UsuarioDeporte;
