import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../api/admin'
import { Alert, Button, ErrorAlert, Input, PageLoader } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useCatalogo } from '../../hooks/useCatalogo'
import { useTituloPagina } from '../../hooks/useTituloPagina'
import { guardarArchivo } from '../../utils/descargas'
import { formatoInstante } from '../concurso/componentes'
import { nota, Panel, Tabla, Titulo } from './comunes'

/** Lista de elegibles por cargo, de mayor a menor nota final (EF-1). */
export function ElegiblesPage() {
  useTituloPagina('Elegibles')
  const carga = useAsync()
  const exportar = useAsync()
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    carga.run(adminApi.elegibles).then((r) => r.ok && setDatos(r.data))
  }, [carga.run])

  if (!datos) return carga.error ? <ErrorAlert error={carga.error} /> : <PageLoader />

  const bajar = async (tipo) => {
    const r = await exportar.run(() => (tipo === 'xlsx' ? adminApi.elegiblesXlsx() : adminApi.elegiblesPdf()))
    if (r.ok) guardarArchivo(r.data, `lista-elegibles.${tipo}`)
  }
  const cargos = [...new Set(datos.filas.map((f) => f.cargo))]
  const [pm, pt, pp] = datos.pesos
  const pesos = pm + pt + pp > 0 ? `méritos ${pm}, teórica ${pt}, psicotécnica ${pp}` : 'las tres fases pesan igual'

  return (
    <div className="space-y-6">
      <Titulo texto="Lista de elegibles" detalle={`Nota final: ${pesos}. Nota mínima: ${datos.notaMinima}.`}>
        <Button variant="secondary" onClick={() => bajar('xlsx')} disabled={exportar.loading}>Exportar Excel</Button>
        <Button variant="secondary" onClick={() => bajar('pdf')} disabled={exportar.loading}>Exportar PDF</Button>
      </Titulo>
      <ErrorAlert error={exportar.error} />
      {datos.pendientes > 0 && <Alert type="info">{datos.pendientes} postulantes superaron méritos, pero aún les falta alguna nota.</Alert>}
      {datos.bajoMinimo > 0 && <Alert type="info">{datos.bajoMinimo} postulantes no alcanzan la nota mínima.</Alert>}
      {cargos.length === 0 && (
        <Panel>
          <p className="text-sm text-tenue">Aún no hay postulantes con las tres notas.</p>
        </Panel>
      )}
      {cargos.map((cargo) => (
        <Panel key={cargo} titulo={cargo}>
          <Tabla
            columnas={['Puesto', 'Postulante', 'Cédula', 'Méritos', 'Teórica', 'Psicot.', 'Nota final']}
            filas={datos.filas.filter((f) => f.cargo === cargo).map((f) => [
              <span className="font-medium tabular-nums">{f.puesto}</span>,
              <span>
                <Link className="underline underline-offset-4" to={`/admin/postulantes/${f.postulacionId}`}>{f.apellidos} {f.nombres}</Link>
                {f.posibleInhabilidad && <span className="ml-2 whitespace-nowrap rounded bg-mal-fondo px-1.5 py-0.5 text-xs text-mal-tinta">Posible inhabilidad</span>}
              </span>,
              <span className="tabular-nums">{f.cedula}</span>,
              nota(f.puntajeMeritos),
              nota(f.notaTeorica),
              nota(f.notaPsicotecnica),
              <span className="font-medium tabular-nums">{f.total.toFixed(2)}</span>,
            ])}
          />
        </Panel>
      ))}
    </div>
  )
}

const CAMPOS_TABLA = [
  ['Experiencia', [['puntosAnioGeneral', 'Puntos por año de experiencia general'], ['puntosAnioDireccion', 'Puntos por año en dirección'], ['topeExperiencia', 'Máximo del rubro']]],
  ['Publicaciones', [['puntosPublicacion', 'Puntos por publicación'], ['topePublicaciones', 'Máximo del rubro']]],
  ['Capacitación', [['puntosHora', 'Puntos por hora'], ['topeCapacitacion', 'Máximo del rubro']]],
  ['Lista de elegibles', [['pesoMeritos', 'Peso de méritos'], ['pesoTeorica', 'Peso de la teórica'], ['pesoPsicotecnica', 'Peso de la psicotécnica'], ['notaMinima', 'Nota mínima (0 a 100)']]],
]

const aNumero = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v))

/** La Comisión define la tabla; el sistema calcula con ella los méritos de cada postulante (EF-1). */
export function PuntajesPage() {
  useTituloPagina('Puntajes')
  const niveles = useCatalogo('niveles')
  const carga = useAsync()
  const guardado = useAsync()
  const calculo = useAsync()
  const [v, setV] = useState(null)

  useEffect(() => {
    carga.run(adminApi.concurso).then((r) => r.ok && setV({ ...r.data.config.tablaMeritos, puntosPorNivel: r.data.config.tablaMeritos.puntosPorNivel ?? {} }))
  }, [carga.run])

  if (!v) return carga.error ? <ErrorAlert error={carga.error} /> : <PageLoader />

  const campos = guardado.error?.details?.campos
  const cambiar = (c) => (e) => setV((x) => ({ ...x, [c]: e.target.value }))
  const cambiarNivel = (id) => (e) => setV((x) => ({ ...x, puntosPorNivel: { ...x.puntosPorNivel, [id]: e.target.value } }))
  const numerico = (c) => (e) => e.target.value !== '' && cambiar(c)(e)

  const guardar = async (e) => {
    e.preventDefault()
    calculo.reset()
    const cuerpo = Object.fromEntries(CAMPOS_TABLA.flatMap(([, f]) => f).map(([c]) => [c, aNumero(v[c])]))
    await guardado.run(() =>
      adminApi.guardarTablaMeritos({
        ...cuerpo,
        topeFormacion: aNumero(v.topeFormacion),
        puntosPorNivel: Object.fromEntries(Object.entries(v.puntosPorNivel).map(([k, x]) => [k, aNumero(x)])),
      }),
    )
  }

  return (
    <div className="space-y-6">
      <Titulo texto="Tabla de puntajes" detalle="El requerimiento no fija estos valores: los define la Comisión según la Resolución C.D. 701.">
        <Button variant="secondary" loading={calculo.loading} onClick={() => calculo.run(adminApi.recalcularMeritos)}>Calcular méritos</Button>
      </Titulo>
      <ErrorAlert error={calculo.error} />
      {calculo.success && <Alert type="success">Se calcularon {calculo.data.calculadas} postulaciones en revisión. Las ya decididas no cambian.</Alert>}
      <form onSubmit={guardar} noValidate className="space-y-6">
        <Panel titulo="Formación">
          <div className="grid gap-4 sm:grid-cols-2">
            {niveles.data.map((n) => (
              <Input key={n.id} label={`Puntos por título: ${n.nombre}`} type="number" min={0} step="any" value={v.puntosPorNivel[n.id] ?? ''} error={campos?.[`puntosPorNivel.${n.id}`]} onChange={cambiarNivel(n.id)} />
            ))}
            <Input label="Máximo del rubro" type="number" min={0} step="any" value={v.topeFormacion ?? ''} error={campos?.topeFormacion} onChange={cambiar('topeFormacion')} />
          </div>
        </Panel>
        {CAMPOS_TABLA.map(([titulo, lista]) => (
          <Panel key={titulo} titulo={titulo}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {lista.map(([c, etiqueta]) => (
                <Input key={c} label={etiqueta} type="number" min={0} step="any" value={v[c] ?? ''} error={campos?.[c]} onChange={cambiar(c)} onBlur={numerico(c)} />
              ))}
            </div>
          </Panel>
        ))}
        {!campos && <ErrorAlert error={guardado.error} />}
        {guardado.success && <Alert type="success">Tabla guardada. Pulse «Calcular méritos» para aplicarla a las postulaciones en revisión.</Alert>}
        <Button type="submit" loading={guardado.loading}>Guardar tabla</Button>
      </form>
    </div>
  )
}

const ACCIONES = {
  INICIAR_SESION: 'Inició sesión',
  CALIFICAR: 'Calificó',
  CAMBIAR_CONFIGURACION: 'Cambió la configuración',
  CAMBIAR_FASE: 'Cambió una fase',
  CAMBIAR_TABLA_MERITOS: 'Cambió la tabla de puntajes',
  RECALCULAR_MERITOS: 'Calculó los méritos',
  CREAR_PREGUNTA: 'Creó una pregunta',
  IMPORTAR_PREGUNTAS: 'Importó preguntas',
  EDITAR_PREGUNTA: 'Editó una pregunta',
  ELIMINAR_PREGUNTA: 'Eliminó una pregunta',
  CAMBIAR_EVALUACION: 'Cambió el examen',
  RESOLVER_RECONSIDERACION: 'Resolvió una reconsideración',
  INFORMAR_RECONSIDERACION: 'Informó una reconsideración',
  CREAR_CUENTA: 'Creó una cuenta',
  CAMBIAR_CUENTA: 'Activó o desactivó una cuenta',
  SOLICITAR_RECONSIDERACION: 'Solicitó una reconsideración',
  ENVIAR: 'Envió la postulación',
  GUARDAR_POSTULACION: 'Guardó la postulación',
  INICIAR_EVALUACION: 'Inició la evaluación',
  FINALIZAR_EVALUACION: 'Finalizó la evaluación',
}

export const nombreAccion = (a) => ACCIONES[a] ?? a.toLowerCase().replaceAll('_', ' ')

/** Tabla de eventos, compartida por la bitácora y el detalle de un postulante. */
export function TablaEventos({ eventos, conCodigo = true }) {
  return (
    <Tabla
      vacio="Sin registros."
      columnas={['Fecha', 'Quién', 'Acción', ...(conCodigo ? ['Postulación'] : []), 'Detalle']}
      filas={eventos.map((e) => [
        <span className="whitespace-nowrap tabular-nums">{formatoInstante(e.creadoEn)}</span>,
        <span>
          {e.actor}
          <span className="block text-xs text-tenue">{e.rol}</span>
        </span>,
        nombreAccion(e.accion),
        ...(conCodigo ? [<span className="whitespace-nowrap font-mono text-xs">{e.codigo ?? '—'}</span>] : []),
        <span className="block max-w-md break-words text-xs text-tenue">{e.detalle ?? '—'}</span>,
      ])}
    />
  )
}

/** Trazabilidad de las acciones del módulo y de los postulantes (EF-1). */
export function BitacoraPage() {
  useTituloPagina('Bitácora')
  const carga = useAsync()
  const [q, setQ] = useState('')
  const [lista, setLista] = useState([])

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await carga.run(() => adminApi.bitacora({ q }))
      if (r.ok) setLista(r.data)
    }, 250)
    return () => clearTimeout(t)
  }, [carga.run, q])

  return (
    <div className="space-y-6">
      <Titulo texto="Bitácora" detalle="Últimas 500 acciones, de la más reciente a la más antigua." />
      <div className="max-w-md">
        <Input label="Buscar" placeholder="Persona, acción o código" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorAlert error={carga.error} />
      <Panel>
        <TablaEventos eventos={lista} />
      </Panel>
    </div>
  )
}
