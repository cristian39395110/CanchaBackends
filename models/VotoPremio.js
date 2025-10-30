// models/VotoPremio.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VotoPremio = sequelize.define('VotoPremio', {
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  candidatoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  // 👇 cada voto pertenece a un concurso concreto
  concursoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'votopremios',
  timestamps: true, // opcional: para saber cuándo votó
  indexes: [
    // 🔒 evita que el mismo usuario vote más de una vez por concurso
    { unique: true, fields: ['usuarioId', 'concursoId'] },

    // 🔍 ayuda a buscar rápido todos los votos de un concurso
    { fields: ['concursoId'] },
  ],
});

module.exports = VotoPremio;
