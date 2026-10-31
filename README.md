# Sistema de Registro y Postulación al Directorio del BIESS

Módulo inicial de registro y postulación al **Concurso Público de Méritos y Oposición del Directorio del BIESS**, basado en el Requerimiento Funcional IESS v1.4 (Resolución C.D. 701).

**Alcance:** EF-11 (registro y autenticación) y EF-12 (formulario de postulación). EF-13 (administración) y EF-14 (evaluación teórica) se dejan como [trabajo futuro](#trabajo-futuro).

| Capa | Tecnología |
|---|---|
| Backend | Go · Fiber v2 · pgx v5 · go-redis v9 · golang-jwt v5 · bcrypt |
| Base de datos | PostgreSQL 16 |
| Caché | Redis 7 |
| Frontend | React 19 + Vite 8 · Tailwind CSS 4 · React Router 7 · Zustand · React Hook Form + Zod · Axios |
| Infraestructura local | Docker Compose (PostgreSQL + Redis) |

---

## Prerrequisitos

| Herramienta | Versión | Verificar con |
|---|---|---|
| Go | **1.27** o superior (lo exige `backend/go.mod`) | `go version` |
| Node.js | **20.19+ o 22.12+** (probado con 24.16) | `node --version` |
| npm | 10+ (probado con 11.13) | `npm --version` |
| Docker + Docker Compose | Docker Desktop 4.x / Engine 24+ | `docker compose version` |
| PostgreSQL | 16 (lo levanta Docker) | — |
| Redis | 7 (lo levanta Docker) | — |

## Ejecución local

```bash
# 1. Variables de entorno
cp .env.example .env                    # usado por docker compose y por el backend
cp frontend/.env.example frontend/.env

# 2. PostgreSQL y Redis (la primera vez ejecutan db/01..03 automáticamente)
docker compose up -d
docker compose ps                       # ambos servicios "healthy"

# 3. Backend → http://localhost:8080/api
cd backend
go run ./cmd/api

# 4. Frontend → http://localhost:5173  (en otra terminal)
cd frontend
npm install
npm run dev
```

Comprobación rápida: `curl http://localhost:8080/api/health` → `{"postgres":"ok","redis":"ok"}`.

> **Puerto 5432 ocupado:** si ya tiene PostgreSQL instalado en Windows, ponga `DB_PORT=5433` en `.env`. El contenedor se publicará en ese puerto y el backend se conectará a él.

Para recrear la base desde cero: `docker compose down -v && docker compose up -d`.

### Variables de entorno (`.env`)

| Variable | Valor por defecto | Uso |
|---|---|---|
| `DB_HOST` · `DB_PORT` · `DB_USER` · `DB_PASSWORD` · `DB_NAME` | `localhost` · `5432` · `biess` · `biess_secret` · `biess_postulacion` | Conexión a PostgreSQL |
| `REDIS_ADDR` | `localhost:6379` | Conexión a Redis |
| `API_PORT` | `8080` | Puerto del backend |
| `JWT_SECRET` · `JWT_TTL_HOURS` | — · `2` | Firma y duración del JWT (el secreto es obligatorio) |
| `CORS_ORIGINS` · `FRONTEND_URL` | `http://localhost:5173` | CORS y base del enlace de recuperación |
| `MAX_INTENTOS` · `BLOQUEO_MINUTOS` | `3` · `10` | Bloqueo por intentos fallidos (EF-11) |
| `CATALOGO_TTL_HORAS` | `24` | TTL de la caché de catálogos |
| `DEMO_FALLA_ENVIO` | `false` | Solo para la sustentación: fuerza el ROLLBACK del envío |

## Datos de prueba

No hay usuarios precargados: cada persona se **registra** en `/registro` con su cédula y **uno** de los dos datos de identidad. Los datos son ficticios; las cédulas son válidas por módulo 10.

| Caso | Cédula | Fecha de expedición | Código dactilar | Escenario |
|---|---|---|---|---|
| A | `0102345675` | 2019-06-20 | `V4443V4442` | Afiliada, soltera: camino feliz (sector Afiliados) |
| B | `0103456786` | 2018-02-14 | `E2331I2222` | Jubilado, casado: muestra datos del cónyuge |
| C | `1712345675` | 2021-08-05 | `V3333V1111` | Empleadora y afiliada, unión de hecho |
| D | `0923456784` | 2022-03-11 | `E1234V5678` | Nacionalidad colombiana → postulación **cerrada** |
| E | `1105678906` | 2020-12-01 | `V5555I6666` | Sin historial laboral → rechazo en cualquier sector |
| F | `0106789019` | 2023-01-17 | `E7777V8888` | Probar el bloqueo: 3 intentos fallidos → 10 min |

Los correos (recuperación de contraseña y postulación enviada) se simulan: aparecen en la consola del backend como `CORREO SIMULADO → …`.

## Pruebas automáticas

```bash
cd backend  && go test ./...     # validadores, JWT, cálculo de duración, AuthService con dobles en memoria
cd frontend && npm test          # rutas protegidas, pantallas de auth, cascada, formulario y envío
```

## Arquitectura

```
backend/
├── cmd/api/main.go        # wiring: config → pg → redis → repositories → caches → services → handlers
├── internal/
│   ├── config/            # .env → struct Config validado
│   ├── platform/          # pool pgx y cliente Redis
│   ├── domain/            # entidades y errores de dominio (sin dependencias de infraestructura)
│   ├── repository/        # interfaces + pgx; Store.WithTx (transacciones en el context)
│   ├── cache/             # interfaces + Redis: catálogos, intentos (Lua atómico), tokens
│   ├── service/           # reglas de negocio EF-11 / EF-12
│   ├── handler/           # Fiber: DTOs, rutas
│   └── middleware/        # errores uniformes, JWT, CORS, recover, logger
└── pkg/                   # validator (cédula, dactilar…), jwtutil
frontend/src/
├── api/                   # axios + interceptores (JWT, ApiError, 401 → logout)
├── store/                 # sesión (Zustand persistido)
├── hooks/                 # useAsync, useCountdown, useBloqueo, useCatalogo
├── routes/                # ProtectedRoute, AppRouter
├── components/ui/         # Button(loading), Input, Select(spinner), Alert, Card, Modal, Stepper…
└── features/              # auth (registro en 2 pasos, login, recuperación) y postulacion (10 secciones)
```

- **Inyección de dependencias:** cada capa recibe por constructor las **interfaces** que necesita; las implementaciones concretas solo se conocen en `main.go`. Gracias a eso, `AuthService` se prueba con dobles en memoria (`service/auth_test.go`).
- **Transacciones:** `repository.Store.WithTx` hace `BEGIN`, ejecuta la función y luego `COMMIT`, o `ROLLBACK` si hubo error o panic. La transacción viaja en el `context`, así que los services no importan pgx. Toda escritura de la postulación bloquea la fila con `SELECT … FOR UPDATE`.
- **Errores:** los services devuelven errores de dominio y un único middleware los traduce a HTTP con el formato `{error:{code,message,details}}`.
- **Redis:** bloqueo de 3 intentos con claves separadas para registro, login y recuperación (script Lua atómico); cache-aside de catálogos con TTL de 24 h; tokens de registro (10 min) y de recuperación (15 min) de un solo uso.

El contrato completo de la API está en [docs/api.md](docs/api.md) y el guion de la demo en [docs/sustentacion.md](docs/sustentacion.md).

## Entregables

| Entregable | Ubicación |
|---|---|
| DDL + datos semilla en un solo archivo | [docs/biess_postulacion.sql](docs/biess_postulacion.sql) (también separado en `db/01..03`) |
| Docker Compose | [docker-compose.yml](docker-compose.yml) |
| Variables de ejemplo | [.env.example](.env.example), [backend/.env.example](backend/.env.example), [frontend/.env.example](frontend/.env.example) |
| Contrato de la API | [docs/api.md](docs/api.md) |

## Flujo de Git

Ramas `main` (entregas) y `develop` (integración). Cada fase se desarrolló en `feature/fase-XX-nombre` y se fusionó a `develop` con `--no-ff`. Los commits usan prefijos convencionales (`feat`, `fix`, `chore`, `docs`).

## Trabajo futuro

- **EF-13 Administración:** panel de Talento Humano para revisar postulaciones, incluidas las marcadas con `posible_inhabilidad`.
- **EF-14 Evaluación teórica.**
- **Documentos PDF de respaldo:** la tabla `documentos` ya existe; falta el endpoint multipart (solo PDF, 4 MB para el respaldo de la organización, 2 MB para el resto, 50 MB por postulante).
- **Integraciones reales** con el Registro Civil y el Historial Laboral del IESS (hoy simuladas con tablas mock) y envío real de correos.
- **Despliegue** en un VPS con Docker Compose (backend + frontend en Nginx), dominio y HTTPS.
