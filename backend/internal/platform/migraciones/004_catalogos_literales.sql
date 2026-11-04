-- Catálogos iguales al requerimiento. Salinas no está en la lista de 1.2.3: se quita salvo que
-- algún domicilio ya guardado la use.
DELETE FROM cantones c
USING provincias p
WHERE p.id = c.provincia_id AND p.nombre = 'Santa Elena' AND c.nombre = 'Salinas'
  AND NOT EXISTS (SELECT 1 FROM postulacion_contacto x WHERE x.canton_id = c.id);

UPDATE preguntas_inhabilidad SET texto = replace(texto, 'IESS - BIESS?', 'IESS- BIESS?') WHERE numeral = '1.9.10';
