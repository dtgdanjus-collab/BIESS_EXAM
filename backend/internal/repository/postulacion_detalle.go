package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

// DetalleRepository: secciones 1:N de la postulación (1.4 a 1.10).
// Los Replace* hacen DELETE + INSERT y deben llamarse dentro de WithTx.
type DetalleRepository interface {
	UpdateCargo(ctx context.Context, postulacionID int64, sector string, tieneRespaldo bool, organizacion *string, documentoID *int64) error
	EliminarCargo(ctx context.Context, postulacionID int64) error

	// Documentos de respaldo (documento.go).
	TotalDocumentos(ctx context.Context, postulacionID int64) (int64, error)
	InsertDocumento(ctx context.Context, postulacionID int64, categoria, nombre string, contenido []byte) (*domain.Documento, error)
	FindDocumento(ctx context.Context, usuarioID, documentoID int64) (*domain.Documento, []byte, error)
	DocumentosValidos(ctx context.Context, postulacionID int64, categoria string) (map[int64]bool, error)
	LimpiarDocumentos(ctx context.Context, postulacionID int64, categoria string) error

	ListFormacion(ctx context.Context, postulacionID int64) ([]domain.Formacion, error)
	ReplaceFormacion(ctx context.Context, postulacionID int64, items []domain.Formacion) error

	ListExperiencia(ctx context.Context, postulacionID int64) ([]domain.Experiencia, error)
	ReplaceExperiencia(ctx context.Context, postulacionID int64, items []domain.Experiencia) error

	ListPublicaciones(ctx context.Context, postulacionID int64) ([]domain.Publicacion, error)
	ReplacePublicaciones(ctx context.Context, postulacionID int64, tiene bool, items []domain.Publicacion) error

	ListCapacitaciones(ctx context.Context, postulacionID int64) ([]domain.Capacitacion, error)
	ReplaceCapacitaciones(ctx context.Context, postulacionID int64, items []domain.Capacitacion) error

	ListInhabilidades(ctx context.Context, postulacionID int64) ([]domain.RespuestaInhabilidad, error)
	ReplaceInhabilidades(ctx context.Context, postulacionID int64, items []domain.RespuestaInhabilidad, posibleInhabilidad bool) error

	MarcarEnviada(ctx context.Context, postulacionID int64) error
}

type pgDetalleRepository struct {
	pool *pgxpool.Pool
}

func NewDetalleRepository(pool *pgxpool.Pool) DetalleRepository {
	return &pgDetalleRepository{pool: pool}
}

func (r *pgDetalleRepository) UpdateCargo(ctx context.Context, id int64, sector string, tieneRespaldo bool, org *string, documentoID *int64) error {
	_, err := conn(ctx, r.pool).Exec(ctx, `
		UPDATE postulaciones SET sector_codigo = $2, tiene_respaldo = $3, organizacion_nombre = $4,
			organizacion_documento_id = $5
		WHERE id = $1`, id, sector, tieneRespaldo, org, documentoID)
	return traducir(err, "guardando cargo")
}

func (r *pgDetalleRepository) EliminarCargo(ctx context.Context, id int64) error {
	_, err := conn(ctx, r.pool).Exec(ctx, `
		UPDATE postulaciones SET sector_codigo = NULL, tiene_respaldo = NULL, organizacion_nombre = NULL,
			organizacion_documento_id = NULL
		WHERE id = $1`, id)
	return traducir(err, "eliminando cargo")
}

// El PDF de cada registro: solo sus datos, nunca el contenido.
const (
	columnasAdjunto = `d.id, d.nombre_original, d.tamano_bytes`
	joinAdjunto     = `LEFT JOIN documentos d ON d.id = t.documento_id`
)

// --- Formación ---

func (r *pgDetalleRepository) ListFormacion(ctx context.Context, id int64) ([]domain.Formacion, error) {
	return listar[domain.Formacion](ctx, conn(ctx, r.pool), `
		SELECT t.id, t.nivel_id, t.institucion, t.tipo, t.titulo, t.area_id, t.registro_senescyt, t.fecha_registro,
			`+columnasAdjunto+`
		FROM formacion_academica t `+joinAdjunto+` WHERE t.postulacion_id = $1 ORDER BY t.fecha_registro DESC, t.id`, id)
}

func (r *pgDetalleRepository) ReplaceFormacion(ctx context.Context, id int64, items []domain.Formacion) error {
	return reemplazar(ctx, conn(ctx, r.pool), "formacion_academica", id, `
		INSERT INTO formacion_academica (postulacion_id, nivel_id, institucion, tipo, titulo, area_id,
			registro_senescyt, fecha_registro, documento_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		items, func(f domain.Formacion) []any {
			return []any{f.NivelID, f.Institucion, f.Tipo, f.Titulo, f.AreaID, f.RegistroSenescyt, f.FechaRegistro, f.DocumentoID}
		})
}

// --- Experiencia ---

func (r *pgDetalleRepository) ListExperiencia(ctx context.Context, id int64) ([]domain.Experiencia, error) {
	return listar[domain.Experiencia](ctx, conn(ctx, r.pool), `
		SELECT t.id, t.tipo, t.cargo, t.institucion, t.fecha_inicio, t.fecha_fin, t.area_id, t.descripcion,
			`+columnasAdjunto+`
		FROM experiencia t `+joinAdjunto+` WHERE t.postulacion_id = $1 ORDER BY t.fecha_inicio DESC, t.id`, id)
}

func (r *pgDetalleRepository) ReplaceExperiencia(ctx context.Context, id int64, items []domain.Experiencia) error {
	return reemplazar(ctx, conn(ctx, r.pool), "experiencia", id, `
		INSERT INTO experiencia (postulacion_id, tipo, cargo, institucion, fecha_inicio, fecha_fin,
			area_id, descripcion, documento_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		items, func(e domain.Experiencia) []any {
			return []any{e.Tipo, e.Cargo, e.Institucion, e.FechaInicio, e.FechaFin, e.AreaID, e.Descripcion, e.DocumentoID}
		})
}

// --- Publicaciones ---

func (r *pgDetalleRepository) ListPublicaciones(ctx context.Context, id int64) ([]domain.Publicacion, error) {
	return listar[domain.Publicacion](ctx, conn(ctx, r.pool), `
		SELECT t.id, t.titulo, t.tipo, t.medio, t.fecha, t.relacionada,
			`+columnasAdjunto+`
		FROM publicaciones t `+joinAdjunto+` WHERE t.postulacion_id = $1 ORDER BY t.fecha DESC, t.id`, id)
}

func (r *pgDetalleRepository) ReplacePublicaciones(ctx context.Context, id int64, tiene bool, items []domain.Publicacion) error {
	db := conn(ctx, r.pool)
	if _, err := db.Exec(ctx, `UPDATE postulaciones SET tiene_publicaciones = $2 WHERE id = $1`, id, tiene); err != nil {
		return traducir(err, "actualizando postulación")
	}
	return reemplazar(ctx, db, "publicaciones", id, `
		INSERT INTO publicaciones (postulacion_id, titulo, tipo, medio, fecha, relacionada, documento_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		items, func(p domain.Publicacion) []any {
			return []any{p.Titulo, p.Tipo, p.Medio, p.Fecha, p.Relacionada, p.DocumentoID}
		})
}

// --- Capacitaciones ---

func (r *pgDetalleRepository) ListCapacitaciones(ctx context.Context, id int64) ([]domain.Capacitacion, error) {
	return listar[domain.Capacitacion](ctx, conn(ctx, r.pool), `
		SELECT t.id, t.tipo, t.nombre, t.institucion, t.fecha_inicio, t.fecha_fin, t.horas,
			`+columnasAdjunto+`
		FROM capacitaciones t `+joinAdjunto+` WHERE t.postulacion_id = $1 ORDER BY t.fecha_inicio DESC, t.id`, id)
}

func (r *pgDetalleRepository) ReplaceCapacitaciones(ctx context.Context, id int64, items []domain.Capacitacion) error {
	return reemplazar(ctx, conn(ctx, r.pool), "capacitaciones", id, `
		INSERT INTO capacitaciones (postulacion_id, tipo, nombre, institucion, fecha_inicio, fecha_fin, horas, documento_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		items, func(c domain.Capacitacion) []any {
			return []any{c.Tipo, c.Nombre, c.Institucion, c.FechaInicio, c.FechaFin, c.Horas, c.DocumentoID}
		})
}

// --- Inhabilidades ---

func (r *pgDetalleRepository) ListInhabilidades(ctx context.Context, id int64) ([]domain.RespuestaInhabilidad, error) {
	rows, err := conn(ctx, r.pool).Query(ctx, `
		SELECT r.pregunta_id, r.respuesta, r.detalle_institucion, r.detalle_cargo, r.detalle_fecha_fin, r.detalle_motivo
		FROM respuestas_inhabilidad r JOIN preguntas_inhabilidad p ON p.id = r.pregunta_id
		WHERE r.postulacion_id = $1 ORDER BY p.orden`, id)
	if err != nil {
		return nil, traducir(err, "consultando inhabilidades")
	}
	items, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (domain.RespuestaInhabilidad, error) {
		var ri domain.RespuestaInhabilidad
		var inst, cargo, motivo *string
		var fin domain.Fecha
		if err := row.Scan(&ri.PreguntaID, &ri.Respuesta, &inst, &cargo, &fin, &motivo); err != nil {
			return ri, err
		}
		if inst != nil {
			ri.Detalle = &domain.DetalleRemocion{Institucion: *inst, Cargo: deref(cargo), FechaFin: fin, Motivo: deref(motivo)}
		}
		return ri, nil
	})
	if err != nil {
		return nil, traducir(err, "leyendo inhabilidades")
	}
	return noNil(items), nil
}

func (r *pgDetalleRepository) ReplaceInhabilidades(ctx context.Context, id int64, items []domain.RespuestaInhabilidad, posible bool) error {
	db := conn(ctx, r.pool)
	if _, err := db.Exec(ctx, `UPDATE postulaciones SET posible_inhabilidad = $2 WHERE id = $1`, id, posible); err != nil {
		return traducir(err, "actualizando postulación")
	}
	return reemplazar(ctx, db, "respuestas_inhabilidad", id, `
		INSERT INTO respuestas_inhabilidad (postulacion_id, pregunta_id, respuesta, detalle_institucion,
			detalle_cargo, detalle_fecha_fin, detalle_motivo) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		items, func(ri domain.RespuestaInhabilidad) []any {
			if ri.Detalle == nil {
				return []any{ri.PreguntaID, ri.Respuesta, nil, nil, nil, nil}
			}
			d := ri.Detalle
			return []any{ri.PreguntaID, ri.Respuesta, d.Institucion, d.Cargo, d.FechaFin, d.Motivo}
		})
}

// MarcarEnviada cambia el estado; el CHECK ck_envio_con_fecha garantiza en BD que
// una postulación ENVIADA tenga fecha y consentimiento.
func (r *pgDetalleRepository) MarcarEnviada(ctx context.Context, id int64) error {
	tag, err := conn(ctx, r.pool).Exec(ctx, `
		UPDATE postulaciones
		SET estado = 'ENVIADA', fecha_envio = NOW(),
		    consentimiento_aceptado = TRUE, consentimiento_fecha = NOW()
		WHERE id = $1 AND estado = 'BORRADOR'`, id)
	if err != nil {
		return traducir(err, "enviando postulación")
	}
	if tag.RowsAffected() == 0 {
		return errors.New("la postulación no estaba en BORRADOR")
	}
	return nil
}

// --- helpers genéricos ---

func listar[T any](ctx context.Context, db DBTX, sql string, args ...any) ([]T, error) {
	rows, err := db.Query(ctx, sql, args...)
	if err != nil {
		return nil, traducir(err, "consultando detalle")
	}
	items, err := pgx.CollectRows(rows, pgx.RowToStructByPos[T])
	if err != nil {
		return nil, traducir(err, "leyendo detalle")
	}
	return noNil(items), nil
}

// reemplazar borra las filas de la tabla para la postulación e inserta items con insertSQL
// ($1 = postulacion_id, el resto lo arma cols).
func reemplazar[T any](ctx context.Context, db DBTX, tabla string, id int64, insertSQL string, items []T, cols func(T) []any) error {
	if _, err := db.Exec(ctx, fmt.Sprintf(`DELETE FROM %s WHERE postulacion_id = $1`, tabla), id); err != nil {
		return traducir(err, "borrando "+tabla)
	}
	for _, it := range items {
		if _, err := db.Exec(ctx, insertSQL, append([]any{id}, cols(it)...)...); err != nil {
			return traducir(err, "insertando en "+tabla)
		}
	}
	return nil
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
