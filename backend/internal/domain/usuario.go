package domain

import "time"

// Persona son los datos que devuelve el Registro Civil (simulado con mock_registro_civil).
type Persona struct {
	Cedula          string
	Nombres         string
	Apellidos       string
	Genero          string
	FechaNacimiento time.Time
	Nacionalidad    string
	EstadoCivil     string
	ConyugeNombres  *string
	ConyugeCedula   *string
	FechaExpedicion time.Time
	CodigoDactilar  string
}

type Usuario struct {
	ID           int64     `json:"id"`
	Cedula       string    `json:"cedula"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	CreadoEn     time.Time `json:"creadoEn"`
}
