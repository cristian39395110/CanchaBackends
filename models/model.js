//models/model.js

const Usuario = require('./usuario');
const Deporte = require('./deporte');
const Partido = require('./partido');
const Suscripcion = require('./Suscripcion');
const UsuarioDeporte = require('./usuarioDeporte');
const UsuarioPartido = require('./usuarioPartido');
const HistorialPuntuacion = require('./historialPuntuacion'); // Importa el modelo
const Mensaje = require('./Mensaje');
const Publicacion = require('./publicacion');
const Amistad = require('./amistad');
const Comentario = require('./Comentario');
const Like = require('./Like');
const Bloqueo = require('./Bloqueo');
const Cancha = require('./cancha');
const MensajePartido = require('./MensajePartido');
const PublicacionLeida = require('./publicacionLeida');
const envioNotificacion = require('./envioNotificacion');
const MensajePartidoLeido = require('./MensajePartidoLeido');
const Historia = require('./Historia');
const HistoriaVisto = require('./HistoriaVisto');

// === Historias (24 h) ===
Usuario.hasMany(Historia, { foreignKey: 'usuarioId', as: 'Historias' });
Historia.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'Usuario' });

// === Vistas de historias (únicas) ===
Historia.hasMany(HistoriaVisto, { foreignKey: 'historiaId', as: 'Vistos' });
HistoriaVisto.belongsTo(Historia, { foreignKey: 'historiaId' });

Usuario.hasMany(HistoriaVisto, { foreignKey: 'usuarioId', as: 'HistoriasVistas' });
HistoriaVisto.belongsTo(Usuario, { foreignKey: 'usuarioId' });

MensajePartidoLeido.belongsTo(MensajePartido, {
  foreignKey: 'mensajePartidoId',
  as: 'mensajePartido'
});
MensajePartidoLeido.belongsTo(Usuario, { foreignKey: 'usuarioId' });

MensajePartido.hasMany(MensajePartidoLeido, {
  foreignKey: 'mensajePartidoId',
  as: 'leidos'
});
Usuario.hasMany(MensajePartidoLeido, { foreignKey: 'usuarioId' });

// 🔔 Relaciones de envioNotificacion

// La notificación pertenece al usuario receptor
envioNotificacion.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'receptor' });

// La notificación también pertenece al emisor (quien generó la notificación)
envioNotificacion.belongsTo(Usuario, { foreignKey: 'emisorId', as: 'emisor' });

// Relación opcional con publicación si es una notificación relacionada
envioNotificacion.belongsTo(Publicacion, { foreignKey: 'publicacionId' });

Usuario.hasMany(envioNotificacion, { foreignKey: 'usuarioId', as: 'notificacionesRecibidas' });
Usuario.hasMany(envioNotificacion, { foreignKey: 'emisorId', as: 'notificacionesEnviadas' });
Publicacion.hasMany(envioNotificacion, { foreignKey: 'publicacionId' });



Publicacion.hasMany(PublicacionLeida, { foreignKey: 'publicacionId' });

// En Usuario.js
Usuario.hasMany(PublicacionLeida, { foreignKey: 'usuarioId' });



MensajePartido.belongsTo(Usuario, { foreignKey: 'usuarioId' });
MensajePartido.belongsTo(Partido, { foreignKey: 'partidoId' });

Usuario.hasMany(MensajePartido, { foreignKey: 'usuarioId' });
Partido.hasMany(MensajePartido, { foreignKey: 'partidoId' });


Partido.belongsTo(Cancha, { foreignKey: 'canchaId' });
Cancha.hasMany(Partido, { foreignKey: 'canchaId' });


Usuario.hasMany(Bloqueo, { foreignKey: 'usuarioId' });


UsuarioDeporte.belongsTo(Deporte, { foreignKey: 'deporteId', as: 'deporte' });
Amistad.belongsTo(Usuario, { as: 'emisor', foreignKey: 'usuarioId' });

Amistad.belongsTo(Usuario, { as: 'Usuario', foreignKey: 'usuarioId' });
Amistad.belongsTo(Usuario, { as: 'Amigo', foreignKey: 'amigoId' });
Usuario.hasMany(Amistad, { as: 'SolicitudesEnviadas', foreignKey: 'usuarioId' });
Usuario.hasMany(Amistad, { as: 'SolicitudesRecibidas', foreignKey: 'amigoId' });


// Relaciones
Publicacion.belongsTo(Usuario, { foreignKey: 'usuarioId' });
Publicacion.hasMany(Comentario, { foreignKey: 'publicacionId' });
Publicacion.hasMany(Like, { foreignKey: 'publicacionId' });

Comentario.belongsTo(Publicacion, { foreignKey: 'publicacionId' });
Comentario.belongsTo(Usuario, { foreignKey: 'usuarioId' });

Like.belongsTo(Publicacion, { foreignKey: 'publicacionId' });
Like.belongsTo(Usuario, { foreignKey: 'usuarioId' });

Usuario.belongsToMany(Usuario, {
  as: 'Amigos',
  through: Amistad,
  foreignKey: 'usuarioId',
  otherKey: 'amigoId'
});


// ...

Mensaje.belongsTo(Usuario, { as: 'emisor', foreignKey: 'emisorId' });
Mensaje.belongsTo(Usuario, { as: 'receptor', foreignKey: 'receptorId' });

// Asociaciones
// HistorialPuntuacion - Relaciones claras
Usuario.hasMany(HistorialPuntuacion, { foreignKey: 'usuarioId', as: 'CalificacionesRealizadas' });
Usuario.hasMany(HistorialPuntuacion, { foreignKey: 'puntuadoId', as: 'CalificacionesRecibidas' });

HistorialPuntuacion.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'Calificador' });
HistorialPuntuacion.belongsTo(Usuario, { foreignKey: 'puntuadoId', as: 'Calificado' });

// Asociaciones
Deporte.hasMany(Partido, { foreignKey: 'deporteId' });
Partido.belongsTo(Deporte, { foreignKey: 'deporteId' });

Usuario.hasMany(Partido, { as: 'partidosOrganizados', foreignKey: 'organizadorId' });
Partido.belongsTo(Usuario, { as: 'organizador', foreignKey: 'organizadorId' });

Usuario.hasMany(Suscripcion, { foreignKey: 'usuarioId' });
Suscripcion.belongsTo(Usuario, { foreignKey: 'usuarioId' });

Usuario.belongsToMany(Deporte, { through: UsuarioDeporte, foreignKey: 'usuarioId' });
Deporte.belongsToMany(Usuario, { through: UsuarioDeporte, foreignKey: 'deporteId' });

Usuario.belongsToMany(Partido, { through: UsuarioPartido });
Partido.belongsToMany(Usuario, { through: UsuarioPartido });

UsuarioDeporte.belongsTo(Usuario, { foreignKey: 'usuarioId' });
UsuarioDeporte.belongsTo(Deporte, { foreignKey: 'deporteId' });

Usuario.hasMany(UsuarioDeporte, { foreignKey: 'usuarioId' });
Deporte.hasMany(UsuarioDeporte, { foreignKey: 'deporteId' });

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
  HistorialPuntuacion,
  Publicacion,
  Comentario,
  Like,
  Amistad,
  Bloqueo,
  Cancha ,
  MensajePartido,
  PublicacionLeida,
  Historia,
  HistoriaVisto,
  MensajePartidoLeido,
  envioNotificacion
};
