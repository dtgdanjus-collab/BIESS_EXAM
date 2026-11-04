-- Para bases ya creadas (Render, Railway): pregunta del respaldo (1.4) con el texto literal del requerimiento.
-- Se puede ejecutar más de una vez. La API limpia la caché de catálogos al arrancar.
UPDATE sectores SET pregunta_respaldo = replace(pregunta_respaldo, 'respaldado por', 'respaldadas por');
