const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Concurso = require('./Concurso'); // tu modelo Concurso
const Usuario = require('./usuario');   // tu modelo Usuario

const SorteoHistorico = sequelize.define('SorteoHistorico', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  // por si más adelante hay más de un concurso (ej: mensual, navidad, etc)
  concursoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Concurso,
      key: 'id',
    },
    onDelete: 'CASCADE',
  },

  // cuándo se cerró este sorteo
  fechaCierre: {
    type: DataTypes.DATE,
    allowNull: false,
  },

  // lista de ganadores ya calculada en ese momento
  // ejemplo:
  // [
  //   { puesto:1, usuarioId:12, nombre:"Juan", premio:200000, puntos:480, fotoPerfil:"..." },
  //   { puesto:2, usuarioId:33, nombre:"María", premio:100000, ... },
  //   ...
  // ]
  ganadores: {
    type: DataTypes.JSON,
    allowNull: false,
  },

  // copia de la tabla de premios usada (para saber cuánto pagaba cada puesto en ese sorteo)
  // ejemplo:
  // [
  //   { puesto:1, monto:200000 },
  //   { puesto:2, monto:100000 },
  //   { puesto:3, monto:50000 }
  // ]
  premios: {
    type: DataTypes.JSON,
    allowNull: true,
  },

  // quién apretó "publicar ganadores"
  creadoPorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Usuario,
      key: 'id',
    },
    onDelete: 'SET NULL',
  },
}, {
  tableName: 'SorteosHistoricos',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false,
});



module.exports = SorteoHistorico;
