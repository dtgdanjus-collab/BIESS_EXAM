package repository

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DBTX lo cumplen tanto *pgxpool.Pool como pgx.Tx: los repositories escriben
// el mismo SQL y funcionan dentro o fuera de una transacción.
type DBTX interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// TxManager permite a los services agrupar varias operaciones en una transacción
// sin depender de pgx: la transacción viaja dentro del context.
type TxManager interface {
	WithTx(ctx context.Context, fn func(ctx context.Context) error) error
}

type txKey struct{}

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// WithTx ejecuta fn entre BEGIN y COMMIT. Si fn devuelve error (o hay panic) se hace
// ROLLBACK y no queda ningún cambio parcial. Si ya hay una transacción en ctx, la reutiliza.
func (s *Store) WithTx(ctx context.Context, fn func(ctx context.Context) error) error {
	if _, ok := ctx.Value(txKey{}).(pgx.Tx); ok {
		return fn(ctx)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("iniciando transacción: %w", err)
	}
	defer tx.Rollback(ctx) // no-op si ya hubo Commit; cubre también los panics

	if err := fn(context.WithValue(ctx, txKey{}, tx)); err != nil {
		log.Printf("TX ROLLBACK: %v", err)
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("confirmando transacción: %w", err)
	}
	return nil
}

// conn devuelve la transacción activa del context o, si no hay, el pool.
func conn(ctx context.Context, pool *pgxpool.Pool) DBTX {
	if tx, ok := ctx.Value(txKey{}).(pgx.Tx); ok {
		return tx
	}
	return pool
}

// ErrReferencia indica una FK inválida (23503), p. ej. un parentesco o cantón inexistente.
var ErrReferencia = errors.New("referencia a un catálogo inexistente")

// traducir convierte errores de PostgreSQL conocidos en errores del paquete.
func traducir(err error, op string) error {
	if err == nil {
		return nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23503":
			return fmt.Errorf("%s: %w (%s)", op, ErrReferencia, pgErr.ConstraintName)
		case "23505":
			return &ErrDuplicado{Constraint: pgErr.ConstraintName}
		}
	}
	return fmt.Errorf("%s: %w", op, err)
}
