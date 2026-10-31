// Package cache define las interfaces de caché y sus implementaciones con Redis.
package cache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// CatalogoCache guarda catálogos serializados en JSON con un TTL fijo.
type CatalogoCache interface {
	// Get deserializa el valor de key en dest. Devuelve false si la clave no existe.
	Get(ctx context.Context, key string, dest any) (bool, error)
	Set(ctx context.Context, key string, value any) error
}

type redisCatalogoCache struct {
	rdb *redis.Client
	ttl time.Duration
}

func NewCatalogoCache(rdb *redis.Client, ttl time.Duration) CatalogoCache {
	return &redisCatalogoCache{rdb: rdb, ttl: ttl}
}

func (c *redisCatalogoCache) Get(ctx context.Context, key string, dest any) (bool, error) {
	data, err := c.rdb.Get(ctx, key).Bytes()
	if errors.Is(err, redis.Nil) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("leyendo %s de redis: %w", key, err)
	}
	if err := json.Unmarshal(data, dest); err != nil {
		return false, fmt.Errorf("decodificando %s: %w", key, err)
	}
	return true, nil
}

func (c *redisCatalogoCache) Set(ctx context.Context, key string, value any) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("codificando %s: %w", key, err)
	}
	if err := c.rdb.Set(ctx, key, data, c.ttl).Err(); err != nil {
		return fmt.Errorf("guardando %s en redis: %w", key, err)
	}
	return nil
}
