const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const uCheckinNegocio = sequelize.define('CheckinNegocio', {
  usuarioNegocioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  negocioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  qrId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  puntosGanados: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  latitudUsuario: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  longitudUsuario: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  fecha: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

module.exports = uCheckinNegocio;
