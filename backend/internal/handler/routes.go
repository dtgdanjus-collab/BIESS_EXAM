package handler

import "github.com/gofiber/fiber/v2"

// Handlers agrupa todos los handlers construidos en main.go.
type Handlers struct {
	Health    *HealthHandler
	Catalogos *CatalogoHandler
	Auth      *AuthHandler
}

// RegisterRoutes declara las rutas bajo el prefijo /api. requireAuth protege las rutas privadas.
func RegisterRoutes(app *fiber.App, h Handlers, requireAuth fiber.Handler) {
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

	auth := api.Group("/auth")
	auth.Post("/verificar-identidad", h.Auth.VerificarIdentidad)
	auth.Post("/registro", h.Auth.Registro)
	auth.Post("/login", h.Auth.Login)
	auth.Post("/recuperar", h.Auth.Recuperar)
	auth.Post("/restablecer", h.Auth.Restablecer)
	auth.Get("/me", requireAuth, h.Auth.Me)
}
