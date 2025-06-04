const  Partido  = require('../models/partido');

// Crear un partido
exports.crearPartido = async (req, res) => {
    try {
      const { deporte, lugar, fecha, jugadoresNecesarios } = req.body;
  
      const partido = await Partido.create({
        deporte,
        lugar,
        fecha,
        jugadoresNecesarios
      });
  
      res.status(201).json({ mensaje: 'Partido creado', partido });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al crear el partido' });
    }
  };
  

// Unirse a un partido
exports.unirseAPartido = async (req, res) => {
  try {
    const { partidoId, usuarioId } = req.params;

    const partido = await Partido.findByPk(partidoId);
    const usuario = await Usuario.findByPk(usuarioId);

    if (!partido || !usuario) {
      return res.status(404).json({ error: 'Partido o usuario no encontrado' });
    }

    await partido.addJugadores(usuario, { through: { confirmado: true } });

    res.json({ mensaje: 'Te uniste al partido' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al unirse al partido' });
  }
};

// Obtener todos los partidos
exports.obtenerPartidos = async (req, res) => {
  try {
    const partidos = await Partido.findAll({
      include: { model: Usuario, as: 'jugadores' }
    });
    res.json(partidos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener partidos' });
  }
};
