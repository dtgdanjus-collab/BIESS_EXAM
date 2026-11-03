package service

import (
	"testing"
	"time"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

func datosValidos(nacimiento string) domain.DatosPersonales {
	f, err := domain.ParseFecha(nacimiento)
	if err != nil {
		panic(err)
	}
	return domain.DatosPersonales{Nombres: "Ana", Apellidos: "Mora", Genero: "FEMENINO", EstadoCivil: "SOLTERO/A", FechaNacimiento: f}
}

func TestValidarDatos(t *testing.T) {
	ahora := time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC)
	cedulaMala, cedulaBuena, nombre := "0102345674", "0102345675", "Luis Paz"
	casos := []struct {
		nombre string
		cambia func(*domain.DatosPersonales)
		campo  string // "" si debe ser válido
	}{
		{"válidos", func(*domain.DatosPersonales) {}, ""},
		{"fecha futura", func(d *domain.DatosPersonales) { d.FechaNacimiento = datosValidos("2030-01-01").FechaNacimiento }, "fechaNacimiento"},
		{"menor de edad", func(d *domain.DatosPersonales) { d.FechaNacimiento = datosValidos("2010-01-01").FechaNacimiento }, "fechaNacimiento"},
		{"justo 18 años", func(d *domain.DatosPersonales) { d.FechaNacimiento = datosValidos("2008-11-03").FechaNacimiento }, ""},
		{"antes de 1900", func(d *domain.DatosPersonales) { d.FechaNacimiento = datosValidos("1850-01-01").FechaNacimiento }, "fechaNacimiento"},
		{"sin fecha", func(d *domain.DatosPersonales) { d.FechaNacimiento = domain.Fecha{} }, "fechaNacimiento"},
		{"sin nombres", func(d *domain.DatosPersonales) { d.Nombres = "" }, "nombres"},
		{"género inválido", func(d *domain.DatosPersonales) { d.Genero = "OTRO" }, "genero"},
		{"estado civil inválido", func(d *domain.DatosPersonales) { d.EstadoCivil = "X" }, "estadoCivil"},
		{"casada sin cónyuge", func(d *domain.DatosPersonales) { d.EstadoCivil = "CASADO/A" }, "conyugeNombres"},
		{"cónyuge con cédula inválida", func(d *domain.DatosPersonales) {
			d.EstadoCivil, d.ConyugeNombres, d.ConyugeCedula = "CASADO/A", &nombre, &cedulaMala
		}, "conyugeCedula"},
		{"casada con cónyuge", func(d *domain.DatosPersonales) {
			d.EstadoCivil, d.ConyugeNombres, d.ConyugeCedula = "CASADO/A", &nombre, &cedulaBuena
		}, ""},
	}
	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			d := datosValidos("1985-04-12")
			c.cambia(&d)
			errs := validarDatos(d, ahora)
			if c.campo == "" && len(errs) > 0 {
				t.Fatalf("esperaba válido, obtuve %v", errs)
			}
			if _, hay := errs[c.campo]; c.campo != "" && !hay {
				t.Fatalf("esperaba error en %s, obtuve %v", c.campo, errs)
			}
		})
	}
}

func TestNormalizarDatos_QuitaConyugeSiNoAplica(t *testing.T) {
	nombre := "Luis Paz"
	d := domain.DatosPersonales{Nombres: "  Ana ", EstadoCivil: "soltero/a", ConyugeNombres: &nombre}
	normalizarDatos(&d)
	if d.Nombres != "Ana" || d.EstadoCivil != "SOLTERO/A" || d.ConyugeNombres != nil {
		t.Fatalf("normalización incorrecta: %+v", d)
	}
}

func TestSeccionesFaltantes_ExigeDatosConfirmados(t *testing.T) {
	p := &domain.Postulacion{}
	if faltan := seccionesFaltantes(p); len(faltan) == 0 || faltan[0] != "personal" {
		t.Fatalf("debe exigir confirmar los datos personales, obtuve %v", faltan)
	}
	ahora := time.Now()
	p.DatosConfirmadosEn = &ahora
	for _, f := range seccionesFaltantes(p) {
		if f == "personal" {
			t.Fatal("ya confirmados no debe faltar")
		}
	}
}
