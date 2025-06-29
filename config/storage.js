// config/storage.js
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'publicaciones', // nombre de carpeta en Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'mp4'],
  },
});

module.exports = storage;
