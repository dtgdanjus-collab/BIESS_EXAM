package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
	"github.com/biess-dev/biess-postulacion/backend/internal/repository"
)

const (
	intervaloVigilancia = 30 * time.Second
	toleranciaReloj     = 2 * time.Second
)

// EvaluacionService implementa la parte del postulante en EF-14.
type EvaluacionService struct {
	tx      repository.TxManager
	repo    repository.ConcursoRepository
	postul  repository.PostulacionRepository
	correo  Correo
	reporte func(domain.ResultadoEvaluacion) ([]byte, error)
}

func NewEvaluacionService(tx repository.TxManager, repo repository.ConcursoRepository, postul repository.PostulacionRepository, correo Correo) *EvaluacionService {
	return &EvaluacionService{tx: tx, repo: repo, postul: postul, correo: correo, reporte: ReporteEvaluacionPDF}
}

// EstadoEvaluacion es lo que el postulante habilitado ve de su examen.
type EstadoEvaluacion struct {
	Habilitada        bool                   `json:"habilitada"` // ya se puede iniciar o continuar
	Inicio            *time.Time             `json:"inicio"`
	Fin               *time.Time             `json:"fin"`
	NumPreguntas      int                    `json:"numPreguntas"`
	DuracionMinutos   int                    `json:"duracionMinutos"`
	Estado            string                 `json:"estado"` // SIN_INICIAR | EN_CURSO | FINALIZADA
	SegundosRestantes int                    `json:"segundosRestantes"`
	Respondidas       int                    `json:"respondidas"`
	Total             int                    `json:"total"`
	Pregunta          *domain.PreguntaExamen `json:"pregunta"`
	Correctas         *int                   `json:"correctas"`
	Nota              *float64               `json:"nota"`
	Forzado           bool                   `json:"forzado"`
}

// postulanteHabilitado responde 404 a quien no superó los méritos: para él el módulo no existe.
func (s *EvaluacionService) postulanteHabilitado(ctx context.Context, usuarioID int64) (*domain.Postulante, error) {
	p, err := s.repo.FindPostulanteDeUsuario(ctx, usuarioID)
	if errors.Is(err, repository.ErrNotFound) || (err == nil && (p.EstadoConcurso != domain.ConcursoEvaluacionTecnica || p.Estado != string(domain.EstadoEnviada))) {
		return nil, domain.NewError(domain.ErrNoEncontrado, "La evaluación no está disponible")
	}
	if err != nil {
		return nil, err
	}
	return p, nil
}

// Estado devuelve la situación del examen. Si el tiempo terminó lo cierra primero.
func (s *EvaluacionService) Estado(ctx context.Context, usuarioID int64) (*EstadoEvaluacion, error) {
	p, err := s.postulanteHabilitado(ctx, usuarioID)
	if err != nil {
		return nil, err
	}
	return s.estadoDe(ctx, p)
}

func (s *EvaluacionService) estadoDe(ctx context.Context, p *domain.Postulante) (*EstadoEvaluacion, error) {
	cfg, err := s.repo.GetEvaluacionConfig(ctx)
	if err != nil {
		return nil, err
	}
	ahora := time.Now()
	e := &EstadoEvaluacion{Inicio: cfg.Inicio, Fin: cfg.Fin, NumPreguntas: cfg.NumPreguntas, DuracionMinutos: cfg.DuracionMinutos, Estado: "SIN_INICIAR"}
	e.Habilitada = cfg.Inicio != nil && !ahora.Before(*cfg.Inicio) && (cfg.Fin == nil || !ahora.After(*cfg.Fin))

	i, err := s.repo.FindIntento(ctx, p.PostulacionID, false)
	if errors.Is(err, repository.ErrNotFound) {
		return e, nil
	}
	if err != nil {
		return nil, err
	}
	if i.FinalizadoEn == nil && !ahora.Before(i.ExpiraEn) {
		if i, err = s.finalizar(ctx, p.PostulacionID, true); err != nil {
			return nil, err
		}
	}
	e.Total = i.Total
	if i.FinalizadoEn != nil {
		e.Estado, e.Correctas, e.Nota, e.Forzado, e.Habilitada = "FINALIZADA", i.Correctas, i.Nota, i.Forzado, false
		return e, nil
	}
	e.Estado, e.Habilitada = "EN_CURSO", true
	e.SegundosRestantes = int(i.ExpiraEn.Sub(ahora).Seconds())
	q, err := s.repo.PreguntaPendiente(ctx, i.ID)
	switch {
	case errors.Is(err, repository.ErrNotFound):
		e.Respondidas = i.Total
	case err != nil:
		return nil, err
	default:
		e.Pregunta, e.Respondidas = q, q.Orden-1
	}
	return e, nil
}

// Iniciar arma el examen único de este postulante. El reloj empieza aquí y lo lleva el servidor.
func (s *EvaluacionService) Iniciar(ctx context.Context, usuarioID int64) (*EstadoEvaluacion, error) {
	p, err := s.postulanteHabilitado(ctx, usuarioID)
	if err != nil {
		return nil, err
	}
	cfg, err := s.repo.GetEvaluacionConfig(ctx)
	if err != nil {
		return nil, err
	}
	ahora := time.Now()
	if cfg.Inicio == nil || ahora.Before(*cfg.Inicio) || (cfg.Fin != nil && ahora.After(*cfg.Fin)) {
		return nil, domain.NewError(domain.ErrReglaNegocio, "La evaluación no está habilitada en este momento")
	}
	err = s.tx.WithTx(ctx, func(ctx context.Context) error {
		if _, err := s.repo.FindIntento(ctx, p.PostulacionID, true); !errors.Is(err, repository.ErrNotFound) {
			return err // ya existe: se continúa el mismo examen
		}
		activas, err := s.repo.ContarPreguntasActivas(ctx)
		if err != nil {
			return err
		}
		if activas < cfg.NumPreguntas {
			return domain.NewError(domain.ErrReglaNegocio, "La evaluación aún no tiene preguntas suficientes. Comuníquese con Talento Humano")
		}
		expira := ahora.Add(time.Duration(cfg.DuracionMinutos) * time.Minute)
		if _, err := s.repo.CrearIntento(ctx, p.PostulacionID, expira, cfg.NumPreguntas); err != nil {
			return err
		}
		return s.postul.AddHistorial(ctx, p.PostulacionID, "INICIAR_EVALUACION", "")
	})
	var dup *repository.ErrDuplicado
	if err != nil && !errors.As(err, &dup) { // doble clic: la otra petición ya lo creó
		return nil, err
	}
	return s.estadoDe(ctx, p)
}

// Responder guarda la respuesta a la pregunta actual y devuelve la siguiente.
func (s *EvaluacionService) Responder(ctx context.Context, usuarioID int64, orden, opcion int) (*EstadoEvaluacion, error) {
	p, err := s.postulanteHabilitado(ctx, usuarioID)
	if err != nil {
		return nil, err
	}
	i, err := s.repo.FindIntento(ctx, p.PostulacionID, false)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, domain.NewError(domain.ErrReglaNegocio, "La evaluación aún no ha iniciado")
	}
	if err != nil {
		return nil, err
	}
	if i.FinalizadoEn == nil && time.Now().Before(i.ExpiraEn) {
		n, err := s.repo.Responder(ctx, i.ID, orden, opcion)
		if err != nil {
			return nil, err
		}
		if n == 0 {
			return nil, domain.NewError(domain.ErrValidacion, "La respuesta no es válida o la pregunta ya fue contestada")
		}
	}
	return s.estadoDe(ctx, p) // si el tiempo terminó, aquí se cierra
}

// Finalizar atiende el botón «Finalizar y Calificar».
func (s *EvaluacionService) Finalizar(ctx context.Context, usuarioID int64) (*EstadoEvaluacion, error) {
	p, err := s.postulanteHabilitado(ctx, usuarioID)
	if err != nil {
		return nil, err
	}
	if _, err := s.finalizar(ctx, p.PostulacionID, false); err != nil {
		return nil, err
	}
	return s.estadoDe(ctx, p)
}

// finalizar califica una sola vez, aunque el botón y el reloj coincidan, y notifica el resultado.
func (s *EvaluacionService) finalizar(ctx context.Context, postulacionID int64, forzado bool) (*domain.Intento, error) {
	var res *domain.Intento
	cerrado := false
	err := s.tx.WithTx(ctx, func(ctx context.Context) error {
		i, err := s.repo.FindIntento(ctx, postulacionID, true)
		if errors.Is(err, repository.ErrNotFound) {
			return domain.NewError(domain.ErrReglaNegocio, "La evaluación aún no ha iniciado")
		}
		if err != nil {
			return err
		}
		if i.FinalizadoEn != nil {
			res = i
			return nil
		}
		// El reloj de la pantalla pide el cierre en 00:00, un instante antes o después que el servidor.
		if !time.Now().Add(toleranciaReloj).Before(i.ExpiraEn) {
			forzado = true
		}
		if res, err = s.repo.FinalizarIntento(ctx, i.ID, forzado); err != nil {
			return err
		}
		cerrado = true
		detalle := fmt.Sprintf("Nota %.2f", *res.Nota)
		return s.postul.AddHistorial(ctx, postulacionID, "FINALIZAR_EVALUACION", detalle)
	})
	if err != nil {
		return nil, err
	}
	if cerrado {
		s.notificarResultado(ctx, res)
	}
	return res, nil
}

// notificarResultado envía la nota con su reporte en PDF (1.4 de EF-14).
func (s *EvaluacionService) notificarResultado(ctx context.Context, i *domain.Intento) {
	p, err := s.repo.FindPostulante(ctx, i.PostulacionID)
	if err != nil {
		log.Printf("ERROR notificando evaluación de la postulación %d: %v", i.PostulacionID, err)
		return
	}
	r := domain.ResultadoEvaluacion{PostulacionID: p.PostulacionID, Codigo: p.Codigo, Cedula: p.Cedula, Nombres: p.Nombres,
		Apellidos: p.Apellidos, Email: p.Email, Cargo: p.Cargo, Intento: *i}
	m := Mensaje{Para: p.Email, Asunto: "Resultado de su evaluación técnica - " + p.Codigo,
		HTML: correoSimple("Resultado de su evaluación técnica",
			fmt.Sprintf("Su evaluación finalizó con %d de %d respuestas correctas. Calificación: %.2f sobre 100.", *i.Correctas, i.Total, *i.Nota))}
	if pdf, err := s.reporte(r); err == nil {
		m.Adjuntos = []Adjunto{{Nombre: "evaluacion-" + p.Codigo + ".pdf", Contenido: pdf}}
	} else {
		log.Printf("ERROR armando el reporte de la postulación %d: %v", i.PostulacionID, err)
	}
	notificar(s.correo, m)
}

// ReportePDF devuelve el reporte del examen del postulante autenticado.
func (s *EvaluacionService) ReportePDF(ctx context.Context, usuarioID int64) (string, []byte, error) {
	p, err := s.postulanteHabilitado(ctx, usuarioID)
	if err != nil {
		return "", nil, err
	}
	return s.reporteDe(ctx, p)
}

func (s *EvaluacionService) reporteDe(ctx context.Context, p *domain.Postulante) (string, []byte, error) {
	i, err := s.repo.FindIntento(ctx, p.PostulacionID, false)
	if errors.Is(err, repository.ErrNotFound) || (err == nil && i.FinalizadoEn == nil) {
		return "", nil, domain.NewError(domain.ErrNoEncontrado, "La evaluación aún no tiene resultado")
	}
	if err != nil {
		return "", nil, err
	}
	pdf, err := s.reporte(domain.ResultadoEvaluacion{PostulacionID: p.PostulacionID, Codigo: p.Codigo, Cedula: p.Cedula,
		Nombres: p.Nombres, Apellidos: p.Apellidos, Email: p.Email, Cargo: p.Cargo, Intento: *i})
	return "evaluacion-" + p.Codigo + ".pdf", pdf, err
}

// Vigilar cierra los exámenes cuyo tiempo terminó aunque el postulante haya cerrado la página.
func (s *EvaluacionService) Vigilar(ctx context.Context) {
	reloj := time.NewTicker(intervaloVigilancia)
	defer reloj.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-reloj.C:
			ids, err := s.repo.ListIntentosVencidos(ctx, time.Now())
			if err != nil {
				log.Printf("ERROR consultando exámenes vencidos: %v", err)
				continue
			}
			for _, id := range ids {
				if _, err := s.finalizar(ctx, id, true); err != nil {
					log.Printf("ERROR cerrando el examen de la postulación %d: %v", id, err)
				}
			}
		}
	}
}
