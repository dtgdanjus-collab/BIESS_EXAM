-- Más áreas de estudio para títulos que no encajaban en la lista inicial.
INSERT INTO areas_estudio (nombre) VALUES
  ('Actuaría'),
  ('Ciencias Políticas y Relaciones Internacionales'),
  ('Comercio Exterior'),
  ('Contabilidad y Auditoría'),
  ('Educación'),
  ('Estadística y Matemáticas'),
  ('Gestión Pública'),
  ('Ingeniería Civil'),
  ('Ingeniería Comercial'),
  ('Ingeniería Industrial'),
  ('Marketing'),
  ('Medicina y Ciencias de la Salud'),
  ('Seguridad Social'),
  ('Sistemas, Software y Tecnologías de la Información'),
  ('Talento Humano')
ON CONFLICT (nombre) DO NOTHING;
