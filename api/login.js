
// api/login.js
export default function handler(request, response) {
  // Solo permitir peticiones POST
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  const { password } = request.body;

  // Obtener la contraseña desde las variables de entorno del servidor (en Vercel)
  const adminPassword = process.env.BIBLIOTECA_ADMIN;

  if (!adminPassword) {
    return response.status(500).json({ isValid: false, message: 'La variable de entorno del administrador no está configurada en el servidor.' });
  }

  if (password === adminPassword) {
    // La contraseña es correcta
    return response.status(200).json({ isValid: true });
  } else {
    // La contraseña es incorrecta
    return response.status(401).json({ isValid: false });
  }
}
