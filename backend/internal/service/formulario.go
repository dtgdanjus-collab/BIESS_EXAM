package service

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"strconv"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

// Consentimiento es el texto literal del numeral 1.10.1 del requerimiento.
var Consentimiento = []string{
	"Autorizo de manera libre y voluntaria, emitiendo consentimiento explícito al Instituto Ecuatoriano de Seguridad Social, para el uso de mis datos personales dentro del concurso de méritos y oposición para la selección de los Miembros Principales y Alternos del Directorio del Banco del Instituto Ecuatoriano de Seguridad Social (BIESS), en Representación de los Afiliados, Jubilados y Empleadores, de conformidad con lo prescrito en el artículo 7 de la Ley Orgánica de Protección de Datos Personales.",
	"Declaro que la información del presente formulario y documentación adjunta corresponde a la verdad y autorizo al Instituto Ecuatoriano de Seguridad Social para que se compruebe ante cualquier organismo público o privado su veracidad.",
	"Acepto expresamente cumplir con las normas aplicables al concurso de méritos y oposición para la selección de los Miembros Principales y Alternos del Directorio del Banco del Instituto Ecuatoriano de Seguridad Social (BIESS), en Representación de los Afiliados, Jubilados y Empleadores; así como las resoluciones y disposiciones impartidas por el Instituto Ecuatoriano de Seguridad Social. En caso de incumplimiento de requisitos o encontrarme inmerso/a en las prohibiciones o inhabilidades acepto mi descalificación del proceso.",
	"Acepto que mi nombre como postulante al concurso de méritos y oposición para la selección de los Miembros Principales y Alternos del Directorio del Banco del Instituto Ecuatoriano de Seguridad Social (BIESS), en Representación de los Afiliados, Jubilados y Empleadores; sea publicado en la página web del IESS - BIESS.",
	"El presente formulario, debe ser impreso y con firma manuscrita, entregado junto con los requisitos solicitados, en el lugar, fecha y horario establecido por el Instituto Ecuatoriano de Seguridad Social.",
}

// Formulario devuelve el formulario completo del postulante autenticado.
func (s *PostulacionService) Formulario(ctx context.Context, usuarioID int64) (*domain.FormularioFinal, error) {
	p, err := s.Obtener(ctx, usuarioID)
	if err != nil {
		return nil, err
	}
	return s.armarFormulario(ctx, p)
}

// GuardarPostulacion (1.10.1) deja constancia de que el formulario está completo y devuelve el
// texto que debe aceptar antes de enviar.
func (s *PostulacionService) GuardarPostulacion(ctx context.Context, usuarioID int64) (*domain.FormularioFinal, error) {
	p, err := s.editarBorrador(ctx, usuarioID, "GUARDAR_POSTULACION", func(ctx context.Context, p *domain.Postulacion) error {
		if err := s.cargarDetalle(ctx, p); err != nil {
			return err
		}
		if faltan := seccionesFaltantes(p); len(faltan) > 0 {
			return domain.NewError(domain.ErrReglaNegocio, "Complete las secciones obligatorias antes de guardar").
				WithDetail("faltantes", faltan)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.armarFormulario(ctx, p)
}

func siNoTexto(b *bool) string {
	switch {
	case b == nil:
		return ""
	case *b:
		return "Sí"
	default:
		return "No"
	}
}

func textoFecha(f domain.Fecha) string {
	if f.IsZero() {
		return ""
	}
	return f.Format("02/01/2006")
}

func textoDuracion(d domain.Duracion) string {
	return fmt.Sprintf("%d años, %d meses y %d días", d.Anios, d.Meses, d.Dias)
}

func nombresDe(items []domain.Item) map[int]string {
	m := make(map[int]string, len(items))
	for _, it := range items {
		m[it.ID] = it.Nombre
	}
	return m
}

func campoDocumento(d domain.DocumentoAdjunto) domain.CampoFormulario {
	if d.DocumentoID == nil {
		return domain.CampoFormulario{Etiqueta: "Documento de respaldo", Valor: "Sin documento"}
	}
	doc := &domain.Documento{ID: *d.DocumentoID, Nombre: deref(d.DocumentoNombre)}
	if d.DocumentoTamano != nil {
		doc.TamanoBytes = *d.DocumentoTamano
	}
	return domain.CampoFormulario{Etiqueta: "Documento de respaldo", Valor: doc.Nombre, Documento: doc}
}

// armarFormulario pone juntos todos los campos con los nombres de los catálogos.
func (s *PostulacionService) armarFormulario(ctx context.Context, p *domain.Postulacion) (*domain.FormularioFinal, error) {
	c := func(etiqueta, valor string) domain.CampoFormulario {
		return domain.CampoFormulario{Etiqueta: etiqueta, Valor: valor}
	}
	f := &domain.FormularioFinal{Codigo: p.Codigo, Estado: p.Estado, FechaEnvio: p.FechaEnvio, Consentimiento: Consentimiento}

	// 1.1
	if d := p.DatosPersonales; d != nil {
		f.FirmaNombres, f.FirmaCedula = d.Nombres+" "+d.Apellidos, d.Cedula
		campos := []domain.CampoFormulario{c("Nombres", d.Nombres), c("Apellidos", d.Apellidos), c("Cédula", d.Cedula),
			c("Género", d.Genero), c("Fecha de nacimiento", textoFecha(d.FechaNacimiento)), c("Nacionalidad", d.Nacionalidad), c("Estado civil", d.EstadoCivil)}
		if tieneConyuge(d.EstadoCivil) {
			campos = append(campos, c("Nombres y apellidos de la pareja", deref(d.ConyugeNombres)), c("Cédula de la pareja", deref(d.ConyugeCedula)))
		}
		f.Secciones = append(f.Secciones, domain.SeccionFormulario{Numeral: "1.1", Titulo: "Información personal", Campos: campos})
	}

	// 1.2
	if k := p.Contacto; k != nil {
		provincia, ciudad := deref(k.ProvinciaTexto), deref(k.CiudadTexto)
		paises, err := s.catalogos.ListPaises(ctx)
		if err != nil {
			return nil, err
		}
		if k.ProvinciaID != nil {
			lista, err := s.catalogos.ListProvincias(ctx, k.PaisID)
			if err != nil {
				return nil, err
			}
			provincia = nombresDe(lista)[*k.ProvinciaID]
		}
		if k.CantonID != nil && k.ProvinciaID != nil {
			lista, err := s.catalogos.ListCantones(ctx, *k.ProvinciaID)
			if err != nil {
				return nil, err
			}
			ciudad = nombresDe(lista)[*k.CantonID]
		}
		f.Secciones = append(f.Secciones, domain.SeccionFormulario{Numeral: "1.2", Titulo: "Información domiciliaria y de contacto", Campos: []domain.CampoFormulario{
			c("País", nombresDe(paises)[k.PaisID]), c("Provincia / Estado", provincia), c("Ciudad", ciudad),
			c("Teléfono celular", k.TelefonoCelular), c("Correo electrónico 1", k.Correo1), c("Correo electrónico 2", deref(k.Correo2)),
			c("Calle principal domicilio", k.CallePrincipal), c("Número", deref(k.Numero)), c("Calle secundaria", deref(k.CalleSecundaria)),
			c("Sector", deref(k.Sector)), c("Referencia", deref(k.Referencia)), c("Teléfono domicilio", deref(k.TelefonoDomicilio)),
		}})
	}

	// 1.3
	parentescos, err := s.catalogos.ListParentescos(ctx)
	if err != nil {
		return nil, err
	}
	sec := domain.SeccionFormulario{Numeral: "1.3", Titulo: "Información adicional", Campos: []domain.CampoFormulario{
		c("Tiene familiares dentro del segundo grado de consanguinidad y cuarto de afinidad, trabajando en el IESS o BIESS actualmente", siNoTexto(p.TieneFamiliares))}}
	for i, x := range p.Familiares {
		sec.Registros = append(sec.Registros, domain.RegistroFormulario{Titulo: fmt.Sprintf("Familiar %d", i+1), Campos: []domain.CampoFormulario{
			c("Nombres y apellidos del familiar", x.NombresApellidos), c("Parentesco familiar", nombresDe(parentescos)[x.ParentescoID]),
			c("Institución donde trabaja el familiar", x.Institucion), c("Área donde trabaja el familiar", x.Area), c("Cargo", x.Cargo)}})
	}
	f.Secciones = append(f.Secciones, sec)

	// 1.4
	sectores, err := s.catalogos.ListSectores(ctx)
	if err != nil {
		return nil, err
	}
	sec = domain.SeccionFormulario{Numeral: "1.4", Titulo: "Selección del cargo al que postula"}
	for _, x := range sectores {
		if p.SectorCodigo != nil && x.Codigo == *p.SectorCodigo {
			sec.Campos = append(sec.Campos, c("Cargo", x.Cargo), c("Validación del Historial Laboral", x.EtiquetaCumple), c(x.PreguntaRespaldo, siNoTexto(p.TieneRespaldo)))
		}
	}
	if p.TieneRespaldo != nil && *p.TieneRespaldo {
		sec.Campos = append(sec.Campos, c("Nombre de Organización", deref(p.OrganizacionNombre)))
		if d := p.OrganizacionDocumento; d != nil {
			sec.Campos = append(sec.Campos, domain.CampoFormulario{Etiqueta: "Documento de respaldo", Valor: d.Nombre, Documento: d})
		}
	}
	f.Secciones = append(f.Secciones, sec)

	// 1.5
	niveles, err := s.catalogos.ListNiveles(ctx)
	if err != nil {
		return nil, err
	}
	nombreNivel := make(map[int]string, len(niveles))
	for _, n := range niveles {
		nombreNivel[n.ID] = n.Nombre
	}
	areas, err := s.catalogos.ListAreas(ctx)
	if err != nil {
		return nil, err
	}
	nombreArea := nombresDe(areas)
	sec = domain.SeccionFormulario{Numeral: "1.5", Titulo: "Formación académica"}
	for i, x := range p.Formacion {
		sec.Registros = append(sec.Registros, domain.RegistroFormulario{Titulo: fmt.Sprintf("Título %d", i+1), Campos: []domain.CampoFormulario{
			c("Nivel de instrucción", nombreNivel[x.NivelID]), c("Institución educativa", x.Institucion), c("Tipo", x.Tipo), c("Título obtenido", x.Titulo),
			c("Área de estudios", nombreArea[x.AreaID]), c("Número de registro SENESCYT", x.RegistroSenescyt), c("Fecha de registro SENESCYT", textoFecha(x.FechaRegistro)),
			campoDocumento(x.DocumentoAdjunto)}})
	}
	f.Secciones = append(f.Secciones, sec)

	// 1.6
	sec = domain.SeccionFormulario{Numeral: "1.6", Titulo: "Experiencia profesional", Campos: []domain.CampoFormulario{
		c("Experiencia general", textoDuracion(p.ExperienciaTotal.General)), c("Experiencia en dirección", textoDuracion(p.ExperienciaTotal.Direccion)), c("Experiencia total", textoDuracion(p.ExperienciaTotal.Total))}}
	for i, x := range p.Experiencia {
		sec.Registros = append(sec.Registros, domain.RegistroFormulario{Titulo: fmt.Sprintf("Experiencia %d", i+1), Campos: []domain.CampoFormulario{
			c("Tipo de experiencia", x.Tipo), c("Cargo o puesto", x.Cargo), c("Institución o empresa", x.Institucion), c("Fecha inicio", textoFecha(x.FechaInicio)),
			c("Fecha finalización", textoFecha(x.FechaFin)), c("Tiempo", textoDuracion(x.Duracion)), c("Actividades relacionadas a", nombreArea[x.AreaID]),
			c("Descripción de funciones", x.Descripcion), campoDocumento(x.DocumentoAdjunto)}})
	}
	f.Secciones = append(f.Secciones, sec)

	// 1.7
	sec = domain.SeccionFormulario{Numeral: "1.7", Titulo: "Publicaciones", Campos: []domain.CampoFormulario{c("¿Cuenta con Publicaciones e Investigaciones académicas?", siNoTexto(p.TienePublicaciones))}}
	for i, x := range p.Publicaciones {
		relacion := x.Relacionada
		sec.Registros = append(sec.Registros, domain.RegistroFormulario{Titulo: fmt.Sprintf("Publicación %d", i+1), Campos: []domain.CampoFormulario{
			c("Título de la publicación o trabajo de investigación", x.Titulo), c("Tipo", x.Tipo), c("Medio de publicación", x.Medio), c("Fecha de publicación", textoFecha(x.Fecha)),
			c("¿Guarda relación con el campo de su ejercicio o formación profesional?", siNoTexto(&relacion)), campoDocumento(x.DocumentoAdjunto)}})
	}
	f.Secciones = append(f.Secciones, sec)

	// 1.8
	sec = domain.SeccionFormulario{Numeral: "1.8", Titulo: "Capacitación"}
	for i, x := range p.Capacitaciones {
		sec.Registros = append(sec.Registros, domain.RegistroFormulario{Titulo: fmt.Sprintf("Capacitación %d", i+1), Campos: []domain.CampoFormulario{
			c("Tipo de evento", x.Tipo), c("Nombre del evento", x.Nombre), c("Institución", x.Institucion), c("Fecha inicio", textoFecha(x.FechaInicio)),
			c("Fecha fin", textoFecha(x.FechaFin)), c("Número de horas del evento", strconv.Itoa(x.Horas)), campoDocumento(x.DocumentoAdjunto)}})
	}
	f.Secciones = append(f.Secciones, sec)

	// 1.9
	preguntas, err := s.catalogos.ListInhabilidades(ctx)
	if err != nil {
		return nil, err
	}
	sec = domain.SeccionFormulario{Numeral: "1.9", Titulo: "Inhabilidades"}
	respuestas := make(map[int]domain.RespuestaInhabilidad, len(p.Inhabilidades))
	for _, r := range p.Inhabilidades {
		respuestas[r.PreguntaID] = r
	}
	for _, q := range preguntas {
		r, hay := respuestas[q.ID]
		if !hay {
			continue
		}
		v := r.Respuesta
		sec.Campos = append(sec.Campos, c(q.Numeral+" "+q.Texto, siNoTexto(&v)))
		if r.Detalle != nil {
			sec.Registros = append(sec.Registros, domain.RegistroFormulario{Titulo: "Detalle de " + q.Numeral, Campos: []domain.CampoFormulario{
				c("Institución", r.Detalle.Institucion), c("Cargo", r.Detalle.Cargo), c("Fecha finalización", textoFecha(r.Detalle.FechaFin)), c("Motivo finalización", r.Detalle.Motivo)}})
		}
	}
	f.Secciones = append(f.Secciones, sec)
	return f, nil
}

var plantillaFormulario = template.Must(template.New("formulario").Parse(`<div style="font-family:Arial,sans-serif;color:#111;max-width:720px">
<h2 style="font-size:18px;margin-bottom:4px">Formulario de postulación</h2>
<p style="font-size:14px;margin-top:0">Código único: <strong>{{.Codigo}}</strong></p>
<p style="font-size:14px">Adjuntamos este formulario en PDF para que lo imprima y lo firme.</p>
{{range .Secciones}}<h3 style="font-size:15px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:24px">{{.Numeral}} {{.Titulo}}</h3>
<table style="font-size:13px;border-collapse:collapse;width:100%">{{range .Campos}}<tr><td style="padding:3px 12px 3px 0;color:#555;vertical-align:top;width:45%">{{.Etiqueta}}</td><td style="padding:3px 0">{{.Valor}}</td></tr>{{end}}</table>
{{range .Registros}}<p style="font-size:13px;font-weight:bold;margin:14px 0 4px">{{.Titulo}}</p>
<table style="font-size:13px;border-collapse:collapse;width:100%">{{range .Campos}}<tr><td style="padding:3px 12px 3px 0;color:#555;vertical-align:top;width:45%">{{.Etiqueta}}</td><td style="padding:3px 0">{{.Valor}}</td></tr>{{end}}</table>{{end}}{{end}}
<h3 style="font-size:15px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:24px">Declaración y consentimiento</h3>
<ol style="font-size:13px;line-height:1.5">{{range .Consentimiento}}<li style="margin-bottom:6px">{{.}}</li>{{end}}</ol>
<p style="font-size:13px;margin-top:48px">______________________________<br>Firma del postulante<br>{{.FirmaNombres}}<br>Cédula: {{.FirmaCedula}}</p>
</div>`))

// formularioHTML es el cuerpo del correo de 1.10.3.
func formularioHTML(f *domain.FormularioFinal) (string, error) {
	var b bytes.Buffer
	if err := plantillaFormulario.Execute(&b, f); err != nil {
		return "", fmt.Errorf("armando el formulario del correo: %w", err)
	}
	return b.String(), nil
}
