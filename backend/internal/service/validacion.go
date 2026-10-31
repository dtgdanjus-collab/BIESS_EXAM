package service

import (
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/biess-dev/biess-postulacion/backend/pkg/validator"
)

var reTelefono = regexp.MustCompile(`^\+?[0-9]{7,15}$`)

// campos acumula errores de validación por campo para devolverlos todos juntos (400).
type campos map[string]string

// req exige un texto no vacío de hasta max caracteres.
func (c campos) req(key, val string, max int) {
	switch {
	case strings.TrimSpace(val) == "":
		c[key] = "Es obligatorio"
	case utf8.RuneCountInString(val) > max:
		c[key] = fmt.Sprintf("Máximo %d caracteres", max)
	}
}

// opt valida la longitud de un texto opcional.
func (c campos) opt(key string, val *string, max int) {
	if val != nil && utf8.RuneCountInString(*val) > max {
		c[key] = fmt.Sprintf("Máximo %d caracteres", max)
	}
}

func (c campos) email(key, val string, obligatorio bool) {
	if val == "" {
		if obligatorio {
			c[key] = "Es obligatorio"
		}
		return
	}
	if !validator.Email(val) || len(val) > 150 {
		c[key] = "Correo electrónico inválido"
	}
}

func (c campos) telefono(key, val string, obligatorio bool) {
	if val == "" {
		if obligatorio {
			c[key] = "Es obligatorio"
		}
		return
	}
	if !reTelefono.MatchString(val) {
		c[key] = "Teléfono inválido (7 a 15 dígitos)"
	}
}

func (c campos) err() error {
	if len(c) == 0 {
		return nil
	}
	return errValidacionCampos(c)
}

// limpiar recorta espacios y convierte "" en nil.
func limpiar(s *string) *string {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return nil
	}
	return &t
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
