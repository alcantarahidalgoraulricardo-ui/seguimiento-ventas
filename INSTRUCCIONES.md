# Cómo poner tu app a funcionar (una sola vez, ~15 min)

La app son solo archivos web (no necesita App Store ni Xcode). Para que
funcione en tu iPhone y tu Mac con los mismos datos, necesitas:
1. Un backend gratis (Firebase) donde se guarda tu información.
2. GitHub Pages, donde "vive" la app en internet para poder instalarla.

---

## Paso 1 — Crear el backend (Firebase)

1. Entra a https://console.firebase.google.com con tu cuenta de Google (o crea una).
2. **Crear proyecto** → ponle un nombre, ej. `seguimiento-ventas` → puedes
   desactivar Google Analytics (no lo necesitas) → **Crear proyecto**.
3. El menú de Firebase cambia de nombres seguido, así que la forma segura de
   encontrar todo es la lupa **"Buscar productos"** arriba del menú
   izquierdo. Escribe **Firestore** y entra a **Firestore Database**
   (si ya ves un atajo fijado que dice "Firestore" en la parte de arriba,
   puedes darle clic directo ahí). Luego clic en **Crear base de datos**.
   - Elige una ubicación cercana (ej. `us-central` o `southamerica-east1`).
   - Modo: **producción**.
4. Ve a la pestaña **Reglas** de Firestore y reemplaza el contenido por lo que
   está en el archivo `firestore.rules` de esta carpeta. Clic en **Publicar**.
5. Vuelve a la lupa **"Buscar productos"**, escribe **Authentication** y
   entra ahí → **Comenzar**.
   - En la pestaña **Sign-in method**, habilita **Correo electrónico/contraseña**.
6. Ve a **Configuración del proyecto** (ícono de engrane, arriba a la izquierda)
   → pestaña **General** → baja hasta **"Tus apps"** → clic en el ícono `</>`
   (Web) → dale un nombre (ej. `app-web`) → **Registrar app**.
7. Firebase te muestra un bloque de código con `const firebaseConfig = {...}`.
   Copia esos valores.
8. Abre el archivo `firebase-config.js` de esta carpeta y reemplaza los
   valores de ejemplo por los tuyos. Guarda el archivo.

## Paso 2 — Publicar la app en GitHub Pages

Al terminar este paso tendrás una URL (`https://tu-usuario.github.io/...`).
Esa es la URL que vas a abrir en el iPhone y la Mac en el Paso 3. Los datos
de `firebase-config.js` no son secretos — es normal y seguro que queden
visibles en el repositorio y en el sitio publicado.

1. Entra a https://github.com y crea una cuenta gratis (si no tienes) o
   inicia sesión.
2. Clic en el **"+"** de arriba a la derecha → **New repository**.
   - Nombre: por ejemplo `seguimiento-ventas` (sin espacios).
   - Marca **Public** (así GitHub Pages es gratis).
   - No marques "Add a README" — vas a subir tus archivos directo.
   - Clic en **Create repository**.
3. En la página del repo recién creado (está vacío), busca el link que dice
   **"uploading an existing file"** y haz clic ahí.
4. Abre la carpeta `seguimiento-app` en tu computadora y arrastra **todos**
   los archivos hacia la ventana del navegador:
   - `index.html`
   - `app.js`
   - `firebase-config.js` (ya con tus datos de Firebase pegados)
   - `manifest.json`
   - `service-worker.js`
   - `firestore.rules`
   - la carpeta **`icons`** completa (con los 4 archivos png dentro)
5. Baja hasta el final de la página, escribe un mensaje como
   "primera versión" en el cuadro de texto, y clic en **Commit changes**.
6. Ve a la pestaña **Settings** del repositorio (arriba, junto a "Code",
   "Issues", etc.).
7. En el menú izquierdo de Settings, clic en **Pages**.
8. En "Build and deployment" → donde dice **Source**, elige
   **Deploy from a branch**. Justo abajo, en **Branch**, elige **main** y
   la carpeta **/ (root)** → clic en **Save**.
9. Espera 1 a 2 minutos y vuelve a recargar esa misma página de
   Settings → Pages. Arriba va a aparecer un mensaje verde con tu URL, algo
   como `https://tu-usuario.github.io/seguimiento-ventas/`. Esa es tu app —
   guárdala.

### Cómo actualizar la app más adelante

Entra al repositorio en github.com, abre el archivo que quieras cambiar,
clic en el ícono de lápiz (arriba a la derecha del contenido del archivo)
para editarlo, y al terminar clic en **Commit changes**. GitHub Pages
vuelve a publicar el sitio solo, en 1-2 minutos, sin que tengas que subir
nada de nuevo manualmente.

Si prefieres reemplazar varios archivos a la vez: dentro del repo, botón
**Add file → Upload files**, arrastra los archivos nuevos (con el mismo
nombre) y **Commit changes** — GitHub los sobreescribe automáticamente.

## Paso 3 — Instalar en iPhone

1. Abre la URL de tu app (la de github.io) en **Safari** — tiene que ser
   Safari, no Chrome, para poder instalarla.
2. Toca el botón compartir (el cuadro con la flecha hacia arriba).
3. Baja y toca **"Agregar a pantalla de inicio"**.
4. Ábrela desde el ícono nuevo — se ve y se comporta como una app normal,
   sin barra de navegador.
5. La primera vez, crea tu cuenta (correo + contraseña) desde el botón
   **"Crear cuenta"**.

## Paso 4 — Instalar en Mac

1. Abre la misma URL en **Safari** o **Chrome**.
2. Safari: menú **Archivo → Agregar a Dock**.
   Chrome: ícono de instalar en la barra de direcciones (o menú ⋮ →
   **Cast, guardar y compartir → Instalar página como app**).
3. Entra con el **mismo correo y contraseña** que usaste en el iPhone — vas
   a ver los mismos datos en ambos dispositivos, sincronizados en tiempo real.

## Recordatorios de inicio de bloque

Ve a la pestaña **Ajustes** dentro de la app y toca **"Activar recordatorios"**.
Esto te avisa cuando empieza cada bloque de tu rutina.

Limitación real: son recordatorios locales, no notificaciones push. Funcionan
mientras la app esté abierta o en segundo plano en la Mac; en iPhone, iOS
puede detenerlos si no abres la app instalada al menos una vez en el día.
Si más adelante quieres notificaciones push de verdad (que lleguen aunque
la app esté cerrada), se puede agregar con Firebase Cloud Messaging — es un
paso extra de configuración que podemos hacer después.

## Previsualizar cambios antes de subir a GitHub

Cada vez que edites algo (o yo te haga cambios), puedes verla funcionando en
tu Mac antes de publicarla:

1. Abre la app **Terminal** (Cmd+Espacio → escribe "Terminal" → Enter).
2. Escribe esto y presiona Enter:
   ```
   cd ~/Desktop/"APP DE SEGUIMIENTO GERENCIA" && python3 -m http.server 8000
   ```
3. Abre Safari o Chrome y ve a **http://localhost:8000**
4. Pruébala igual que en tu iPhone (el login y los datos funcionan porque
   Firebase permite `localhost` por defecto).
5. Cuando termines de probar, vuelve a la Terminal y presiona **Ctrl+C**
   para apagar el servidor.

Si algo no se ve bien ahí, dímelo antes de subir los archivos a GitHub.

## Vendedores y equipo (cuentas para tus vendedores)

La app ahora soporta varias cuentas: la tuya (gerente) y una por cada vendedor,
cada quien con su propio horario de bloques. Para que funcione necesitas
**volver a publicar las reglas de Firestore** (cambiaron):

1. Entra a tu proyecto en https://console.firebase.google.com → Firestore
   Database → pestaña **Reglas**.
2. Borra todo y pega de nuevo el contenido actualizado de `firestore.rules`
   (de esta carpeta) → **Publicar**.

Tu cuenta (la que ya usas, con tu correo) se sigue reconociendo sola como
gerente y no necesita hacer nada distinto.

Cómo creas una cuenta de vendedor (tú, desde la app):

1. Entra con tu cuenta de gerente → pestaña **Equipo** → **"+ Nuevo vendedor"**.
2. Pon su nombre, correo y una contraseña temporal.
3. En "Actividades por día" verás pestañas Lun/Mar/Mié/Jue/Vie/Sáb — arma las
   actividades de cada día por separado (nombre, hora de inicio, hora de fin,
   y "Descanso" si es su comida). Si dos días se repiten, usa "Copiar aquí"
   en vez de volver a escribir todo. Un día sin actividades queda libre ese
   día (el sábado, por ejemplo, empieza vacío — solo se activa si le pones algo).
4. Toca **"Crear vendedor"** — te muestro el correo y la contraseña para que
   se los compartas. Ese vendedor ya puede entrar a la app y ver su rutina,
   puntos, racha, leads, bloqueos y prioridades, con el horario que le armaste.

También existe la opción de que un vendedor cree su propia cuenta tocando
"Crear cuenta" en la pantalla de entrada y eligiendo un horario ya armado del
desplegable — úsala si prefieres que ellos mismos se registren en vez de
crearlos tú uno por uno.

Cómo ves a tu equipo:

- En la pestaña **Equipo** ves la lista de tus vendedores, su % de
  cumplimiento del día y sus puntos. Toca a cualquiera para ver el detalle
  bloque por bloque de su día de hoy.
- Toca el ícono **✎** junto a un vendedor para corregir su horario (nombre y
  actividades por día) sin tocar su correo ni su contraseña — útil si el
  horario quedó mal armado o si necesitas cambiarlo más adelante.
- Puedes **ver** los datos de tus vendedores y **crear/editar su perfil y
  horario**, pero no puedes editar lo que marcan día a día — eso lo controla
  cada quien desde su cuenta.

## Si algo no funciona

- Pantalla en blanco o error de login → revisa que copiaste bien los valores
  en `firebase-config.js` antes de subirlo (sin comillas de más ni espacios).
- "Missing or insufficient permissions" → te faltó publicar las reglas del
  Paso 1.4.
- Página en blanco justo después de publicar (Paso 2.9) → espera 1-2
  minutos, la primera vez GitHub Pages tarda en propagarse.
- El ícono no aparece bien en "Agregar a pantalla de inicio" → confirma que
  subiste la carpeta `icons` completa con los 4 archivos.
- 404 al abrir la URL → revisa en Settings → Pages que el Branch sea
  **main** y la carpeta **/ (root)**, y que `index.html` esté en la raíz
  del repositorio (no dentro de otra subcarpeta).
