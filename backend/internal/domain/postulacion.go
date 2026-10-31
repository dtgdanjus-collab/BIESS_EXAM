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
	CreadoEn               time.Time         `json:"creadoEn"`
	ActualizadoEn          time.Time         `json:"actualizadoEn"`

	DatosPersonales *DatosPersonales `json:"datosPersonales"`
	Contacto        *Contacto        `json:"contacto"`
	Familiares      []Familiar       `json:"familiares"`
}

// DatosPersonales (1.1): copia de solo lectura del Registro Civil.
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
