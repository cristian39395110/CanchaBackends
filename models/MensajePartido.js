const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MensajePartido = sequelize.define('MensajePartido', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  partidoId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: true // ✅ Para mensajes del sistema (tipo "Juan se unió")
  },
  mensaje: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  tipo: {
    type: DataTypes.ENUM('texto', 'sistema', 'imagen'),
    defaultValue: 'texto'
  },
  leido: {
  type: DataTypes.BOOLEAN,
  defaultValue: false
},

  frontendId: {
  type: DataTypes.STRING,
  allowNull: true,
  unique: true  // Previene duplicados
}

}, {
  timestamps: true
});

module.exports = MensajePartido;
