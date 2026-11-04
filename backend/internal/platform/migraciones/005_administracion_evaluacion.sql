-- EF-1, EF-13 y EF-14: administración del concurso, calificaciones, evaluación teórica y reconsideraciones.

-- Rol Administrador (Comisión de Selección) y Rol Analista (Talento Humano).
CREATE TABLE administradores (
    id             BIGSERIAL    PRIMARY KEY,
    usuario        VARCHAR(60)  NOT NULL UNIQUE,
    nombre         VARCHAR(150) NOT NULL,
    rol            VARCHAR(15)  NOT NULL CHECK (rol IN ('ADMINISTRADOR','ANALISTA')),
    password_hash  VARCHAR(100) NOT NULL,
    activo         BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Fases que el administrador publica (EF-13.1). Las fechas de POSTULACION limitan el formulario.
CREATE TABLE concurso_fases (
    codigo        VARCHAR(30)  PRIMARY KEY,
    nombre        VARCHAR(120) NOT NULL,
    orden         SMALLINT     NOT NULL,
    descripcion   TEXT,
    publicada     BOOLEAN      NOT NULL DEFAULT FALSE,
    fecha_inicio  TIMESTAMPTZ,
    fecha_fin     TIMESTAMPTZ,
    CONSTRAINT ck_fase_fechas CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);
INSERT INTO concurso_fases (codigo, nombre, orden, publicada) VALUES
  ('POSTULACION',       'Postulación',              1, TRUE),
  ('MERITOS',           'Fase de méritos',          2, FALSE),
  ('EVALUACION_TECNICA','Evaluación técnica',       3, FALSE),
  ('PSICOTECNICA',      'Evaluación psicotécnica',  4, FALSE),
  ('RECONSIDERACION',   'Reconsideraciones',        5, FALSE),
  ('RESULTADOS',        'Lista de elegibles',       6, FALSE);

-- Una sola fila: lo que el administrador controla del concurso (EF-13.2).
CREATE TABLE concurso_config (
    id                     SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    formulario_habilitado  BOOLEAN  NOT NULL DEFAULT TRUE,
    plazo_respuesta_dias   SMALLINT NOT NULL DEFAULT 5 CHECK (plazo_respuesta_dias > 0)
);
INSERT INTO concurso_config DEFAULT VALUES;

-- Avance de cada postulante en el concurso.
ALTER TABLE postulaciones
    ADD COLUMN estado_concurso VARCHAR(20) NOT NULL DEFAULT 'POSTULADO'
        CHECK (estado_concurso IN ('POSTULADO','NO_SUPERA_MERITOS','EVALUACION_TECNICA')),
    ADD COLUMN puntaje_meritos    NUMERIC(5,2) CHECK (puntaje_meritos BETWEEN 0 AND 100),
    ADD COLUMN nota_psicotecnica  NUMERIC(5,2) CHECK (nota_psicotecnica BETWEEN 0 AND 100),
    ADD COLUMN observacion_concurso TEXT;

-- EF-14: banco de preguntas de opción múltiple.
CREATE TABLE preguntas_evaluacion (
    id         BIGSERIAL   PRIMARY KEY,
    enunciado  TEXT        NOT NULL,
    opciones   JSONB       NOT NULL,
    correcta   SMALLINT    NOT NULL CHECK (correcta >= 0),
    activa     BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Una sola fila: cuándo se habilita el examen, cuántas preguntas tiene y cuánto dura.
CREATE TABLE evaluacion_config (
    id                SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    num_preguntas     INT      NOT NULL DEFAULT 10 CHECK (num_preguntas > 0),
    duracion_minutos  INT      NOT NULL DEFAULT 30 CHECK (duracion_minutos > 0),
    inicio            TIMESTAMPTZ,
    fin               TIMESTAMPTZ
);
INSERT INTO evaluacion_config DEFAULT VALUES;

CREATE TABLE evaluacion_intentos (
    id              BIGSERIAL    PRIMARY KEY,
    postulacion_id  BIGINT       NOT NULL UNIQUE REFERENCES postulaciones(id) ON DELETE CASCADE,
    iniciado_en     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expira_en       TIMESTAMPTZ  NOT NULL,
    finalizado_en   TIMESTAMPTZ,
    forzado         BOOLEAN      NOT NULL DEFAULT FALSE,
    total           INT          NOT NULL DEFAULT 0,
    correctas       INT,
    nota            NUMERIC(5,2)
);
CREATE INDEX idx_intentos_pendientes ON evaluacion_intentos(expira_en) WHERE finalizado_en IS NULL;

-- Copia cada pregunta: editar el banco después no cambia un examen ya rendido.
CREATE TABLE evaluacion_respuestas (
    intento_id   BIGINT   NOT NULL REFERENCES evaluacion_intentos(id) ON DELETE CASCADE,
    orden        INT      NOT NULL,
    pregunta_id  BIGINT   REFERENCES preguntas_evaluacion(id) ON DELETE SET NULL,
    enunciado    TEXT     NOT NULL,
    opciones     JSONB    NOT NULL,
    correcta     SMALLINT NOT NULL,
    respuesta    SMALLINT,
    PRIMARY KEY (intento_id, orden)
);

-- EF-1: reconsideraciones, con plazo de respuesta para Talento Humano y la Comisión.
CREATE TABLE reconsideraciones (
    id               BIGSERIAL    PRIMARY KEY,
    postulacion_id   BIGINT       NOT NULL REFERENCES postulaciones(id) ON DELETE CASCADE,
    etapa            VARCHAR(30)  NOT NULL,
    motivo           VARCHAR(2000) NOT NULL,
    estado           VARCHAR(10)  NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','ACEPTADA','NEGADA')),
    respuesta        VARCHAR(2000),
    responder_antes  TIMESTAMPTZ  NOT NULL,
    respondida_en    TIMESTAMPTZ,
    respondida_por   VARCHAR(150),
    creado_en        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (postulacion_id, etapa)
);
