import { DataTypes } from 'sequelize';
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
  }
}, {
  timestamps: true
});

export default MensajePartido;
