const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MensajePartidoLeido = sequelize.define('MensajePartidoLeido', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  mensajePartidoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'MensajePartidos', // nombre de la tabla real en la base de datos
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['mensajePartidoId', 'usuarioId'] // para evitar duplicados
    }
  ]
});

module.exports = MensajePartidoLeido;
