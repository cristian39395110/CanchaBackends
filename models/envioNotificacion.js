const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const envioNotificacion = sequelize.define('envioNotificacion', {
 
    usuarioId: DataTypes.INTEGER, // a quién le llega
    emisorId: DataTypes.INTEGER,  // quién la generó
    tipo: DataTypes.STRING,       // 'comentario', 'solicitud', 'aceptado'
    mensaje: DataTypes.STRING,
    fotoEmisor: DataTypes.STRING,
    publicacionId: DataTypes.INTEGER,
    leida: { type: DataTypes.BOOLEAN, defaultValue: false }
  });
 

module.exports = envioNotificacion;