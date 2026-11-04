package service

import (
	"bytes"
	"fmt"
	"strconv"

	"github.com/go-pdf/fpdf"
	"github.com/xuri/excelize/v2"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

// FilaMatriz es un postulante en el cuadro comparativo (EF-13.3).
type FilaMatriz struct {
	domain.Postulante
	Titulos        int
	Experiencia    domain.ExperienciaTotal
	Publicaciones  int
	Capacitaciones int
	Horas          int
	Organizacion   string
}

var encabezadoMatriz = []string{"Código", "Cédula", "Apellidos y nombres", "Cargo", "Estado", "Estado en el concurso", "Correo",
	"Organización", "Títulos", "Exp. general", "Exp. dirección", "Exp. total", "Publicaciones", "Capacitaciones", "Horas",
	"Posible inhabilidad", "Puntaje méritos", "Nota teórica", "Nota psicotécnica"}

func textoNota(n *float64) string {
	if n == nil {
		return ""
	}
	return strconv.FormatFloat(*n, 'f', 2, 64)
}

func duracionCorta(d domain.Duracion) string {
	return fmt.Sprintf("%da %dm %dd", d.Anios, d.Meses, d.Dias)
}

func (f FilaMatriz) celdas() []string {
	inhabilidad := "No"
	if f.PosibleInhabilidad {
		inhabilidad = "Sí"
	}
	return []string{f.Codigo, f.Cedula, f.Apellidos + " " + f.Nombres, deref(f.Cargo), f.Estado, f.EstadoConcurso, f.Email, f.Organizacion,
		strconv.Itoa(f.Titulos), duracionCorta(f.Experiencia.General), duracionCorta(f.Experiencia.Direccion), duracionCorta(f.Experiencia.Total),
		strconv.Itoa(f.Publicaciones), strconv.Itoa(f.Capacitaciones), strconv.Itoa(f.Horas), inhabilidad,
		textoNota(f.PuntajeMeritos), textoNota(f.NotaTeorica), textoNota(f.NotaPsicotecnica)}
}

// MatrizXLSX exporta el cuadro comparativo a Excel.
func MatrizXLSX(filas []FilaMatriz) ([]byte, error) {
	x := excelize.NewFile()
	defer x.Close()
	const hoja = "Postulantes"
	if err := x.SetSheetName(x.GetSheetName(0), hoja); err != nil {
		return nil, fmt.Errorf("creando hoja: %w", err)
	}
	negrita, err := x.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"111111"}, Pattern: 1}})
	if err != nil {
		return nil, fmt.Errorf("creando estilo: %w", err)
	}
	escribir := func(fila int, valores []string) error {
		celda, err := excelize.CoordinatesToCellName(1, fila)
		if err != nil {
			return err
		}
		return x.SetSheetRow(hoja, celda, &valores)
	}
	if err := escribir(1, encabezadoMatriz); err != nil {
		return nil, fmt.Errorf("escribiendo encabezado: %w", err)
	}
	fin, _ := excelize.CoordinatesToCellName(len(encabezadoMatriz), 1)
	if err := x.SetCellStyle(hoja, "A1", fin, negrita); err != nil {
		return nil, fmt.Errorf("aplicando estilo: %w", err)
	}
	for i, f := range filas {
		if err := escribir(i+2, f.celdas()); err != nil {
			return nil, fmt.Errorf("escribiendo fila: %w", err)
		}
	}
	col, _ := excelize.ColumnNumberToName(len(encabezadoMatriz))
	if err := x.SetColWidth(hoja, "A", col, 20); err != nil {
		return nil, fmt.Errorf("ajustando columnas: %w", err)
	}
	b, err := x.WriteToBuffer()
	if err != nil {
		return nil, fmt.Errorf("generando Excel: %w", err)
	}
	return b.Bytes(), nil
}

// MatrizPDF exporta el cuadro comparativo a PDF, con las columnas que caben en horizontal.
func MatrizPDF(filas []FilaMatriz) ([]byte, error) {
	pdf := fpdf.New("L", "mm", "A4", "")
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	pdf.SetMargins(10, 10, 10)
	pdf.SetAutoPageBreak(true, 10)
	pdf.AddPage()
	pdf.SetFont("Helvetica", "B", 13)
	pdf.CellFormat(0, 8, tr("Cuadro comparativo de postulantes - Directorio del BIESS"), "", 1, "L", false, 0, "")

	columnas := []struct {
		titulo string
		ancho  float64
		valor  func(FilaMatriz) string
	}{
		{"Código", 34, func(f FilaMatriz) string { return f.Codigo }},
		{"Cédula", 22, func(f FilaMatriz) string { return f.Cedula }},
		{"Apellidos y nombres", 62, func(f FilaMatriz) string { return f.Apellidos + " " + f.Nombres }},
		{"Sector", 24, func(f FilaMatriz) string { return deref(f.SectorCodigo) }},
		{"Títulos", 13, func(f FilaMatriz) string { return strconv.Itoa(f.Titulos) }},
		{"Exp. total", 22, func(f FilaMatriz) string { return duracionCorta(f.Experiencia.Total) }},
		{"Public.", 13, func(f FilaMatriz) string { return strconv.Itoa(f.Publicaciones) }},
		{"Horas", 12, func(f FilaMatriz) string { return strconv.Itoa(f.Horas) }},
		{"Inhab.", 12, func(f FilaMatriz) string {
			if f.PosibleInhabilidad {
				return "Sí"
			}
			return "No"
		}},
		{"Méritos", 15, func(f FilaMatriz) string { return textoNota(f.PuntajeMeritos) }},
		{"Teórica", 15, func(f FilaMatriz) string { return textoNota(f.NotaTeorica) }},
		{"Psicot.", 15, func(f FilaMatriz) string { return textoNota(f.NotaPsicotecnica) }},
	}
	encabezado := func() {
		pdf.SetFont("Helvetica", "B", 8)
		pdf.SetFillColor(17, 17, 17)
		pdf.SetTextColor(255, 255, 255)
		for _, c := range columnas {
			pdf.CellFormat(c.ancho, 7, tr(c.titulo), "1", 0, "L", true, 0, "")
		}
		pdf.Ln(-1)
		pdf.SetFont("Helvetica", "", 8)
		pdf.SetTextColor(0, 0, 0)
	}
	pdf.SetHeaderFuncMode(func() {
		if pdf.PageNo() > 1 {
			encabezado()
		}
	}, false)
	encabezado()
	for _, f := range filas {
		for _, c := range columnas {
			texto := tr(c.valor(f))
			for pdf.GetStringWidth(texto) > c.ancho-2 && len(texto) > 1 {
				texto = texto[:len(texto)-1]
			}
			pdf.CellFormat(c.ancho, 6, texto, "1", 0, "L", false, 0, "")
		}
		pdf.Ln(-1)
	}
	if len(filas) == 0 {
		pdf.CellFormat(0, 8, tr("No hay postulantes con este filtro."), "", 1, "L", false, 0, "")
	}
	return salidaPDF(pdf)
}

// ReporteEvaluacionPDF es el reporte del examen de un postulante (1.4 de EF-14).
func ReporteEvaluacionPDF(r domain.ResultadoEvaluacion) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	pdf.SetMargins(20, 20, 20)
	pdf.AddPage()
	pdf.SetFont("Helvetica", "B", 15)
	pdf.CellFormat(0, 9, tr("Reporte de la evaluación técnica"), "", 1, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 10)
	pdf.CellFormat(0, 6, tr("Concurso Público de Méritos y Oposición · Directorio del BIESS"), "", 1, "L", false, 0, "")
	pdf.Ln(6)
	correctas, nota := 0, ""
	if r.Correctas != nil {
		correctas = *r.Correctas
	}
	if r.Nota != nil {
		nota = textoNota(r.Nota)
	}
	cierre := "El postulante finalizó la evaluación"
	if r.Forzado {
		cierre = "Se cerró al terminar el tiempo"
	}
	finalizada := ""
	if r.FinalizadoEn != nil {
		finalizada = r.FinalizadoEn.Local().Format("02/01/2006 15:04:05")
	}
	for _, fila := range [][2]string{
		{"Código", r.Codigo}, {"Postulante", r.Apellidos + " " + r.Nombres}, {"Cédula", r.Cedula}, {"Cargo", deref(r.Cargo)},
		{"Inicio", r.IniciadoEn.Local().Format("02/01/2006 15:04:05")}, {"Fin", finalizada}, {"Cierre", cierre},
		{"Respuestas correctas", fmt.Sprintf("%d de %d", correctas, r.Total)},
	} {
		pdf.SetFont("Helvetica", "B", 10)
		pdf.CellFormat(50, 7, tr(fila[0]), "B", 0, "L", false, 0, "")
		pdf.SetFont("Helvetica", "", 10)
		pdf.MultiCell(0, 7, tr(fila[1]), "B", "L", false)
	}
	pdf.Ln(8)
	pdf.SetFont("Helvetica", "B", 22)
	pdf.CellFormat(0, 12, tr("Calificación: "+nota+" / 100"), "", 1, "L", false, 0, "")
	return salidaPDF(pdf)
}

func salidaPDF(pdf *fpdf.Fpdf) ([]byte, error) {
	var b bytes.Buffer
	if err := pdf.Output(&b); err != nil {
		return nil, fmt.Errorf("generando PDF: %w", err)
	}
	return b.Bytes(), nil
}
