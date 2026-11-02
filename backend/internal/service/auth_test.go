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

// padronPrueba hace de tabla mock_padron para los dobles (cédula sintética, no es de nadie).
var padronPrueba = map[string][2]string{"0101010114": {"NOMBRE REAL", "APELLIDO REAL"}}

func (f fakePersonas) FindPadron(_ context.Context, c string) (string, string, error) {
	if n, ok := padronPrueba[c]; ok {
		return n[0], n[1], nil
	}
	return "", "", repository.ErrNotFound
}

// CrearSimulada imita el ON CONFLICT DO NOTHING: si ya existe, se conserva la guardada.
func (f fakePersonas) CrearSimulada(_ context.Context, p domain.Persona, _ []string) (*domain.Persona, error) {
	if existente, ok := f[p.Cedula]; ok {
		return existente, nil
	}
	f[p.Cedula] = &p
	return &p, nil
}

type fakeUsuarios struct{ porCedula map[string]*domain.Usuario }

func (f *fakeUsuarios) ExistsByCedula(_ context.Context, c string) (bool, error) {
	_, ok := f.porCedula[c]
	return ok, nil
}

func (f *fakeUsuarios) FindByCedula(_ context.Context, c string) (*domain.Usuario, error) {
	if u, ok := f.porCedula[c]; ok {
		return u, nil
	}
	return nil, repository.ErrNotFound
}

func (f *fakeUsuarios) FindByID(_ context.Context, id int64) (*domain.Usuario, error) {
	for _, u := range f.porCedula {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (f *fakeUsuarios) Create(_ context.Context, u *domain.Usuario) error {
	u.ID = int64(len(f.porCedula) + 1)
	f.porCedula[u.Cedula] = u
	return nil
}

func (f *fakeUsuarios) UpdatePassword(_ context.Context, c, hash string) error {
	u, ok := f.porCedula[c]
	if !ok {
		return repository.ErrNotFound
	}
	u.PasswordHash = hash
	return nil
}

type fakeJWT struct{}

func (fakeJWT) Generar(id int64) (string, time.Time, error) {
	return "jwt-de-prueba", time.Now().Add(time.Hour), nil
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
		fakeJWT{},
		AuthConfig{Bloqueo: 10 * time.Minute, FrontendURL: "http://localhost:5173"})
}

func TestLogin_BloqueoSeparadoDelRegistroYRecuperacion(t *testing.T) {
	svc := nuevoAuthService()
	ctx := context.Background()
	token, _ := svc.VerificarIdentidad(ctx, IdentidadInput{Cedula: "0106789019", CodigoDactilar: "E7777V8888"})
	if _, err := svc.Registrar(ctx, RegistroInput{RegistroToken: token, Email: "d@correo.com", Password: "Biess2026"}); err != nil {
		t.Fatal(err)
	}

	for i := 0; i < 2; i++ {
		_, err := svc.Login(ctx, "0106789019", "incorrecta1")
		var de *domain.Error
		if !errors.As(err, &de) || de.Message != MsgCredencialesInvalidas {
			t.Fatalf("login fallido %d: %v", i+1, err)
		}
	}
	if _, err := svc.Login(ctx, "0106789019", "incorrecta1"); !errors.Is(err, domain.ErrBloqueado) {
		t.Fatalf("tercer fallo: se esperaba ErrBloqueado, se obtuvo %v", err)
	}
	// El bloqueo del login no afecta a la recuperación (claves separadas).
	if _, err := svc.Recuperar(ctx, IdentidadInput{Cedula: "0106789019", FechaExpedicion: "2023-01-17"}); err != nil {
		t.Fatalf("recuperar: %v", err)
	}
}

func TestLogin_Exitoso(t *testing.T) {
	svc := nuevoAuthService()
	ctx := context.Background()
	token, _ := svc.VerificarIdentidad(ctx, IdentidadInput{Cedula: "0106789019", CodigoDactilar: "E7777V8888"})
	_, _ = svc.Registrar(ctx, RegistroInput{RegistroToken: token, Email: "d@correo.com", Password: "Biess2026"})

	s, err := svc.Login(ctx, "0106789019", "Biess2026")
	if err != nil || s.Token == "" || s.Usuario.Cedula != "0106789019" {
		t.Fatalf("login: %+v, %v", s, err)
	}
	if _, err := svc.Login(ctx, "0102345675", "Biess2026"); !errors.Is(err, domain.ErrCredenciales) {
		t.Fatalf("cédula sin cuenta: se esperaba ErrCredenciales, se obtuvo %v", err)
	}
}

func TestEnmascararEmail(t *testing.T) {
	if got := enmascararEmail("maria@correo.com"); got != "ma***@correo.com" {
		t.Errorf("enmascararEmail = %q", got)
	}
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

func TestVerificarIdentidad_RegistroCivilAutogenerado(t *testing.T) {
	svc := nuevoAuthService()
	svc.cfg.AutoRegistroCivil = true
	ctx := context.Background()
	nueva := IdentidadInput{Cedula: "0101010106", FechaExpedicion: "2024-07-29", Genero: "FEMENINO"}

	// Primera vez: se da de alta con datos ficticios y la fecha ingresada.
	if _, err := svc.VerificarIdentidad(ctx, nueva); err != nil {
		t.Fatalf("primera validación: %v", err)
	}
	p, _ := svc.personas.FindByCedula(ctx, "0101010106")
	if p == nil || p.Nacionalidad != "ECUATORIANA" || p.FechaExpedicion.Format(time.DateOnly) != "2024-07-29" {
		t.Fatalf("persona simulada incorrecta: %+v", p)
	}
	nombre := p.Nombres

	// Después ya existe: otra fecha es un intento fallido y no crea otra persona.
	_, err := svc.VerificarIdentidad(ctx, IdentidadInput{Cedula: "0101010106", FechaExpedicion: "2020-01-01"})
	if !errors.Is(err, domain.ErrIdentidad) {
		t.Fatalf("fecha distinta: se esperaba ErrIdentidad, se obtuvo %v", err)
	}
	if q, _ := svc.personas.FindByCedula(ctx, "0101010106"); q.Nombres != nombre {
		t.Fatal("se generó una segunda persona para la misma cédula")
	}

	// La misma fecha vuelve a coincidir.
	if _, err := svc.VerificarIdentidad(ctx, nueva); err != nil {
		t.Fatalf("misma fecha: %v", err)
	}
}

func TestVerificarIdentidad_SinAutogenerarEsEstricto(t *testing.T) {
	svc := nuevoAuthService() // AutoRegistroCivil = false
	_, err := svc.VerificarIdentidad(context.Background(), IdentidadInput{Cedula: "0101010106", FechaExpedicion: "2024-07-29"})
	if !errors.Is(err, domain.ErrIdentidad) {
		t.Fatalf("se esperaba ErrIdentidad, se obtuvo %v", err)
	}
}

func TestVerificarIdentidad_PadronUsaNombresRealesYUnaSolaCuenta(t *testing.T) {
	svc := nuevoAuthService() // sin AutoRegistroCivil: el padrón funciona igual
	ctx := context.Background()
	in := IdentidadInput{Cedula: "0101010114", FechaExpedicion: "2024-07-29", Genero: "MASCULINO"}

	if _, err := svc.personas.FindByCedula(ctx, in.Cedula); !errors.Is(err, repository.ErrNotFound) {
		t.Fatalf("no debe existir persona antes de validar: %v", err)
	}
	token, err := svc.VerificarIdentidad(ctx, in)
	if err != nil {
		t.Fatalf("primera validación: %v", err)
	}
	p, _ := svc.personas.FindByCedula(ctx, in.Cedula)
	if p.Nombres != "NOMBRE REAL" || p.Apellidos != "APELLIDO REAL" || p.ConyugeNombres != nil {
		t.Fatalf("no usó los datos del padrón: %+v", p)
	}
	if existe, _ := svc.usuarios.ExistsByCedula(ctx, in.Cedula); existe {
		t.Fatal("validar la identidad no debe crear la cuenta")
	}

	if _, err := svc.Registrar(ctx, RegistroInput{RegistroToken: token, Email: "real@correo.com", Password: "Biess2026"}); err != nil {
		t.Fatalf("registrar: %v", err)
	}
	if _, err := svc.VerificarIdentidad(ctx, in); !errors.Is(err, domain.ErrConflicto) {
		t.Fatalf("segunda vez: se esperaba ErrConflicto (ya existe una cuenta), se obtuvo %v", err)
	}
}

func TestVerificarIdentidad_PideGeneroAntesDeCrear(t *testing.T) {
	svc := nuevoAuthService()
	svc.cfg.AutoRegistroCivil = true
	ctx := context.Background()
	in := IdentidadInput{Cedula: "0101010106", FechaExpedicion: "2024-07-29"}

	_, err := svc.VerificarIdentidad(ctx, in)
	var de *domain.Error
	if !errors.As(err, &de) || de.Details["requiereGenero"] != true {
		t.Fatalf("se esperaba requiereGenero, se obtuvo %v", err)
	}
	if _, err := svc.personas.FindByCedula(ctx, in.Cedula); !errors.Is(err, repository.ErrNotFound) {
		t.Fatal("no debe crearse la persona sin conocer el género")
	}
	if r, _, _ := svc.intentos.RegistrarFallo(ctx, cache.AmbitoRegistro, in.Cedula); r != 2 {
		t.Fatal("pedir el género no debe contar como intento fallido")
	}
	svc.intentos.Limpiar(ctx, cache.AmbitoRegistro, in.Cedula)

	in.Genero = "femenino"
	if _, err := svc.VerificarIdentidad(ctx, in); err != nil {
		t.Fatalf("con género: %v", err)
	}
	if p, _ := svc.personas.FindByCedula(ctx, in.Cedula); p.Genero != "FEMENINO" {
		t.Fatalf("género guardado = %q", p.Genero)
	}

	in.Genero = "OTRO"
	in.Cedula = "0101010122"
	if _, err := svc.VerificarIdentidad(ctx, in); !errors.Is(err, domain.ErrValidacion) {
		t.Fatalf("género inválido: %v", err)
	}
}

func TestVerificarIdentidad_CuentaExistenteSinImportarLosDatos(t *testing.T) {
	svc := nuevoAuthService()
	ctx := context.Background()
	token, _ := svc.VerificarIdentidad(ctx, IdentidadInput{Cedula: "0106789019", CodigoDactilar: "E7777V8888"})
	if _, err := svc.Registrar(ctx, RegistroInput{RegistroToken: token, Email: "d@correo.com", Password: "Biess2026"}); err != nil {
		t.Fatal(err)
	}
	_, err := svc.VerificarIdentidad(ctx, IdentidadInput{Cedula: "0106789019", FechaExpedicion: "2001-01-01"})
	if !errors.Is(err, domain.ErrConflicto) {
		t.Fatalf("datos incorrectos con cuenta existente: se esperaba ErrConflicto, se obtuvo %v", err)
	}
}
