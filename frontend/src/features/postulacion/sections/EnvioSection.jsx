import { useState } from 'react'
import { postulacionApi } from '../../../api/postulacion'
import { Alert, Button, Card, Checkbox, ErrorAlert, Modal } from '../../../components/ui'
import { Comprobante } from '../Comprobante'
import { useFormulario, useGuardarSeccion } from '../components'
import { PUNTOS_CONSENTIMIENTO } from '../consentimiento'
import { SECCIONES } from '../secciones'

// Secciones que el backend exige antes de enviar (la capacitación es opcional).
const OBLIGATORIAS = ['contacto', 'familiares', 'cargo', 'formacion', 'experiencia', 'publicaciones', 'inhabilidades']

// 1.10 — Consentimiento y envío (transacción principal en el backend).
export function EnvioSection() {
  const { postulacion, irA } = useFormulario()
  const peticion = useGuardarSeccion()
  const [acepta, setAcepta] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  if (postulacion.estado === 'ENVIADA') return <Comprobante postulacion={postulacion} />

  const faltantes = SECCIONES.filter((s) => OBLIGATORIAS.includes(s.id) && !s.completa(postulacion))
  const faltantesBackend = peticion.error?.details?.faltantes

  const enviar = async () => {
    setConfirmar(false)
    await peticion.guardar(postulacionApi.enviar)
  }

  return (
    <Card title={<span><span className="mr-2 text-brand-700">1.10</span>Consentimiento y envío</span>}>
      <div className="space-y-5">
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

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-sm font-semibold text-slate-800">Declaración y consentimiento</p>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
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

        <div className="flex justify-end border-t border-slate-100 pt-5">
          <Button
            onClick={() => setConfirmar(true)}
            disabled={!acepta || faltantes.length > 0}
            loading={peticion.loading}
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
        Una vez enviada, la postulación <strong>{postulacion.codigo}</strong> ya no podrá modificarse.
      </Modal>
    </Card>
  )
}
