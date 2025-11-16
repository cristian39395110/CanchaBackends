// config/mercadopago.js
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

module.exports = {
  mpClient,
  Preference,
  Payment,
};
