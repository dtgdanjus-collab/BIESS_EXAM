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
