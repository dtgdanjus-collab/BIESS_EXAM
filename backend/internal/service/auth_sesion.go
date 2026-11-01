package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/biess-dev/biess-postulacion/backend/internal/cache"
	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
	"github.com/biess-dev/biess-postulacion/backend/internal/repository"
	"github.com/biess-dev/biess-postulacion/backend/pkg/validator"
)

// hashSenuelo se compara cuando la cédula no tiene cuenta, para que el tiempo de respuesta
// no revele si el usuario existe.
var hashSenuelo, _ = bcrypt.GenerateFromPassword([]byte("senuelo-no-usar"), bcrypt.DefaultCost)

// Perfil es el usuario autenticado con sus nombres del Registro Civil.
type Perfil struct {
	domain.Usuario
	Nombres   string `json:"nombres"`
	Apellidos string `json:"apellidos"`
}

type Sesion struct {
	Token    string    `json:"token"`
	ExpiraEn time.Time `json:"expiraEn"`
	Usuario  *Perfil   `json:"usuario"`
}

// Login valida cédula y contraseña con el mismo bloqueo de 3 intentos que el registro
// (claves auth:*:login:* separadas) y emite un JWT.
func (s *AuthService) Login(ctx context.Context, cedula, password string) (*Sesion, error) {
	cedula = strings.TrimSpace(cedula)
	campos := map[string]string{}
	if !validator.Cedula(cedula) {
		campos["cedula"] = "Cédula inválida"
	}
	if password == "" {
		campos["password"] = "Es obligatoria"
	}
	if len(campos) > 0 {
		return nil, errValidacionCampos(campos)
	}

	if err := s.verificarBloqueo(ctx, cache.AmbitoLogin, cedula); err != nil {
		return nil, err
	}

	u, err := s.usuarios.FindByCedula(ctx, cedula)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}
	hash := hashSenuelo
	if u != nil {
		hash = []byte(u.PasswordHash)
	}
	if bcrypt.CompareHashAndPassword(hash, []byte(password)) != nil || u == nil {
		return nil, s.fallo(ctx, cache.AmbitoLogin, cedula)
	}

	if err := s.intentos.Limpiar(ctx, cache.AmbitoLogin, cedula); err != nil {
		return nil, err
	}
	token, expira, err := s.jwt.Generar(u.ID)
	if err != nil {
		return nil, err
	}
	perfil, err := s.perfil(ctx, u)
	if err != nil {
		return nil, err
	}
	return &Sesion{Token: token, ExpiraEn: expira, Usuario: perfil}, nil
}

// Me devuelve el perfil del usuario del JWT.
func (s *AuthService) Me(ctx context.Context, usuarioID int64) (*Perfil, error) {
	u, err := s.usuarios.FindByID(ctx, usuarioID)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, domain.NewError(domain.ErrNoAutorizado, "La sesión ya no es válida")
	}
	if err != nil {
		return nil, err
	}
	return s.perfil(ctx, u)
}

func (s *AuthService) perfil(ctx context.Context, u *domain.Usuario) (*Perfil, error) {
	p := &Perfil{Usuario: *u}
	persona, err := s.personas.FindByCedula(ctx, u.Cedula)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}
	if persona != nil {
		p.Nombres, p.Apellidos = persona.Nombres, persona.Apellidos
	}
	return p, nil
}

// Recuperar valida la identidad (con bloqueo propio) y "envía" por correo un enlace
// de restablecimiento. El correo se simula escribiéndolo en el log.
// Devuelve el correo enmascarado para mostrarlo al usuario.
func (s *AuthService) Recuperar(ctx context.Context, in IdentidadInput) (string, error) {
	in.Cedula = strings.TrimSpace(in.Cedula)
	in.CodigoDactilar = strings.ToUpper(strings.TrimSpace(in.CodigoDactilar))
	in.FechaExpedicion = strings.TrimSpace(in.FechaExpedicion)
	if err := validarIdentidadInput(in); err != nil {
		return "", err
	}
	if err := s.verificarBloqueo(ctx, cache.AmbitoRecuperar, in.Cedula); err != nil {
		return "", err
	}

	persona, err := s.personas.FindByCedula(ctx, in.Cedula)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return "", err
	}
	if persona == nil || !coincideIdentidad(persona, in) {
		return "", s.fallo(ctx, cache.AmbitoRecuperar, in.Cedula)
	}
	if err := s.intentos.Limpiar(ctx, cache.AmbitoRecuperar, in.Cedula); err != nil {
		return "", err
	}

	u, err := s.usuarios.FindByCedula(ctx, in.Cedula)
	if errors.Is(err, repository.ErrNotFound) {
		return "", domain.NewError(domain.ErrNoEncontrado, "No existe una cuenta registrada con esta cédula")
	}
	if err != nil {
		return "", err
	}

	token := uuid.NewString()
	if err := s.tokens.Guardar(ctx, cache.TokenRecuperacion, token, u.Cedula, recuperacionTokenTTL); err != nil {
		return "", err
	}
	log.Printf("CORREO SIMULADO → %s | Asunto: Recuperación de contraseña | Enlace (válido %d min): %s/restablecer?token=%s",
		u.Email, int(recuperacionTokenTTL.Minutes()), s.cfg.FrontendURL, token)
	return enmascararEmail(u.Email), nil
}

// Restablecer cambia la contraseña usando el token de recuperación (un solo uso).
func (s *AuthService) Restablecer(ctx context.Context, token, nuevaPassword string) error {
	campos := map[string]string{}
	if strings.TrimSpace(token) == "" {
		campos["token"] = "Es obligatorio"
	}
	if !validator.Password(nuevaPassword) {
		campos["nuevaPassword"] = "De 8 a 72 caracteres, con al menos una letra y un número"
	}
	if len(campos) > 0 {
		return errValidacionCampos(campos)
	}

	cedula, ok, err := s.tokens.Obtener(ctx, cache.TokenRecuperacion, token)
	if err != nil {
		return err
	}
	if !ok {
		return domain.NewError(domain.ErrNoAutorizado, "El enlace de recuperación expiró o no es válido")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(nuevaPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("generando hash: %w", err)
	}
	if err := s.usuarios.UpdatePassword(ctx, cedula, string(hash)); err != nil {
		return err
	}
	if err := s.tokens.Borrar(ctx, cache.TokenRecuperacion, token); err != nil {
		return err
	}
	// Una contraseña nueva reinicia el contador de fallos de login.
	return s.intentos.Limpiar(ctx, cache.AmbitoLogin, cedula)
}

// enmascararEmail: maria.ortega@correo.com → ma**********@correo.com
func enmascararEmail(e string) string {
	at := strings.LastIndex(e, "@")
	if at <= 2 {
		return e
	}
	return e[:2] + strings.Repeat("*", at-2) + e[at:]
}
