package handler

import "github.com/gofiber/fiber/v2"

// Handlers agrupa todos los handlers construidos en main.go.
type Handlers struct {
	Health      *HealthHandler
	Catalogos   *CatalogoHandler
	Auth        *AuthHandler
	Postulacion *PostulacionHandler
	Secciones   *SeccionesHandler
	Admin       *AdminHandler
}

// RegisterRoutes declara las rutas bajo el prefijo /api. requireAuth protege las rutas privadas.
func RegisterRoutes(app *fiber.App, h Handlers, requireAuth, requireAdmin fiber.Handler) {
	api := app.Group("/api")
	api.Get("/health", h.Health.Check)
	api.Get("/concurso", h.Admin.ConcursoPublico)

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

	post := api.Group("/postulacion", requireAuth)
	post.Get("/", h.Postulacion.Obtener)
	post.Post("/", h.Postulacion.Crear)
	post.Put("/datos-personales", h.Postulacion.DatosPersonales)
	post.Put("/contacto", h.Postulacion.Contacto)
	post.Delete("/contacto", h.Postulacion.EliminarContacto)
	post.Put("/familiares", h.Postulacion.Familiares)
	post.Post("/cargo", h.Secciones.Cargo)
	post.Post("/cargo/validar", h.Secciones.ValidarCargo)
	post.Delete("/cargo", h.Secciones.EliminarCargo)
	post.Post("/documentos", h.Secciones.SubirDocumento)
	post.Get("/documentos/:id", h.Secciones.Documento)
	post.Put("/formacion", h.Secciones.Formacion)
	post.Put("/experiencia", h.Secciones.Experiencia)
	post.Put("/publicaciones", h.Secciones.Publicaciones)
	post.Put("/capacitaciones", h.Secciones.Capacitaciones)
	post.Put("/inhabilidades", h.Secciones.Inhabilidades)
	post.Delete("/inhabilidades", h.Secciones.EliminarInhabilidades)
	post.Post("/enviar", h.Secciones.Enviar)
	post.Post("/guardar", h.Secciones.GuardarPostulacion)
	post.Get("/formulario", h.Secciones.Formulario)
	post.Get("/formulario.pdf", h.Secciones.FormularioPDF)
	post.Post("/formulario/reenviar", h.Secciones.ReenviarFormulario)
	post.Get("/concurso", h.Admin.MiConcurso)
	post.Post("/reconsideraciones", h.Admin.SolicitarReconsideracion)

	// EF-14: el examen solo responde a quien superó la fase de méritos.
	eva := api.Group("/evaluacion", requireAuth)
	eva.Get("/", h.Admin.EvaluacionEstado)
	eva.Post("/iniciar", h.Admin.EvaluacionIniciar)
	eva.Post("/responder", h.Admin.EvaluacionResponder)
	eva.Post("/finalizar", h.Admin.EvaluacionFinalizar)
	eva.Get("/reporte.pdf", h.Admin.EvaluacionReporte)

	// EF-13: Analista y Administrador consultan y califican; lo demás es del Administrador.
	api.Post("/admin/login", h.Admin.Login)
	adm := api.Group("/admin", requireAdmin, h.Admin.conRol(false), h.Admin.auditar)
	soloAdmin := h.Admin.conRol(true)
	adm.Get("/me", h.Admin.Me)
	adm.Get("/dashboard", h.Admin.Dashboard)
	adm.Get("/postulantes", h.Admin.Postulantes)
	adm.Get("/postulantes/:id", h.Admin.Detalle)
	adm.Get("/postulantes/:id/documentos/:doc", h.Admin.Documento)
	adm.Get("/postulantes/:id/evaluacion.pdf", h.Admin.ReporteEvaluacion)
	adm.Put("/postulantes/:id/calificacion", h.Admin.Calificar)
	adm.Get("/matriz.xlsx", h.Admin.MatrizXLSX)
	adm.Get("/matriz.pdf", h.Admin.MatrizPDF)
	adm.Get("/concurso", h.Admin.Concurso)
	adm.Put("/concurso", soloAdmin, h.Admin.GuardarConfig)
	adm.Put("/fases/:codigo", soloAdmin, h.Admin.GuardarFase)
	adm.Get("/evaluacion/preguntas", soloAdmin, h.Admin.Preguntas)
	adm.Post("/evaluacion/preguntas", soloAdmin, h.Admin.CrearPregunta)
	adm.Post("/evaluacion/preguntas/importar", soloAdmin, h.Admin.ImportarPreguntas)
	adm.Put("/evaluacion/preguntas/:id", soloAdmin, h.Admin.GuardarPregunta)
	adm.Delete("/evaluacion/preguntas/:id", soloAdmin, h.Admin.EliminarPregunta)
	adm.Get("/evaluacion/config", soloAdmin, h.Admin.EvaluacionConfig)
	adm.Put("/evaluacion/config", soloAdmin, h.Admin.GuardarEvaluacionConfig)
	adm.Get("/evaluacion/resultados", h.Admin.Resultados)
	adm.Get("/reconsideraciones", h.Admin.Reconsideraciones)
	adm.Put("/reconsideraciones/:id/informe", h.Admin.InformarReconsideracion)
	adm.Put("/reconsideraciones/:id", soloAdmin, h.Admin.ResponderReconsideracion)
	adm.Put("/meritos/tabla", soloAdmin, h.Admin.GuardarTablaMeritos)
	adm.Post("/meritos/recalcular", soloAdmin, h.Admin.RecalcularMeritos)
	adm.Get("/elegibles", h.Admin.Elegibles)
	adm.Get("/elegibles.xlsx", h.Admin.ElegiblesXLSX)
	adm.Get("/elegibles.pdf", h.Admin.ElegiblesPDF)
	adm.Get("/bitacora", soloAdmin, h.Admin.Bitacora)
	adm.Get("/usuarios", soloAdmin, h.Admin.Usuarios)
	adm.Post("/usuarios", soloAdmin, h.Admin.CrearUsuario)
	adm.Put("/usuarios/:id/activo", soloAdmin, h.Admin.CambiarActivo)
}
