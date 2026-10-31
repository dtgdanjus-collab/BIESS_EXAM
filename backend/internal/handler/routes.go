package handler

import "github.com/gofiber/fiber/v2"

// Handlers agrupa todos los handlers construidos en main.go.
type Handlers struct {
	Health    *HealthHandler
	Catalogos *CatalogoHandler
}

// RegisterRoutes declara las rutas bajo el prefijo /api.
func RegisterRoutes(app *fiber.App, h Handlers) {
	api := app.Group("/api")
	api.Get("/health", h.Health.Check)

	cat := api.Group("/catalogos")
	cat.Get("/paises", h.Catalogos.Paises)
	cat.Get("/provincias", h.Catalogos.Provincias)
	cat.Get("/cantones", h.Catalogos.Cantones)
	cat.Get("/parentescos", h.Catalogos.Parentescos)
	cat.Get("/niveles", h.Catalogos.Niveles)
	cat.Get("/areas", h.Catalogos.Areas)
	cat.Get("/sectores", h.Catalogos.Sectores)
	cat.Get("/inhabilidades", h.Catalogos.Inhabilidades)
}
