import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../api/admin'
import { Alert, Button, Checkbox, ErrorAlert, Input, Modal, PageLoader, Select, Textarea } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useAdminStore } from '../../store/adminStore'
import { useTituloPagina } from '../../hooks/useTituloPagina'
import { guardarArchivo } from '../../utils/descargas'
import { formatoInstante } from '../concurso/componentes'
import { aIso, aLocal, nota, Panel, Tabla, Titulo } from './comunes'

function FilaFase({ fase, onGuardado }) {
  const peticion = useAsync()
  const [v, setV] = useState({
    publicada: fase.publicada,
    descripcion: fase.descripcion ?? '',
    fechaInicio: aLocal(fase.fechaInicio),
    fechaFin: aLocal(fase.fechaFin),
  })
  const campos = peticion.error?.details?.campos
  const guardar = async () => {
    const r = await peticion.run(() =>
      adminApi.guardarFase(fase.codigo, { publicada: v.publicada, descripcion: v.descripcion, fechaInicio: aIso(v.fechaInicio), fechaFin: aIso(v.fechaFin) }),
    )
    if (r.ok) onGuardado(r.data)
  }
  return (
    <div className="grid gap-3 border-b border-regla py-4 first:pt-0 last:border-b-0 last:pb-0 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div>
        <p className="text-sm font-medium">{fase.nombre}</p>
        <Checkbox className="mt-2" label="Publicada" checked={v.publicada} onChange={(e) => setV((x) => ({ ...x, publicada: e.target.checked }))} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Inicio" type="datetime-local" value={v.fechaInicio} error={campos?.fechaInicio} onChange={(e) => setV((x) => ({ ...x, fechaInicio: e.target.value }))} />
        <Input label="Fin" type="datetime-local" value={v.fechaFin} error={campos?.fechaFin} onChange={(e) => setV((x) => ({ ...x, fechaFin: e.target.value }))} />
        <Textarea label="Descripción para los postulantes" className="sm:col-span-2" maxLength={2000} value={v.descripcion} error={campos?.descripcion} onChange={(e) => setV((x) => ({ ...x, descripcion: e.target.value }))} />
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button variant="secondary" onClick={guardar} loading={peticion.loading}>Guardar fase</Button>
          {peticion.success && <span className="text-sm text-ok-tinta" role="status">Guardada</span>}
        </div>
        {!campos && <ErrorAlert error={peticion.error} className="sm:col-span-2" />}
      </div>
    </div>
  )
}

/** Publicar fases y habilitar el formulario (EF-13.1 y EF-13.2). */
export function FasesAdminPage() {
  useTituloPagina('Fases')
  const carga = useAsync()
  const config = useAsync()
  const [d, setD] = useState(null)

  useEffect(() => {
    carga.run(adminApi.concurso).then((r) => r.ok && setD(r.data))
  }, [carga.run])

  if (!d) return carga.error ? <ErrorAlert error={carga.error} /> : <PageLoader />

  const guardarConfig = async (cambios) => {
    const r = await config.run(() => adminApi.guardarConfig({ ...d.config, ...cambios }))
    if (r.ok) setD(r.data)
  }

  return (
    <div className="space-y-6">
      <Titulo texto="Fases del concurso" detalle="Lo publicado se ve en la página pública de fases y en el avance de cada postulante." />
      <Panel titulo="Formulario de postulación (EF-12)">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            {d.config.formularioHabilitado ? 'Habilitado: se puede postular dentro de las fechas de la fase Postulación.' : 'Deshabilitado: nadie puede iniciar ni modificar su postulación.'}
          </p>
          <Button variant={d.config.formularioHabilitado ? 'secondary' : 'primary'} loading={config.loading} onClick={() => guardarConfig({ formularioHabilitado: !d.config.formularioHabilitado })}>
            {d.config.formularioHabilitado ? 'Deshabilitar formulario' : 'Habilitar formulario'}
          </Button>
        </div>
        <div className="mt-4 grid max-w-xl gap-4 sm:grid-cols-2">
          <Input
            label="Plazo de Talento Humano para informar reconsideraciones (días)"
            type="number"
            min={1}
            defaultValue={d.config.plazoRespuestaDias}
            error={config.error?.details?.campos?.plazoRespuestaDias}
            onBlur={(e) => Number(e.target.value) !== d.config.plazoRespuestaDias && guardarConfig({ plazoRespuestaDias: Number(e.target.value) })}
          />
          <Input
            label="Plazo de la Comisión para resolverlas (días, tras el informe)"
            type="number"
            min={1}
            defaultValue={d.config.plazoComisionDias}
            error={config.error?.details?.campos?.plazoComisionDias}
            onBlur={(e) => Number(e.target.value) !== d.config.plazoComisionDias && guardarConfig({ plazoComisionDias: Number(e.target.value) })}
          />
        </div>
        <p className="mt-2 text-xs text-tenue">El plazo del postulante para solicitarlas son las fechas de la fase Reconsideraciones.</p>
        {!config.error?.details?.campos && <ErrorAlert error={config.error} className="mt-3" />}
      </Panel>
      <Panel titulo="Fases">
        {d.fases.map((f) => (
          <FilaFase key={f.codigo} fase={f} onGuardado={setD} />
        ))}
      </Panel>
    </div>
  )
}

/**
 * CSV separado por punto y coma: enunciado;opción 1;opción 2;…;número de la opción correcta.
 * Devuelve las preguntas o lanza un Error que dice qué línea está mal.
 */
export function leerPreguntasCsv(texto) {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  return lineas.map((linea, i) => {
    const partes = linea.split(';').map((p) => p.trim())
    const correcta = Number(partes.at(-1))
    const opciones = partes.slice(1, -1)
    if (partes.length < 4 || !partes[0] || !Number.isInteger(correcta) || correcta < 1 || correcta > opciones.length) {
      throw new Error(`Línea ${i + 1}: use enunciado;opción 1;opción 2;…;número de la correcta`)
    }
    return { enunciado: partes[0], opciones, correcta: correcta - 1, activa: true }
  })
}

const preguntaVacia = { enunciado: '', opciones: ['', '', '', ''], correcta: 0, activa: true }

function EditorPregunta({ pregunta, onCerrar, onGuardada }) {
  const peticion = useAsync()
  const [v, setV] = useState(() => ({ ...pregunta, opciones: pregunta.opciones.length ? pregunta.opciones : preguntaVacia.opciones }))
  const campos = peticion.error?.details?.campos
  const guardar = async () => {
    const r = await peticion.run(() => (v.id ? adminApi.guardarPregunta(v.id, v) : adminApi.crearPregunta(v)))
    if (r.ok) onGuardada()
  }
  const opciones = v.opciones.map((_, i) => ({ id: String(i), nombre: `Opción ${i + 1}` }))
  return (
    <Modal
      open
      onClose={onCerrar}
      title={v.id ? 'Editar pregunta' : 'Nueva pregunta'}
      footer={
        <>
          <Button variant="secondary" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} loading={peticion.loading}>Guardar</Button>
        </>
      }
    >
      <div className="space-y-3 text-left">
        <Textarea label="Enunciado" required maxLength={2000} value={v.enunciado} error={campos?.enunciado} onChange={(e) => setV((x) => ({ ...x, enunciado: e.target.value }))} />
        {v.opciones.map((o, i) => (
          <Input key={i} label={`Opción ${i + 1}`} value={o} onChange={(e) => setV((x) => ({ ...x, opciones: x.opciones.map((y, j) => (j === i ? e.target.value : y)) }))} />
        ))}
        {campos?.opciones && <Alert type="error">{campos.opciones}</Alert>}
        <Select label="Opción correcta" required placeholder="Seleccione…" options={opciones} value={String(v.correcta)} error={campos?.correcta} onChange={(e) => setV((x) => ({ ...x, correcta: Number(e.target.value) }))} />
        <Checkbox label="Activa: puede salir en el examen" checked={v.activa} onChange={(e) => setV((x) => ({ ...x, activa: e.target.checked }))} />
        {!campos && <ErrorAlert error={peticion.error} />}
      </div>
    </Modal>
  )
}

/** Banco de preguntas y parámetros del examen (EF-14). */
export function EvaluacionAdminPage() {
  useTituloPagina('Banco de preguntas')
  const carga = useAsync()
  const accion = useAsync()
  const guardarCfg = useAsync()
  const [preguntas, setPreguntas] = useState(null)
  const [cfg, setCfg] = useState(null)
  const [editando, setEditando] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [errorCsv, setErrorCsv] = useState(null)

  const recargar = async () => {
    const r = await carga.run(adminApi.preguntas)
    if (r.ok) setPreguntas(r.data)
  }
  useEffect(() => {
    recargar()
    adminApi.evaluacionConfig().then((c) => setCfg({ ...c, inicio: aLocal(c.inicio), fin: aLocal(c.fin) })).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const importar = async (e) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setAviso(null)
    setErrorCsv(null)
    let items
    try {
      items = leerPreguntasCsv(await archivo.text())
    } catch (err) {
      setErrorCsv(err.message)
      return
    }
    const r = await accion.run(() => adminApi.importarPreguntas(items))
    if (r.ok) {
      setAviso(`Se importaron ${r.data.importadas} preguntas.`)
      recargar()
    }
  }
  const eliminar = async (id) => {
    const r = await accion.run(() => adminApi.eliminarPregunta(id))
    if (r.ok) recargar()
  }
  const guardar = async (e) => {
    e.preventDefault()
    await guardarCfg.run(() =>
      adminApi.guardarEvaluacionConfig({ numPreguntas: Number(cfg.numPreguntas), duracionMinutos: Number(cfg.duracionMinutos), inicio: aIso(cfg.inicio), fin: aIso(cfg.fin) }),
    )
  }

  if (!preguntas) return carga.error ? <ErrorAlert error={carga.error} /> : <PageLoader />
  const activas = preguntas.filter((p) => p.activa).length
  const campos = guardarCfg.error?.details?.campos

  return (
    <div className="space-y-6">
      <Titulo texto="Banco de preguntas" detalle={`${preguntas.length} preguntas, ${activas} activas`}>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md bg-realce px-4 text-sm font-medium hover:bg-control has-focus-visible:outline-2 has-focus-visible:outline-tinta">
          <input type="file" accept=".csv,text/csv" className="sr-only" aria-label="Importar preguntas desde CSV" onChange={importar} />
          Importar CSV
        </label>
        <Button onClick={() => setEditando(preguntaVacia)}>Nueva pregunta</Button>
      </Titulo>
      <p className="text-xs text-tenue">Formato del CSV, una pregunta por línea: enunciado;opción 1;opción 2;…;número de la opción correcta</p>
      {aviso && <Alert type="success">{aviso}</Alert>}
      {errorCsv && <Alert type="error">{errorCsv}</Alert>}
      <ErrorAlert error={accion.error} />

      {cfg && (
        <Panel titulo="Parámetros del examen">
          <form onSubmit={guardar} noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="Preguntas por postulante" type="number" min={1} value={cfg.numPreguntas} error={campos?.numPreguntas} onChange={(e) => setCfg((c) => ({ ...c, numPreguntas: e.target.value }))} />
            <Input label="Duración (minutos)" type="number" min={1} value={cfg.duracionMinutos} error={campos?.duracionMinutos} onChange={(e) => setCfg((c) => ({ ...c, duracionMinutos: e.target.value }))} />
            <Input label="Se habilita desde" type="datetime-local" value={cfg.inicio} onChange={(e) => setCfg((c) => ({ ...c, inicio: e.target.value }))} />
            <Input label="Hasta" type="datetime-local" value={cfg.fin} error={campos?.fin} onChange={(e) => setCfg((c) => ({ ...c, fin: e.target.value }))} />
            <div className="space-y-3 sm:col-span-2 lg:col-span-4">
              {Number(cfg.numPreguntas) > activas && <Alert type="warning">Hay menos preguntas activas que las que pide el examen: nadie podrá iniciarlo.</Alert>}
              {!campos && <ErrorAlert error={guardarCfg.error} />}
              {guardarCfg.success && <Alert type="success">Parámetros guardados.</Alert>}
              <Button type="submit" loading={guardarCfg.loading}>Guardar parámetros</Button>
            </div>
          </form>
        </Panel>
      )}

      <Panel titulo="Preguntas">
        <Tabla
          vacio="El banco aún no tiene preguntas."
          columnas={['Enunciado', 'Correcta', 'Activa', '']}
          filas={preguntas.map((p) => [
            <span className="block max-w-xl">{p.enunciado}</span>,
            <span className="block max-w-xs">{p.opciones[p.correcta]}</span>,
            p.activa ? 'Sí' : 'No',
            <span className="flex gap-3 whitespace-nowrap">
              <button type="button" className="underline underline-offset-4" onClick={() => setEditando(p)}>Editar</button>
              <button type="button" className="text-mal underline underline-offset-4" onClick={() => eliminar(p.id)}>Eliminar</button>
            </span>,
          ])}
        />
      </Panel>

      {editando && (
        <EditorPregunta
          pregunta={editando}
          onCerrar={() => setEditando(null)}
          onGuardada={() => {
            setEditando(null)
            recargar()
          }}
        />
      )}
    </div>
  )
}

export function ResultadosPage() {
  useTituloPagina('Resultados')
  const carga = useAsync()
  const [lista, setLista] = useState(null)
  useEffect(() => {
    carga.run(adminApi.resultados).then((r) => r.ok && setLista(r.data))
  }, [carga.run])
  if (!lista) return carga.error ? <ErrorAlert error={carga.error} /> : <PageLoader />

  const reporte = async (r) => guardarArchivo(await adminApi.reporteEvaluacion(r.postulacionId), `evaluacion-${r.codigo}.pdf`)
  return (
    <div className="space-y-6">
      <Titulo texto="Resultados de la evaluación técnica" detalle="De mayor a menor calificación" />
      <Panel>
        <Tabla
          vacio="Nadie ha rendido la evaluación."
          columnas={['Postulante', 'Cédula', 'Cargo', 'Correctas', 'Nota', 'Cierre', '']}
          filas={lista.map((r) => [
            <Link className="underline underline-offset-4" to={`/admin/postulantes/${r.postulacionId}`}>{r.apellidos} {r.nombres}</Link>,
            <span className="tabular-nums">{r.cedula}</span>,
            r.cargo ?? '—',
            r.finalizadoEn ? `${r.correctas} de ${r.total}` : 'En curso',
            nota(r.nota),
            r.finalizadoEn ? (r.forzado ? 'Por tiempo' : 'Por el postulante') : '—',
            r.finalizadoEn && <button type="button" className="underline underline-offset-4" onClick={() => reporte(r)}>PDF</button>,
          ])}
        />
      </Panel>
    </div>
  )
}

function Plazo({ texto, fecha, cumplido }) {
  const vencido = !cumplido && new Date(fecha) < new Date()
  return (
    <p className={`text-xs ${vencido ? 'font-medium text-mal' : 'text-tenue'}`}>
      {vencido ? `Plazo vencido. ${texto}` : `${texto} antes del`}: {formatoInstante(fecha)}
    </p>
  )
}

/** Talento Humano informa y la Comisión resuelve, cada uno con su plazo (EF-1). */
function FilaReconsideracion({ r, onRespondida }) {
  const esComision = useAdminStore((s) => s.admin?.rol) === 'ADMINISTRADOR'
  const peticion = useAsync()
  const informar = useAsync()
  const [respuesta, setRespuesta] = useState('')
  const [informe, setInforme] = useState(r.informe ?? '')
  const responder = async (estado) => {
    const x = await peticion.run(() => adminApi.responderReconsideracion(r.id, { estado, respuesta }))
    if (x.ok) onRespondida()
  }
  const guardarInforme = async () => {
    const x = await informar.run(() => adminApi.informarReconsideracion(r.id, { informe }))
    if (x.ok) onRespondida()
  }
  return (
    <div className="border-b border-regla py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <p className="text-sm font-medium">{r.nombres} · {r.etapa}</p>
        {r.estado !== 'PENDIENTE' && <p className="text-xs text-tenue">{r.estado} por {r.respondidaPor}</p>}
      </div>
      {r.estado === 'PENDIENTE' && (
        <div className="mt-1">
          <Plazo texto="Informe de Talento Humano" fecha={r.informeAntes} cumplido={Boolean(r.informe)} />
          <Plazo texto="Resolución de la Comisión" fecha={r.responderAntes} />
        </div>
      )}
      <p className="mt-1 text-xs text-tenue">{r.codigo} · {r.cedula}</p>
      <p className="mt-2 text-sm leading-relaxed">{r.motivo}</p>
      {r.informe && (
        <p className="mt-2 rounded-md bg-fondo p-2 text-sm">
          <span className="block text-xs text-tenue">Informe de {r.informePor}</span>
          {r.informe}
        </p>
      )}
      {r.respuesta && <p className="mt-2 rounded-md bg-fondo p-2 text-sm">{r.respuesta}</p>}
      {r.estado === 'PENDIENTE' && !esComision && (
        <div className="mt-3 space-y-2">
          <Textarea label="Informe" required maxLength={2000} value={informe} error={informar.error?.details?.campos?.informe} onChange={(e) => setInforme(e.target.value)} />
          {!informar.error?.details?.campos && <ErrorAlert error={informar.error} />}
          <Button variant="secondary" onClick={guardarInforme} loading={informar.loading}>Guardar informe</Button>
        </div>
      )}
      {r.estado === 'PENDIENTE' && esComision && (
        <div className="mt-3 space-y-2">
          <Textarea label="Respuesta" required maxLength={2000} value={respuesta} error={peticion.error?.details?.campos?.respuesta} onChange={(e) => setRespuesta(e.target.value)} />
          {!peticion.error?.details?.campos && <ErrorAlert error={peticion.error} />}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => responder('ACEPTADA')} disabled={peticion.loading}>Aceptar</Button>
            <Button variant="danger" onClick={() => responder('NEGADA')} disabled={peticion.loading}>Negar</Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ReconsideracionesPage() {
  useTituloPagina('Reconsideraciones')
  const carga = useAsync()
  const [lista, setLista] = useState(null)
  const cargar = () => carga.run(adminApi.reconsideraciones).then((r) => r.ok && setLista(r.data))
  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (!lista) return carga.error ? <ErrorAlert error={carga.error} /> : <PageLoader />
  return (
    <div className="space-y-6">
      <Titulo texto="Reconsideraciones" detalle="Primero las pendientes, por plazo. Talento Humano informa y la Comisión resuelve." />
      <Panel>
        {lista.length === 0 && <p className="text-sm text-tenue">No hay solicitudes.</p>}
        {lista.map((r) => (
          <FilaReconsideracion key={r.id} r={r} onRespondida={cargar} />
        ))}
      </Panel>
    </div>
  )
}

const ROLES = [
  { id: 'ANALISTA', nombre: 'Analista · Talento Humano' },
  { id: 'ADMINISTRADOR', nombre: 'Administrador · Comisión de Selección' },
]

/** Configurar roles y permisos (precondición de EF-1). */
export function UsuariosPage() {
  useTituloPagina('Usuarios')
  const carga = useAsync()
  const accion = useAsync()
  const [lista, setLista] = useState(null)
  const vacio = { usuario: '', nombre: '', password: '', rol: 'ANALISTA' }
  const [v, setV] = useState(vacio)
  useEffect(() => {
    carga.run(adminApi.usuarios).then((r) => r.ok && setLista(r.data))
  }, [carga.run])
  if (!lista) return carga.error ? <ErrorAlert error={carga.error} /> : <PageLoader />
  const campos = accion.error?.details?.campos
  const cambiar = (c) => (e) => setV((x) => ({ ...x, [c]: e.target.value }))
  const crear = async (e) => {
    e.preventDefault()
    const r = await accion.run(() => adminApi.crearUsuario(v))
    if (r.ok) {
      setLista(r.data)
      setV(vacio)
    }
  }
  const activar = async (u) => {
    const r = await accion.run(() => adminApi.cambiarActivo(u.id, !u.activo))
    if (r.ok) setLista(r.data)
  }
  return (
    <div className="space-y-6">
      <Titulo texto="Usuarios" detalle="Analista: consulta, califica e informa reconsideraciones. Administrador: además las resuelve, publica fases y gestiona puntajes y el banco de preguntas." />
      <Panel titulo="Nueva cuenta">
        <form onSubmit={crear} noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Usuario" required autoComplete="off" value={v.usuario} error={campos?.usuario} onChange={cambiar('usuario')} />
          <Input label="Nombre" required value={v.nombre} error={campos?.nombre} onChange={cambiar('nombre')} />
          <Input label="Contraseña" type="password" required autoComplete="new-password" value={v.password} error={campos?.password} onChange={cambiar('password')} />
          <Select label="Rol" required options={ROLES} value={v.rol} error={campos?.rol} onChange={cambiar('rol')} />
          <div className="space-y-3 sm:col-span-2 lg:col-span-4">
            {!campos && <ErrorAlert error={accion.error} />}
            <Button type="submit" loading={accion.loading}>Crear cuenta</Button>
          </div>
        </form>
      </Panel>
      <Panel titulo="Cuentas">
        <Tabla
          columnas={['Usuario', 'Nombre', 'Rol', 'Estado', '']}
          filas={lista.map((u) => [
            u.usuario,
            u.nombre,
            u.rol,
            u.activo ? 'Activa' : 'Desactivada',
            <button type="button" className="underline underline-offset-4" onClick={() => activar(u)}>{u.activo ? 'Desactivar' : 'Activar'}</button>,
          ])}
        />
      </Panel>
    </div>
  )
}
