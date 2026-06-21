# YES or YES 💌

Este es un clon exacto de [justsayyesto.me](https://justsayyesto.me/), con el diseño, tipografías y lógica interactiva original (el botón "NO" huye de forma juguetona). Además, incluye un backend completo para almacenar las invitaciones generadas y recibir las respuestas de las citas directamente en tu correo electrónico.

## 🚀 Características

- **Diseño e Interacción Original**: Tipografías `Fraunces`, `Inter` y `Space Mono`, texturas de papel realistas, animaciones del botón NO persuasivas y confeti interactivo.
- **Multilingüe**: Soporte nativo para Español (`es`), Inglés (`en`), Portugués (`pt`) y Ruso (`ru`).
- **Base de Datos Local**: Guarda las invitaciones y respuestas en un archivo JSON local.
- **Sistema de Alertas por Correo**: Te envía un correo cuando ella responde la invitación con los detalles de la cita (Lugar, Fecha, Mensaje, y cuántas veces intentó presionar el botón "NO").

---

## 🛠️ Cómo Hostearlo en Render (Paso a Paso)

Dado que el repositorio ya está en tu cuenta de GitHub (`ShuraRaiden/SayYes`), puedes tener la aplicación en línea y funcional en menos de 5 minutos de forma gratuita:

### Paso 1: Crear una cuenta en Render
1. Entra a [render.com](https://render.com/) y haz clic en **Sign Up**.
2. Regístrate usando tu cuenta de **GitHub** (esto facilitará conectar tu repositorio automáticamente).

### Paso 2: Crear el Web Service
1. Una vez dentro de tu panel de Render, haz clic en el botón **New +** (arriba a la derecha) y selecciona **Web Service**.
2. Render te mostrará una lista de tus repositorios de GitHub. Busca el repositorio `SayYes` y haz clic en **Connect**.

### Paso 3: Configurar los comandos de ejecución
Configura los siguientes campos (la mayoría ya se detectan solos):
- **Name**: `say-yes` (o el nombre que prefieras para tu URL).
- **Region**: Selecciona la más cercana (ej. *Oregon* o *Frankfurt*).
- **Branch**: `main`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `node server.js`

### Paso 4: Configurar la variable de entorno base (CRÍTICO)
1. Desplázate hacia abajo y haz clic en el botón de **Advanced** -> **Add Environment Variable**.
2. Añade una variable con los siguientes datos:
   - **Key**: `BASE_URL`
   - **Value**: La URL que Render te asignará arriba a la izquierda del panel de configuración (debe terminar en `.onrender.com`, ej: `https://say-yes-xxxx.onrender.com`).
3. *(Opcional)* Si quieres configurar el correo para recibir las respuestas reales directamente en tu bandeja de entrada en lugar de verlas en la consola, añade también estas variables:
   - `SMTP_HOST`: Servidor de correo (ej. `smtp.gmail.com` si usas Gmail).
   - `SMTP_PORT`: `587`
   - `SMTP_SECURE`: `false`
   - `SMTP_USER`: Tu correo electrónico.
   - `SMTP_PASS`: Tu contraseña de aplicación (App Password) generada desde la configuración de tu cuenta.
   - `SMTP_FROM_NAME`: `"YES or YES 💌"`

### Paso 5: Desplegar
1. Haz clic en **Create Web Service** al final de la página.
2. Render comenzará a descargar tu código, instalar las dependencias (`npm install`) y encender el servidor (`node server.js`).
3. Cuando el estado cambie a **Live**, haz clic en el enlace público provisto por Render arriba a la izquierda. ¡Tu web ya estará en línea!

---

## 💻 Ejecución Local

Si deseas probar la aplicación localmente en tu ordenador:

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Inicia el servidor:
   ```bash
   npm start
   ```
3. Abre tu navegador en [http://localhost:3000](http://localhost:3000).
