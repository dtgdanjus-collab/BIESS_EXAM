package domain

import "time"

// Roles del módulo de administración.
const (
	RolAdministrador = "ADMINISTRADOR" // Comisión de Selección
	RolAnalista      = "ANALISTA"      // Talento Humano
)

// Estados del postulante en el concurso.
const (
	ConcursoPostulado         = "POSTULADO"
	ConcursoNoSuperaMeritos   = "NO_SUPERA_MERITOS"
	ConcursoEvaluacionTecnica = "EVALUACION_TECNICA"
)

// Fases del concurso que tienen reglas propias en el sistema.
const (
	FasePostulacion     = "POSTULACION"
	FaseReconsideracion = "RECONSIDERACION"
)

type Administrador struct {
	ID           int64  `json:"id"`
	Usuario      string `json:"usuario"`
	Nombre       string `json:"nombre"`
	Rol          string `json:"rol"`
	PasswordHash string `json:"-"`
	Activo       bool   `json:"activo"`
}

// Fase es una etapa del concurso que el administrador publica (EF-13.1).
type Fase struct {
	Codigo      string     `json:"codigo"`
	Nombre      string     `json:"nombre"`
	Orden       int        `json:"orden"`
	Descripcion *string    `json:"descripcion"`
	Publicada   bool       `json:"publicada"`
	FechaInicio *time.Time `json:"fechaInicio"`
	FechaFin    *time.Time `json:"fechaFin"`
}

// Vigente indica si la fecha cae dentro de la fase; una fecha sin definir no limita.
func (f Fase) Vigente(ahora time.Time) bool {
	return (f.FechaInicio == nil || !ahora.Before(*f.FechaInicio)) && (f.FechaFin == nil || !ahora.After(*f.FechaFin))
}

type ConcursoConfig struct {
	FormularioHabilitado bool         `json:"formularioHabilitado"`
	PlazoRespuestaDias   int          `json:"plazoRespuestaDias"` // Talento Humano
	PlazoComisionDias    int          `json:"plazoComisionDias"`
	TablaMeritos         TablaMeritos `json:"tablaMeritos"`
}

// TablaMeritos son los puntajes de la fase de méritos y lo que se exige para ser elegible. El
// requerimiento no trae estos valores: los define la Comisión.
type TablaMeritos struct {
	PuntosPorNivel      map[string]float64 `json:"puntosPorNivel"` // por id de nivel de instrucción
	TopeFormacion       float64            `json:"topeFormacion"`
	PuntosAnioGeneral   float64            `json:"puntosAnioGeneral"`
	PuntosAnioDireccion float64            `json:"puntosAnioDireccion"`
	TopeExperiencia     float64            `json:"topeExperiencia"`
	PuntosPublicacion   float64            `json:"puntosPublicacion"`
	TopePublicaciones   float64            `json:"topePublicaciones"`
	PuntosHora          float64            `json:"puntosHora"`
	TopeCapacitacion    float64            `json:"topeCapacitacion"`
	PesoMeritos         float64            `json:"pesoMeritos"`
	PesoTeorica         float64            `json:"pesoTeorica"`
	PesoPsicotecnica    float64            `json:"pesoPsicotecnica"`
	NotaMinima          float64            `json:"notaMinima"`
}

// Configurada indica si la Comisión ya asignó puntos a algún rubro.
func (t TablaMeritos) Configurada() bool {
	for _, v := range t.PuntosPorNivel {
		if v > 0 {
			return true
		}
	}
	return t.PuntosAnioGeneral > 0 || t.PuntosAnioDireccion > 0 || t.PuntosPublicacion > 0 || t.PuntosHora > 0
}

// Evento es una línea de la bitácora: lo que hizo una cuenta del módulo o un postulante.
type Evento struct {
	CreadoEn time.Time `json:"creadoEn"`
	Actor    string    `json:"actor"`
	Rol      string    `json:"rol"`
	Accion   string    `json:"accion"`
	Detalle  *string   `json:"detalle"`
	Codigo   *string   `json:"codigo"`
}

// ResumenCargo es una fila del dashboard (EF-13.3).
type ResumenCargo struct {
	SectorCodigo string `json:"sectorCodigo"`
	Cargo        string `json:"cargo"`
	Enviadas     int    `json:"enviadas"`
	Borradores   int    `json:"borradores"`
}

type Dashboard struct {
	Cargos      []ResumenCargo `json:"cargos"`
	SinCargo    int            `json:"sinCargo"`
	Cerradas    int            `json:"cerradas"`
	Inhabilidad int            `json:"posibleInhabilidad"`
	Cuentas     int            `json:"cuentas"`
	Generado    time.Time      `json:"generado"`
}

// FiltroPostulantes acota la nómina; un valor vacío no filtra.
type FiltroPostulantes struct {
	Sector         string
	Estado         string
	EstadoConcurso string
	Busqueda       string
}

// Postulante es una fila de la nómina del módulo de administración.
type Postulante struct {
	PostulacionID      int64      `json:"postulacionId"`
	UsuarioID          int64      `json:"-"`
	Codigo             string     `json:"codigo"`
	Estado             string     `json:"estado"`
	SectorCodigo       *string    `json:"sectorCodigo"`
	Cargo              *string    `json:"cargo"`
	Cedula             string     `json:"cedula"`
	Nombres            string     `json:"nombres"`
	Apellidos          string     `json:"apellidos"`
	Email              string     `json:"email"`
	FechaEnvio         *time.Time `json:"fechaEnvio"`
	PosibleInhabilidad bool       `json:"posibleInhabilidad"`
	EstadoConcurso     string     `json:"estadoConcurso"`
	PuntajeMeritos     *float64   `json:"puntajeMeritos"`
	NotaTeorica        *float64   `json:"notaTeorica"`
	NotaPsicotecnica   *float64   `json:"notaPsicotecnica"`
	Observacion        *string    `json:"observacion"`
}

// Calificacion es lo que Talento Humano registra de un postulante.
type Calificacion struct {
	EstadoConcurso   string   `json:"estadoConcurso"`
	PuntajeMeritos   *float64 `json:"puntajeMeritos"`
	NotaPsicotecnica *float64 `json:"notaPsicotecnica"`
	Observacion      *string  `json:"observacion"`
}

// PreguntaEvaluacion es una pregunta del banco; Correcta es el índice de la opción.
type PreguntaEvaluacion struct {
	ID        int64    `json:"id"`
	Enunciado string   `json:"enunciado"`
	Opciones  []string `json:"opciones"`
	Correcta  int      `json:"correcta"`
	Activa    bool     `json:"activa"`
}

type EvaluacionConfig struct {
	NumPreguntas    int        `json:"numPreguntas"`
	DuracionMinutos int        `json:"duracionMinutos"`
	Inicio          *time.Time `json:"inicio"`
	Fin             *time.Time `json:"fin"`
}

// Intento es el examen de un postulante.
type Intento struct {
	ID            int64      `json:"id"`
	PostulacionID int64      `json:"-"`
	IniciadoEn    time.Time  `json:"iniciadoEn"`
	ExpiraEn      time.Time  `json:"expiraEn"`
	FinalizadoEn  *time.Time `json:"finalizadoEn"`
	Forzado       bool       `json:"forzado"`
	Total         int        `json:"total"`
	Correctas     *int       `json:"correctas"`
	Nota          *float64   `json:"nota"`
}

// PreguntaExamen es lo que ve el postulante: nunca incluye la respuesta correcta.
type PreguntaExamen struct {
	Orden     int      `json:"orden"`
	Enunciado string   `json:"enunciado"`
	Opciones  []string `json:"opciones"`
}

// ResultadoEvaluacion es el examen de un postulante visto desde administración y en su reporte.
type ResultadoEvaluacion struct {
	PostulacionID int64   `json:"postulacionId"`
	Codigo        string  `json:"codigo"`
	Cedula        string  `json:"cedula"`
	Nombres       string  `json:"nombres"`
	Apellidos     string  `json:"apellidos"`
	Email         string  `json:"email"`
	Cargo         *string `json:"cargo"`
	Intento
}

// Reconsideracion es la solicitud de un postulante sobre el resultado de una etapa.
type Reconsideracion struct {
	ID             int64      `json:"id"`
	PostulacionID  int64      `json:"postulacionId"`
	Etapa          string     `json:"etapa"`
	Motivo         string     `json:"motivo"`
	Estado         string     `json:"estado"`
	Respuesta      *string    `json:"respuesta"`
	ResponderAntes time.Time  `json:"responderAntes"`
	RespondidaEn   *time.Time `json:"respondidaEn"`
	RespondidaPor  *string    `json:"respondidaPor"`
	CreadoEn       time.Time  `json:"creadoEn"`
	InformeAntes   time.Time  `json:"informeAntes"`
	Informe        *string    `json:"informe,omitempty"`
	InformePor     *string    `json:"informePor,omitempty"`
	InformeEn      *time.Time `json:"informeEn,omitempty"`
	Codigo         string     `json:"codigo" db:"-"`
	Nombres        string     `json:"nombres" db:"-"`
	Cedula         string     `json:"cedula" db:"-"`
	Email          string     `json:"-" db:"-"`
}

// FormularioFinal es el formulario completo (1.10) ya con los nombres de los catálogos: lo usan
// la pantalla, el correo al postulante y el módulo de administración.
type FormularioFinal struct {
	Codigo         string              `json:"codigo"`
	Estado         EstadoPostulacion   `json:"estado"`
	FechaEnvio     *time.Time          `json:"fechaEnvio"`
	Secciones      []SeccionFormulario `json:"secciones"`
	Consentimiento []string            `json:"consentimiento"`
	FirmaNombres   string              `json:"firmaNombres"`
	FirmaCedula    string              `json:"firmaCedula"`
}

type SeccionFormulario struct {
	Numeral   string               `json:"numeral"`
	Titulo    string               `json:"titulo"`
	Campos    []CampoFormulario    `json:"campos"`
	Registros []RegistroFormulario `json:"registros"`
}

type RegistroFormulario struct {
	Titulo string            `json:"titulo"`
	Campos []CampoFormulario `json:"campos"`
}

type CampoFormulario struct {
	Etiqueta  string     `json:"etiqueta"`
	Valor     string     `json:"valor"`
	Documento *Documento `json:"documento,omitempty"`
}
