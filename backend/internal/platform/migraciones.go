package platform

import (
	"context"
	"embed"
	"fmt"
	"log"
	"slices"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migraciones/*.sql
var archivosMigracion embed.FS

// Clave arbitraria del bloqueo: si arrancan dos instancias a la vez, una espera a la otra.
const bloqueoMigraciones = 701012

// Migrar aplica al arrancar, en orden y una sola vez, las migraciones que falten. Así una base
// ya creada queda al día con solo desplegar. Cada archivo corre en su propia transacción.
func Migrar(ctx context.Context, pool *pgxpool.Pool) error {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("migraciones: conexión: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock($1)`, bloqueoMigraciones); err != nil {
		return fmt.Errorf("migraciones: bloqueo: %w", err)
	}
	defer func() {
		if _, err := conn.Exec(context.WithoutCancel(ctx), `SELECT pg_advisory_unlock($1)`, bloqueoMigraciones); err != nil {
			log.Printf("migraciones: no se pudo soltar el bloqueo: %v", err)
		}
	}()

	if _, err := conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migraciones (
		nombre     VARCHAR(100) PRIMARY KEY,
		aplicada_en TIMESTAMPTZ NOT NULL DEFAULT NOW())`); err != nil {
		return fmt.Errorf("migraciones: tabla de control: %w", err)
	}

	entradas, err := archivosMigracion.ReadDir("migraciones")
	if err != nil {
		return fmt.Errorf("migraciones: lectura: %w", err)
	}
	nombres := make([]string, 0, len(entradas))
	for _, e := range entradas {
		nombres = append(nombres, e.Name())
	}
	slices.Sort(nombres)

	for _, nombre := range nombres {
		var aplicada bool
		if err := conn.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM schema_migraciones WHERE nombre = $1)`, nombre).Scan(&aplicada); err != nil {
			return fmt.Errorf("migraciones: consulta de %s: %w", nombre, err)
		}
		if aplicada {
			continue
		}
		sql, err := archivosMigracion.ReadFile("migraciones/" + nombre)
		if err != nil {
			return fmt.Errorf("migraciones: lectura de %s: %w", nombre, err)
		}
		if err := pgx.BeginFunc(ctx, conn.Conn(), func(tx pgx.Tx) error {
			if _, err := tx.Exec(ctx, string(sql)); err != nil {
				return err
			}
			_, err := tx.Exec(ctx, `INSERT INTO schema_migraciones (nombre) VALUES ($1)`, nombre)
			return err
		}); err != nil {
			return fmt.Errorf("migración %s: %w", nombre, err)
		}
		log.Printf("migración aplicada: %s", nombre)
	}
	return nil
}
