const admin = require('firebase-admin');

let app;

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);

    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('✅ Firebase Admin inicializado desde variable de entorno');
  } catch (error) {
    console.error('❌ Error al inicializar Firebase Admin SDK:', error);
  }
} else {
  app = admin.app();
}

module.exports = admin;
