package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
)

func TestVerificarIdentidad_RechazaFechaFutura(t *testing.T) {
	svc := nuevoAuthService()
	manana := time.Now().AddDate(0, 0, 2).Format(time.DateOnly)
	_, err := svc.VerificarIdentidad(context.Background(), IdentidadInput{Cedula: "0102345675", FechaExpedicion: manana, Genero: "FEMENINO"})
	if !errors.Is(err, domain.ErrValidacion) {
		t.Fatalf("una fecha de expedición futura debe rechazarse, obtuve: %v", err)
	}
}
