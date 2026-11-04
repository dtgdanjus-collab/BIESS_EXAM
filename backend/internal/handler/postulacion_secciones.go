package handler

import (
	"context"
	"fmt"
	"io"

	"github.com/gofiber/fiber/v2"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
	"github.com/biess-dev/biess-postulacion/backend/internal/middleware"
	"github.com/biess-dev/biess-postulacion/backend/internal/service"
)

type SeccionesService interface {
	GuardarCargo(ctx context.Context, usuarioID int64, sector string, tieneRespaldo bool, organizacion *string, documentoID *int64) (*domain.Postulacion, error)
	ValidarCargo(ctx context.Context, usuarioID int64, sector string) (*service.ResultadoCargo, error)
	EliminarCargo(ctx context.Context, usuarioID int64) (*domain.Postulacion, error)
	SubirDocumento(ctx context.Context, usuarioID int64, categoria, nombre string, contenido []byte) (*domain.Documento, error)
	ObtenerDocumento(ctx context.Context, usuarioID, documentoID int64) (*domain.Documento, []byte, error)
	GuardarFormacion(ctx context.Context, usuarioID int64, items []domain.Formacion) (*domain.Postulacion, error)
	GuardarExperiencia(ctx context.Context, usuarioID int64, items []domain.Experiencia) (*domain.Postulacion, error)
	GuardarPublicaciones(ctx context.Context, usuarioID int64, tiene bool, items []domain.Publicacion) (*domain.Postulacion, error)
	GuardarCapacitaciones(ctx context.Context, usuarioID int64, items []domain.Capacitacion) (*domain.Postulacion, error)
	GuardarInhabilidades(ctx context.Context, usuarioID int64, respuestas []domain.RespuestaInhabilidad) (*domain.Postulacion, error)
	EliminarInhabilidades(ctx context.Context, usuarioID int64) (*domain.Postulacion, error)
	Enviar(ctx context.Context, usuarioID int64, aceptaConsentimiento bool) (*domain.Postulacion, error)
}

type SeccionesHandler struct {
	svc SeccionesService
}

func NewSeccionesHandler(svc SeccionesService) *SeccionesHandler {
	return &SeccionesHandler{svc: svc}
}

type cargoReq struct {
	Sector             string  `json:"sector"`
	TieneRespaldo      *bool   `json:"tieneRespaldo"`
	OrganizacionNombre *string `json:"organizacionNombre"`
	OrganizacionDocID  *int64  `json:"organizacionDocumentoId"`
}

// Cargo atiende POST /postulacion/cargo.
func (h *SeccionesHandler) Cargo(c *fiber.Ctx) error {
	var req cargoReq
	if err := parseBody(c, &req); err != nil {
		return err
	}
	if req.TieneRespaldo == nil {
		return errCampoObligatorio("tieneRespaldo")
	}
	return responder(c)(h.svc.GuardarCargo(c.UserContext(), middleware.UsuarioID(c), req.Sector, *req.TieneRespaldo, req.OrganizacionNombre, req.OrganizacionDocID))
}

// ValidarCargo atiende POST /postulacion/cargo/validar.
func (h *SeccionesHandler) ValidarCargo(c *fiber.Ctx) error {
	var req struct {
		Sector string `json:"sector"`
	}
	if err := parseBody(c, &req); err != nil {
		return err
	}
	r, err := h.svc.ValidarCargo(c.UserContext(), middleware.UsuarioID(c), req.Sector)
	if err != nil {
		return err
	}
	return c.JSON(r)
}

// EliminarCargo atiende DELETE /postulacion/cargo.
func (h *SeccionesHandler) EliminarCargo(c *fiber.Ctx) error {
	return responder(c)(h.svc.EliminarCargo(c.UserContext(), middleware.UsuarioID(c)))
}

// SubirDocumento atiende POST /postulacion/documentos (multipart: categoria y archivo).
func (h *SeccionesHandler) SubirDocumento(c *fiber.Ctx) error {
	archivo, err := c.FormFile("archivo")
	if err != nil {
		return errCampoObligatorio("archivo")
	}
	f, err := archivo.Open()
	if err != nil {
		return fmt.Errorf("abriendo documento: %w", err)
	}
	defer f.Close()
	contenido, err := io.ReadAll(f)
	if err != nil {
		return fmt.Errorf("leyendo documento: %w", err)
	}
	d, err := h.svc.SubirDocumento(c.UserContext(), middleware.UsuarioID(c), c.FormValue("categoria"), archivo.Filename, contenido)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(d)
}

// Documento atiende GET /postulacion/documentos/:id.
func (h *SeccionesHandler) Documento(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil || id <= 0 {
		return domain.NewError(domain.ErrNoEncontrado, "El documento no existe")
	}
	d, contenido, err := h.svc.ObtenerDocumento(c.UserContext(), middleware.UsuarioID(c), int64(id))
	if err != nil {
		return err
	}
	c.Attachment(d.Nombre)
	c.Set(fiber.HeaderContentType, "application/pdf")
	c.Set(fiber.HeaderCacheControl, "private, no-store")
	return c.Send(contenido)
}

type itemsReq[T any] struct {
	Items []T `json:"items"`
}

// Formacion atiende PUT /postulacion/formacion.
func (h *SeccionesHandler) Formacion(c *fiber.Ctx) error {
	var req itemsReq[domain.Formacion]
	if err := parseBody(c, &req); err != nil {
		return err
	}
	return responder(c)(h.svc.GuardarFormacion(c.UserContext(), middleware.UsuarioID(c), req.Items))
}

// Experiencia atiende PUT /postulacion/experiencia (la respuesta incluye las duraciones).
func (h *SeccionesHandler) Experiencia(c *fiber.Ctx) error {
	var req itemsReq[domain.Experiencia]
	if err := parseBody(c, &req); err != nil {
		return err
	}
	return responder(c)(h.svc.GuardarExperiencia(c.UserContext(), middleware.UsuarioID(c), req.Items))
}

type publicacionesReq struct {
	TienePublicaciones *bool                `json:"tienePublicaciones"`
	Items              []domain.Publicacion `json:"items"`
}

// Publicaciones atiende PUT /postulacion/publicaciones.
func (h *SeccionesHandler) Publicaciones(c *fiber.Ctx) error {
	var req publicacionesReq
	if err := parseBody(c, &req); err != nil {
		return err
	}
	if req.TienePublicaciones == nil {
		return errCampoObligatorio("tienePublicaciones")
	}
	return responder(c)(h.svc.GuardarPublicaciones(c.UserContext(), middleware.UsuarioID(c), *req.TienePublicaciones, req.Items))
}

// Capacitaciones atiende PUT /postulacion/capacitaciones.
func (h *SeccionesHandler) Capacitaciones(c *fiber.Ctx) error {
	var req itemsReq[domain.Capacitacion]
	if err := parseBody(c, &req); err != nil {
		return err
	}
	return responder(c)(h.svc.GuardarCapacitaciones(c.UserContext(), middleware.UsuarioID(c), req.Items))
}

type inhabilidadesReq struct {
	Respuestas []struct {
		PreguntaID int                     `json:"preguntaId"`
		Respuesta  *bool                   `json:"respuesta"`
		Detalle    *domain.DetalleRemocion `json:"detalle"`
	} `json:"respuestas"`
}

// Inhabilidades atiende PUT /postulacion/inhabilidades.
func (h *SeccionesHandler) Inhabilidades(c *fiber.Ctx) error {
	var req inhabilidadesReq
	if err := parseBody(c, &req); err != nil {
		return err
	}
	respuestas := make([]domain.RespuestaInhabilidad, 0, len(req.Respuestas))
	for _, r := range req.Respuestas {
		if r.Respuesta == nil { // Sí/No es obligatorio: no se asume "No" por omisión
			return errCampoObligatorio("respuestas.respuesta")
		}
		respuestas = append(respuestas, domain.RespuestaInhabilidad{PreguntaID: r.PreguntaID, Respuesta: *r.Respuesta, Detalle: r.Detalle})
	}
	return responder(c)(h.svc.GuardarInhabilidades(c.UserContext(), middleware.UsuarioID(c), respuestas))
}

// EliminarInhabilidades atiende DELETE /postulacion/inhabilidades.
func (h *SeccionesHandler) EliminarInhabilidades(c *fiber.Ctx) error {
	return responder(c)(h.svc.EliminarInhabilidades(c.UserContext(), middleware.UsuarioID(c)))
}

type enviarReq struct {
	AceptaConsentimiento bool `json:"aceptaConsentimiento"`
}

// Enviar atiende POST /postulacion/enviar.
func (h *SeccionesHandler) Enviar(c *fiber.Ctx) error {
	var req enviarReq
	if err := parseBody(c, &req); err != nil {
		return err
	}
	return responder(c)(h.svc.Enviar(c.UserContext(), middleware.UsuarioID(c), req.AceptaConsentimiento))
}

// responder serializa la postulación devuelta por el service o propaga el error.
func responder(c *fiber.Ctx) func(*domain.Postulacion, error) error {
	return func(p *domain.Postulacion, err error) error {
		if err != nil {
			return err
		}
		return c.JSON(p)
	}
}
