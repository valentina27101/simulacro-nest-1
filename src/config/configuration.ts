// Lee las variables de entorno y las deja listas para usar.
// Las API Keys NUNCA se escriben en el código: vienen de la variable API_KEYS.
export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  // "clave1, clave2" -> ['clave1', 'clave2'] (sin espacios y sin valores vacíos)
  apiKeys: (process.env.API_KEYS ?? '')
    .split(',')
    .map((clave) => clave.trim())
    .filter((clave) => clave.length > 0),
  database: {
    path: process.env.DB_PATH ?? 'solicitudes.sqlite',
  },
});
