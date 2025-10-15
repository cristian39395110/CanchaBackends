const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HistoriaComentario = sequelize.define('HistoriaComentario', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  historiaId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  contenido: {
    type: DataTypes.STRING(600),
    allowNull: false,
  },
}, {
  tableName: 'HistoriaComentarios',
  timestamps: true, // crea createdAt y updatedAt automáticamente
});

module.exports = HistoriaComentario;
