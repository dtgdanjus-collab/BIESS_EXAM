import { useState } from 'react'
import { postulacionApi } from '../../../api/postulacion'
import { Alert, Button, Card, Checkbox, ErrorAlert, Icon, Modal } from '../../../components/ui'
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
          <Alert type="warning" title="Complete las siguientes secciones antes de enviar" />
        ) : (
          <Alert type="success">Todas las secciones obligatorias están completas.</Alert>
        )}

        <ul className="grid gap-x-6 sm:grid-cols-2">
          {SECCIONES.filter((s) => s.id !== 'envio').map((s) => {
            const lista = s.completa(postulacion)
            const falta = !lista && OBLIGATORIAS.includes(s.id)
            return (
              <li key={s.id} className="border-b border-regla">
                <button type="button" onClick={() => irA(s.id)} className="group flex min-h-12 w-full items-center gap-3 py-1.5 text-left text-sm">
                  <span className={`flex h-7 w-10 shrink-0 items-center justify-center text-xs font-medium tabular-nums ${lista ? 'bg-sello text-white' : falta ? 'bg-tinta text-white' : 'bg-realce text-tinta'}`}>
                    {lista ? <Icon name="check" className="size-4" strokeWidth={2.6} /> : s.numeral}
                  </span>
                  <span className="min-w-0 flex-1 group-hover:underline">{s.titulo}</span>
                  <span className={`shrink-0 text-xs ${falta ? 'font-medium text-mal' : 'text-tenue'}`}>{lista ? 'Listo' : falta ? 'Falta' : 'Opcional'}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="rounded-md bg-fondo p-4 sm:p-5">
          <h3 className="mb-3 text-base font-medium">Declaración y consentimiento</h3>
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
