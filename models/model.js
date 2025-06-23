const Usuario = require('./usuario');
const Deporte = require('./deporte');
const Partido = require('./partido');
const Suscripcion = require('./Suscripcion');
const UsuarioDeporte = require('./usuarioDeporte');
const UsuarioPartido = require('./usuarioPartido');
const HistorialPuntuacion = require('./historialPuntuacion');
const Mensaje = require('./Mensaje');

// 📩 Mensajes
Mensaje.belongsTo(Usuario, { as: 'emisor', foreignKey: 'emisorId' });
Mensaje.belongsTo(Usuario, { as: 'receptor', foreignKey: 'receptorId' });

// 🎯 Asociación HistorialPuntuacion (con nombres únicos para evitar conflictos)
Usuario.hasMany(HistorialPuntuacion, {
  foreignKey: { name: 'usuarioId', allowNull: false }
});
HistorialPuntuacion.belongsTo(Usuario, {
  foreignKey: { name: 'usuarioId', allowNull: false }
});

Partido.hasMany(HistorialPuntuacion, {
  foreignKey: { name: 'partidoId', allowNull: false }
});
HistorialPuntuacion.belongsTo(Partido, {
  foreignKey: { name: 'partidoId', allowNull: false }
});

Usuario.hasMany(HistorialPuntuacion, {
  foreignKey: { name: 'puntuadoId', allowNull: false },
  as: 'puntuado'
});
HistorialPuntuacion.belongsTo(Usuario, {
  foreignKey: { name: 'puntuadoId', allowNull: false },
  as: 'puntuado'
});

// 🏅 Partido y Deporte
Deporte.hasMany(Partido, { foreignKey: 'deporteId' });
Partido.belongsTo(Deporte, { foreignKey: 'deporteId' });

Usuario.hasMany(Partido, { as: 'partidosOrganizados', foreignKey: 'organizadorId' });
Partido.belongsTo(Usuario, { as: 'organizador', foreignKey: 'organizadorId' });

// 🔔 Suscripciones
Usuario.hasMany(Suscripcion, { foreignKey: 'usuarioId' });
Suscripcion.belongsTo(Usuario, { foreignKey: 'usuarioId' });

// ⚽ Usuario y Deporte (preferencias)
Usuario.belongsToMany(Deporte, { through: UsuarioDeporte, foreignKey: 'usuarioId' });
Deporte.belongsToMany(Usuario, { through: UsuarioDeporte, foreignKey: 'deporteId' });

UsuarioDeporte.belongsTo(Usuario, { foreignKey: 'usuarioId' });
UsuarioDeporte.belongsTo(Deporte, { foreignKey: 'deporteId' });

Usuario.hasMany(UsuarioDeporte, { foreignKey: 'usuarioId' });
Deporte.hasMany(UsuarioDeporte, { foreignKey: 'deporteId' });

// 🎮 Usuario y Partido (jugadores)
Usuario.belongsToMany(Partido, { through: UsuarioPartido });
Partido.belongsToMany(Usuario, { through: UsuarioPartido });

UsuarioPartido.belongsTo(Usuario, { foreignKey: 'UsuarioId' });
Usuario.hasMany(UsuarioPartido, { foreignKey: 'UsuarioId' });

UsuarioPartido.belongsTo(Partido, { foreignKey: 'PartidoId' });
Partido.hasMany(UsuarioPartido, { foreignKey: 'PartidoId' });

module.exports = {
  Usuario,
  Deporte,
  Partido,
  Suscripcion,
  UsuarioDeporte,
  UsuarioPartido,
  Mensaje,
  HistorialPuntuacion
};
