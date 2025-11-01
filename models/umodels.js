/* ===========================
   NUEVO MÓDULO: NEGOCIOS Y PUNTOS
   =========================== */

const uUsuarioNegocio = require('./uUsuariosNegocio');
const uNegocio = require('./uNegocio');
const uQRCompraNegocio = require('./uQRCompraNegocio');
const uCheckinNegocio = require('./uCheckinNegocio');
const uConcursoNegocio = require('./uConcursosNegocio');

/* ===========================
   RELACIONES
   =========================== */

// Negocios ↔ UsuariosNegocio (dueño)
uNegocio.belongsTo(uUsuarioNegocio, { foreignKey: 'ownerId', as: 'duenio' });

// QR ↔ Negocio
uQRCompraNegocio.belongsTo(uNegocio, { foreignKey: 'negocioId' });

// Checkin ↔ Usuario / Negocio / QR
uCheckinNegocio.belongsTo(uUsuarioNegocio, { foreignKey: 'usuarioNegocioId' });
uCheckinNegocio.belongsTo(uNegocio, { foreignKey: 'negocioId' });
uCheckinNegocio.belongsTo(uQRCompraNegocio, { foreignKey: 'qrId' });

// Concursos ↔ Negocio (si querés que cada negocio tenga su concurso)
uConcursoNegocio.belongsTo(uNegocio, { foreignKey: 'negocioId', as: 'negocio' });
uNegocio.hasMany(uConcursoNegocio, { foreignKey: 'negocioId', as: 'concursos' });

/* ===========================
   EXPORTS
   =========================== */
module.exports = {
  uUsuarioNegocio,
  uNegocio,
  uQRCompraNegocio,
  uCheckinNegocio,
  uConcursoNegocio,
};
