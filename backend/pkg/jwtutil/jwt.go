// Package jwtutil emite y verifica los JWT de sesión (HS256, sub = id del usuario).
package jwtutil

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const issuer = "biess-postulacion"

var ErrTokenInvalido = errors.New("token inválido o expirado")

type Manager struct {
	secret []byte
	ttl    time.Duration
}

func NewManager(secret string, ttl time.Duration) *Manager {
	return &Manager{secret: []byte(secret), ttl: ttl}
}

// Generar firma un token para el usuario con expiración ttl.
func (m *Manager) Generar(usuarioID int64) (string, time.Time, error) {
	ahora := time.Now()
	expira := ahora.Add(m.ttl)
	claims := jwt.RegisteredClaims{
		Subject:   strconv.FormatInt(usuarioID, 10),
		Issuer:    issuer,
		IssuedAt:  jwt.NewNumericDate(ahora),
		ExpiresAt: jwt.NewNumericDate(expira),
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("firmando jwt: %w", err)
	}
	return token, expira, nil
}

// Verificar valida firma, algoritmo, emisor y expiración, y devuelve el id del usuario.
func (m *Manager) Verificar(token string) (int64, error) {
	var claims jwt.RegisteredClaims
	_, err := jwt.ParseWithClaims(token, &claims,
		func(*jwt.Token) (any, error) { return m.secret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(issuer),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return 0, ErrTokenInvalido
	}
	id, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil || id <= 0 {
		return 0, ErrTokenInvalido
	}
	return id, nil
}
