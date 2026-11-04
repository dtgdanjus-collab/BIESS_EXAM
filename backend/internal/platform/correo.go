package platform

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/biess-dev/biess-postulacion/backend/internal/service"
)

const urlBrevo = "https://api.brevo.com/v3/smtp/email"

// CorreoBrevo envía correos por la API HTTP de Brevo. Se usa HTTP porque los planes gratuitos
// de Render y Railway no dejan salir conexiones SMTP.
type CorreoBrevo struct {
	apiKey    string
	remitente string
	nombre    string
	cliente   *http.Client
}

func NewCorreoBrevo(apiKey, remitente, nombre string) *CorreoBrevo {
	return &CorreoBrevo{apiKey: apiKey, remitente: remitente, nombre: nombre, cliente: &http.Client{Timeout: 20 * time.Second}}
}

func (c *CorreoBrevo) Configurado() bool { return c.apiKey != "" && c.remitente != "" }

func (c *CorreoBrevo) Enviar(ctx context.Context, m service.Mensaje) error {
	para := []map[string]string{{"email": m.Para}}
	for _, copia := range m.Copias {
		para = append(para, map[string]string{"email": copia})
	}
	cuerpo := map[string]any{
		"sender":      map[string]string{"email": c.remitente, "name": c.nombre},
		"to":          para,
		"subject":     m.Asunto,
		"htmlContent": m.HTML,
	}
	if len(m.Adjuntos) > 0 {
		adjuntos := make([]map[string]string, 0, len(m.Adjuntos))
		for _, a := range m.Adjuntos {
			adjuntos = append(adjuntos, map[string]string{"name": a.Nombre, "content": base64.StdEncoding.EncodeToString(a.Contenido)})
		}
		cuerpo["attachment"] = adjuntos
	}
	datos, err := json.Marshal(cuerpo)
	if err != nil {
		return fmt.Errorf("armando correo: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, urlBrevo, bytes.NewReader(datos))
	if err != nil {
		return fmt.Errorf("armando petición de correo: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api-key", c.apiKey)
	res, err := c.cliente.Do(req)
	if err != nil {
		return fmt.Errorf("enviando correo: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		detalle, _ := io.ReadAll(io.LimitReader(res.Body, 500))
		return fmt.Errorf("el servicio de correo respondió %d: %s", res.StatusCode, detalle)
	}
	// Aceptar no es entregar: con este identificador se sigue el mensaje en los registros de Brevo.
	var aceptado struct {
		MessageID string `json:"messageId"`
	}
	_ = json.NewDecoder(io.LimitReader(res.Body, 2000)).Decode(&aceptado)
	log.Printf("CORREO aceptado por Brevo | %s | %d destinatario(s) | %s", m.Asunto, len(para), aceptado.MessageID)
	return nil
}
