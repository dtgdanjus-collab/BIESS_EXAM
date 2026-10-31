// Package platform crea los clientes de infraestructura (PostgreSQL y Redis).
package platform

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/biess-dev/biess-postulacion/backend/internal/config"
)

// NewPostgresPool abre un pool de conexiones y verifica que la base responda.
func NewPostgresPool(ctx context.Context, cfg config.DBConfig) (*pgxpool.Pool, error) {
	poolCfg, err := pgxpool.ParseConfig(cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("configuración de postgres: %w", err)
	}
	poolCfg.MaxConns = 10
	poolCfg.MaxConnIdleTime = 5 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("creando pool de postgres: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("postgres no responde en %s:%d: %w", poolCfg.ConnConfig.Host, poolCfg.ConnConfig.Port, err)
	}
	return pool, nil
}
