// routes/negocios.js
const express = require("express");
const router = express.Router();

const { uNegocio, RubroNegocio,  uUsuarioNegocio,   uCheckinNegocio   } = require("../models/model"); 
const { autenticarTokenNegocio } = require("../middlewares/authNegocio");

const multer = require("multer");
const streamifier = require("streamifier");
const cloudinary = require("../config/cloudinary"); // ajustá el path

const upload = multer({ storage: multer.memoryStorage() });

/**
 * GET /api/negocios/mio
 * Devuelve el negocio del dueño logueado
 */
router.get("/mio", autenticarTokenNegocio, async (req, res) => {
  try {
    console.log("usuarioNegocio")
    const usuarioNegocio = req.negocio;
    console.log(usuarioNegocio)

    if (!usuarioNegocio) {
      return res.status(401).json({ ok: false, error: "No autenticado" });
    }

    const negocio = await uNegocio.findOne({
      where: { ownerId: usuarioNegocio.id },
    });

    if (!negocio) {
      return res.json({ ok: true, negocio: null });
    }

    return res.json({ ok: true, negocio });
  } catch (err) {
    console.error("Error en GET /mio:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Error al obtener el negocio" });
  }
});

/**
 * PUT /api/negocios/mio
 * Actualiza datos + foto del negocio del dueño logueado
 * Acepta multipart/form-data con campo "foto"
 */
router.put(
  "/mio",
  autenticarTokenNegocio,
  upload.single("foto"),
  async (req, res) => {
    try {
      const usuarioNegocio = req.negocio;

      if (!usuarioNegocio) {
        return res.status(401).json({ ok: false, error: "No autenticado" });
      }

      const negocio = await uNegocio.findOne({
        where: { ownerId: usuarioNegocio.id },
      });

      if (!negocio) {
        return res
          .status(404)
          .json({ ok: false, error: "No tenés negocio dado de alta" });
      }

      const {
        nombre,
        rubroId,
        provincia,
        localidad,
        // si en la tabla tenés dirección/teléfono/whatsapp
        direccion,
        telefono,
        whatsapp,
      } = req.body;

      // 🔹 Actualizar campos simples
      if (nombre) negocio.nombre = nombre;
      if (provincia) negocio.provincia = provincia;
      if (localidad) negocio.localidad = localidad;
      if (direccion) negocio.direccion = direccion;
      if (telefono) negocio.telefono = telefono;
      if (whatsapp) negocio.whatsapp = whatsapp;

      // 🔹 Rubro
      if (rubroId) {
        const rubroDB = await RubroNegocio.findByPk(rubroId);
        if (!rubroDB) {
          return res
            .status(400)
            .json({ ok: false, error: "Rubro inválido" });
        }
        negocio.rubroId = rubroId;
        negocio.rubro = rubroDB.nombre;
      }

      // 🔹 Foto (opcional)
      if (req.file) {
        const resultado = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "negocios" },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });

        // @ts-ignore
        negocio.foto = resultado.secure_url;
      }

      await negocio.save();

      return res.json({ ok: true, negocio });
    } catch (err) {
      console.error("Error en PUT /mio:", err);
      return res
        .status(500)
        .json({ ok: false, error: "Error al actualizar negocio" });
    }
  }
);


router.get("/mi-plan", autenticarTokenNegocio, async (req, res) => {
  try {
    const usuarioNegocio = req.negocio;

    if (!usuarioNegocio) {
      return res.status(401).json({
        ok: false,
        error: "Token inválido",
      });
    }

    // Buscamos el negocio del dueño
    const negocio = await uNegocio.findOne({
      where: { ownerId: usuarioNegocio.id },
    });

    // Si aún no tiene negocio creado
    if (!negocio) {
      return res.json({
        ok: true,
        planActual: null,
      });
    }

    // Si no tiene plan asignado
    if (!negocio.planId) {
      return res.json({
        ok: true,
        planActual: null,
      });
    }

    const plan = await PlanNegocio.findByPk(negocio.planId);

    if (!plan) {
      return res.json({
        ok: true,
        planActual: null,
      });
    }

    const hoy = new Date();
    const vence = negocio.fechaFinPlan ? new Date(negocio.fechaFinPlan) : null;
    const activo = !!(vence && vence >= hoy);

    return res.json({
      ok: true,
      planActual: {
        id: plan.id,
        nombre: plan.nombre,
        venceEl: negocio.fechaFinPlan, // string/DATE
        activo,
      },
    });
  } catch (err) {
    console.error("Error en /api/negocios/mi-plan:", err);
    return res.status(500).json({
      ok: false,
      error: "Error al obtener el plan actual",
    });
  }
});


// 🔹 GET /api/negocios/rubros
// Devuelve la lista de rubros de la tabla rubros_negocio
router.get("/rubros", async (req, res) => {
  try {
    const rubros = await RubroNegocio.findAll({
      order: [
        ["orden", "ASC"],
        ["nombre", "ASC"],
      ],
    });

    return res.json({
      ok: true,
      rubros,
    });
  } catch (error) {
    console.error("Error al obtener rubros_negocio:", error);
    return res.status(500).json({
      ok: false,
      error: "Error al obtener los rubros de negocio",
    });
  }
});

// 🔹 POST /api/negocios
// Alta de negocio (luego de pagar el plan)

// 🔹 POST /api/negocios
// Alta de negocio (luego de pagar el plan)
router.post(
  "/",
  autenticarTokenNegocio,
  upload.single("foto"), // 👈 AHORA SÍ ACEPTA FOTO
  async (req, res) => {
    try {
      const usuarioNegocio = req.negocio;

      if (!usuarioNegocio) {
        return res.status(401).json({
          ok: false,
          error: "Token inválido o usuario de negocio no encontrado",
        });
      }

      const {
        nombre,
        rubroId,
        rubro,
        provincia,
        localidad,
        direccion,
        telefono,
        whatsapp,
        latitud,
        longitud,
        planId,
      } = req.body;

      // 🔹 Validaciones
      if (!nombre || !rubroId || !provincia || !localidad) {
        return res.status(400).json({
          ok: false,
          error:
            "Faltan datos obligatorios (nombre, rubro, provincia, localidad)",
        });
      }

      if (!planId) {
        return res.status(400).json({
          ok: false,
          error: "Falta el plan seleccionado",
        });
      }

      // 🔹 Verificar rubro
      const rubroDB = await RubroNegocio.findByPk(rubroId);
      if (!rubroDB) {
        return res.status(400).json({
          ok: false,
          error: "Rubro inválido",
        });
      }

      // 🔹 Verificar plan
      const planDB = await PlanNegocio.findByPk(planId);
      if (!planDB) {
        return res.status(400).json({
          ok: false,
          error: "Plan inválido",
        });
      }

      const rubroNombre = rubro || rubroDB.nombre;

      // 🔹 Foto del negocio (opcional)
      let fotoUrl = null;

      if (req.file) {
        const resultado = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "negocios" },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });

        fotoUrl = resultado.secure_url;
      }

      // 🔢 Puntos asignados por el plan
      const puntosPorCompra = planDB.puntosPorCompra || 0;

      // 🧾 Crear negocio
      const nuevoNegocio = await uNegocio.create({
        nombre,
        rubro: rubroNombre,
        rubroId,
        provincia,
        localidad,
        direccion,
        telefono,
        whatsapp,
        latitud: latitud ?? null,
        longitud: longitud ?? null,
        planId,
        ownerId: usuarioNegocio.id,
        activo: true,
        puntosMes: 0,
        puntosPorCompra,
        foto: fotoUrl, // 👈 AHORA SÍ GUARDA FOTO
      });

      return res.status(201).json({
        ok: true,
        negocio: nuevoNegocio,
      });
    } catch (error) {
      console.error("Error al crear negocio:", error);
      return res.status(500).json({
        ok: false,
        error: "Error al dar de alta el negocio",
      });
    }
  }
);




// GET /api/negocios/ranking
// Ranking de negocios por ciudad del NEGOCIO del dueño logueado (premium)
router.get("/ranking", autenticarTokenNegocio, async (req, res) => {
  try {
    const usuarioNegocio = req.negocio;
    if (!usuarioNegocio) {
      return res.status(401).json({ ok: false, error: "No autenticado" });
    }

    // 1) Buscamos el negocio del dueño (si tiene negocio, es premium)
    const negocioMio = await uNegocio.findOne({
      where: { ownerId: usuarioNegocio.id },
      attributes: ["id", "nombre", "provincia", "localidad", "foto"],
    });

    if (!negocioMio) {
      return res.status(404).json({
        ok: false,
        error: "No tenés negocio dado de alta para ver el ranking",
      });
    }

    const { provincia, localidad } = negocioMio;

    if (!provincia || !localidad) {
      return res.status(400).json({
        ok: false,
        error:
          "Tu negocio no tiene provincia/localidad cargada. Completá esos datos para ver el ranking.",
      });
    }

    // 2) Agregamos puntos por negocio (en todos lados)
    const agregados = await uCheckinNegocio.findAll({
      attributes: [
        "negocioId",
        [fn("SUM", col("puntosGanados")), "totalPuntos"],
        [fn("COUNT", col("id")), "totalCheckins"],
      ],
      group: ["negocioId"],
      raw: true,
    });

    if (!agregados || agregados.length === 0) {
      return res.json({
        ciudad: { provincia, localidad },
        ranking: [],
      });
    }

    const negocioIds = agregados.map((a) => a.negocioId);

    // 3) Traemos solo los negocios de ESA ciudad
    const negociosCiudad = await uNegocio.findAll({
      where: {
        id: negocioIds,
        provincia,
        localidad,
      },
      attributes: ["id", "nombre", "provincia", "localidad", "foto"],
    });

    const mapNegocios = new Map();
    negociosCiudad.forEach((n) => {
      mapNegocios.set(n.id, n);
    });

    // 4) Armamos ranking, filtrando solo los negocios de la ciudad
    const ranking = agregados
      .filter((a) => mapNegocios.has(a.negocioId))
      .sort(
        (a, b) => Number(b.totalPuntos || 0) - Number(a.totalPuntos || 0)
      )
      .slice(0, 20)
      .map((a) => {
        const negocio = mapNegocios.get(a.negocioId);
        return {
          id: negocio.id,
          nombre: negocio.nombre,
          provincia: negocio.provincia,
          localidad: negocio.localidad,
          foto: negocio.foto,
          puntos: Number(a.totalPuntos || 0),
          checkins: Number(a.totalCheckins || 0),
        };
      });

    return res.json({
      ciudad: { provincia, localidad },
      ranking,
    });
  } catch (err) {
    console.error("Error en GET /api/negocios/ranking:", err);
    return res.status(500).json({
      ok: false,
      error: "No se pudo obtener el ranking de negocios",
    });
  }
});


module.exports = router;
