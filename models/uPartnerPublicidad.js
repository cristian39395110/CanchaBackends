// models/PartnerPublicidad.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PartnerPublicidad = sequelize.define(
  'PartnerPublicidad',
  {
    // 🔗 A qué usuario-negocio pertenece la campaña
    // (puede ser FK a uUsuariosNegocio)
    negocioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // Datos visuales de la campaña
    titulo: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    imagen: {
      type: DataTypes.STRING, // URL Cloudinary
      allowNull: true,
    },
    urlWeb: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    whatsapp: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // Ubicación opcional
    lat: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    lng: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },

    // Cosas de UI
    badge: {
      type: DataTypes.STRING,
      allowNull: true, // ej: "Partner", "Destacado", etc.
    },
    esDestacadoMes: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    prioridad: {
      type: DataTypes.INTEGER,
      defaultValue: 0, // para ordenar el carrusel
    },

    // 🔥 NUEVO: duración de la campaña
    duracionSemanas: {
      type: DataTypes.INTEGER,
      allowNull: false, // ej: 3, 6, 8
    },

    fechaInicio: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    fechaFin: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    // 💰 NUEVO: cuánto se cobró por esta campaña en particular
    montoCobrado: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    // 💳 NUEVO: estado del pago (MercadoPago)
    estadoPago: {
      type: DataTypes.ENUM('pendiente', 'aprobado', 'rechazado'),
      defaultValue: 'pendiente',
    },
  },
  {
    tableName: 'partner_publicidades',
  }
);

module.exports = PartnerPublicidad;
