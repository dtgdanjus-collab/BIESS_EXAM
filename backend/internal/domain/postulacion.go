package domain

import "time"

type EstadoPostulacion string

const (
	EstadoBorrador EstadoPostulacion = "BORRADOR"
	EstadoEnviada  EstadoPostulacion = "ENVIADA"
	EstadoCerrada  EstadoPostulacion = "CERRADA"
)

// Postulacion es el agregado completo que devuelve GET /postulacion.
type Postulacion struct {
	ID                     int64             `json:"id"`
	UsuarioID              int64             `json:"-"`
	Codigo                 string            `json:"codigo"`
	Estado                 EstadoPostulacion `json:"estado"`
	MotivoCierre           *string           `json:"motivoCierre"`
	SectorCodigo           *string           `json:"sectorCodigo"`
	TieneRespaldo          *bool             `json:"tieneRespaldo"`
	OrganizacionNombre     *string           `json:"organizacionNombre"`
	TieneFamiliares        *bool             `json:"tieneFamiliares"`
	TienePublicaciones     *bool             `json:"tienePublicaciones"`
	PosibleInhabilidad     bool              `json:"posibleInhabilidad"`
	ConsentimientoAceptado bool              `json:"consentimientoAceptado"`
	ConsentimientoFecha    *time.Time        `json:"consentimientoFecha"`
	FechaEnvio             *time.Time        `json:"fechaEnvio"`
	DatosConfirmadosEn     *time.Time        `json:"datosConfirmadosEn"`
	CreadoEn               time.Time         `json:"creadoEn"`
	ActualizadoEn          time.Time         `json:"actualizadoEn"`

	DatosPersonales  *DatosPersonales       `json:"datosPersonales"`
	Contacto         *Contacto              `json:"contacto"`
	Familiares       []Familiar             `json:"familiares"`
	Formacion        []Formacion            `json:"formacion"`
	Experiencia      []Experiencia          `json:"experiencia"`
	ExperienciaTotal ExperienciaTotal       `json:"experienciaTotal"`
	Publicaciones    []Publicacion          `json:"publicaciones"`
	Capacitaciones   []Capacitacion         `json:"capacitaciones"`
	Inhabilidades    []RespuestaInhabilidad `json:"inhabilidades"`
}

// Formacion (1.5): títulos académicos.
type Formacion struct {
	ID               int64  `json:"id"`
	NivelID          int    `json:"nivelId"`
	Institucion      string `json:"institucion"`
	Tipo             string `json:"tipo"` // NACIONAL | EXTRANJERA
	Titulo           string `json:"titulo"`
	AreaID           int    `json:"areaId"`
	RegistroSenescyt string `json:"registroSenescyt"`
	FechaRegistro    Fecha  `json:"fechaRegistro"`
}

// Experiencia (1.6). Duracion se calcula, no se guarda.
type Experiencia struct {
	ID          int64    `json:"id"`
	Tipo        string   `json:"tipo"` // GENERAL | DIRECCION
	Cargo       string   `json:"cargo"`
	Institucion string   `json:"institucion"`
	FechaInicio Fecha    `json:"fechaInicio"`
	FechaFin    Fecha    `json:"fechaFin"`
	AreaID      int      `json:"areaId"`
	Descripcion string   `json:"descripcion"`
	Duracion    Duracion `json:"duracion" db:"-"`
}

type ExperienciaTotal struct {
	General   Duracion `json:"general"`
	Direccion Duracion `json:"direccion"`
	Total     Duracion `json:"total"`
}

// Publicacion (1.7).
type Publicacion struct {
	ID          int64  `json:"id"`
	Titulo      string `json:"titulo"`
	Tipo        string `json:"tipo"` // PUBLICACION | INVESTIGACION
	Medio       string `json:"medio"`
	Fecha       Fecha  `json:"fecha"`
	Relacionada bool   `json:"relacionada"`
}

// Capacitacion (1.8).
type Capacitacion struct {
	ID          int64  `json:"id"`
	Tipo        string `json:"tipo"` // CURSO | SEMINARIO | TALLER
	Nombre      string `json:"nombre"`
	Institucion string `json:"institucion"`
	FechaInicio Fecha  `json:"fechaInicio"`
	FechaFin    Fecha  `json:"fechaFin"`
	Horas       int    `json:"horas"`
}

// RespuestaInhabilidad (1.9). Detalle solo aplica a la pregunta 1.9.7 cuando la respuesta es Sí.
type RespuestaInhabilidad struct {
	PreguntaID int              `json:"preguntaId"`
	Respuesta  bool             `json:"respuesta"`
	Detalle    *DetalleRemocion `json:"detalle"`
}

type DetalleRemocion struct {
	Institucion string `json:"institucion"`
	Cargo       string `json:"cargo"`
	FechaFin    Fecha  `json:"fechaFin"`
	Motivo      string `json:"motivo"`
}

// DatosPersonales (1.1): copia del Registro Civil que el postulante corrige una sola vez.
type DatosPersonales struct {
	Cedula          string  `json:"cedula"`
	Nombres         string  `json:"nombres"`
	Apellidos       string  `json:"apellidos"`
	Genero          string  `json:"genero"`
	FechaNacimiento Fecha   `json:"fechaNacimiento"`
	Nacionalidad    string  `json:"nacionalidad"`
	EstadoCivil     string  `json:"estadoCivil"`
	ConyugeNombres  *string `json:"conyugeNombres"`
	ConyugeCedula   *string `json:"conyugeCedula"`
}

// Contacto (1.2): domicilio y medios de contacto.
type Contacto struct {
	PaisID            int     `json:"paisId"`
	ProvinciaID       *int    `json:"provinciaId"`
	CantonID          *int    `json:"cantonId"`
	ProvinciaTexto    *string `json:"provinciaTexto"`
	CiudadTexto       *string `json:"ciudadTexto"`
	TelefonoCelular   string  `json:"telefonoCelular"`
	Correo1           string  `json:"correo1"`
	Correo2           *string `json:"correo2"`
	CallePrincipal    string  `json:"callePrincipal"`
	Numero            *string `json:"numero"`
	CalleSecundaria   *string `json:"calleSecundaria"`
	Sector            *string `json:"sector"`
	Referencia        *string `json:"referencia"`
	TelefonoDomicilio *string `json:"telefonoDomicilio"`
}

// Familiar (1.3): familiares que laboran en IESS/BIESS.
type Familiar struct {
	ID               int64  `json:"id"`
	NombresApellidos string `json:"nombresApellidos"`
	ParentescoID     int    `json:"parentescoId"`
	Institucion      string `json:"institucion"` // IESS | BIESS
	Area             string `json:"area"`
	Cargo            string `json:"cargo"`
}
