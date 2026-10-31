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
