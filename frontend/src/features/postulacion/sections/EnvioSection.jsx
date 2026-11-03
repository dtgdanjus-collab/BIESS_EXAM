import { useState } from 'react'
import { postulacionApi } from '../../../api/postulacion'
import { Alert, Button, Card, Checkbox, ErrorAlert, Modal } from '../../../components/ui'
import { Comprobante } from '../Comprobante'
import { useFormulario, useGuardarSeccion } from '../components'
import { PUNTOS_CONSENTIMIENTO } from '../consentimiento'
import { SECCIONES } from '../secciones'

// Secciones que el backend exige antes de enviar (la capacitación es opcional).
const OBLIGATORIAS = ['personal', 'contacto', 'familiares', 'cargo', 'formacion', 'experiencia', 'publicaciones', 'inhabilidades']

// 1.10 — Consentimiento y envío (transacción principal en el backend).
export function EnvioSection() {
  const { postulacion, irA } = useFormulario()
  const peticion = useGuardarSeccion()
  const [acepta, setAcepta] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  if (postulacion.estado === 'ENVIADA') return <Comprobante postulacion={postulacion} celebrar={peticion.success} />

  const faltantes = SECCIONES.filter((s) => OBLIGATORIAS.includes(s.id) && !s.completa(postulacion))
  const faltantesBackend = peticion.error?.details?.faltantes

  const enviar = async () => {
    setConfirmar(false)
    const r = await peticion.guardar(postulacionApi.enviar)
    // Lo primero que debe verse tras enviar es el código único, arriba del todo.
    if (r.ok) window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Card
      numeral="1.10"
      title="Consentimiento y envío"
      description="Revise su postulación, acepte la declaración y envíela. Después no podrá modificarla."
    >
      <div className="space-y-6">
        {faltantes.length > 0 ? (
          <Alert type="warning" title="Complete las siguientes secciones antes de enviar">
            <ul className="mt-1 space-y-0.5">
              {faltantes.map((s) => (
                <li key={s.id}>
                  <button type="button" className="font-medium underline" onClick={() => irA(s.id)}>
                    {s.numeral} {s.titulo}
                  </button>
                </li>
              ))}
            </ul>
          </Alert>
        ) : (
          <Alert type="success">Todas las secciones obligatorias están completas.</Alert>
        )}

        <div>
          <p className="mb-2 text-sm font-medium">Declaración y consentimiento</p>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed marker:tabular-nums marker:text-tenue">
            {PUNTOS_CONSENTIMIENTO.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </div>

        <Checkbox
          label="He leído y acepto la declaración y el consentimiento para el tratamiento de mis datos personales."
          checked={acepta}
          onChange={(e) => setAcepta(e.target.checked)}
        />

        {faltantesBackend ? (
          <Alert type="error" title={peticion.error.message}>
            Faltan: {faltantesBackend.join(', ')}
          </Alert>
        ) : (
          <ErrorAlert error={peticion.error} />
        )}

        <div className="flex justify-end">
          <Button
            onClick={() => setConfirmar(true)}
            disabled={!acepta || faltantes.length > 0}
            loading={peticion.loading}
            className="w-full sm:w-auto"
          >
            Enviar postulación
          </Button>
        </div>
      </div>

      <Modal
        open={confirmar}
        onClose={() => setConfirmar(false)}
        title="¿Enviar la postulación?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmar(false)}>
              Revisar de nuevo
            </Button>
            <Button onClick={enviar}>Sí, enviar</Button>
          </>
        }
      >
        Una vez enviada, la postulación <strong className="font-mono font-medium">{postulacion.codigo}</strong> ya no podrá modificarse.
      </Modal>
    </Card>
  )
}
