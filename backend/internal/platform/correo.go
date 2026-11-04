package platform

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
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
	cuerpo := map[string]any{
		"sender":      map[string]string{"email": c.remitente, "name": c.nombre},
		"to":          []map[string]string{{"email": m.Para}},
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
	return nil
}
