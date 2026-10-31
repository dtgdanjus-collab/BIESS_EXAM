package jwtutil

import (
	"testing"
	"time"
)

func TestGenerarYVerificar(t *testing.T) {
	m := NewManager("secreto", time.Hour)
	tok, _, err := m.Generar(42)
	if err != nil {
		t.Fatal(err)
	}
	id, err := m.Verificar(tok)
	if err != nil || id != 42 {
		t.Fatalf("Verificar = %d, %v", id, err)
	}
}

func TestVerificarRechazaTokensInvalidos(t *testing.T) {
	m := NewManager("secreto", time.Hour)
	tok, _, _ := m.Generar(1)

	if _, err := NewManager("otro-secreto", time.Hour).Verificar(tok); err == nil {
		t.Error("aceptó un token firmado con otro secreto")
	}
	expirado, _, _ := NewManager("secreto", -time.Minute).Generar(1)
	if _, err := m.Verificar(expirado); err == nil {
		t.Error("aceptó un token expirado")
	}
	if _, err := m.Verificar("basura"); err == nil {
		t.Error("aceptó un token mal formado")
	}
}
