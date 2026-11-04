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

	"github.com/biess-dev/biess-postulacion/backend/internal/cache"
	"github.com/biess-dev/biess-postulacion/backend/internal/config"
	"github.com/biess-dev/biess-postulacion/backend/internal/handler"
	"github.com/biess-dev/biess-postulacion/backend/internal/middleware"
	"github.com/biess-dev/biess-postulacion/backend/internal/platform"
	"github.com/biess-dev/biess-postulacion/backend/internal/repository"
	"github.com/biess-dev/biess-postulacion/backend/internal/service"
	"github.com/biess-dev/biess-postulacion/backend/pkg/jwtutil"
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
	if err := platform.Migrar(ctx, pool); err != nil {
		return err
	}

	rdb, err := platform.NewRedisClient(ctx, cfg.Redis)
	if err != nil {
		return err
	}
	defer rdb.Close()
	log.Println("conectado a Redis")

	// --- Repositories ---
	store := repository.NewStore(pool) // TxManager: BEGIN / COMMIT / ROLLBACK
	catalogoRepo := repository.NewCatalogoRepository(pool)
	postulacionRepo := repository.NewPostulacionRepository(pool)
	detalleRepo := repository.NewDetalleRepository(pool)
	historialRepo := repository.NewHistorialLaboralRepository(pool)
	personaRepo := repository.NewRegistroCivilRepository(pool)
	usuarioRepo := repository.NewUsuarioRepository(pool)
	concursoRepo := repository.NewConcursoRepository(pool)

	// --- Caches ---
	catalogoCache := cache.NewCatalogoCache(rdb, cfg.Security.CatalogoTTL)
	// Los catálogos pueden cambiar entre despliegues: se parte sin caché para no servir datos viejos.
	if n, err := catalogoCache.Limpiar(ctx); err != nil {
		log.Printf("no se pudo limpiar la caché de catálogos: %v", err)
	} else {
		log.Printf("caché de catálogos limpiada: %d claves", n)
	}
	intentosCache := cache.NewIntentosCache(rdb, cfg.Security.MaxIntentos, cfg.Security.Bloqueo)
	tokenCache := cache.NewTokenCache(rdb)

	correo := platform.NewCorreoBrevo(cfg.API.Correo.APIKey, cfg.API.Correo.Remitente, cfg.API.Correo.Nombre)
	if !correo.Configurado() {
		log.Println("AVISO: sin BREVO_API_KEY y MAIL_REMITENTE no se envían correos")
	}

	// --- Services ---
	catalogoSvc := service.NewCatalogoService(catalogoRepo, catalogoCache)
	jwtManager := jwtutil.NewManager(cfg.API.JWTSecret, cfg.API.JWTTTL)
	authSvc := service.NewAuthService(personaRepo, usuarioRepo, intentosCache, tokenCache, jwtManager, correo,
		service.AuthConfig{Bloqueo: cfg.Security.Bloqueo, FrontendURL: cfg.API.FrontendURL,
			AutoRegistroCivil: cfg.API.AutoRegistroCivil, EnlaceEnPantalla: cfg.API.EnlaceEnPantalla})
	postulacionSvc := service.NewPostulacionService(store, postulacionRepo, detalleRepo, usuarioRepo,
		personaRepo, historialRepo, catalogoRepo, concursoRepo, correo,
		service.PostulacionConfig{SimularFallaEnvio: cfg.Security.DemoFallaEnvio})
	evaluacionSvc := service.NewEvaluacionService(store, concursoRepo, postulacionRepo, correo)
	// Clave distinta: el token de un postulante no sirve en el módulo de administración.
	adminJWT := jwtutil.NewManager(cfg.API.JWTSecret+":admin", cfg.API.JWTTTL)
	adminSvc := service.NewAdminService(concursoRepo, postulacionRepo, postulacionSvc, evaluacionSvc, intentosCache, adminJWT, cfg.Security.Bloqueo, correo)
	if err := adminSvc.CrearAdminInicial(ctx, cfg.API.Admin.Usuario, cfg.API.Admin.Password, cfg.API.Admin.Nombre); err != nil {
		return fmt.Errorf("administrador inicial: %w", err)
	}
	go evaluacionSvc.Vigilar(ctx)

	// --- Handlers ---
	handlers := handler.Handlers{
		Health: handler.NewHealthHandler(map[string]handler.Pinger{
			"postgres": pool,
			"redis":    platform.RedisPinger{Client: rdb},
		}),
		Catalogos:   handler.NewCatalogoHandler(catalogoSvc),
		Auth:        handler.NewAuthHandler(authSvc),
		Postulacion: handler.NewPostulacionHandler(postulacionSvc),
		Secciones:   handler.NewSeccionesHandler(postulacionSvc),
		Admin:       handler.NewAdminHandler(adminSvc, evaluacionSvc),
	}

	// --- HTTP ---
	app := fiber.New(fiber.Config{
		AppName:      "BIESS Postulación API",
		ErrorHandler: middleware.ErrorHandler,
		// Un PDF de 4 MB por datos móviles tarda: los 4 MB y 10 s por omisión no alcanzan.
		BodyLimit:    service.MaxDocumentoOrganizacion + 64<<10,
		ReadTimeout:  90 * time.Second,
		WriteTimeout: 90 * time.Second,
	})
	middleware.RegisterCommon(app, cfg.API.CORSOrigins)
	handler.RegisterRoutes(app, handlers, middleware.RequireAuth(jwtManager), middleware.RequireAuth(adminJWT))

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
