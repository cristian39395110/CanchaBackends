// models/Reto.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Reto = sequelize.define('Reto', {
  titulo: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // models/Reto.js
// models/Reto.js
provincia: {
  type: DataTypes.STRING,
  allowNull: true,   // ✅ ahora acepta null para retos nacionales
},


localidad: {
  type: DataTypes.STRING,
  allowNull: true,
},


  // 🔢 Puntos que otorga el reto al completarlo
  puntos: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },

  /**
   * Tipo de reto:
   * - 'visitas'             → visitar/comprar en X negocios
   * - 'movimiento_distancia'→ caminar/trotar/bici X metros
   * - 'puntos'              → acumular X puntos en un rango de días
   * - 'destino_unico'       → ir a un punto específico (lat/lng)
   * - 'general'             → reto libre/manual
   */
  tipo: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'general',
  },

  /**
   * Meta numérica según el tipo:
   * - visitas:  cantidad de locales/visitas (ej: 3 negocios)
   * - movimiento_distancia: metros totales (ej: 3000 = 3 km)
   * - puntos:  cantidad de puntos a acumular
   * - destino_unico: normalmente 1 (ir 1 vez al lugar)
   */
  meta: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  /**
   * Rango de días para cumplir el reto (rolling window)
   * Ej:
   *  - 1  → últimas 24 hs
   *  - 7  → última semana
   *  - 30 → último mes
   */
  rangoDias: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  // 🧭 Coordenadas para retos tipo "destino_unico"
  destinoLatitud: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true, // solo aplica si tipo === 'destino_unico'
  },

  destinoLongitud: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },

  /**
   * Radio de aceptación en metros alrededor del punto destino.
   * Ej: 100 → el usuario tiene que estar dentro de un círculo de 100m.
   */
  destinoRadioMetros: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  // ✅ Si el reto está disponible o ya no
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },

  // Para controlar versiones de retos
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
});

module.exports = Reto;
  