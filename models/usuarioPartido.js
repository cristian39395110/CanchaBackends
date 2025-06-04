//models/usuarioPartido
const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');
const UsuarioPartido = sequelize.define('UsuarioPartido', {
  UsuarioId: {  // mayúscula U
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'Usuarios',
      key: 'id'
    }
  },
  PartidoId: {  // mayúscula P
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'Partidos',
      key: 'id'
    }
  },
  estado: {
    type: DataTypes.STRING,
    defaultValue: 'pendiente'
  }
}, {
  timestamps: false,
  id: false
});


module.exports = UsuarioPartido;
