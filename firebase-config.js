// ============================================================
// CONFIGURACIÓN DE FIREBASE
// ============================================================
// 1. Ve a https://console.firebase.google.com y crea un proyecto (gratis).
// 2. Dentro del proyecto: "Compilación" > "Firestore Database" > Crear base de datos
//    (modo producción, cualquier región cercana).
// 3. Dentro del proyecto: "Compilación" > "Authentication" > Comenzar >
//    habilita el proveedor "Correo electrónico/contraseña".
// 4. Ve a Configuración del proyecto (ícono de engrane) > General >
//    baja hasta "Tus apps" > ícono "</>" (Web) > registra la app.
// 5. Copia el objeto firebaseConfig que te muestra Firebase y pégalo abajo,
//    reemplazando el objeto de ejemplo completo.
// 6. Guarda este archivo y vuelve a subir la carpeta a Netlify (o arrastra
//    de nuevo si usaste Netlify Drop).
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBXKQ3p3zFsCeFsffGeVurcPvRranGwD6c",
  authDomain: "organizacion-gerencia.firebaseapp.com",
  projectId: "organizacion-gerencia",
  storageBucket: "organizacion-gerencia.firebasestorage.app",
  messagingSenderId: "655621139641",
  appId: "1:655621139641:web:f05e1b8c608e96628e3f68"
};
