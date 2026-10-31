package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
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
	FindByCedula(ctx context.Context, cedula string) (*domain.Usuario, error)
	FindByID(ctx context.Context, id int64) (*domain.Usuario, error)
	Create(ctx context.Context, u *domain.Usuario) error
	UpdatePassword(ctx context.Context, cedula, passwordHash string) error
}

type pgUsuarioRepository struct {
	pool *pgxpool.Pool
}

func NewUsuarioRepository(pool *pgxpool.Pool) UsuarioRepository {
	return &pgUsuarioRepository{pool: pool}
}

const selectUsuario = `SELECT id, cedula, email, password_hash, creado_en FROM usuarios `

func (r *pgUsuarioRepository) FindByCedula(ctx context.Context, cedula string) (*domain.Usuario, error) {
	return r.findOne(ctx, selectUsuario+`WHERE cedula = $1`, cedula)
}

func (r *pgUsuarioRepository) FindByID(ctx context.Context, id int64) (*domain.Usuario, error) {
	return r.findOne(ctx, selectUsuario+`WHERE id = $1`, id)
}

func (r *pgUsuarioRepository) findOne(ctx context.Context, sql string, arg any) (*domain.Usuario, error) {
	var u domain.Usuario
	err := r.pool.QueryRow(ctx, sql, arg).Scan(&u.ID, &u.Cedula, &u.Email, &u.PasswordHash, &u.CreadoEn)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("consultando usuario: %w", err)
	}
	return &u, nil
}

func (r *pgUsuarioRepository) UpdatePassword(ctx context.Context, cedula, passwordHash string) error {
	tag, err := r.pool.Exec(ctx, `UPDATE usuarios SET password_hash = $2 WHERE cedula = $1`, cedula, passwordHash)
	if err != nil {
		return fmt.Errorf("actualizando contraseña: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
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
