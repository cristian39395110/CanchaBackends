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
  timestamps: false
});
/*
// Definir la relación
Suscripcion.belongsTo(Usuario, { foreignKey: 'usuarioId' });
Usuario.hasMany(Suscripcion, { foreignKey: 'usuarioId' });


*/
module.exports = Suscripcion;
