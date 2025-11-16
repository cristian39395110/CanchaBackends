const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const uQRCompraNegocio = sequelize.define('QRCompraNegocio', {
  negocioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  codigoQR: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  puntosOtorga: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  usado: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  fechaEmision: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  fechaExpiracion: {
    type: DataTypes.DATE,
    allowNull: true,
  },
    modo: {
    type: DataTypes.ENUM('compra', 'dia'),
    defaultValue: 'dia', // 👈 Por defecto QR reutilizable diario
  },
});


module.exports = uQRCompraNegocio;
