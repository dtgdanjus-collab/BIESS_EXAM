import { Link } from 'react-router-dom'
import { useTituloPagina } from '../../hooks/useTituloPagina'
import { claseEnlace } from './components'

const APARTADOS = [
  ['Quién trata sus datos', 'Este es un sistema académico de demostración, desarrollado como proyecto universitario. No es un servicio oficial del IESS ni del BIESS.'],
  ['Qué datos se recogen', 'Identificación y datos civiles, domicilio y contacto, familiares que trabajan en el IESS o el BIESS, cargo al que postula, formación, experiencia, publicaciones, capacitación, respuestas sobre inhabilidades, los documentos PDF que adjunte y sus calificaciones.'],
  ['Para qué se usan', 'Solo para registrar y evaluar su postulación dentro del concurso de méritos y oposición simulado: verificar requisitos, calificar cada fase, responder reconsideraciones y avisarle de los resultados por correo.'],
  ['Con qué base', 'Su consentimiento explícito, que usted otorga antes de enviar la postulación, conforme a lo previsto en el artículo 7 de la Ley Orgánica de Protección de Datos Personales.'],
  ['Quién puede verlos', 'Las cuentas de Talento Humano y de la Comisión de Selección de este sistema. Los correos se envían a través de un proveedor externo. Si usted acepta la declaración del formulario, su nombre como postulante puede publicarse.'],
  ['Cómo se protegen', 'Las contraseñas no se guardan en texto plano y cada acción queda registrada en una bitácora. La aplicación instalable no guarda su expediente en el dispositivo.'],
  ['Cuánto tiempo se conservan', 'Solo mientras dure el proyecto académico. Después se eliminan.'],
  ['Sus derechos', 'Puede pedir acceder a sus datos, rectificarlos, eliminarlos u oponerse a su tratamiento, y retirar su consentimiento. Dirija su solicitud a los responsables del proyecto.'],
]

/** Política de privacidad: precondición de EF-1 para el tratamiento de datos personales. */
export function PrivacidadPage() {
  useTituloPagina('Política de privacidad')
  return (
    <article>
      <h1 className="text-[32px] font-medium leading-[1.05] tracking-[-0.03em]">Política de privacidad</h1>
      <div className="mt-6 space-y-5">
        {APARTADOS.map(([titulo, texto]) => (
          <section key={titulo}>
            <h2 className="text-base font-medium">{titulo}</h2>
            <p className="mt-1 text-sm leading-relaxed text-tenue">{texto}</p>
          </section>
        ))}
      </div>
      <p className="mt-8 text-sm">
        <Link to="/login" className={claseEnlace}>
          Volver a iniciar sesión
        </Link>
      </p>
    </article>
  )
}
