package domain

// Item es un elemento genérico de catálogo (país, provincia, cantón, parentesco, área).
type Item struct {
	ID     int    `json:"id"`
	Nombre string `json:"nombre"`
}

type NivelInstruccion struct {
	ID     int    `json:"id"`
	Nombre string `json:"nombre"`
	Orden  int    `json:"orden"`
}

// Sector de representación (numeral 1.4) con los mensajes literales del requerimiento.
type Sector struct {
	Codigo           string `json:"codigo"`
	Cargo            string `json:"cargo"`
	TipoRequerido    string `json:"tipoRequerido"`
	EtiquetaCumple   string `json:"etiquetaCumple"`
	EtiquetaNoCumple string `json:"etiquetaNoCumple"`
	MensajeRechazo   string `json:"mensajeRechazo"`
	PreguntaRespaldo string `json:"preguntaRespaldo"`
}

// PreguntaInhabilidad (numeral 1.9). RespuestaEsperada es la respuesta que NO genera inhabilidad.
type PreguntaInhabilidad struct {
	ID                int    `json:"id"`
	Numeral           string `json:"numeral"`
	Texto             string `json:"texto"`
	RespuestaEsperada bool   `json:"respuestaEsperada"`
	RequiereDetalle   bool   `json:"requiereDetalle"`
	Orden             int    `json:"orden"`
}
