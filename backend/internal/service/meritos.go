package service

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"math"
	"sort"
	"strconv"

	"github.com/go-pdf/fpdf"
	"github.com/xuri/excelize/v2"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

// DesgloseMeritos muestra de dónde sale el puntaje calculado.
type DesgloseMeritos struct {
	Formacion     float64 `json:"formacion"`
	Experiencia   float64 `json:"experiencia"`
	Publicaciones float64 `json:"publicaciones"`
	Capacitacion  float64 `json:"capacitacion"`
	Total         float64 `json:"total"`
}

func dosDecimales(v float64) float64 { return math.Round(v*100) / 100 }

// conTope limita un rubro; un tope en 0 significa que la Comisión no lo limitó.
func conTope(v, tope float64) float64 {
	if tope > 0 && v > tope {
		return tope
	}
	return v
}

func aniosDe(d domain.Duracion) float64 {
	return float64(d.Anios) + float64(d.Meses)/12 + float64(d.Dias)/365
}

// CalcularMeritos aplica la tabla de la Comisión a lo que el postulante registró (EF-1).
func CalcularMeritos(t domain.TablaMeritos, p *domain.Postulacion) DesgloseMeritos {
	formacion := 0.0
	for _, f := range p.Formacion {
		formacion += t.PuntosPorNivel[strconv.Itoa(f.NivelID)]
	}
	experiencia := aniosDe(p.ExperienciaTotal.General)*t.PuntosAnioGeneral + aniosDe(p.ExperienciaTotal.Direccion)*t.PuntosAnioDireccion
	horas := 0
	for _, c := range p.Capacitaciones {
		horas += c.Horas
	}
	d := DesgloseMeritos{
		Formacion:     dosDecimales(conTope(formacion, t.TopeFormacion)),
		Experiencia:   dosDecimales(conTope(experiencia, t.TopeExperiencia)),
		Publicaciones: dosDecimales(conTope(float64(len(p.Publicaciones))*t.PuntosPublicacion, t.TopePublicaciones)),
		Capacitacion:  dosDecimales(conTope(float64(horas)*t.PuntosHora, t.TopeCapacitacion)),
	}
	d.Total = dosDecimales(math.Min(d.Formacion+d.Experiencia+d.Publicaciones+d.Capacitacion, 100))
	return d
}

func validarTabla(t domain.TablaMeritos) error {
	errs := campos{}
	positivo := func(k string, v float64) {
		if v < 0 || v > 1000 {
			errs[k] = "Debe estar entre 0 y 1000"
		}
	}
	for id, v := range t.PuntosPorNivel {
		positivo("puntosPorNivel."+id, v)
	}
	for k, v := range map[string]float64{
		"topeFormacion": t.TopeFormacion, "puntosAnioGeneral": t.PuntosAnioGeneral, "puntosAnioDireccion": t.PuntosAnioDireccion,
		"topeExperiencia": t.TopeExperiencia, "puntosPublicacion": t.PuntosPublicacion, "topePublicaciones": t.TopePublicaciones,
		"puntosHora": t.PuntosHora, "topeCapacitacion": t.TopeCapacitacion, "pesoMeritos": t.PesoMeritos, "pesoTeorica": t.PesoTeorica,
		"pesoPsicotecnica": t.PesoPsicotecnica,
	} {
		positivo(k, v)
	}
	if t.NotaMinima < 0 || t.NotaMinima > 100 {
		errs["notaMinima"] = "Debe estar entre 0 y 100"
	}
	return errs.err()
}

// GuardarTablaMeritos fija los puntajes y lo que se exige para ser elegible.
func (s *AdminService) GuardarTablaMeritos(ctx context.Context, t domain.TablaMeritos) (*ConcursoAdmin, error) {
	if err := validarTabla(t); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateTablaMeritos(ctx, t); err != nil {
		return nil, err
	}
	return s.Concurso(ctx)
}

// RecalcularMeritos aplica la tabla a las postulaciones aún en revisión. Lo ya decidido no se toca.
func (s *AdminService) RecalcularMeritos(ctx context.Context) (int, error) {
	cfg, err := s.repo.GetConfig(ctx)
	if err != nil {
		return 0, err
	}
	if !cfg.TablaMeritos.Configurada() {
		return 0, domain.NewError(domain.ErrReglaNegocio, "Primero la Comisión debe definir la tabla de puntajes")
	}
	lista, err := s.repo.ListPostulantes(ctx, domain.FiltroPostulantes{Estado: string(domain.EstadoEnviada), EstadoConcurso: domain.ConcursoPostulado})
	if err != nil {
		return 0, err
	}
	for _, x := range lista {
		p, err := s.postulacion.Obtener(ctx, x.UsuarioID)
		if err != nil {
			return 0, err
		}
		if err := s.repo.GuardarPuntajeMeritos(ctx, x.PostulacionID, CalcularMeritos(cfg.TablaMeritos, p).Total); err != nil {
			return 0, err
		}
	}
	return len(lista), nil
}

// calcularMeritosAlEnviar deja el puntaje listo si ya hay tabla. Un fallo aquí no deshace el envío:
// Talento Humano puede recalcularlo.
func (s *PostulacionService) calcularMeritosAlEnviar(ctx context.Context, usuarioID int64, postulacionID int64) {
	cfg, err := s.concurso.GetConfig(ctx)
	if err != nil {
		log.Printf("ERROR leyendo la tabla de méritos: %v", err)
		return
	}
	if !cfg.TablaMeritos.Configurada() {
		return
	}
	p, err := s.Obtener(ctx, usuarioID)
	if err != nil {
		log.Printf("ERROR leyendo la postulación %d para los méritos: %v", postulacionID, err)
		return
	}
	if err := s.concurso.GuardarPuntajeMeritos(ctx, postulacionID, CalcularMeritos(cfg.TablaMeritos, p).Total); err != nil {
		log.Printf("ERROR guardando los méritos de %d: %v", postulacionID, err)
	}
}

// FilaElegible es un postulante en la lista de elegibles de su cargo.
type FilaElegible struct {
	domain.Postulante
	Puesto int     `json:"puesto"`
	Total  float64 `json:"total"`
}

// ListaElegibles agrupa por cargo a quienes tienen las tres notas y alcanzan el mínimo.
type ListaElegibles struct {
	Filas      []FilaElegible `json:"filas"`
	Pendientes int            `json:"pendientes"`
	BajoMinimo int            `json:"bajoMinimo"`
	NotaMinima float64        `json:"notaMinima"`
	Pesos      [3]float64     `json:"pesos"`
}

// notaFinal pondera las tres fases; sin pesos definidos cuentan por igual.
func notaFinal(t domain.TablaMeritos, meritos, teorica, psicotecnica float64) float64 {
	pm, pt, pp := t.PesoMeritos, t.PesoTeorica, t.PesoPsicotecnica
	if pm+pt+pp == 0 {
		pm, pt, pp = 1, 1, 1
	}
	return dosDecimales((meritos*pm + teorica*pt + psicotecnica*pp) / (pm + pt + pp))
}

// ArmarElegibles ordena de mayor a menor dentro de cada cargo. Una posible inhabilidad se muestra
// pero no excluye: esa decisión es de la Comisión.
func ArmarElegibles(lista []domain.Postulante, t domain.TablaMeritos) ListaElegibles {
	r := ListaElegibles{Filas: []FilaElegible{}, NotaMinima: t.NotaMinima, Pesos: [3]float64{t.PesoMeritos, t.PesoTeorica, t.PesoPsicotecnica}}
	for _, p := range lista {
		if p.PuntajeMeritos == nil || p.NotaTeorica == nil || p.NotaPsicotecnica == nil {
			r.Pendientes++
			continue
		}
		total := notaFinal(t, *p.PuntajeMeritos, *p.NotaTeorica, *p.NotaPsicotecnica)
		if total < t.NotaMinima {
			r.BajoMinimo++
			continue
		}
		r.Filas = append(r.Filas, FilaElegible{Postulante: p, Total: total})
	}
	sort.SliceStable(r.Filas, func(i, j int) bool {
		a, b := r.Filas[i], r.Filas[j]
		if deref(a.SectorCodigo) != deref(b.SectorCodigo) {
			return deref(a.SectorCodigo) < deref(b.SectorCodigo)
		}
		return a.Total > b.Total
	})
	puesto, sector := 0, ""
	for i := range r.Filas {
		if s := deref(r.Filas[i].SectorCodigo); s != sector {
			sector, puesto = s, 0
		}
		puesto++
		r.Filas[i].Puesto = puesto
	}
	return r
}

// Elegibles arma la lista con quienes superaron los méritos.
func (s *AdminService) Elegibles(ctx context.Context) (*ListaElegibles, error) {
	cfg, err := s.repo.GetConfig(ctx)
	if err != nil {
		return nil, err
	}
	lista, err := s.repo.ListPostulantes(ctx, domain.FiltroPostulantes{Estado: string(domain.EstadoEnviada), EstadoConcurso: domain.ConcursoEvaluacionTecnica})
	if err != nil {
		return nil, err
	}
	r := ArmarElegibles(lista, cfg.TablaMeritos)
	return &r, nil
}

var encabezadoElegibles = []string{"Cargo", "Puesto", "Código", "Cédula", "Apellidos y nombres", "Méritos", "Teórica", "Psicotécnica", "Nota final", "Posible inhabilidad"}

func (f FilaElegible) celdas() []string {
	inhabilidad := "No"
	if f.PosibleInhabilidad {
		inhabilidad = "Sí"
	}
	return []string{deref(f.SectorCodigo), strconv.Itoa(f.Puesto), f.Codigo, f.Cedula, f.Apellidos + " " + f.Nombres,
		textoNota(f.PuntajeMeritos), textoNota(f.NotaTeorica), textoNota(f.NotaPsicotecnica), textoNota(&f.Total), inhabilidad}
}

// ElegiblesXLSX exporta la lista a Excel.
func ElegiblesXLSX(l *ListaElegibles) ([]byte, error) {
	x := excelize.NewFile()
	defer x.Close()
	const hoja = "Elegibles"
	if err := x.SetSheetName(x.GetSheetName(0), hoja); err != nil {
		return nil, fmt.Errorf("creando hoja: %w", err)
	}
	if err := x.SetSheetRow(hoja, "A1", &encabezadoElegibles); err != nil {
		return nil, fmt.Errorf("escribiendo encabezado: %w", err)
	}
	for i, f := range l.Filas {
		celda, err := excelize.CoordinatesToCellName(1, i+2)
		if err != nil {
			return nil, err
		}
		valores := f.celdas()
		if err := x.SetSheetRow(hoja, celda, &valores); err != nil {
			return nil, fmt.Errorf("escribiendo fila: %w", err)
		}
	}
	if err := x.SetColWidth(hoja, "A", "J", 18); err != nil {
		return nil, fmt.Errorf("ajustando columnas: %w", err)
	}
	var b bytes.Buffer
	if err := x.Write(&b); err != nil {
		return nil, fmt.Errorf("generando Excel: %w", err)
	}
	return b.Bytes(), nil
}

// ElegiblesPDF exporta la lista a PDF, un bloque por cargo.
func ElegiblesPDF(l *ListaElegibles) ([]byte, error) {
	pdf := fpdf.New("L", "mm", "A4", "")
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	pdf.SetMargins(12, 12, 12)
	pdf.SetAutoPageBreak(true, 12)
	pdf.AddPage()
	pdf.SetFont("Helvetica", "B", 14)
	pdf.CellFormat(0, 8, tr("Lista de elegibles - Directorio del BIESS"), "", 1, "L", false, 0, "")
	anchos := []float64{0, 14, 36, 24, 92, 20, 20, 24, 22, 21}
	sector := ""
	for _, f := range l.Filas {
		if s := deref(f.SectorCodigo); s != sector {
			sector = s
			pdf.Ln(3)
			pdf.SetFont("Helvetica", "B", 11)
			pdf.SetTextColor(0, 0, 0)
			pdf.CellFormat(0, 7, tr(deref(f.Cargo)), "", 1, "L", false, 0, "")
			pdf.SetFont("Helvetica", "B", 8)
			pdf.SetFillColor(17, 17, 17)
			pdf.SetTextColor(255, 255, 255)
			for i, t := range encabezadoElegibles[1:] {
				pdf.CellFormat(anchos[i+1], 7, tr(t), "1", 0, "L", true, 0, "")
			}
			pdf.Ln(-1)
			pdf.SetTextColor(0, 0, 0)
		}
		pdf.SetFont("Helvetica", "", 8.5)
		for i, c := range f.celdas()[1:] {
			pdf.CellFormat(anchos[i+1], 6, tr(c), "1", 0, "L", false, 0, "")
		}
		pdf.Ln(-1)
	}
	if len(l.Filas) == 0 {
		pdf.SetFont("Helvetica", "", 10)
		pdf.CellFormat(0, 8, tr("Aún no hay postulantes con las tres notas."), "", 1, "L", false, 0, "")
	}
	return salidaPDF(pdf)
}

// avisosCalificacion son los correos que dispara una calificación: el resultado de méritos si
// cambió y la nota psicotécnica cuando se registra o corrige.
func avisosCalificacion(p *domain.Postulante, c domain.Calificacion) []Mensaje {
	avisos := []Mensaje{}
	if p.EstadoConcurso != c.EstadoConcurso && c.EstadoConcurso != domain.ConcursoPostulado {
		texto := "Su postulación " + p.Codigo + " no superó la fase de méritos."
		if c.EstadoConcurso == domain.ConcursoEvaluacionTecnica {
			texto = "Su postulación " + p.Codigo + " superó la fase de méritos. Ingrese al sistema para conocer la fecha y hora de su evaluación técnica."
		}
		avisos = append(avisos, Mensaje{Para: p.Email, Asunto: "Resultado de la fase de méritos - " + p.Codigo,
			HTML: correoSimple("Resultado de la fase de méritos", texto)})
	}
	if c.NotaPsicotecnica != nil && (p.NotaPsicotecnica == nil || *p.NotaPsicotecnica != *c.NotaPsicotecnica) {
		avisos = append(avisos, Mensaje{Para: p.Email, Asunto: "Resultado de la evaluación psicotécnica - " + p.Codigo,
			HTML: correoSimple("Resultado de la evaluación psicotécnica",
				fmt.Sprintf("Su calificación en la evaluación psicotécnica de la postulación %s es %.2f sobre 100.", p.Codigo, *c.NotaPsicotecnica))})
	}
	return avisos
}
