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
