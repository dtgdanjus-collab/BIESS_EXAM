-- Para bases ya creadas (Render): el postulante confirma sus datos personales una sola vez.
-- Es aditiva y se puede ejecutar más de una vez. Las bases nuevas ya la traen en 01_schema.sql.
ALTER TABLE postulaciones ADD COLUMN IF NOT EXISTS datos_confirmados_en TIMESTAMPTZ;
