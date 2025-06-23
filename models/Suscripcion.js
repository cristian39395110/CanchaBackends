  // models/suscripcion.js
  const sequelize = require('../config/database');
  const { DataTypes } = require('sequelize');

  const { Usuario, Deporte, Partido, UsuarioDeporte, UsuarioPartido } = require('../models');

const Suscripcion = sequelize.define('Suscripcion', {
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  fcmToken: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'Suscripcions', // 👈 obligatorio para que no busque otro nombre
  timestamps: false
});


module.exports = Suscripcion;
