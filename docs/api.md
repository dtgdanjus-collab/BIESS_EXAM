# Contrato de la API — BIESS Postulación

Base: `http://localhost:8080/api` · JSON en UTF-8 · fechas `"YYYY-MM-DD"`.

Rutas protegidas: header `Authorization: Bearer <jwt>` (se obtiene en `POST /auth/login`, expira en `JWT_TTL_HOURS`).

## Formato de error

Todas las respuestas de error tienen la misma forma:

```json
{ "error": { "code": "BLOQUEADO", "message": "Registro fallido, inténtelo nuevamente en 10 minutos", "details": { "segundosRestantes": 600 } } }
```

| HTTP | `code` | Cuándo | `details` |
|---|---|---|---|
| 400 | `VALIDACION` | Datos mal formados | `campos: {campo: mensaje}` o `causa` |
| 401 | `IDENTIDAD` | Validación de identidad incorrecta | `intentosRestantes` |
| 401 | `CREDENCIALES` | Login incorrecto | `intentosRestantes` |
| 401 | `NO_AUTORIZADO` | Sin token, token inválido/expirado, token de registro o recuperación vencido | — |
| 404 | `NO_ENCONTRADO` | Recurso inexistente | — |
| 409 | `CONFLICTO` | Cédula o correo ya registrados | `campo` |
| 422 | `REGLA_NEGOCIO` | Nacionalidad, sector no acreditado, postulación enviada/cerrada, secciones faltantes | `estado`, `codigo`, `cumple`, `etiqueta`, `faltantes` |
| 423 | `BLOQUEADO` | 3 intentos fallidos (10 min) | `segundosRestantes` |
| 500 | `INTERNO` | Error inesperado (sin detalles internos) | — |

## Públicos

| Método | Ruta | Body / Query | Respuesta OK |
|---|---|---|---|
| GET | `/health` | — | `{"postgres":"ok","redis":"ok"}` (503 si alguno falla) |
| GET | `/catalogos/paises` | — | `[{id, nombre}]` |
| GET | `/catalogos/provincias` | `?pais={id}` | `[{id, nombre}]` (vacío si el país no es Ecuador) |
| GET | `/catalogos/cantones` | `?provincia={id}` | `[{id, nombre}]` |
| GET | `/catalogos/parentescos` · `/areas` | — | `[{id, nombre}]` |
| GET | `/catalogos/niveles` | — | `[{id, nombre, orden}]` |
| GET | `/catalogos/sectores` | — | `[{codigo, cargo, tipoRequerido, etiquetaCumple, etiquetaNoCumple, mensajeRechazo, preguntaRespaldo}]` |
| GET | `/catalogos/inhabilidades` | — | `[{id, numeral, texto, respuestaEsperada, requiereDetalle, orden}]` |
| POST | `/auth/verificar-identidad` | `{cedula, fechaExpedicion?, codigoDactilar?, genero?}` (al menos fecha o código; `genero` si se responde 400 con `details.requiereGenero`) | `{registroToken}` (válido 10 min). Con `REGISTRO_CIVIL_AUTOGENERAR=true`, una cédula válida desconocida se da de alta una vez con datos ficticios |
| POST | `/auth/registro` | `{registroToken, email, password}` | 201 `{id, cedula, email, creadoEn}` |
| POST | `/auth/login` | `{cedula, password}` | `{token, expiraEn, usuario:{id, cedula, email, nombres, apellidos}}` |
| POST | `/auth/recuperar` | `{cedula, fechaExpedicion? \| codigoDactilar?}` | `{message, email}` (correo enmascarado; el enlace se imprime en el log) |
| POST | `/auth/restablecer` | `{token, nuevaPassword}` | `{message}` |

Los catálogos se sirven con cache-aside en Redis (`cat:*`, TTL `CATALOGO_TTL_HORAS`).

El bloqueo por intentos usa claves separadas por ámbito: `auth:fail|lock:registro|login|recuperar:{cedula}`.

## Protegidos

Todas las escrituras devuelven la **postulación completa** actualizada (misma forma que `GET /postulacion`).
Toda escritura sobre una postulación `ENVIADA` o `CERRADA` responde **422**.

| Método | Ruta | Body |
|---|---|---|
| GET | `/auth/me` | — → `{id, cedula, email, nombres, apellidos}` |
| GET | `/postulacion` | — (404 si no existe) |
| POST | `/postulacion` | — → 201 creada · 200 ya existía · 422 si no es ecuatoriano (queda `CERRADA`) |
| PUT | `/postulacion/contacto` | `{paisId, provinciaId?, cantonId?, provinciaTexto?, ciudadTexto?, telefonoCelular, correo1, correo2?, callePrincipal, numero?, calleSecundaria?, sector?, referencia?, telefonoDomicilio?}` |
| PUT | `/postulacion/familiares` | `{tieneFamiliares, items:[{nombresApellidos, parentescoId, institucion: "IESS"\|"BIESS", area, cargo}]}` |
| POST | `/postulacion/cargo` | `{sector: "AFILIADOS"\|"JUBILADOS"\|"EMPLEADORES", tieneRespaldo, organizacionNombre?}` |
| PUT | `/postulacion/formacion` | `{items:[{nivelId, institucion, tipo: "NACIONAL"\|"EXTRANJERA", titulo, areaId, registroSenescyt, fechaRegistro}]}` |
| PUT | `/postulacion/experiencia` | `{items:[{tipo: "GENERAL"\|"DIRECCION", cargo, institucion, fechaInicio, fechaFin, areaId, descripcion}]}` |
| PUT | `/postulacion/publicaciones` | `{tienePublicaciones, items:[{titulo, tipo: "PUBLICACION"\|"INVESTIGACION", medio, fecha, relacionada}]}` |
| PUT | `/postulacion/capacitaciones` | `{items:[{tipo: "CURSO"\|"SEMINARIO"\|"TALLER", nombre, institucion, fechaInicio, fechaFin, horas}]}` |
| PUT | `/postulacion/inhabilidades` | `{respuestas:[{preguntaId, respuesta, detalle?:{institucion, cargo, fechaFin, motivo}}]}` (las 13) |
| POST | `/postulacion/enviar` | `{aceptaConsentimiento: true}` |

### Reglas por sección

- **Contacto:** si `paisId` es Ecuador, `provinciaId` y `cantonId` son obligatorios y el cantón debe pertenecer a la provincia; para otro país se usan `provinciaTexto` y `ciudadTexto`.
- **Cargo:** se valida contra el Historial Laboral (mock) según `sectores.tipo_requerido`. Si no cumple → 422 con el `mensajeRechazo` literal y `details.etiqueta`.
- **Experiencia:** cada registro devuelve `duracion: {anios, meses, dias}` (fechas inclusivas) y la postulación incluye `experienciaTotal: {general, direccion, total}`.
- **Inhabilidades:** `detalle` es obligatorio en la 1.9.7 cuando la respuesta es "Sí". Cualquier respuesta distinta de `respuestaEsperada` marca `posibleInhabilidad = true` (no bloquea el envío).
- **Enviar:** transacción única: bloquea la fila, verifica consentimiento y secciones obligatorias (`contacto`, `familiares`, `cargo`, `formacion`, `experiencia`, `publicaciones`, `inhabilidades`; si faltan → 422 con `details.faltantes`), cambia a `ENVIADA` con fecha y registra el historial. Ante cualquier error se hace `ROLLBACK`.

### Demostración del rollback

Con `DEMO_FALLA_ENVIO=true` el INSERT del historial del envío excede `VARCHAR(40)` y PostgreSQL lo rechaza **después** de haber marcado la postulación como `ENVIADA`. El backend responde 500, el log muestra `TX ROLLBACK: … (SQLSTATE 22001)` y la postulación sigue en `BORRADOR`.
