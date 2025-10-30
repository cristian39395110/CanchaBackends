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


module.exports = router;
router.get('/', async (req, res) => {
  try {
    const { deporte } = req.query;

    let where = {};
    if (deporte) {
      where.deportes = { [Op.like]: `%${deporte}%` };
    }

    const canchas = await Cancha.findAll({ where });
    res.json(canchas);
  } catch (error) {
    console.error('❌ Error al obtener canchas:', error);
    res.status(500).json({ error: 'Error al obtener canchas' });
  }
});

// ✅ POST /api/canchas — crear nueva cancha (solo admin)
router.post('/', upload.single('foto'), async (req, res) => {
  const { nombre, direccion, latitud, longitud, deportes, telefono, whatsapp } = req.body;

  try {
    let fotoUrl = null;

    if (req.file) {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'canchas' },
        (error, result) => {
          if (error) {
            console.error('❌ Error al subir imagen:', error);
            return res.status(500).json({ error: 'Error al subir imagen' });
          }

          fotoUrl = result.secure_url;

          Cancha.create({
            nombre,
            direccion,
            latitud,
            longitud,
            deportes,
            telefono,
            whatsapp,
            foto: fotoUrl,
          })
            .then((nuevaCancha) => res.json(nuevaCancha))
            .catch((err) => {
              console.error('❌ Error al guardar cancha:', err);
              res.status(500).json({ error: 'Error al guardar la cancha' });
            });
        }
      );

      streamifier.createReadStream(req.file.buffer).pipe(stream);
    } else {
      const nuevaCancha = await Cancha.create({
        nombre,
        direccion,
        latitud,
        longitud,
        deportes,
        telefono,
        whatsapp,
        foto: null,
      });
      res.json(nuevaCancha);
    }
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


