package service

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

func formularioDePrueba() *domain.FormularioFinal {
	enviada := time.Date(2026, 11, 4, 3, 32, 0, 0, time.UTC)
	campos := []domain.CampoFormulario{
		{Etiqueta: "Nombres", Valor: "José Ñandú"},
		{Etiqueta: "Apellidos", Valor: ""},
		{Etiqueta: strings.Repeat("¿Pregunta larga sobre inhabilidades? ", 6), Valor: "No"},
	}
	f := &domain.FormularioFinal{Codigo: "BIESS-2026-000001", Estado: domain.EstadoEnviada, FechaEnvio: &enviada,
		Consentimiento: Consentimiento, FirmaNombres: "José Ñandú", FirmaCedula: "0102345675"}
	for i := 0; i < 12; i++ {
		f.Secciones = append(f.Secciones, domain.SeccionFormulario{Numeral: "1.1", Titulo: "Sección", Campos: campos,
			Registros: []domain.RegistroFormulario{{Titulo: "Registro", Campos: campos}}})
	}
	f.Secciones = append(f.Secciones, domain.SeccionFormulario{Numeral: "1.8", Titulo: "Capacitación"})
	return f
}

func TestFormularioPDF(t *testing.T) {
	pdf, err := FormularioPDF(formularioDePrueba())
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.HasPrefix(pdf, []byte("%PDF")) {
		t.Fatalf("no es un PDF: %q", pdf[:8])
	}
	if !bytes.Contains(pdf, []byte("/Count ")) || bytes.Contains(pdf, []byte("/Count 1\n")) {
		t.Fatal("un formulario largo debe ocupar varias páginas")
	}
}

func TestMensajeFormularioAdjuntaElPDF(t *testing.T) {
	m, err := mensajeFormulario(formularioDePrueba(), []string{"ana@correo.com", "ana2@correo.com"})
	if err != nil {
		t.Fatal(err)
	}
	if m.Para != "ana@correo.com" || len(m.Copias) != 1 || m.Copias[0] != "ana2@correo.com" || !strings.Contains(m.HTML, "BIESS-2026-000001") {
		t.Fatalf("mensaje: %+v", m.Para)
	}
	if len(m.Adjuntos) != 1 || m.Adjuntos[0].Nombre != "Formulario-BIESS-2026-000001.pdf" || !bytes.HasPrefix(m.Adjuntos[0].Contenido, []byte("%PDF")) {
		t.Fatal("el correo debe llevar el formulario en PDF")
	}
}

func TestDestinatariosFormulario(t *testing.T) {
	segundo := "ANA@correo.com"
	p := &domain.Postulacion{Contacto: &domain.Contacto{Correo1: "otro@correo.com", Correo2: &segundo}}
	got := destinatariosFormulario("ana@correo.com", p)
	if len(got) != 2 || got[0] != "ana@correo.com" || got[1] != "otro@correo.com" {
		t.Fatalf("destinatarios: %v", got)
	}
	if got := destinatariosFormulario("ana@correo.com", &domain.Postulacion{}); len(got) != 1 {
		t.Fatalf("sin contacto: %v", got)
	}
}

func TestReservarReenvio(t *testing.T) {
	s := &PostulacionService{}
	ahora := time.Now()
	if !s.reservarReenvio(1, ahora) {
		t.Fatal("el primer reenvío debe pasar")
	}
	if s.reservarReenvio(1, ahora.Add(30*time.Second)) {
		t.Fatal("no debe reenviar dos veces en un minuto")
	}
	if !s.reservarReenvio(2, ahora) {
		t.Fatal("la espera es por postulante")
	}
	if !s.reservarReenvio(1, ahora.Add(esperaReenvio)) {
		t.Fatal("pasado el minuto debe volver a pasar")
	}
}
