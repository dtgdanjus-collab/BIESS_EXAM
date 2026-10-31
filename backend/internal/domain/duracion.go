package domain

import "time"

// Duracion expresa un periodo en años, meses y días (sección 1.6, experiencia).
type Duracion struct {
	Anios int `json:"anios"`
	Meses int `json:"meses"`
	Dias  int `json:"dias"`
}

// CalcularDuracion cuenta el periodo [inicio, fin] incluyendo ambos días:
// del 01/01/2020 al 31/12/2020 es exactamente 1 año.
func CalcularDuracion(inicio, fin time.Time) Duracion {
	fin = fin.AddDate(0, 0, 1) // fin inclusivo
	anios := fin.Year() - inicio.Year()
	meses := int(fin.Month()) - int(inicio.Month())
	dias := fin.Day() - inicio.Day()
	if dias < 0 {
		meses--
		// días del mes anterior a "fin"
		dias += time.Date(fin.Year(), fin.Month(), 0, 0, 0, 0, 0, time.UTC).Day()
	}
	if meses < 0 {
		anios--
		meses += 12
	}
	return Duracion{Anios: anios, Meses: meses, Dias: dias}
}

// Sumar acumula duraciones normalizando 30 días = 1 mes y 12 meses = 1 año.
func (d Duracion) Sumar(o Duracion) Duracion {
	r := Duracion{Anios: d.Anios + o.Anios, Meses: d.Meses + o.Meses, Dias: d.Dias + o.Dias}
	r.Meses += r.Dias / 30
	r.Dias %= 30
	r.Anios += r.Meses / 12
	r.Meses %= 12
	return r
}
