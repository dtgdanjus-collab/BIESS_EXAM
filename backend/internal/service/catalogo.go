// Package service contiene las reglas de negocio. Solo depende de interfaces de repository y cache.
package service

import (
	"context"
	"fmt"
	"log"

	"github.com/biess-dev/biess-postulacion/backend/internal/cache"
	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
	"github.com/biess-dev/biess-postulacion/backend/internal/repository"
)

// CatalogoService aplica cache-aside: busca en Redis y, si no está, consulta
// PostgreSQL y guarda el resultado con TTL.
type CatalogoService struct {
	repo  repository.CatalogoRepository
	cache cache.CatalogoCache
}

func NewCatalogoService(repo repository.CatalogoRepository, cache cache.CatalogoCache) *CatalogoService {
	return &CatalogoService{repo: repo, cache: cache}
}

func (s *CatalogoService) Paises(ctx context.Context) ([]domain.Item, error) {
	return cacheAside(ctx, s.cache, "cat:paises", s.repo.ListPaises)
}

func (s *CatalogoService) Provincias(ctx context.Context, paisID int) ([]domain.Item, error) {
	if paisID <= 0 {
		return nil, domain.NewError(domain.ErrValidacion, "El parámetro 'pais' debe ser un id válido")
	}
	return cacheAside(ctx, s.cache, fmt.Sprintf("cat:provincias:%d", paisID),
		func(ctx context.Context) ([]domain.Item, error) { return s.repo.ListProvincias(ctx, paisID) })
}

func (s *CatalogoService) Cantones(ctx context.Context, provinciaID int) ([]domain.Item, error) {
	if provinciaID <= 0 {
		return nil, domain.NewError(domain.ErrValidacion, "El parámetro 'provincia' debe ser un id válido")
	}
	return cacheAside(ctx, s.cache, fmt.Sprintf("cat:cantones:%d", provinciaID),
		func(ctx context.Context) ([]domain.Item, error) { return s.repo.ListCantones(ctx, provinciaID) })
}

func (s *CatalogoService) Parentescos(ctx context.Context) ([]domain.Item, error) {
	return cacheAside(ctx, s.cache, "cat:parentescos", s.repo.ListParentescos)
}

func (s *CatalogoService) Niveles(ctx context.Context) ([]domain.NivelInstruccion, error) {
	return cacheAside(ctx, s.cache, "cat:niveles", s.repo.ListNiveles)
}

func (s *CatalogoService) Areas(ctx context.Context) ([]domain.Item, error) {
	return cacheAside(ctx, s.cache, "cat:areas", s.repo.ListAreas)
}

func (s *CatalogoService) Sectores(ctx context.Context) ([]domain.Sector, error) {
	return cacheAside(ctx, s.cache, "cat:sectores", s.repo.ListSectores)
}

func (s *CatalogoService) Inhabilidades(ctx context.Context) ([]domain.PreguntaInhabilidad, error) {
	return cacheAside(ctx, s.cache, "cat:inhabilidades", s.repo.ListInhabilidades)
}

// cacheAside devuelve el valor cacheado o lo carga con load y lo guarda.
// Si Redis falla, se registra en el log y se responde desde PostgreSQL:
// la caché acelera, pero no debe tumbar la API.
func cacheAside[T any](ctx context.Context, c cache.CatalogoCache, key string, load func(context.Context) ([]T, error)) ([]T, error) {
	var cached []T
	hit, err := c.Get(ctx, key, &cached)
	if err != nil {
		log.Printf("CACHE ERROR %s: %v", key, err)
	}
	if hit {
		log.Printf("CACHE HIT  %s", key)
		return cached, nil
	}

	log.Printf("CACHE MISS %s", key)
	items, err := load(ctx)
	if err != nil {
		return nil, err
	}
	if err := c.Set(ctx, key, items); err != nil {
		log.Printf("CACHE ERROR %s: %v", key, err)
	}
	return items, nil
}
