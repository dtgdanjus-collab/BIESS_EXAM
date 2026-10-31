package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Ambito separa los contadores del registro y del login (claves distintas en Redis).
type Ambito string

const (
	AmbitoRegistro Ambito = "registro"
	AmbitoLogin    Ambito = "login"
)

// IntentosCache implementa el rate limiting de EF-11: N fallos → bloqueo temporal.
type IntentosCache interface {
	// Bloqueo devuelve el tiempo restante del bloqueo activo (0 si no hay bloqueo).
	Bloqueo(ctx context.Context, ambito Ambito, cedula string) (time.Duration, error)
	// RegistrarFallo suma un intento fallido. Si se alcanza el máximo activa el bloqueo
	// y devuelve bloqueado=true; si no, devuelve cuántos intentos quedan.
	RegistrarFallo(ctx context.Context, ambito Ambito, cedula string) (restantes int, bloqueado bool, err error)
	// Limpiar borra el contador tras un intento exitoso.
	Limpiar(ctx context.Context, ambito Ambito, cedula string) error
}

type redisIntentosCache struct {
	rdb     *redis.Client
	max     int
	bloqueo time.Duration
}

func NewIntentosCache(rdb *redis.Client, maxIntentos int, bloqueo time.Duration) IntentosCache {
	return &redisIntentosCache{rdb: rdb, max: maxIntentos, bloqueo: bloqueo}
}

// scriptFallo hace INCR + EXPIRE + bloqueo en una sola operación atómica,
// así dos peticiones simultáneas no pueden saltarse el límite.
// KEYS[1] = contador, KEYS[2] = bloqueo, ARGV[1] = máximo, ARGV[2] = ventana/bloqueo en ms.
var scriptFallo = redis.NewScript(`
local n = redis.call('INCR', KEYS[1])
if n == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
if n >= tonumber(ARGV[1]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[2])
  redis.call('DEL', KEYS[1])
end
return n
`)

func failKey(a Ambito, cedula string) string { return fmt.Sprintf("auth:fail:%s:%s", a, cedula) }
func lockKey(a Ambito, cedula string) string { return fmt.Sprintf("auth:lock:%s:%s", a, cedula) }

func (c *redisIntentosCache) Bloqueo(ctx context.Context, a Ambito, cedula string) (time.Duration, error) {
	ttl, err := c.rdb.PTTL(ctx, lockKey(a, cedula)).Result()
	if err != nil {
		return 0, fmt.Errorf("consultando bloqueo: %w", err)
	}
	if ttl <= 0 { // -2: no existe; -1: sin expiración (no debería ocurrir)
		return 0, nil
	}
	return ttl, nil
}

func (c *redisIntentosCache) RegistrarFallo(ctx context.Context, a Ambito, cedula string) (int, bool, error) {
	n, err := scriptFallo.Run(ctx, c.rdb,
		[]string{failKey(a, cedula), lockKey(a, cedula)},
		c.max, c.bloqueo.Milliseconds()).Int()
	if err != nil {
		return 0, false, fmt.Errorf("registrando intento fallido: %w", err)
	}
	if n >= c.max {
		return 0, true, nil
	}
	return c.max - n, false, nil
}

func (c *redisIntentosCache) Limpiar(ctx context.Context, a Ambito, cedula string) error {
	if err := c.rdb.Del(ctx, failKey(a, cedula)).Err(); err != nil {
		return fmt.Errorf("limpiando intentos: %w", err)
	}
	return nil
}
