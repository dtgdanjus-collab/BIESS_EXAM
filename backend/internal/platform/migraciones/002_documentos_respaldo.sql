-- Para bases ya creadas (Render, Railway): PDF de respaldo guardados en la base, porque el disco
-- de esos servicios se borra en cada despliegue. Se puede ejecutar más de una vez.
-- La tabla documentos nunca se usó antes de esta migración: quitar "ruta" no pierde datos.
ALTER TABLE documentos DROP COLUMN IF EXISTS ruta;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS contenido BYTEA NOT NULL;
ALTER TABLE postulaciones ADD COLUMN IF NOT EXISTS organizacion_documento_id BIGINT REFERENCES documentos(id) ON DELETE SET NULL;
