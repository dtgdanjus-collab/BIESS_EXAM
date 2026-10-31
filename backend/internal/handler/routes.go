package handler

import "github.com/gofiber/fiber/v2"

// Handlers agrupa todos los handlers construidos en main.go.
type Handlers struct {
	Health *HealthHandler
}

// RegisterRoutes declara las rutas bajo el prefijo /api.
func RegisterRoutes(app *fiber.App, h Handlers) {
	api := app.Group("/api")
	api.Get("/health", h.Health.Check)
}
