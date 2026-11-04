package service

import (
	"bytes"
	"strings"
	"testing"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

func nota2(v float64) *float64 { return &v }

func TestCalcularMeritos(t *testing.T) {
	tabla := domain.TablaMeritos{
		PuntosPorNivel: map[string]float64{"1": 10, "3": 20}, TopeFormacion: 25,
		PuntosAnioGeneral: 2, PuntosAnioDireccion: 4, TopeExperiencia: 30,
		PuntosPublicacion: 3, TopePublicaciones: 5, PuntosHora: 0.1,
	}
	p := &domain.Postulacion{
		Formacion:        []domain.Formacion{{NivelID: 1}, {NivelID: 3}},
		ExperienciaTotal: domain.ExperienciaTotal{General: domain.Duracion{Anios: 2, Meses: 6}, Direccion: domain.Duracion{Anios: 1}},
		Publicaciones:    []domain.Publicacion{{}, {}, {}},
		Capacitaciones:   []domain.Capacitacion{{Horas: 40}, {Horas: 20}},
	}
	d := CalcularMeritos(tabla, p)
	if d.Formacion != 25 {
		t.Fatalf("la formación respeta el tope: %v", d.Formacion)
	}
	if d.Experiencia != 9 {
		t.Fatalf("experiencia: %v", d.Experiencia)
	}
	if d.Publicaciones != 5 {
		t.Fatalf("publicaciones con tope: %v", d.Publicaciones)
	}
	if d.Capacitacion != 6 {
		t.Fatalf("capacitación sin tope: %v", d.Capacitacion)
	}
	if d.Total != 45 {
		t.Fatalf("total: %v", d.Total)
	}
	tabla.PuntosPorNivel["1"], tabla.TopeFormacion, tabla.TopeExperiencia, tabla.PuntosAnioGeneral = 500, 0, 0, 500
	if d := CalcularMeritos(tabla, p); d.Total != 100 {
		t.Fatalf("el total nunca pasa de 100: %v", d.Total)
	}
}

func TestTablaConfigurada(t *testing.T) {
	if (domain.TablaMeritos{NotaMinima: 70, PesoMeritos: 1}).Configurada() {
		t.Fatal("sin puntos no hay tabla")
	}
	if !(domain.TablaMeritos{PuntosPorNivel: map[string]float64{"1": 5}}).Configurada() {
		t.Fatal("un nivel con puntos ya es una tabla")
	}
}

func TestValidarTabla(t *testing.T) {
	if err := validarTabla(domain.TablaMeritos{PuntosHora: 1, NotaMinima: 70}); err != nil {
		t.Fatal(err)
	}
	for _, mala := range []domain.TablaMeritos{{PuntosHora: -1}, {NotaMinima: 101}, {PuntosPorNivel: map[string]float64{"1": -2}}} {
		if validarTabla(mala) == nil {
			t.Fatalf("debía rechazarse: %+v", mala)
		}
	}
}

func TestArmarElegibles(t *testing.T) {
	af, ju := "AFILIADOS", "JUBILADOS"
	persona := func(codigo string, sector *string, m, te, ps *float64) domain.Postulante {
		return domain.Postulante{Codigo: codigo, SectorCodigo: sector, PuntajeMeritos: m, NotaTeorica: te, NotaPsicotecnica: ps}
	}
	lista := []domain.Postulante{
		persona("A-bajo", &af, nota2(60), nota2(60), nota2(60)),
		persona("A-alto", &af, nota2(90), nota2(90), nota2(90)),
		persona("J-uno", &ju, nota2(80), nota2(80), nota2(80)),
		persona("sin-nota", &af, nota2(90), nil, nota2(90)),
		persona("fuera", &ju, nota2(10), nota2(10), nota2(10)),
	}
	r := ArmarElegibles(lista, domain.TablaMeritos{NotaMinima: 50})
	if r.Pendientes != 1 || r.BajoMinimo != 1 || len(r.Filas) != 3 {
		t.Fatalf("pendientes %d, bajo mínimo %d, filas %d", r.Pendientes, r.BajoMinimo, len(r.Filas))
	}
	if r.Filas[0].Codigo != "A-alto" || r.Filas[0].Puesto != 1 || r.Filas[1].Codigo != "A-bajo" || r.Filas[1].Puesto != 2 {
		t.Fatalf("orden dentro del cargo: %+v", r.Filas)
	}
	if r.Filas[2].Codigo != "J-uno" || r.Filas[2].Puesto != 1 {
		t.Fatalf("cada cargo numera aparte: %+v", r.Filas[2])
	}
}

func TestNotaFinalPondera(t *testing.T) {
	if v := notaFinal(domain.TablaMeritos{}, 90, 60, 30); v != 60 {
		t.Fatalf("sin pesos cuentan igual: %v", v)
	}
	if v := notaFinal(domain.TablaMeritos{PesoMeritos: 50, PesoTeorica: 50}, 90, 60, 30); v != 75 {
		t.Fatalf("con pesos: %v", v)
	}
}

func TestReportesDeElegibles(t *testing.T) {
	af := "AFILIADOS"
	cargo := "Sector de Afiliados"
	l := ArmarElegibles([]domain.Postulante{{Codigo: "BIESS-1", Nombres: "José", Apellidos: "Ñandú", SectorCodigo: &af, Cargo: &cargo,
		PuntajeMeritos: nota2(90), NotaTeorica: nota2(80), NotaPsicotecnica: nota2(70), PosibleInhabilidad: true}}, domain.TablaMeritos{})
	pdf, err := ElegiblesPDF(&l)
	if err != nil || !bytes.HasPrefix(pdf, []byte("%PDF")) {
		t.Fatalf("pdf: %v", err)
	}
	x, err := ElegiblesXLSX(&l)
	if err != nil || !bytes.HasPrefix(x, []byte("PK")) {
		t.Fatalf("xlsx: %v", err)
	}
	vacia := ListaElegibles{}
	if _, err := ElegiblesPDF(&vacia); err != nil {
		t.Fatalf("pdf vacío: %v", err)
	}
}

func TestAvisosCalificacion(t *testing.T) {
	base := &domain.Postulante{Codigo: "BIESS-1", Email: "a@correo.com", EstadoConcurso: domain.ConcursoPostulado}
	if n := len(avisosCalificacion(base, domain.Calificacion{EstadoConcurso: domain.ConcursoPostulado})); n != 0 {
		t.Fatalf("sin cambios no se avisa: %d", n)
	}
	a := avisosCalificacion(base, domain.Calificacion{EstadoConcurso: domain.ConcursoEvaluacionTecnica, NotaPsicotecnica: nota2(85)})
	if len(a) != 2 || !strings.Contains(a[0].Asunto, "méritos") || !strings.Contains(a[1].Asunto, "psicotécnica") || !strings.Contains(a[1].HTML, "85.00") {
		t.Fatalf("avisos: %+v", a)
	}
	base.NotaPsicotecnica = nota2(85)
	base.EstadoConcurso = domain.ConcursoEvaluacionTecnica
	if n := len(avisosCalificacion(base, domain.Calificacion{EstadoConcurso: domain.ConcursoEvaluacionTecnica, NotaPsicotecnica: nota2(85)})); n != 0 {
		t.Fatalf("la misma nota no se avisa dos veces: %d", n)
	}
}
