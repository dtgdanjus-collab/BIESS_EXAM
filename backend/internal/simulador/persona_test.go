package simulador

import (
	"testing"
	"time"

	"github.com/biess-dev/biess-postulacion/backend/pkg/validator"
)

var hoy = time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)

func TestPersonaEsDeterminista(t *testing.T) {
	a, ca := Persona("0928017326", nil, "", hoy)
	b, cb := Persona("0928017326", nil, "", hoy)
	if a.Nombres != b.Nombres || a.Apellidos != b.Apellidos || !a.FechaNacimiento.Equal(b.FechaNacimiento) ||
		a.CodigoDactilar != b.CodigoDactilar || len(ca) != len(cb) {
		t.Fatalf("la misma cédula generó dos personas distintas:\n%+v\n%+v", a, b)
	}
	otra, _ := Persona("2450320433", nil, "", hoy)
	if otra.Nombres+otra.Apellidos == a.Nombres+a.Apellidos && otra.FechaNacimiento.Equal(a.FechaNacimiento) {
		t.Fatal("dos cédulas distintas generaron la misma persona")
	}
}

func TestPersonaRespetaLosDatosIngresados(t *testing.T) {
	fecha := time.Date(2024, 7, 29, 0, 0, 0, 0, time.UTC)
	p, calidades := Persona("0928017326", &fecha, "", hoy)
	if !p.FechaExpedicion.Equal(fecha) {
		t.Errorf("fecha de expedición = %v, se esperaba %v", p.FechaExpedicion, fecha)
	}
	if !validator.CodigoDactilar(p.CodigoDactilar) {
		t.Errorf("código dactilar generado con formato inválido: %q", p.CodigoDactilar)
	}
	if p.Nacionalidad != "ECUATORIANA" || calidades[0] != "AFILIADO" {
		t.Errorf("debe ser ecuatoriana y afiliada: %s %v", p.Nacionalidad, calidades)
	}

	q, _ := Persona("0928017326", nil, "V1234E5678", hoy)
	if q.CodigoDactilar != "V1234E5678" {
		t.Errorf("no respetó el código dactilar ingresado: %q", q.CodigoDactilar)
	}
}

func TestConyugeConCedulaValida(t *testing.T) {
	// Recorre varias cédulas hasta encontrar casados/unión de hecho.
	encontrados := 0
	for _, c := range []string{"0102345675", "0928017326", "2450320433", "1712345675", "0103456786", "1105678906", "0923456784", "0106789019"} {
		p, _ := Persona(c, nil, "", hoy)
		if p.ConyugeCedula == nil {
			continue
		}
		encontrados++
		if !validator.Cedula(*p.ConyugeCedula) || *p.ConyugeCedula == c {
			t.Errorf("cédula del cónyuge inválida para %s: %s", c, *p.ConyugeCedula)
		}
	}
	if encontrados == 0 {
		t.Skip("ninguna de las cédulas de prueba generó cónyuge")
	}
}
