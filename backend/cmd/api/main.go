// Punto de entrada de la API. Aquí se hace todo el wiring (inyección de dependencias por constructor):
// config → postgres → redis → repositories → services → handlers → rutas.
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/biess-dev/biess-postulacion/backend/internal/config"
	"github.com/biess-dev/biess-postulacion/backend/internal/handler"
	"github.com/biess-dev/biess-postulacion/backend/internal/middleware"
	"github.com/biess-dev/biess-postulacion/backend/internal/platform"
)

func main() {
	if err := run(); err != nil {
		log.Fatalf("error fatal: %v", err)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// --- Infraestructura ---
	pool, err := platform.NewPostgresPool(ctx, cfg.DB)
	if err != nil {
		return err
	}
	defer pool.Close()
	log.Println("conectado a PostgreSQL")

	rdb, err := platform.NewRedisClient(ctx, cfg.Redis)
	if err != nil {
		return err
	}
	defer rdb.Close()
	log.Println("conectado a Redis")

	// --- Repositories / caches / services: se agregan desde la fase 3 ---

	// --- Handlers ---
	handlers := handler.Handlers{
		Health: handler.NewHealthHandler(map[string]handler.Pinger{
			"postgres": pool,
			"redis":    platform.RedisPinger{Client: rdb},
		}),
	}

	// --- HTTP ---
	app := fiber.New(fiber.Config{
		AppName:      "BIESS Postulación API",
		ErrorHandler: middleware.ErrorHandler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	})
	middleware.RegisterCommon(app, cfg.API.CORSOrigins)
	handler.RegisterRoutes(app, handlers)

	errCh := make(chan error, 1)
	go func() {
		errCh <- app.Listen(fmt.Sprintf(":%d", cfg.API.Port))
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		log.Println("apagando servidor…")
		return app.ShutdownWithTimeout(5 * time.Second)
	}
}
