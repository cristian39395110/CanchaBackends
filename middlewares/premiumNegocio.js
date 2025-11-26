// middlewares/premiumNegocio.js
const { uUsuariosNegocio } = require("../models/model"); 
// O el nombre que uses en model.js (uUsuarioNegocio / uUsuariosNegocio)

async function actualizarEstadoPremiumNegocio(req, res, next) {
  try {
    const negocio = req.negocio; // esto lo llena autenticarTokenNegocio

    // Si no hay negocio en el request, seguimos de largo
    if (!negocio) {
      return next();
    }

    // Si NO es premium o no tiene fechaFinPremium, no hay nada que hacer
    if (!negocio.esPremium || !negocio.fechaFinPremium) {
      return next();
    }

    const hoy = new Date();
    const fechaFin = new Date(negocio.fechaFinPremium);

    // Si ya se venció el premium
    if (hoy > fechaFin) {
      console.log(
        `⛔ Premium vencido para usuarioNegocioId=${negocio.id} (fin=${fechaFin.toISOString()})`
      );

      // Actualizamos en la base
      await uUsuariosNegocio.update(
        { esPremium: false },
        { where: { id: negocio.id } }
      );

      // Y también en el objeto que viaja en el request
      negocio.esPremium = false;
      req.negocio = negocio;
    }

    return next();
  } catch (err) {
    console.error("❌ Error en actualizarEstadoPremiumNegocio:", err);
    // No lo bloqueamos, dejamos continuar para no romper el sistema
    return next();
  }
}

module.exports = {
  actualizarEstadoPremiumNegocio,
};
