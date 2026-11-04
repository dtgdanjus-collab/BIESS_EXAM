package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

// ConcursoRepository: administración del concurso, calificaciones, evaluación y reconsideraciones.
type ConcursoRepository interface {
	FindAdminByUsuario(ctx context.Context, usuario string) (*domain.Administrador, error)
	FindAdminByID(ctx context.Context, id int64) (*domain.Administrador, error)
	ListAdmins(ctx context.Context) ([]domain.Administrador, error)
	CreateAdmin(ctx context.Context, a *domain.Administrador) error
	SetAdminActivo(ctx context.Context, id int64, activo bool) error

	GetConfig(ctx context.Context) (*domain.ConcursoConfig, error)
	UpdateConfig(ctx context.Context, c domain.ConcursoConfig) error
	ListFases(ctx context.Context) ([]domain.Fase, error)
	FindFase(ctx context.Context, codigo string) (*domain.Fase, error)
	UpdateFase(ctx context.Context, f domain.Fase) error

	Dashboard(ctx context.Context) (*domain.Dashboard, error)
	ListPostulantes(ctx context.Context, f domain.FiltroPostulantes) ([]domain.Postulante, error)
	FindPostulante(ctx context.Context, postulacionID int64) (*domain.Postulante, error)
	FindPostulanteDeUsuario(ctx context.Context, usuarioID int64) (*domain.Postulante, error)
	GuardarCalificacion(ctx context.Context, postulacionID int64, c domain.Calificacion) error
	FindDocumentoDePostulacion(ctx context.Context, postulacionID, documentoID int64) (*domain.Documento, []byte, error)

	ListPreguntas(ctx context.Context) ([]domain.PreguntaEvaluacion, error)
	CreatePregunta(ctx context.Context, p domain.PreguntaEvaluacion) (int64, error)
	UpdatePregunta(ctx context.Context, p domain.PreguntaEvaluacion) error
	DeletePregunta(ctx context.Context, id int64) error
	ContarPreguntasActivas(ctx context.Context) (int, error)
	GetEvaluacionConfig(ctx context.Context) (*domain.EvaluacionConfig, error)
	UpdateEvaluacionConfig(ctx context.Context, c domain.EvaluacionConfig) error

	FindIntento(ctx context.Context, postulacionID int64, forUpdate bool) (*domain.Intento, error)
	CrearIntento(ctx context.Context, postulacionID int64, expira time.Time, numPreguntas int) (*domain.Intento, error)
	PreguntaPendiente(ctx context.Context, intentoID int64) (*domain.PreguntaExamen, error)
	Responder(ctx context.Context, intentoID int64, orden, opcion int) (int64, error)
	FinalizarIntento(ctx context.Context, intentoID int64, forzado bool) (*domain.Intento, error)
	ListIntentosVencidos(ctx context.Context, ahora time.Time) ([]int64, error)
	ListResultados(ctx context.Context) ([]domain.ResultadoEvaluacion, error)

	ListReconsideraciones(ctx context.Context, postulacionID int64) ([]domain.Reconsideracion, error)
	CrearReconsideracion(ctx context.Context, r domain.Reconsideracion) error
	FindReconsideracion(ctx context.Context, id int64) (*domain.Reconsideracion, error)
	ResponderReconsideracion(ctx context.Context, id int64, estado, respuesta, por string) (int64, error)
}

type pgConcursoRepository struct {
	pool *pgxpool.Pool
}

func NewConcursoRepository(pool *pgxpool.Pool) ConcursoRepository {
	return &pgConcursoRepository{pool: pool}
}

// --- Administradores ---

const columnasAdmin = `id, usuario, nombre, rol, password_hash, activo`

func (r *pgConcursoRepository) unAdmin(ctx context.Context, where string, arg any) (*domain.Administrador, error) {
	var a domain.Administrador
	err := conn(ctx, r.pool).QueryRow(ctx, `SELECT `+columnasAdmin+` FROM administradores WHERE `+where, arg).
		Scan(&a.ID, &a.Usuario, &a.Nombre, &a.Rol, &a.PasswordHash, &a.Activo)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, traducir(err, "leyendo administrador")
	}
	return &a, nil
}

func (r *pgConcursoRepository) FindAdminByUsuario(ctx context.Context, usuario string) (*domain.Administrador, error) {
	return r.unAdmin(ctx, `usuario = $1`, usuario)
}

func (r *pgConcursoRepository) FindAdminByID(ctx context.Context, id int64) (*domain.Administrador, error) {
	return r.unAdmin(ctx, `id = $1`, id)
}

func (r *pgConcursoRepository) ListAdmins(ctx context.Context) ([]domain.Administrador, error) {
	return listar[domain.Administrador](ctx, conn(ctx, r.pool), `SELECT `+columnasAdmin+` FROM administradores ORDER BY id`)
}

func (r *pgConcursoRepository) CreateAdmin(ctx context.Context, a *domain.Administrador) error {
	err := conn(ctx, r.pool).QueryRow(ctx, `
		INSERT INTO administradores (usuario, nombre, rol, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, activo`,
		a.Usuario, a.Nombre, a.Rol, a.PasswordHash).Scan(&a.ID, &a.Activo)
	return traducir(err, "creando administrador")
}

func (r *pgConcursoRepository) SetAdminActivo(ctx context.Context, id int64, activo bool) error {
	_, err := conn(ctx, r.pool).Exec(ctx, `UPDATE administradores SET activo = $2 WHERE id = $1`, id, activo)
	return traducir(err, "actualizando administrador")
}

// --- Fases y configuración ---

func (r *pgConcursoRepository) GetConfig(ctx context.Context) (*domain.ConcursoConfig, error) {
	var c domain.ConcursoConfig
	err := conn(ctx, r.pool).QueryRow(ctx, `SELECT formulario_habilitado, plazo_respuesta_dias FROM concurso_config WHERE id = 1`).
		Scan(&c.FormularioHabilitado, &c.PlazoRespuestaDias)
	if err != nil {
		return nil, traducir(err, "leyendo configuración del concurso")
	}
	return &c, nil
}

func (r *pgConcursoRepository) UpdateConfig(ctx context.Context, c domain.ConcursoConfig) error {
	_, err := conn(ctx, r.pool).Exec(ctx, `UPDATE concurso_config SET formulario_habilitado = $1, plazo_respuesta_dias = $2 WHERE id = 1`,
		c.FormularioHabilitado, c.PlazoRespuestaDias)
	return traducir(err, "guardando configuración del concurso")
}

const columnasFase = `codigo, nombre, orden, descripcion, publicada, fecha_inicio, fecha_fin`

func (r *pgConcursoRepository) ListFases(ctx context.Context) ([]domain.Fase, error) {
	return listar[domain.Fase](ctx, conn(ctx, r.pool), `SELECT `+columnasFase+` FROM concurso_fases ORDER BY orden`)
}

func (r *pgConcursoRepository) FindFase(ctx context.Context, codigo string) (*domain.Fase, error) {
	var f domain.Fase
	err := conn(ctx, r.pool).QueryRow(ctx, `SELECT `+columnasFase+` FROM concurso_fases WHERE codigo = $1`, codigo).
		Scan(&f.Codigo, &f.Nombre, &f.Orden, &f.Descripcion, &f.Publicada, &f.FechaInicio, &f.FechaFin)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, traducir(err, "leyendo fase")
	}
	return &f, nil
}

func (r *pgConcursoRepository) UpdateFase(ctx context.Context, f domain.Fase) error {
	tag, err := conn(ctx, r.pool).Exec(ctx, `
		UPDATE concurso_fases SET descripcion = $2, publicada = $3, fecha_inicio = $4, fecha_fin = $5 WHERE codigo = $1`,
		f.Codigo, f.Descripcion, f.Publicada, f.FechaInicio, f.FechaFin)
	if err != nil {
		return traducir(err, "guardando fase")
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// --- Dashboard y nómina ---

func (r *pgConcursoRepository) Dashboard(ctx context.Context) (*domain.Dashboard, error) {
	db := conn(ctx, r.pool)
	cargos, err := listar[domain.ResumenCargo](ctx, db, `
		SELECT s.codigo, s.cargo,
		       count(p.id) FILTER (WHERE p.estado = 'ENVIADA')::int,
		       count(p.id) FILTER (WHERE p.estado = 'BORRADOR')::int
		FROM sectores s LEFT JOIN postulaciones p ON p.sector_codigo = s.codigo
		GROUP BY s.codigo, s.cargo ORDER BY s.codigo`)
	if err != nil {
		return nil, err
	}
	d := &domain.Dashboard{Cargos: cargos, Generado: time.Now()}
	err = db.QueryRow(ctx, `
		SELECT count(*) FILTER (WHERE sector_codigo IS NULL AND estado = 'BORRADOR')::int,
		       count(*) FILTER (WHERE estado = 'CERRADA')::int,
		       count(*) FILTER (WHERE posible_inhabilidad AND estado = 'ENVIADA')::int,
		       (SELECT count(*)::int FROM usuarios)
		FROM postulaciones`).Scan(&d.SinCargo, &d.Cerradas, &d.Inhabilidad, &d.Cuentas)
	if err != nil {
		return nil, traducir(err, "armando dashboard")
	}
	return d, nil
}

const selectPostulante = `
	SELECT p.id, p.usuario_id, p.codigo, p.estado, p.sector_codigo, s.cargo, dp.cedula, dp.nombres, dp.apellidos, u.email,
	       p.fecha_envio, p.posible_inhabilidad, p.estado_concurso, p.puntaje_meritos::float8, i.nota::float8,
	       p.nota_psicotecnica::float8, p.observacion_concurso
	FROM postulaciones p
	JOIN usuarios u ON u.id = p.usuario_id
	JOIN postulacion_datos_personales dp ON dp.postulacion_id = p.id
	LEFT JOIN sectores s ON s.codigo = p.sector_codigo
	LEFT JOIN evaluacion_intentos i ON i.postulacion_id = p.id`

func (r *pgConcursoRepository) ListPostulantes(ctx context.Context, f domain.FiltroPostulantes) ([]domain.Postulante, error) {
	return listar[domain.Postulante](ctx, conn(ctx, r.pool), selectPostulante+`
		WHERE ($1 = '' OR p.sector_codigo = $1)
		  AND ($2 = '' OR p.estado = $2)
		  AND ($3 = '' OR p.estado_concurso = $3)
		  AND ($4 = '' OR dp.cedula LIKE $4 || '%' OR p.codigo ILIKE '%' || $4 || '%'
		       OR (dp.apellidos || ' ' || dp.nombres) ILIKE '%' || $4 || '%')
		ORDER BY p.sector_codigo NULLS LAST, dp.apellidos, dp.nombres`, f.Sector, f.Estado, f.EstadoConcurso, f.Busqueda)
}

func (r *pgConcursoRepository) unPostulante(ctx context.Context, where string, id int64) (*domain.Postulante, error) {
	filas, err := listar[domain.Postulante](ctx, conn(ctx, r.pool), selectPostulante+` WHERE `+where, id)
	if err != nil {
		return nil, err
	}
	if len(filas) == 0 {
		return nil, ErrNotFound
	}
	return &filas[0], nil
}

func (r *pgConcursoRepository) FindPostulante(ctx context.Context, id int64) (*domain.Postulante, error) {
	return r.unPostulante(ctx, `p.id = $1`, id)
}

func (r *pgConcursoRepository) FindPostulanteDeUsuario(ctx context.Context, usuarioID int64) (*domain.Postulante, error) {
	return r.unPostulante(ctx, `p.usuario_id = $1`, usuarioID)
}

func (r *pgConcursoRepository) GuardarCalificacion(ctx context.Context, id int64, c domain.Calificacion) error {
	_, err := conn(ctx, r.pool).Exec(ctx, `
		UPDATE postulaciones SET estado_concurso = $2, puntaje_meritos = $3, nota_psicotecnica = $4, observacion_concurso = $5
		WHERE id = $1`, id, c.EstadoConcurso, c.PuntajeMeritos, c.NotaPsicotecnica, c.Observacion)
	return traducir(err, "guardando calificación")
}

func (r *pgConcursoRepository) FindDocumentoDePostulacion(ctx context.Context, postulacionID, documentoID int64) (*domain.Documento, []byte, error) {
	var d domain.Documento
	var contenido []byte
	err := conn(ctx, r.pool).QueryRow(ctx, `
		SELECT id, categoria, nombre_original, tamano_bytes, contenido FROM documentos WHERE id = $1 AND postulacion_id = $2`,
		documentoID, postulacionID).Scan(&d.ID, &d.Categoria, &d.Nombre, &d.TamanoBytes, &contenido)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, ErrNotFound
	}
	if err != nil {
		return nil, nil, traducir(err, "leyendo documento")
	}
	return &d, contenido, nil
}

// --- Banco de preguntas ---

func (r *pgConcursoRepository) ListPreguntas(ctx context.Context) ([]domain.PreguntaEvaluacion, error) {
	return listar[domain.PreguntaEvaluacion](ctx, conn(ctx, r.pool),
		`SELECT id, enunciado, opciones, correcta, activa FROM preguntas_evaluacion ORDER BY id`)
}

func (r *pgConcursoRepository) CreatePregunta(ctx context.Context, p domain.PreguntaEvaluacion) (int64, error) {
	var id int64
	err := conn(ctx, r.pool).QueryRow(ctx, `
		INSERT INTO preguntas_evaluacion (enunciado, opciones, correcta, activa) VALUES ($1, $2, $3, $4) RETURNING id`,
		p.Enunciado, p.Opciones, p.Correcta, p.Activa).Scan(&id)
	return id, traducir(err, "creando pregunta")
}

func (r *pgConcursoRepository) UpdatePregunta(ctx context.Context, p domain.PreguntaEvaluacion) error {
	tag, err := conn(ctx, r.pool).Exec(ctx, `
		UPDATE preguntas_evaluacion SET enunciado = $2, opciones = $3, correcta = $4, activa = $5 WHERE id = $1`,
		p.ID, p.Enunciado, p.Opciones, p.Correcta, p.Activa)
	if err != nil {
		return traducir(err, "guardando pregunta")
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *pgConcursoRepository) DeletePregunta(ctx context.Context, id int64) error {
	_, err := conn(ctx, r.pool).Exec(ctx, `DELETE FROM preguntas_evaluacion WHERE id = $1`, id)
	return traducir(err, "eliminando pregunta")
}

func (r *pgConcursoRepository) ContarPreguntasActivas(ctx context.Context) (int, error) {
	var n int
	err := conn(ctx, r.pool).QueryRow(ctx, `SELECT count(*) FROM preguntas_evaluacion WHERE activa`).Scan(&n)
	return n, traducir(err, "contando preguntas")
}

func (r *pgConcursoRepository) GetEvaluacionConfig(ctx context.Context) (*domain.EvaluacionConfig, error) {
	var c domain.EvaluacionConfig
	err := conn(ctx, r.pool).QueryRow(ctx, `SELECT num_preguntas, duracion_minutos, inicio, fin FROM evaluacion_config WHERE id = 1`).
		Scan(&c.NumPreguntas, &c.DuracionMinutos, &c.Inicio, &c.Fin)
	if err != nil {
		return nil, traducir(err, "leyendo configuración de la evaluación")
	}
	return &c, nil
}

func (r *pgConcursoRepository) UpdateEvaluacionConfig(ctx context.Context, c domain.EvaluacionConfig) error {
	_, err := conn(ctx, r.pool).Exec(ctx, `UPDATE evaluacion_config SET num_preguntas = $1, duracion_minutos = $2, inicio = $3, fin = $4 WHERE id = 1`,
		c.NumPreguntas, c.DuracionMinutos, c.Inicio, c.Fin)
	return traducir(err, "guardando configuración de la evaluación")
}

// --- Intentos ---

const columnasIntento = `id, postulacion_id, iniciado_en, expira_en, finalizado_en, forzado, total, correctas, nota::float8`

func scanIntento(row pgx.Row) (*domain.Intento, error) {
	var i domain.Intento
	err := row.Scan(&i.ID, &i.PostulacionID, &i.IniciadoEn, &i.ExpiraEn, &i.FinalizadoEn, &i.Forzado, &i.Total, &i.Correctas, &i.Nota)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, traducir(err, "leyendo intento")
	}
	return &i, nil
}

func (r *pgConcursoRepository) FindIntento(ctx context.Context, postulacionID int64, forUpdate bool) (*domain.Intento, error) {
	sql := `SELECT ` + columnasIntento + ` FROM evaluacion_intentos WHERE postulacion_id = $1`
	if forUpdate {
		sql += ` FOR UPDATE`
	}
	return scanIntento(conn(ctx, r.pool).QueryRow(ctx, sql, postulacionID))
}

// CrearIntento saca al azar las preguntas del banco y las copia al examen, en orden aleatorio.
func (r *pgConcursoRepository) CrearIntento(ctx context.Context, postulacionID int64, expira time.Time, numPreguntas int) (*domain.Intento, error) {
	db := conn(ctx, r.pool)
	i, err := scanIntento(db.QueryRow(ctx, `
		INSERT INTO evaluacion_intentos (postulacion_id, expira_en) VALUES ($1, $2) RETURNING `+columnasIntento, postulacionID, expira))
	if err != nil {
		return nil, err
	}
	tag, err := db.Exec(ctx, `
		INSERT INTO evaluacion_respuestas (intento_id, orden, pregunta_id, enunciado, opciones, correcta)
		SELECT $1, row_number() OVER (), q.id, q.enunciado, q.opciones, q.correcta
		FROM (SELECT * FROM preguntas_evaluacion WHERE activa ORDER BY random() LIMIT $2) q`, i.ID, numPreguntas)
	if err != nil {
		return nil, traducir(err, "armando el examen")
	}
	i.Total = int(tag.RowsAffected())
	_, err = db.Exec(ctx, `UPDATE evaluacion_intentos SET total = $2 WHERE id = $1`, i.ID, i.Total)
	return i, traducir(err, "armando el examen")
}

func (r *pgConcursoRepository) PreguntaPendiente(ctx context.Context, intentoID int64) (*domain.PreguntaExamen, error) {
	var p domain.PreguntaExamen
	err := conn(ctx, r.pool).QueryRow(ctx, `
		SELECT orden, enunciado, opciones FROM evaluacion_respuestas
		WHERE intento_id = $1 AND respuesta IS NULL ORDER BY orden LIMIT 1`, intentoID).Scan(&p.Orden, &p.Enunciado, &p.Opciones)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, traducir(err, "leyendo pregunta")
	}
	return &p, nil
}

// Responder guarda la opción si es válida y la pregunta sigue sin contestar: no se vuelve atrás.
func (r *pgConcursoRepository) Responder(ctx context.Context, intentoID int64, orden, opcion int) (int64, error) {
	tag, err := conn(ctx, r.pool).Exec(ctx, `
		UPDATE evaluacion_respuestas SET respuesta = $3
		WHERE intento_id = $1 AND orden = $2 AND respuesta IS NULL AND $3 >= 0 AND $3 < jsonb_array_length(opciones)`,
		intentoID, orden, opcion)
	if err != nil {
		return 0, traducir(err, "guardando respuesta")
	}
	return tag.RowsAffected(), nil
}

// FinalizarIntento compara las respuestas con la matriz y guarda la nota sobre 100.
func (r *pgConcursoRepository) FinalizarIntento(ctx context.Context, intentoID int64, forzado bool) (*domain.Intento, error) {
	return scanIntento(conn(ctx, r.pool).QueryRow(ctx, `
		WITH c AS (SELECT count(*) FILTER (WHERE respuesta = correcta)::int AS correctas, count(*)::int AS total
		           FROM evaluacion_respuestas WHERE intento_id = $1)
		UPDATE evaluacion_intentos i
		SET finalizado_en = NOW(), forzado = $2, correctas = c.correctas, total = c.total,
		    nota = CASE WHEN c.total = 0 THEN 0 ELSE round(100.0 * c.correctas / c.total, 2) END
		FROM c WHERE i.id = $1
		RETURNING i.id, i.postulacion_id, i.iniciado_en, i.expira_en, i.finalizado_en, i.forzado, i.total, i.correctas, i.nota::float8`, intentoID, forzado))
}

func (r *pgConcursoRepository) ListIntentosVencidos(ctx context.Context, ahora time.Time) ([]int64, error) {
	rows, err := conn(ctx, r.pool).Query(ctx, `SELECT postulacion_id FROM evaluacion_intentos WHERE finalizado_en IS NULL AND expira_en <= $1`, ahora)
	if err != nil {
		return nil, traducir(err, "consultando intentos vencidos")
	}
	ids, err := pgx.CollectRows(rows, pgx.RowTo[int64])
	return ids, traducir(err, "leyendo intentos vencidos")
}

func (r *pgConcursoRepository) ListResultados(ctx context.Context) ([]domain.ResultadoEvaluacion, error) {
	return listar[domain.ResultadoEvaluacion](ctx, conn(ctx, r.pool), `
		SELECT p.id, p.codigo, dp.cedula, dp.nombres, dp.apellidos, u.email, s.cargo,
		       i.id, i.postulacion_id, i.iniciado_en, i.expira_en, i.finalizado_en, i.forzado, i.total, i.correctas, i.nota::float8
		FROM evaluacion_intentos i
		JOIN postulaciones p ON p.id = i.postulacion_id
		JOIN usuarios u ON u.id = p.usuario_id
		JOIN postulacion_datos_personales dp ON dp.postulacion_id = p.id
		LEFT JOIN sectores s ON s.codigo = p.sector_codigo
		ORDER BY i.nota DESC NULLS LAST, dp.apellidos`)
}

// --- Reconsideraciones ---

const selectReconsideracion = `
	SELECT r.id, r.postulacion_id, r.etapa, r.motivo, r.estado, r.respuesta, r.responder_antes, r.respondida_en,
	       r.respondida_por, r.creado_en, p.codigo, dp.nombres || ' ' || dp.apellidos, dp.cedula, u.email
	FROM reconsideraciones r
	JOIN postulaciones p ON p.id = r.postulacion_id
	JOIN usuarios u ON u.id = p.usuario_id
	JOIN postulacion_datos_personales dp ON dp.postulacion_id = p.id`

func scanReconsideraciones(rows pgx.Rows) ([]domain.Reconsideracion, error) {
	items, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (domain.Reconsideracion, error) {
		var x domain.Reconsideracion
		err := row.Scan(&x.ID, &x.PostulacionID, &x.Etapa, &x.Motivo, &x.Estado, &x.Respuesta, &x.ResponderAntes, &x.RespondidaEn,
			&x.RespondidaPor, &x.CreadoEn, &x.Codigo, &x.Nombres, &x.Cedula, &x.Email)
		return x, err
	})
	if err != nil {
		return nil, traducir(err, "leyendo reconsideraciones")
	}
	return noNil(items), nil
}

// ListReconsideraciones devuelve las de una postulación, o todas si el id es 0.
func (r *pgConcursoRepository) ListReconsideraciones(ctx context.Context, postulacionID int64) ([]domain.Reconsideracion, error) {
	rows, err := conn(ctx, r.pool).Query(ctx, selectReconsideracion+`
		WHERE $1 = 0 OR r.postulacion_id = $1 ORDER BY r.estado <> 'PENDIENTE', r.responder_antes`, postulacionID)
	if err != nil {
		return nil, traducir(err, "consultando reconsideraciones")
	}
	return scanReconsideraciones(rows)
}

func (r *pgConcursoRepository) CrearReconsideracion(ctx context.Context, x domain.Reconsideracion) error {
	_, err := conn(ctx, r.pool).Exec(ctx, `
		INSERT INTO reconsideraciones (postulacion_id, etapa, motivo, responder_antes) VALUES ($1, $2, $3, $4)`,
		x.PostulacionID, x.Etapa, x.Motivo, x.ResponderAntes)
	return traducir(err, "guardando reconsideración")
}

func (r *pgConcursoRepository) FindReconsideracion(ctx context.Context, id int64) (*domain.Reconsideracion, error) {
	rows, err := conn(ctx, r.pool).Query(ctx, selectReconsideracion+` WHERE r.id = $1`, id)
	if err != nil {
		return nil, traducir(err, "consultando reconsideración")
	}
	items, err := scanReconsideraciones(rows)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, ErrNotFound
	}
	return &items[0], nil
}

func (r *pgConcursoRepository) ResponderReconsideracion(ctx context.Context, id int64, estado, respuesta, por string) (int64, error) {
	tag, err := conn(ctx, r.pool).Exec(ctx, `
		UPDATE reconsideraciones SET estado = $2, respuesta = $3, respondida_por = $4, respondida_en = NOW()
		WHERE id = $1 AND estado = 'PENDIENTE'`, id, estado, respuesta, por)
	if err != nil {
		return 0, traducir(err, "respondiendo reconsideración")
	}
	return tag.RowsAffected(), nil
}
