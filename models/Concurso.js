const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Concurso = sequelize.define('Concurso', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Concurso mensual',
  },

  // si este concurso es el que está corriendo AHORA (sumando puntos, aceptando votos)
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },

  // rango visible de la ronda
  fechaInicio: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  fechaFin: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  /**
   * premiosJSON:
   * [{ puesto:1, monto:200000 }, { puesto:2, monto:100000 }, ...]
   * Estos son LOS premios que se juegan en ESTE concurso.
   * Se definen al crear el concurso y no cambian.
   */
  premiosJSON: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const raw = this.getDataValue('premiosJSON');
      try {
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },
    set(value) {
      const safe = Array.isArray(value)
        ? value.map(p => ({
            puesto: Number(p.puesto),
            monto: Number(p.monto),
          }))
        : [];
      this.setDataValue('premiosJSON', JSON.stringify(safe));
    },
  },
   visiblePublico: {
    type: DataTypes.BOOLEAN,
    defaultValue: true, // cuando lo creás se ve
  },

  /**
   * ganadoresJSON:
   * Se completa SOLO cuando se cierra el concurso.
   * [
   *   {
   *     usuarioId,
   *     nombre,
   *     fotoPerfil,
   *     puntos,   // puntos finales que tenía
   *     votos,    // votos recibidos
   *     puesto,   // 1,2,3,...
   *     premio,   // $ que le tocó según premiosJSON
   *   },
   *   ...
   * ]
   */
  ganadoresJSON: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const raw = this.getDataValue('ganadoresJSON');
      try {
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },
    set(value) {
      const safe = Array.isArray(value) ? value : [];
      this.setDataValue('ganadoresJSON', JSON.stringify(safe));
    },
  },

}, {
  tableName: 'concursos',
  timestamps: true,
});

module.exports = Concurso;
