package service

import (
	"context"
	"html"
	"log"
	"time"
)

// Mensaje es un correo a un postulante.
type Mensaje struct {
	Para     string
	Asunto   string
	HTML     string
	Adjuntos []Adjunto
}

type Adjunto struct {
	Nombre    string
	Contenido []byte
}

// Correo envía los mensajes del sistema (implementado por platform.CorreoBrevo).
type Correo interface {
	// Configurado es false si falta la cuenta del servicio de correo: entonces nada se envía.
	Configurado() bool
	Enviar(ctx context.Context, m Mensaje) error
}

// notificar envía en segundo plano: un fallo del correo no deshace lo que ya se guardó.
func notificar(c Correo, m Mensaje) {
	if c == nil || !c.Configurado() {
		log.Printf("CORREO NO ENVIADO (servicio sin configurar) → %s | %s", m.Para, m.Asunto)
		return
	}
	go func() {
		ctx, cancelar := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancelar()
		if err := c.Enviar(ctx, m); err != nil {
			log.Printf("ERROR enviando correo a %s (%s): %v", m.Para, m.Asunto, err)
		}
	}()
}

// correoSimple arma un mensaje de un párrafo con el texto ya escapado.
func correoSimple(titulo, texto string) string {
	return `<div style="font-family:Arial,sans-serif;color:#111;max-width:620px"><h2 style="font-size:18px">` +
		html.EscapeString(titulo) + `</h2><p style="font-size:14px;line-height:1.5">` + html.EscapeString(texto) +
		`</p><p style="font-size:12px;color:#666">Concurso Público de Méritos y Oposición · Directorio del BIESS</p></div>`
}
