// routes/negocios.js
const express = require("express");
const router = express.Router();

const { uNegocio, RubroNegocio,  uUsuarioNegocio,   uCheckinNegocio,PlanNegocio   } = require("../models/model"); 
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

// ✅ GET /api/negocios/mis-negocios
// Compatibilidad con el frontend (PanelNegocioPage)
router.get("/mis-negocios", autenticarTokenNegocio, async (req, res) => {
  try {
    const usuarioNegocio = req.negocio;

    if (!usuarioNegocio) {
      return res.status(401).json({ ok: false, error: "No autenticado" });
    }

    // Si tu sistema maneja UN negocio por dueño:
    const negocio = await uNegocio.findOne({ where: { ownerId: usuarioNegocio.id } });

    // Devolvemos en formato "lista" como espera el frontend
    return res.json({
      ok: true,
      negocios: negocio ? [negocio] : [],
    });
  } catch (err) {
    console.error("Error en GET /mis-negocios:", err);
    return res.status(500).json({ ok: false, error: "Error al obtener negocios" });
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
        direccion,
        telefono,
        whatsapp,
        latitud,
        longitud,
      } = req.body;

      // 🔹 Campos simples
      if (nombre) negocio.nombre = nombre;
      if (provincia) negocio.provincia = provincia;
      if (localidad) negocio.localidad = localidad;
      if (direccion) negocio.direccion = direccion;
      if (telefono) negocio.telefono = telefono;
      if (whatsapp) negocio.whatsapp = whatsapp;

      // 🔹 Coordenadas desde el mapa (las manda el frontend siempre como string)
      if (latitud !== undefined && latitud !== "") {
        const latNum = Number(latitud);
        if (!isNaN(latNum)) {
          negocio.latitud = latNum;
        }
      }

      if (longitud !== undefined && longitud !== "") {
        const lngNum = Number(longitud);
        if (!isNaN(lngNum)) {
          negocio.longitud = lngNum;
        }
      }

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

      let {
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
      planId=1;


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
// GET /api/negocios/ranking
// Ranking mensual de negocios por ciudad, usando puntosMes
router.get("/ranking", autenticarTokenNegocio, async (req, res) => {
  try {
    const usuarioNegocio = req.negocio;
    if (!usuarioNegocio) {
      return res.status(401).json({ ok: false, error: "No autenticado" });
    }

    // 1) Buscamos el negocio del dueño (premium)
    const negocioMio = await uNegocio.findOne({
      where: { ownerId: usuarioNegocio.id },
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

    // 2) Traemos todos los negocios de la misma ciudad
    const negociosCiudad = await uNegocio.findAll({
      where: {
        provincia,
        localidad,
        activo: true,
      },
      order: [
        ["puntosMes", "DESC"],
        ["id", "ASC"],
      ],
    });

    if (!negociosCiudad || negociosCiudad.length === 0) {
      return res.json({
        negocioPropio: null,
        top3: [],
        faltanParaTop: null,
        faltanParaArriba: null,
      });
    }

    // 3) Calculamos posición del negocio propio
    const idxPropio = negociosCiudad.findIndex((n) => n.id === negocioMio.id);

    if (idxPropio === -1) {
      // Por algún motivo no aparece en la lista (no debería pasar)
      return res.json({
        negocioPropio: null,
        top3: [],
        faltanParaTop: null,
        faltanParaArriba: null,
      });
    }

    const posicionPropia = idxPropio + 1;
    const puntosPropios = Number(negocioMio.puntosMes || 0);

    const negocioPropio = {
      id: negocioMio.id,
      nombre: negocioMio.nombre,
      puntosMes: puntosPropios,
      posicion: posicionPropia,
    };

    // 4) Armamos TOP 3
    const top3 = negociosCiudad.slice(0, 3).map((n, index) => ({
      id: n.id,
      nombre: n.nombre,
      puntosMes: Number(n.puntosMes || 0),
      posicion: index + 1,
    }));

    // 5) Cálculo de "faltan para subir un puesto"
    let faltanParaArriba = null;
    if (posicionPropia > 1) {
      const negocioArriba = negociosCiudad[posicionPropia - 2]; // el de arriba
      const puntosArriba = Number(negocioArriba.puntosMes || 0);
      const diff = puntosArriba - puntosPropios;
      faltanParaArriba = diff > 0 ? diff : 0;
    }

    // 6) Cálculo de "faltan para entrar al TOP 3"
    let faltanParaTop = null;
    if (top3.length < 3) {
      // Si aún no hay 3 negocios, no tiene sentido el cálculo
      faltanParaTop = null;
    } else {
      if (posicionPropia <= 3) {
        // Ya está dentro del TOP 3
        faltanParaTop = 0;
      } else {
        const tercero = negociosCiudad[2];
        const puntosTercero = Number(tercero.puntosMes || 0);
        const diffTop = puntosTercero - puntosPropios;
        faltanParaTop = diffTop > 0 ? diffTop : 0;
      }
    }

    return res.json({
      negocioPropio,
      top3,
      faltanParaTop,
      faltanParaArriba,
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
