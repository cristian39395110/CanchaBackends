const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Like = sequelize.define('Like', {
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  publicacionId: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['usuarioId', 'publicacionId']
    }
  ]
});

module.exports = Like;
