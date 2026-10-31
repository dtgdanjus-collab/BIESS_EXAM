-- =====================================================================
-- Sistema de Registro y Postulación al Directorio del BIESS
-- 01_schema.sql — DDL de creación de tablas (PostgreSQL 16)
-- Referencia funcional: Requerimiento IESS v1.4 — EF-11 y EF-12
-- =====================================================================

SET client_encoding = 'UTF8';
SET timezone = 'America/Guayaquil';

-- ---------------------------------------------------------------------
-- Función genérica para mantener actualizado_en
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 1. CATÁLOGOS (se cachean en Redis)
-- =====================================================================

-- División política: País → Provincia → Cantón
CREATE TABLE paises (
    id      SERIAL       PRIMARY KEY,
    nombre  VARCHAR(80)  NOT NULL UNIQUE
);

CREATE TABLE provincias (
    id       SERIAL      PRIMARY KEY,
    pais_id  INT         NOT NULL REFERENCES paises(id) ON DELETE RESTRICT,
    nombre   VARCHAR(80) NOT NULL,
    CONSTRAINT uq_provincia UNIQUE (pais_id, nombre)
);
CREATE INDEX idx_provincias_pais ON provincias(pais_id);

CREATE TABLE cantones (
    id            SERIAL      PRIMARY KEY,
    provincia_id  INT         NOT NULL REFERENCES provincias(id) ON DELETE RESTRICT,
    nombre        VARCHAR(80) NOT NULL,
    CONSTRAINT uq_canton UNIQUE (provincia_id, nombre)
);
CREATE INDEX idx_cantones_provincia ON cantones(provincia_id);

-- Listas desplegables del formulario (EF-12)
CREATE TABLE parentescos (
    id      SERIAL      PRIMARY KEY,
    nombre  VARCHAR(40) NOT NULL UNIQUE
);

CREATE TABLE niveles_instruccion (
    id      SERIAL       PRIMARY KEY,
    nombre  VARCHAR(80)  NOT NULL UNIQUE,
    orden   SMALLINT     NOT NULL
);

-- Usado en "Área de estudios" (1.5.1.4) y "Actividades relacionadas" (1.6.6)
CREATE TABLE areas_estudio (
    id      SERIAL      PRIMARY KEY,
    nombre  VARCHAR(60) NOT NULL UNIQUE
);

-- Sectores de representación / cargos a los que se postula (1.4)
CREATE TABLE sectores (
    codigo             VARCHAR(12)  PRIMARY KEY,               -- AFILIADOS | JUBILADOS | EMPLEADORES
    cargo              VARCHAR(200) NOT NULL,
    tipo_requerido     VARCHAR(10)  NOT NULL
                       CHECK (tipo_requerido IN ('AFILIADO','JUBILADO','EMPLEADOR')),
    etiqueta_cumple    VARCHAR(80)  NOT NULL,
    etiqueta_no_cumple VARCHAR(80)  NOT NULL,
    mensaje_rechazo    TEXT         NOT NULL,
    pregunta_respaldo  TEXT         NOT NULL
);

-- Preguntas de inhabilidades (1.9)
CREATE TABLE preguntas_inhabilidad (
    id                  SERIAL      PRIMARY KEY,
    numeral             VARCHAR(8)  NOT NULL UNIQUE,           -- "1.9.1"
    texto               TEXT        NOT NULL,
    respuesta_esperada  BOOLEAN     NOT NULL,                  -- respuesta que NO genera inhabilidad
    requiere_detalle    BOOLEAN     NOT NULL DEFAULT FALSE,    -- 1.9.7 despliega subcampos
    orden               SMALLINT    NOT NULL
);

-- =====================================================================
-- 2. SIMULACIÓN DE INTEROPERABILIDAD (servicios externos)
-- =====================================================================

-- Simula el servicio del Registro Civil del Ecuador
CREATE TABLE mock_registro_civil (
    cedula            CHAR(10)     PRIMARY KEY,
    nombres           VARCHAR(100) NOT NULL,
    apellidos         VARCHAR(100) NOT NULL,
    genero            VARCHAR(10)  NOT NULL CHECK (genero IN ('MASCULINO','FEMENINO')),
    fecha_nacimiento  DATE         NOT NULL,
    nacionalidad      VARCHAR(40)  NOT NULL,
    estado_civil      VARCHAR(20)  NOT NULL
                      CHECK (estado_civil IN ('SOLTERO/A','CASADO/A','DIVORCIADO/A','VIUDO/A','UNION DE HECHO')),
    conyuge_nombres   VARCHAR(200),
    conyuge_cedula    CHAR(10),
    fecha_expedicion  DATE         NOT NULL,
    codigo_dactilar   VARCHAR(10)  NOT NULL
);

-- Simula el Historial Laboral del IESS (calidad de afiliado/jubilado/empleador)
CREATE TABLE mock_historial_laboral (
    cedula  CHAR(10)    NOT NULL REFERENCES mock_registro_civil(cedula),
    tipo    VARCHAR(10) NOT NULL CHECK (tipo IN ('AFILIADO','JUBILADO','EMPLEADOR')),
    activo  BOOLEAN     NOT NULL DEFAULT TRUE,
    PRIMARY KEY (cedula, tipo)
);

-- =====================================================================
-- 3. NÚCLEO: usuarios y postulaciones
-- =====================================================================

CREATE TABLE usuarios (
    id              BIGSERIAL    PRIMARY KEY,
    cedula          CHAR(10)     NOT NULL UNIQUE,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(100) NOT NULL,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_usuarios_upd BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- Código único de postulación: BIESS-2026-000001
CREATE SEQUENCE seq_codigo_postulacion START 1;

CREATE TABLE postulaciones (
    id                      BIGSERIAL    PRIMARY KEY,
    usuario_id              BIGINT       NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    codigo                  VARCHAR(20)  NOT NULL UNIQUE,
    estado                  VARCHAR(10)  NOT NULL DEFAULT 'BORRADOR'
                            CHECK (estado IN ('BORRADOR','ENVIADA','CERRADA')),
    motivo_cierre           TEXT,
    -- 1.4 Selección del cargo
    sector_codigo           VARCHAR(12)  REFERENCES sectores(codigo),
    tiene_respaldo          BOOLEAN,
    organizacion_nombre     VARCHAR(200),
    -- Banderas Sí/No de secciones opcionales
    tiene_familiares        BOOLEAN,
    tiene_publicaciones     BOOLEAN,
    -- Resultado de inhabilidades (no bloquea; se marca para revisión de Talento Humano)
    posible_inhabilidad     BOOLEAN      NOT NULL DEFAULT FALSE,
    -- 1.10 Consentimiento LOPDP
    consentimiento_aceptado BOOLEAN      NOT NULL DEFAULT FALSE,
    consentimiento_fecha    TIMESTAMPTZ,
    fecha_envio             TIMESTAMPTZ,
    creado_en               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    actualizado_en          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_cierre_con_motivo CHECK (estado <> 'CERRADA' OR motivo_cierre IS NOT NULL),
    CONSTRAINT ck_envio_con_fecha   CHECK (estado <> 'ENVIADA' OR (fecha_envio IS NOT NULL AND consentimiento_aceptado)),
    CONSTRAINT ck_respaldo_nombre   CHECK (tiene_respaldo IS DISTINCT FROM TRUE OR organizacion_nombre IS NOT NULL)
);
CREATE INDEX idx_postulaciones_estado ON postulaciones(estado);
CREATE INDEX idx_postulaciones_sector ON postulaciones(sector_codigo);
CREATE TRIGGER trg_postulaciones_upd BEFORE UPDATE ON postulaciones
    FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- 1.1 Información personal (copia del Registro Civil al momento de postular)
CREATE TABLE postulacion_datos_personales (
    postulacion_id    BIGINT       PRIMARY KEY REFERENCES postulaciones(id) ON DELETE CASCADE,
    cedula            CHAR(10)     NOT NULL,
    nombres           VARCHAR(100) NOT NULL,
    apellidos         VARCHAR(100) NOT NULL,
    genero            VARCHAR(10)  NOT NULL,
    fecha_nacimiento  DATE         NOT NULL,
    nacionalidad      VARCHAR(40)  NOT NULL,
    estado_civil      VARCHAR(20)  NOT NULL,
    conyuge_nombres   VARCHAR(200),
    conyuge_cedula    CHAR(10)
);

-- 1.2 Información domiciliaria y de contacto
CREATE TABLE postulacion_contacto (
    postulacion_id      BIGINT       PRIMARY KEY REFERENCES postulaciones(id) ON DELETE CASCADE,
    pais_id             INT          NOT NULL REFERENCES paises(id),
    provincia_id        INT          REFERENCES provincias(id),   -- si país = Ecuador
    canton_id           INT          REFERENCES cantones(id),     -- si país = Ecuador
    provincia_texto     VARCHAR(80),                              -- si país ≠ Ecuador
    ciudad_texto        VARCHAR(80),                              -- si país ≠ Ecuador
    telefono_celular    VARCHAR(15)  NOT NULL,
    correo1             VARCHAR(150) NOT NULL,
    correo2             VARCHAR(150),
    calle_principal     VARCHAR(150) NOT NULL,
    numero              VARCHAR(20),
    calle_secundaria    VARCHAR(150),
    sector              VARCHAR(100),
    referencia          VARCHAR(250),
    telefono_domicilio  VARCHAR(15),
    CONSTRAINT ck_ubicacion CHECK (
        (provincia_id IS NOT NULL AND canton_id IS NOT NULL)
        OR (provincia_texto IS NOT NULL AND ciudad_texto IS NOT NULL)
    )
);

-- 1.3 Familiares en IESS/BIESS
CREATE TABLE familiares (
    id                 BIGSERIAL    PRIMARY KEY,
    postulacion_id     BIGINT       NOT NULL REFERENCES postulaciones(id) ON DELETE CASCADE,
    nombres_apellidos  VARCHAR(200) NOT NULL,
    parentesco_id      INT          NOT NULL REFERENCES parentescos(id),
    institucion        VARCHAR(5)   NOT NULL CHECK (institucion IN ('IESS','BIESS')),
    area               VARCHAR(150) NOT NULL,
    cargo              VARCHAR(150) NOT NULL
);
CREATE INDEX idx_familiares_post ON familiares(postulacion_id);

-- Documentos PDF de respaldo (metadatos; el archivo vive en disco)
CREATE TABLE documentos (
    id               BIGSERIAL    PRIMARY KEY,
    postulacion_id   BIGINT       NOT NULL REFERENCES postulaciones(id) ON DELETE CASCADE,
    categoria        VARCHAR(20)  NOT NULL
                     CHECK (categoria IN ('RESPALDO_ORG','FORMACION','EXPERIENCIA','PUBLICACION','CAPACITACION')),
    nombre_original  VARCHAR(255) NOT NULL,
    ruta             VARCHAR(400) NOT NULL,
    tamano_bytes     BIGINT       NOT NULL CHECK (tamano_bytes > 0),
    creado_en        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_documentos_post ON documentos(postulacion_id);

-- 1.5 Formación académica
CREATE TABLE formacion_academica (
    id                 BIGSERIAL    PRIMARY KEY,
    postulacion_id     BIGINT       NOT NULL REFERENCES postulaciones(id) ON DELETE CASCADE,
    nivel_id           INT          NOT NULL REFERENCES niveles_instruccion(id),
    institucion        VARCHAR(200) NOT NULL,
    tipo               VARCHAR(10)  NOT NULL CHECK (tipo IN ('NACIONAL','EXTRANJERA')),
    titulo             VARCHAR(200) NOT NULL,
    area_id            INT          NOT NULL REFERENCES areas_estudio(id),
    registro_senescyt  VARCHAR(40)  NOT NULL,
    fecha_registro     DATE         NOT NULL,
    documento_id       BIGINT       REFERENCES documentos(id) ON DELETE SET NULL
);
CREATE INDEX idx_formacion_post ON formacion_academica(postulacion_id);

-- 1.6 Experiencia profesional
CREATE TABLE experiencia (
    id              BIGSERIAL     PRIMARY KEY,
    postulacion_id  BIGINT        NOT NULL REFERENCES postulaciones(id) ON DELETE CASCADE,
    tipo            VARCHAR(10)   NOT NULL CHECK (tipo IN ('GENERAL','DIRECCION')),
    cargo           VARCHAR(150)  NOT NULL,
    institucion     VARCHAR(200)  NOT NULL,
    fecha_inicio    DATE          NOT NULL,
    fecha_fin       DATE          NOT NULL,
    area_id         INT           NOT NULL REFERENCES areas_estudio(id),
    descripcion     VARCHAR(1000) NOT NULL,
    documento_id    BIGINT        REFERENCES documentos(id) ON DELETE SET NULL,
    CONSTRAINT ck_exp_fechas CHECK (fecha_fin >= fecha_inicio)
);
CREATE INDEX idx_experiencia_post ON experiencia(postulacion_id);

-- 1.7 Publicaciones e investigaciones
CREATE TABLE publicaciones (
    id              BIGSERIAL    PRIMARY KEY,
    postulacion_id  BIGINT       NOT NULL REFERENCES postulaciones(id) ON DELETE CASCADE,
    titulo          VARCHAR(300) NOT NULL,
    tipo            VARCHAR(13)  NOT NULL CHECK (tipo IN ('PUBLICACION','INVESTIGACION')),
    medio           VARCHAR(200) NOT NULL,
    fecha           DATE         NOT NULL,
    relacionada     BOOLEAN      NOT NULL,
    documento_id    BIGINT       REFERENCES documentos(id) ON DELETE SET NULL
);
CREATE INDEX idx_publicaciones_post ON publicaciones(postulacion_id);

-- 1.8 Capacitación
CREATE TABLE capacitaciones (
    id              BIGSERIAL    PRIMARY KEY,
    postulacion_id  BIGINT       NOT NULL REFERENCES postulaciones(id) ON DELETE CASCADE,
    tipo            VARCHAR(10)  NOT NULL CHECK (tipo IN ('CURSO','SEMINARIO','TALLER')),
    nombre          VARCHAR(200) NOT NULL,
    institucion     VARCHAR(200) NOT NULL,
    fecha_inicio    DATE         NOT NULL,
    fecha_fin       DATE         NOT NULL,
    horas           INT          NOT NULL CHECK (horas > 0),
    documento_id    BIGINT       REFERENCES documentos(id) ON DELETE SET NULL,
    CONSTRAINT ck_cap_fechas CHECK (fecha_fin >= fecha_inicio)
);
CREATE INDEX idx_capacitaciones_post ON capacitaciones(postulacion_id);

-- 1.9 Respuestas de inhabilidades
CREATE TABLE respuestas_inhabilidad (
    postulacion_id       BIGINT       NOT NULL REFERENCES postulaciones(id) ON DELETE CASCADE,
    pregunta_id          INT          NOT NULL REFERENCES preguntas_inhabilidad(id),
    respuesta            BOOLEAN      NOT NULL,
    -- Detalle para 1.9.7 (remoción por Organismo de Control)
    detalle_institucion  VARCHAR(200),
    detalle_cargo        VARCHAR(150),
    detalle_fecha_fin    DATE,
    detalle_motivo       VARCHAR(500),
    PRIMARY KEY (postulacion_id, pregunta_id)
);

-- Auditoría / trazabilidad de acciones sobre la postulación
CREATE TABLE postulacion_historial (
    id              BIGSERIAL    PRIMARY KEY,
    postulacion_id  BIGINT       NOT NULL REFERENCES postulaciones(id) ON DELETE CASCADE,
    accion          VARCHAR(40)  NOT NULL,
    detalle         TEXT,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_historial_post ON postulacion_historial(postulacion_id);
