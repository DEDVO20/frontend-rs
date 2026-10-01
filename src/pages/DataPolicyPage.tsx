import { Link } from 'react-router-dom'
import { ArrowLeft, Download, ShieldCheck } from 'lucide-react'
import { FintoLogo } from '@/components/ui/FintoLogo'

export function DataPolicyPage() {
  return (
    <div className="min-h-screen bg-cream-50 font-sans text-navy-900 flex flex-col">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-cream-50/95 backdrop-blur border-b border-sand-300/40">
        <div className="max-w-5xl mx-auto px-5 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy-900/70 hover:text-navy-900 px-3 py-1.5 rounded-lg border border-sand-300/60 hover:bg-white/80 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver al inicio
            </Link>
            <Link to="/" aria-label="Ir al inicio" className="hidden sm:inline-block">
              <FintoLogo variant="navy" height={30} />
            </Link>
          </div>

          <a
            href="/docs/politica-tratamiento-datos-personales-finto.pdf"
            download="Politica-Tratamiento-Datos-Finto.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-full shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar PDF</span>
          </a>
        </div>
      </header>

      {/* ── Main Content Container ─────────────────────────────────── */}
      <main className="flex-1 max-w-4xl mx-auto px-5 md:px-8 py-10 md:py-14 w-full">
        {/* Document Header Card */}
        <div className="bg-white rounded-2xl border border-sand-300/60 shadow-sm p-6 md:p-10 mb-8">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 uppercase tracking-wider mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Documento Legal Oficial</span>
          </div>

          <h1 className="font-display text-2xl md:text-4xl font-bold text-navy-900 mb-3">
            Política de Tratamiento de Datos Personales
          </h1>
          <p className="text-base md:text-lg font-medium text-navy-800/80 mb-6">
            RAD Services S.A.S. | Finto
          </p>

          <p className="text-sm text-navy-900/70 mb-6 leading-relaxed">
            Aplicable a los servicios de back office financiero y administrativo, el portal de clientes, el sitio web y los canales digitales de Finto.
          </p>

          {/* Quick info table */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-sand-200 text-xs">
            <div className="bg-cream-50/70 rounded-lg p-3 border border-sand-200/50">
              <span className="font-bold text-navy-900 block mb-0.5">Responsable:</span>
              <span className="text-navy-900/80">RAD Services S.A.S.</span>
            </div>
            <div className="bg-cream-50/70 rounded-lg p-3 border border-sand-200/50">
              <span className="font-bold text-navy-900 block mb-0.5">Marca comercial:</span>
              <span className="text-navy-900/80">Finto</span>
            </div>
            <div className="bg-cream-50/70 rounded-lg p-3 border border-sand-200/50">
              <span className="font-bold text-navy-900 block mb-0.5">NIT:</span>
              <span className="text-navy-900/80">901.954.048-5</span>
            </div>
            <div className="bg-cream-50/70 rounded-lg p-3 border border-sand-200/50">
              <span className="font-bold text-navy-900 block mb-0.5">Domicilio:</span>
              <span className="text-navy-900/80">Bogotá D.C., Colombia</span>
            </div>
            <div className="bg-cream-50/70 rounded-lg p-3 border border-sand-200/50 sm:col-span-2">
              <span className="font-bold text-navy-900 block mb-0.5">Sitio web y canal digital:</span>
              <span className="text-navy-900/80">https://finto.la y formulario de contacto en el sitio web</span>
            </div>
          </div>
        </div>

        {/* Legal Text Body */}
        <div className="bg-white rounded-2xl border border-sand-300/60 shadow-sm p-6 md:p-10 space-y-8 text-sm md:text-base leading-relaxed text-navy-900/80">

          {/* 1 */}
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
              1. Objeto y alcance
            </h2>
            <p className="mb-3">
              Esta Política explica cómo <strong>RAD Services S.A.S.</strong>, identificada comercialmente como <strong>Finto</strong>, recolecta, almacena, usa, circula, transmite, transfiere, actualiza, conserva y suprime datos personales. Aplica a sus relaciones comerciales, precontractuales, contractuales, laborales y con proveedores, así como al sitio web, formularios, portal de clientes, correo, mensajería y demás canales físicos o digitales que utilice.
            </p>
            <p>
              Finto presta servicios de back office financiero y administrativo. Según cada operación, podrá actuar como <strong>Responsable del Tratamiento</strong> cuando determine las finalidades y los medios, o como <strong>Encargado</strong> cuando trate datos por cuenta y bajo instrucciones de un cliente u otro Responsable.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
              2. Marco normativo
            </h2>
            <p>
              Esta Política se adopta con fundamento en los artículos 15 y 20 de la Constitución Política de Colombia, la <strong>Ley 1581 de 2012</strong>, el <strong>Decreto 1074 de 2015</strong> y las normas que los modifiquen, adicionen o sustituyan. Cuando corresponda, también se aplicarán la <strong>Ley 1266 de 2008</strong> sobre información financiera, crediticia, comercial y de servicios; la <strong>Ley 2300 de 2023</strong> sobre canales y horarios de contacto; y las instrucciones de la Superintendencia de Industria y Comercio, incluida la <strong>Circular Externa 002 de 2024</strong> sobre tratamiento de datos personales en sistemas de inteligencia artificial.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
              3. Definiciones
            </h2>
            <ul className="space-y-2 list-disc list-inside">
              <li><strong>Autorización:</strong> consentimiento previo, expreso e informado del Titular cuando la ley lo exija.</li>
              <li><strong>Dato personal:</strong> información vinculada o que pueda asociarse a una persona natural determinada o determinable.</li>
              <li><strong>Dato sensible:</strong> información que afecta la intimidad del Titular o cuyo uso indebido puede generar discriminación.</li>
              <li><strong>Encargado:</strong> persona natural o jurídica que realiza el Tratamiento por cuenta del Responsable.</li>
              <li><strong>Responsable:</strong> persona natural o jurídica que decide sobre la base de datos o sobre las finalidades y los medios del Tratamiento.</li>
              <li><strong>Titular:</strong> persona natural cuyos datos personales son objeto de Tratamiento.</li>
              <li><strong>Transferencia:</strong> entrega de datos a otro Responsable, ubicado dentro o fuera de Colombia.</li>
              <li><strong>Transmisión:</strong> comunicación de datos a un Encargado para que los trate por cuenta del Responsable.</li>
              <li><strong>Tratamiento:</strong> cualquier operación sobre datos personales, como recolección, almacenamiento, uso, circulación, actualización o supresión.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
              4. Principios
            </h2>
            <p>
              Finto aplicará los principios de legalidad, finalidad, libertad, veracidad o calidad, transparencia, acceso y circulación restringida, seguridad, confidencialidad, necesidad y minimización. Recolectará y utilizará únicamente la información pertinente para finalidades legítimas, determinadas e informadas.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
              5. Titulares y categorías de datos
            </h2>
            <p className="mb-3">
              Podrán ser Titulares los clientes y sus empleados, administradores, accionistas, contratistas, proveedores, usuarios, beneficiarios y contactos; los prospectos; los proveedores y aliados de Finto; los candidatos, colaboradores y extrabajadores; y otras personas que interactúen con Finto o cuyos datos estén contenidos en información entregada por un cliente.
            </p>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Datos de identificación y contacto, incluida información de representantes legales y contactos empresariales.</li>
              <li>Datos laborales, profesionales, académicos, de seguridad social, nómina y beneficiarios, cuando el servicio contratado lo requiera.</li>
              <li>Datos financieros, bancarios, tributarios, contables, comerciales y de facturación.</li>
              <li>Información contractual, societaria, administrativa y de proveedores.</li>
              <li>Datos técnicos y de uso, como dirección IP, dispositivo, navegador, registros de acceso, actividad en el portal y eventos de seguridad.</li>
              <li>Comunicaciones y archivos enviados por correo, formularios, mensajería, reuniones o canales de soporte.</li>
              <li>Datos sensibles o de menores que aparezcan de manera necesaria en soportes laborales, de seguridad social, tributarios o contractuales, sujetos a protección reforzada.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
              6. Finalidades cuando Finto actúa como Responsable
            </h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>Gestionar relaciones comerciales, precontractuales, contractuales y de servicio.</li>
              <li>Elaborar propuestas, diagnósticos, cotizaciones, contratos y configuraciones de servicio.</li>
              <li>Administrar clientes, usuarios, accesos, autenticación, soporte y seguridad del portal y de los canales digitales.</li>
              <li>Prestar servicios contables, tributarios, de tesorería, facturación, cartera, nómina, administración, controller, flujo de caja, presupuesto, forecast, indicadores, reportes, planeación, estructuración financiera y CFO as a Service, según el alcance contratado.</li>
              <li>Gestionar facturación, pagos, recaudo, cobro, contabilidad, impuestos y obligaciones legales de Finto.</li>
              <li>Atender consultas, solicitudes, reclamos, peticiones, incidentes y requerimientos de autoridades.</li>
              <li>Gestionar proveedores, aliados, contratistas, candidatos, colaboradores y obligaciones laborales o de seguridad social.</li>
              <li>Enviar comunicaciones operativas relacionadas con el servicio y, con autorización cuando sea exigible, comunicaciones comerciales.</li>
              <li>Medir el uso de los servicios, generar estadísticas y mejorar procesos, procurando utilizar información agregada, disociada o anonimizada cuando sea posible.</li>
              <li>Prevenir fraude, accesos no autorizados, conflictos de interés, incumplimientos y eventos de seguridad.</li>
              <li>Cumplir obligaciones legales, regulatorias, contractuales y de defensa de derechos.</li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
              7. Tratamiento por cuenta de clientes
            </h2>
            <p className="mb-3">
              Cuando un cliente determine las finalidades y los medios del Tratamiento, el cliente será el Responsable y Finto actuará como Encargado. En ese caso, Finto tratará los datos conforme al contrato, al acuerdo de transmisión de datos, a las instrucciones documentadas del cliente y a la ley.
            </p>
            <p>
              El cliente deberá asegurar que cuenta con las autorizaciones o bases jurídicas necesarias y que la información entregada es pertinente y lícita. Finto limitará el acceso a las personas y proveedores que necesiten la información para ejecutar el servicio. Las solicitudes de Titulares relacionadas con datos controlados por un cliente podrán remitirse al Responsable correspondiente.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
              8. Portal de clientes, automatización e inteligencia artificial
            </h2>
            <p className="mb-3">
              El portal de Finto puede centralizar documentos, tareas, indicadores, reportes, calendarios y accesos relacionados con los servicios contratados. Los registros técnicos se utilizarán para operar el portal, autenticar usuarios, prestar soporte y proteger la información.
            </p>
            <p className="mb-3">
              Finto podrá utilizar herramientas de automatización y, cuando corresponda, sistemas de inteligencia artificial para apoyar la clasificación, extracción, análisis, elaboración de borradores, detección de inconsistencias o generación de reportes. Estos sistemas serán herramientas de apoyo y no sustituirán la revisión profesional cuando esta resulte necesaria.
            </p>
            <p>
              Finto procurará aplicar privacidad desde el diseño y por defecto, minimización, control de acceso, evaluación de riesgos, supervisión humana y medidas de seguridad. No usará datos personales para finalidades incompatibles con las informadas ni para entrenar modelos de terceros, salvo que exista una base jurídica válida, condiciones contractuales adecuadas y, cuando corresponda, autorización.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
              9. Datos sensibles y datos de menores
            </h2>
            <p className="mb-3">
              El suministro de datos sensibles es facultativo, salvo que su Tratamiento sea necesario y esté permitido por la ley. Cuando se requieran, Finto informará su carácter sensible y la finalidad, solicitará autorización explícita cuando corresponda y aplicará medidas reforzadas.
            </p>
            <p>
              Finto no dirige sus servicios a menores. Sin embargo, puede recibir datos de niñas, niños o adolescentes incluidos en nómina, seguridad social, beneficios, información tributaria u otros soportes empresariales. Su Tratamiento respetará el interés superior del menor, sus derechos fundamentales y las reglas de representación y autorización aplicables.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
              10. Autorización y aviso de privacidad
            </h2>
            <p className="mb-3">
              Cuando la ley exija autorización, Finto la obtendrá por medios físicos, electrónicos, digitales, verbales verificables o mediante conductas inequívocas. Conservará evidencia de la autorización y permitirá su consulta cuando proceda.
            </p>
            <p>
              El aviso de privacidad informará las finalidades principales, los derechos del Titular, los canales de atención y la forma de consultar esta Política. La autorización no será necesaria en los casos exceptuados por la ley.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
              11. Proveedores y otros Encargados
            </h2>
            <p className="mb-3">
              Finto podrá apoyarse en proveedores de alojamiento, infraestructura, almacenamiento, correo, mensajería, colaboración, contabilidad, nómina, analítica, seguridad, soporte, firma electrónica, automatización e inteligencia artificial. Les exigirá obligaciones de confidencialidad, seguridad y Tratamiento conforme a instrucciones, cuando actúen como Encargados.
            </p>
            <p>
              La relación de proveedores puede cambiar con la operación. Finto evaluará el rol real de cada tercero, la finalidad, la ubicación del Tratamiento y las garantías contractuales o legales aplicables.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
              12. Transferencias y transmisiones internacionales
            </h2>
            <p className="mb-3">
              La operación de servicios tecnológicos puede implicar acceso, almacenamiento o soporte desde otros países. Finto gestionará las transmisiones internacionales mediante contratos u otros instrumentos que definan el alcance, la seguridad, la confidencialidad y las obligaciones del Encargado.
            </p>
            <p>
              Si se realiza una transferencia a otro Responsable, Finto verificará el cumplimiento de las reglas colombianas sobre países con nivel adecuado de protección, excepciones legales o declaraciones de conformidad de la Superintendencia de Industria y Comercio, cuando sean exigibles.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
              13. Derechos de los Titulares
            </h2>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Conocer, actualizar y rectificar sus datos personales.</li>
              <li>Solicitar prueba de la autorización, salvo las excepciones legales.</li>
              <li>Ser informado sobre el uso dado a sus datos.</li>
              <li>Acceder gratuitamente a sus datos en los términos legales.</li>
              <li>Revocar la autorización o solicitar la supresión cuando proceda y no exista un deber legal o contractual de conservación.</li>
              <li>Presentar quejas ante la Superintendencia de Industria y Comercio, una vez agotado el trámite interno cuando la ley lo exija.</li>
            </ul>
          </section>

          {/* 14 */}
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
              14. Consultas, reclamos y solicitudes
            </h2>
            <p className="mb-4">
              El Titular, sus causahabientes o su representante podrán presentar solicitudes mediante el formulario de contacto disponible en <a href="https://finto.la" className="text-brand-600 underline">https://finto.la</a> o por el canal de privacidad informado en el contrato, propuesta, autorización o aviso de privacidad aplicable. La petición deberá incluir nombre e identificación del solicitante, calidad en la que actúa, datos de contacto, descripción clara de la solicitud y documentos que acrediten identidad o representación cuando sean necesarios.
            </p>
            <div className="space-y-3 pl-4 border-l-2 border-brand-300">
              <div>
                <h3 className="font-bold text-navy-900 mb-1">Consultas</h3>
                <p>
                  Finto atenderá las consultas en un término máximo de <strong>diez (10) días hábiles</strong> desde su recepción. Si no puede responder en ese plazo, informará el motivo y la nueva fecha, que no superará los cinco (5) días hábiles siguientes al vencimiento del término inicial.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-navy-900 mb-1">Reclamos</h3>
                <p>
                  Los reclamos deberán identificar al Titular, describir los hechos, indicar la dirección de contacto y acompañar los documentos pertinentes. Si están incompletos, Finto solicitará la corrección dentro de los cinco (5) días hábiles siguientes. Si el solicitante no completa el reclamo dentro de los dos (2) meses siguientes al requerimiento, se entenderá desistido. El reclamo completo será atendido en un máximo de <strong>quince (15) días hábiles</strong>; de ser necesaria una prórroga, se informará el motivo y la nueva fecha, que no excederá ocho (8) días hábiles adicionales.
                </p>
              </div>
            </div>
            <p className="mt-4">
              Cuando Finto actúe como Encargado, podrá trasladar la solicitud al cliente Responsable y colaborar con su atención de acuerdo con el contrato y la ley.
            </p>
          </section>

          {/* 15 */}
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
              15. Seguridad y gestión de incidentes
            </h2>
            <p className="mb-3">
              Finto adoptará medidas técnicas, humanas, administrativas y organizacionales razonables y proporcionales al riesgo. Estas podrán incluir gestión de identidades y accesos, mínimo privilegio, autenticación, cifrado, copias de seguridad, monitoreo, registro de eventos, segregación de ambientes, gestión de vulnerabilidades, continuidad, eliminación segura, acuerdos de confidencialidad y controles sobre proveedores.
            </p>
            <p>
              Los incidentes se gestionarán conforme a los procedimientos internos y a las obligaciones contractuales o legales de evaluación, contención, documentación y reporte a los clientes o autoridades cuando corresponda.
            </p>
          </section>

          {/* 16 */}
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
              16. Conservación y supresión
            </h2>
            <p className="mb-3">
              Finto conservará los datos durante el tiempo necesario para cumplir la finalidad informada y las obligaciones legales, contables, tributarias, laborales, contractuales, probatorias y de seguridad. La duración podrá variar según el tipo de información, el servicio y las instrucciones del cliente Responsable.
            </p>
            <ul className="space-y-1.5 list-disc list-inside mb-3">
              <li><strong>Información contractual, contable, tributaria, laboral y de seguridad social:</strong> durante los términos de conservación exigidos por la ley y los plazos necesarios para atender auditorías, requerimientos o controversias.</li>
              <li><strong>Información tratada por cuenta de clientes:</strong> durante la relación contractual y el período acordado para devolución, migración, bloqueo o eliminación segura.</li>
              <li><strong>Prospectos y contactos comerciales:</strong> mientras exista una finalidad comercial vigente, autorización aplicable o interés legítimo permitido, con revisión periódica de necesidad.</li>
              <li><strong>Registros técnicos, copias de seguridad y evidencias de seguridad:</strong> durante los ciclos técnicos, contractuales o legales definidos, con acceso restringido.</li>
            </ul>
            <p>
              Cuando los datos dejen de ser necesarios y no exista obligación de conservarlos, Finto los eliminará, anonimizará o dispondrá de manera segura. La supresión puede estar sujeta a ciclos de respaldo o bloqueo temporal destinados exclusivamente a seguridad y cumplimiento.
            </p>
          </section>

          {/* 17 */}
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
              17. Confidencialidad
            </h2>
            <p>
              Las personas que intervengan en el Tratamiento deberán mantener la reserva de la información incluso después de terminar su relación con Finto, cuando la naturaleza de los datos o la ley así lo exijan. Finto procurará que colaboradores, contratistas y proveedores conozcan y cumplan estas obligaciones.
            </p>
          </section>

          {/* 18 */}
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
              18. Modificaciones, vigencia y control de versiones
            </h2>
            <p className="mb-4">
              Finto podrá actualizar esta Política para reflejar cambios legales, tecnológicos, operativos o en las finalidades del Tratamiento. Las modificaciones relevantes se comunicarán por los canales disponibles y se solicitarán nuevas autorizaciones cuando sean legalmente necesarias.
            </p>

            <div className="bg-cream-50 rounded-xl p-4 border border-sand-200 text-xs sm:text-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-navy-900/60 block">Versión:</span>
                <span className="font-bold text-navy-900">1.0</span>
              </div>
              <div>
                <span className="text-navy-900/60 block">Entrada en vigencia:</span>
                <span className="font-bold text-navy-900">30 de septiembre de 2026</span>
              </div>
              <div>
                <span className="text-navy-900/60 block">Última actualización:</span>
                <span className="font-bold text-navy-900">30 de septiembre de 2026</span>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="bg-navy-950 text-cream-100/60 py-8 border-t border-white/10 mt-auto">
        <div className="max-w-4xl mx-auto px-5 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
          <p>© {new Date().getFullYear()} Finto · RAD Services S.A.S. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4">
            <a href="mailto:finto@finto.la" className="hover:text-cream-100 transition-colors">finto@finto.la</a>
            <a href="https://wa.me/573102170905" target="_blank" rel="noopener noreferrer" className="hover:text-cream-100 transition-colors">WhatsApp Soporte</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
