const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Partido = sequelize.define('Partido', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  fecha: { type: DataTypes.DATEONLY, allowNull: false },
  hora: { type: DataTypes.TIME, allowNull: false },
  lugar: { type: DataTypes.STRING, allowNull: false }, // dirección o nombre lugar
   nombre: { type: DataTypes.STRING, allowNull: false },
  localidad: { type: DataTypes.STRING, allowNull: false }, // ciudad o localidad ej: "San Luis, Buenos Aires"
  latitud: { type: DataTypes.DECIMAL(10, 7), allowNull: true },  // opcional para mapa
  longitud: { type: DataTypes.DECIMAL(10, 7), allowNull: true }, // opcional para mapa
  cantidadJugadores: { type: DataTypes.STRING, allowNull: false },
  deporteId: { type: DataTypes.INTEGER, allowNull: true },  // FK a deporte (opcional según tu modelo)
  organizadorId: { type: DataTypes.INTEGER, allowNull: true }, // FK a usuario organizador
}, {
  timestamps: true
});

module.exports = Partido;
