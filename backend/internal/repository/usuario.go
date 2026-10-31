package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

// ErrDuplicado indica una violación de UNIQUE; Constraint dice cuál (cedula o email).
type ErrDuplicado struct {
	Constraint string
}

func (e *ErrDuplicado) Error() string { return "valor duplicado en " + e.Constraint }

type UsuarioRepository interface {
	ExistsByCedula(ctx context.Context, cedula string) (bool, error)
	Create(ctx context.Context, u *domain.Usuario) error
}

type pgUsuarioRepository struct {
	pool *pgxpool.Pool
}

func NewUsuarioRepository(pool *pgxpool.Pool) UsuarioRepository {
	return &pgUsuarioRepository{pool: pool}
}

func (r *pgUsuarioRepository) ExistsByCedula(ctx context.Context, cedula string) (bool, error) {
	var existe bool
	err := r.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM usuarios WHERE cedula = $1)`, cedula).Scan(&existe)
	if err != nil {
		return false, fmt.Errorf("consultando usuario: %w", err)
	}
	return existe, nil
}

// Create inserta el usuario y completa ID y CreadoEn.
func (r *pgUsuarioRepository) Create(ctx context.Context, u *domain.Usuario) error {
	err := r.pool.QueryRow(ctx, `
		INSERT INTO usuarios (cedula, email, password_hash) VALUES ($1, $2, $3)
		RETURNING id, creado_en`, u.Cedula, u.Email, u.PasswordHash).
		Scan(&u.ID, &u.CreadoEn)
	if dup := asDuplicado(err); dup != nil {
		return dup
	}
	if err != nil {
		return fmt.Errorf("insertando usuario: %w", err)
	}
	return nil
}

// asDuplicado traduce el error 23505 (unique_violation) de PostgreSQL.
func asDuplicado(err error) *ErrDuplicado {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return &ErrDuplicado{Constraint: pgErr.ConstraintName}
	}
	return nil
}
