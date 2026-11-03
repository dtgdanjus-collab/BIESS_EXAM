package service

import (
	"context"
	"strings"
	"time"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
	"github.com/biess-dev/biess-postulacion/backend/pkg/validator"
)

// MsgDatosYaConfirmados se devuelve si se intenta corregir unos datos ya confirmados.
const MsgDatosYaConfirmados = "Sus datos personales ya fueron confirmados y no se pueden modificar"

// ConfirmarDatos (1.1): el Registro Civil es simulado y sus datos pueden no coincidir con los
// reales, así que el postulante los corrige una sola vez. Al confirmar quedan bloqueados.
// La cédula y la nacionalidad no se aceptan del cliente: la nacionalidad decide si la
// postulación se cierra y no puede cambiarse desde aquí.
func (s *PostulacionService) ConfirmarDatos(ctx context.Context, usuarioID int64, d domain.DatosPersonales) (*domain.Postulacion, error) {
	normalizarDatos(&d)
	return s.editarBorrador(ctx, usuarioID, "CONFIRMAR_DATOS_PERSONALES", func(ctx context.Context, p *domain.Postulacion) error {
		if p.DatosConfirmadosEn != nil {
			return domain.NewError(domain.ErrReglaNegocio, MsgDatosYaConfirmados)
		}
		if err := validarDatos(d, time.Now()).err(); err != nil {
			return err
		}
		return s.repo.ConfirmarDatosPersonales(ctx, p.ID, d)
	})
}

func normalizarDatos(d *domain.DatosPersonales) {
	d.Nombres, d.Apellidos = strings.TrimSpace(d.Nombres), strings.TrimSpace(d.Apellidos)
	d.Genero = strings.ToUpper(strings.TrimSpace(d.Genero))
	d.EstadoCivil = strings.ToUpper(strings.TrimSpace(d.EstadoCivil))
	d.ConyugeNombres, d.ConyugeCedula = limpiar(d.ConyugeNombres), limpiar(d.ConyugeCedula)
	if !tieneConyuge(d.EstadoCivil) {
		d.ConyugeNombres, d.ConyugeCedula = nil, nil
	}
}

func tieneConyuge(estadoCivil string) bool {
	return estadoCivil == "CASADO/A" || estadoCivil == "UNION DE HECHO"
}

func validarDatos(d domain.DatosPersonales, ahora time.Time) campos {
	errs := campos{}
	errs.req("nombres", d.Nombres, 100)
	errs.req("apellidos", d.Apellidos, 100)
	errs.enum("genero", d.Genero, "MASCULINO", "FEMENINO")
	errs.enum("estadoCivil", d.EstadoCivil, "SOLTERO/A", "CASADO/A", "DIVORCIADO/A", "VIUDO/A", "UNION DE HECHO")
	errs.fechaPasada("fechaNacimiento", d.FechaNacimiento)
	if _, hay := errs["fechaNacimiento"]; !hay {
		switch {
		case d.FechaNacimiento.Year() < 1900:
			errs["fechaNacimiento"] = "La fecha de nacimiento no es válida"
		case d.FechaNacimiento.After(ahora.AddDate(-18, 0, 0)):
			errs["fechaNacimiento"] = "Debe ser mayor de edad"
		}
	}
	if tieneConyuge(d.EstadoCivil) {
		errs.req("conyugeNombres", deref(d.ConyugeNombres), 200)
		if !validator.Cedula(deref(d.ConyugeCedula)) {
			errs["conyugeCedula"] = "Cédula inválida"
		}
	}
	return errs
}
