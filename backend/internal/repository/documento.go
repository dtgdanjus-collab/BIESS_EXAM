package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

func (r *pgDetalleRepository) TotalDocumentos(ctx context.Context, id int64) (int64, error) {
	var total int64
	err := conn(ctx, r.pool).QueryRow(ctx,
		`SELECT COALESCE(SUM(tamano_bytes), 0) FROM documentos WHERE postulacion_id = $1`, id).Scan(&total)
	return total, traducir(err, "sumando documentos")
}

func (r *pgDetalleRepository) InsertDocumento(ctx context.Context, id int64, categoria, nombre string, contenido []byte) (*domain.Documento, error) {
	d := domain.Documento{Categoria: categoria, Nombre: nombre, TamanoBytes: int64(len(contenido))}
	err := conn(ctx, r.pool).QueryRow(ctx, `
		INSERT INTO documentos (postulacion_id, categoria, nombre_original, tamano_bytes, contenido)
		VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		id, categoria, nombre, d.TamanoBytes, contenido).Scan(&d.ID)
	if err != nil {
		return nil, traducir(err, "guardando documento")
	}
	return &d, nil
}

// FindDocumento solo devuelve el archivo a su dueño: el JOIN con la postulación impide leer el de otro.
func (r *pgDetalleRepository) FindDocumento(ctx context.Context, usuarioID, documentoID int64) (*domain.Documento, []byte, error) {
	var d domain.Documento
	var contenido []byte
	err := conn(ctx, r.pool).QueryRow(ctx, `
		SELECT d.id, d.categoria, d.nombre_original, d.tamano_bytes, d.contenido
		FROM documentos d JOIN postulaciones p ON p.id = d.postulacion_id
		WHERE d.id = $1 AND p.usuario_id = $2`, documentoID, usuarioID).
		Scan(&d.ID, &d.Categoria, &d.Nombre, &d.TamanoBytes, &contenido)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, ErrNotFound
	}
	if err != nil {
		return nil, nil, traducir(err, "leyendo documento")
	}
	return &d, contenido, nil
}

func (r *pgDetalleRepository) DocumentosValidos(ctx context.Context, id int64, categoria string) (map[int64]bool, error) {
	rows, err := conn(ctx, r.pool).Query(ctx,
		`SELECT id FROM documentos WHERE postulacion_id = $1 AND categoria = $2`, id, categoria)
	if err != nil {
		return nil, traducir(err, "consultando documentos")
	}
	ids, err := pgx.CollectRows(rows, pgx.RowTo[int64])
	if err != nil {
		return nil, traducir(err, "leyendo documentos")
	}
	validos := make(map[int64]bool, len(ids))
	for _, i := range ids {
		validos[i] = true
	}
	return validos, nil
}

// LimpiarDocumentos borra los archivos de una categoría que ningún registro usa:
// los reemplazados y los subidos en un formulario que no se llegó a guardar.
func (r *pgDetalleRepository) LimpiarDocumentos(ctx context.Context, id int64, categoria string) error {
	_, err := conn(ctx, r.pool).Exec(ctx, `
		DELETE FROM documentos d
		WHERE d.postulacion_id = $1 AND d.categoria = $2
		  AND NOT EXISTS (SELECT 1 FROM postulaciones x WHERE x.organizacion_documento_id = d.id)
		  AND NOT EXISTS (SELECT 1 FROM formacion_academica x WHERE x.documento_id = d.id)
		  AND NOT EXISTS (SELECT 1 FROM experiencia x WHERE x.documento_id = d.id)
		  AND NOT EXISTS (SELECT 1 FROM publicaciones x WHERE x.documento_id = d.id)
		  AND NOT EXISTS (SELECT 1 FROM capacitaciones x WHERE x.documento_id = d.id)`, id, categoria)
	return traducir(err, "limpiando documentos")
}
