const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Amistad = sequelize.define('Amistad', {
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  amigoId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  estado: {
    type: DataTypes.STRING,
    defaultValue: 'pendiente'
  }
}, {
  tableName: 'amistads', // 👈 esto es clave
  timestamps: false
});


module.exports = Amistad;


