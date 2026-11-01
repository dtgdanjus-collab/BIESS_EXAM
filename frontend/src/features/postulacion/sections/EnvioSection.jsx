import { useState } from 'react'
import { postulacionApi } from '../../../api/postulacion'
import { Alert, Button, Card, Checkbox, ErrorAlert, Icon, Modal } from '../../../components/ui'
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
    <Card
      icono="send"
      eyebrow="Sección 1.10"
      title="Consentimiento y envío"
      description="Revise su postulación, acepte la declaración y envíela. Después no podrá modificarla."
      className="animate-fade-up"
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

        <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-5 sm:p-6">
          <p className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
            <Icon name="shield" className="size-5 text-brand-600" />
            Declaración y consentimiento
          </p>
          <ol className="space-y-3">
            {PUNTOS_CONSENTIMIENTO.map((p, i) => (
              <li key={p} className="flex gap-3 text-sm leading-relaxed text-slate-700">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
                  {i + 1}
                </span>
                {p}
              </li>
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

        <div className="flex justify-end border-t border-slate-100 pt-6">
          <Button
            onClick={() => setConfirmar(true)}
            disabled={!acepta || faltantes.length > 0}
            loading={peticion.loading}
            className="w-full sm:w-auto"
          >
            {!peticion.loading && <Icon name="send" className="size-4" />}
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
