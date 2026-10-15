# ============================================
# Etapa 1: Compilación (Build Stage)
# ============================================
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Instalar herramientas para compilación de módulos nativos (como better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copiar manifiestos de dependencias
COPY package*.json ./

# Instalar todas las dependencias (incluye devDependencies necesarias para compilar)
RUN npm ci

# Copiar el código fuente
COPY . .

# Compilar la aplicación NestJS
RUN npm run build

# Limpiar las dependencias de desarrollo conservando solo las de producción
RUN npm prune --omit=dev

# ============================================
# Etapa 2: Imagen final de producción
# ============================================
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Crear directorio para datos persistentes (base de datos SQLite) y asignar permisos al usuario node
RUN mkdir -p /usr/src/app/data && chown -R node:node /usr/src/app

# Copiar artefactos y dependencias desde la etapa de compilación
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist
COPY --chown=node:node --from=builder /usr/src/app/package*.json ./

# Usar usuario no-root por seguridad
USER node

# Exponer el puerto de la aplicación (por defecto 3001)
EXPOSE 3002

# Arrancar la aplicación compilada
CMD ["node", "dist/main.js"]

