// Package handler contiene los handlers HTTP de Fiber, sus DTOs y la definición de rutas.
package handler

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
)

// Pinger es cualquier dependencia que pueda verificar su disponibilidad.
// *pgxpool.Pool la cumple directamente; Redis mediante platform.RedisPinger.
type Pinger interface {
	Ping(ctx context.Context) error
}

type HealthHandler struct {
	deps map[string]Pinger
}

func NewHealthHandler(deps map[string]Pinger) *HealthHandler {
	return &HealthHandler{deps: deps}
}

// Check responde 200 si todas las dependencias están "ok" y 503 si alguna falla.
func (h *HealthHandler) Check(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.UserContext(), 2*time.Second)
	defer cancel()

	status := fiber.StatusOK
	res := make(map[string]string, len(h.deps))
	for name, dep := range h.deps {
		if err := dep.Ping(ctx); err != nil {
			res[name] = "error"
			status = fiber.StatusServiceUnavailable
			continue
		}
		res[name] = "ok"
	}
	return c.Status(status).JSON(res)
}
