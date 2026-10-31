package domain

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// Fecha es una fecha sin hora que viaja en JSON como "YYYY-MM-DD" y se guarda como DATE.
type Fecha struct {
	time.Time
}

func NewFecha(t time.Time) Fecha {
	return Fecha{time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)}
}

func ParseFecha(s string) (Fecha, error) {
	t, err := time.Parse(time.DateOnly, s)
	if err != nil {
		return Fecha{}, err
	}
	return Fecha{t}, nil
}

func (f Fecha) String() string { return f.Format(time.DateOnly) }

func (f Fecha) MarshalJSON() ([]byte, error) {
	if f.IsZero() {
		return []byte("null"), nil
	}
	return json.Marshal(f.String())
}

func (f *Fecha) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return fmt.Errorf("fecha inválida: se espera \"YYYY-MM-DD\"")
	}
	if s == "" {
		*f = Fecha{}
		return nil
	}
	p, err := ParseFecha(s)
	if err != nil {
		return fmt.Errorf("fecha inválida %q: se espera \"YYYY-MM-DD\"", s)
	}
	*f = p
	return nil
}

// Scan permite leer columnas DATE con pgx (database/sql Scanner).
func (f *Fecha) Scan(src any) error {
	switch v := src.(type) {
	case nil:
		*f = Fecha{}
	case time.Time:
		*f = NewFecha(v)
	default:
		return fmt.Errorf("no se puede convertir %T a Fecha", src)
	}
	return nil
}

// Value permite escribir la fecha como parámetro SQL.
func (f Fecha) Value() (driver.Value, error) {
	if f.IsZero() {
		return nil, nil
	}
	return f.Time, nil
}
