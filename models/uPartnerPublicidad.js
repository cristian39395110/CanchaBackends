// models/PartnerPublicidad.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PartnerPublicidad = sequelize.define(
  "PartnerPublicidad",
  {
    negocioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    titulo: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    imagen: {
      type: DataTypes.STRING,
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

    lat: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    lng: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },

    badge: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    esDestacadoMes: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // ✅ IMPORTANTE: debe empezar apagado
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    prioridad: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    duracionSemanas: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    fechaInicio: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    fechaFin: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    montoCobrado: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    estadoPago: {
      type: DataTypes.ENUM("pendiente", "aprobado", "rechazado"),
      defaultValue: "pendiente",
    },

    // ✅ trazabilidad
    paymentId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    externalReference: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "partner_publicidades",
  }
);

module.exports = PartnerPublicidad;
