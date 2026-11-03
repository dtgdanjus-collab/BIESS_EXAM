-- =====================================================================
-- biess_postulacion.sql — Script único de entrega
-- DDL (22 tablas) + catálogos (división política, listas) + personas mock.
-- Generado concatenando db/01_schema.sql, 02_seed_catalogos.sql y 03_seed_mocks.sql.
-- Uso: psql -U biess -d biess_postulacion -f biess_postulacion.sql
-- =====================================================================

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
-- Padrón de estudiantes: nombres reales para ciertas cédulas. Los datos NO se versionan (db/*_privado.sql).
CREATE TABLE IF NOT EXISTS mock_padron (
    cedula     CHAR(10)     PRIMARY KEY,
    nombres    VARCHAR(100) NOT NULL,
    apellidos  VARCHAR(100) NOT NULL,
    correo     VARCHAR(150)
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
    datos_confirmados_en    TIMESTAMPTZ,            -- el postulante corrigió y confirmó sus datos (1.1)
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


-- =====================================================================
-- 02_seed_catalogos.sql — Datos semilla de catálogos (división política y listas)
-- Fuente: Requerimiento Funcional IESS v1.4, secciones 1.2 a 1.9
-- =====================================================================
SET client_encoding = 'UTF8';

-- Países (194)
INSERT INTO paises (nombre) VALUES
  ('Afganistán'),
  ('Albania'),
  ('Alemania'),
  ('Andorra'),
  ('Angola'),
  ('Antigua y Barbuda'),
  ('Arabia Saudita'),
  ('Argelia'),
  ('Argentina'),
  ('Armenia'),
  ('Australia'),
  ('Austria'),
  ('Azerbaiyán'),
  ('Bahamas'),
  ('Bangladés'),
  ('Barbados'),
  ('Baréin'),
  ('Bélgica'),
  ('Belice'),
  ('Benín'),
  ('Bielorrusia'),
  ('Birmania'),
  ('Bolivia'),
  ('Bosnia y Herzegovina'),
  ('Botsuana'),
  ('Brasil'),
  ('Brunéi'),
  ('Bulgaria'),
  ('Burkina Faso'),
  ('Burundi'),
  ('Bután'),
  ('Cabo Verde'),
  ('Camboya'),
  ('Camerún'),
  ('Canadá'),
  ('Catar'),
  ('Chad'),
  ('Chile'),
  ('China'),
  ('Chipre'),
  ('Ciudad del Vaticano'),
  ('Colombia'),
  ('Comoras'),
  ('Corea del Norte'),
  ('Corea del Sur'),
  ('Costa de Marfil'),
  ('Costa Rica'),
  ('Croacia'),
  ('Cuba'),
  ('Dinamarca'),
  ('Dominica'),
  ('Ecuador'),
  ('Egipto'),
  ('El Salvador'),
  ('Emiratos Árabes Unidos'),
  ('Eritrea'),
  ('Eslovaquia'),
  ('Eslovenia'),
  ('España'),
  ('Estados Unidos'),
  ('Estonia'),
  ('Etiopía'),
  ('Filipinas'),
  ('Finlandia'),
  ('Fiyi'),
  ('Francia'),
  ('Gabón'),
  ('Gambia'),
  ('Georgia'),
  ('Ghana'),
  ('Granada'),
  ('Grecia'),
  ('Guatemala'),
  ('Guyana'),
  ('Guinea'),
  ('Guinea-Bisáu'),
  ('Guinea Ecuatorial'),
  ('Haití'),
  ('Honduras'),
  ('Hungría'),
  ('India'),
  ('Indonesia'),
  ('Irak'),
  ('Irán'),
  ('Irlanda'),
  ('Islandia'),
  ('Islas Marshall'),
  ('Islas Salomón'),
  ('Israel'),
  ('Italia'),
  ('Jamaica'),
  ('Japón'),
  ('Jordania'),
  ('Kazajistán'),
  ('Kenia'),
  ('Kirguistán'),
  ('Kiribati'),
  ('Kuwait'),
  ('Laos'),
  ('Lesoto'),
  ('Letonia'),
  ('Líbano'),
  ('Liberia'),
  ('Libia'),
  ('Liechtenstein'),
  ('Lituania'),
  ('Luxemburgo'),
  ('Macedonia del Norte'),
  ('Madagascar'),
  ('Malasia'),
  ('Malaui'),
  ('Maldivas'),
  ('Malí'),
  ('Malta'),
  ('Marruecos'),
  ('Mauricio'),
  ('Mauritania'),
  ('México'),
  ('Micronesia'),
  ('Moldavia'),
  ('Mónaco'),
  ('Mongolia'),
  ('Montenegro'),
  ('Mozambique'),
  ('Namibia'),
  ('Nauru'),
  ('Nepal'),
  ('Nicaragua'),
  ('Níger'),
  ('Nigeria'),
  ('Noruega'),
  ('Nueva Zelanda'),
  ('Omán'),
  ('Países Bajos'),
  ('Pakistán'),
  ('Palaos'),
  ('Panamá'),
  ('Papúa Nueva Guinea'),
  ('Paraguay'),
  ('Perú'),
  ('Polonia'),
  ('Portugal'),
  ('Reino Unido'),
  ('República Centroafricana'),
  ('República Checa'),
  ('República del Congo'),
  ('República Democrática del Congo'),
  ('República Dominicana'),
  ('Ruanda'),
  ('Rumanía'),
  ('Rusia'),
  ('Samoa'),
  ('San Cristóbal y Nieves'),
  ('San Marino'),
  ('San Vicente y las Granadinas'),
  ('Santa Lucía'),
  ('Santo Tomé y Príncipe'),
  ('Senegal'),
  ('Serbia'),
  ('Seychelles'),
  ('Sierra Leona'),
  ('Singapur'),
  ('Siria'),
  ('Somalia'),
  ('Sri Lanka'),
  ('Suazilandia'),
  ('Sudáfrica'),
  ('Sudán'),
  ('Sudán del Sur'),
  ('Suecia'),
  ('Suiza'),
  ('Surinam'),
  ('Tailandia'),
  ('Tanzania'),
  ('Tayikistán'),
  ('Timor Oriental'),
  ('Togo'),
  ('Tonga'),
  ('Trinidad y Tobago'),
  ('Túnez'),
  ('Turkmenistán'),
  ('Turquía'),
  ('Tuvalu'),
  ('Ucrania'),
  ('Uganda'),
  ('Uruguay'),
  ('Uzbekistán'),
  ('Vanuatu'),
  ('Venezuela'),
  ('Vietnam'),
  ('Yemen'),
  ('Yibuti'),
  ('Zambia'),
  ('Zimbabue');

-- Provincias del Ecuador (24)
INSERT INTO provincias (pais_id, nombre)
SELECT (SELECT id FROM paises WHERE nombre = 'Ecuador'), v.nombre FROM (VALUES
  ('Azuay'),
  ('Bolívar'),
  ('Cañar'),
  ('Carchi'),
  ('Chimborazo'),
  ('Cotopaxi'),
  ('El Oro'),
  ('Esmeraldas'),
  ('Galápagos'),
  ('Guayas'),
  ('Imbabura'),
  ('Loja'),
  ('Los Ríos'),
  ('Manabí'),
  ('Morona Santiago'),
  ('Napo'),
  ('Orellana'),
  ('Pastaza'),
  ('Pichincha'),
  ('Santa Elena'),
  ('Santo Domingo de los Tsáchilas'),
  ('Sucumbíos'),
  ('Tungurahua'),
  ('Zamora Chinchipe')
) AS v(nombre);

-- Cantones por provincia
INSERT INTO cantones (provincia_id, nombre)
SELECT pr.id, v.canton FROM (VALUES
  ('Azuay', 'Cuenca'),
  ('Azuay', 'Gualaceo'),
  ('Azuay', 'Chordeleg'),
  ('Azuay', 'Sígsig'),
  ('Azuay', 'Girón'),
  ('Azuay', 'Santa Isabel'),
  ('Azuay', 'Pucará'),
  ('Azuay', 'Camilo Ponce Enríquez'),
  ('Bolívar', 'Guaranda'),
  ('Bolívar', 'Chillanes'),
  ('Bolívar', 'Chimbo'),
  ('Bolívar', 'Echeandía'),
  ('Bolívar', 'San Miguel'),
  ('Bolívar', 'Caluma'),
  ('Bolívar', 'Las Naves'),
  ('Cañar', 'Azogues'),
  ('Cañar', 'Biblián'),
  ('Cañar', 'Cañar'),
  ('Cañar', 'Déleg'),
  ('Cañar', 'El Tambo'),
  ('Cañar', 'Suscal'),
  ('Cañar', 'La Troncal'),
  ('Carchi', 'Tulcán'),
  ('Carchi', 'Bolívar'),
  ('Carchi', 'Espejo'),
  ('Carchi', 'Mira'),
  ('Carchi', 'Montúfar'),
  ('Carchi', 'San Pedro de Huaca'),
  ('Chimborazo', 'Riobamba'),
  ('Chimborazo', 'Alausí'),
  ('Chimborazo', 'Colta'),
  ('Chimborazo', 'Chunchi'),
  ('Chimborazo', 'Guamote'),
  ('Chimborazo', 'Guano'),
  ('Chimborazo', 'Pallatanga'),
  ('Chimborazo', 'Penipe'),
  ('Chimborazo', 'Cumandá'),
  ('Cotopaxi', 'Latacunga'),
  ('Cotopaxi', 'La Maná'),
  ('Cotopaxi', 'Pangua'),
  ('Cotopaxi', 'Pujilí'),
  ('Cotopaxi', 'Salcedo'),
  ('Cotopaxi', 'Saquisilí'),
  ('Cotopaxi', 'Sigchos'),
  ('El Oro', 'Machala'),
  ('El Oro', 'Arenillas'),
  ('El Oro', 'Atahualpa'),
  ('El Oro', 'Balsas'),
  ('El Oro', 'Chilla'),
  ('El Oro', 'El Guabo'),
  ('El Oro', 'Huaquillas'),
  ('El Oro', 'Las Lajas'),
  ('El Oro', 'Marcabelí'),
  ('El Oro', 'Pasaje'),
  ('El Oro', 'Piñas'),
  ('El Oro', 'Portovelo'),
  ('El Oro', 'Santa Rosa'),
  ('El Oro', 'Zaruma'),
  ('Esmeraldas', 'Esmeraldas'),
  ('Esmeraldas', 'Atacames'),
  ('Esmeraldas', 'Eloy Alfaro'),
  ('Esmeraldas', 'Muisne'),
  ('Esmeraldas', 'Quinindé'),
  ('Esmeraldas', 'Rioverde'),
  ('Esmeraldas', 'San Lorenzo'),
  ('Galápagos', 'San Cristóbal'),
  ('Galápagos', 'Isabela'),
  ('Galápagos', 'Santa Cruz'),
  ('Guayas', 'Guayaquil'),
  ('Guayas', 'Durán'),
  ('Guayas', 'Milagro'),
  ('Guayas', 'Samborondón'),
  ('Guayas', 'Daule'),
  ('Guayas', 'Playas'),
  ('Guayas', 'Balzar'),
  ('Guayas', 'Colimes'),
  ('Guayas', 'El Empalme'),
  ('Guayas', 'El Triunfo'),
  ('Guayas', 'Isidro Ayora'),
  ('Guayas', 'Lomas de Sargentillo'),
  ('Guayas', 'Naranjal'),
  ('Guayas', 'Naranjito'),
  ('Guayas', 'Nobol'),
  ('Guayas', 'Pedro Carbo'),
  ('Guayas', 'Salitre'),
  ('Guayas', 'Simón Bolívar'),
  ('Guayas', 'Yaguachi'),
  ('Imbabura', 'Ibarra'),
  ('Imbabura', 'Antonio Ante'),
  ('Imbabura', 'Cotacachi'),
  ('Imbabura', 'Otavalo'),
  ('Imbabura', 'Pimampiro'),
  ('Imbabura', 'San Miguel de Urcuquí'),
  ('Loja', 'Loja'),
  ('Loja', 'Calvas'),
  ('Loja', 'Catamayo'),
  ('Loja', 'Celica'),
  ('Loja', 'Chaguarpamba'),
  ('Loja', 'Espíndola'),
  ('Loja', 'Gonzanamá'),
  ('Loja', 'Macará'),
  ('Loja', 'Paltas'),
  ('Loja', 'Puyango'),
  ('Loja', 'Saraguro'),
  ('Loja', 'Sozoranga'),
  ('Loja', 'Zapotillo'),
  ('Los Ríos', 'Babahoyo'),
  ('Los Ríos', 'Baba'),
  ('Los Ríos', 'Buena Fe'),
  ('Los Ríos', 'Mocache'),
  ('Los Ríos', 'Montalvo'),
  ('Los Ríos', 'Palenque'),
  ('Los Ríos', 'Puebloviejo'),
  ('Los Ríos', 'Quevedo'),
  ('Los Ríos', 'Urdaneta'),
  ('Los Ríos', 'Ventanas'),
  ('Los Ríos', 'Vinces'),
  ('Los Ríos', 'Valencia'),
  ('Manabí', 'Portoviejo'),
  ('Manabí', 'Manta'),
  ('Manabí', 'Chone'),
  ('Manabí', 'Bolívar'),
  ('Manabí', 'El Carmen'),
  ('Manabí', 'Flavio Alfaro'),
  ('Manabí', 'Jipijapa'),
  ('Manabí', 'Junín'),
  ('Manabí', 'Montecristi'),
  ('Manabí', 'Paján'),
  ('Manabí', 'Pichincha'),
  ('Manabí', 'Rocafuerte'),
  ('Manabí', 'Santa Ana'),
  ('Manabí', 'Sucre'),
  ('Manabí', 'Tosagua'),
  ('Manabí', '24 de Mayo'),
  ('Manabí', 'Pedernales'),
  ('Manabí', 'Olmedo'),
  ('Manabí', 'Puerto López'),
  ('Manabí', 'Jama'),
  ('Manabí', 'Jaramijó'),
  ('Manabí', 'San Vicente'),
  ('Morona Santiago', 'Morona'),
  ('Morona Santiago', 'Gualaquiza'),
  ('Morona Santiago', 'Limón Indanza'),
  ('Morona Santiago', 'Palora'),
  ('Morona Santiago', 'San Juan Bosco'),
  ('Morona Santiago', 'Santiago'),
  ('Morona Santiago', 'Sucúa'),
  ('Morona Santiago', 'Taisha'),
  ('Morona Santiago', 'Tiwintza'),
  ('Napo', 'Tena'),
  ('Napo', 'Archidona'),
  ('Napo', 'Carlos Julio Arosemena Tola'),
  ('Napo', 'El Chaco'),
  ('Napo', 'Quijos'),
  ('Orellana', 'Francisco de Orellana'),
  ('Orellana', 'Aguarico'),
  ('Orellana', 'La Joya de los Sachas'),
  ('Orellana', 'Loreto'),
  ('Pastaza', 'Pastaza'),
  ('Pastaza', 'Arajuno'),
  ('Pastaza', 'Mera'),
  ('Pastaza', 'Santa Clara'),
  ('Pichincha', 'Quito'),
  ('Pichincha', 'Cayambe'),
  ('Pichincha', 'Mejía'),
  ('Pichincha', 'Pedro Moncayo'),
  ('Pichincha', 'Pedro Vicente Maldonado'),
  ('Pichincha', 'Puerto Quito'),
  ('Pichincha', 'Rumiñahui'),
  ('Pichincha', 'San Miguel de los Bancos'),
  ('Santa Elena', 'Santa Elena'),
  ('Santa Elena', 'La Libertad'),
  ('Santa Elena', 'Salinas'),
  ('Santo Domingo de los Tsáchilas', 'La Concordia'),
  ('Santo Domingo de los Tsáchilas', 'Santo Domingo'),
  ('Sucumbíos', 'Cascales'),
  ('Sucumbíos', 'Cuyabeno'),
  ('Sucumbíos', 'Gonzalo Pizarro'),
  ('Sucumbíos', 'Lago Agrio'),
  ('Sucumbíos', 'Putumayo'),
  ('Sucumbíos', 'Shushufindi'),
  ('Sucumbíos', 'Sucumbíos'),
  ('Tungurahua', 'Ambato'),
  ('Tungurahua', 'Baños de Agua Santa'),
  ('Tungurahua', 'Cevallos'),
  ('Tungurahua', 'Mocha'),
  ('Tungurahua', 'Patate'),
  ('Tungurahua', 'Pelileo'),
  ('Tungurahua', 'Píllaro'),
  ('Tungurahua', 'Quero'),
  ('Tungurahua', 'Tisaleo'),
  ('Zamora Chinchipe', 'Centinela del Cóndor'),
  ('Zamora Chinchipe', 'Chinchipe'),
  ('Zamora Chinchipe', 'El Pangui'),
  ('Zamora Chinchipe', 'Nangaritza'),
  ('Zamora Chinchipe', 'Palanda'),
  ('Zamora Chinchipe', 'Paquisha'),
  ('Zamora Chinchipe', 'Yacuambi'),
  ('Zamora Chinchipe', 'Yantzaza'),
  ('Zamora Chinchipe', 'Zamora')
) AS v(provincia, canton)
JOIN provincias pr ON pr.nombre = v.provincia
JOIN paises pa ON pa.id = pr.pais_id AND pa.nombre = 'Ecuador';

-- Parentescos (1.3.1.2)
INSERT INTO parentescos (nombre) VALUES
  ('Conviviente'), ('Cónyuge'), ('Cuñado/a'), ('Hermano/a'), ('Hijo político'), ('Hijo/a'),
  ('Madre'), ('Nieto/a'), ('Nuera'), ('Padre'), ('Primo hermano/a'), ('Sobrino/a'),
  ('Suegro/a'), ('Tío/a'), ('Yerno');

-- Niveles de instrucción (1.5.1)
INSERT INTO niveles_instruccion (nombre, orden) VALUES
  ('Tercer Nivel de Grado', 1),
  ('Cuarto Nivel - Especialidad Académica', 2),
  ('Cuarto Nivel - Maestría Académica', 3),
  ('Cuarto Nivel PhD - Doctorado', 4);

-- Áreas de estudio / actividades relacionadas (1.5.1.4 y 1.6.6)
INSERT INTO areas_estudio (nombre) VALUES
  ('Finanzas'), ('Mercado de Capitales'), ('Administración de Empresas'),
  ('Economía'), ('Derecho'), ('Materias afines');

-- Sectores de representación (1.4) con los mensajes literales del requerimiento
INSERT INTO sectores (codigo, cargo, tipo_requerido, etiqueta_cumple, etiqueta_no_cumple, mensaje_rechazo, pregunta_respaldo) VALUES
('AFILIADOS',
 'Miembro Principal y Alterno en Representación del Sector de Afiliados ante el Directorio del BIESS',
 'AFILIADO', 'Postulante afiliado al IESS', 'Postulante No Afiliado al IESS',
 'Su postulación para el cargo de Miembro Principal y Alterno en Representación del Sector de Afiliados ante el Directorio del BIESS, NO puede continuar, por cuanto no mantiene la calidad de afiliado al IESS',
 '¿Se encuentra respaldado por una organización de trabajadores de representación nacional legalmente constituida ante autoridad competente?'),
('JUBILADOS',
 'Miembro Principal y Alterno en Representación del Sector de los Jubilados ante el Directorio del BIESS',
 'JUBILADO', 'Postulante acredita jubilación', 'Postulante no acredita jubilación',
 'Su postulación para el cargo de Miembro Principal y Alterno en Representación del Sector de los Jubilados ante el Directorio del BIESS, NO puede continuar, por cuanto no acredita jubilación',
 '¿Se encuentra respaldado por una organización de jubilados de representación nacional legalmente constituida ante autoridad competente?'),
('EMPLEADORES',
 'Miembro Principal y Alterno en Representación del Sector Empleador ante el Directorio del BIESS',
 'EMPLEADOR', 'Postulante es empleador', 'Postulante no es empleador',
 'Su postulación para el cargo de Miembro Principal y Alterno en Representación del Sector Empleador ante el Directorio del BIESS, NO puede continuar, por cuanto no es empleador',
 '¿Se encuentra respaldado por una federación de cámara de representación nacional legalmente constituida ante autoridad competente?');

-- Inhabilidades (1.9). respuesta_esperada = respuesta que NO genera inhabilidad
INSERT INTO preguntas_inhabilidad (numeral, texto, respuesta_esperada, requiere_detalle, orden) VALUES
('1.9.1',  '¿Es Ecuatoriano/a y está en pleno goce de los derechos de participación política?', TRUE, FALSE, 1),
('1.9.2',  '¿Se encuentra inhabilitado para ejercer el comercio?', FALSE, FALSE, 2),
('1.9.3',  '¿Está en mora, directa o indirectamente, en el pago de sus obligaciones en cualquiera de las instituciones del Estado o de las instituciones bajo control de la Superintendencia de Bancos, incluidas las off-shore?', FALSE, FALSE, 3),
('1.9.4',  '¿Mantiene algún vínculo, por propiedad o administración, con las instituciones del sistema financiero y del sistema de seguros privados, con las bolsas de valores del país, Casas de Valores y Administradoras de Fondos y Fideicomisos, de acuerdo con las normas que la Junta de Política y Regulación Monetaria y Financiera emita para el efecto?', FALSE, FALSE, 4),
('1.9.5',  '¿Es funcionario o empleado del IESS - BIESS?', FALSE, FALSE, 5),
('1.9.6',  '¿Mantiene interés propio o representa a terceros en la propiedad, la dirección o la gestión de las compañías aseguradoras u otras personas que integran el sistema nacional de seguridad social?', FALSE, FALSE, 6),
('1.9.7',  '¿En los últimos 5 años, ha sido removido por algún Organismo de Control?', FALSE, TRUE, 7),
('1.9.8',  '¿Mantiene obligaciones pendientes con el SRI?', FALSE, FALSE, 8),
('1.9.9',  '¿Ha incurrido en los últimos 5 años en castigo de sus obligaciones por parte de cualquier institución financiera?', FALSE, FALSE, 9),
('1.9.10', '¿Actualmente se encuentra litigando en contra del IESS - BIESS?', FALSE, FALSE, 10),
('1.9.11', '¿Se encuentra procesado, enjuiciado o condenado por algún delito relacionado con corrupción o crimen organizado?', FALSE, FALSE, 11),
('1.9.12', '¿Mantiene en firme algún tipo de responsabilidades por la Contraloría General del Estado?', FALSE, FALSE, 12),
('1.9.13', '¿Se encuentra registrado en la base de datos de la Unidad de Análisis Financiero y Económico?', FALSE, FALSE, 13);


-- =====================================================================
-- 03_seed_mocks.sql — Personas ficticias que simulan Registro Civil e Historial Laboral
-- Las cédulas son válidas según el algoritmo módulo 10. Datos 100% ficticios.
-- =====================================================================
SET client_encoding = 'UTF8';

--  Caso | Cédula     | Fecha exp.  | Cód. dactilar | Escenario
--  A    | 0102345675 | 20/06/2019  | V4443V4442    | Afiliada, soltera — camino feliz
--  B    | 0103456786 | 14/02/2018  | E2331I2222    | Jubilado, casado — muestra datos del cónyuge
--  C    | 1712345675 | 05/08/2021  | V3333V1111    | Empleadora y afiliada, unión de hecho
--  D    | 0923456784 | 11/03/2022  | E1234V5678    | Extranjero — bloqueo por nacionalidad
--  E    | 1105678906 | 01/12/2020  | V5555I6666    | Sin afiliación — rechazo de sector
--  F    | 0106789019 | 17/01/2023  | E7777V8888    | Para probar el bloqueo de 3 intentos

INSERT INTO mock_registro_civil (cedula, nombres, apellidos, genero, fecha_nacimiento, nacionalidad, estado_civil, conyuge_nombres, conyuge_cedula, fecha_expedicion, codigo_dactilar) VALUES
  ('0102345675', 'María Fernanda', 'Ortega Vásquez', 'FEMENINO', '1985-04-12', 'ECUATORIANA', 'SOLTERO/A', NULL, NULL, '2019-06-20', 'V4443V4442'),
  ('0103456786', 'Jorge Luis', 'Pesántez Cárdenas', 'MASCULINO', '1956-09-03', 'ECUATORIANA', 'CASADO/A', 'Rosa Elena Mogrovejo Ochoa', '0104567813', '2018-02-14', 'E2331I2222'),
  ('1712345675', 'Andrea Carolina', 'Salazar Benítez', 'FEMENINO', '1979-11-25', 'ECUATORIANA', 'UNION DE HECHO', 'Pablo Andrés Terán Ruiz', '1719876540', '2021-08-05', 'V3333V1111'),
  ('0923456784', 'Camilo Andrés', 'Restrepo Gómez', 'MASCULINO', '1988-01-30', 'COLOMBIANA', 'SOLTERO/A', NULL, NULL, '2022-03-11', 'E1234V5678'),
  ('1105678906', 'Luis Alberto', 'Jaramillo Ruiz', 'MASCULINO', '1990-07-18', 'ECUATORIANA', 'DIVORCIADO/A', NULL, NULL, '2020-12-01', 'V5555I6666'),
  ('0106789019', 'Diana Patricia', 'Quezada León', 'FEMENINO', '1992-05-09', 'ECUATORIANA', 'SOLTERO/A', NULL, NULL, '2023-01-17', 'E7777V8888');

INSERT INTO mock_historial_laboral (cedula, tipo, activo) VALUES
  ('0102345675', 'AFILIADO', TRUE),
  ('0103456786', 'JUBILADO', TRUE),
  ('1712345675', 'EMPLEADOR', TRUE),
  ('1712345675', 'AFILIADO', TRUE),
  ('0923456784', 'AFILIADO', TRUE),
  ('0106789019', 'AFILIADO', TRUE);
