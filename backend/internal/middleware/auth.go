package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

const localUsuarioID = "usuarioID"

// TokenVerificador valida un JWT y devuelve el id del usuario (implementado por pkg/jwtutil).
type TokenVerificador interface {
	Verificar(token string) (int64, error)
}

// RequireAuth exige el header "Authorization: Bearer <jwt>" y deja el id del usuario en Locals.
func RequireAuth(v TokenVerificador) fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get(fiber.HeaderAuthorization)
		token, ok := strings.CutPrefix(header, "Bearer ")
		if !ok || strings.TrimSpace(token) == "" {
			return domain.NewError(domain.ErrNoAutorizado, "Debe iniciar sesión para acceder a este recurso")
		}
		id, err := v.Verificar(strings.TrimSpace(token))
		if err != nil {
			return domain.NewError(domain.ErrNoAutorizado, "La sesión expiró o no es válida, inicie sesión nuevamente")
		}
		c.Locals(localUsuarioID, id)
		return c.Next()
	}
}

// UsuarioID devuelve el id del usuario autenticado (solo en rutas con RequireAuth).
func UsuarioID(c *fiber.Ctx) int64 {
	id, _ := c.Locals(localUsuarioID).(int64)
	return id
}
