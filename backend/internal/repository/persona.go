package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

// ErrNotFound indica que la fila buscada no existe. Los services deciden qué significa para el negocio.
var ErrNotFound = errors.New("registro no encontrado")

// RegistroCivilRepository simula el servicio externo del Registro Civil.
type RegistroCivilRepository interface {
	FindByCedula(ctx context.Context, cedula string) (*domain.Persona, error)
	// FindPadron devuelve los nombres reales de la cédula si está en el padrón (ErrNotFound si no).
	FindPadron(ctx context.Context, cedula string) (nombres, apellidos string, err error)
	// CrearSimulada da de alta una persona ficticia y sus calidades en el Historial
	// Laboral, en una transacción. Si la cédula ya existe no la modifica (una sola
	// persona por cédula) y devuelve la que estaba guardada.
	CrearSimulada(ctx context.Context, p domain.Persona, calidades []string) (*domain.Persona, error)
}

func (r *pgRegistroCivilRepository) FindPadron(ctx context.Context, cedula string) (string, string, error) {
	var nombres, apellidos string
	err := r.pool.QueryRow(ctx, `SELECT nombres, apellidos FROM mock_padron WHERE cedula = $1`, cedula).Scan(&nombres, &apellidos)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", ErrNotFound
	}
	if err != nil {
		return "", "", fmt.Errorf("consultando padrón: %w", err)
	}
	return nombres, apellidos, nil
}

func (r *pgRegistroCivilRepository) CrearSimulada(ctx context.Context, p domain.Persona, calidades []string) (*domain.Persona, error) {
	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			INSERT INTO mock_registro_civil (cedula, nombres, apellidos, genero, fecha_nacimiento, nacionalidad,
				estado_civil, conyuge_nombres, conyuge_cedula, fecha_expedicion, codigo_dactilar)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			ON CONFLICT (cedula) DO NOTHING`,
			p.Cedula, p.Nombres, p.Apellidos, p.Genero, p.FechaNacimiento, p.Nacionalidad, p.EstadoCivil,
			p.ConyugeNombres, p.ConyugeCedula, p.FechaExpedicion, p.CodigoDactilar)
		if err != nil {
			return fmt.Errorf("creando persona simulada: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return nil // otra petición la creó primero: se conserva esa
		}
		for _, c := range calidades {
			if _, err := tx.Exec(ctx, `
				INSERT INTO mock_historial_laboral (cedula, tipo) VALUES ($1, $2)
				ON CONFLICT DO NOTHING`, p.Cedula, c); err != nil {
				return fmt.Errorf("creando historial simulado: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return r.FindByCedula(ctx, p.Cedula)
}

type pgRegistroCivilRepository struct {
	pool *pgxpool.Pool
}

func NewRegistroCivilRepository(pool *pgxpool.Pool) RegistroCivilRepository {
	return &pgRegistroCivilRepository{pool: pool}
}

// HistorialLaboralRepository simula el servicio de Historial Laboral del IESS.
type HistorialLaboralRepository interface {
	// TieneCalidad indica si la cédula tiene la calidad activa (AFILIADO, JUBILADO o EMPLEADOR).
	TieneCalidad(ctx context.Context, cedula, tipo string) (bool, error)
}

type pgHistorialLaboralRepository struct {
	pool *pgxpool.Pool
}

func NewHistorialLaboralRepository(pool *pgxpool.Pool) HistorialLaboralRepository {
	return &pgHistorialLaboralRepository{pool: pool}
}

func (r *pgHistorialLaboralRepository) TieneCalidad(ctx context.Context, cedula, tipo string) (bool, error) {
	var ok bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM mock_historial_laboral WHERE cedula = $1 AND tipo = $2 AND activo)`,
		cedula, tipo).Scan(&ok)
	if err != nil {
		return false, fmt.Errorf("consultando historial laboral: %w", err)
	}
	return ok, nil
}

func (r *pgRegistroCivilRepository) FindByCedula(ctx context.Context, cedula string) (*domain.Persona, error) {
	var p domain.Persona
	err := r.pool.QueryRow(ctx, `
		SELECT cedula, nombres, apellidos, genero, fecha_nacimiento, nacionalidad, estado_civil,
		       conyuge_nombres, conyuge_cedula, fecha_expedicion, codigo_dactilar
		FROM mock_registro_civil WHERE cedula = $1`, cedula).
		Scan(&p.Cedula, &p.Nombres, &p.Apellidos, &p.Genero, &p.FechaNacimiento, &p.Nacionalidad,
			&p.EstadoCivil, &p.ConyugeNombres, &p.ConyugeCedula, &p.FechaExpedicion, &p.CodigoDactilar)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("consultando registro civil: %w", err)
	}
	return &p, nil
}
