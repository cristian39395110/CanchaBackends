// firebase.js
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-admin-sdk.json');

let app;

if (!admin.apps.length) {
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  app = admin.app(); // Usa la instancia existente
}

module.exports = admin;
