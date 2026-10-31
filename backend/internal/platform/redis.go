package platform

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/biess-dev/biess-postulacion/backend/internal/config"
)

// NewRedisClient crea el cliente de Redis y verifica la conexión con PING.
func NewRedisClient(ctx context.Context, cfg config.RedisConfig) (*redis.Client, error) {
	opts := &redis.Options{Addr: cfg.Addr, Password: cfg.Password, DB: cfg.DB}
	if cfg.URL != "" {
		parsed, err := redis.ParseURL(cfg.URL)
		if err != nil {
			return nil, fmt.Errorf("REDIS_URL inválida: %w", err)
		}
		opts = parsed
	}
	client := redis.NewClient(opts)

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("redis no responde en %s: %w", opts.Addr, err)
	}
	return client, nil
}

// RedisPinger adapta *redis.Client a la interfaz Ping(ctx) error que usa el health check.
type RedisPinger struct {
	Client *redis.Client
}

func (p RedisPinger) Ping(ctx context.Context) error {
	return p.Client.Ping(ctx).Err()
}
