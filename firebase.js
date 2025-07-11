const admin = require('firebase-admin');

let app;

if (!admin.apps.length) {
  try {
    const creds = process.env.FIREBASE_ADMIN_CREDENTIALS;
    if (!creds) {
      throw new Error('FIREBASE_ADMIN_CREDENTIALS no está definido');
    }

    const serviceAccount = JSON.parse(creds);

    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('✅ Firebase Admin inicializado desde variable de entorno');
  } catch (error) {
    console.error('❌ Error al inicializar Firebase Admin SDK:', error.message || error);
  }
} else {
  app = admin.app();
}

module.exports = admin;
