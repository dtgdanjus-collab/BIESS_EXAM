package cache

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Prefijos de los tokens temporales.
const (
	TokenRegistro     = "reg:token:"
	TokenRecuperacion = "pwd:reset:"
)

// TokenCache guarda tokens de un solo uso con expiración (valor = cédula).
type TokenCache interface {
	Guardar(ctx context.Context, prefijo, token, valor string, ttl time.Duration) error
	// Obtener devuelve el valor sin borrarlo; ok=false si no existe o expiró.
	Obtener(ctx context.Context, prefijo, token string) (valor string, ok bool, err error)
	Borrar(ctx context.Context, prefijo, token string) error
}

type redisTokenCache struct {
	rdb *redis.Client
}

func NewTokenCache(rdb *redis.Client) TokenCache {
	return &redisTokenCache{rdb: rdb}
}

func (c *redisTokenCache) Guardar(ctx context.Context, prefijo, token, valor string, ttl time.Duration) error {
	if err := c.rdb.Set(ctx, prefijo+token, valor, ttl).Err(); err != nil {
		return fmt.Errorf("guardando token: %w", err)
	}
	return nil
}

func (c *redisTokenCache) Obtener(ctx context.Context, prefijo, token string) (string, bool, error) {
	v, err := c.rdb.Get(ctx, prefijo+token).Result()
	if errors.Is(err, redis.Nil) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("leyendo token: %w", err)
	}
	return v, true, nil
}

func (c *redisTokenCache) Borrar(ctx context.Context, prefijo, token string) error {
	if err := c.rdb.Del(ctx, prefijo+token).Err(); err != nil {
		return fmt.Errorf("borrando token: %w", err)
	}
	return nil
}
