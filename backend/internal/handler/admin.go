package handler

import (
	"log"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
	"github.com/biess-dev/biess-postulacion/backend/internal/middleware"
	"github.com/biess-dev/biess-postulacion/backend/internal/service"
)

const (
	localAdmin       = "admin"
	localPostulacion = "postulacionAuditada"
)

// AdminHandler atiende EF-13, la parte administrativa de EF-14 y lo que el postulante ve del concurso.
type AdminHandler struct {
	svc        *service.AdminService
	evaluacion *service.EvaluacionService
}

func NewAdminHandler(svc *service.AdminService, evaluacion *service.EvaluacionService) *AdminHandler {
	return &AdminHandler{svc: svc, evaluacion: evaluacion}
}

// conRol deja pasar a cualquier cuenta activa del módulo o, con soloAdministrador, al rol Administrador.
func (h *AdminHandler) conRol(soloAdministrador bool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		a, err := h.svc.Autorizar(c.UserContext(), middleware.UsuarioID(c), soloAdministrador)
		if err != nil {
			return err
		}
		c.Locals(localAdmin, a)
		return c.Next()
	}
}

func adminDe(c *fiber.Ctx) *domain.Administrador {
	a, _ := c.Locals(localAdmin).(*domain.Administrador)
	return a
}

func idParam(c *fiber.Ctx, nombre string) (int64, error) {
	id, err := c.ParamsInt(nombre)
	if err != nil || id <= 0 {
		return 0, domain.NewError(domain.ErrNoEncontrado, "No existe")
	}
	return int64(id), nil
}

// enJSON responde el resultado de un service o propaga su error.
func enJSON[T any](c *fiber.Ctx, v T, err error) error {
	if err != nil {
		return err
	}
	return c.JSON(v)
}

func descarga(c *fiber.Ctx, nombre, tipo string, contenido []byte, err error) error {
	if err != nil {
		return err
	}
	c.Attachment(nombre)
	c.Set(fiber.HeaderContentType, tipo)
	c.Set(fiber.HeaderCacheControl, "private, no-store")
	return c.Send(contenido)
}

// Login atiende POST /admin/login.
func (h *AdminHandler) Login(c *fiber.Ctx) error {
	var req struct {
		Usuario  string `json:"usuario"`
		Password string `json:"password"`
	}
	if err := parseBody(c, &req); err != nil {
		return err
	}
	s, err := h.svc.Login(c.UserContext(), req.Usuario, req.Password)
	if err == nil {
		if e := h.svc.Auditar(c.UserContext(), s.Admin.Nombre, s.Admin.Rol, "INICIAR_SESION", "", nil); e != nil {
			log.Printf("ERROR en la bitácora: %v", e)
		}
	}
	return enJSON(c, s, err)
}

// accionesAuditadas nombra cada cambio del módulo. Solo en las marcadas con conCuerpo se guarda lo
// enviado: la creación de cuentas lleva una contraseña y nunca debe quedar en la bitácora.
var accionesAuditadas = map[string]struct {
	accion    string
	conCuerpo bool
}{
	"PUT /postulantes/:id/calificacion":   {"CALIFICAR", true},
	"PUT /concurso":                       {"CAMBIAR_CONFIGURACION", true},
	"PUT /fases/:codigo":                  {"CAMBIAR_FASE", true},
	"PUT /meritos/tabla":                  {"CAMBIAR_TABLA_MERITOS", true},
	"POST /meritos/recalcular":            {"RECALCULAR_MERITOS", false},
	"POST /evaluacion/preguntas":          {"CREAR_PREGUNTA", false},
	"POST /evaluacion/preguntas/importar": {"IMPORTAR_PREGUNTAS", false},
	"PUT /evaluacion/preguntas/:id":       {"EDITAR_PREGUNTA", false},
	"DELETE /evaluacion/preguntas/:id":    {"ELIMINAR_PREGUNTA", false},
	"PUT /evaluacion/config":              {"CAMBIAR_EVALUACION", true},
	"PUT /reconsideraciones/:id":          {"RESOLVER_RECONSIDERACION", true},
	"PUT /reconsideraciones/:id/informe":  {"INFORMAR_RECONSIDERACION", true},
	"POST /usuarios":                      {"CREAR_CUENTA", false},
	"PUT /usuarios/:id/activo":            {"CAMBIAR_CUENTA", true},
}

const maxDetalleBitacora = 800

// auditar registra cada cambio que terminó bien, en un solo lugar para que ninguno se quede afuera.
func (h *AdminHandler) auditar(c *fiber.Ctx) error {
	err := c.Next()
	a := adminDe(c)
	if err != nil || a == nil || c.Method() == fiber.MethodGet || c.Response().StatusCode() >= 300 {
		return err
	}
	ruta := strings.TrimPrefix(c.Route().Path, "/api/admin")
	regla, ok := accionesAuditadas[c.Method()+" "+ruta]
	if !ok {
		log.Printf("BITACORA: ruta sin nombre %s %s", c.Method(), ruta)
		return nil
	}
	detalle := ""
	for _, parametro := range c.Route().Params {
		detalle += parametro + "=" + c.Params(parametro) + " "
	}
	if regla.conCuerpo {
		detalle += string(c.Body())
	}
	if len(detalle) > maxDetalleBitacora {
		detalle = strings.ToValidUTF8(detalle[:maxDetalleBitacora], "") + "…"
	}
	// Las reconsideraciones se identifican por su propio id: el handler dice de qué postulación son.
	postulacion, _ := c.Locals(localPostulacion).(*int64)
	if postulacion == nil && strings.HasPrefix(ruta, "/postulantes/") {
		if id, e := idParam(c, "id"); e == nil {
			postulacion = &id
		}
	}
	if e := h.svc.Auditar(c.UserContext(), a.Nombre, a.Rol, regla.accion, strings.TrimSpace(detalle), postulacion); e != nil {
		log.Printf("ERROR en la bitácora: %v", e)
	}
	return nil
}

// Bitacora atiende GET /admin/bitacora.
func (h *AdminHandler) Bitacora(c *fiber.Ctx) error {
	r, err := h.svc.Bitacora(c.UserContext(), c.Query("q"))
	return enJSON(c, r, err)
}

// GuardarTablaMeritos atiende PUT /admin/meritos/tabla.
func (h *AdminHandler) GuardarTablaMeritos(c *fiber.Ctx) error {
	var req domain.TablaMeritos
	if err := parseBody(c, &req); err != nil {
		return err
	}
	r, err := h.svc.GuardarTablaMeritos(c.UserContext(), req)
	return enJSON(c, r, err)
}

// RecalcularMeritos atiende POST /admin/meritos/recalcular.
func (h *AdminHandler) RecalcularMeritos(c *fiber.Ctx) error {
	n, err := h.svc.RecalcularMeritos(c.UserContext())
	return enJSON(c, fiber.Map{"calculadas": n}, err)
}

// Elegibles atiende GET /admin/elegibles.
func (h *AdminHandler) Elegibles(c *fiber.Ctx) error {
	r, err := h.svc.Elegibles(c.UserContext())
	return enJSON(c, r, err)
}

func nombreElegibles(ext string) string {
	return "lista-elegibles-" + time.Now().Format("2006-01-02") + ext
}

func (h *AdminHandler) ElegiblesXLSX(c *fiber.Ctx) error {
	l, err := h.svc.Elegibles(c.UserContext())
	if err != nil {
		return err
	}
	b, err := service.ElegiblesXLSX(l)
	return descarga(c, nombreElegibles(".xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", b, err)
}

func (h *AdminHandler) ElegiblesPDF(c *fiber.Ctx) error {
	l, err := h.svc.Elegibles(c.UserContext())
	if err != nil {
		return err
	}
	b, err := service.ElegiblesPDF(l)
	return descarga(c, nombreElegibles(".pdf"), "application/pdf", b, err)
}

// InformarReconsideracion atiende PUT /admin/reconsideraciones/:id/informe.
func (h *AdminHandler) InformarReconsideracion(c *fiber.Ctx) error {
	id, err := idParam(c, "id")
	if err != nil {
		return err
	}
	var req struct {
		Informe string `json:"informe"`
	}
	if err := parseBody(c, &req); err != nil {
		return err
	}
	r, err := h.svc.InformarReconsideracion(c.UserContext(), id, req.Informe, adminDe(c).Nombre)
	if err == nil {
		c.Locals(localPostulacion, &r.PostulacionID)
	}
	return enJSON(c, r, err)
}

func (h *AdminHandler) Me(c *fiber.Ctx) error { return c.JSON(adminDe(c)) }

func (h *AdminHandler) Dashboard(c *fiber.Ctx) error {
	d, err := h.svc.Dashboard(c.UserContext())
	return enJSON(c, d, err)
}

func filtroDe(c *fiber.Ctx) domain.FiltroPostulantes {
	return domain.FiltroPostulantes{Sector: c.Query("sector"), Estado: c.Query("estado"), EstadoConcurso: c.Query("estadoConcurso"), Busqueda: c.Query("q")}
}

func (h *AdminHandler) Postulantes(c *fiber.Ctx) error {
	p, err := h.svc.Postulantes(c.UserContext(), filtroDe(c))
	return enJSON(c, p, err)
}

func (h *AdminHandler) Detalle(c *fiber.Ctx) error {
	id, err := idParam(c, "id")
	if err != nil {
		return err
	}
	d, err := h.svc.Detalle(c.UserContext(), id)
	return enJSON(c, d, err)
}

func (h *AdminHandler) Documento(c *fiber.Ctx) error {
	id, err := idParam(c, "id")
	if err != nil {
		return err
	}
	doc, err := idParam(c, "doc")
	if err != nil {
		return err
	}
	d, contenido, err := h.svc.Documento(c.UserContext(), id, doc)
	if err != nil {
		return err
	}
	return descarga(c, d.Nombre, "application/pdf", contenido, nil)
}

func (h *AdminHandler) Calificar(c *fiber.Ctx) error {
	id, err := idParam(c, "id")
	if err != nil {
		return err
	}
	var req domain.Calificacion
	if err := parseBody(c, &req); err != nil {
		return err
	}
	p, err := h.svc.Calificar(c.UserContext(), id, req, adminDe(c).Nombre)
	return enJSON(c, p, err)
}

func (h *AdminHandler) ReporteEvaluacion(c *fiber.Ctx) error {
	id, err := idParam(c, "id")
	if err != nil {
		return err
	}
	nombre, pdf, err := h.svc.ReporteEvaluacion(c.UserContext(), id)
	return descarga(c, nombre, "application/pdf", pdf, err)
}

func nombreMatriz(ext string) string {
	return "matriz-postulantes-" + time.Now().Format("2006-01-02") + ext
}

func (h *AdminHandler) MatrizXLSX(c *fiber.Ctx) error {
	filas, err := h.svc.Matriz(c.UserContext(), filtroDe(c))
	if err != nil {
		return err
	}
	b, err := service.MatrizXLSX(filas)
	return descarga(c, nombreMatriz(".xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", b, err)
}

func (h *AdminHandler) MatrizPDF(c *fiber.Ctx) error {
	filas, err := h.svc.Matriz(c.UserContext(), filtroDe(c))
	if err != nil {
		return err
	}
	b, err := service.MatrizPDF(filas)
	return descarga(c, nombreMatriz(".pdf"), "application/pdf", b, err)
}

func (h *AdminHandler) Concurso(c *fiber.Ctx) error {
	r, err := h.svc.Concurso(c.UserContext())
	return enJSON(c, r, err)
}

func (h *AdminHandler) GuardarConfig(c *fiber.Ctx) error {
	var req domain.ConcursoConfig
	if err := parseBody(c, &req); err != nil {
		return err
	}
	r, err := h.svc.GuardarConfig(c.UserContext(), req)
	return enJSON(c, r, err)
}

func (h *AdminHandler) GuardarFase(c *fiber.Ctx) error {
	var req domain.Fase
	if err := parseBody(c, &req); err != nil {
		return err
	}
	req.Codigo = c.Params("codigo")
	r, err := h.svc.GuardarFase(c.UserContext(), req)
	return enJSON(c, r, err)
}

func (h *AdminHandler) Preguntas(c *fiber.Ctx) error {
	r, err := h.svc.Preguntas(c.UserContext())
	return enJSON(c, r, err)
}

func (h *AdminHandler) CrearPregunta(c *fiber.Ctx) error {
	var req domain.PreguntaEvaluacion
	if err := parseBody(c, &req); err != nil {
		return err
	}
	r, err := h.svc.CrearPregunta(c.UserContext(), req)
	return enJSON(c, r, err)
}

func (h *AdminHandler) ImportarPreguntas(c *fiber.Ctx) error {
	var req itemsReq[domain.PreguntaEvaluacion]
	if err := parseBody(c, &req); err != nil {
		return err
	}
	n, err := h.svc.ImportarPreguntas(c.UserContext(), req.Items)
	return enJSON(c, fiber.Map{"importadas": n}, err)
}

func (h *AdminHandler) GuardarPregunta(c *fiber.Ctx) error {
	id, err := idParam(c, "id")
	if err != nil {
		return err
	}
	var req domain.PreguntaEvaluacion
	if err := parseBody(c, &req); err != nil {
		return err
	}
	req.ID = id
	r, err := h.svc.GuardarPregunta(c.UserContext(), req)
	return enJSON(c, r, err)
}

func (h *AdminHandler) EliminarPregunta(c *fiber.Ctx) error {
	id, err := idParam(c, "id")
	if err != nil {
		return err
	}
	if err := h.svc.EliminarPregunta(c.UserContext(), id); err != nil {
		return err
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AdminHandler) EvaluacionConfig(c *fiber.Ctx) error {
	r, err := h.svc.EvaluacionConfig(c.UserContext())
	return enJSON(c, r, err)
}

func (h *AdminHandler) GuardarEvaluacionConfig(c *fiber.Ctx) error {
	var req domain.EvaluacionConfig
	if err := parseBody(c, &req); err != nil {
		return err
	}
	r, err := h.svc.GuardarEvaluacionConfig(c.UserContext(), req)
	return enJSON(c, r, err)
}

func (h *AdminHandler) Resultados(c *fiber.Ctx) error {
	r, err := h.svc.Resultados(c.UserContext())
	return enJSON(c, r, err)
}

func (h *AdminHandler) Reconsideraciones(c *fiber.Ctx) error {
	r, err := h.svc.Reconsideraciones(c.UserContext())
	return enJSON(c, r, err)
}

func (h *AdminHandler) ResponderReconsideracion(c *fiber.Ctx) error {
	id, err := idParam(c, "id")
	if err != nil {
		return err
	}
	var req struct {
		Estado    string `json:"estado"`
		Respuesta string `json:"respuesta"`
	}
	if err := parseBody(c, &req); err != nil {
		return err
	}
	r, err := h.svc.ResponderReconsideracion(c.UserContext(), id, req.Estado, req.Respuesta, adminDe(c).Nombre)
	if err == nil {
		c.Locals(localPostulacion, &r.PostulacionID)
	}
	return enJSON(c, r, err)
}

func (h *AdminHandler) Usuarios(c *fiber.Ctx) error {
	r, err := h.svc.Usuarios(c.UserContext())
	return enJSON(c, r, err)
}

func (h *AdminHandler) CrearUsuario(c *fiber.Ctx) error {
	var req struct {
		Usuario  string `json:"usuario"`
		Password string `json:"password"`
		Nombre   string `json:"nombre"`
		Rol      string `json:"rol"`
	}
	if err := parseBody(c, &req); err != nil {
		return err
	}
	r, err := h.svc.CrearUsuario(c.UserContext(), req.Usuario, req.Password, req.Nombre, req.Rol)
	return enJSON(c, r, err)
}

func (h *AdminHandler) CambiarActivo(c *fiber.Ctx) error {
	id, err := idParam(c, "id")
	if err != nil {
		return err
	}
	var req struct {
		Activo bool `json:"activo"`
	}
	if err := parseBody(c, &req); err != nil {
		return err
	}
	r, err := h.svc.CambiarActivo(c.UserContext(), id, req.Activo, adminDe(c).ID)
	return enJSON(c, r, err)
}

// --- Postulante ---

// ConcursoPublico atiende GET /concurso.
func (h *AdminHandler) ConcursoPublico(c *fiber.Ctx) error {
	r, err := h.svc.Publico(c.UserContext())
	return enJSON(c, r, err)
}

// MiConcurso atiende GET /postulacion/concurso.
func (h *AdminHandler) MiConcurso(c *fiber.Ctx) error {
	r, err := h.svc.MiConcurso(c.UserContext(), middleware.UsuarioID(c))
	return enJSON(c, r, err)
}

// SolicitarReconsideracion atiende POST /postulacion/reconsideraciones.
func (h *AdminHandler) SolicitarReconsideracion(c *fiber.Ctx) error {
	var req struct {
		Etapa  string `json:"etapa"`
		Motivo string `json:"motivo"`
	}
	if err := parseBody(c, &req); err != nil {
		return err
	}
	r, err := h.svc.SolicitarReconsideracion(c.UserContext(), middleware.UsuarioID(c), req.Etapa, req.Motivo)
	return enJSON(c, r, err)
}

func (h *AdminHandler) EvaluacionEstado(c *fiber.Ctx) error {
	r, err := h.evaluacion.Estado(c.UserContext(), middleware.UsuarioID(c))
	return enJSON(c, r, err)
}

func (h *AdminHandler) EvaluacionIniciar(c *fiber.Ctx) error {
	r, err := h.evaluacion.Iniciar(c.UserContext(), middleware.UsuarioID(c))
	return enJSON(c, r, err)
}

func (h *AdminHandler) EvaluacionResponder(c *fiber.Ctx) error {
	var req struct {
		Orden  int  `json:"orden"`
		Opcion *int `json:"opcion"`
	}
	if err := parseBody(c, &req); err != nil {
		return err
	}
	if req.Opcion == nil {
		return errCampoObligatorio("opcion")
	}
	r, err := h.evaluacion.Responder(c.UserContext(), middleware.UsuarioID(c), req.Orden, *req.Opcion)
	return enJSON(c, r, err)
}

func (h *AdminHandler) EvaluacionFinalizar(c *fiber.Ctx) error {
	r, err := h.evaluacion.Finalizar(c.UserContext(), middleware.UsuarioID(c))
	return enJSON(c, r, err)
}

func (h *AdminHandler) EvaluacionReporte(c *fiber.Ctx) error {
	nombre, pdf, err := h.evaluacion.ReportePDF(c.UserContext(), middleware.UsuarioID(c))
	return descarga(c, nombre, "application/pdf", pdf, err)
}
