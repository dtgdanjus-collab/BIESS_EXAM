// Package repository define las interfaces de acceso a datos y sus implementaciones con pgx.
package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

// CatalogoRepository lee los catálogos desde PostgreSQL.
type CatalogoRepository interface {
	ListPaises(ctx context.Context) ([]domain.Item, error)
	ListProvincias(ctx context.Context, paisID int) ([]domain.Item, error)
	ListCantones(ctx context.Context, provinciaID int) ([]domain.Item, error)
	ListParentescos(ctx context.Context) ([]domain.Item, error)
	ListNiveles(ctx context.Context) ([]domain.NivelInstruccion, error)
	ListAreas(ctx context.Context) ([]domain.Item, error)
	ListSectores(ctx context.Context) ([]domain.Sector, error)
	ListInhabilidades(ctx context.Context) ([]domain.PreguntaInhabilidad, error)
}

type pgCatalogoRepository struct {
	pool *pgxpool.Pool
}

func NewCatalogoRepository(pool *pgxpool.Pool) CatalogoRepository {
	return &pgCatalogoRepository{pool: pool}
}

func (r *pgCatalogoRepository) ListPaises(ctx context.Context) ([]domain.Item, error) {
	return queryItems(ctx, r.pool, `SELECT id, nombre FROM paises ORDER BY nombre`)
}

func (r *pgCatalogoRepository) ListProvincias(ctx context.Context, paisID int) ([]domain.Item, error) {
	return queryItems(ctx, r.pool, `SELECT id, nombre FROM provincias WHERE pais_id = $1 ORDER BY nombre`, paisID)
}

func (r *pgCatalogoRepository) ListCantones(ctx context.Context, provinciaID int) ([]domain.Item, error) {
	return queryItems(ctx, r.pool, `SELECT id, nombre FROM cantones WHERE provincia_id = $1 ORDER BY nombre`, provinciaID)
}

func (r *pgCatalogoRepository) ListParentescos(ctx context.Context) ([]domain.Item, error) {
	return queryItems(ctx, r.pool, `SELECT id, nombre FROM parentescos ORDER BY nombre`)
}

func (r *pgCatalogoRepository) ListAreas(ctx context.Context) ([]domain.Item, error) {
	return queryItems(ctx, r.pool, `SELECT id, nombre FROM areas_estudio ORDER BY id`)
}

func (r *pgCatalogoRepository) ListNiveles(ctx context.Context) ([]domain.NivelInstruccion, error) {
	return queryList(ctx, r.pool, `SELECT id, nombre, orden FROM niveles_instruccion ORDER BY orden`,
		pgx.RowToStructByPos[domain.NivelInstruccion])
}

func (r *pgCatalogoRepository) ListSectores(ctx context.Context) ([]domain.Sector, error) {
	return queryList(ctx, r.pool, `
		SELECT codigo, cargo, tipo_requerido, etiqueta_cumple, etiqueta_no_cumple,
		       mensaje_rechazo, pregunta_respaldo
		FROM sectores ORDER BY codigo`,
		pgx.RowToStructByPos[domain.Sector])
}

func (r *pgCatalogoRepository) ListInhabilidades(ctx context.Context) ([]domain.PreguntaInhabilidad, error) {
	return queryList(ctx, r.pool, `
		SELECT id, numeral, texto, respuesta_esperada, requiere_detalle, orden
		FROM preguntas_inhabilidad ORDER BY orden`,
		pgx.RowToStructByPos[domain.PreguntaInhabilidad])
}

func queryItems(ctx context.Context, pool *pgxpool.Pool, sql string, args ...any) ([]domain.Item, error) {
	return queryList(ctx, pool, sql, pgx.RowToStructByPos[domain.Item], args...)
}

// queryList ejecuta la consulta y mapea cada fila con scan. Siempre devuelve un slice
// no nulo para que la API responda [] en lugar de null.
func queryList[T any](ctx context.Context, pool *pgxpool.Pool, sql string, scan pgx.RowToFunc[T], args ...any) ([]T, error) {
	rows, err := pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("consultando catálogo: %w", err)
	}
	items, err := pgx.CollectRows(rows, scan)
	if err != nil {
		return nil, fmt.Errorf("leyendo catálogo: %w", err)
	}
	if items == nil {
		items = []T{}
	}
	return items, nil
}
