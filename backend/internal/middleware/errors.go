// Package middleware agrupa los middlewares HTTP: errores, CORS, recover, logger y (luego) JWT.
package middleware

import (
	"errors"
	"log"

	"github.com/gofiber/fiber/v2"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

// ErrorBody es el formato uniforme de error de la API.
type ErrorBody struct {
	Error ErrorPayload `json:"error"`
}

type ErrorPayload struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

var statusPorTipo = []struct {
	kind   error
	status int
}{
	{domain.ErrValidacion, fiber.StatusBadRequest},
	{domain.ErrCredenciales, fiber.StatusUnauthorized},
	{domain.ErrIdentidad, fiber.StatusUnauthorized},
	{domain.ErrNoAutorizado, fiber.StatusUnauthorized},
	{domain.ErrNoEncontrado, fiber.StatusNotFound},
	{domain.ErrConflicto, fiber.StatusConflict},
	{domain.ErrReglaNegocio, fiber.StatusUnprocessableEntity},
	{domain.ErrBloqueado, fiber.StatusLocked},
}

// ErrorHandler es el manejador de errores global de Fiber: traduce errores de
// dominio a HTTP y oculta los detalles de los errores internos.
func ErrorHandler(c *fiber.Ctx, err error) error {
	var de *domain.Error
	if errors.As(err, &de) {
		return c.Status(statusDe(de.Kind)).JSON(ErrorBody{ErrorPayload{
			Code:    de.Kind.Error(),
			Message: de.Message,
			Details: de.Details,
		}})
	}

	// Errores propios de Fiber: ruta inexistente, método no permitido, body demasiado grande…
	var fe *fiber.Error
	if errors.As(err, &fe) {
		code := "HTTP_ERROR"
		if fe.Code == fiber.StatusNotFound {
			code = domain.ErrNoEncontrado.Error()
		}
		return c.Status(fe.Code).JSON(ErrorBody{ErrorPayload{Code: code, Message: fe.Message}})
	}

	log.Printf("ERROR %s %s: %v", c.Method(), c.Path(), err)
	return c.Status(fiber.StatusInternalServerError).JSON(ErrorBody{ErrorPayload{
		Code:    "INTERNO",
		Message: "Ocurrió un error interno, inténtelo más tarde",
	}})
}

func statusDe(kind error) int {
	for _, m := range statusPorTipo {
		if errors.Is(kind, m.kind) {
			return m.status
		}
	}
	return fiber.StatusInternalServerError
}
