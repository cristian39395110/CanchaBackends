const express = require('express');
const router = express.Router();
const { Cancha,Usuario } = require('../models/model');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');
const { autenticarToken } = require('../middlewares/auth'); // ajustá la ruta si está en otro archivo
// ✅ GET /api/canchas — todas las canchas


const { Op, fn, col, where, literal } = require('sequelize');






// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


// Middleware para subir imágenes
const storage = multer.memoryStorage();
const upload = multer({ storage });


// para unicar canchas cercanas sin activar gps 

// GET /api/canchas/asociadas?deporte=padel&radioKm=20
// ✅ Devuelve todas las canchas a ≤ 20 km del usuario
router.get('/asociadas', autenticarToken, async (req, res) => {
  try {
    const { radioKm, deporte } = req.query;
    const RADIO = Number(radioKm) > 0 ? Number(radioKm) : 20;

    // 1️⃣ Ubicación del usuario autenticado
    const user = await Usuario.findByPk(req.usuario.id, {
      attributes: ['latitud', 'longitud'],
    });

    const uLat = parseFloat(user?.latitud);
    const uLon = parseFloat(user?.longitud);
    console.log('Lat/Lon usuario:', uLat, uLon);

    if (isNaN(uLat) || isNaN(uLon)) {
      return res
        .status(400)
        .json({ error: 'Tu usuario no tiene latitud/longitud configuradas' });
    }

    // 2️⃣ Expresión de distancia Haversine
    const distanceExpr = `
      6371 * ACOS(
        GREATEST(-1, LEAST(1,
          COS(RADIANS(${uLat})) * COS(RADIANS(CAST(latitud AS DOUBLE))) *
          COS(RADIANS(CAST(longitud AS DOUBLE)) - RADIANS(${uLon})) +
          SIN(RADIANS(${uLat})) * SIN(RADIANS(CAST(latitud AS DOUBLE)))
        ))
      )
    `;

    // 3️⃣ Construir condiciones WHERE dinámicamente
    const whereParts = [
      'latitud IS NOT NULL',
      'longitud IS NOT NULL',
      `${distanceExpr} <= ${RADIO}`,
    ];

    // Si se envía ?deporte=futbol o ?deporte=padel
    if (deporte && deporte.trim()) {
      const dep = deporte.trim().toLowerCase();
      whereParts.push(
        `LOWER(REPLACE(deportes, ' ', '')) LIKE '%${dep}%'`
      );
    }

    // 4️⃣ Ejecutar consulta final
    const whereFinal = whereParts.join(' AND ');

    const canchas = await Cancha.findAll({
      attributes: [
        'id',
        'nombre',
        'direccion',
        'latitud',
        'longitud',
        'deportes',
        'telefono',
        'whatsapp',
        'foto',
        [literal(distanceExpr), 'distanciaKm'],
      ],
      where: literal(whereFinal),
      order: [[literal('distanciaKm'), 'ASC']],
    });

    console.log(`📍 Canchas encontradas (${deporte || 'todas'}): ${canchas.length}`);
    res.json(canchas);
  } catch (e) {
    console.error('❌ GET /canchas/asociadas', e);
    res
      .status(500)
      .json({ error: 'Error al listar canchas cercanas' });
  }
});

function tienePlanEstablecimientoVigente(usuario) {
  if (!usuario?.esPremiumEstablecimiento || !usuario?.premiumEstablecimientoVenceEl) {
    return false;
  }
  return new Date(usuario.premiumEstablecimientoVenceEl) > new Date();
}


router.post('/alta-club', autenticarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id || req.usuarioId;

    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar que tenga plan de establecimiento activo
    if (!tienePlanEstablecimientoVigente(usuario)) {
      return res.status(403).json({
        error: 'Tu plan de establecimiento no está activo. Renovalo para dar de alta tu club.',
      });
    }

    const {
      nombre,
      direccion,
      localidad,
      telefono,
      whatsapp,
      deportes,
      latitud,
      longitud,
      radioGeofence,
      puntosBase,
      puntosAsociada,
    } = req.body;

    if (!nombre || !direccion || !localidad || !deportes) {
      return res.status(400).json({ error: 'Faltan datos obligatorios.' });
    }

    if (!latitud || !longitud) {
      return res
        .status(400)
        .json({ error: 'Debés marcar la ubicación del club en el mapa.' });
    }

    const cancha = await Cancha.create({
      nombre,
      direccion,
      deportes,
      telefono,
      whatsapp,
      latitud,
      longitud,
      propietarioUsuarioId: usuarioId,
      esAsociada: true, // la tomamos como cancha asociada
      radioGeofence: radioGeofence || 100,
      puntosBase: puntosBase || 5,
      puntosAsociada: puntosAsociada || 20,
      // podés dejar verificada en false y después aprobarla desde un panel admin
      verificada: false,
    });

    return res.status(201).json({
      mensaje: 'Cancha / club creado correctamente.',
      cancha,
    });
  } catch (error) {
    console.error('❌ Error en /api/canchas/alta-club:', error);
    res.status(500).json({ error: 'Error al dar de alta el club.' });
  }
});


router.get('/', async (req, res) => {
  try {
    const { deporte } = req.query;

    const where = {};
    if (deporte) {
      where.deportes = { [Op.like]: `%${deporte}%` };
    }

    // 👇 Traemos la cancha con el dueño ("propietario")
    const canchas = await Cancha.findAll({
      where,
      include: [
        {
          model: Usuario,
          as: 'propietario',
          attributes: [
            'id',
            'nombre',
            'esPremiumEstablecimiento',
            'premiumEstablecimientoVenceEl'
          ]
        }
      ]
    });

    // 👇 Solo dejamos las que tengan plan vigente
    const filtradas = canchas.filter((c) =>
      c.propietario && tienePlanEstablecimientoVigente(c.propietario)
    );

    res.json(filtradas);
  } catch (error) {
    console.error('❌ Error al obtener canchas:', error);
    res.status(500).json({ error: 'Error al obtener canchas' });
  }
});

// ✅ POST /api/canchas — crear nueva cancha (solo admin)
const PUNTOS_POR_CATEGORIA = {
  barato: 10,
  estandar: 20,
  caro: 30,
};

router.post('/', upload.single('foto'), async (req, res) => {
  const { nombre, direccion, latitud, longitud, deportes, telefono, whatsapp } = req.body;

  try {
    // 1) Parsear deportes desde el string "Padel, Tenis, Zumba"
    const nombresDeportes = (deportes || '')
      .split(',')
      .map(d => d.trim())
      .filter(Boolean);

    // Valores por defecto
    let puntosBase = 5;
    let puntosAsociada = 20;
    const radioGeofence = 100; // lo define el sistema, no el club

    // 2) Buscar deportes en la BD y calcular la categoría dominante
    if (nombresDeportes.length > 0) {
      const deportesBD = await Deporte.findAll({
        where: {
          nombre: { [Op.in]: nombresDeportes },
        },
      });

      const categorias = deportesBD.map(d => d.categoria); // 'barato', 'estandar', 'caro'
      let categoriaDominante = 'barato';

      if (categorias.includes('caro')) {
        categoriaDominante = 'caro';
      } else if (categorias.includes('estandar')) {
        categoriaDominante = 'estandar';
      }

      const puntos = PUNTOS_POR_CATEGORIA[categoriaDominante] || 10;
      puntosBase = puntos;
      puntosAsociada = puntos;
    }

    // 3) Armar el objeto base de la cancha
    const canchaData = {
      nombre,
      direccion,
      latitud,
      longitud,
      deportes,
      telefono,
      whatsapp,
      foto: null,
      radioGeofence,
      puntosBase,
      puntosAsociada,
      // propietarioUsuarioId: req.usuario?.id  // si usás el usuario dueño
    };

    // 4) Subir foto si viene archivo
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'canchas' },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );

        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

      canchaData.foto = result.secure_url;
    }

    // 5) Crear la cancha con todos los datos + puntos ya calculados
    const nuevaCancha = await Cancha.create(canchaData);
    res.json(nuevaCancha);
  } catch (error) {
    console.error('❌ Error en POST cancha:', error);
    res.status(500).json({ error: 'Error al crear la cancha' });
  }
});




// GET /api/canchas/mias  → lista de establecimientos del propietario autenticado
router.get('/mias', autenticarToken, async (req, res) => {
  try {
    const canchas = await Cancha.findAll({
      where: { propietarioUsuarioId: req.usuario.id },
      attributes: ['id', 'nombre', 'direccion', 'deportes'] // lo que quieras mostrar
    });
    return res.json(canchas);
  } catch (e) {
    console.error('GET /api/canchas/mias', e);
    return res.status(500).json({ error: 'Error al obtener tus establecimientos' });
  }
});

module.exports = router;


