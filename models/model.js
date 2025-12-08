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
const HistoriaComentario = require('./HistoriaComentario');
const HistoriaLike = require('./HistoriaLike');
const QREmision = require('./QREmision');
const QRCheckin = require('./QRCheckin');
const Concurso = require('./Concurso');
const VotoPremio = require('./VotoPremio');
const SorteoHistorico = require('./SorteoHistorico');
// ... tus requires existentes
const SorteoConfig = require('./SorteoConfig'); // <-- NUEVO

const Ganador = require('./uGanador');
const RetoParticipante = require('./RetoParticipante');
const RetoGanador = require('./RetoGanador');
const RetoPremio = require('./RetoPremio');
const RetoGanadorHist = require('./RetoGanadorHist');
const RetoGanadorHistDet = require('./RetoGanadorHistDet');



   

const uUsuarioNegocio = require('./uUsuariosNegocio');
const uNegocio = require('./uNegocio');
const uQRCompraNegocio = require('./uQRCompraNegocio');
const uCheckinNegocio = require('./uCheckinNegocio');
const uConcursoNegocio = require('./uConcursosNegocio');

const uPromoNegocio = require('./uPromoNegocio');


const TarifaPublicidad = require('./uTarifaPublicidad');




const PremiumOrden = require('./PremiumOrden');

const uUsuariosNegocio = require('./uUsuariosNegocio');
const PlanNegocio = require('./PlanNegocio');

const PartnerPublicidad = require('./uPartnerPublicidad');

const RubroNegocio = require('./RubroNegocio');


const ParteTecnica = require('./ParteTecnica');

const VentaVendedor = require('./VentaVendedor');
const LiquidacionVendedor = require('./LiquidacionVendedor');

const AlertasSupervisor = require('./AlertasSupervisor');
const SorteoMensualProvincia = require('./SorteoMensualProvincia');


Ganador.belongsTo(uUsuarioNegocio, {
  foreignKey: 'usuarioId',
  as: 'Usuario',
});

uUsuarioNegocio.hasMany(Ganador, {
  foreignKey: 'usuarioId',
  as: 'ganadoresSorteo',
});


// ... después de definir uUsuarioNegocio y antes del module.exports

SorteoMensualProvincia.belongsTo(uUsuarioNegocio, {
  foreignKey: 'usuarioId',
  as: 'usuario',
});

uUsuarioNegocio.hasMany(SorteoMensualProvincia, {
  foreignKey: 'usuarioId',
  as: 'sorteosGanados',
});



// ==========================
// 🔔 ALERTAS DEL SUPERVISOR
// ==========================

// Cada alerta pertenece a un supervisor (ParteTecnica con rol = supervisor)
AlertasSupervisor.belongsTo(ParteTecnica, {
  foreignKey: "supervisorId",
  as: "supervisor",
});

// Cada alerta puede pertenecer a un vendedor
AlertasSupervisor.belongsTo(ParteTecnica, {
  foreignKey: "vendedorId",
  as: "vendedor",
});

// Un supervisor tiene muchas alertas
ParteTecnica.hasMany(AlertasSupervisor, {
  foreignKey: "supervisorId",
  as: "alertas",
});



// Un vendedor tiene muchas ventas
ParteTecnica.hasMany(VentaVendedor, { foreignKey: "vendedorId" });
VentaVendedor.belongsTo(ParteTecnica, { foreignKey: "vendedorId" });

// Un negocio pertenece a una venta
// Un negocio tiene muchas ventas
uNegocio.hasMany(VentaVendedor, {
  foreignKey: "negocioId",
  as: "ventas", // este alias no te rompe nada
});

// Una venta pertenece a un negocio
VentaVendedor.belongsTo(uNegocio, {
  foreignKey: "negocioId",
  as: "uNegocio", // 👈 ESTE alias hace que exista v.uNegocio
});


// Relación con liquidación
LiquidacionVendedor.hasMany(VentaVendedor, { foreignKey: "liquidacionId" });
VentaVendedor.belongsTo(LiquidacionVendedor, { foreignKey: "liquidacionId" });

// Un vendedor tiene muchas liquidaciones
ParteTecnica.hasMany(LiquidacionVendedor, { foreignKey: "vendedorId" });
LiquidacionVendedor.belongsTo(ParteTecnica, { foreignKey: "vendedorId" });




// ParteTecnica ↔ uNegocio  (técnicos / vendedores de un negocio)





uNegocio.belongsTo(RubroNegocio, { foreignKey: 'rubroId' });
RubroNegocio.hasMany(uNegocio, { foreignKey: 'rubroId' });



// Un negocio tiene un plan
uNegocio.belongsTo(PlanNegocio, {
  foreignKey: 'planId',
  as: 'plan'
});

// Un plan tiene muchos negocios
PlanNegocio.hasMany(uNegocio, {
  foreignKey: 'planId',
  as: 'negocios'
});



// Un usuario-negocio tiene muchas publicidades
uUsuariosNegocio.hasMany(PartnerPublicidad, {
  foreignKey: 'negocioId',
  as: 'publicidades',
});

// Cada publicidad pertenece a un usuario-negocio
PartnerPublicidad.belongsTo(uUsuariosNegocio, {
  foreignKey: 'negocioId',
  as: 'negocio',
});

// Modelo de  negocioCanje-------


//-----------------------------

const MovimientoSaludable = require('./MovimientoSaludable');
const MovimientoSaludablePunto = require('./MovimientoSaludablePunto');
const LugarSaludable = require('./LugarSaludable');


// ===============================================
// 🔗 Relaciones MovimientoSaludable / Usuario
// ===============================================

// Un usuario (uUsuarioNegocio) puede tener muchos movimientos saludables
uUsuarioNegocio.hasMany(MovimientoSaludable, {
  foreignKey: 'usuarioNegocioId', // FK en MovimientoSaludable
  // as: 'movimientosSaludables', // si querés alias explícito
});

// Cada movimiento saludable pertenece a un solo usuario
MovimientoSaludable.belongsTo(uUsuarioNegocio, {
  foreignKey: 'usuarioNegocioId',
  // as: 'usuario',
});


// ===============================================
// 🔗 Relaciones MovimientoSaludable / MovimientoSaludablePunto
// ===============================================

// Un movimiento tiene muchos puntos GPS asociados (el tracking)
MovimientoSaludable.hasMany(MovimientoSaludablePunto, {
  foreignKey: 'movimientoId', // FK en MovimientoSaludablePunto
  as: 'puntos',
  onDelete: 'CASCADE',        // si borrás el movimiento, se borran los puntos
});

// Cada punto GPS pertenece a un solo movimiento
MovimientoSaludablePunto.belongsTo(MovimientoSaludable, {
  foreignKey: 'movimientoId',
  as: 'movimiento',
});


// ===============================================
// 🔗 LugarSaludable
// ===============================================
// Por ahora LugarSaludable queda "independiente":
// - No depende de usuario ni de negocio.
// - Lo usás por coordenadas para validar retos tipo
//   "andá a la plaza X" o "visitá 3 lugares saludables".
// Si después querés, podemos agregar:
//   LugarSaludable.belongsTo(uNegocio)  (si un lugar está ligado a un negocio)
// o una tabla intermedia RetoLugarSaludable para retos específicos.






//------------------------------------------------
//MercadoPago
//--------------------------------------------
Usuario.hasMany(PremiumOrden, {
  foreignKey: 'usuarioId',
  as: 'ordenesPremium',
});
PremiumOrden.belongsTo(Usuario, {
  foreignKey: 'usuarioId',
  as: 'usuario',
});


/* ===========================
   Promos negocio
   =========================== */





// Un negocio tiene muchas promos
uNegocio.hasMany(uPromoNegocio, {
  foreignKey: 'negocioId',
  as: 'uPromoNegocios', // mantiene lo que usás en /cerca
});

// Cada promo pertenece a un negocio
uPromoNegocio.belongsTo(uNegocio, {
  foreignKey: 'negocioId',
  as: 'negocio', // 👈 alias en minúscula
});

/* ===========================
   RETOS
   =========================== */
const Reto = require('./Reto');
const UsuarioRetoCumplido = require('./UsuarioRetoCumplido');

uUsuarioNegocio.hasMany(RetoParticipante, {
  foreignKey: 'usuarioId',
  as: 'retosParticipados'
});



// Relaciones
RetoParticipante.belongsTo(Reto, { foreignKey: 'retoId' });
RetoGanador.belongsTo(Reto, { foreignKey: 'retoId' });
RetoPremio.belongsTo(Reto, { foreignKey: 'retoId' });
RetoGanadorHist.belongsTo(Reto, { foreignKey: 'retoId' });
RetoGanadorHistDet.belongsTo(RetoGanadorHist, { foreignKey: 'histId' });

// Relaciones con usuarios
RetoParticipante.belongsTo(uUsuarioNegocio, { foreignKey: 'usuarioId' });
RetoGanador.belongsTo(uUsuarioNegocio, { foreignKey: 'usuarioId' });
RetoGanadorHistDet.belongsTo(uUsuarioNegocio, { foreignKey: 'usuarioId' });

RetoGanadorHist.hasMany(RetoGanadorHistDet, { foreignKey: 'histId', as: 'detalles' });



// 🔧 CLAVE: alias estable para el usuario
RetoGanadorHistDet.belongsTo(uUsuarioNegocio, { foreignKey: 'usuarioId', as: 'usuario' });

// (opcional, pero ayuda)
Reto.hasMany(RetoGanadorHist, { foreignKey: 'retoId' });
RetoGanadorHist.belongsTo(Reto, { foreignKey: 'retoId' });




/* ===========================
   NUEVO MÓDULO: NEGOCIOS Y PUNTOS
   =========================== */






/* ===========================
   RELACIONES
   ===========
   ================ */

MovimientoSaludablePunto.belongsTo(LugarSaludable, {
  foreignKey: 'lugarId',
  as: 'lugar',
});

LugarSaludable.hasMany(MovimientoSaludablePunto, {
  foreignKey: 'lugarId',
  as: 'puntos',
});



   // Relaciones: un reto puede ser cumplido por muchos usuarios
Reto.hasMany(UsuarioRetoCumplido, { foreignKey: 'retoId', as: 'cumplimientos' });

// Un usuario puede cumplir muchos retos
Usuario.hasMany(UsuarioRetoCumplido, { foreignKey: 'usuarioId', as: 'retosCumplidos' });

// Un cumplimiento pertenece a un usuario y a un reto
UsuarioRetoCumplido.belongsTo(uUsuarioNegocio, {
  foreignKey: "usuarioId",
  as: "usuario",   // 👈 mantenemos el alias "usuario" porque así lo usa la query
});

uUsuarioNegocio.hasMany(UsuarioRetoCumplido, {
  foreignKey: "usuarioId",
  as: "retosCumplidos",
});

UsuarioRetoCumplido.belongsTo(Reto, { foreignKey: 'retoId', as: 'reto' });

// Negocios ↔ UsuariosNegocio (dueño)
uNegocio.belongsTo(uUsuarioNegocio, { foreignKey: 'ownerId', as: 'duenio' });

// QR ↔ Negocio
uQRCompraNegocio.belongsTo(uNegocio, { foreignKey: 'negocioId' });



// Checkin ↔ Usuario / Negocio / QR
uCheckinNegocio.belongsTo(uUsuarioNegocio, { foreignKey: 'usuarioNegocioId' });
uCheckinNegocio.belongsTo(uNegocio, { foreignKey: 'negocioId' });
uCheckinNegocio.belongsTo(uQRCompraNegocio, { foreignKey: 'qrId' });



// inversas (las que te faltaban)
uUsuarioNegocio.hasMany(uCheckinNegocio, { foreignKey: 'usuarioNegocioId' });
uNegocio.hasMany(uCheckinNegocio, { foreignKey: 'negocioId' });
uQRCompraNegocio.hasMany(uCheckinNegocio, { foreignKey: 'qrId' });


// Concursos ↔ Negocio (si querés que cada negocio tenga su concurso)
uConcursoNegocio.belongsTo(uNegocio, { foreignKey: 'negocioId', as: 'negocio' });
uNegocio.hasMany(uConcursoNegocio, { foreignKey: 'negocioId', as: 'concursos' });

/* ===========================
   fin negocio
   =========================== */

// Relaciones opcionales (para debug/admin, no necesarias en frontend público)
SorteoHistorico.belongsTo(Concurso, { foreignKey: 'concursoId', as: 'concurso' });
SorteoHistorico.belongsTo(Usuario, { foreignKey: 'creadoPorId', as: 'creador' });
//---------qr--------------------------------------
// Cancha ↔ Usuario (dueño de la cancha)
Cancha.belongsTo(Usuario, { foreignKey: 'propietarioUsuarioId', as: 'propietario' });
Usuario.hasMany(Cancha,   { foreignKey: 'propietarioUsuarioId', as: 'canchas' });
  
// QREmision ↔ Cancha (QR del día por cancha)
  QREmision.belongsTo(Cancha, { foreignKey: 'canchaId' });
Cancha.hasMany(QREmision,   { foreignKey: 'canchaId' });

// QRCheckin ↔ Emision/Usuario/Cancha/Partido (registro de check-in)
QRCheckin.belongsTo(QREmision, { foreignKey: 'emisionId' });
QRCheckin.belongsTo(Usuario,   { foreignKey: 'usuarioId' });
QRCheckin.belongsTo(Cancha,    { foreignKey: 'canchaId' });
QRCheckin.belongsTo(Partido,   { foreignKey: 'partidoId' });

// (Opcionales pero recomendados para consultas rápidas)
Usuario.hasMany(QRCheckin, { foreignKey: 'usuarioId' });
Cancha.hasMany(QRCheckin,  { foreignKey: 'canchaId' });
Partido.hasMany(QRCheckin, { foreignKey: 'partidoId' });



//---------fin--------------------------------------

//---------------------------------------------------------------referidos
Usuario.belongsTo(Usuario, { as: 'Referente', foreignKey: 'referidoPorId' });
Usuario.hasMany(Usuario,   { as: 'Referidos', foreignKey: 'referidoPorId' });



//------------------------------------------------------------------

// === Historias (24 h) ===
// Relaciones historias
Historia.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'Usuario' });
Historia.hasMany(HistoriaVisto, { foreignKey: 'historiaId', as: 'Vistos' });
Historia.hasMany(HistoriaComentario, { foreignKey: 'historiaId', as: 'Comentarios' });
Historia.hasMany(HistoriaLike, { foreignKey: 'historiaId', as: 'Likes' });

HistoriaComentario.belongsTo(Historia, { foreignKey: 'historiaId' });
HistoriaComentario.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'Autor' });

HistoriaLike.belongsTo(Historia, { foreignKey: 'historiaId' });
HistoriaLike.belongsTo(Usuario, { foreignKey: 'usuarioId' });


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
    HistoriaComentario,
     HistoriaLike,
  MensajePartidoLeido,
  envioNotificacion,
    QREmision,
  QRCheckin,
    Concurso,
    VotoPremio,
    SorteoHistorico,
     uUsuarioNegocio,
  uNegocio,
  uQRCompraNegocio,
  uCheckinNegocio,
  uConcursoNegocio,
    Reto,
  UsuarioRetoCumplido,
  RetoGanadorHist,
RetoGanadorHistDet,
RetoPremio,
RetoGanador,
  SorteoConfig,
RetoParticipante,
Ganador,
uPromoNegocio,
PremiumOrden,
MovimientoSaludable,
MovimientoSaludablePunto,
LugarSaludable,
PartnerPublicidad,
TarifaPublicidad,
PlanNegocio,
RubroNegocio,
  ParteTecnica,
  LiquidacionVendedor,
  VentaVendedor,
  AlertasSupervisor,
  SorteoMensualProvincia


};
