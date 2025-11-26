// models/uUsuariosNegocio.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const uUsuariosNegocio = sequelize.define(
  'uUsuariosNegocio',
  {
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    provincia: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    localidad: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    puntos: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    esPremium: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // 🔐 verificación
    tokenVerificacion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    verificado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    deviceId: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // 👑 para distinguir el admin del resto
    esAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // 🖼️ FOTO DE PERFIL (igual que en MatchClub)
    fotoPerfil: {
      type: DataTypes.STRING, // URL de Cloudinary
      allowNull: true,
    },
    cloudinaryId: {
      type: DataTypes.STRING, // public_id de Cloudinary
      allowNull: true,
    },
      fechaInicioPremium: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    fechaFinPremium: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'uUsuariosNegocio',
  }
);

module.exports = uUsuariosNegocio;
