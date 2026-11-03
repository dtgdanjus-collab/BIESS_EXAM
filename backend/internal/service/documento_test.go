package service

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

func TestValidarPDF(t *testing.T) {
	pdf := func(n int) []byte { return append([]byte("%PDF-"), make([]byte, n-5)...) }
	casos := []struct {
		nombre    string
		contenido []byte
		limite    int
		ok        bool
	}{
		{"pdf dentro del límite", pdf(1024), maxDocumento, true},
		{"justo en 2 MB", pdf(maxDocumento), maxDocumento, true},
		{"un byte de más", pdf(maxDocumento + 1), maxDocumento, false},
		{"4 MB en el respaldo de la organización", pdf(MaxDocumentoOrganizacion), MaxDocumentoOrganizacion, true},
		{"no es un PDF aunque se llame .pdf", []byte("<html>hola</html>"), maxDocumento, false},
		{"vacío", nil, maxDocumento, false},
	}
	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			err := validarPDF(c.contenido, c.limite)
			if c.ok && err != nil {
				t.Fatalf("debía aceptarse: %v", err)
			}
			if !c.ok && !errors.Is(err, domain.ErrValidacion) {
				t.Fatalf("debía rechazarse con error de validación, fue %v", err)
			}
		})
	}
}

func TestNombreDocumento(t *testing.T) {
	casos := map[string]string{
		"titulo.pdf":              "titulo.pdf",
		`C:\Users\Ana\título.pdf`: "título.pdf",
		"../../etc/passwd":        "passwd",
		"  con\x00control\n.pdf ": "concontrol.pdf",
		"":                        "documento.pdf",
		"carpeta/":                "documento.pdf",
	}
	for entrada, esperado := range casos {
		if got := nombreDocumento(entrada); got != esperado {
			t.Errorf("nombreDocumento(%q) = %q, se esperaba %q", entrada, got, esperado)
		}
	}
	largo := nombreDocumento(strings.Repeat("á", 300) + ".pdf")
	if n := len([]rune(largo)); n != 255 || !strings.HasSuffix(largo, ".pdf") {
		t.Errorf("el nombre largo debe recortarse a 255 caracteres con .pdf: %d %q", n, largo[len(largo)-6:])
	}
}

func TestSeccionesFaltantesExigeDocumentos(t *testing.T) {
	id := int64(1)
	sector := "AFILIADOS"
	si, no := true, false
	org := "Federación"
	base := func() *domain.Postulacion {
		confirmado := time.Now()
		return &domain.Postulacion{
			DatosConfirmadosEn: &confirmado,
			Contacto:           &domain.Contacto{},
			TieneFamiliares:    &no,
			SectorCodigo:       &sector,
			TieneRespaldo:      &no,
			Formacion:          []domain.Formacion{{}}, // 1.5.2 no lleva asterisco: es opcional
			Experiencia:        []domain.Experiencia{{DocumentoID: &id}},
			TienePublicaciones: &si,
			Publicaciones:      []domain.Publicacion{{DocumentoID: &id}},
			Capacitaciones:     []domain.Capacitacion{{}}, // 1.8.7 tampoco
			Inhabilidades:      []domain.RespuestaInhabilidad{{}},
		}
	}
	if f := seccionesFaltantes(base()); len(f) != 0 {
		t.Fatalf("con sus documentos no debe faltar nada: %v", f)
	}

	sinOrg := base()
	sinOrg.TieneRespaldo, sinOrg.OrganizacionNombre = &si, &org
	if f := seccionesFaltantes(sinOrg); len(f) != 1 || f[0] != "cargo" {
		t.Errorf("el respaldo sin PDF debe dejar pendiente el cargo: %v", f)
	}
	sinExp := base()
	sinExp.Experiencia[0].DocumentoID = nil
	if f := seccionesFaltantes(sinExp); len(f) != 1 || f[0] != "experiencia" {
		t.Errorf("la experiencia sin PDF debe quedar pendiente: %v", f)
	}
	sinPub := base()
	sinPub.Publicaciones[0].DocumentoID = nil
	if f := seccionesFaltantes(sinPub); len(f) != 1 || f[0] != "publicaciones" {
		t.Errorf("la publicación sin PDF debe quedar pendiente: %v", f)
	}
}
