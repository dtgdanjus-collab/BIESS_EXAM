package service

import (
	"embed"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/go-pdf/fpdf"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

const (
	anchoHoja    = 174.0
	margenHoja   = 18.0
	separacion   = 8.0
	altoBanda    = 62.0
	limitePagina = 276.0
	// Más alto que esto no cabe en una hoja: el registro se escribe sin panel y se deja partir.
	altoMaximoPanel = 215.0
)

type colorPDF [3]int

var (
	colorSello  = colorPDF{29, 95, 191}
	colorNoche  = colorPDF{10, 10, 10}
	colorTinta  = colorPDF{17, 17, 17}
	colorTenue  = colorPDF{98, 102, 110}
	colorFondo  = colorPDF{243, 244, 247}
	colorRegla  = colorPDF{222, 224, 229}
	colorBlanco = colorPDF{255, 255, 255}
)

// Las mismas letras que el sistema (Geist, licencia OFL), solo con los caracteres latinos.
//
//go:embed fuentes/*.ttf
var fuentesPDF embed.FS

// El servidor corre en UTC; el formulario se firma en Ecuador.
var zonaEcuador = time.FixedZone("ECT", -5*60*60)

// hojaPDF escribe el formulario final con la identidad del sistema: la banda y el disco del acceso,
// el sello de recepción y los numerales negros de cada folio.
type hojaPDF struct {
	pdf *fpdf.Fpdf
}

// FormularioPDF es el formulario final (1.10) listo para imprimir y firmar: el mismo contenido
// que la pantalla y el correo.
func FormularioPDF(f *domain.FormularioFinal) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	for _, fuente := range []struct{ familia, archivo string }{
		{"Geist", "Geist-Regular"}, {"GeistM", "Geist-Medium"}, {"GeistB", "Geist-Bold"}, {"Mono", "GeistMono-Medium"},
	} {
		datos, err := fuentesPDF.ReadFile("fuentes/" + fuente.archivo + ".ttf")
		if err != nil {
			return nil, fmt.Errorf("leyendo la fuente del PDF: %w", err)
		}
		pdf.AddUTF8FontFromBytes(fuente.familia, "", datos)
	}
	h := hojaPDF{pdf: pdf}
	pdf.SetTitle("Formulario de postulación "+f.Codigo, true)
	pdf.SetAuthor("Directorio BIESS", true)
	pdf.SetMargins(margenHoja, 22, margenHoja)
	pdf.SetCellMargin(0)
	pdf.SetAutoPageBreak(true, 18)
	pdf.AliasNbPages("")
	pdf.SetHeaderFuncMode(func() {
		if pdf.PageNo() > 1 {
			h.encabezadoCorto(f.Codigo)
		}
	}, false)
	pdf.SetFooterFunc(func() { h.pie(f.Codigo) })
	pdf.AddPage()

	h.portada(f)
	for _, s := range f.Secciones {
		h.tituloSeccion(s.Numeral, s.Titulo)
		h.campos(margenHoja, anchoHoja, s.Campos)
		for _, r := range s.Registros {
			h.registro(r)
		}
		if len(s.Campos) == 0 && len(s.Registros) == 0 {
			h.fuente("Geist", 10, colorTenue)
			pdf.CellFormat(0, 6, "Sin registros.", "", 1, "L", false, 0, "")
		}
	}
	h.declaracion(f)
	if err := pdf.Error(); err != nil {
		return nil, fmt.Errorf("generando PDF: %w", err)
	}
	return salidaPDF(pdf)
}

func (h hojaPDF) fuente(familia string, tam float64, c colorPDF) {
	h.pdf.SetFont(familia, "", tam)
	h.pdf.SetTextColor(c[0], c[1], c[2])
}

func (h hojaPDF) relleno(c colorPDF) { h.pdf.SetFillColor(c[0], c[1], c[2]) }

func (h hojaPDF) trazo(c colorPDF, grosor float64) {
	h.pdf.SetDrawColor(c[0], c[1], c[2])
	h.pdf.SetLineWidth(grosor)
}

func (h hojaPDF) saltoSiFalta(alto float64) {
	if h.pdf.GetY()+alto > limitePagina {
		h.pdf.AddPage()
	}
}

// lineas cuenta cuántas líneas ocupa el texto con la fuente indicada.
func (h hojaPDF) lineas(familia string, tam float64, texto string, ancho float64) float64 {
	h.pdf.SetFont(familia, "", tam)
	return float64(len(h.pdf.SplitText(texto, ancho)))
}

// monograma es el sello de la B.
func (h hojaPDF) monograma(cx, cy, r float64) {
	h.relleno(colorBlanco)
	h.trazo(colorSello, r*0.16)
	h.pdf.Circle(cx, cy, r, "DF")
	h.fuente("GeistB", r*2.7, colorSello)
	h.pdf.Text(cx-h.pdf.GetStringWidth("B")/2, cy+r*0.46, "B")
}

func (h hojaPDF) portada(f *domain.FormularioFinal) {
	pdf := h.pdf
	enviada := f.Estado == domain.EstadoEnviada && f.FechaEnvio != nil

	// La banda azul con el disco negro del acceso de postulantes.
	h.relleno(colorSello)
	pdf.Rect(0, 0, 210, altoBanda, "F")
	pdf.ClipRect(0, 0, 210, altoBanda, false)
	h.relleno(colorNoche)
	pdf.Circle(180, 46, 46, "F")
	pdf.ClipEnd()

	h.monograma(margenHoja+5.5, 16, 5.5)
	h.fuente("GeistM", 11, colorBlanco)
	pdf.Text(margenHoja+14.5, 15, "Directorio BIESS")
	h.fuente("Geist", 8.5, colorBlanco)
	pdf.Text(margenHoja+14.5, 19.5, "Concurso Público de Méritos y Oposición")

	h.fuente("GeistM", 24, colorBlanco)
	pdf.Text(margenHoja, 37, "Formulario de postulación")
	h.fuente("Mono", 13, colorBlanco)
	pdf.Text(margenHoja, 46, f.Codigo)
	estado := "Borrador: aún no se ha enviado"
	if enviada {
		estado = "Recibida el " + f.FechaEnvio.In(zonaEcuador).Format("02/01/2006 a las 15:04")
	}
	h.fuente("Geist", 10, colorBlanco)
	pdf.Text(margenHoja, 53, estado)

	h.selloRecepcion(f, enviada)

	// Quién firma, a la vista antes del detalle.
	h.relleno(colorFondo)
	pdf.RoundedRect(margenHoja, altoBanda+6, anchoHoja, 16, 2, "1234", "F")
	dato := func(x, ancho float64, etiqueta, valor string) {
		h.fuente("Geist", 7.5, colorTenue)
		pdf.Text(x, altoBanda+11.5, etiqueta)
		h.fuente("GeistM", 10.5, colorTinta)
		for pdf.GetStringWidth(valor) > ancho && len(valor) > 1 {
			valor = strings.TrimSpace(string([]rune(valor)[:len([]rune(valor))-1]))
		}
		pdf.Text(x, altoBanda+17.5, valor)
	}
	situacion := "Borrador"
	if enviada {
		situacion = "Enviada"
	}
	dato(margenHoja+5, 100, "Postulante", f.FirmaNombres)
	dato(margenHoja+110, 30, "Cédula", f.FirmaCedula)
	dato(margenHoja+145, 25, "Estado", situacion)
	pdf.SetXY(margenHoja, altoBanda+24)
}

// selloRecepcion es el mismo sello del comprobante en pantalla, con el texto en anillo.
func (h hojaPDF) selloRecepcion(f *domain.FormularioFinal, enviada bool) {
	pdf := h.pdf
	const cx, cy = 180.0, 33.0
	h.trazo(colorBlanco, 0.8)
	pdf.Circle(cx, cy, 21, "D")
	h.trazo(colorBlanco, 0.25)
	pdf.Circle(cx, cy, 16.2, "D")
	h.fuente("GeistM", 5.8, colorBlanco)
	h.textoEnAnillo(cx, cy, 17.4, "DIRECTORIO BIESS · CONCURSO PÚBLICO · RESOLUCIÓN C.D. 701 · ")

	titulo, detalle := "BORRADOR", "sin enviar"
	if enviada {
		titulo, detalle = "RECIBIDA", f.FechaEnvio.In(zonaEcuador).Format("02/01/2006")
	}
	pdf.TransformBegin()
	pdf.TransformRotate(9, cx, cy)
	h.fuente("GeistB", 9.5, colorBlanco)
	pdf.Text(cx-pdf.GetStringWidth(titulo)/2, cy, titulo)
	h.fuente("Geist", 7.5, colorBlanco)
	pdf.Text(cx-pdf.GetStringWidth(detalle)/2, cy+4.5, detalle)
	pdf.TransformEnd()
}

func (h hojaPDF) textoEnAnillo(cx, cy, r float64, texto string) {
	pdf := h.pdf
	total := 0.0
	for _, letra := range texto {
		total += pdf.GetStringWidth(string(letra))
	}
	// El texto da la vuelta completa, con las letras repartidas por igual.
	extra := (2*math.Pi*r - total) / float64(len([]rune(texto)))
	angulo := 0.0
	for _, letra := range texto {
		s := string(letra)
		ancho := pdf.GetStringWidth(s)
		paso := (ancho + extra) / r * 180 / math.Pi
		pdf.TransformBegin()
		pdf.TransformRotate(-(angulo + paso/2), cx, cy)
		pdf.Text(cx-ancho/2, cy-r, s)
		pdf.TransformEnd()
		angulo += paso
	}
}

func (h hojaPDF) encabezadoCorto(codigo string) {
	pdf := h.pdf
	h.relleno(colorSello)
	pdf.Rect(0, 0, 210, 3, "F")
	h.monograma(margenHoja+2.6, 10.5, 2.6)
	h.fuente("GeistM", 8.5, colorTinta)
	pdf.Text(margenHoja+7.5, 11.6, "Formulario de postulación")
	h.fuente("Mono", 8.5, colorTenue)
	pdf.Text(margenHoja+anchoHoja-pdf.GetStringWidth(codigo), 11.6, codigo)
	pdf.SetXY(margenHoja, 18)
}

func (h hojaPDF) pie(codigo string) {
	pdf := h.pdf
	h.trazo(colorRegla, 0.25)
	pdf.Line(margenHoja, 283, margenHoja+anchoHoja, 283)
	h.fuente("Geist", 7.5, colorTenue)
	pdf.SetXY(margenHoja, 284.5)
	pdf.CellFormat(anchoHoja/2, 4, "Directorio BIESS · "+codigo, "", 0, "L", false, 0, "")
	pdf.CellFormat(anchoHoja/2, 4, fmt.Sprintf("Página %d de {nb}", pdf.PageNo()), "", 0, "R", false, 0, "")
}

// tituloSeccion lleva el numeral en negro, como los folios del expediente.
func (h hojaPDF) tituloSeccion(numeral, titulo string) {
	pdf := h.pdf
	h.saltoSiFalta(26)
	pdf.Ln(6)
	y := pdf.GetY()
	x := margenHoja
	if numeral != "" {
		h.relleno(colorNoche)
		pdf.Rect(margenHoja, y, 11, 7, "F")
		h.fuente("GeistM", 8.5, colorBlanco)
		pdf.SetXY(margenHoja, y)
		pdf.CellFormat(11, 7, numeral, "", 0, "C", false, 0, "")
		x += 14
	}
	h.fuente("GeistM", 12.5, colorTinta)
	pdf.SetXY(x, y)
	pdf.CellFormat(0, 7, titulo, "", 1, "L", false, 0, "")
	h.trazo(colorRegla, 0.3)
	pdf.Line(margenHoja, y+9, margenHoja+anchoHoja, y+9)
	pdf.SetXY(margenHoja, y+12)
}

// registro es un título, una experiencia o un familiar, sobre su panel.
func (h hojaPDF) registro(r domain.RegistroFormulario) {
	pdf := h.pdf
	const relleno = 4.0
	interior := anchoHoja - 2*relleno
	alto := h.altoCampos(interior, r.Campos) + 8 + 2*relleno
	if alto > altoMaximoPanel {
		h.fuente("GeistM", 10.5, colorTinta)
		pdf.CellFormat(0, 7, r.Titulo, "", 1, "L", false, 0, "")
		h.campos(margenHoja, anchoHoja, r.Campos)
		return
	}
	h.saltoSiFalta(alto + 3)
	y := pdf.GetY() + 1
	h.relleno(colorFondo)
	pdf.RoundedRect(margenHoja, y, anchoHoja, alto, 2, "1234", "F")
	h.fuente("GeistM", 10.5, colorTinta)
	pdf.SetXY(margenHoja+relleno, y+relleno)
	pdf.CellFormat(interior, 6, r.Titulo, "", 1, "L", false, 0, "")
	pdf.SetXY(margenHoja+relleno, y+relleno+8)
	h.campos(margenHoja+relleno, interior, r.Campos)
	pdf.SetXY(margenHoja, y+alto+3)
}

func esPregunta(c domain.CampoFormulario) bool {
	return (c.Valor == "Sí" || c.Valor == "No") && len(c.Etiqueta) > 30
}

// filasDeCampos reparte en dos columnas; lo largo va a todo el ancho y cada pregunta en su fila.
func filasDeCampos(lista []domain.CampoFormulario) [][]domain.CampoFormulario {
	largo := func(c domain.CampoFormulario) bool { return esPregunta(c) || len(c.Etiqueta) > 44 || len(c.Valor) > 44 }
	var filas [][]domain.CampoFormulario
	for i := 0; i < len(lista); i++ {
		if largo(lista[i]) || i+1 == len(lista) || largo(lista[i+1]) {
			filas = append(filas, lista[i:i+1])
			continue
		}
		filas = append(filas, lista[i:i+2])
		i++
	}
	return filas
}

func valorCampo(c domain.CampoFormulario) string {
	if c.Valor == "" {
		return "—"
	}
	return c.Valor
}

const (
	altoEtiqueta   = 3.6
	altoValor      = 4.9
	anchoRespuesta = 12.0
)

func (h hojaPDF) altoFila(ancho float64, fila []domain.CampoFormulario) float64 {
	if esPregunta(fila[0]) {
		return math.Max(h.lineas("Geist", 9, fila[0].Etiqueta, ancho-anchoRespuesta-6)*4.3, 6) + 3.5
	}
	columna := ancho
	if len(fila) == 2 {
		columna = (ancho - separacion) / 2
	}
	alto := 0.0
	for _, c := range fila {
		a := h.lineas("Geist", 7.5, c.Etiqueta, columna)*altoEtiqueta + h.lineas("Geist", 10, valorCampo(c), columna)*altoValor
		alto = math.Max(alto, a)
	}
	return alto + 2.6
}

func (h hojaPDF) altoCampos(ancho float64, lista []domain.CampoFormulario) float64 {
	alto := 0.0
	for _, fila := range filasDeCampos(lista) {
		alto += h.altoFila(ancho, fila)
	}
	return alto
}

func (h hojaPDF) campos(x, ancho float64, lista []domain.CampoFormulario) {
	pdf := h.pdf
	for _, fila := range filasDeCampos(lista) {
		alto := h.altoFila(ancho, fila)
		if alto < altoMaximoPanel {
			h.saltoSiFalta(alto)
		}
		y := pdf.GetY()
		if esPregunta(fila[0]) {
			h.pregunta(x, y, ancho, alto, fila[0])
			continue
		}
		columna := ancho
		if len(fila) == 2 {
			columna = (ancho - separacion) / 2
		}
		fin := y + alto
		for i, c := range fila {
			cx := x + float64(i)*(columna+separacion)
			pdf.SetXY(cx, y)
			h.fuente("Geist", 7.5, colorTenue)
			pdf.MultiCell(columna, altoEtiqueta, c.Etiqueta, "", "L", false)
			pdf.SetX(cx)
			h.fuente("Geist", 10, colorTinta)
			pdf.MultiCell(columna, altoValor, valorCampo(c), "", "L", false)
			// Un texto muy largo puede haber pasado de hoja.
			if pdf.GetY()+2.6 > fin || pdf.GetY() < y {
				fin = pdf.GetY() + 2.6
			}
		}
		pdf.SetXY(x, fin)
	}
}

// pregunta deja la respuesta en una ficha a la derecha, para leer las inhabilidades de un vistazo.
func (h hojaPDF) pregunta(x, y, ancho, alto float64, c domain.CampoFormulario) {
	pdf := h.pdf
	pdf.SetXY(x, y)
	h.fuente("Geist", 9, colorTinta)
	pdf.MultiCell(ancho-anchoRespuesta-6, 4.3, c.Etiqueta, "", "L", false)
	fondo, texto := colorRegla, colorTinta
	if c.Valor == "Sí" {
		fondo, texto = colorSello, colorBlanco
	}
	h.relleno(fondo)
	pdf.RoundedRect(x+ancho-anchoRespuesta, y, anchoRespuesta, 5.6, 1.4, "1234", "F")
	h.fuente("GeistM", 8.5, texto)
	pdf.SetXY(x+ancho-anchoRespuesta, y)
	pdf.CellFormat(anchoRespuesta, 5.6, c.Valor, "", 0, "C", false, 0, "")
	h.trazo(colorRegla, 0.15)
	pdf.Line(x, y+alto-1.2, x+ancho, y+alto-1.2)
	pdf.SetXY(x, y+alto)
}

// declaracion mantiene juntas la declaración y la firma: esta no puede quedar sola en una hoja.
func (h hojaPDF) declaracion(f *domain.FormularioFinal) {
	pdf := h.pdf
	const sangria, altoFirma = 7.0, 36.0
	alto := 26 + altoFirma + 8
	for _, p := range f.Consentimiento {
		alto += h.lineas("Geist", 9.5, p, anchoHoja-sangria)*4.7 + 2
	}
	h.saltoSiFalta(alto)
	h.tituloSeccion("", "Declaración y consentimiento")
	for i, p := range f.Consentimiento {
		y := pdf.GetY()
		h.fuente("GeistM", 9.5, colorSello)
		pdf.Text(margenHoja, y+3.4, fmt.Sprintf("%d", i+1))
		h.fuente("Geist", 9.5, colorTinta)
		pdf.SetXY(margenHoja+sangria, y)
		pdf.MultiCell(anchoHoja-sangria, 4.7, p, "", "L", false)
		pdf.SetXY(margenHoja, pdf.GetY()+2)
	}

	pdf.Ln(6)
	y := pdf.GetY()
	h.trazo(colorRegla, 0.3)
	pdf.RoundedRect(margenHoja, y, anchoHoja, altoFirma, 2, "1234", "D")
	h.trazo(colorTinta, 0.3)
	pdf.Line(margenHoja+6, y+20, margenHoja+92, y+20)
	h.fuente("GeistM", 10, colorTinta)
	pdf.Text(margenHoja+6, y+25, "Firma del postulante")
	h.fuente("Geist", 9.5, colorTinta)
	pdf.Text(margenHoja+6, y+29.5, f.FirmaNombres)
	h.fuente("Geist", 9.5, colorTenue)
	pdf.Text(margenHoja+100, y+25, "Cédula")
	h.fuente("Mono", 10, colorTinta)
	pdf.Text(margenHoja+100, y+29.5, f.FirmaCedula)
}

// nombreFormularioPDF es el nombre del archivo en la descarga y en el adjunto del correo.
func nombreFormularioPDF(codigo string) string {
	return "Formulario-" + codigo + ".pdf"
}
