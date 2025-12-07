const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AlertasSupervisor = sequelize.define(
  "AlertasSupervisor",
  {
    supervisorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    vendedorId: {
      type: DataTypes.INTEGER,
      allowNull: true, // opcional si la alerta no es por un vendedor
    },

    tipo: {
      type: DataTypes.ENUM(
        "vendedor_bloqueado",
        "vendedor_solicita_baja",
        "venta_sospechosa",
        "faltan_pagos",
        "otro"
      ),
      allowNull: false,
    },

    mensaje: {
      type: DataTypes.STRING,
      allowNull: false,
    },
observacion: {
  type: DataTypes.TEXT,
  allowNull: true,
},

    leida: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "alertas_supervisor",
  }
);

module.exports = AlertasSupervisor;
