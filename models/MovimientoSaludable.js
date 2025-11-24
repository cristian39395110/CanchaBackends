const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MovimientoSaludable = sequelize.define('MovimientoSaludable', {

  usuarioNegocioId: {
    type: DataTypes.INTEGER,
    allowNull: false, // FK a uUsuariosNegocio
  },

  fechaInicio: {
    type: DataTypes.DATE,
    allowNull: false,
  },

  fechaFin: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  distanciaMetros: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },

  duracionSegundos: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },

  velocidadMediaMps: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true,
  },

  pasosEstimados: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  tipoActividad: {
    type: DataTypes.ENUM('caminar', 'trotar', 'bici', 'desconocido'),
    defaultValue: 'desconocido',
  },

  esValido: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,     // si va demasiado rápido → false
  },

  motivoInvalido: {
    type: DataTypes.STRING,
    allowNull: true,        // ej: "velocidad muy alta"
  },

  procesadoPuntos: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,    // para no sumar puntos dos veces
  },

}, {
  tableName: 'MovimientoSaludable',
  timestamps: true,
});

module.exports = MovimientoSaludable;
