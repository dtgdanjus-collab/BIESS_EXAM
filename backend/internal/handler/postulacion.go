package handler

import (
	"context"

	"github.com/gofiber/fiber/v2"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
	"github.com/biess-dev/biess-postulacion/backend/internal/middleware"
)

type PostulacionService interface {
	Obtener(ctx context.Context, usuarioID int64) (*domain.Postulacion, error)
	Crear(ctx context.Context, usuarioID int64) (*domain.Postulacion, bool, error)
	ConfirmarDatos(ctx context.Context, usuarioID int64, d domain.DatosPersonales) (*domain.Postulacion, error)
	GuardarContacto(ctx context.Context, usuarioID int64, c domain.Contacto) (*domain.Postulacion, error)
	GuardarFamiliares(ctx context.Context, usuarioID int64, tiene bool, items []domain.Familiar) (*domain.Postulacion, error)
}

type PostulacionHandler struct {
	svc PostulacionService
}

func NewPostulacionHandler(svc PostulacionService) *PostulacionHandler {
	return &PostulacionHandler{svc: svc}
}

// Obtener atiende GET /postulacion.
func (h *PostulacionHandler) Obtener(c *fiber.Ctx) error {
	p, err := h.svc.Obtener(c.UserContext(), middleware.UsuarioID(c))
	if err != nil {
		return err
	}
	return c.JSON(p)
}

// Crear atiende POST /postulacion: 201 si se creó, 200 si ya existía.
func (h *PostulacionHandler) Crear(c *fiber.Ctx) error {
	p, creada, err := h.svc.Crear(c.UserContext(), middleware.UsuarioID(c))
	if err != nil {
		return err
	}
	status := fiber.StatusOK
	if creada {
		status = fiber.StatusCreated
	}
	return c.Status(status).JSON(p)
}

// DatosPersonales atiende PUT /postulacion/datos-personales: corrige y confirma, una sola vez.
func (h *PostulacionHandler) DatosPersonales(c *fiber.Ctx) error {
	var req domain.DatosPersonales
	if err := parseBody(c, &req); err != nil {
		return err
	}
	p, err := h.svc.ConfirmarDatos(c.UserContext(), middleware.UsuarioID(c), req)
	if err != nil {
		return err
	}
	return c.JSON(p)
}

// Contacto atiende PUT /postulacion/contacto.
func (h *PostulacionHandler) Contacto(c *fiber.Ctx) error {
	var req domain.Contacto
	if err := parseBody(c, &req); err != nil {
		return err
	}
	p, err := h.svc.GuardarContacto(c.UserContext(), middleware.UsuarioID(c), req)
	if err != nil {
		return err
	}
	return c.JSON(p)
}

type familiaresReq struct {
	TieneFamiliares *bool             `json:"tieneFamiliares"`
	Items           []domain.Familiar `json:"items"`
}

// Familiares atiende PUT /postulacion/familiares.
func (h *PostulacionHandler) Familiares(c *fiber.Ctx) error {
	var req familiaresReq
	if err := parseBody(c, &req); err != nil {
		return err
	}
	if req.TieneFamiliares == nil {
		return errCampoObligatorio("tieneFamiliares")
	}
	p, err := h.svc.GuardarFamiliares(c.UserContext(), middleware.UsuarioID(c), *req.TieneFamiliares, req.Items)
	if err != nil {
		return err
	}
	return c.JSON(p)
}

func errCampoObligatorio(campo string) error {
	return domain.NewError(domain.ErrValidacion, "Hay datos con formato inválido").
		WithDetail("campos", map[string]string{campo: "Es obligatorio"})
}
