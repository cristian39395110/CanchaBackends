const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RubroNegocio = sequelize.define('RubroNegocio', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  icono: {
    type: DataTypes.STRING,
    allowNull: true, // url o nombre de icono
  },
  orden: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  }
}, {
  tableName: 'rubros_negocio'
});

module.exports = RubroNegocio;
