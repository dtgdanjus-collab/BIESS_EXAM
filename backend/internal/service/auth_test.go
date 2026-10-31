package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/biess-dev/biess-postulacion/backend/internal/cache"
	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
	"github.com/biess-dev/biess-postulacion/backend/internal/repository"
)

// Dobles en memoria: gracias a la inyección por interfaces el service se prueba sin PostgreSQL ni Redis.

type fakePersonas map[string]*domain.Persona

func (f fakePersonas) FindByCedula(_ context.Context, c string) (*domain.Persona, error) {
	if p, ok := f[c]; ok {
		return p, nil
	}
	return nil, repository.ErrNotFound
}

type fakeUsuarios struct{ porCedula map[string]*domain.Usuario }

func (f *fakeUsuarios) ExistsByCedula(_ context.Context, c string) (bool, error) {
	_, ok := f.porCedula[c]
	return ok, nil
}

func (f *fakeUsuarios) Create(_ context.Context, u *domain.Usuario) error {
	u.ID = int64(len(f.porCedula) + 1)
	f.porCedula[u.Cedula] = u
	return nil
}

type fakeIntentos struct {
	max      int
	fallos   map[string]int
	bloqueos map[string]bool
}

func (f *fakeIntentos) Bloqueo(_ context.Context, a cache.Ambito, c string) (time.Duration, error) {
	if f.bloqueos[string(a)+c] {
		return 10 * time.Minute, nil
	}
	return 0, nil
}

func (f *fakeIntentos) RegistrarFallo(_ context.Context, a cache.Ambito, c string) (int, bool, error) {
	k := string(a) + c
	f.fallos[k]++
	if f.fallos[k] >= f.max {
		f.bloqueos[k] = true
		delete(f.fallos, k)
		return 0, true, nil
	}
	return f.max - f.fallos[k], false, nil
}

func (f *fakeIntentos) Limpiar(_ context.Context, a cache.Ambito, c string) error {
	delete(f.fallos, string(a)+c)
	return nil
}

type fakeTokens map[string]string

func (f fakeTokens) Guardar(_ context.Context, p, t, v string, _ time.Duration) error {
	f[p+t] = v
	return nil
}

func (f fakeTokens) Obtener(_ context.Context, p, t string) (string, bool, error) {
	v, ok := f[p+t]
	return v, ok, nil
}

func (f fakeTokens) Borrar(_ context.Context, p, t string) error {
	delete(f, p+t)
	return nil
}

func nuevoAuthService() *AuthService {
	personas := fakePersonas{
		"0106789019": {
			Cedula:          "0106789019",
			FechaExpedicion: time.Date(2023, 1, 17, 0, 0, 0, 0, time.UTC),
			CodigoDactilar:  "E7777V8888",
		},
	}
	return NewAuthService(personas,
		&fakeUsuarios{porCedula: map[string]*domain.Usuario{}},
		&fakeIntentos{max: 3, fallos: map[string]int{}, bloqueos: map[string]bool{}},
		fakeTokens{},
		AuthConfig{Bloqueo: 10 * time.Minute})
}

func TestVerificarIdentidad_BloqueoTrasTresFallos(t *testing.T) {
	svc := nuevoAuthService()
	ctx := context.Background()
	malo := IdentidadInput{Cedula: "0106789019", CodigoDactilar: "E0000V0000"}

	for i, restantes := range []int{2, 1} {
		_, err := svc.VerificarIdentidad(ctx, malo)
		var de *domain.Error
		if !errors.As(err, &de) || !errors.Is(err, domain.ErrIdentidad) {
			t.Fatalf("intento %d: se esperaba ErrIdentidad, se obtuvo %v", i+1, err)
		}
		if de.Message != MsgInfoIncorrecta || de.Details["intentosRestantes"] != restantes {
			t.Fatalf("intento %d: mensaje/detalle inesperado: %q %v", i+1, de.Message, de.Details)
		}
	}

	_, err := svc.VerificarIdentidad(ctx, malo)
	if !errors.Is(err, domain.ErrBloqueado) {
		t.Fatalf("tercer intento: se esperaba ErrBloqueado, se obtuvo %v", err)
	}

	// Bloqueada: ni siquiera los datos correctos pasan.
	bueno := IdentidadInput{Cedula: "0106789019", CodigoDactilar: "E7777V8888"}
	if _, err := svc.VerificarIdentidad(ctx, bueno); !errors.Is(err, domain.ErrBloqueado) {
		t.Fatalf("cuarto intento: se esperaba ErrBloqueado, se obtuvo %v", err)
	}
}

func TestRegistro_CaminoFelizYTokenDeUnSoloUso(t *testing.T) {
	svc := nuevoAuthService()
	ctx := context.Background()

	token, err := svc.VerificarIdentidad(ctx, IdentidadInput{Cedula: "0106789019", FechaExpedicion: "2023-01-17"})
	if err != nil {
		t.Fatalf("verificar: %v", err)
	}
	u, err := svc.Registrar(ctx, RegistroInput{RegistroToken: token, Email: "Diana@Correo.com", Password: "Biess2026"})
	if err != nil {
		t.Fatalf("registrar: %v", err)
	}
	if u.Email != "diana@correo.com" || u.PasswordHash == "Biess2026" {
		t.Fatalf("usuario mal construido: %+v", u)
	}
	if _, err := svc.Registrar(ctx, RegistroInput{RegistroToken: token, Email: "otra@correo.com", Password: "Biess2026"}); !errors.Is(err, domain.ErrNoAutorizado) {
		t.Fatalf("reusar token: se esperaba ErrNoAutorizado, se obtuvo %v", err)
	}
	if _, err := svc.VerificarIdentidad(ctx, IdentidadInput{Cedula: "0106789019", CodigoDactilar: "E7777V8888"}); !errors.Is(err, domain.ErrConflicto) {
		t.Fatalf("cédula ya registrada: se esperaba ErrConflicto, se obtuvo %v", err)
	}
}
