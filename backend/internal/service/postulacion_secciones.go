package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"slices"
	"strings"
	"time"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
	"github.com/biess-dev/biess-postulacion/backend/internal/repository"
)

const maxItemsSeccion = 30

// GuardarCargo (1.4): valida en el Historial Laboral que el postulante tenga la calidad
// que exige el sector. Si no la tiene, responde 422 con el mensaje literal del requerimiento.
func (s *PostulacionService) GuardarCargo(ctx context.Context, usuarioID int64, sector string, tieneRespaldo bool, organizacion *string, documentoID *int64) (*domain.Postulacion, error) {
	sector = strings.ToUpper(strings.TrimSpace(sector))
	organizacion = limpiar(organizacion)
	if !tieneRespaldo {
		organizacion, documentoID = nil, nil
	}

	return s.editarBorrador(ctx, usuarioID, "SELECCIONAR_CARGO", func(ctx context.Context, p *domain.Postulacion) error {
		errs := campos{}
		if tieneRespaldo {
			errs.req("organizacionNombre", deref(organizacion), 200)
			if documentoID == nil {
				errs["organizacionDocumentoId"] = "Adjunte el documento de respaldo"
			}
		}
		if err := s.validarDocumentos(ctx, errs, p.ID, domain.DocRespaldoOrganizacion,
			map[string]*int64{"organizacionDocumentoId": documentoID}); err != nil {
			return err
		}
		sec, err := s.catalogos.FindSector(ctx, sector)
		switch {
		case errors.Is(err, repository.ErrNotFound):
			errs["sector"] = "Seleccione un sector válido"
		case err != nil:
			return err
		}
		if err := errs.err(); err != nil {
			return err
		}

		dp, err := s.repo.GetDatosPersonales(ctx, p.ID)
		if err != nil {
			return err
		}
		cumple, err := s.historial.TieneCalidad(ctx, dp.Cedula, sec.TipoRequerido)
		if err != nil {
			return err
		}
		if !cumple {
			return domain.NewError(domain.ErrReglaNegocio, sec.MensajeRechazo).
				WithDetail("cumple", false).
				WithDetail("etiqueta", sec.EtiquetaNoCumple)
		}
		if err := s.detalle.UpdateCargo(ctx, p.ID, sec.Codigo, tieneRespaldo, organizacion, documentoID); err != nil {
			return err
		}
		return s.detalle.LimpiarDocumentos(ctx, p.ID, domain.DocRespaldoOrganizacion)
	})
}

// ResultadoCargo es lo que se visualiza tras consultar el Historial Laboral.
type ResultadoCargo struct {
	Cumple   bool   `json:"cumple"`
	Etiqueta string `json:"etiqueta"`
	Mensaje  string `json:"mensaje,omitempty"`
}

// ValidarCargo (1.4) consulta el Historial Laboral al elegir el cargo, sin guardar nada: según
// lo que se visualice se despliega la pregunta del respaldo o el mensaje de rechazo.
func (s *PostulacionService) ValidarCargo(ctx context.Context, usuarioID int64, sector string) (*ResultadoCargo, error) {
	p, err := s.repo.FindByUsuario(ctx, usuarioID, false)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, domain.NewError(domain.ErrNoEncontrado, "Aún no ha iniciado su postulación")
	}
	if err != nil {
		return nil, err
	}
	sec, err := s.catalogos.FindSector(ctx, strings.ToUpper(strings.TrimSpace(sector)))
	if errors.Is(err, repository.ErrNotFound) {
		return nil, errValidacionCampos(map[string]string{"sector": "Seleccione un sector válido"})
	}
	if err != nil {
		return nil, err
	}
	dp, err := s.repo.GetDatosPersonales(ctx, p.ID)
	if err != nil {
		return nil, err
	}
	cumple, err := s.historial.TieneCalidad(ctx, dp.Cedula, sec.TipoRequerido)
	if err != nil {
		return nil, err
	}
	if !cumple {
		return &ResultadoCargo{Etiqueta: sec.EtiquetaNoCumple, Mensaje: sec.MensajeRechazo}, nil
	}
	return &ResultadoCargo{Cumple: true, Etiqueta: sec.EtiquetaCumple}, nil
}

// EliminarCargo (1.4.3.4) deja la sección sin responder, junto con su respaldo.
func (s *PostulacionService) EliminarCargo(ctx context.Context, usuarioID int64) (*domain.Postulacion, error) {
	return s.editarBorrador(ctx, usuarioID, "ELIMINAR_CARGO", func(ctx context.Context, p *domain.Postulacion) error {
		if err := s.detalle.EliminarCargo(ctx, p.ID); err != nil {
			return err
		}
		return s.detalle.LimpiarDocumentos(ctx, p.ID, domain.DocRespaldoOrganizacion)
	})
}

// GuardarFormacion (1.5).
func (s *PostulacionService) GuardarFormacion(ctx context.Context, usuarioID int64, items []domain.Formacion) (*domain.Postulacion, error) {
	return s.editarBorrador(ctx, usuarioID, "ACTUALIZAR_FORMACION", func(ctx context.Context, p *domain.Postulacion) error {
		errs := campos{}
		docs := map[string]*int64{}
		if len(items) == 0 {
			errs["items"] = "Registre al menos un título"
		}
		validarCantidad(errs, len(items))
		for i := range items {
			f, k := &items[i], fmt.Sprintf("items[%d].", i)
			f.Institucion, f.Titulo = strings.TrimSpace(f.Institucion), strings.TrimSpace(f.Titulo)
			f.RegistroSenescyt = strings.TrimSpace(f.RegistroSenescyt)
			f.Tipo = strings.ToUpper(strings.TrimSpace(f.Tipo))
			errs.req(k+"institucion", f.Institucion, 200)
			errs.req(k+"titulo", f.Titulo, 200)
			errs.req(k+"registroSenescyt", f.RegistroSenescyt, 40)
			errs.enum(k+"tipo", f.Tipo, "NACIONAL", "EXTRANJERA")
			errs.id(k+"nivelId", f.NivelID)
			errs.id(k+"areaId", f.AreaID)
			errs.fechaPasada(k+"fechaRegistro", f.FechaRegistro)
			docs[k+"documentoId"] = f.DocumentoID
		}
		if err := s.validarDocumentos(ctx, errs, p.ID, domain.DocFormacion, docs); err != nil {
			return err
		}
		if err := errs.err(); err != nil {
			return err
		}
		if err := s.detalle.ReplaceFormacion(ctx, p.ID, items); err != nil {
			return err
		}
		return s.detalle.LimpiarDocumentos(ctx, p.ID, domain.DocFormacion)
	})
}

// GuardarExperiencia (1.6). La duración de cada registro se calcula al leer.
func (s *PostulacionService) GuardarExperiencia(ctx context.Context, usuarioID int64, items []domain.Experiencia) (*domain.Postulacion, error) {
	return s.editarBorrador(ctx, usuarioID, "ACTUALIZAR_EXPERIENCIA", func(ctx context.Context, p *domain.Postulacion) error {
		errs := campos{}
		docs := map[string]*int64{}
		if len(items) == 0 {
			errs["items"] = "Registre al menos una experiencia"
		}
		validarCantidad(errs, len(items))
		for i := range items {
			e, k := &items[i], fmt.Sprintf("items[%d].", i)
			e.Cargo, e.Institucion = strings.TrimSpace(e.Cargo), strings.TrimSpace(e.Institucion)
			e.Descripcion = strings.TrimSpace(e.Descripcion)
			e.Tipo = strings.ToUpper(strings.TrimSpace(e.Tipo))
			errs.enum(k+"tipo", e.Tipo, "GENERAL", "DIRECCION")
			errs.req(k+"cargo", e.Cargo, 150)
			errs.req(k+"institucion", e.Institucion, 200)
			errs.req(k+"descripcion", e.Descripcion, 1000)
			errs.id(k+"areaId", e.AreaID)
			errs.rango(k, e.FechaInicio, e.FechaFin)
			if e.DocumentoID == nil {
				errs[k+"documentoId"] = "Adjunte el documento de respaldo"
			}
			docs[k+"documentoId"] = e.DocumentoID
		}
		if err := s.validarDocumentos(ctx, errs, p.ID, domain.DocExperiencia, docs); err != nil {
			return err
		}
		if err := errs.err(); err != nil {
			return err
		}
		if err := s.detalle.ReplaceExperiencia(ctx, p.ID, items); err != nil {
			return err
		}
		return s.detalle.LimpiarDocumentos(ctx, p.ID, domain.DocExperiencia)
	})
}

// GuardarPublicaciones (1.7).
func (s *PostulacionService) GuardarPublicaciones(ctx context.Context, usuarioID int64, tiene bool, items []domain.Publicacion) (*domain.Postulacion, error) {
	if !tiene {
		items = nil
	}
	return s.editarBorrador(ctx, usuarioID, "ACTUALIZAR_PUBLICACIONES", func(ctx context.Context, p *domain.Postulacion) error {
		errs := campos{}
		docs := map[string]*int64{}
		if tiene && len(items) == 0 {
			errs["items"] = "Agregue al menos una publicación o indique que no tiene"
		}
		validarCantidad(errs, len(items))
		for i := range items {
			pb, k := &items[i], fmt.Sprintf("items[%d].", i)
			pb.Titulo, pb.Medio = strings.TrimSpace(pb.Titulo), strings.TrimSpace(pb.Medio)
			pb.Tipo = strings.ToUpper(strings.TrimSpace(pb.Tipo))
			errs.req(k+"titulo", pb.Titulo, 300)
			errs.req(k+"medio", pb.Medio, 200)
			errs.enum(k+"tipo", pb.Tipo, "PUBLICACION", "INVESTIGACION")
			errs.fechaPasada(k+"fecha", pb.Fecha)
			if pb.DocumentoID == nil {
				errs[k+"documentoId"] = "Adjunte el documento de respaldo"
			}
			docs[k+"documentoId"] = pb.DocumentoID
		}
		if err := s.validarDocumentos(ctx, errs, p.ID, domain.DocPublicacion, docs); err != nil {
			return err
		}
		if err := errs.err(); err != nil {
			return err
		}
		if err := s.detalle.ReplacePublicaciones(ctx, p.ID, tiene, items); err != nil {
			return err
		}
		return s.detalle.LimpiarDocumentos(ctx, p.ID, domain.DocPublicacion)
	})
}

// GuardarCapacitaciones (1.8).
func (s *PostulacionService) GuardarCapacitaciones(ctx context.Context, usuarioID int64, items []domain.Capacitacion) (*domain.Postulacion, error) {
	return s.editarBorrador(ctx, usuarioID, "ACTUALIZAR_CAPACITACIONES", func(ctx context.Context, p *domain.Postulacion) error {
		errs := campos{}
		docs := map[string]*int64{}
		validarCantidad(errs, len(items))
		for i := range items {
			c, k := &items[i], fmt.Sprintf("items[%d].", i)
			c.Nombre, c.Institucion = strings.TrimSpace(c.Nombre), strings.TrimSpace(c.Institucion)
			c.Tipo = strings.ToUpper(strings.TrimSpace(c.Tipo))
			errs.enum(k+"tipo", c.Tipo, "CURSO", "SEMINARIO", "TALLER")
			errs.req(k+"nombre", c.Nombre, 200)
			errs.req(k+"institucion", c.Institucion, 200)
			errs.rango(k, c.FechaInicio, c.FechaFin)
			if c.Horas <= 0 {
				errs[k+"horas"] = "Debe ser mayor a 0"
			}
			docs[k+"documentoId"] = c.DocumentoID
		}
		if err := s.validarDocumentos(ctx, errs, p.ID, domain.DocCapacitacion, docs); err != nil {
			return err
		}
		if err := errs.err(); err != nil {
			return err
		}
		if err := s.detalle.ReplaceCapacitaciones(ctx, p.ID, items); err != nil {
			return err
		}
		return s.detalle.LimpiarDocumentos(ctx, p.ID, domain.DocCapacitacion)
	})
}

// GuardarInhabilidades (1.9): exige las 13 respuestas y recalcula posible_inhabilidad.
// Una inhabilidad NO bloquea la postulación: solo la marca para revisión.
func (s *PostulacionService) GuardarInhabilidades(ctx context.Context, usuarioID int64, respuestas []domain.RespuestaInhabilidad) (*domain.Postulacion, error) {
	return s.editarBorrador(ctx, usuarioID, "ACTUALIZAR_INHABILIDADES", func(ctx context.Context, p *domain.Postulacion) error {
		preguntas, err := s.catalogos.ListInhabilidades(ctx)
		if err != nil {
			return err
		}
		porID := make(map[int]domain.PreguntaInhabilidad, len(preguntas))
		for _, q := range preguntas {
			porID[q.ID] = q
		}

		errs := campos{}
		vistas := map[int]bool{}
		posible := false
		for i := range respuestas {
			r, k := &respuestas[i], fmt.Sprintf("respuestas[%d].", i)
			q, ok := porID[r.PreguntaID]
			if !ok || vistas[r.PreguntaID] {
				errs[k+"preguntaId"] = "Pregunta inexistente o repetida"
				continue
			}
			vistas[r.PreguntaID] = true
			if r.Respuesta != q.RespuestaEsperada {
				posible = true
			}
			if q.RequiereDetalle && r.Respuesta != q.RespuestaEsperada {
				validarDetalleRemocion(errs, k+"detalle.", r.Detalle)
			} else {
				r.Detalle = nil
			}
		}
		if len(vistas) != len(preguntas) && len(errs) == 0 {
			errs["respuestas"] = fmt.Sprintf("Debe responder las %d preguntas", len(preguntas))
		}
		if err := errs.err(); err != nil {
			return err
		}
		return s.detalle.ReplaceInhabilidades(ctx, p.ID, respuestas, posible)
	})
}

func validarDetalleRemocion(errs campos, k string, d *domain.DetalleRemocion) {
	if d == nil {
		errs[k+"institucion"] = "Es obligatorio"
		return
	}
	d.Institucion, d.Cargo, d.Motivo = strings.TrimSpace(d.Institucion), strings.TrimSpace(d.Cargo), strings.TrimSpace(d.Motivo)
	// 1.9.7.1: solo la institución y el motivo llevan asterisco.
	errs.req(k+"institucion", d.Institucion, 200)
	errs.opt(k+"cargo", &d.Cargo, 150)
	errs.req(k+"motivo", d.Motivo, 500)
	if !d.FechaFin.IsZero() {
		errs.fechaPasada(k+"fechaFin", d.FechaFin)
	}
}

// EliminarInhabilidades borra las respuestas de la sección (1.9).
func (s *PostulacionService) EliminarInhabilidades(ctx context.Context, usuarioID int64) (*domain.Postulacion, error) {
	return s.editarBorrador(ctx, usuarioID, "ELIMINAR_INHABILIDADES", func(ctx context.Context, p *domain.Postulacion) error {
		return s.detalle.ReplaceInhabilidades(ctx, p.ID, nil, false)
	})
}

// Enviar (1.10) es la transacción principal: con la fila bloqueada verifica las secciones
// obligatorias y el consentimiento, cambia el estado a ENVIADA y registra el historial.
// Si cualquier paso falla, ROLLBACK: la postulación sigue en BORRADOR sin cambios.
func (s *PostulacionService) Enviar(ctx context.Context, usuarioID int64, aceptaConsentimiento bool) (*domain.Postulacion, error) {
	accion := "ENVIAR"
	if s.cfg.SimularFallaEnvio {
		// Demostración de rollback: la acción excede VARCHAR(40) y PostgreSQL rechaza
		// el INSERT del historial DESPUÉS de haber marcado la postulación como ENVIADA.
		accion = "ENVIAR_CON_FALLA_FORZADA_PARA_DEMOSTRAR_EL_ROLLBACK"
		log.Printf("DEMO: DEMO_FALLA_ENVIO activo, el INSERT del historial fallará")
	}

	p, err := s.editarBorrador(ctx, usuarioID, accion, func(ctx context.Context, p *domain.Postulacion) error {
		if !aceptaConsentimiento {
			return errValidacionCampos(map[string]string{
				"aceptaConsentimiento": "Debe aceptar la declaración y el consentimiento para enviar"})
		}
		if err := s.cargarDetalle(ctx, p); err != nil {
			return err
		}
		if faltan := seccionesFaltantes(p); len(faltan) > 0 {
			return domain.NewError(domain.ErrReglaNegocio, "Complete las secciones obligatorias antes de enviar").
				WithDetail("faltantes", faltan)
		}
		return s.detalle.MarcarEnviada(ctx, p.ID)
	})
	if err != nil {
		return nil, err
	}

	s.enviarFormularioPorCorreo(ctx, usuarioID, p)
	return p, nil
}

// enviarFormularioPorCorreo (1.10.3) manda el formulario completo. La postulación ya quedó
// enviada: un fallo aquí se registra y no la deshace.
func (s *PostulacionService) enviarFormularioPorCorreo(ctx context.Context, usuarioID int64, p *domain.Postulacion) {
	u, err := s.usuarios.FindByID(ctx, usuarioID)
	if err != nil {
		log.Printf("ERROR buscando el correo de la postulación %s: %v", p.Codigo, err)
		return
	}
	f, err := s.armarFormulario(ctx, p)
	if err != nil {
		log.Printf("ERROR armando el formulario de %s: %v", p.Codigo, err)
		return
	}
	cuerpo, err := formularioHTML(f)
	if err != nil {
		log.Printf("ERROR armando el correo de %s: %v", p.Codigo, err)
		return
	}
	notificar(s.correo, Mensaje{Para: u.Email, Asunto: "Formulario de postulación " + p.Codigo, HTML: cuerpo})
}

func seccionesFaltantes(p *domain.Postulacion) []string {
	faltan := []string{}
	if p.DatosConfirmadosEn == nil {
		faltan = append(faltan, "personal")
	}
	if p.Contacto == nil {
		faltan = append(faltan, "contacto")
	}
	if p.TieneFamiliares == nil {
		faltan = append(faltan, "familiares")
	}
	if p.SectorCodigo == nil || (p.TieneRespaldo != nil && *p.TieneRespaldo && p.OrganizacionDocumento == nil) {
		faltan = append(faltan, "cargo")
	}
	if len(p.Formacion) == 0 {
		faltan = append(faltan, "formacion")
	}
	if len(p.Experiencia) == 0 || slices.ContainsFunc(p.Experiencia, func(e domain.Experiencia) bool { return e.DocumentoID == nil }) {
		faltan = append(faltan, "experiencia")
	}
	if p.TienePublicaciones == nil || slices.ContainsFunc(p.Publicaciones, func(pb domain.Publicacion) bool { return pb.DocumentoID == nil }) {
		faltan = append(faltan, "publicaciones")
	}
	if len(p.Inhabilidades) == 0 {
		faltan = append(faltan, "inhabilidades")
	}
	return faltan
}

// calcularExperiencia completa la duración de cada registro y los totales por tipo.
func calcularExperiencia(p *domain.Postulacion) {
	var t domain.ExperienciaTotal
	for i := range p.Experiencia {
		e := &p.Experiencia[i]
		e.Duracion = domain.CalcularDuracion(e.FechaInicio.Time, e.FechaFin.Time)
		if e.Tipo == "DIRECCION" {
			t.Direccion = t.Direccion.Sumar(e.Duracion)
		} else {
			t.General = t.General.Sumar(e.Duracion)
		}
		t.Total = t.Total.Sumar(e.Duracion)
	}
	p.ExperienciaTotal = t
}

func validarCantidad(errs campos, n int) {
	if n > maxItemsSeccion {
		errs["items"] = fmt.Sprintf("Máximo %d registros", maxItemsSeccion)
	}
}

func (c campos) enum(key, val string, permitidos ...string) {
	for _, p := range permitidos {
		if val == p {
			return
		}
	}
	c[key] = "Debe ser " + strings.Join(permitidos, " o ")
}

func (c campos) id(key string, v int) {
	if v <= 0 {
		c[key] = "Es obligatorio"
	}
}

func (c campos) fechaPasada(key string, f domain.Fecha) {
	switch {
	case f.IsZero():
		c[key] = "Es obligatoria"
	case f.After(time.Now()):
		c[key] = "No puede ser una fecha futura"
	}
}

// rango valida fechaInicio ≤ fechaFin ≤ hoy.
func (c campos) rango(prefijo string, inicio, fin domain.Fecha) {
	c.fechaPasada(prefijo+"fechaInicio", inicio)
	c.fechaPasada(prefijo+"fechaFin", fin)
	if !inicio.IsZero() && !fin.IsZero() && fin.Before(inicio.Time) {
		c[prefijo+"fechaFin"] = "Debe ser posterior o igual a la fecha de inicio"
	}
}
