package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
	"github.com/biess-dev/biess-postulacion/backend/internal/repository"
)

const (
	// MaxDocumentoOrganizacion es el límite del respaldo de la organización (1.4); también lo usa
	// main.go para dimensionar el cuerpo de las peticiones.
	MaxDocumentoOrganizacion = 4 << 20
	maxDocumento             = 2 << 20 // 1.5 a 1.8
	maxDocumentosPostulante  = 50 << 20
)

var limiteDocumento = map[string]int{
	domain.DocRespaldoOrganizacion: MaxDocumentoOrganizacion,
	domain.DocFormacion:            maxDocumento,
	domain.DocExperiencia:          maxDocumento,
	domain.DocPublicacion:          maxDocumento,
	domain.DocCapacitacion:         maxDocumento,
}

// SubirDocumento valida y guarda un PDF. Queda sin usar hasta que se guarde la sección que lo nombra.
func (s *PostulacionService) SubirDocumento(ctx context.Context, usuarioID int64, categoria, nombre string, contenido []byte) (*domain.Documento, error) {
	categoria = strings.ToUpper(strings.TrimSpace(categoria))
	limite, ok := limiteDocumento[categoria]
	if !ok {
		return nil, errValidacionCampos(map[string]string{"categoria": "Categoría de documento inválida"})
	}
	if err := validarPDF(contenido, limite); err != nil {
		return nil, err
	}

	var doc *domain.Documento
	_, err := s.editarBorrador(ctx, usuarioID, "SUBIR_DOCUMENTO", func(ctx context.Context, p *domain.Postulacion) error {
		total, err := s.detalle.TotalDocumentos(ctx, p.ID)
		if err != nil {
			return err
		}
		if total+int64(len(contenido)) > maxDocumentosPostulante {
			return domain.NewError(domain.ErrReglaNegocio,
				fmt.Sprintf("Superó el máximo de %d MB en documentos por postulante", maxDocumentosPostulante>>20))
		}
		doc, err = s.detalle.InsertDocumento(ctx, p.ID, categoria, nombreDocumento(nombre), contenido)
		return err
	})
	if err != nil {
		return nil, err
	}
	return doc, nil
}

// ObtenerDocumento devuelve un PDF solo si pertenece a la postulación del usuario.
func (s *PostulacionService) ObtenerDocumento(ctx context.Context, usuarioID, documentoID int64) (*domain.Documento, []byte, error) {
	d, contenido, err := s.detalle.FindDocumento(ctx, usuarioID, documentoID)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, nil, domain.NewError(domain.ErrNoEncontrado, "El documento no existe")
	}
	if err != nil {
		return nil, nil, err
	}
	return d, contenido, nil
}

func validarPDF(contenido []byte, limite int) error {
	if len(contenido) > limite {
		return errValidacionCampos(map[string]string{"archivo": fmt.Sprintf("El documento supera el máximo de %d MB", limite>>20)})
	}
	if !bytes.HasPrefix(contenido, []byte("%PDF-")) {
		return errValidacionCampos(map[string]string{"archivo": "El documento debe estar en formato PDF"})
	}
	return nil
}

// nombreDocumento deja solo el nombre del archivo, sin carpetas ni caracteres de control.
func nombreDocumento(nombre string) string {
	nombre = strings.ReplaceAll(nombre, `\`, "/")
	nombre = nombre[strings.LastIndex(nombre, "/")+1:]
	nombre = strings.TrimSpace(strings.Map(func(r rune) rune {
		if r < 32 || r == 127 {
			return -1
		}
		return r
	}, strings.ToValidUTF8(nombre, "")))
	if nombre == "" {
		return "documento.pdf"
	}
	if utf8.RuneCountInString(nombre) > 255 {
		nombre = string([]rune(nombre)[:251]) + ".pdf"
	}
	return nombre
}

// validarDocumentos comprueba que cada documento exista en la categoría de esta postulación.
// ids indexa los documentos por su clave de error (items[0].documentoId).
func (s *PostulacionService) validarDocumentos(ctx context.Context, errs campos, postulacionID int64, categoria string, ids map[string]*int64) error {
	validos, err := s.detalle.DocumentosValidos(ctx, postulacionID, categoria)
	if err != nil {
		return err
	}
	for k, id := range ids {
		if id != nil && !validos[*id] {
			errs[k] = "El documento ya no existe: vuelva a subirlo"
		}
	}
	return nil
}
