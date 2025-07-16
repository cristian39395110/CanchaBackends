const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Partido = sequelize.define('Partido', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  fecha: { type: DataTypes.DATEONLY, allowNull: false },
  hora: { type: DataTypes.TIME, allowNull: false },
  lugar: { type: DataTypes.STRING, allowNull: false },
  nombre: { type: DataTypes.STRING, allowNull: false },
  rechazoDisponible: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  localidad: { type: DataTypes.STRING, allowNull: false },
  latitud: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  longitud: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  cantidadJugadores: { type: DataTypes.INTEGER, allowNull: false },
  deporteId: { type: DataTypes.INTEGER, allowNull: true },
  organizadorId: { type: DataTypes.INTEGER, allowNull: true },
  sexo: {
  type: DataTypes.STRING,
  defaultValue: 'todos'
},
rangoEdad: {
   type: DataTypes.JSON,
   defaultValue: []
},
  // 🆕 Campos nuevos para integrar cancha
  canchaId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Canchas',
      key: 'id'
    }
  },
  ubicacionManual: {
  type: DataTypes.BOOLEAN,
  defaultValue: false,
},
  canchaNombreManual: {
    type: DataTypes.STRING,
    allowNull: true
  },
  categorias: {
  type: DataTypes.JSON, // o TEXT si usás SQLite
  allowNull: true,
  defaultValue: []
}

  

}, {
  timestamps: true
});

module.exports = Partido;
