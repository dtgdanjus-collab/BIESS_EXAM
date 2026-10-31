package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

// PostulacionRepository: todas las funciones usan la transacción del context si existe.
type PostulacionRepository interface {
	// FindByUsuario devuelve la cabecera de la postulación. forUpdate bloquea la fila
	// (SELECT … FOR UPDATE) hasta el fin de la transacción.
	FindByUsuario(ctx context.Context, usuarioID int64, forUpdate bool) (*domain.Postulacion, error)
	Create(ctx context.Context, usuarioID int64, estado domain.EstadoPostulacion, motivoCierre *string) (*domain.Postulacion, error)
	AddHistorial(ctx context.Context, postulacionID int64, accion, detalle string) error

	GetDatosPersonales(ctx context.Context, postulacionID int64) (*domain.DatosPersonales, error)
	InsertDatosPersonales(ctx context.Context, postulacionID int64, d domain.DatosPersonales) error

	GetContacto(ctx context.Context, postulacionID int64) (*domain.Contacto, error)
	UpsertContacto(ctx context.Context, postulacionID int64, c domain.Contacto) error

	ListFamiliares(ctx context.Context, postulacionID int64) ([]domain.Familiar, error)
	ReplaceFamiliares(ctx context.Context, postulacionID int64, tiene bool, items []domain.Familiar) error
}

type pgPostulacionRepository struct {
	pool *pgxpool.Pool
}

func NewPostulacionRepository(pool *pgxpool.Pool) PostulacionRepository {
	return &pgPostulacionRepository{pool: pool}
}

const columnasPostulacion = `id, usuario_id, codigo, estado, motivo_cierre, sector_codigo, tiene_respaldo,
	organizacion_nombre, tiene_familiares, tiene_publicaciones, posible_inhabilidad,
	consentimiento_aceptado, consentimiento_fecha, fecha_envio, creado_en, actualizado_en`

func scanPostulacion(row pgx.Row) (*domain.Postulacion, error) {
	var p domain.Postulacion
	err := row.Scan(&p.ID, &p.UsuarioID, &p.Codigo, &p.Estado, &p.MotivoCierre, &p.SectorCodigo,
		&p.TieneRespaldo, &p.OrganizacionNombre, &p.TieneFamiliares, &p.TienePublicaciones,
		&p.PosibleInhabilidad, &p.ConsentimientoAceptado, &p.ConsentimientoFecha, &p.FechaEnvio,
		&p.CreadoEn, &p.ActualizadoEn)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, traducir(err, "leyendo postulación")
	}
	return &p, nil
}

func (r *pgPostulacionRepository) FindByUsuario(ctx context.Context, usuarioID int64, forUpdate bool) (*domain.Postulacion, error) {
	sql := `SELECT ` + columnasPostulacion + ` FROM postulaciones WHERE usuario_id = $1`
	if forUpdate {
		sql += ` FOR UPDATE`
	}
	return scanPostulacion(conn(ctx, r.pool).QueryRow(ctx, sql, usuarioID))
}

// Create genera el código único BIESS-<año>-<secuencia de 6 dígitos>.
func (r *pgPostulacionRepository) Create(ctx context.Context, usuarioID int64, estado domain.EstadoPostulacion, motivo *string) (*domain.Postulacion, error) {
	return scanPostulacion(conn(ctx, r.pool).QueryRow(ctx, `
		INSERT INTO postulaciones (usuario_id, codigo, estado, motivo_cierre)
		VALUES ($1, format('BIESS-%s-%s', to_char(NOW(), 'YYYY'),
		                   lpad(nextval('seq_codigo_postulacion')::text, 6, '0')), $2, $3)
		RETURNING `+columnasPostulacion, usuarioID, estado, motivo))
}

func (r *pgPostulacionRepository) AddHistorial(ctx context.Context, postulacionID int64, accion, detalle string) error {
	_, err := conn(ctx, r.pool).Exec(ctx,
		`INSERT INTO postulacion_historial (postulacion_id, accion, detalle) VALUES ($1, $2, NULLIF($3, ''))`,
		postulacionID, accion, detalle)
	return traducir(err, "registrando historial")
}

func (r *pgPostulacionRepository) GetDatosPersonales(ctx context.Context, id int64) (*domain.DatosPersonales, error) {
	var d domain.DatosPersonales
	err := conn(ctx, r.pool).QueryRow(ctx, `
		SELECT cedula, nombres, apellidos, genero, fecha_nacimiento, nacionalidad, estado_civil,
		       conyuge_nombres, conyuge_cedula
		FROM postulacion_datos_personales WHERE postulacion_id = $1`, id).
		Scan(&d.Cedula, &d.Nombres, &d.Apellidos, &d.Genero, &d.FechaNacimiento, &d.Nacionalidad,
			&d.EstadoCivil, &d.ConyugeNombres, &d.ConyugeCedula)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, traducir(err, "leyendo datos personales")
	}
	return &d, nil
}

func (r *pgPostulacionRepository) InsertDatosPersonales(ctx context.Context, id int64, d domain.DatosPersonales) error {
	_, err := conn(ctx, r.pool).Exec(ctx, `
		INSERT INTO postulacion_datos_personales (postulacion_id, cedula, nombres, apellidos, genero,
			fecha_nacimiento, nacionalidad, estado_civil, conyuge_nombres, conyuge_cedula)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		id, d.Cedula, d.Nombres, d.Apellidos, d.Genero, d.FechaNacimiento, d.Nacionalidad,
		d.EstadoCivil, d.ConyugeNombres, d.ConyugeCedula)
	return traducir(err, "guardando datos personales")
}

func (r *pgPostulacionRepository) GetContacto(ctx context.Context, id int64) (*domain.Contacto, error) {
	var c domain.Contacto
	err := conn(ctx, r.pool).QueryRow(ctx, `
		SELECT pais_id, provincia_id, canton_id, provincia_texto, ciudad_texto, telefono_celular,
		       correo1, correo2, calle_principal, numero, calle_secundaria, sector, referencia,
		       telefono_domicilio
		FROM postulacion_contacto WHERE postulacion_id = $1`, id).
		Scan(&c.PaisID, &c.ProvinciaID, &c.CantonID, &c.ProvinciaTexto, &c.CiudadTexto,
			&c.TelefonoCelular, &c.Correo1, &c.Correo2, &c.CallePrincipal, &c.Numero,
			&c.CalleSecundaria, &c.Sector, &c.Referencia, &c.TelefonoDomicilio)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, traducir(err, "leyendo contacto")
	}
	return &c, nil
}

func (r *pgPostulacionRepository) UpsertContacto(ctx context.Context, id int64, c domain.Contacto) error {
	_, err := conn(ctx, r.pool).Exec(ctx, `
		INSERT INTO postulacion_contacto (postulacion_id, pais_id, provincia_id, canton_id,
			provincia_texto, ciudad_texto, telefono_celular, correo1, correo2, calle_principal,
			numero, calle_secundaria, sector, referencia, telefono_domicilio)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		ON CONFLICT (postulacion_id) DO UPDATE SET
			pais_id = EXCLUDED.pais_id, provincia_id = EXCLUDED.provincia_id,
			canton_id = EXCLUDED.canton_id, provincia_texto = EXCLUDED.provincia_texto,
			ciudad_texto = EXCLUDED.ciudad_texto, telefono_celular = EXCLUDED.telefono_celular,
			correo1 = EXCLUDED.correo1, correo2 = EXCLUDED.correo2,
			calle_principal = EXCLUDED.calle_principal, numero = EXCLUDED.numero,
			calle_secundaria = EXCLUDED.calle_secundaria, sector = EXCLUDED.sector,
			referencia = EXCLUDED.referencia, telefono_domicilio = EXCLUDED.telefono_domicilio`,
		id, c.PaisID, c.ProvinciaID, c.CantonID, c.ProvinciaTexto, c.CiudadTexto, c.TelefonoCelular,
		c.Correo1, c.Correo2, c.CallePrincipal, c.Numero, c.CalleSecundaria, c.Sector, c.Referencia,
		c.TelefonoDomicilio)
	return traducir(err, "guardando contacto")
}

func (r *pgPostulacionRepository) ListFamiliares(ctx context.Context, id int64) ([]domain.Familiar, error) {
	rows, err := conn(ctx, r.pool).Query(ctx, `
		SELECT id, nombres_apellidos, parentesco_id, institucion, area, cargo
		FROM familiares WHERE postulacion_id = $1 ORDER BY id`, id)
	if err != nil {
		return nil, traducir(err, "consultando familiares")
	}
	items, err := pgx.CollectRows(rows, pgx.RowToStructByPos[domain.Familiar])
	if err != nil {
		return nil, traducir(err, "leyendo familiares")
	}
	return noNil(items), nil
}

// ReplaceFamiliares reemplaza la lista completa (DELETE + INSERT). Debe llamarse dentro
// de WithTx para que un fallo a mitad no deje la lista a medias.
func (r *pgPostulacionRepository) ReplaceFamiliares(ctx context.Context, id int64, tiene bool, items []domain.Familiar) error {
	db := conn(ctx, r.pool)
	if _, err := db.Exec(ctx, `UPDATE postulaciones SET tiene_familiares = $2 WHERE id = $1`, id, tiene); err != nil {
		return traducir(err, "actualizando postulación")
	}
	if _, err := db.Exec(ctx, `DELETE FROM familiares WHERE postulacion_id = $1`, id); err != nil {
		return traducir(err, "borrando familiares")
	}
	for _, f := range items {
		_, err := db.Exec(ctx, `
			INSERT INTO familiares (postulacion_id, nombres_apellidos, parentesco_id, institucion, area, cargo)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			id, f.NombresApellidos, f.ParentescoID, f.Institucion, f.Area, f.Cargo)
		if err != nil {
			return traducir(err, "insertando familiar")
		}
	}
	return nil
}

func noNil[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}
