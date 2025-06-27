// models/publicacion.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Publicacion = sequelize.define('Publicacion', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  contenido: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  foto: {
    type: DataTypes.STRING,
    allowNull: true // puede no tener imagen
  },
  esPublica: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  updatedAt: false
});

module.exports = Publicacion;
