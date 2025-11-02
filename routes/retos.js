const express = require('express');
const router = express.Router();
const { autenticarToken } = require('../middlewares/auth'); 
const { Reto, uUsuariosNegocio } = require('../models/model');

/**
 * ✅ Middleware para asegurar que sea admin
 */
function soloAdmin(req, res, next) {
  if (!req.usuario || !req.usuario.esAdmin) {
    return res.status(403).json({ error: 'Solo administradores pueden acceder.' });
  }
  next();
}

/**
 * ===========================================================
 * GET /api/retos
 * → Devuelve todos los retos (visibles para admin o usuarios)
 * ===========================================================
 */
router.get('/', autenticarToken, async (req, res) => {
  try {
    const retos = await Reto.findAll({
      order: [['createdAt', 'DESC']],
    });
    res.json(retos);
  } catch (err) {
    console.error('Error en GET /api/retos:', err);
    res.status(500).json({ error: 'No se pudieron cargar los retos' });
  }
});

/**
 * ===========================================================
 * POST /api/retos/crear
 * → Crear nuevo reto (solo admin)
 * body: { titulo, descripcion, puntos, fechaInicio, fechaFin }
 * ===========================================================
 */
router.post('/crear', autenticarToken, soloAdmin, async (req, res) => {
  try {
    const { titulo, descripcion, puntos, fechaInicio, fechaFin } = req.body;
    if (!titulo || !descripcion || !puntos) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // 👇 buscamos la última versión que haya en la tabla
    const ultimaVersion = await Reto.max('version'); // puede devolver null
    const nuevaVersion = (ultimaVersion || 0) + 1;

    const nuevo = await Reto.create({
      titulo,
      descripcion,
      puntos,
      tipo: 'general',   // lo que vos pusiste
      fechaInicio,
      fechaFin,
      version: nuevaVersion, // 👈 acá la magia
    });

    res.json(nuevo);
  } catch (err) {
    console.error('Error en POST /api/retos/crear:', err);
    res.status(500).json({ error: 'No se pudo crear el reto' });
  }
});

/**
 * ===========================================================
 * PUT /api/retos/:id
 * → Editar reto existente (solo admin)
 * ===========================================================
 */
router.put('/:id', autenticarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const reto = await Reto.findByPk(id);
    if (!reto) return res.status(404).json({ error: 'Reto no encontrado' });

    await reto.update(req.body);
    res.json(reto);
  } catch (err) {
    console.error('Error en PUT /api/retos/:id:', err);
    res.status(500).json({ error: 'No se pudo actualizar el reto' });
  }
});

/**
 * ===========================================================
 * DELETE /api/retos/:id
 * → Eliminar reto (solo admin)
 * ===========================================================
 */
router.delete('/:id', autenticarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const reto = await Reto.findByPk(id);
    if (!reto) return res.status(404).json({ error: 'Reto no encontrado' });

    await reto.destroy();
    res.json({ mensaje: 'Reto eliminado correctamente' });
  } catch (err) {
    console.error('Error en DELETE /api/retos/:id:', err);
    res.status(500).json({ error: 'No se pudo eliminar el reto' });
  }
});

/**
 * ===========================================================
 * GET /api/retos/usuarios-premium
 * → Listar todos los usuarios y su estado premium
 * ===========================================================
 */
router.get('/usuarios-premium', autenticarToken, soloAdmin, async (req, res) => {
  try {
    const lista = await uUsuariosNegocio.findAll({
      attributes: ['id', 'nombre', 'email', 'puntos', 'esPremium', 'esAdmin'],
      order: [['nombre', 'ASC']],
    });
    res.json(lista);
  } catch (err) {
    console.error('Error en GET /usuarios-premium:', err);
    res.status(500).json({ error: 'No se pudo obtener la lista de usuarios' });
  }
});

/**
 * ===========================================================
 * PATCH /api/retos/usuarios-premium/:id
 * → Cambiar estado premium de un usuario
 * ===========================================================
 */
router.patch('/usuarios-premium/:id', autenticarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { esPremium } = req.body;
  try {
    const user = await uUsuariosNegocio.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    await user.update({ esPremium });
    res.json({ mensaje: 'Usuario actualizado', user });
  } catch (err) {
    console.error('Error en PATCH /usuarios-premium/:id:', err);
    res.status(500).json({ error: 'No se pudo actualizar el usuario' });
  }
});


/**
 * ===========================================================
 * GET /api/retos/meta
 * → Devuelve la versión más reciente de retos para mostrar banner
 * ===========================================================
 */
/**
 * ===========================================================
 * GET /api/retos/meta
 * → Devuelve la versión más reciente de los retos para mostrar banner
 * ===========================================================
 */
router.get('/meta', autenticarToken, async (req, res) => {
  try {
    const ultimo = await Reto.findOne({
      order: [['updatedAt', 'DESC']],
      attributes: ['version'],
    });

    const version = ultimo ? Number(ultimo.version) : 1;

    res.json({
      version,
      hayNuevos: true,
    });
  } catch (err) {
    console.error('Error en GET /api/retos/meta:', err);
    res.status(500).json({ error: 'No se pudo obtener meta de retos' });
  }
});


module.exports = router;
