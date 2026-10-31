# Guion de sustentación (10 minutos)

## Antes de empezar

```bash
docker compose down -v && docker compose up -d   # base limpia
cd backend && go run ./cmd/api                    # terminal 1 (dejar el log visible)
cd frontend && npm run dev                        # terminal 2
```

Tener abiertos: el navegador en `http://localhost:5173`, el log del backend, una terminal con `docker exec -it biess_redis redis-cli` y el editor con los archivos citados.

---

## 1. Arquitectura (1 min)

- Abrir [backend/cmd/api/main.go](../backend/cmd/api/main.go): el *wiring* muestra config → postgres → redis → **repositories → caches → services → handlers**. Cada constructor recibe interfaces.
- Mostrar una interfaz en el consumidor, por ejemplo `handler.AuthService` en [handler/auth.go](../backend/internal/handler/auth.go), y explicar que por eso [service/auth_test.go](../backend/internal/service/auth_test.go) prueba el bloqueo sin PostgreSQL ni Redis.
- Errores: el service devuelve `domain.ErrBloqueado` y [middleware/errors.go](../backend/internal/middleware/errors.go) lo traduce a 423.

## 2. Bloqueo con Redis en vivo (2 min) — persona F

1. En `/registro`, cédula `0106789019` con el código dactilar incorrecto `E0000V0000`.
2. Primer intento: "La información ingresada es incorrecta" y "Le quedan 2 intentos".
3. En redis-cli: `GET auth:fail:registro:0106789019` → `1`, `TTL …` → ~600.
4. Tercer intento: "Registro fallido, inténtelo nuevamente en 10 minutos", con la **cuenta regresiva** y el formulario deshabilitado.
5. `TTL auth:lock:registro:0106789019` → segundos restantes. Con los datos correctos (`E7777V8888`) sigue bloqueado.
6. Mostrar el script Lua de [cache/intentos.go](../backend/internal/cache/intentos.go): `INCR + EXPIRE + SET lock` en una sola operación atómica.
7. Caché de catálogos: en el log aparecen `CACHE MISS cat:paises` y luego `CACHE HIT`; `TTL cat:paises` ≈ 86400.

## 3. Registro y login (1 min) — persona A

- Registro con `0102345675` y fecha de expedición `2019-06-20`, luego correo y contraseña.
- Login y entrada a `/formulario`. Explicar el JWT y que el interceptor de Axios lo agrega en cada petición ([frontend/src/api/client.js](../frontend/src/api/client.js)).

## 4. Formulario (3 min)

- **Iniciar postulación:** se genera el código `BIESS-2026-00000N` y se cargan los datos del Registro Civil (solo lectura).
- **Domicilio:** País Ecuador → Provincia → Cantón. Al cambiar de provincia, el cantón se limpia y aparece un spinner en el select. Con España se muestran campos de texto libre.
- **Cargo:** elegir "Jubilados" con la persona A → ✖ con el mensaje literal del requerimiento; elegir "Afiliados" → ✔.
- **Experiencia:** la calculadora de años, meses y días se actualiza en vivo.
- **Rechazo por nacionalidad:** cerrar sesión, registrar a la persona D (`0923456784`, dactilar `E1234V5678`) e iniciar la postulación → pantalla "Postulación cerrada" (el backend la guarda como CERRADA y responde 422).

## 5. Transacción y rollback (2 min)

- Abrir [repository/store.go](../backend/internal/repository/store.go) (`WithTx`) y `Enviar` en [service/postulacion_secciones.go](../backend/internal/service/postulacion_secciones.go): bloqueo `FOR UPDATE`, verificación de secciones y consentimiento, `UPDATE` a ENVIADA, INSERT en el historial y `COMMIT`.
- **Demo del rollback:** reiniciar el backend con la falla forzada y enviar la postulación:
  - bash: `DEMO_FALLA_ENVIO=true go run ./cmd/api`
  - PowerShell: `$env:DEMO_FALLA_ENVIO='true'; go run ./cmd/api` (luego `Remove-Item Env:DEMO_FALLA_ENVIO`)
  - Respuesta 500; el log muestra `TX ROLLBACK: … value too long for type character varying(40) (SQLSTATE 22001)`.
  - `SELECT estado, fecha_envio FROM postulaciones;` → sigue en **BORRADOR** y sin fecha, aunque el `UPDATE` a ENVIADA ya se había ejecutado dentro de la transacción.
- Reiniciar sin la variable, enviar de nuevo → ENVIADA, comprobante imprimible y `CORREO SIMULADO` en el log.

## 6. Preguntas (1 min)

Respuestas preparadas:

- **¿Por qué la transacción va en el `context`?** Para que el service coordine varias escrituras sin importar pgx; el repository usa la transacción si existe y, si no, el pool.
- **¿Qué pasa si Redis se cae?** Los catálogos se sirven desde PostgreSQL (registrando `CACHE ERROR`) y `/health` responde 503.
- **¿Por qué se valida en el frontend y también en el backend?** El frontend da retroalimentación inmediata; el backend es la autoridad (cédula por módulo 10, cascada, nacionalidad, sector).
- **¿Las inhabilidades bloquean?** No: marcan `posible_inhabilidad` para la revisión de Talento Humano.
