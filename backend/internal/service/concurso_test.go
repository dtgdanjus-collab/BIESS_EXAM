package service

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

func TestFaseVigente(t *testing.T) {
	ahora := time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)
	antes, despues := ahora.Add(-time.Hour), ahora.Add(time.Hour)
	casos := []struct {
		nombre      string
		inicio, fin *time.Time
		esperado    bool
	}{
		{"sin fechas", nil, nil, true},
		{"dentro", &antes, &despues, true},
		{"aún no empieza", &despues, nil, false},
		{"ya terminó", nil, &antes, false},
		{"justo al inicio", &ahora, nil, true},
		{"justo al final", nil, &ahora, true},
	}
	for _, c := range casos {
		if got := (domain.Fase{FechaInicio: c.inicio, FechaFin: c.fin}).Vigente(ahora); got != c.esperado {
			t.Errorf("%s: Vigente = %v, se esperaba %v", c.nombre, got, c.esperado)
		}
	}
}

func TestValidarPregunta(t *testing.T) {
	casos := []struct {
		nombre string
		p      domain.PreguntaEvaluacion
		campo  string
	}{
		{"correcta", domain.PreguntaEvaluacion{Enunciado: "¿2+2?", Opciones: []string{"3", "4"}, Correcta: 1}, ""},
		{"sin enunciado", domain.PreguntaEvaluacion{Opciones: []string{"3", "4"}}, "enunciado"},
		{"una sola opción", domain.PreguntaEvaluacion{Enunciado: "x", Opciones: []string{"3", "  "}}, "opciones"},
		{"correcta fuera de rango", domain.PreguntaEvaluacion{Enunciado: "x", Opciones: []string{"3", "4"}, Correcta: 2}, "correcta"},
		{"correcta negativa", domain.PreguntaEvaluacion{Enunciado: "x", Opciones: []string{"3", "4"}, Correcta: -1}, "correcta"},
	}
	for _, c := range casos {
		errs := campos{}
		validarPregunta(errs, "", &c.p)
		if c.campo == "" && len(errs) != 0 {
			t.Errorf("%s: no debía fallar: %v", c.nombre, errs)
		}
		if c.campo != "" && errs[c.campo] == "" {
			t.Errorf("%s: debía marcar %q, marcó %v", c.nombre, c.campo, errs)
		}
	}
}

func TestReportes(t *testing.T) {
	nota, correctas := 87.5, 7
	fin := time.Now()
	cargo := "Sector de Afiliados"
	filas := []FilaMatriz{{Postulante: domain.Postulante{Codigo: "BIESS-2026-000001", Cedula: "0102345675", Nombres: "María José", Apellidos: "Ñáñez Ortíz", Cargo: &cargo, NotaTeorica: &nota}}}

	x, err := MatrizXLSX(filas)
	if err != nil || !bytes.HasPrefix(x, []byte("PK")) {
		t.Fatalf("el Excel no se generó: %v", err)
	}
	for _, datos := range [][]FilaMatriz{filas, nil} {
		p, err := MatrizPDF(datos)
		if err != nil || !bytes.HasPrefix(p, []byte("%PDF-")) {
			t.Fatalf("el PDF de la matriz no se generó: %v", err)
		}
	}
	p, err := ReporteEvaluacionPDF(domain.ResultadoEvaluacion{Codigo: "BIESS-2026-000001", Nombres: "María", Apellidos: "Ñáñez", Cargo: &cargo,
		Intento: domain.Intento{IniciadoEn: fin, FinalizadoEn: &fin, Total: 8, Correctas: &correctas, Nota: &nota}})
	if err != nil || !bytes.HasPrefix(p, []byte("%PDF-")) {
		t.Fatalf("el reporte no se generó: %v", err)
	}
}

func TestFormularioHTMLEscapaLoQueEscribeElPostulante(t *testing.T) {
	h, err := formularioHTML(&domain.FormularioFinal{Codigo: "BIESS-1", Consentimiento: Consentimiento, FirmaNombres: "Ana",
		Secciones: []domain.SeccionFormulario{{Numeral: "1.1", Titulo: "Información", Campos: []domain.CampoFormulario{{Etiqueta: "Nombres", Valor: "<script>alert(1)</script>"}}}}})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(h, "<script>") {
		t.Error("el correo no debe llevar HTML escrito por el postulante")
	}
	if !strings.Contains(h, "BIESS-1") || !strings.Contains(h, "Firma del postulante") || !strings.Contains(h, "artículo 7") {
		t.Error("el correo debe llevar el código, la firma y la declaración literal")
	}
}

func TestConsentimientoTieneLosCincoPuntosLiterales(t *testing.T) {
	if len(Consentimiento) != 5 {
		t.Fatalf("son 5 puntos, hay %d", len(Consentimiento))
	}
	for i, inicio := range []string{"Autorizo de manera libre", "Declaro que la información", "Acepto expresamente", "Acepto que mi nombre", "El presente formulario"} {
		if !strings.HasPrefix(Consentimiento[i], inicio) {
			t.Errorf("punto %d: %q", i+1, Consentimiento[i][:30])
		}
	}
}

type correoFalso struct {
	listo    bool
	falla    error
	enviados []Mensaje
}

func (c *correoFalso) Configurado() bool { return c.listo }
func (c *correoFalso) Enviar(_ context.Context, m Mensaje) error {
	c.enviados = append(c.enviados, m)
	return c.falla
}

func registrarToken(t *testing.T, s *AuthService, in IdentidadInput) string {
	t.Helper()
	token, err := s.VerificarIdentidad(context.Background(), in)
	if err != nil {
		t.Fatalf("identidad: %v", err)
	}
	return token
}

func TestRecuperar_SegunElServicioDeCorreo(t *testing.T) {
	ctx := context.Background()
	in := IdentidadInput{Cedula: "0106789019", FechaExpedicion: "2023-01-17"}
	preparar := func(c Correo, enPantalla bool) *AuthService {
		s := nuevoAuthService()
		s.correo, s.cfg.EnlaceEnPantalla = c, enPantalla
		if _, err := s.Registrar(ctx, RegistroInput{RegistroToken: registrarToken(t, s, in), Email: "ana@correo.com", Password: "Biess2026"}); err != nil {
			t.Fatalf("registro: %v", err)
		}
		return s
	}

	t.Run("con correo envía el enlace y no lo muestra", func(t *testing.T) {
		c := &correoFalso{listo: true}
		r, err := preparar(c, true).Recuperar(ctx, in)
		if err != nil {
			t.Fatal(err)
		}
		if len(c.enviados) != 1 || c.enviados[0].Para != "ana@correo.com" || !strings.Contains(c.enviados[0].HTML, "/restablecer?token=") {
			t.Fatalf("correo: %+v", c.enviados)
		}
		if r.Enlace != "" {
			t.Error("con correo el enlace no se devuelve al navegador")
		}
	})
	t.Run("sin correo no finge haberlo enviado", func(t *testing.T) {
		_, err := preparar(&correoFalso{}, false).Recuperar(ctx, in)
		if !errors.Is(err, domain.ErrReglaNegocio) {
			t.Fatalf("se esperaba un aviso, fue %v", err)
		}
	})
	t.Run("sin correo y con la opción de demostración muestra el enlace", func(t *testing.T) {
		r, err := preparar(&correoFalso{}, true).Recuperar(ctx, in)
		if err != nil || !strings.Contains(r.Enlace, "/restablecer?token=") {
			t.Fatalf("enlace %q, error %v", r.Enlace, err)
		}
	})
	t.Run("si el servicio falla lo dice", func(t *testing.T) {
		_, err := preparar(&correoFalso{listo: true, falla: errors.New("caído")}, true).Recuperar(ctx, in)
		if !errors.Is(err, domain.ErrReglaNegocio) {
			t.Fatalf("se esperaba un aviso, fue %v", err)
		}
	})
}
