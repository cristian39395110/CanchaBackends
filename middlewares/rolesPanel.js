// middlewares/rolesPanel.js

function soloAdmin(req, res, next) {
  if (!req.panelUser || req.panelUser.rol !== "admin") {
    return res.status(403).json({ ok: false, error: "No autorizado (admin)" });
  }
  next();
}

function soloSupervisor(req, res, next) {
  if (!req.panelUser || req.panelUser.rol !== "supervisor") {
    return res.status(403).json({ ok: false, error: "No autorizado (supervisor)" });
  }
  next();
}

function soloVendedor(req, res, next) {
  if (!req.panelUser || req.panelUser.rol !== "vendedor") {
    return res.status(403).json({ ok: false, error: "No autorizado (vendedor)" });
  }
  next();
}

// 🟧 Para endpoints que puedan usar admin + supervisor
function adminOSupervisor(req, res, next) {
  if (
    !req.panelUser ||
    (req.panelUser.rol !== "admin" && req.panelUser.rol !== "supervisor")
  ) {
    return res.status(403).json({
      ok: false,
      error: "No autorizado (admin o supervisor)",
    });
  }
  next();
}

// 🟩 Por si necesitás un endpoint abierto a cualquiera del panel
function cualquierPanel(req, res, next) {
  if (!req.panelUser) {
    return res.status(403).json({ ok: false, error: "No autorizado" });
  }
  next();
}

module.exports = {
  soloAdmin,
  soloSupervisor,
  soloVendedor,
  adminOSupervisor,
  cualquierPanel,
};
