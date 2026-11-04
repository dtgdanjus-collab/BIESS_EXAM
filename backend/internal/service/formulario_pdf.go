package service

import (
	"fmt"
	"time"

	"github.com/go-pdf/fpdf"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

const (
	anchoHoja    = 170.0
	columnaHoja  = 82.0
	margenHoja   = 20.0
	limitePagina = 275.0
)

// El servidor corre en UTC; el formulario se firma en Ecuador.
var zonaEcuador = time.FixedZone("ECT", -5*60*60)

// hojaPDF escribe el formulario final con todo el texto ya traducido a la fuente del PDF.
type hojaPDF struct {
	pdf *fpdf.Fpdf
	tr  func(string) string
}

// FormularioPDF es el formulario final (1.10) listo para imprimir y firmar: el mismo contenido
// que la pantalla y el correo.
func FormularioPDF(f *domain.FormularioFinal) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	h := hojaPDF{pdf: pdf, tr: pdf.UnicodeTranslatorFromDescriptor("")}
	pdf.SetTitle("Formulario de postulación "+f.Codigo, true)
	pdf.SetMargins(margenHoja, 18, margenHoja)
	pdf.SetAutoPageBreak(true, 20)
	pdf.AliasNbPages("")
	pdf.SetFooterFunc(func() {
		pdf.SetY(-14)
		pdf.SetFont("Helvetica", "", 8)
		pdf.SetTextColor(110, 110, 110)
		pdf.CellFormat(anchoHoja/2, 5, h.tr("Directorio BIESS · "+f.Codigo), "", 0, "L", false, 0, "")
		pdf.CellFormat(anchoHoja/2, 5, h.tr(fmt.Sprintf("Página %d de {nb}", pdf.PageNo())), "", 0, "R", false, 0, "")
	})
	pdf.AddPage()

	h.encabezado(f)
	for _, s := range f.Secciones {
		h.titulo(s.Numeral + "  " + s.Titulo)
		h.campos(s.Campos)
		for _, r := range s.Registros {
			h.saltoSiFalta(18)
			pdf.Ln(1)
			pdf.SetFont("Helvetica", "B", 10)
			pdf.SetTextColor(17, 17, 17)
			pdf.CellFormat(0, 6, h.tr(r.Titulo), "", 1, "L", false, 0, "")
			h.campos(r.Campos)
		}
		if len(s.Campos) == 0 && len(s.Registros) == 0 {
			pdf.SetFont("Helvetica", "", 10)
			pdf.SetTextColor(110, 110, 110)
			pdf.CellFormat(0, 6, "Sin registros.", "", 1, "L", false, 0, "")
		}
	}
	// La firma no puede quedar sola en una hoja: va junto a lo que se firma.
	pdf.SetFont("Helvetica", "", 9.5)
	altoDeclaracion := 66.0
	for i, p := range f.Consentimiento {
		altoDeclaracion += float64(len(pdf.SplitLines([]byte(h.tr(fmt.Sprintf("%d. %s", i+1, p))), anchoHoja)))*4.8 + 1.5
	}
	h.saltoSiFalta(altoDeclaracion)
	h.titulo("Declaración y consentimiento")
	pdf.SetFont("Helvetica", "", 9.5)
	pdf.SetTextColor(17, 17, 17)
	for i, p := range f.Consentimiento {
		pdf.MultiCell(0, 4.8, h.tr(fmt.Sprintf("%d. %s", i+1, p)), "", "L", false)
		pdf.Ln(1.5)
	}
	h.firma(f)
	return salidaPDF(pdf)
}

func (h hojaPDF) encabezado(f *domain.FormularioFinal) {
	pdf := h.pdf
	// El sello de la B, igual que en el sistema.
	pdf.SetDrawColor(29, 95, 191)
	pdf.SetFillColor(255, 255, 255)
	pdf.SetLineWidth(0.9)
	pdf.Circle(margenHoja+6, 24, 5.5, "DF")
	pdf.SetFont("Helvetica", "B", 13)
	pdf.SetTextColor(29, 95, 191)
	pdf.SetXY(margenHoja, 20)
	pdf.CellFormat(12, 8, "B", "", 0, "C", false, 0, "")
	pdf.SetFont("Helvetica", "B", 11)
	pdf.SetTextColor(17, 17, 17)
	pdf.SetXY(margenHoja+15, 19)
	pdf.CellFormat(0, 5, "Directorio BIESS", "", 2, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(90, 90, 90)
	pdf.CellFormat(0, 5, h.tr("Concurso Público de Méritos y Oposición"), "", 1, "L", false, 0, "")

	pdf.SetY(36)
	pdf.SetFont("Helvetica", "B", 18)
	pdf.SetTextColor(17, 17, 17)
	pdf.CellFormat(0, 9, h.tr("Formulario de postulación"), "", 1, "L", false, 0, "")
	pdf.SetFont("Courier", "B", 13)
	pdf.CellFormat(0, 7, h.tr(f.Codigo), "", 1, "L", false, 0, "")
	estado := "BORRADOR: aún no se ha enviado"
	if f.Estado == domain.EstadoEnviada && f.FechaEnvio != nil {
		estado = "Recibida el " + f.FechaEnvio.In(zonaEcuador).Format("02/01/2006 a las 15:04")
	}
	pdf.SetFont("Helvetica", "", 10)
	pdf.SetTextColor(90, 90, 90)
	pdf.CellFormat(0, 6, h.tr(estado), "", 1, "L", false, 0, "")
	pdf.Ln(1)
}

func (h hojaPDF) titulo(texto string) {
	pdf := h.pdf
	h.saltoSiFalta(22)
	pdf.Ln(4)
	pdf.SetFont("Helvetica", "B", 12)
	pdf.SetTextColor(17, 17, 17)
	pdf.CellFormat(0, 7, h.tr(texto), "", 1, "L", false, 0, "")
	pdf.SetDrawColor(29, 95, 191)
	pdf.SetLineWidth(0.4)
	pdf.Line(margenHoja, pdf.GetY(), margenHoja+anchoHoja, pdf.GetY())
	pdf.Ln(2.5)
}

func (h hojaPDF) saltoSiFalta(alto float64) {
	if h.pdf.GetY()+alto > limitePagina {
		h.pdf.AddPage()
	}
}

// campos los reparte en dos columnas; lo que no cabe en una, como las preguntas, va a todo el ancho.
func (h hojaPDF) campos(lista []domain.CampoFormulario) {
	largo := func(c domain.CampoFormulario) bool { return len(c.Etiqueta) > 44 || len(c.Valor) > 48 }
	for i := 0; i < len(lista); i++ {
		if largo(lista[i]) || i+1 == len(lista) || largo(lista[i+1]) {
			h.fila(anchoHoja, lista[i])
			continue
		}
		h.fila(columnaHoja, lista[i], lista[i+1])
		i++
	}
}

func (h hojaPDF) fila(ancho float64, campos ...domain.CampoFormulario) {
	pdf := h.pdf
	alto := 0.0
	for _, c := range campos {
		pdf.SetFont("Helvetica", "", 8)
		a := float64(len(pdf.SplitLines([]byte(h.tr(c.Etiqueta)), ancho))) * 3.8
		pdf.SetFont("Helvetica", "", 10)
		a += float64(len(pdf.SplitLines([]byte(h.tr(valorCampo(c))), ancho))) * 5
		if a > alto {
			alto = a
		}
	}
	h.saltoSiFalta(alto + 2)
	y := pdf.GetY()
	for i, c := range campos {
		x := margenHoja + float64(i)*(anchoHoja-columnaHoja)
		pdf.SetXY(x, y)
		pdf.SetFont("Helvetica", "", 8)
		pdf.SetTextColor(100, 100, 100)
		pdf.MultiCell(ancho, 3.8, h.tr(c.Etiqueta), "", "L", false)
		pdf.SetX(x)
		pdf.SetFont("Helvetica", "", 10)
		pdf.SetTextColor(17, 17, 17)
		pdf.MultiCell(ancho, 5, h.tr(valorCampo(c)), "", "L", false)
	}
	pdf.SetXY(margenHoja, y+alto+2)
}

func valorCampo(c domain.CampoFormulario) string {
	if c.Valor == "" {
		return "—"
	}
	return c.Valor
}

func (h hojaPDF) firma(f *domain.FormularioFinal) {
	pdf := h.pdf
	h.saltoSiFalta(44)
	pdf.Ln(24)
	y := pdf.GetY()
	pdf.SetDrawColor(17, 17, 17)
	pdf.SetLineWidth(0.3)
	pdf.Line(margenHoja, y, margenHoja+80, y)
	pdf.Ln(1.5)
	pdf.SetFont("Helvetica", "B", 10)
	pdf.SetTextColor(17, 17, 17)
	pdf.CellFormat(0, 5, "Firma del postulante", "", 1, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 10)
	pdf.CellFormat(0, 5, h.tr(f.FirmaNombres), "", 1, "L", false, 0, "")
	pdf.CellFormat(0, 5, h.tr("Cédula: "+f.FirmaCedula), "", 1, "L", false, 0, "")
}

// nombreFormularioPDF es el nombre del archivo en la descarga y en el adjunto del correo.
func nombreFormularioPDF(codigo string) string {
	return "Formulario-" + codigo + ".pdf"
}
