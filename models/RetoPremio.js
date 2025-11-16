// models/RetoPremio.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RetoPremio = sequelize.define('RetoPremio', {
  retoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  puesto: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  monto: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  timestamps: true,
  tableName: 'RetoPremios',
  indexes: [
    { unique: true, fields: ['retoId', 'puesto'] },
  ],
});

module.exports = RetoPremio;
