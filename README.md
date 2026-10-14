# API de Solicitudes Comerciales (NestJS)

API REST para registrar solicitudes de seguimiento comercial y gestionar su estado según el rol del usuario. Es la solución a la Simulación prueba de desempeño API REST con NestJS.

## 1. Qué hace la API

- Registra solicitudes comerciales (siempre nacen en estado `PENDIENTE`).
- Consulta solicitudes con filtros y paginación: admin y supervisor ven todas; un asesor solo las que tiene asignadas.
- Cambia el estado de una solicitud: `PENDIENTE → EN_GESTION → RESUELTA`, nada más.
- (Parte 2) Asigna y reasigna solicitudes a asesores, y guarda un historial de auditoría de cada cambio.
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

Son 69 pruebas e2e (Supertest) en dos archivos: `test/solicitudes.e2e-spec.ts` (parte 1) y `test/parte2.e2e-spec.ts` (parte 2). Usan SQLite en memoria y claves propias; no usan tu `.env` ni tu archivo `.sqlite`. Los escenarios de la parte 1 son:

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

Con la app en marcha: **http://localhost:3000/docs**

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

En `GET /solicitudes`, `data` es `{ items, pagination }` (ver la sección de la parte 2). En el historial, `data` es un arreglo de eventos.

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
| 404 | La solicitud no existe **o** no está asignada al asesor que la consulta |
| 409 | Reasignar una solicitud `RESUELTA`, o asignarla al asesor que ya la tiene |
| 500 | Error inesperado (el detalle solo se escribe en la consola) |

En los errores de validación, `message` es una lista con cada problema.

## 12. Comprobar que se guarda en SQLite

Los datos quedan en el archivo `solicitudes.sqlite` (raíz del proyecto). Para verlos sin instalar nada más:

```powershell
node -e "const D=require('better-sqlite3');console.log(new D('solicitudes.sqlite').prepare('select * from solicitudes').all())"
```

El historial está en la tabla `solicitud_historial`:

```powershell
node -e "const D=require('better-sqlite3');console.log(new D('solicitudes.sqlite').prepare('select * from solicitud_historial').all())"
```

También puedes abrir el archivo con "DB Browser for SQLite". Si reinicias la app, las solicitudes siguen ahí.

## Parte 2: asignación, filtros, paginación e historial

Esta parte agrega RN-07 (asignación), RN-08 (filtros y paginación) y RN-09 (historial). No se implementaron RN-10 (control de concurrencia) ni RN-11.

### Cómo ejecutar

Igual que antes: `npm install`, copiar `.env.example` a `.env` y `npm run start:dev`. No hay variables nuevas.

### Cómo se guardan los datos

- Las solicitudes están en la tabla `solicitudes` y los eventos en `solicitud_historial` (relacionada por `solicitudId`), ambas en el mismo archivo SQLite (`DB_PATH`).
- El esquema se crea y actualiza solo al arrancar (`synchronize: true`; no hay migraciones). Si ya tenías un `solicitudes.sqlite` de la parte 1, se actualiza conservando las solicitudes, pero **esas solicitudes antiguas no tienen eventos de historial**, porque se crearon antes. Si prefieres empezar limpio, borra el archivo `solicitudes.sqlite` con la app apagada.
- Índices: `estado`, `asesor` y `creadaEn` en `solicitudes`, y `solicitudId` en `solicitud_historial`.
- Crear una solicitud, cambiar su estado o asignarla guarda el cambio **y** su evento en una sola transacción (`dataSource.transaction`). Si falla uno, se revierten los dos.

### Endpoints nuevos y ampliados

| Método | Endpoint | Quién | Qué hace |
|---|---|---|---|
| GET | `/solicitudes` | todos los usuarios válidos | Filtros y paginación |
| PATCH | `/solicitudes/:id/asignacion` | admin, supervisor | Asignar o reasignar a un asesor |
| GET | `/solicitudes/:id/historial` | admin, supervisor; asesor si la tiene asignada | Ver los eventos |

### Ejemplos con curl (PowerShell)

Usa `curl.exe` (en PowerShell, `curl` solo es un alias de otro comando). Los encabezados `x-api-key` y `x-user` son obligatorios. Si prefieres evitar el manejo de comillas, usa Swagger (`/docs`).

```powershell
# Crear como supervisor: queda sin asignar (asesor = null)
curl.exe -X POST http://localhost:3000/solicitudes -H "x-api-key: clave-prueba-1" -H "x-user: supervisor1" -H "Content-Type: application/json" -d "{\"cliente\":\"Ferretería El Norte\",\"descripcion\":\"Coordinar visita\"}"

# Asignar a un asesor (admin o supervisor)
curl.exe -X PATCH http://localhost:3000/solicitudes/1/asignacion -H "x-api-key: clave-prueba-1" -H "x-user: supervisor1" -H "Content-Type: application/json" -d "{\"asesorId\":\"asesor2\"}"

# Un asesor intenta asignar -> 403
curl.exe -i -X PATCH http://localhost:3000/solicitudes/1/asignacion -H "x-api-key: clave-prueba-1" -H "x-user: asesor1" -H "Content-Type: application/json" -d "{\"asesorId\":\"asesor1\"}"

# Filtros combinados y paginación (las comillas son necesarias por el &)
curl.exe "http://localhost:3000/solicitudes?estado=PENDIENTE&cliente=norte&desde=2026-10-01T00:00:00Z&hasta=2026-12-31T23:59:59Z&page=1&limit=5" -H "x-api-key: clave-prueba-1" -H "x-user: admin1"

# Parámetro inválido -> 400
curl.exe -i "http://localhost:3000/solicitudes?limit=1000" -H "x-api-key: clave-prueba-1" -H "x-user: admin1"

# Historial
curl.exe http://localhost:3000/solicitudes/1/historial -H "x-api-key: clave-prueba-1" -H "x-user: admin1"
```

### RN-07 Asignación

- `PATCH /solicitudes/:id/asignacion` con `{ "asesorId": "asesor2" }`. Solo `admin` y `supervisor` (se controla con `@Roles`, igual que el resto; un asesor recibe 403).
- `asesorId` debe existir en el catálogo y tener rol `asesor`; si no, 400. No se puede asignar a un admin ni a un supervisor.
- No cambia el estado. Si la solicitud está `RESUELTA`, responde **409**. Asignarla al asesor que ya la tiene también responde 409 (decisión propia: no tendría sentido guardar un evento sin cambio).
- Guarda un evento `ASIGNACION` con el asesor anterior (puede ser `null`) y el nuevo.

### RN-08 Filtros y paginación

Parámetros opcionales de `GET /solicitudes`:

| Parámetro | Detalle |
|---|---|
| `estado` | `PENDIENTE`, `EN_GESTION` o `RESUELTA` |
| `asesor` | username del asesor asignado |
| `cliente` | búsqueda parcial; SQLite no distingue mayúsculas en letras ASCII (las tildes sí cuentan) |
| `desde`, `hasta` | fecha ISO 8601 sobre `creadaEn`; `desde` no puede ser posterior a `hasta` |
| `page` | entero ≥ 1 (por defecto 1) |
| `limit` | entero de 1 a 100 (por defecto 10) |

- Se aplican todos los enviados a la vez. Cualquier valor inválido o parámetro desconocido devuelve 400.
- Todo se resuelve en la consulta a SQLite (`WHERE` + `LIMIT/OFFSET` + `COUNT`); no se carga la tabla completa en memoria.
- El filtro de permisos va dentro del mismo `WHERE`. Un asesor siempre ve solo lo asignado a él: si envía `asesor=otro`, el parámetro se ignora y recibe sus propias solicitudes (no un error). Las solicitudes sin asignar solo las ven admin y supervisor.
- Las solicitudes salen ordenadas por `id` para que las páginas sean estables.

Respuesta:

```json
{
  "success": true,
  "data": {
    "items": [ { "id": 1, "cliente": "...", "asesor": "asesor1", "estado": "PENDIENTE", "...": "..." } ],
    "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
  }
}
```

> Cambio respecto a la parte 1: antes `data` era directamente el arreglo; ahora es `{ items, pagination }`.

### RN-09 Historial

- Entidad `SolicitudHistorial`: `id`, `solicitudId`, `tipoEvento` (`CREACION`, `ESTADO` o `ASIGNACION`), `valorAnterior`, `valorNuevo`, `usuarioActor` y `fechaEvento`.
- Se registra: `CREACION` (valor nuevo `PENDIENTE`), `ESTADO` en cada cambio de estado y `ASIGNACION` en cada asignación o reasignación. Los intentos rechazados (400, 403, 404, 409) no generan eventos.
- `usuarioActor` sale del `x-user` ya validado, nunca del cuerpo.
- Es de solo lectura: solo existe `GET /solicitudes/:id/historial`. Cualquier POST, PUT, PATCH o DELETE sobre el historial devuelve 404 porque esas rutas no existen.
- Admin y supervisor ven el historial de cualquier solicitud. Un asesor solo el de las solicitudes que tiene asignadas **actualmente**; si no, 404 (misma política que `GET /solicitudes/:id`). Si una solicitud se reasigna, el asesor anterior pierde el acceso.
- Orden: del evento más antiguo al más reciente (`fechaEvento`, y `id` para desempatar, porque SQLite guarda las fechas en segundos).

Ejemplo de respuesta:

```json
{
  "success": true,
  "data": [
    { "id": 1, "solicitudId": 1, "tipoEvento": "CREACION", "valorAnterior": null, "valorNuevo": "PENDIENTE", "usuarioActor": "supervisor1", "fechaEvento": "2026-10-13T15:00:00.000Z" },
    { "id": 2, "solicitudId": 1, "tipoEvento": "ASIGNACION", "valorAnterior": null, "valorNuevo": "asesor2", "usuarioActor": "supervisor1", "fechaEvento": "2026-10-13T15:01:00.000Z" }
  ]
}
```

### Pruebas de la parte 2

`npm test` ejecuta todo (partes 1 y 2). Las de la parte 2 están en `test/parte2.e2e-spec.ts` y cubren los escenarios 01 al 07, 10, 11 y 12 del documento, más filtros individuales y combinados, paginación, historial y que no existan endpoints para modificarlo. El escenario 10 (fallo al guardar el historial) hace fallar el guardado del evento a propósito y comprueba que la solicitud queda sin cambios. Los escenarios 08 y 09 son de RN-10 y no se incluyen.

## Decisiones técnicas

- **Guards globales** (`APP_GUARD` en `AppModule`) en este orden: `ApiKeyGuard` → `UserGuard` → `RolesGuard`. Así ningún endpoint queda sin proteger.
- **`@Roles()` en los 4 endpoints** con los tres roles: todos los usuarios válidos pueden usarlos; lo que cambia es *qué solicitudes* ven o modifican (se resuelve en el servicio).
- **Asesor ajeno → 404**, no 403: la consulta ya filtra por asesor en la base de datos, y así no se confirma que ese id existe. El mensaje aclara "no existe o no tienes acceso".
- **Quién queda asignado al crear** (cambió en la parte 2, RN-07): si crea un asesor, queda asignada a él; si crea un admin o supervisor, queda sin asignar (`asesor: null`) hasta que se asigne con `PATCH /solicitudes/:id/asignacion`. Enviar `asesor`, `estado`, `id` o fechas en el cuerpo devuelve 400.
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
  solicitudes/                 controlador, servicio, entidades (Solicitud y SolicitudHistorial) y DTO
test/helpers.ts                crea la app de pruebas (SQLite en memoria)
test/solicitudes.e2e-spec.ts   pruebas de la parte 1
test/parte2.e2e-spec.ts        pruebas de la parte 2
```
