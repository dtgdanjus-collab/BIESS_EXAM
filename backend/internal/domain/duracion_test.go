package domain

import (
	"testing"
	"time"
)

func fecha(s string) time.Time {
	t, _ := time.Parse(time.DateOnly, s)
	return t
}

func TestCalcularDuracion(t *testing.T) {
	casos := []struct {
		inicio, fin string
		want        Duracion
	}{
		{"2020-01-01", "2020-12-31", Duracion{1, 0, 0}},
		{"2020-01-01", "2020-01-01", Duracion{0, 0, 1}},
		{"2019-03-15", "2021-05-20", Duracion{2, 2, 6}},
		{"2020-01-15", "2020-03-14", Duracion{0, 2, 0}},
		{"2018-06-10", "2023-06-08", Duracion{4, 11, 30}},
	}
	for _, c := range casos {
		if got := CalcularDuracion(fecha(c.inicio), fecha(c.fin)); got != c.want {
			t.Errorf("CalcularDuracion(%s, %s) = %+v, se esperaba %+v", c.inicio, c.fin, got, c.want)
		}
	}
}

func TestSumarDuracion(t *testing.T) {
	got := Duracion{1, 11, 20}.Sumar(Duracion{0, 0, 15})
	if want := (Duracion{2, 0, 5}); got != want {
		t.Errorf("Sumar = %+v, se esperaba %+v", got, want)
	}
}
