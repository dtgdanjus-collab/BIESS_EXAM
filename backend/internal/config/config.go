// Package config carga la configuración de la aplicación desde variables de entorno (.env).
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	DB       DBConfig
	Redis    RedisConfig
	API      APIConfig
	Security SecurityConfig
}

type DBConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Name     string
	SSLMode  string
}

// DSN arma la cadena de conexión en formato URL que entiende pgx.
func (d DBConfig) DSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		d.User, d.Password, d.Host, d.Port, d.Name, d.SSLMode)
}

type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

type APIConfig struct {
	Port        int
	JWTSecret   string
	JWTTTL      time.Duration
	CORSOrigins string
	FrontendURL string
}

type SecurityConfig struct {
	MaxIntentos int
	Bloqueo     time.Duration
	CatalogoTTL time.Duration
	// DemoFallaEnvio fuerza un error al enviar para demostrar el ROLLBACK (solo para la sustentación).
	DemoFallaEnvio bool
}

// Load lee backend/.env y, si no existe, el .env de la raíz del repositorio.
// Las variables ya definidas en el entorno tienen prioridad.
func Load() (*Config, error) {
	for _, f := range []string{".env", "../.env"} {
		if err := godotenv.Load(f); err != nil && !errors.Is(err, os.ErrNotExist) {
			return nil, fmt.Errorf("leyendo %s: %w", f, err)
		}
	}

	var errs []error
	cfg := &Config{
		DB: DBConfig{
			Host:     getStr("DB_HOST", "localhost"),
			Port:     getInt("DB_PORT", 5432, &errs),
			User:     getStr("DB_USER", "biess"),
			Password: getStr("DB_PASSWORD", ""),
			Name:     getStr("DB_NAME", "biess_postulacion"),
			SSLMode:  getStr("DB_SSLMODE", "disable"),
		},
		Redis: RedisConfig{
			Addr:     getStr("REDIS_ADDR", "localhost:6379"),
			Password: getStr("REDIS_PASSWORD", ""),
			DB:       getInt("REDIS_DB", 0, &errs),
		},
		API: APIConfig{
			Port:        getInt("API_PORT", 8080, &errs),
			JWTSecret:   getStr("JWT_SECRET", ""),
			JWTTTL:      time.Duration(getInt("JWT_TTL_HOURS", 2, &errs)) * time.Hour,
			CORSOrigins: getStr("CORS_ORIGINS", "http://localhost:5173"),
			FrontendURL: strings.TrimRight(getStr("FRONTEND_URL", "http://localhost:5173"), "/"),
		},
		Security: SecurityConfig{
			MaxIntentos:    getInt("MAX_INTENTOS", 3, &errs),
			Bloqueo:        time.Duration(getInt("BLOQUEO_MINUTOS", 10, &errs)) * time.Minute,
			CatalogoTTL:    time.Duration(getInt("CATALOGO_TTL_HORAS", 24, &errs)) * time.Hour,
			DemoFallaEnvio: getStr("DEMO_FALLA_ENVIO", "false") == "true",
		},
	}

	if cfg.API.JWTSecret == "" {
		errs = append(errs, errors.New("JWT_SECRET es obligatorio"))
	}
	if err := errors.Join(errs...); err != nil {
		return nil, fmt.Errorf("configuración inválida: %w", err)
	}
	return cfg, nil
}

func getStr(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && strings.TrimSpace(v) != "" {
		return strings.TrimSpace(v)
	}
	return def
}

func getInt(key string, def int, errs *[]error) int {
	v := getStr(key, "")
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		*errs = append(*errs, fmt.Errorf("%s debe ser un entero (valor: %q)", key, v))
		return def
	}
	return n
}
