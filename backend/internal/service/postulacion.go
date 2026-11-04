package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/biess-dev/biess-postulacion/backend/internal/domain"
	"github.com/biess-dev/biess-postulacion/backend/internal/repository"
)

const (
	nacionalidadEcuatoriana = "ECUATORIANA"
	paisEcuador             = "Ecuador"
	maxFamiliares           = 20

	MsgNacionalidad = "Su postulación no puede continuar: de acuerdo con la Resolución C.D. 701, " +
		"para integrar el Directorio del BIESS se requiere ser de nacionalidad ecuatoriana"
)

type PostulacionConfig struct {
	// SimularFallaEnvio fuerza un error real de PostgreSQL al registrar el historial del
	// envío, para demostrar en la sustentación que la transacción hace ROLLBACK.
	SimularFallaEnvio bool
}

// PostulacionService implementa EF-12 (formulario de postulación).
type PostulacionService struct {
	tx        repository.TxManager
	repo      repository.PostulacionRepository
	detalle   repository.DetalleRepository
	usuarios  repository.UsuarioRepository
	personas  repository.RegistroCivilRepository
	historial repository.HistorialLaboralRepository
	catalogos repository.CatalogoRepository
	concurso  repository.ConcursoRepository
	correo    Correo
	cfg       PostulacionConfig
	reenvios  sync.Map // usuario → hora del último reenvío del formulario
}

const esperaReenvio = time.Minute

func NewPostulacionService(
	tx repository.TxManager,
	repo repository.PostulacionRepository,
	detalle repository.DetalleRepository,
	usuarios repository.UsuarioRepository,
	personas repository.RegistroCivilRepository,
	historial repository.HistorialLaboralRepository,
	catalogos repository.CatalogoRepository,
	concurso repository.ConcursoRepository,
	correo Correo,
	cfg PostulacionConfig,
) *PostulacionService {
	return &PostulacionService{tx: tx, repo: repo, detalle: detalle, usuarios: usuarios,
		personas: personas, historial: historial, catalogos: catalogos, concurso: concurso, correo: correo, cfg: cfg}
}

// MsgFormularioCerrado se devuelve fuera del periodo de postulación (EF-13.2).
const MsgFormularioCerrado = "El formulario de postulación no está habilitado en este momento"

func (s *PostulacionService) exigirFormularioAbierto(ctx context.Context) error {
	abierto, err := formularioAbierto(ctx, s.concurso, time.Now())
	if err != nil {
		return err
	}
	if !abierto {
		return domain.NewError(domain.ErrReglaNegocio, MsgFormularioCerrado).WithDetail("formularioCerrado", true)
	}
	return nil
}

// Obtener devuelve la postulación completa del usuario (404 si aún no la crea).
func (s *PostulacionService) Obtener(ctx context.Context, usuarioID int64) (*domain.Postulacion, error) {
	p, err := s.repo.FindByUsuario(ctx, usuarioID, false)
	if errors.Is(err, repository.ErrNotFound) {
		if err := s.exigirCuenta(ctx, usuarioID); err != nil {
			return nil, err
		}
		return nil, domain.NewError(domain.ErrNoEncontrado, "Aún no ha iniciado su postulación")
	}
	if err != nil {
		return nil, err
	}
	if err := s.cargarDetalle(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

// exigirCuenta responde 401 si la cuenta del JWT ya no existe (se borró con la sesión abierta):
// el frontend cierra la sesión y lleva al inicio en vez de mostrar un error interno.
func (s *PostulacionService) exigirCuenta(ctx context.Context, usuarioID int64) error {
	_, err := s.usuarios.FindByID(ctx, usuarioID)
	if errors.Is(err, repository.ErrNotFound) {
		return domain.NewError(domain.ErrNoAutorizado, "La sesión ya no es válida")
	}
	return err
}

func (s *PostulacionService) cargarDetalle(ctx context.Context, p *domain.Postulacion) error {
	var err error
	if p.DatosPersonales, err = s.repo.GetDatosPersonales(ctx, p.ID); err != nil {
		return err
	}
	if p.Contacto, err = s.repo.GetContacto(ctx, p.ID); err != nil {
		return err
	}
	if p.Familiares, err = s.repo.ListFamiliares(ctx, p.ID); err != nil {
		return err
	}
	if p.Formacion, err = s.detalle.ListFormacion(ctx, p.ID); err != nil {
		return err
	}
	if p.Experiencia, err = s.detalle.ListExperiencia(ctx, p.ID); err != nil {
		return err
	}
	if p.Publicaciones, err = s.detalle.ListPublicaciones(ctx, p.ID); err != nil {
		return err
	}
	if p.Capacitaciones, err = s.detalle.ListCapacitaciones(ctx, p.ID); err != nil {
		return err
	}
	if p.Inhabilidades, err = s.detalle.ListInhabilidades(ctx, p.ID); err != nil {
		return err
	}
	calcularExperiencia(p)
	return nil
}

// Crear inicia la postulación copiando los datos del Registro Civil. Si el postulante no es
// ecuatoriano la postulación se guarda CERRADA (queda constancia) y se responde 422.
// Si ya existe, la devuelve (idempotente) con creada=false.
func (s *PostulacionService) Crear(ctx context.Context, usuarioID int64) (p *domain.Postulacion, creada bool, err error) {
	existente, err := s.repo.FindByUsuario(ctx, usuarioID, false)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, false, err
	}
	if existente != nil {
		if existente.Estado == domain.EstadoCerrada {
			return nil, false, errPostulacionCerrada(existente)
		}
		p, err := s.Obtener(ctx, usuarioID)
		return p, false, err
	}

	if err := s.exigirCuenta(ctx, usuarioID); err != nil {
		return nil, false, err
	}
	if err := s.exigirFormularioAbierto(ctx); err != nil {
		return nil, false, err
	}
	u, err := s.usuarios.FindByID(ctx, usuarioID)
	if err != nil {
		return nil, false, err
	}
	persona, err := s.personas.FindByCedula(ctx, u.Cedula)
	if err != nil {
		return nil, false, fmt.Errorf("datos del registro civil de %s: %w", u.Cedula, err)
	}

	estado, accion, detalle := domain.EstadoBorrador, "CREAR", "Postulación iniciada"
	var motivo *string
	if !strings.EqualFold(persona.Nacionalidad, nacionalidadEcuatoriana) {
		estado, accion = domain.EstadoCerrada, "CERRAR"
		m := MsgNacionalidad
		motivo, detalle = &m, "Nacionalidad "+persona.Nacionalidad
	}

	err = s.tx.WithTx(ctx, func(ctx context.Context) error {
		nueva, err := s.repo.Create(ctx, usuarioID, estado, motivo)
		if err != nil {
			return err
		}
		if err := s.repo.InsertDatosPersonales(ctx, nueva.ID, datosDesdePersona(persona)); err != nil {
			return err
		}
		if err := s.repo.AddHistorial(ctx, nueva.ID, accion, detalle); err != nil {
			return err
		}
		p = nueva
		return nil
	})
	var dup *repository.ErrDuplicado
	if errors.As(err, &dup) { // otra petición simultánea la creó primero
		p, err := s.Obtener(ctx, usuarioID)
		return p, false, err
	}
	if err != nil {
		return nil, false, err
	}
	if estado == domain.EstadoCerrada {
		return nil, false, errPostulacionCerrada(p)
	}
	p, err = s.Obtener(ctx, usuarioID)
	return p, true, err
}

func datosDesdePersona(p *domain.Persona) domain.DatosPersonales {
	return domain.DatosPersonales{
		Cedula:          p.Cedula,
		Nombres:         p.Nombres,
		Apellidos:       p.Apellidos,
		Genero:          p.Genero,
		FechaNacimiento: domain.NewFecha(p.FechaNacimiento),
		Nacionalidad:    p.Nacionalidad,
		EstadoCivil:     p.EstadoCivil,
		ConyugeNombres:  p.ConyugeNombres,
		ConyugeCedula:   p.ConyugeCedula,
	}
}

func errPostulacionCerrada(p *domain.Postulacion) error {
	return domain.NewError(domain.ErrReglaNegocio, deref(p.MotivoCierre)).
		WithDetail("estado", domain.EstadoCerrada).
		WithDetail("codigo", p.Codigo)
}

// GuardarContacto (1.2): si el país es Ecuador exige provincia y cantón coherentes;
// para otros países, provincia y ciudad en texto libre.
func (s *PostulacionService) GuardarContacto(ctx context.Context, usuarioID int64, c domain.Contacto) (*domain.Postulacion, error) {
	return s.editarBorrador(ctx, usuarioID, "ACTUALIZAR_CONTACTO", func(ctx context.Context, p *domain.Postulacion) error {
		if err := s.validarContacto(ctx, &c); err != nil {
			return err
		}
		return s.repo.UpsertContacto(ctx, p.ID, c)
	})
}

func (s *PostulacionService) validarContacto(ctx context.Context, c *domain.Contacto) error {
	for _, f := range []**string{&c.ProvinciaTexto, &c.CiudadTexto, &c.Correo2, &c.Numero,
		&c.CalleSecundaria, &c.Sector, &c.Referencia, &c.TelefonoDomicilio} {
		*f = limpiar(*f)
	}
	c.TelefonoCelular = strings.TrimSpace(c.TelefonoCelular)
	c.Correo1 = strings.ToLower(strings.TrimSpace(c.Correo1))
	c.CallePrincipal = strings.TrimSpace(c.CallePrincipal)
	if c.Correo2 != nil {
		lower := strings.ToLower(*c.Correo2)
		c.Correo2 = &lower
	}

	errs := campos{}
	nombrePais := ""
	if c.PaisID <= 0 {
		errs["paisId"] = "Es obligatorio"
	} else {
		n, err := s.catalogos.PaisNombre(ctx, c.PaisID)
		switch {
		case errors.Is(err, repository.ErrNotFound):
			errs["paisId"] = "País inexistente"
		case err != nil:
			return err
		}
		nombrePais = n
	}

	if nombrePais == paisEcuador {
		c.ProvinciaTexto, c.CiudadTexto = nil, nil
		if c.ProvinciaID == nil || *c.ProvinciaID <= 0 {
			errs["provinciaId"] = "Es obligatoria"
		}
		if c.CantonID == nil || *c.CantonID <= 0 {
			errs["cantonId"] = "Es obligatorio"
		}
		if errs["provinciaId"] == "" && errs["cantonId"] == "" {
			ok, err := s.catalogos.CantonEnProvincia(ctx, c.PaisID, *c.ProvinciaID, *c.CantonID)
			if err != nil {
				return err
			}
			if !ok {
				errs["cantonId"] = "El cantón no pertenece a la provincia seleccionada"
			}
		}
	} else if nombrePais != "" {
		c.ProvinciaID, c.CantonID = nil, nil
		errs.req("provinciaTexto", deref(c.ProvinciaTexto), 80)
		errs.req("ciudadTexto", deref(c.CiudadTexto), 80)
	}

	errs.telefono("telefonoCelular", c.TelefonoCelular, true)
	errs.telefono("telefonoDomicilio", deref(c.TelefonoDomicilio), false)
	errs.email("correo1", c.Correo1, true)
	errs.email("correo2", deref(c.Correo2), false)
	errs.req("callePrincipal", c.CallePrincipal, 150)
	errs.opt("numero", c.Numero, 20)
	errs.opt("calleSecundaria", c.CalleSecundaria, 150)
	errs.opt("sector", c.Sector, 100)
	errs.opt("referencia", c.Referencia, 250)
	return errs.err()
}

// EliminarContacto borra el domicilio guardado (1.2).
func (s *PostulacionService) EliminarContacto(ctx context.Context, usuarioID int64) (*domain.Postulacion, error) {
	return s.editarBorrador(ctx, usuarioID, "ELIMINAR_CONTACTO", func(ctx context.Context, p *domain.Postulacion) error {
		return s.repo.DeleteContacto(ctx, p.ID)
	})
}

// GuardarFamiliares (1.3): reemplazo transaccional de la lista completa.
func (s *PostulacionService) GuardarFamiliares(ctx context.Context, usuarioID int64, tiene bool, items []domain.Familiar) (*domain.Postulacion, error) {
	if !tiene {
		items = nil
	}
	return s.editarBorrador(ctx, usuarioID, "ACTUALIZAR_FAMILIARES", func(ctx context.Context, p *domain.Postulacion) error {
		if err := validarFamiliares(tiene, items); err != nil {
			return err
		}
		return s.repo.ReplaceFamiliares(ctx, p.ID, tiene, items)
	})
}

func validarFamiliares(tiene bool, items []domain.Familiar) error {
	errs := campos{}
	if tiene && len(items) == 0 {
		errs["items"] = "Agregue al menos un familiar o indique que no tiene"
	}
	if len(items) > maxFamiliares {
		errs["items"] = fmt.Sprintf("Máximo %d registros", maxFamiliares)
	}
	for i := range items {
		f := &items[i]
		k := fmt.Sprintf("items[%d].", i)
		f.NombresApellidos, f.Area, f.Cargo = strings.TrimSpace(f.NombresApellidos), strings.TrimSpace(f.Area), strings.TrimSpace(f.Cargo)
		f.Institucion = strings.ToUpper(strings.TrimSpace(f.Institucion))
		errs.req(k+"nombresApellidos", f.NombresApellidos, 200)
		errs.req(k+"area", f.Area, 150)
		errs.req(k+"cargo", f.Cargo, 150)
		if f.ParentescoID <= 0 {
			errs[k+"parentescoId"] = "Es obligatorio"
		}
		if f.Institucion != "IESS" && f.Institucion != "BIESS" {
			errs[k+"institucion"] = "Debe ser IESS o BIESS"
		}
	}
	return errs.err()
}

// editarBorrador ejecuta fn dentro de una transacción con la fila de la postulación
// bloqueada (FOR UPDATE), solo si sigue en BORRADOR, y registra la acción en el historial.
// fn valida y luego escribe: así una postulación ENVIADA/CERRADA siempre responde 422.
// Al terminar devuelve la postulación completa actualizada.
func (s *PostulacionService) editarBorrador(ctx context.Context, usuarioID int64, accion string,
	fn func(ctx context.Context, p *domain.Postulacion) error) (*domain.Postulacion, error) {

	if err := s.exigirFormularioAbierto(ctx); err != nil {
		return nil, err
	}
	err := s.tx.WithTx(ctx, func(ctx context.Context) error {
		p, err := s.repo.FindByUsuario(ctx, usuarioID, true)
		if errors.Is(err, repository.ErrNotFound) {
			return domain.NewError(domain.ErrNoEncontrado, "Aún no ha iniciado su postulación")
		}
		if err != nil {
			return err
		}
		if p.Estado != domain.EstadoBorrador {
			return domain.NewError(domain.ErrReglaNegocio,
				fmt.Sprintf("La postulación %s está %s y ya no admite cambios", p.Codigo, p.Estado)).
				WithDetail("estado", p.Estado)
		}
		if err := fn(ctx, p); err != nil {
			return err
		}
		return s.repo.AddHistorial(ctx, p.ID, accion, "")
	})
	if errors.Is(err, repository.ErrReferencia) {
		return nil, domain.NewError(domain.ErrValidacion, "Uno de los valores seleccionados no existe en el catálogo")
	}
	if err != nil {
		return nil, err
	}
	return s.Obtener(ctx, usuarioID)
}
