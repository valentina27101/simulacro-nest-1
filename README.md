# API de Solicitudes Comerciales (NestJS)

API REST para registrar solicitudes de seguimiento comercial y gestionar su estado según el rol del usuario. Es la solución a la "Simulación prueba de desempeño API REST con NestJS".

## 1. Qué hace la API

- Registra solicitudes comerciales (siempre nacen en estado `PENDIENTE`).
- Consulta solicitudes: admin y supervisor ven todas; un asesor solo ve las suyas.
- Cambia el estado de una solicitud: `PENDIENTE → EN_GESTION → RESUELTA`, nada más.
- Protege todos los endpoints con `x-api-key` y exige un usuario válido en `x-user`.
- Responde siempre con un formato uniforme (éxito y error) y se documenta en Swagger.

## 2. Tecnologías

Node.js, NestJS 11 + Nest CLI, TypeScript, TypeORM 0.3, SQLite (driver `better-sqlite3`), `class-validator` / `class-transformer`, `@nestjs/config` (.env), `@nestjs/swagger`, Jest + Supertest para las pruebas.

## 3. Instalación

Requiere Node.js 20 o superior. En PowerShell, dentro de la carpeta del proyecto:

```powershell
npm install
```

### Cómo se creó el proyecto (comandos con Nest CLI)

```powershell
npm install -g @nestjs/cli@11
nest new solicitudes-api --package-manager npm --strict
cd solicitudes-api
npm install @nestjs/typeorm@11 typeorm@0.3 better-sqlite3 @nestjs/config @nestjs/swagger@11 class-validator class-transformer
npm install -D supertest @types/supertest
nest g module users
nest g service users --no-spec
nest g module solicitudes
nest g controller solicitudes --no-spec
nest g service solicitudes --no-spec
```

> Nota: el proyecto entregado se generó con una versión más nueva del CLI y luego se fijó en Nest 11. Los comandos de arriba son los equivalentes con CLI 11; no se ejecutaron tal cual en esta entrega.

## 4. Configurar el `.env`

```powershell
Copy-Item .env.example .env
```

Contenido de `.env.example` (valores ficticios):

```
PORT=3000
API_KEYS=clave-prueba-1,clave-prueba-2
DB_PATH=solicitudes.sqlite
```

- `API_KEYS`: lista de claves válidas separadas por comas (se ignoran los espacios). Cualquiera de ellas sirve.
- `DB_PATH`: archivo SQLite. Se crea solo al arrancar.
- El `.env` real está en `.gitignore` y no se sube a Git.

## 5. Ejecutar en desarrollo

```powershell
npm run start:dev
```

## 6. Compilar

```powershell
npm run build
npm run start:prod
```

## 7. Pruebas

```powershell
npm test
```

Son pruebas e2e (Supertest) con SQLite en memoria y claves propias; no usan tu `.env` ni tu archivo `.sqlite`. Cubren los 22 escenarios pedidos:

| # | Escenario | Prueba |
|---|---|---|
| 1-2 | Sin `x-api-key` / clave inválida → 401 | "Protección con x-api-key y x-user" |
| 3-4 | Primera y segunda clave válidas → 200 | idem |
| 5-6 | Sin `x-user` / usuario inexistente → 401 | idem |
| 7-9 | Registro correcto, datos vacíos → 400, asesor queda como responsable y `PENDIENTE` | "Registro de solicitudes" |
| 10-12 | Admin y supervisor ven todo; asesor solo lo suyo | "Consulta de solicitudes" |
| 13 | Asesor no ve solicitud ajena por id | idem |
| 14 | Asesor no cambia estado de solicitud ajena | "Cambio de estado" |
| 15-17 | Supervisor/admin cambian estado; transiciones permitidas | idem |
| 18-19 | `PENDIENTE → RESUELTA` y reabrir `RESUELTA` → 400 | idem |
| 20 | Solicitud inexistente → 404 | "Consulta" y "Cambio de estado" |
| 21-22 | Formato uniforme de éxito y de error con su código HTTP | "Formato de respuestas" |

## 8. Swagger

Con la app en marcha: **http://localhost:3001/docs**

Pulsa **Authorize**, escribe una API Key (por ejemplo `clave-prueba-1`) y en cada endpoint llena el encabezado `x-user` (por ejemplo `asesor1`).

## 9. Usuarios de prueba

Están definidos en el servidor (`src/users/users.data.ts`). El rol sale de esa lista, nunca del cliente.

| `x-user` | Nombre | Rol |
|---|---|---|
| `admin1` | Ana Administradora | admin |
| `supervisor1` | Sergio Supervisor | supervisor |
| `asesor1` | Carlos Asesor | asesor |
| `asesor2` | Laura Asesora | asesor |

## 10. Probar los endpoints (PowerShell)

Define los encabezados una vez:

```powershell
$h = @{ "x-api-key" = "clave-prueba-1"; "x-user" = "asesor1" }
$url = "http://localhost:3000"
```

**POST /solicitudes** — registrar

```powershell
$body = @{ cliente = "Empresa ABC S.A.S."; descripcion = "Pide cotización de 50 licencias" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$url/solicitudes" -Headers $h -ContentType "application/json" -Body $body
```

**GET /solicitudes** — listar las permitidas

```powershell
Invoke-RestMethod -Uri "$url/solicitudes" -Headers $h
```

**GET /solicitudes/:id** — consultar una

```powershell
Invoke-RestMethod -Uri "$url/solicitudes/1" -Headers $h
```

**PATCH /solicitudes/:id/estado** — cambiar estado

```powershell
$body = @{ estado = "EN_GESTION" } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$url/solicitudes/1/estado" -Headers $h -ContentType "application/json" -Body $body
```

Para probar otro usuario o clave, cambia el valor en `$h` (por ejemplo `$h["x-user"] = "supervisor1"` o `$h["x-api-key"] = "clave-prueba-2"`).

> `Invoke-RestMethod` lanza una excepción cuando la API responde un error (401, 404...). Para ver el cuerpo del error usa `curl.exe -i` o Swagger.

## 11. Respuestas esperadas

Éxito (`201` al crear, `200` en el resto):

```json
{
  "success": true,
  "data": {
    "id": 1,
    "cliente": "Empresa ABC S.A.S.",
    "descripcion": "Pide cotización de 50 licencias",
    "asesor": "asesor1",
    "estado": "PENDIENTE",
    "creadaEn": "2026-10-12T15:30:00.000Z",
    "actualizadaEn": "2026-10-12T15:30:00.000Z"
  }
}
```

En las listas, `data` es un arreglo de solicitudes.

Error:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "No se puede cambiar una solicitud de PENDIENTE a RESUELTA",
  "timestamp": "2026-10-12T15:30:00.000Z"
}
```

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos, propiedades no permitidas, id no numérico, estado inexistente o transición no permitida |
| 401 | Falta o es inválida la `x-api-key`; falta `x-user` o el usuario no existe |
| 403 | El rol no está autorizado en el endpoint (`@Roles`) |
| 404 | La solicitud no existe **o** pertenece a otro asesor |
| 500 | Error inesperado (el detalle solo se escribe en la consola) |

En los errores de validación, `message` es una lista con cada problema.

## 12. Comprobar que se guarda en SQLite

Los datos quedan en el archivo `solicitudes.sqlite` (raíz del proyecto). Para verlos sin instalar nada más:

```powershell
node -e "const D=require('better-sqlite3');console.log(new D('solicitudes.sqlite').prepare('select * from solicitudes').all())"
```

También puedes abrir el archivo con "DB Browser for SQLite". Si reinicias la app, las solicitudes siguen ahí.

## Decisiones técnicas

- **Guards globales** (`APP_GUARD` en `AppModule`) en este orden: `ApiKeyGuard` → `UserGuard` → `RolesGuard`. Así ningún endpoint queda sin proteger.
- **`@Roles()` en los 4 endpoints** con los tres roles: todos los usuarios válidos pueden usarlos; lo que cambia es *qué solicitudes* ven o modifican (se resuelve en el servicio).
- **Asesor ajeno → 404**, no 403: la consulta ya filtra por asesor en la base de datos, y así no se confirma que ese id existe. El mensaje aclara "no existe o no tienes acceso".
- **Solicitudes de admin/supervisor**: el documento no dice cómo asignar otro asesor, así que el responsable es quien registra (no se agregó un campo `asesor` al DTO). Enviar `asesor`, `estado`, `id` o fechas en el cuerpo devuelve 400.
- **`synchronize: true`** crea las tablas automáticamente; en producción se usarían migraciones.
- **Driver `better-sqlite3`**: es el driver SQLite que usa TypeORM; sigue siendo SQLite.
- **Fechas**: SQLite guarda segundos, por eso `creadaEn` y `actualizadaEn` pueden ser iguales si el cambio ocurre en el mismo segundo.
- La identificación por `x-user` es solo académica; no sirve como autenticación real.

## Estructura

```
src/
  main.ts                      ValidationPipe, interceptor, filtro y Swagger
  app.module.ts                ConfigModule, TypeORM y guards globales
  config/configuration.ts      Lee API_KEYS, PORT y DB_PATH
  common/
    decorators/                @Roles() y @CurrentUser()
    guards/                    api-key, user y roles
    interceptors/              respuesta { success, data }
    filters/                   errores { success, statusCode, message, timestamp }
    interfaces/                Rol y AuthenticatedUser
  users/                       usuarios de prueba en memoria + UsersService
  solicitudes/                 controlador, servicio, entidad y DTO
test/solicitudes.e2e-spec.ts   pruebas automatizadas
```
