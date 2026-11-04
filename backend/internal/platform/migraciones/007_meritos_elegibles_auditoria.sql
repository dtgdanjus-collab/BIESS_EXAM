-- EF-1: tabla de puntajes, plazos por actor en las reconsideraciones y bitácora de acciones.

-- Los valores los fija la Comisión: el requerimiento no los trae, así que nacen vacíos.
ALTER TABLE concurso_config
    ADD COLUMN plazo_comision_dias SMALLINT NOT NULL DEFAULT 5 CHECK (plazo_comision_dias > 0),
    ADD COLUMN tabla_meritos       JSONB    NOT NULL DEFAULT '{}';

-- Talento Humano informa primero y la Comisión resuelve después, cada uno con su plazo.
ALTER TABLE reconsideraciones
    ADD COLUMN informe       VARCHAR(2000),
    ADD COLUMN informe_por   VARCHAR(150),
    ADD COLUMN informe_en    TIMESTAMPTZ,
    ADD COLUMN informe_antes TIMESTAMPTZ;
UPDATE reconsideraciones SET informe_antes = responder_antes;
ALTER TABLE reconsideraciones ALTER COLUMN informe_antes SET NOT NULL;

-- Lo que hacen las cuentas del módulo; lo del postulante queda en postulacion_historial.
CREATE TABLE auditoria (
    id              BIGSERIAL    PRIMARY KEY,
    actor           VARCHAR(150) NOT NULL,
    rol             VARCHAR(15)  NOT NULL,
    accion          VARCHAR(40)  NOT NULL,
    detalle         TEXT,
    postulacion_id  BIGINT       REFERENCES postulaciones(id) ON DELETE SET NULL,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_auditoria_fecha ON auditoria(creado_en DESC);
CREATE INDEX idx_auditoria_postulacion ON auditoria(postulacion_id);
