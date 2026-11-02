package handler

import (
	"context"

	"github.com/gofiber/fiber/v2"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
	"github.com/biess-dev/biess-postulacion/backend/internal/middleware"
	"github.com/biess-dev/biess-postulacion/backend/internal/service"
)

type AuthService interface {
	VerificarIdentidad(ctx context.Context, in service.IdentidadInput) (string, error)
	Registrar(ctx context.Context, in service.RegistroInput) (*domain.Usuario, error)
	Login(ctx context.Context, cedula, password string) (*service.Sesion, error)
	Me(ctx context.Context, usuarioID int64) (*service.Perfil, error)
	Recuperar(ctx context.Context, in service.IdentidadInput) (string, error)
	Restablecer(ctx context.Context, token, nuevaPassword string) error
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
	Genero          string `json:"genero"`
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

type loginReq struct {
	Cedula   string `json:"cedula"`
	Password string `json:"password"`
}

// Login atiende POST /auth/login.
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req loginReq
	if err := parseBody(c, &req); err != nil {
		return err
	}
	sesion, err := h.svc.Login(c.UserContext(), req.Cedula, req.Password)
	if err != nil {
		return err
	}
	return c.JSON(sesion)
}

// Me atiende GET /auth/me (protegida).
func (h *AuthHandler) Me(c *fiber.Ctx) error {
	perfil, err := h.svc.Me(c.UserContext(), middleware.UsuarioID(c))
	if err != nil {
		return err
	}
	return c.JSON(perfil)
}

// Recuperar atiende POST /auth/recuperar: el enlace se "envía" al log del backend.
func (h *AuthHandler) Recuperar(c *fiber.Ctx) error {
	var req verificarIdentidadReq
	if err := parseBody(c, &req); err != nil {
		return err
	}
	email, err := h.svc.Recuperar(c.UserContext(), service.IdentidadInput(req))
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"message": "Se envió un enlace de recuperación al correo " + email,
		"email":   email,
	})
}

type restablecerReq struct {
	Token         string `json:"token"`
	NuevaPassword string `json:"nuevaPassword"`
}

// Restablecer atiende POST /auth/restablecer.
func (h *AuthHandler) Restablecer(c *fiber.Ctx) error {
	var req restablecerReq
	if err := parseBody(c, &req); err != nil {
		return err
	}
	if err := h.svc.Restablecer(c.UserContext(), req.Token, req.NuevaPassword); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"message": "La contraseña se actualizó correctamente"})
}

// parseBody decodifica el JSON del cuerpo y responde 400 si está mal formado.
func parseBody(c *fiber.Ctx, dst any) error {
	if err := c.BodyParser(dst); err != nil {
		return domain.NewError(domain.ErrValidacion, "El cuerpo de la petición no es un JSON válido").
			WithDetail("causa", err.Error())
	}
	return nil
}
