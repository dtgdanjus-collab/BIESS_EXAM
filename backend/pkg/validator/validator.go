// Package validator contiene validaciones puras de formato (sin dependencias de infraestructura).
package validator

import (
	"net/mail"
	"regexp"
	"strings"
	"unicode"
)

// Formato real del código dactilar: letra + 4 dígitos + letra + 4 dígitos (p. ej. V4443V4442).
var reDactilar = regexp.MustCompile(`^[A-Z][0-9]{4}[A-Z][0-9]{4}$`)

// Cedula valida una cédula ecuatoriana: 10 dígitos, provincia 01–24 o 30,
// tercer dígito < 6 y dígito verificador por módulo 10.
func Cedula(c string) bool {
	if len(c) != 10 {
		return false
	}
	d := make([]int, 10)
	for i, r := range c {
		if r < '0' || r > '9' {
			return false
		}
		d[i] = int(r - '0')
	}

	provincia := d[0]*10 + d[1]
	if (provincia < 1 || provincia > 24) && provincia != 30 {
		return false
	}
	if d[2] >= 6 {
		return false
	}

	// Coeficientes 2,1,2,1…; si el producto es mayor que 9 se le resta 9.
	suma := 0
	for i := 0; i < 9; i++ {
		p := d[i] * (2 - i%2)
		if p > 9 {
			p -= 9
		}
		suma += p
	}
	verificador := (10 - suma%10) % 10
	return verificador == d[9]
}

// CodigoDactilar valida el formato del código dactilar (en mayúsculas).
func CodigoDactilar(c string) bool {
	return reDactilar.MatchString(c)
}

// MaxPasswordBytes es el límite de bcrypt: con más bytes GenerateFromPassword falla.
const MaxPasswordBytes = 72

// Password exige de 8 caracteres a 72 bytes, al menos una letra y un número.
func Password(p string) bool {
	if len([]rune(p)) < 8 || len(p) > MaxPasswordBytes {
		return false
	}
	var letra, numero bool
	for _, r := range p {
		switch {
		case unicode.IsLetter(r):
			letra = true
		case unicode.IsDigit(r):
			numero = true
		}
	}
	return letra && numero
}

// Email valida una dirección simple (sin nombre visible, con dominio).
func Email(e string) bool {
	a, err := mail.ParseAddress(e)
	return err == nil && a.Address == e && strings.Contains(e[strings.LastIndex(e, "@"):], ".")
}
