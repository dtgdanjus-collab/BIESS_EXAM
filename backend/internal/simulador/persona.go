// Package simulador inventa los datos que devolvería el Registro Civil para una cédula
// que no está en los datos semilla. Es determinista: la misma cédula produce siempre
// la misma persona, así nunca hay dos versiones de una misma cédula.
package simulador

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"math/rand/v2"
	"time"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

var (
	nombresM  = []string{"Juan", "Carlos", "Luis", "José", "Andrés", "Diego", "Fernando", "Ricardo", "Pablo", "Santiago", "Javier", "Miguel", "Esteban", "Mateo", "Daniel", "Gabriel", "Marco", "Patricio", "Xavier", "Héctor", "Alberto", "Alejandro", "Álvaro", "Antonio", "Bryan", "César", "Cristian", "David", "Eduardo", "Emilio", "Enrique", "Ernesto", "Felipe", "Francisco", "Gonzalo", "Gustavo", "Hugo", "Ignacio", "Iván", "Jaime", "Joaquín", "Jorge", "Julio", "Kevin", "Leonardo", "Manuel", "Mario", "Martín", "Mauricio", "Nicolás", "Óscar", "Pedro", "Rafael", "Ramiro", "Raúl", "Roberto", "Rodrigo", "Sebastián", "Sergio", "Víctor"}
	nombresF  = []string{"María", "Ana", "Gabriela", "Daniela", "Sofía", "Valeria", "Carolina", "Lucía", "Paola", "Verónica", "Fernanda", "Andrea", "Patricia", "Isabel", "Camila", "Mónica", "Diana", "Elena", "Rosa", "Natalia", "Adriana", "Alejandra", "Alicia", "Amanda", "Ángela", "Beatriz", "Bianca", "Carla", "Catalina", "Cecilia", "Claudia", "Cristina", "Doménica", "Emilia", "Esther", "Eva", "Gloria", "Inés", "Irene", "Jimena", "Johanna", "Julia", "Karina", "Laura", "Liliana", "Lorena", "Marcela", "Martha", "Melissa", "Mercedes", "Miriam", "Nancy", "Noelia", "Pamela", "Pilar", "Raquel", "Sandra", "Silvia", "Tatiana", "Ximena"}
	apellidos = []string{"Andrade", "Benítez", "Cevallos", "Chávez", "Delgado", "Espinoza", "Flores", "Guerrero", "Herrera", "Jaramillo", "León", "Mendoza", "Moreira", "Naranjo", "Ochoa", "Paredes", "Quintero", "Ramírez", "Salazar", "Torres", "Vásquez", "Villacís", "Zambrano", "Cárdenas", "Montalvo", "Peñafiel", "Romero", "Suárez", "Yépez", "Zúñiga"}
	estados   = []string{"SOLTERO/A", "SOLTERO/A", "CASADO/A", "CASADO/A", "DIVORCIADO/A", "UNION DE HECHO", "VIUDO/A"}
)

// Persona inventa la persona de la cédula. fechaExp, dactilar y genero son los datos que
// ingresó el usuario en su primera validación: se respetan, y los nombres van según el género.
// Devuelve también sus calidades en el IESS (AFILIADO siempre; JUBILADO y EMPLEADOR según el caso).
func Persona(cedula string, fechaExp *time.Time, dactilar, genero string, hoy time.Time) (domain.Persona, []string) {
	r := generador(cedula)

	nombres, otros := nombresM, nombresF
	if genero == "FEMENINO" {
		nombres, otros = nombresF, nombresM
	}

	nacimiento := time.Date(1958+r.IntN(39), time.Month(1+r.IntN(12)), 1+r.IntN(28), 0, 0, 0, 0, time.UTC)
	p := domain.Persona{
		Cedula:          cedula,
		Nombres:         dosDistintos(r, nombres),
		Apellidos:       uno(r, apellidos) + " " + uno(r, apellidos),
		Genero:          genero,
		FechaNacimiento: nacimiento,
		Nacionalidad:    "ECUATORIANA",
		EstadoCivil:     uno(r, estados),
	}

	if p.EstadoCivil == "CASADO/A" || p.EstadoCivil == "UNION DE HECHO" {
		conyuge := dosDistintos(r, otros) + " " + uno(r, apellidos) + " " + uno(r, apellidos)
		ced := cedulaValida(r, cedula)
		p.ConyugeNombres, p.ConyugeCedula = &conyuge, &ced
	}

	if fechaExp != nil {
		p.FechaExpedicion = *fechaExp
	} else {
		p.FechaExpedicion = time.Date(2015+r.IntN(10), time.Month(1+r.IntN(12)), 1+r.IntN(28), 0, 0, 0, 0, time.UTC)
	}
	if dactilar != "" {
		p.CodigoDactilar = dactilar
	} else {
		p.CodigoDactilar = fmt.Sprintf("%c%04d%c%04d", "VE"[r.IntN(2)], r.IntN(10000), "VIE"[r.IntN(3)], r.IntN(10000))
	}

	calidades := []string{"AFILIADO"}
	if hoy.Year()-nacimiento.Year() >= 60 {
		calidades = append(calidades, "JUBILADO")
	}
	if r.IntN(4) == 0 {
		calidades = append(calidades, "EMPLEADOR")
	}
	return p, calidades
}

// generador crea una fuente pseudoaleatoria fija para la cédula. SHA-256 reparte bien
// incluso cédulas casi iguales, que con un hash simple producían nombres muy parecidos.
func generador(cedula string) *rand.Rand {
	h := sha256.Sum256([]byte(cedula))
	return rand.New(rand.NewPCG(binary.BigEndian.Uint64(h[:8]), binary.BigEndian.Uint64(h[8:16])))
}

func uno(r *rand.Rand, lista []string) string { return lista[r.IntN(len(lista))] }

func dosDistintos(r *rand.Rand, lista []string) string {
	a := r.IntN(len(lista))
	b := (a + 1 + r.IntN(len(lista)-1)) % len(lista)
	return lista[a] + " " + lista[b]
}

// cedulaValida genera una cédula ecuatoriana válida (módulo 10) distinta de evitar.
func cedulaValida(r *rand.Rand, evitar string) string {
	for {
		d := make([]int, 10)
		prov := 1 + r.IntN(24)
		d[0], d[1], d[2] = prov/10, prov%10, r.IntN(6)
		for i := 3; i < 9; i++ {
			d[i] = r.IntN(10)
		}
		suma := 0
		for i := 0; i < 9; i++ {
			p := d[i] * (2 - i%2)
			if p > 9 {
				p -= 9
			}
			suma += p
		}
		d[9] = (10 - suma%10) % 10
		c := ""
		for _, v := range d {
			c += fmt.Sprint(v)
		}
		if c != evitar {
			return c
		}
	}
}
