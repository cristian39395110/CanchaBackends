// models/usuario.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Usuario = sequelize.define('Usuario', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  telefono: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: false
  },
  esAdmin: {
  type: DataTypes.BOOLEAN,
  defaultValue: false
},
    localidad: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: false
  },
   fotoPerfil: {
    type: DataTypes.STRING(255), // podés usar TEXT si querés URLs largas
    allowNull: true,             // compatible con datos existentes
  },
   premium: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // models/usuario.js (o la migración)
puntuacion: {
  type: DataTypes.INTEGER,
  allowNull: false,
  defaultValue: 0,
},
puntosHistorico: {
  type: DataTypes.INTEGER,
  allowNull: false,
  defaultValue: 0,
},

  cloudinaryId: {
  type: DataTypes.STRING,
  allowNull: true
},
  verificado: {
  type: DataTypes.BOOLEAN,
  defaultValue: false
},
tokenVerificacion: {
  type: DataTypes.STRING,
  allowNull: true
},
   latitud: { 
    type: DataTypes.DECIMAL(10, 7), 
    allowNull: true 
  },  // opcional para mapa
  longitud: { 
    type: DataTypes.DECIMAL(10, 7),
     allowNull: true 
    },
    partidosJugados: {
  type: DataTypes.INTEGER,
  defaultValue: 0,
},
suspensionHasta: {
  type: DataTypes.DATE,
  allowNull: true,
},
sexo: {
  type: DataTypes.ENUM('masculino', 'femenino'),
  allowNull: false
},
edad: {
  type: DataTypes.INTEGER,
  allowNull: false
},
deviceId: {
  type: DataTypes.STRING,
  allowNull: true
},
ultimoCambioDevice: {
  type: DataTypes.DATE,
  allowNull: true,
},
// ===== Datos opcionales (se muestran solo si el flag correspondiente está en true) =====
fechaNacimiento: {
  type: DataTypes.DATEONLY,
  allowNull: true,
},
lugarNacimiento: {
  type: DataTypes.STRING,
  allowNull: true,
},
nacionalidad: {
  type: DataTypes.STRING,
  allowNull: true,
},
estadoCivil: {
  type: DataTypes.STRING,
  allowNull: true,
},
dondeVivo: {
  type: DataTypes.STRING,
  allowNull: true,
},
profesion: {
  type: DataTypes.STRING,
  allowNull: true,
},
empleo: {
  type: DataTypes.STRING,
  allowNull: true,
},
religion: {
  type: DataTypes.STRING,
  allowNull: true,
},
musicaFavorita: {
  type: DataTypes.STRING,
  allowNull: true,
},
institucion: {
  type: DataTypes.STRING,
  allowNull: true,
},

// ===== Flags de visibilidad para básicos =====
mostrar_edad: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
},
mostrar_sexo: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
},
mostrar_localidad: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
},

// ===== Flags de visibilidad para opcionales =====
mostrar_fechaNacimiento: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
},
mostrar_lugarNacimiento: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
},
mostrar_nacionalidad: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
},
mostrar_estadoCivil: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
},
mostrar_dondeVivo: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
},
mostrar_profesion: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
},
mostrar_empleo: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
},
mostrar_religion: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
},
mostrar_musicaFavorita: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
},
mostrar_institucion: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
},

premiosReferidos: {
  type: DataTypes.JSON,     // array de números: [40, 100]
  allowNull: false,
  defaultValue: []
},

  codigoReferencia: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  referidoPorId: { type: DataTypes.INTEGER, allowNull: true },

      perfilPublico: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  } ,// opcional para mapaw


    // ⭐️ NUEVOS CAMPOS PARA PLAN DE ESTABLECIMIENTOS (CLUBES)
  esPremiumEstablecimiento: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  premiumEstablecimientoVenceEl: {
    type: DataTypes.DATE,
    allowNull: true,
  }
});

module.exports = Usuario;
