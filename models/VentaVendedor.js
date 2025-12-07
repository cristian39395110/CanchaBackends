const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const VentaVendedor = sequelize.define("VentaVendedor", {
  vendedorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  negocioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  fechaVenta: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  comision: {
    type: DataTypes.INTEGER,
    defaultValue: 15000,
  },
  pagado: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  fechaPago: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  liquidacionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  // -- SUPERVISOR --
  comisionSupervisor: {
    type: DataTypes.INTEGER,
    defaultValue: 5000,
  },
  pagadoSupervisor: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  fechaPagoSupervisor: {
    type: DataTypes.DATE,
    allowNull: true,
  },

}, {
  tableName: "ventas_vendedor",
});

module.exports = VentaVendedor;
