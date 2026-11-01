package validator

import (
	"strings"
	"testing"
)

func TestCedula(t *testing.T) {
	casos := map[string]bool{
		// Personas mock (válidas)
		"0102345675": true,
		"0103456786": true,
		"1712345675": true,
		"0923456784": true,
		"1105678906": true,
		"0106789019": true,
		// Inválidas
		"0102345674":  false, // dígito verificador
		"2502345675":  false, // provincia 25
		"0172345675":  false, // tercer dígito >= 6
		"010234567":   false, // longitud
		"01023456755": false,
		"01023A5675":  false, // no numérica
		"":            false,
	}
	for c, want := range casos {
		if got := Cedula(c); got != want {
			t.Errorf("Cedula(%q) = %v, se esperaba %v", c, got, want)
		}
	}
}

func TestCodigoDactilar(t *testing.T) {
	casos := map[string]bool{
		"V4443V4442":  true,
		"E2331I2222":  true,
		"v4443v4442":  false, // minúsculas
		"V4443V444":   false,
		"V4443-V4442": false,
		"V4443V444A":  false, // dígito final no numérico
		"44430V4442":  false, // debe iniciar con letra
		"VV443V4442":  false,
	}
	for c, want := range casos {
		if got := CodigoDactilar(c); got != want {
			t.Errorf("CodigoDactilar(%q) = %v, se esperaba %v", c, got, want)
		}
	}
}

func TestPassword(t *testing.T) {
	casos := map[string]bool{
		"Biess2026":              true,
		"abc12345":               true,
		"abcdefgh":               false, // sin número
		"12345678":               false, // sin letra
		"ab12":                   false, // corta
		strings.Repeat("a1", 37): false, // 74 bytes: excede el límite de bcrypt
	}
	for p, want := range casos {
		if got := Password(p); got != want {
			t.Errorf("Password(%q) = %v, se esperaba %v", p, got, want)
		}
	}
}

func TestEmail(t *testing.T) {
	casos := map[string]bool{
		"maria@correo.com":      true,
		"Maria <maria@x.com>":   false,
		"maria@localhost":       false,
		"sin-arroba.correo.com": false,
	}
	for e, want := range casos {
		if got := Email(e); got != want {
			t.Errorf("Email(%q) = %v, se esperaba %v", e, got, want)
		}
	}
}
