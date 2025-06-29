// middlewares/multer.js
const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage(); // Usamos memory para Cloudinary
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext.match(/\.(jpg|jpeg|png|mp4)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Solo imágenes o videos'));
    }
  }
});

module.exports = upload;
