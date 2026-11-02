package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/biess-dev/biess-postulacion/backend/internal/cache"
	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
	"github.com/biess-dev/biess-postulacion/backend/internal/repository"
	"github.com/biess-dev/biess-postulacion/backend/internal/simulador"
	"github.com/biess-dev/biess-postulacion/backend/pkg/validator"
)

// Mensajes literales del requerimiento (EF-11).
const (
	MsgInfoIncorrecta        = "La información ingresada es incorrecta"
	MsgRegistroFallido       = "Registro fallido, inténtelo nuevamente en %d minutos"
	MsgCredencialesInvalidas = "Sus credenciales de ingreso son incorrectas"
	MsgLoginBloqueado        = "Cuenta bloqueada temporalmente por intentos fallidos, inténtelo nuevamente en %d minutos"
)

const (
	registroTokenTTL     = 10 * time.Minute
	recuperacionTokenTTL = 15 * time.Minute
)

type AuthConfig struct {
	Bloqueo     time.Duration
	FrontendURL string // base del enlace de recuperación que se "envía" por correo
	// AutoRegistroCivil: una cédula válida que no está en el Registro Civil simulado se da
	// de alta (una sola vez) con datos ficticios y los datos de identidad que ingresó.
	AutoRegistroCivil bool
}

// TokenEmisor firma los JWT de sesión (implementado por pkg/jwtutil).
type TokenEmisor interface {
	Generar(usuarioID int64) (token string, expira time.Time, err error)
}

// AuthService implementa EF-11: validación de identidad, registro, login y recuperación.
type AuthService struct {
	personas repository.RegistroCivilRepository
	usuarios repository.UsuarioRepository
	intentos cache.IntentosCache
	tokens   cache.TokenCache
	jwt      TokenEmisor
	cfg      AuthConfig
}

func NewAuthService(
	personas repository.RegistroCivilRepository,
	usuarios repository.UsuarioRepository,
	intentos cache.IntentosCache,
	tokens cache.TokenCache,
	jwt TokenEmisor,
	cfg AuthConfig,
) *AuthService {
	return &AuthService{personas: personas, usuarios: usuarios, intentos: intentos, tokens: tokens, jwt: jwt, cfg: cfg}
}

// IdentidadInput: cédula más fecha de expedición y/o código dactilar.
type IdentidadInput struct {
	Cedula          string
	FechaExpedicion string // YYYY-MM-DD
	CodigoDactilar  string
}

// VerificarIdentidad compara los datos con el Registro Civil. Tras MAX_INTENTOS fallos
// la cédula queda bloqueada BLOQUEO_MINUTOS. Si todo coincide devuelve un token de registro.
func (s *AuthService) VerificarIdentidad(ctx context.Context, in IdentidadInput) (string, error) {
	in.Cedula = strings.TrimSpace(in.Cedula)
	in.CodigoDactilar = strings.ToUpper(strings.TrimSpace(in.CodigoDactilar))
	in.FechaExpedicion = strings.TrimSpace(in.FechaExpedicion)
	if err := validarIdentidadInput(in); err != nil {
		return "", err
	}

	if err := s.verificarBloqueo(ctx, cache.AmbitoRegistro, in.Cedula); err != nil {
		return "", err
	}

	persona, err := s.personas.FindByCedula(ctx, in.Cedula)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return "", err
	}
	if persona == nil {
		if persona, err = s.altaSimulada(ctx, in); err != nil {
			return "", err
		}
	}
	if persona == nil || !coincideIdentidad(persona, in) {
		return "", s.fallo(ctx, cache.AmbitoRegistro, in.Cedula)
	}

	if err := s.intentos.Limpiar(ctx, cache.AmbitoRegistro, in.Cedula); err != nil {
		return "", err
	}

	// El 409 se informa solo después de validar la identidad, para no revelar
	// a terceros qué cédulas tienen cuenta.
	existe, err := s.usuarios.ExistsByCedula(ctx, in.Cedula)
	if err != nil {
		return "", err
	}
	if existe {
		return "", domain.NewError(domain.ErrConflicto, "Ya existe una cuenta registrada con esta cédula")
	}

	token := uuid.NewString()
	if err := s.tokens.Guardar(ctx, cache.TokenRegistro, token, in.Cedula, registroTokenTTL); err != nil {
		return "", err
	}
	return token, nil
}

// altaSimulada crea en el Registro Civil simulado la persona de la cédula, usando la fecha
// de expedición o el código dactilar que ingresó el usuario. Si la cédula está en el padrón
// lleva sus nombres reales; si no, solo se crea con AutoRegistroCivil y con datos ficticios.
// Devuelve nil si no corresponde crearla. Si otra petición la creó al mismo tiempo, devuelve
// la existente (y la comparación posterior decide).
func (s *AuthService) altaSimulada(ctx context.Context, in IdentidadInput) (*domain.Persona, error) {
	nombres, apellidos, err := s.personas.FindPadron(ctx, in.Cedula)
	enPadron := err == nil
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}
	if !enPadron && !s.cfg.AutoRegistroCivil {
		return nil, nil
	}

	var fecha *time.Time
	if in.FechaExpedicion != "" {
		f, _ := time.Parse(time.DateOnly, in.FechaExpedicion) // ya validada
		fecha = &f
	}
	p, calidades := simulador.Persona(in.Cedula, fecha, in.CodigoDactilar, time.Now())
	if enPadron {
		// Persona real: sus nombres son los del padrón y no se le inventa un cónyuge.
		p.Nombres, p.Apellidos = nombres, apellidos
		p.EstadoCivil, p.ConyugeNombres, p.ConyugeCedula = "SOLTERO/A", nil, nil
	}
	persona, err := s.personas.CrearSimulada(ctx, p, calidades)
	if err != nil {
		return nil, err
	}
	log.Printf("REGISTRO CIVIL SIMULADO: alta de %s (%s %s) con calidades %v",
		persona.Cedula, persona.Nombres, persona.Apellidos, calidades)
	return persona, nil
}

type RegistroInput struct {
	RegistroToken string
	Email         string
	Password      string
}

// Registrar crea la cuenta usando el token emitido por VerificarIdentidad (un solo uso).
func (s *AuthService) Registrar(ctx context.Context, in RegistroInput) (*domain.Usuario, error) {
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	campos := map[string]string{}
	if strings.TrimSpace(in.RegistroToken) == "" {
		campos["registroToken"] = "Es obligatorio"
	}
	if !validator.Email(in.Email) || len(in.Email) > 150 {
		campos["email"] = "Correo electrónico inválido"
	}
	if !validator.Password(in.Password) {
		campos["password"] = "De 8 a 72 caracteres, con al menos una letra y un número"
	}
	if len(campos) > 0 {
		return nil, errValidacionCampos(campos)
	}

	cedula, ok, err := s.tokens.Obtener(ctx, cache.TokenRegistro, in.RegistroToken)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, domain.NewError(domain.ErrNoAutorizado,
			"La validación de identidad expiró o no es válida, vuelva a validar sus datos")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("generando hash: %w", err)
	}

	u := &domain.Usuario{Cedula: cedula, Email: in.Email, PasswordHash: string(hash)}
	if err := s.usuarios.Create(ctx, u); err != nil {
		var dup *repository.ErrDuplicado
		if errors.As(err, &dup) {
			if strings.Contains(dup.Constraint, "email") {
				return nil, domain.NewError(domain.ErrConflicto, "El correo electrónico ya está registrado").
					WithDetail("campo", "email")
			}
			return nil, domain.NewError(domain.ErrConflicto, "Ya existe una cuenta registrada con esta cédula")
		}
		return nil, err
	}

	// El token es de un solo uso: se borra al crear la cuenta.
	if err := s.tokens.Borrar(ctx, cache.TokenRegistro, in.RegistroToken); err != nil {
		return nil, err
	}
	return u, nil
}

// verificarBloqueo devuelve 423 con los segundos restantes si la cédula está bloqueada.
func (s *AuthService) verificarBloqueo(ctx context.Context, a cache.Ambito, cedula string) error {
	ttl, err := s.intentos.Bloqueo(ctx, a, cedula)
	if err != nil {
		return err
	}
	if ttl > 0 {
		return s.errBloqueado(a, ttl)
	}
	return nil
}

// fallo registra el intento fallido y arma el error 401 (con intentos restantes) o 423.
func (s *AuthService) fallo(ctx context.Context, a cache.Ambito, cedula string) error {
	restantes, bloqueado, err := s.intentos.RegistrarFallo(ctx, a, cedula)
	if err != nil {
		return err
	}
	if bloqueado {
		return s.errBloqueado(a, s.cfg.Bloqueo)
	}
	if a == cache.AmbitoLogin {
		return domain.NewError(domain.ErrCredenciales, MsgCredencialesInvalidas).
			WithDetail("intentosRestantes", restantes)
	}
	return domain.NewError(domain.ErrIdentidad, MsgInfoIncorrecta).WithDetail("intentosRestantes", restantes)
}

func (s *AuthService) errBloqueado(a cache.Ambito, ttl time.Duration) error {
	minutos := int(s.cfg.Bloqueo.Minutes())
	msg := fmt.Sprintf(MsgRegistroFallido, minutos)
	if a != cache.AmbitoRegistro {
		msg = fmt.Sprintf(MsgLoginBloqueado, minutos)
	}
	return domain.NewError(domain.ErrBloqueado, msg).
		WithDetail("segundosRestantes", int(math.Ceil(ttl.Seconds())))
}

func validarIdentidadInput(in IdentidadInput) error {
	campos := map[string]string{}
	if !validator.Cedula(in.Cedula) {
		campos["cedula"] = "Cédula inválida"
	}
	if in.FechaExpedicion == "" && in.CodigoDactilar == "" {
		campos["fechaExpedicion"] = "Ingrese la fecha de expedición o el código dactilar"
	}
	if in.FechaExpedicion != "" {
		if _, err := time.Parse(time.DateOnly, in.FechaExpedicion); err != nil {
			campos["fechaExpedicion"] = "Formato de fecha inválido (YYYY-MM-DD)"
		}
	}
	if in.CodigoDactilar != "" && !validator.CodigoDactilar(in.CodigoDactilar) {
		campos["codigoDactilar"] = "Formato inválido: letra, 4 dígitos, letra y 4 dígitos (ej. V4443V4442)"
	}
	if len(campos) > 0 {
		return errValidacionCampos(campos)
	}
	return nil
}

// coincideIdentidad exige que coincida cada dato enviado (si se envían ambos, ambos deben coincidir).
func coincideIdentidad(p *domain.Persona, in IdentidadInput) bool {
	if in.FechaExpedicion != "" && p.FechaExpedicion.Format(time.DateOnly) != in.FechaExpedicion {
		return false
	}
	if in.CodigoDactilar != "" && p.CodigoDactilar != in.CodigoDactilar {
		return false
	}
	return true
}

func errValidacionCampos(campos map[string]string) error {
	return domain.NewError(domain.ErrValidacion, "Hay datos con formato inválido").WithDetail("campos", campos)
}
