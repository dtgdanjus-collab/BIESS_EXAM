package handler

import (
	"context"

	"github.com/gofiber/fiber/v2"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

// CatalogoService es lo que el handler necesita del service (interfaz del lado del consumidor).
type CatalogoService interface {
	Paises(ctx context.Context) ([]domain.Item, error)
	Provincias(ctx context.Context, paisID int) ([]domain.Item, error)
	Cantones(ctx context.Context, provinciaID int) ([]domain.Item, error)
	Parentescos(ctx context.Context) ([]domain.Item, error)
	Niveles(ctx context.Context) ([]domain.NivelInstruccion, error)
	Areas(ctx context.Context) ([]domain.Item, error)
	Sectores(ctx context.Context) ([]domain.Sector, error)
	Inhabilidades(ctx context.Context) ([]domain.PreguntaInhabilidad, error)
}

type CatalogoHandler struct {
	svc CatalogoService
}

func NewCatalogoHandler(svc CatalogoService) *CatalogoHandler {
	return &CatalogoHandler{svc: svc}
}

func (h *CatalogoHandler) Paises(c *fiber.Ctx) error {
	return respond(c, h.svc.Paises)
}

// Provincias atiende GET /catalogos/provincias?pais={id}.
func (h *CatalogoHandler) Provincias(c *fiber.Ctx) error {
	paisID, err := queryID(c, "pais")
	if err != nil {
		return err
	}
	return respond(c, func(ctx context.Context) ([]domain.Item, error) { return h.svc.Provincias(ctx, paisID) })
}

// Cantones atiende GET /catalogos/cantones?provincia={id}.
func (h *CatalogoHandler) Cantones(c *fiber.Ctx) error {
	provinciaID, err := queryID(c, "provincia")
	if err != nil {
		return err
	}
	return respond(c, func(ctx context.Context) ([]domain.Item, error) { return h.svc.Cantones(ctx, provinciaID) })
}

func (h *CatalogoHandler) Parentescos(c *fiber.Ctx) error   { return respond(c, h.svc.Parentescos) }
func (h *CatalogoHandler) Niveles(c *fiber.Ctx) error       { return respond(c, h.svc.Niveles) }
func (h *CatalogoHandler) Areas(c *fiber.Ctx) error         { return respond(c, h.svc.Areas) }
func (h *CatalogoHandler) Sectores(c *fiber.Ctx) error      { return respond(c, h.svc.Sectores) }
func (h *CatalogoHandler) Inhabilidades(c *fiber.Ctx) error { return respond(c, h.svc.Inhabilidades) }

// respond ejecuta fn con el context de la petición y serializa el resultado;
// los errores los traduce el ErrorHandler global.
func respond[T any](c *fiber.Ctx, fn func(context.Context) (T, error)) error {
	res, err := fn(c.UserContext())
	if err != nil {
		return err
	}
	return c.JSON(res)
}

func queryID(c *fiber.Ctx, name string) (int, error) {
	id := c.QueryInt(name, 0)
	if id <= 0 {
		return 0, domain.NewError(domain.ErrValidacion, "El parámetro '"+name+"' es obligatorio y debe ser un id válido").
			WithDetail("parametro", name)
	}
	return id, nil
}
