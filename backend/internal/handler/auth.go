package handler

import (
	"context"

	"github.com/gofiber/fiber/v2"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
	"github.com/biess-dev/biess-postulacion/backend/internal/service"
)

type AuthService interface {
	VerificarIdentidad(ctx context.Context, in service.IdentidadInput) (string, error)
	Registrar(ctx context.Context, in service.RegistroInput) (*domain.Usuario, error)
}

type AuthHandler struct {
	svc AuthService
}

func NewAuthHandler(svc AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

type verificarIdentidadReq struct {
	Cedula          string `json:"cedula"`
	FechaExpedicion string `json:"fechaExpedicion"`
	CodigoDactilar  string `json:"codigoDactilar"`
}

// VerificarIdentidad atiende POST /auth/verificar-identidad (paso 1 del registro).
func (h *AuthHandler) VerificarIdentidad(c *fiber.Ctx) error {
	var req verificarIdentidadReq
	if err := parseBody(c, &req); err != nil {
		return err
	}
	token, err := h.svc.VerificarIdentidad(c.UserContext(), service.IdentidadInput(req))
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"registroToken": token})
}

type registroReq struct {
	RegistroToken string `json:"registroToken"`
	Email         string `json:"email"`
	Password      string `json:"password"`
}

// Registro atiende POST /auth/registro (paso 2 del registro).
func (h *AuthHandler) Registro(c *fiber.Ctx) error {
	var req registroReq
	if err := parseBody(c, &req); err != nil {
		return err
	}
	u, err := h.svc.Registrar(c.UserContext(), service.RegistroInput(req))
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(u)
}

// parseBody decodifica el JSON del cuerpo y responde 400 si está mal formado.
func parseBody(c *fiber.Ctx, dst any) error {
	if err := c.BodyParser(dst); err != nil {
		return domain.NewError(domain.ErrValidacion, "El cuerpo de la petición no es un JSON válido")
	}
	return nil
}
