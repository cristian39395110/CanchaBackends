const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const LiquidacionVendedor = sequelize.define("LiquidacionVendedor", {
  vendedorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  fechaDesde: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  fechaHasta: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  totalVentas: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  totalComision: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  pagado: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  fechaPago: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  pagadoPorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  }
}, {
  tableName: "liquidaciones_vendedor",
});

module.exports = LiquidacionVendedor;
