const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Mensaje = sequelize.define('Mensaje', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  emisorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  receptorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  contenido: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  leido: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  frontendId: {
  type: DataTypes.STRING,
  allowNull: true, // opcional por compatibilidad
  unique: true     // ⚠️ importante para evitar duplicados
}
});
module.exports = Mensaje;
