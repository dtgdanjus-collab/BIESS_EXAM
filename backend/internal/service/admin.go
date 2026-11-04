package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/biess-dev/biess-postulacion/backend/internal/cache"
	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
	"github.com/biess-dev/biess-postulacion/backend/internal/repository"
	"github.com/biess-dev/biess-postulacion/backend/pkg/validator"
)

const (
	maxPreguntasImportadas = 500
	maxOpcionesPregunta    = 8
)

// AdminService implementa EF-13 y la parte administrativa de EF-14 y de las reconsideraciones.
type AdminService struct {
	repo        repository.ConcursoRepository
	postul      repository.PostulacionRepository
	postulacion *PostulacionService
	evaluacion  *EvaluacionService
	intentos    cache.IntentosCache
	jwt         TokenEmisor
	bloqueo     time.Duration
	correo      Correo
}

func NewAdminService(repo repository.ConcursoRepository, postul repository.PostulacionRepository, postulacion *PostulacionService,
	evaluacion *EvaluacionService, intentos cache.IntentosCache, jwt TokenEmisor, bloqueo time.Duration, correo Correo) *AdminService {
	return &AdminService{repo: repo, postul: postul, postulacion: postulacion, evaluacion: evaluacion,
		intentos: intentos, jwt: jwt, bloqueo: bloqueo, correo: correo}
}

// SesionAdmin es el resultado de iniciar sesión en el módulo de administración.
type SesionAdmin struct {
	Token    string                `json:"token"`
	ExpiraEn time.Time             `json:"expiraEn"`
	Admin    *domain.Administrador `json:"admin"`
}

// CrearAdminInicial da de alta al primer administrador desde las variables de entorno.
// Sin esas variables no hay cuentas: nunca se publica una contraseña por defecto.
func (s *AdminService) CrearAdminInicial(ctx context.Context, usuario, password, nombre string) error {
	if usuario == "" || password == "" {
		return nil
	}
	_, err := s.repo.FindAdminByUsuario(ctx, usuario)
	if err == nil {
		return nil
	}
	if !errors.Is(err, repository.ErrNotFound) {
		return err
	}
	if !validator.Password(password) {
		return errors.New("ADMIN_PASSWORD debe tener de 8 a 72 caracteres, con al menos una letra y un número")
	}
	return s.crear(ctx, usuario, password, nombre, domain.RolAdministrador)
}

func (s *AdminService) crear(ctx context.Context, usuario, password, nombre, rol string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("generando hash: %w", err)
	}
	return s.repo.CreateAdmin(ctx, &domain.Administrador{Usuario: usuario, Nombre: nombre, Rol: rol, PasswordHash: string(hash)})
}

// Login aplica el mismo bloqueo de 3 intentos que el acceso de los postulantes.
func (s *AdminService) Login(ctx context.Context, usuario, password string) (*SesionAdmin, error) {
	usuario = strings.ToLower(strings.TrimSpace(usuario))
	errs := campos{}
	errs.req("usuario", usuario, 60)
	errs.req("password", password, 72)
	if err := errs.err(); err != nil {
		return nil, err
	}
	ttl, err := s.intentos.Bloqueo(ctx, cache.AmbitoAdmin, usuario)
	if err != nil {
		return nil, err
	}
	if ttl > 0 {
		return nil, s.errBloqueado(ttl)
	}
	a, err := s.repo.FindAdminByUsuario(ctx, usuario)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}
	hash := hashSenuelo
	if a != nil {
		hash = []byte(a.PasswordHash)
	}
	if bcrypt.CompareHashAndPassword(hash, []byte(password)) != nil || a == nil || !a.Activo {
		restantes, bloqueado, err := s.intentos.RegistrarFallo(ctx, cache.AmbitoAdmin, usuario)
		if err != nil {
			return nil, err
		}
		if bloqueado {
			return nil, s.errBloqueado(s.bloqueo)
		}
		return nil, domain.NewError(domain.ErrCredenciales, MsgCredencialesInvalidas).WithDetail("intentosRestantes", restantes)
	}
	if err := s.intentos.Limpiar(ctx, cache.AmbitoAdmin, usuario); err != nil {
		return nil, err
	}
	token, expira, err := s.jwt.Generar(a.ID)
	if err != nil {
		return nil, err
	}
	return &SesionAdmin{Token: token, ExpiraEn: expira, Admin: a}, nil
}

func (s *AdminService) errBloqueado(ttl time.Duration) error {
	return domain.NewError(domain.ErrBloqueado, fmt.Sprintf(MsgLoginBloqueado, int(s.bloqueo.Minutes()))).
		WithDetail("segundosRestantes", int(ttl.Seconds())+1)
}

// Autorizar comprueba en cada petición que la cuenta siga activa y tenga el rol exigido.
func (s *AdminService) Autorizar(ctx context.Context, id int64, soloAdministrador bool) (*domain.Administrador, error) {
	a, err := s.repo.FindAdminByID(ctx, id)
	if errors.Is(err, repository.ErrNotFound) || (err == nil && !a.Activo) {
		return nil, domain.NewError(domain.ErrNoAutorizado, "La sesión ya no es válida")
	}
	if err != nil {
		return nil, err
	}
	if soloAdministrador && a.Rol != domain.RolAdministrador {
		return nil, domain.NewError(domain.ErrReglaNegocio, "Esta acción corresponde al rol Administrador")
	}
	return a, nil
}

func (s *AdminService) Dashboard(ctx context.Context) (*domain.Dashboard, error) {
	return s.repo.Dashboard(ctx)
}

func (s *AdminService) Postulantes(ctx context.Context, f domain.FiltroPostulantes) ([]domain.Postulante, error) {
	return s.repo.ListPostulantes(ctx, f)
}

// DetallePostulante trae el formulario íntegro y la calculadora de experiencia (EF-13.3).
type DetallePostulante struct {
	Postulante       *domain.Postulante      `json:"postulante"`
	Formulario       *domain.FormularioFinal `json:"formulario"`
	ExperienciaTotal domain.ExperienciaTotal `json:"experienciaTotal"`
	Intento          *domain.Intento         `json:"intento"`
	Meritos          *DesgloseMeritos        `json:"meritos"` // nil si la Comisión aún no define la tabla
	Historial        []domain.Evento         `json:"historial"`
}

func (s *AdminService) postulante(ctx context.Context, id int64) (*domain.Postulante, error) {
	p, err := s.repo.FindPostulante(ctx, id)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, domain.NewError(domain.ErrNoEncontrado, "El postulante no existe")
	}
	return p, err
}

func (s *AdminService) Detalle(ctx context.Context, id int64) (*DetallePostulante, error) {
	f, err := s.postulante(ctx, id)
	if err != nil {
		return nil, err
	}
	p, err := s.postulacion.Obtener(ctx, f.UsuarioID)
	if err != nil {
		return nil, err
	}
	form, err := s.postulacion.armarFormulario(ctx, p)
	if err != nil {
		return nil, err
	}
	d := &DetallePostulante{Postulante: f, Formulario: form, ExperienciaTotal: p.ExperienciaTotal}
	i, err := s.repo.FindIntento(ctx, id, false)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}
	d.Intento = i
	cfg, err := s.repo.GetConfig(ctx)
	if err != nil {
		return nil, err
	}
	if cfg.TablaMeritos.Configurada() {
		m := CalcularMeritos(cfg.TablaMeritos, p)
		d.Meritos = &m
	}
	if d.Historial, err = s.repo.ListAuditoria(ctx, "", id); err != nil {
		return nil, err
	}
	return d, nil
}

// Auditar deja constancia de una acción de una cuenta del módulo.
func (s *AdminService) Auditar(ctx context.Context, actor, rol, accion, detalle string, postulacionID *int64) error {
	return s.repo.RegistrarAuditoria(ctx, actor, rol, accion, detalle, postulacionID)
}

// Bitacora lista las acciones de todos, de la más reciente a la más antigua.
func (s *AdminService) Bitacora(ctx context.Context, busqueda string) ([]domain.Evento, error) {
	return s.repo.ListAuditoria(ctx, strings.TrimSpace(busqueda), 0)
}

// Documento descarga un certificado de un postulante.
func (s *AdminService) Documento(ctx context.Context, postulacionID, documentoID int64) (*domain.Documento, []byte, error) {
	d, contenido, err := s.repo.FindDocumentoDePostulacion(ctx, postulacionID, documentoID)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, nil, domain.NewError(domain.ErrNoEncontrado, "El documento no existe")
	}
	return d, contenido, err
}

// Calificar registra el resultado de méritos y la nota psicotécnica, y avisa al postulante de cada una.
// Con EVALUACION_TECNICA se le abre el examen.
func (s *AdminService) Calificar(ctx context.Context, id int64, c domain.Calificacion, por string) (*domain.Postulante, error) {
	c.EstadoConcurso = strings.ToUpper(strings.TrimSpace(c.EstadoConcurso))
	c.Observacion = limpiar(c.Observacion)
	errs := campos{}
	errs.enum("estadoConcurso", c.EstadoConcurso, domain.ConcursoPostulado, domain.ConcursoNoSuperaMeritos, domain.ConcursoEvaluacionTecnica)
	for k, v := range map[string]*float64{"puntajeMeritos": c.PuntajeMeritos, "notaPsicotecnica": c.NotaPsicotecnica} {
		if v != nil && (*v < 0 || *v > 100) {
			errs[k] = "Debe estar entre 0 y 100"
		}
	}
	errs.opt("observacion", c.Observacion, 2000)
	if err := errs.err(); err != nil {
		return nil, err
	}
	p, err := s.postulante(ctx, id)
	if err != nil {
		return nil, err
	}
	if p.Estado != string(domain.EstadoEnviada) {
		return nil, domain.NewError(domain.ErrReglaNegocio, "Solo se califican postulaciones enviadas")
	}
	if err := s.repo.GuardarCalificacion(ctx, id, c); err != nil {
		return nil, err
	}
	detalle := fmt.Sprintf("%s por %s", c.EstadoConcurso, por)
	if err := s.postul.AddHistorial(ctx, id, "CALIFICAR", detalle); err != nil {
		return nil, err
	}
	for _, m := range avisosCalificacion(p, c) {
		notificar(s.correo, m)
	}
	return s.repo.FindPostulante(ctx, id)
}

// ConcursoAdmin es la pantalla de fases: lo publicado y si el formulario está abierto.
type ConcursoAdmin struct {
	Config domain.ConcursoConfig `json:"config"`
	Fases  []domain.Fase         `json:"fases"`
}

func (s *AdminService) Concurso(ctx context.Context) (*ConcursoAdmin, error) {
	cfg, err := s.repo.GetConfig(ctx)
	if err != nil {
		return nil, err
	}
	fases, err := s.repo.ListFases(ctx)
	if err != nil {
		return nil, err
	}
	return &ConcursoAdmin{Config: *cfg, Fases: fases}, nil
}

func (s *AdminService) GuardarConfig(ctx context.Context, c domain.ConcursoConfig) (*ConcursoAdmin, error) {
	errs := campos{}
	if c.PlazoRespuestaDias <= 0 || c.PlazoRespuestaDias > 365 {
		errs["plazoRespuestaDias"] = "Debe estar entre 1 y 365 días"
	}
	if c.PlazoComisionDias <= 0 || c.PlazoComisionDias > 365 {
		errs["plazoComisionDias"] = "Debe estar entre 1 y 365 días"
	}
	if err := errs.err(); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateConfig(ctx, c); err != nil {
		return nil, err
	}
	return s.Concurso(ctx)
}

func (s *AdminService) GuardarFase(ctx context.Context, f domain.Fase) (*ConcursoAdmin, error) {
	f.Descripcion = limpiar(f.Descripcion)
	errs := campos{}
	errs.opt("descripcion", f.Descripcion, 2000)
	if f.FechaInicio != nil && f.FechaFin != nil && f.FechaFin.Before(*f.FechaInicio) {
		errs["fechaFin"] = "Debe ser posterior o igual a la fecha de inicio"
	}
	if err := errs.err(); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateFase(ctx, f); errors.Is(err, repository.ErrNotFound) {
		return nil, domain.NewError(domain.ErrNoEncontrado, "La fase no existe")
	} else if err != nil {
		return nil, err
	}
	return s.Concurso(ctx)
}

// --- Banco de preguntas (EF-14) ---

func validarPregunta(errs campos, k string, p *domain.PreguntaEvaluacion) {
	p.Enunciado = strings.TrimSpace(p.Enunciado)
	errs.req(k+"enunciado", p.Enunciado, 2000)
	limpias := make([]string, 0, len(p.Opciones))
	for _, o := range p.Opciones {
		if o = strings.TrimSpace(o); o != "" {
			limpias = append(limpias, o)
		}
	}
	p.Opciones = limpias
	if len(p.Opciones) < 2 || len(p.Opciones) > maxOpcionesPregunta {
		errs[k+"opciones"] = fmt.Sprintf("Debe tener de 2 a %d opciones", maxOpcionesPregunta)
	}
	if p.Correcta < 0 || p.Correcta >= len(p.Opciones) {
		errs[k+"correcta"] = "Indique cuál opción es la correcta"
	}
}

func (s *AdminService) Preguntas(ctx context.Context) ([]domain.PreguntaEvaluacion, error) {
	return s.repo.ListPreguntas(ctx)
}

func (s *AdminService) CrearPregunta(ctx context.Context, p domain.PreguntaEvaluacion) (*domain.PreguntaEvaluacion, error) {
	errs := campos{}
	validarPregunta(errs, "", &p)
	if err := errs.err(); err != nil {
		return nil, err
	}
	id, err := s.repo.CreatePregunta(ctx, p)
	if err != nil {
		return nil, err
	}
	p.ID = id
	return &p, nil
}

// ImportarPreguntas carga varias de una vez (el archivo CSV se interpreta en el navegador).
func (s *AdminService) ImportarPreguntas(ctx context.Context, items []domain.PreguntaEvaluacion) (int, error) {
	errs := campos{}
	if len(items) == 0 || len(items) > maxPreguntasImportadas {
		errs["items"] = fmt.Sprintf("Debe traer de 1 a %d preguntas", maxPreguntasImportadas)
	}
	for i := range items {
		items[i].Activa = true
		validarPregunta(errs, fmt.Sprintf("items[%d].", i), &items[i])
	}
	if err := errs.err(); err != nil {
		return 0, err
	}
	for _, p := range items {
		if _, err := s.repo.CreatePregunta(ctx, p); err != nil {
			return 0, err
		}
	}
	return len(items), nil
}

func (s *AdminService) GuardarPregunta(ctx context.Context, p domain.PreguntaEvaluacion) (*domain.PreguntaEvaluacion, error) {
	errs := campos{}
	validarPregunta(errs, "", &p)
	if err := errs.err(); err != nil {
		return nil, err
	}
	if err := s.repo.UpdatePregunta(ctx, p); errors.Is(err, repository.ErrNotFound) {
		return nil, domain.NewError(domain.ErrNoEncontrado, "La pregunta no existe")
	} else if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *AdminService) EliminarPregunta(ctx context.Context, id int64) error {
	return s.repo.DeletePregunta(ctx, id)
}

func (s *AdminService) EvaluacionConfig(ctx context.Context) (*domain.EvaluacionConfig, error) {
	return s.repo.GetEvaluacionConfig(ctx)
}

func (s *AdminService) GuardarEvaluacionConfig(ctx context.Context, c domain.EvaluacionConfig) (*domain.EvaluacionConfig, error) {
	errs := campos{}
	if c.NumPreguntas <= 0 {
		errs["numPreguntas"] = "Debe ser mayor a 0"
	}
	if c.DuracionMinutos <= 0 {
		errs["duracionMinutos"] = "Debe ser mayor a 0"
	}
	if c.Inicio != nil && c.Fin != nil && c.Fin.Before(*c.Inicio) {
		errs["fin"] = "Debe ser posterior o igual al inicio"
	}
	if err := errs.err(); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateEvaluacionConfig(ctx, c); err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *AdminService) Resultados(ctx context.Context) ([]domain.ResultadoEvaluacion, error) {
	return s.repo.ListResultados(ctx)
}

// ReporteEvaluacion descarga el PDF del examen de un postulante.
func (s *AdminService) ReporteEvaluacion(ctx context.Context, id int64) (string, []byte, error) {
	p, err := s.postulante(ctx, id)
	if err != nil {
		return "", nil, err
	}
	return s.evaluacion.reporteDe(ctx, p)
}

// --- Reconsideraciones ---

func (s *AdminService) Reconsideraciones(ctx context.Context) ([]domain.Reconsideracion, error) {
	return s.repo.ListReconsideraciones(ctx, 0)
}

// InformarReconsideracion es el paso de Talento Humano: se puede corregir mientras la Comisión no resuelva.
func (s *AdminService) InformarReconsideracion(ctx context.Context, id int64, informe, por string) (*domain.Reconsideracion, error) {
	informe = strings.TrimSpace(informe)
	errs := campos{}
	errs.req("informe", informe, 2000)
	if err := errs.err(); err != nil {
		return nil, err
	}
	x, err := s.repo.FindReconsideracion(ctx, id)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, domain.NewError(domain.ErrNoEncontrado, "La reconsideración no existe")
	}
	if err != nil {
		return nil, err
	}
	n, err := s.repo.InformarReconsideracion(ctx, id, informe, por)
	if err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, domain.NewError(domain.ErrConflicto, "Esta reconsideración ya fue resuelta")
	}
	if err := s.postul.AddHistorial(ctx, x.PostulacionID, "INFORMAR_RECONSIDERACION", "por "+por); err != nil {
		return nil, err
	}
	return s.repo.FindReconsideracion(ctx, id)
}

// ResponderReconsideracion es la resolución de la Comisión de Selección.
func (s *AdminService) ResponderReconsideracion(ctx context.Context, id int64, estado, respuesta, por string) (*domain.Reconsideracion, error) {
	estado = strings.ToUpper(strings.TrimSpace(estado))
	respuesta = strings.TrimSpace(respuesta)
	errs := campos{}
	errs.enum("estado", estado, "ACEPTADA", "NEGADA")
	errs.req("respuesta", respuesta, 2000)
	if err := errs.err(); err != nil {
		return nil, err
	}
	x, err := s.repo.FindReconsideracion(ctx, id)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, domain.NewError(domain.ErrNoEncontrado, "La reconsideración no existe")
	}
	if err != nil {
		return nil, err
	}
	n, err := s.repo.ResponderReconsideracion(ctx, id, estado, respuesta, por)
	if err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, domain.NewError(domain.ErrConflicto, "Esta reconsideración ya fue respondida")
	}
	if err := s.postul.AddHistorial(ctx, x.PostulacionID, "RESPONDER_RECONSIDERACION", estado+" por "+por); err != nil {
		return nil, err
	}
	notificar(s.correo, Mensaje{Para: x.Email, Asunto: "Respuesta a su reconsideración - " + x.Codigo,
		HTML: correoSimple("Respuesta a su reconsideración", "Su solicitud fue "+strings.ToLower(estado)+". "+respuesta)})
	return s.repo.FindReconsideracion(ctx, id)
}

// --- Cuentas ---

func (s *AdminService) Usuarios(ctx context.Context) ([]domain.Administrador, error) {
	return s.repo.ListAdmins(ctx)
}

func (s *AdminService) CrearUsuario(ctx context.Context, usuario, password, nombre, rol string) ([]domain.Administrador, error) {
	usuario = strings.ToLower(strings.TrimSpace(usuario))
	nombre = strings.TrimSpace(nombre)
	rol = strings.ToUpper(strings.TrimSpace(rol))
	errs := campos{}
	errs.req("usuario", usuario, 60)
	errs.req("nombre", nombre, 150)
	errs.enum("rol", rol, domain.RolAdministrador, domain.RolAnalista)
	if !validator.Password(password) {
		errs["password"] = "De 8 a 72 caracteres, con al menos una letra y un número"
	}
	if err := errs.err(); err != nil {
		return nil, err
	}
	if err := s.crear(ctx, usuario, password, nombre, rol); err != nil {
		var dup *repository.ErrDuplicado
		if errors.As(err, &dup) {
			return nil, errValidacionCampos(map[string]string{"usuario": "Ese usuario ya existe"})
		}
		return nil, err
	}
	return s.repo.ListAdmins(ctx)
}

// CambiarActivo no deja a una persona desactivarse a sí misma: el módulo quedaría sin dueño.
func (s *AdminService) CambiarActivo(ctx context.Context, id int64, activo bool, quien int64) ([]domain.Administrador, error) {
	if id == quien && !activo {
		return nil, domain.NewError(domain.ErrReglaNegocio, "No puede desactivar su propia cuenta")
	}
	if err := s.repo.SetAdminActivo(ctx, id, activo); err != nil {
		return nil, err
	}
	return s.repo.ListAdmins(ctx)
}

// --- Lo que ve el postulante del concurso ---

// ConcursoPublico son las fases publicadas y si el formulario está abierto.
type ConcursoPublico struct {
	FormularioAbierto bool          `json:"formularioAbierto"`
	Fases             []domain.Fase `json:"fases"`
}

// MiConcurso es el avance del postulante: resultados, evaluación si está habilitado y reconsideraciones.
type MiConcurso struct {
	ConcursoPublico
	EstadoConcurso    string                   `json:"estadoConcurso"`
	PuntajeMeritos    *float64                 `json:"puntajeMeritos"`
	NotaTeorica       *float64                 `json:"notaTeorica"`
	NotaPsicotecnica  *float64                 `json:"notaPsicotecnica"`
	Evaluacion        bool                     `json:"evaluacion"`
	PuedeReconsiderar bool                     `json:"puedeReconsiderar"`
	Reconsideraciones []domain.Reconsideracion `json:"reconsideraciones"`
}

// FormularioAbierto combina el interruptor del administrador con las fechas de la fase (EF-1, EF-13.2).
func formularioAbierto(ctx context.Context, repo repository.ConcursoRepository, ahora time.Time) (bool, error) {
	cfg, err := repo.GetConfig(ctx)
	if err != nil {
		return false, err
	}
	if !cfg.FormularioHabilitado {
		return false, nil
	}
	f, err := repo.FindFase(ctx, domain.FasePostulacion)
	if err != nil {
		return false, err
	}
	return f.Vigente(ahora), nil
}

func (s *AdminService) Publico(ctx context.Context) (*ConcursoPublico, error) {
	fases, err := s.repo.ListFases(ctx)
	if err != nil {
		return nil, err
	}
	abierto, err := formularioAbierto(ctx, s.repo, time.Now())
	if err != nil {
		return nil, err
	}
	publicadas := []domain.Fase{}
	for _, f := range fases {
		if f.Publicada {
			publicadas = append(publicadas, f)
		}
	}
	return &ConcursoPublico{FormularioAbierto: abierto, Fases: publicadas}, nil
}

func (s *AdminService) MiConcurso(ctx context.Context, usuarioID int64) (*MiConcurso, error) {
	pub, err := s.Publico(ctx)
	if err != nil {
		return nil, err
	}
	m := &MiConcurso{ConcursoPublico: *pub, Reconsideraciones: []domain.Reconsideracion{}}
	p, err := s.repo.FindPostulanteDeUsuario(ctx, usuarioID)
	if errors.Is(err, repository.ErrNotFound) {
		return m, nil
	}
	if err != nil {
		return nil, err
	}
	m.EstadoConcurso, m.PuntajeMeritos, m.NotaTeorica, m.NotaPsicotecnica = p.EstadoConcurso, p.PuntajeMeritos, p.NotaTeorica, p.NotaPsicotecnica
	m.Evaluacion = p.EstadoConcurso == domain.ConcursoEvaluacionTecnica && p.Estado == string(domain.EstadoEnviada)
	if m.Reconsideraciones, err = s.repo.ListReconsideraciones(ctx, p.PostulacionID); err != nil {
		return nil, err
	}
	// El informe de Talento Humano es interno: el postulante recibe la resolución.
	for i := range m.Reconsideraciones {
		m.Reconsideraciones[i].Informe, m.Reconsideraciones[i].InformePor, m.Reconsideraciones[i].InformeEn = nil, nil, nil
	}
	f, err := s.repo.FindFase(ctx, domain.FaseReconsideracion)
	if err != nil {
		return nil, err
	}
	m.PuedeReconsiderar = p.Estado == string(domain.EstadoEnviada) && f.Publicada && f.Vigente(time.Now())
	return m, nil
}

// SolicitarReconsideracion solo se admite mientras la fase esté publicada y dentro de sus fechas.
func (s *AdminService) SolicitarReconsideracion(ctx context.Context, usuarioID int64, etapa, motivo string) (*MiConcurso, error) {
	etapa = strings.ToUpper(strings.TrimSpace(etapa))
	motivo = strings.TrimSpace(motivo)
	errs := campos{}
	errs.enum("etapa", etapa, "MERITOS", "EVALUACION_TECNICA", "PSICOTECNICA")
	errs.req("motivo", motivo, 2000)
	if err := errs.err(); err != nil {
		return nil, err
	}
	p, err := s.repo.FindPostulanteDeUsuario(ctx, usuarioID)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, domain.NewError(domain.ErrNoEncontrado, "Aún no ha iniciado su postulación")
	}
	if err != nil {
		return nil, err
	}
	f, err := s.repo.FindFase(ctx, domain.FaseReconsideracion)
	if err != nil {
		return nil, err
	}
	ahora := time.Now()
	if p.Estado != string(domain.EstadoEnviada) || !f.Publicada || !f.Vigente(ahora) {
		return nil, domain.NewError(domain.ErrReglaNegocio, "El plazo para solicitar reconsideraciones no está abierto")
	}
	cfg, err := s.repo.GetConfig(ctx)
	if err != nil {
		return nil, err
	}
	informeAntes := ahora.AddDate(0, 0, cfg.PlazoRespuestaDias)
	err = s.repo.CrearReconsideracion(ctx, domain.Reconsideracion{PostulacionID: p.PostulacionID, Etapa: etapa, Motivo: motivo,
		InformeAntes: informeAntes, ResponderAntes: informeAntes.AddDate(0, 0, cfg.PlazoComisionDias)})
	var dup *repository.ErrDuplicado
	if errors.As(err, &dup) {
		return nil, errValidacionCampos(map[string]string{"etapa": "Ya presentó una reconsideración para esta etapa"})
	}
	if err != nil {
		return nil, err
	}
	if err := s.postul.AddHistorial(ctx, p.PostulacionID, "SOLICITAR_RECONSIDERACION", etapa); err != nil {
		return nil, err
	}
	return s.MiConcurso(ctx, usuarioID)
}

// Matriz arma el cuadro comparativo con los datos que se exportan.
func (s *AdminService) Matriz(ctx context.Context, f domain.FiltroPostulantes) ([]FilaMatriz, error) {
	lista, err := s.repo.ListPostulantes(ctx, f)
	if err != nil {
		return nil, err
	}
	filas := make([]FilaMatriz, 0, len(lista))
	for _, x := range lista {
		p, err := s.postulacion.Obtener(ctx, x.UsuarioID)
		if err != nil {
			return nil, err
		}
		fila := FilaMatriz{Postulante: x, Titulos: len(p.Formacion), Experiencia: p.ExperienciaTotal, Publicaciones: len(p.Publicaciones),
			Capacitaciones: len(p.Capacitaciones), Organizacion: deref(p.OrganizacionNombre)}
		for _, c := range p.Capacitaciones {
			fila.Horas += c.Horas
		}
		filas = append(filas, fila)
	}
	return filas, nil
}
