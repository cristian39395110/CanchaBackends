// models/MensajePartido.ts
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
    allowNull: false
  },
  mensaje: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  timestamps: true
});

export default MensajePartido;
