// Package domain contiene las entidades y los errores de negocio, sin dependencias de infraestructura.
package domain

import "errors"

// Tipos de error de dominio. El middleware de errores los traduce a códigos HTTP;
// los services solo devuelven estos tipos y nunca conocen HTTP.
var (
	ErrValidacion   = errors.New("VALIDACION")    // 400
	ErrCredenciales = errors.New("CREDENCIALES")  // 401
	ErrIdentidad    = errors.New("IDENTIDAD")     // 401
	ErrNoAutorizado = errors.New("NO_AUTORIZADO") // 401 (token ausente o inválido)
	ErrNoEncontrado = errors.New("NO_ENCONTRADO") // 404
	ErrConflicto    = errors.New("CONFLICTO")     // 409
	ErrReglaNegocio = errors.New("REGLA_NEGOCIO") // 422
	ErrBloqueado    = errors.New("BLOQUEADO")     // 423
)

// Error es un error de dominio con mensaje para el usuario y datos adicionales
// (por ejemplo intentosRestantes o segundosRestantes).
type Error struct {
	Kind    error
	Message string
	Details map[string]any
}

func (e *Error) Error() string { return e.Kind.Error() + ": " + e.Message }

// Unwrap permite usar errors.Is(err, domain.ErrBloqueado).
func (e *Error) Unwrap() error { return e.Kind }

// NewError crea un error de dominio del tipo indicado.
func NewError(kind error, message string) *Error {
	return &Error{Kind: kind, Message: message}
}

// WithDetail agrega un dato adicional que se devuelve en "details".
func (e *Error) WithDetail(key string, value any) *Error {
	if e.Details == nil {
		e.Details = make(map[string]any)
	}
	e.Details[key] = value
	return e
}
