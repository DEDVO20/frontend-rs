import fs from 'fs'
import path from 'path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const PUBLIC_DOCS = path.resolve('public', 'docs')
if (!fs.existsSync(PUBLIC_DOCS)) {
  fs.mkdirSync(PUBLIC_DOCS, { recursive: true })
}

// Brand colors
const NAVY_DARK = rgb(0.10, 0.15, 0.27)     // #1a2545
const NAVY_LIGHT = rgb(0.24, 0.42, 0.76)    // #3d6bc1
const SLATE_DARK = rgb(0.20, 0.25, 0.33)    // #334155
const SLATE_MUTED = rgb(0.45, 0.50, 0.58)   // #737f94
const CREAM_BG = rgb(0.98, 0.98, 0.96)      // #faf9f5
const BORDER_COLOR = rgb(0.85, 0.87, 0.90)  // border
const WHITE = rgb(1, 1, 1)

class DocBuilder {
  constructor(title, docType = 'Documento Oficial') {
    this.title = title
    this.docType = docType
    this.pages = []
    this.currentPage = null
    this.y = 0
    this.pageWidth = 595.28 // A4
    this.pageHeight = 841.89
    this.marginLeft = 50
    this.marginRight = 50
    this.marginTop = 55
    this.marginBottom = 55
    this.contentWidth = this.pageWidth - this.marginLeft - this.marginRight
  }

  async init(pdfDoc) {
    this.pdfDoc = pdfDoc
    this.fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    this.fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    this.fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
    this.addPage()
  }

  addPage() {
    this.currentPage = this.pdfDoc.addPage([this.pageWidth, this.pageHeight])
    this.pages.push(this.currentPage)
    this.y = this.pageHeight - this.marginTop

    // Running header (on pages after the first)
    if (this.pages.length > 1) {
      this.drawHeader()
    }
  }

  drawHeader() {
    const page = this.currentPage
    page.drawText('finto.', {
      x: this.marginLeft,
      y: this.pageHeight - 35,
      size: 13,
      font: this.fontBold,
      color: NAVY_LIGHT,
    })
    page.drawText(this.title, {
      x: this.marginLeft + 60,
      y: this.pageHeight - 35,
      size: 8,
      font: this.fontRegular,
      color: SLATE_MUTED,
    })
    page.drawLine({
      start: { x: this.marginLeft, y: this.pageHeight - 42 },
      end: { x: this.pageWidth - this.marginRight, y: this.pageHeight - 42 },
      thickness: 0.5,
      color: BORDER_COLOR,
    })
    this.y = this.pageHeight - this.marginTop - 10
  }

  checkSpace(requiredHeight) {
    if (this.y - requiredHeight < this.marginBottom) {
      this.addPage()
    }
  }

  wrapText(text, font, size, maxWidth) {
    const rawParagraphs = String(text).replace(/\r/g, '').split('\n')
    const lines = []

    for (const paragraph of rawParagraphs) {
      const words = paragraph.split(' ')
      let currentLine = ''

      for (const word of words) {
        if (!word) continue
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const width = font.widthOfTextAtSize(testLine, size)
        if (width <= maxWidth) {
          currentLine = testLine
        } else {
          if (currentLine) lines.push(currentLine)
          currentLine = word
        }
      }
      if (currentLine) lines.push(currentLine)
    }
    return lines
  }

  addTitleBanner(mainTitle, subtitle, metadata = {}) {
    this.checkSpace(110)
    const page = this.currentPage

    // Top logo / tag
    page.drawText('finto.', {
      x: this.marginLeft,
      y: this.y,
      size: 22,
      font: this.fontBold,
      color: NAVY_DARK,
    })
    this.y -= 26

    // Title
    const titleLines = this.wrapText(mainTitle, this.fontBold, 18, this.contentWidth)
    for (const line of titleLines) {
      page.drawText(line, {
        x: this.marginLeft,
        y: this.y,
        size: 18,
        font: this.fontBold,
        color: NAVY_DARK,
      })
      this.y -= 22
    }

    if (subtitle) {
      const subLines = this.wrapText(subtitle, this.fontBold, 11, this.contentWidth)
      for (const line of subLines) {
        page.drawText(line, {
          x: this.marginLeft,
          y: this.y,
          size: 11,
          font: this.fontBold,
          color: NAVY_LIGHT,
        })
        this.y -= 15
      }
    }

    // Divider line
    page.drawLine({
      start: { x: this.marginLeft, y: this.y - 2 },
      end: { x: this.pageWidth - this.marginRight, y: this.y - 2 },
      thickness: 1.5,
      color: NAVY_LIGHT,
    })
    this.y -= 16

    // Metadata table box if provided
    if (Object.keys(metadata).length > 0) {
      const keys = Object.keys(metadata)
      const rowHeight = 18
      const boxHeight = keys.length * rowHeight + 8
      this.checkSpace(boxHeight + 10)

      const boxTop = this.y
      this.currentPage.drawRectangle({
        x: this.marginLeft,
        y: boxTop - boxHeight,
        width: this.contentWidth,
        height: boxHeight,
        color: CREAM_BG,
        borderColor: BORDER_COLOR,
        borderWidth: 0.75,
      })

      let rowY = boxTop - 14
      for (const key of keys) {
        this.currentPage.drawText(key, {
          x: this.marginLeft + 10,
          y: rowY,
          size: 8.5,
          font: this.fontBold,
          color: NAVY_DARK,
        })
        const val = String(metadata[key])
        const valLines = this.wrapText(val, this.fontRegular, 8.5, this.contentWidth - 140)
        this.currentPage.drawText(valLines[0] || '', {
          x: this.marginLeft + 130,
          y: rowY,
          size: 8.5,
          font: this.fontRegular,
          color: SLATE_DARK,
        })
        rowY -= rowHeight
      }
      this.y = boxTop - boxHeight - 16
    }
  }

  addSection(number, title) {
    this.checkSpace(40)
    const text = number ? `${number}.  ${title}` : title
    this.currentPage.drawText(text, {
      x: this.marginLeft,
      y: this.y,
      size: 12,
      font: this.fontBold,
      color: NAVY_DARK,
    })
    this.y -= 18
  }

  addSubSection(title) {
    this.checkSpace(28)
    this.currentPage.drawText(title, {
      x: this.marginLeft,
      y: this.y,
      size: 10,
      font: this.fontBold,
      color: NAVY_LIGHT,
    })
    this.y -= 15
  }

  addParagraph(text, isItalic = false) {
    const font = isItalic ? this.fontItalic : this.fontRegular
    const size = 9
    const lineHeight = 13.5
    const lines = this.wrapText(text, font, size, this.contentWidth)
    this.checkSpace(lines.length * lineHeight + 6)

    for (const line of lines) {
      this.currentPage.drawText(line, {
        x: this.marginLeft,
        y: this.y,
        size,
        font,
        color: SLATE_DARK,
      })
      this.y -= lineHeight
    }
    this.y -= 5 // paragraph spacing
  }

  addBullet(text, boldPrefix = '') {
    const size = 9
    const lineHeight = 13.5
    const bulletIndent = 16
    const textWidth = this.contentWidth - bulletIndent

    const fullText = boldPrefix ? `${boldPrefix} ${text}` : text
    const lines = this.wrapText(fullText, this.fontRegular, size, textWidth)
    this.checkSpace(lines.length * lineHeight + 4)

    // Bullet dot
    this.currentPage.drawText('•', {
      x: this.marginLeft + 4,
      y: this.y,
      size: 11,
      font: this.fontBold,
      color: NAVY_LIGHT,
    })

    let isFirstLine = true
    for (const line of lines) {
      if (isFirstLine && boldPrefix) {
        // Draw prefix bold then rest
        const prefixWidth = this.fontBold.widthOfTextAtSize(boldPrefix, size)
        this.currentPage.drawText(boldPrefix, {
          x: this.marginLeft + bulletIndent,
          y: this.y,
          size,
          font: this.fontBold,
          color: NAVY_DARK,
        })
        const remainder = line.substring(boldPrefix.length).trim()
        if (remainder) {
          this.currentPage.drawText(' ' + remainder, {
            x: this.marginLeft + bulletIndent + prefixWidth,
            y: this.y,
            size,
            font: this.fontRegular,
            color: SLATE_DARK,
          })
        }
      } else {
        this.currentPage.drawText(line, {
          x: this.marginLeft + bulletIndent,
          y: this.y,
          size,
          font: this.fontRegular,
          color: SLATE_DARK,
        })
      }
      this.y -= lineHeight
      isFirstLine = false
    }
    this.y -= 3
  }

  addCallout(title, text) {
    const size = 8.5
    const lineHeight = 12.5
    const textLines = this.wrapText(text, this.fontRegular, size, this.contentWidth - 28)
    const boxHeight = textLines.length * lineHeight + 28
    this.checkSpace(boxHeight + 10)

    const boxTop = this.y
    this.currentPage.drawRectangle({
      x: this.marginLeft,
      y: boxTop - boxHeight,
      width: this.contentWidth,
      height: boxHeight,
      color: rgb(0.95, 0.97, 1.0),
      borderColor: NAVY_LIGHT,
      borderWidth: 1,
    })

    this.currentPage.drawText(title, {
      x: this.marginLeft + 14,
      y: boxTop - 15,
      size: 9.5,
      font: this.fontBold,
      color: NAVY_DARK,
    })

    let ty = boxTop - 29
    for (const line of textLines) {
      this.currentPage.drawText(line, {
        x: this.marginLeft + 14,
        y: ty,
        size,
        font: this.fontRegular,
        color: SLATE_DARK,
      })
      ty -= lineHeight
    }
    this.y = boxTop - boxHeight - 12
  }

  finalizeFooters() {
    const total = this.pages.length
    for (let i = 0; i < total; i++) {
      const page = this.pages[i]
      page.drawLine({
        start: { x: this.marginLeft, y: 38 },
        end: { x: this.pageWidth - this.marginRight, y: 38 },
        thickness: 0.5,
        color: BORDER_COLOR,
      })
      page.drawText('Finto · Soluciones Integrales de Back Office · finto.la', {
        x: this.marginLeft,
        y: 26,
        size: 7.5,
        font: this.fontRegular,
        color: SLATE_MUTED,
      })
      const pageText = `Página ${i + 1} de ${total}`
      const pWidth = this.fontRegular.widthOfTextAtSize(pageText, 7.5)
      page.drawText(pageText, {
        x: this.pageWidth - this.marginRight - pWidth,
        y: 26,
        size: 7.5,
        font: this.fontRegular,
        color: SLATE_MUTED,
      })
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDER 1: Manual de Usuario
// ─────────────────────────────────────────────────────────────────────────────
async function generateUserManual() {
  const pdfDoc = await PDFDocument.create()
  const doc = new DocBuilder('Manual de Usuario · Portal de Clientes', 'Manual de Usuario')
  await doc.init(pdfDoc)

  doc.addTitleBanner(
    'Manual de Usuario del Portal de Clientes',
    'Guía completa para la gestión financiera, operativa y documental en Finto',
    {
      'Plataforma:': 'Portal de Clientes Finto (https://finto.la/login)',
      'Versión del sistema:': '2026.1 (Release Oficial)',
      'Audiencia:': 'Representantes legales, directores financieros, tesoreros y equipos administrativos',
      'Soporte directo:': 'finto@finto.la | WhatsApp: +57 310 217 0905',
    }
  )

  doc.addParagraph(
    'Bienvenido al Portal de Clientes de Finto. Esta herramienta centraliza su back office financiero y administrativo en una interfaz segura, ágil e intuitiva. A través de este portal, su empresa podrá monitorear indicadores clave en tiempo real, consultar y cargar información contable, autorizar pagos y nómina, y comunicarse directamente con el equipo de especialistas asignado a su cuenta.'
  )

  doc.addCallout(
    'Recomendacion de seguridad inicial',
    'Al ingresar por primera vez, verifique que su conexión sea segura (HTTPS). No comparta sus credenciales de acceso con terceros. Cada usuario debe contar con su propio usuario y contraseña.'
  )

  doc.addSection('1', 'Acceso y Autenticación en la Plataforma')
  doc.addParagraph('El ingreso al portal se realiza desde cualquier navegador web moderno (Chrome, Edge, Safari, Firefox) tanto en computadores como en tabletas y dispositivos móviles.')
  doc.addBullet('Ingrese a https://finto.la y haga clic en "Acceder" en la esquina superior derecha, o directamente en https://finto.la/login.', '1. Acceso a la URL:')
  doc.addBullet('Digite el correo electrónico corporativo registrado por su empresa y la contraseña asignada.', '2. Credenciales:')
  doc.addBullet('Si olvidó su clave, use la opción "¿Olvidaste tu contraseña?" para recibir un enlace seguro de recuperación en su buzón de correo.', '3. Recuperación:')
  doc.addBullet('Las sesiones cuentan con expiración automática tras períodos de inactividad para resguardar la confidencialidad de la información financiera.', '4. Seguridad de sesión:')

  doc.addSection('2', 'Estructura de la Plataforma y Menú Principal')
  doc.addParagraph('Una vez autenticado, encontrará una barra lateral de navegación optimizada con los siguientes módulos esenciales:')
  doc.addBullet('Resumen ejecutivo con indicadores de saldo, recaudo, cuentas por cobrar, pagos programados y estado de los servicios.', '• Dashboard:')
  doc.addBullet('Gestión de compromisos del mes, autorizaciones de pago, revisión de nómina e impuestos con fechas límite.', '• Tareas y Aprobaciones:')
  doc.addBullet('Repositorio digital organizado por carpetas con estados financieros, soportes tributarios, facturas y nóminas.', '• Centro de Documentos:')
  doc.addBullet('Canal formal para solicitar trámites especiales, consultas contables, reportes a la medida o soporte operativo.', '• Solicitudes:')
  doc.addBullet('Ficha técnica de su compañía, servicios contratados activos, equipo responsable y canales de contacto prioritarios.', '• Mi Empresa:')

  doc.addSection('3', 'Uso del Dashboard Financiero en Tiempo Real')
  doc.addParagraph(
    'El Dashboard condensa la situación operativa de su empresa. Está diseñado para ofrecer visibilidad inmediata sin requerir descargas previas ni hojas de cálculo complejas.'
  )
  doc.addBullet('Consolidado de saldos bancarios actualizados conforme a las conciliaciones procesadas por el equipo Finto.', '• Indicador de Bancos:')
  doc.addBullet('Estado de las facturas emitidas, cartera vencida y semáforo de cobro preventivo.', '• Cartera y Recaudo:')
  doc.addBullet('Calendario gráfico con las obligaciones inmediatas (DIAN, distritales, PILA, nómina y proveedores clave).', '• Próximos Vencimientos:')
  doc.addBullet('Nivel de cumplimiento mensual de los entregables acordados en el acuerdo de servicio.', '• Estado de los Servicios:')

  doc.addSection('4', 'Gestión de Tareas y Flujos de Aprobación')
  doc.addParagraph(
    'Uno de los pilares del portal es la agilidad en aprobaciones críticas sin intercambio desordenado de correos electrónicos.'
  )
  doc.addBullet('Cada vez que Finto prepare un paquete de dispersión (proveedores o nómina) o una liquidación de impuestos, aparecerá una tarea pendiente.', '• Notificación de tarea:')
  doc.addBullet('Al abrir la tarea, podrá revisar el detalle, los soportes adjuntos y el monto total exacto.', '• Verificación de soportes:')
  doc.addBullet('Podrá aprobar con un solo clic o solicitar ajustes indicando el motivo en el cuadro de comentarios.', '• Aprobación o Devolución:')
  doc.addBullet('Todo movimiento queda registrado en el historial de auditoría con fecha, hora y usuario responsable.', '• Trazabilidad total:')

  doc.addSection('5', 'Centro Documental y Archivo Digital')
  doc.addParagraph(
    'El centro documental almacena de forma ordenada y perpetua todos los archivos generados y recibidos en la prestación del servicio:'
  )
  doc.addBullet('Balances generales, estados de resultados, notas explicativas y certificaciones emitidas por el contador asignado.', '• Contabilidad:')
  doc.addBullet('Declaraciones de renta, IVA, retención en la fuente, ICA distrital y recibos de pago con código de barras legible.', '• Impuestos:')
  doc.addBullet('Desprendibles de pago, planillas de seguridad social PILA y liquidaciones de prestaciones sociales.', '• Nómina y Seguridad Social:')
  doc.addBullet('Utilice el botón "Subir Documento" para cargar extractos bancarios, facturas de compras o radicados de proveedores.', '• Carga de archivos:')

  doc.addSection('6', 'Módulo de Solicitudes y Requerimientos')
  doc.addParagraph(
    'Para canalizar requerimientos imprevistos o consultas especiales fuera del calendario habitual:'
  )
  doc.addBullet('Haga clic en "+ Nueva Solicitud", elija el área (Contable, Impuestos, Tesorería, Facturación, Nómina) y describa la necesidad.', '1. Radicación:')
  doc.addBullet('Asigne la prioridad (Baja, Media, Alta o Urgente) y adjunte los archivos soporte si aplica.', '2. Prioridad:')
  doc.addBullet('Podrá chatear directamente dentro del hilo de la solicitud con el profesional que atiende el caso.', '3. Seguimiento:')
  doc.addBullet('Una vez resuelto el requerimiento, la solicitud se marca como cerrada con la respuesta formal adjunta.', '4. Cierre formal:')

  doc.addSection('7', 'Canales de Atención y Soporte Técnico')
  doc.addParagraph(
    'Finto cuenta con un equipo humano multidisciplinario comprometido con el éxito de su compañía. Ante cualquier incidencia técnica en la plataforma o duda operativa:'
  )
  doc.addBullet('finto@finto.la (tiempo de respuesta garantizado según SLA comercial).', '• Correo de soporte:')
  doc.addBullet('+57 310 217 0905 (Línea directa para urgencias operativas y coordinación inmediata).', '• Atención WhatsApp:')
  doc.addBullet('Lunes a viernes de 8:00 a.m. a 6:00 p.m. (Hora de Colombia).', '• Horario de atención:')

  doc.finalizeFooters()

  const pdfBytes = await pdfDoc.save()
  fs.writeFileSync(path.join(PUBLIC_DOCS, 'manual-de-usuario.pdf'), pdfBytes)
  console.log('✅ Generated public/docs/manual-de-usuario.pdf')
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDER 2: Política de Tratamiento de Datos Personales
// ─────────────────────────────────────────────────────────────────────────────
async function generateDataPolicy() {
  const pdfDoc = await PDFDocument.create()
  const doc = new DocBuilder('Política de Tratamiento de Datos Personales · RAD Services S.A.S. | Finto', 'Política Oficial')
  await doc.init(pdfDoc)

  doc.addTitleBanner(
    'Política de Tratamiento de Datos Personales',
    'RAD Services S.A.S. | Finto',
    {
      'Responsable:': 'RAD Services S.A.S.',
      'Marca comercial:': 'Finto',
      'NIT:': '901.954.048-5',
      'Domicilio:': 'Bogotá D.C., Colombia',
      'Sitio web y canal digital:': 'https://finto.la y el formulario de contacto disponible en el sitio web',
    }
  )

  doc.addParagraph(
    'Aplicable a los servicios de back office financiero y administrativo, el portal de clientes, el sitio web y los canales digitales de Finto.',
    true
  )

  doc.addSection('1', 'Objeto y alcance')
  doc.addParagraph(
    'Esta Política explica cómo RAD Services S.A.S., identificada comercialmente como Finto, recolecta, almacena, usa, circula, transmite, transfiere, actualiza, conserva y suprime datos personales. Aplica a sus relaciones comerciales, precontractuales, contractuales, laborales y con proveedores, así como al sitio web, formularios, portal de clientes, correo, mensajería y demás canales físicos o digitales que utilice.'
  )
  doc.addParagraph(
    'Finto presta servicios de back office financiero y administrativo. Según cada operación, podrá actuar como Responsable del Tratamiento cuando determine las finalidades y los medios, o como Encargado cuando trate datos por cuenta y bajo instrucciones de un cliente u otro Responsable.'
  )

  doc.addSection('2', 'Marco normativo')
  doc.addParagraph(
    'Esta Política se adopta con fundamento en los artículos 15 y 20 de la Constitución Política de Colombia, la Ley 1581 de 2012, el Decreto 1074 de 2015 y las normas que los modifiquen, adicionen o sustituyan. Cuando corresponda, también se aplicarán la Ley 1266 de 2008 sobre información financiera, crediticia, comercial y de servicios; la Ley 2300 de 2023 sobre canales y horarios de contacto; y las instrucciones de la Superintendencia de Industria y Comercio, incluida la Circular Externa 002 de 2024 sobre tratamiento de datos personales en sistemas de inteligencia artificial.'
  )

  doc.addSection('3', 'Definiciones')
  doc.addBullet('consentimiento previo, expreso e informado del Titular cuando la ley lo exija.', '• Autorización:')
  doc.addBullet('información vinculada o que pueda asociarse a una persona natural determinada o determinable.', '• Dato personal:')
  doc.addBullet('información que afecta la intimidad del Titular o cuyo uso indebido puede generar discriminación.', '• Dato sensible:')
  doc.addBullet('persona natural o jurídica que realiza el Tratamiento por cuenta del Responsable.', '• Encargado:')
  doc.addBullet('persona natural o jurídica que decide sobre la base de datos o sobre las finalidades y los medios del Tratamiento.', '• Responsable:')
  doc.addBullet('persona natural cuyos datos personales son objeto de Tratamiento.', '• Titular:')
  doc.addBullet('entrega de datos a otro Responsable, ubicado dentro o fuera de Colombia.', '• Transferencia:')
  doc.addBullet('comunicación de datos a un Encargado para que los trate por cuenta del Responsable.', '• Transmisión:')
  doc.addBullet('cualquier operación sobre datos personales, como recolección, almacenamiento, uso, circulación, actualización o supresión.', '• Tratamiento:')

  doc.addSection('4', 'Principios')
  doc.addParagraph(
    'Finto aplicará los principios de legalidad, finalidad, libertad, veracidad o calidad, transparencia, acceso y circulación restringida, seguridad, confidencialidad, necesidad y minimización. Recolectará y utilizará únicamente la información pertinente para finalidades legítimas, determinadas e informadas.'
  )

  doc.addSection('5', 'Titulares y categorías de datos')
  doc.addParagraph(
    'Podrán ser Titulares los clientes y sus empleados, administradores, accionistas, contratistas, proveedores, usuarios, beneficiarios y contactos; los prospectos; los proveedores y aliados de Finto; los candidatos, colaboradores y extrabajadores; y otras personas que interactúen con Finto o cuyos datos estén contenidos en información entregada por un cliente.'
  )
  doc.addBullet('Datos de identificación y contacto, incluida información de representantes legales y contactos empresariales.')
  doc.addBullet('Datos laborales, profesionales, académicos, de seguridad social, nómina y beneficiarios, cuando el servicio contratado lo requiera.')
  doc.addBullet('Datos financieros, bancarios, tributarios, contables, comerciales y de facturación.')
  doc.addBullet('Información contractual, societaria, administrativa y de proveedores.')
  doc.addBullet('Datos técnicos y de uso, como dirección IP, dispositivo, navegador, registros de acceso, actividad en el portal y eventos de seguridad.')
  doc.addBullet('Comunicaciones y archivos enviados por correo, formularios, mensajería, reuniones o canales de soporte.')
  doc.addBullet('Datos sensibles o de menores que aparezcan de manera necesaria en soportes laborales, de seguridad social, tributarios o contractuales, sujetos a protección reforzada.')

  doc.addSection('6', 'Finalidades cuando Finto actúa como Responsable')
  doc.addBullet('Gestionar relaciones comerciales, precontractuales, contractuales y de servicio.')
  doc.addBullet('Elaborar propuestas, diagnósticos, cotizaciones, contratos y configuraciones de servicio.')
  doc.addBullet('Administrar clientes, usuarios, accesos, autenticación, soporte y seguridad del portal y de los canales digitales.')
  doc.addBullet('Prestar servicios contables, tributarios, de tesorería, facturación, cartera, nómina, administración, controller, flujo de caja, presupuesto, forecast, indicadores, reportes, planeación, estructuración financiera y CFO as a Service, según el alcance contratado.')
  doc.addBullet('Gestionar facturación, pagos, recaudo, cobro, contabilidad, impuestos y obligaciones legales de Finto.')
  doc.addBullet('Atender consultas, solicitudes, reclamos, peticiones, incidentes y requerimientos de autoridades.')
  doc.addBullet('Gestionar proveedores, aliados, contratistas, candidatos, colaboradores y obligaciones laborales o de seguridad social.')
  doc.addBullet('Enviar comunicaciones operativas relacionadas con el servicio y, con autorización cuando sea exigible, comunicaciones comerciales.')
  doc.addBullet('Medir el uso de los servicios, generar estadísticas y mejorar procesos, procurando utilizar información agregada, disociada o anonimizada cuando sea posible.')
  doc.addBullet('Prevenir fraude, accesos no autorizados, conflictos de interés, incumplimientos y eventos de seguridad.')
  doc.addBullet('Cumplir obligaciones legales, regulatorias, contractuales y de defensa de derechos.')

  doc.addSection('7', 'Tratamiento por cuenta de clientes')
  doc.addParagraph(
    'Cuando un cliente determine las finalidades y los medios del Tratamiento, el cliente será el Responsable y Finto actuará como Encargado. En ese caso, Finto tratará los datos conforme al contrato, al acuerdo de transmisión de datos, a las instrucciones documentadas del cliente y a la ley.'
  )
  doc.addParagraph(
    'El cliente deberá asegurar que cuenta con las autorizaciones o bases jurídicas necesarias y que la información entregada es pertinente y lícita. Finto limitará el acceso a las personas y proveedores que necesiten la información para ejecutar el servicio. Las solicitudes de Titulares relacionadas con datos controlados por un cliente podrán remitirse al Responsable correspondiente.'
  )

  doc.addSection('8', 'Portal de clientes, automatización e inteligencia artificial')
  doc.addParagraph(
    'El portal de Finto puede centralizar documentos, tareas, indicadores, reportes, calendarios y accesos relacionados con los servicios contratados. Los registros técnicos se utilizarán para operar el portal, autenticar usuarios, prestar soporte y proteger la información.'
  )
  doc.addParagraph(
    'Finto podrá utilizar herramientas de automatización y, cuando corresponda, sistemas de inteligencia artificial para apoyar la clasificación, extracción, análisis, elaboración de borradores, detección de inconsistencias o generación de reportes. Estos sistemas serán herramientas de apoyo y no sustituirán la revisión profesional cuando esta resulte necesaria.'
  )
  doc.addParagraph(
    'Finto procurará aplicar privacidad desde el diseño y por defecto, minimización, control de acceso, evaluación de riesgos, supervisión humana y medidas de seguridad. No usará datos personales para finalidades incompatibles con las informadas ni para entrenar modelos de terceros, salvo que exista una base jurídica válida, condiciones contractuales adecuadas y, cuando corresponda, autorización.'
  )

  doc.addSection('9', 'Datos sensibles y datos de menores')
  doc.addParagraph(
    'El suministro de datos sensibles es facultativo, salvo que su Tratamiento sea necesario y esté permitido por la ley. Cuando se requieran, Finto informará su carácter sensible y la finalidad, solicitará autorización explícita cuando corresponda y aplicará medidas reforzadas.'
  )
  doc.addParagraph(
    'Finto no dirige sus servicios a menores. Sin embargo, puede recibir datos de niñas, niños o adolescentes incluidos en nómina, seguridad social, beneficios, información tributaria u otros soportes empresariales. Su Tratamiento respetará el interés superior del menor, sus derechos fundamentales y las reglas de representación y autorización aplicables.'
  )

  doc.addSection('10', 'Autorización y aviso de privacidad')
  doc.addParagraph(
    'Cuando la ley exija autorización, Finto la obtendrá por medios físicos, electrónicos, digitales, verbales verificables o mediante conductas inequívocas. Conservará evidencia de la autorización y permitirá su consulta cuando proceda.'
  )
  doc.addParagraph(
    'El aviso de privacidad informará las finalidades principales, los derechos del Titular, los canales de atención y la forma de consultar esta Política. La autorización no será necesaria en los casos exceptuados por la ley.'
  )

  doc.addSection('11', 'Proveedores y otros Encargados')
  doc.addParagraph(
    'Finto podrá apoyarse en proveedores de alojamiento, infraestructura, almacenamiento, correo, mensajería, colaboración, contabilidad, nómina, analítica, seguridad, soporte, firma electrónica, automatización e inteligencia artificial. Les exigirá obligaciones de confidencialidad, seguridad y Tratamiento conforme a instrucciones, cuando actúen como Encargados.'
  )
  doc.addParagraph(
    'La relación de proveedores puede cambiar con la operación. Finto evaluará el rol real de cada tercero, la finalidad, la ubicación del Tratamiento y las garantías contractuales o legales aplicables.'
  )

  doc.addSection('12', 'Transferencias y transmisiones internacionales')
  doc.addParagraph(
    'La operación de servicios tecnológicos puede implicar acceso, almacenamiento o soporte desde otros países. Finto gestionará las transmisiones internacionales mediante contratos u otros instrumentos que definan el alcance, la seguridad, la confidencialidad y las obligaciones del Encargado.'
  )
  doc.addParagraph(
    'Si se realiza una transferencia a otro Responsable, Finto verificará el cumplimiento de las reglas colombianas sobre países con nivel adecuado de protección, excepciones legales o declaraciones de conformidad de la Superintendencia de Industria y Comercio, cuando sean exigibles.'
  )

  doc.addSection('13', 'Derechos de los Titulares')
  doc.addBullet('Conocer, actualizar y rectificar sus datos personales.')
  doc.addBullet('Solicitar prueba de la autorización, salvo las excepciones legales.')
  doc.addBullet('Ser informado sobre el uso dado a sus datos.')
  doc.addBullet('Acceder gratuitamente a sus datos en los términos legales.')
  doc.addBullet('Revocar la autorización o solicitar la supresión cuando proceda y no exista un deber legal o contractual de conservación.')
  doc.addBullet('Presentar quejas ante la Superintendencia de Industria y Comercio, una vez agotado el trámite interno cuando la ley lo exija.')

  doc.addSection('14', 'Consultas, reclamos y solicitudes')
  doc.addParagraph(
    'El Titular, sus causahabientes o su representante podrán presentar solicitudes mediante el formulario de contacto disponible en https://finto.la o por el canal de privacidad informado en el contrato, propuesta, autorización o aviso de privacidad aplicable. La petición deberá incluir nombre e identificación del solicitante, calidad en la que actúa, datos de contacto, descripción clara de la solicitud y documentos que acrediten identidad o representación cuando sean necesarios.'
  )
  doc.addSubSection('Consultas')
  doc.addParagraph(
    'Finto atenderá las consultas en un término máximo de diez días hábiles desde su recepción. Si no puede responder en ese plazo, informará el motivo y la nueva fecha, que no superará los cinco días hábiles siguientes al vencimiento del término inicial.'
  )
  doc.addSubSection('Reclamos')
  doc.addParagraph(
    'Los reclamos deberán identificar al Titular, describir los hechos, indicar la dirección de contacto y acompañar los documentos pertinentes. Si están incompletos, Finto solicitará la corrección dentro de los cinco días hábiles siguientes. Si el solicitante no completa el reclamo dentro de los dos meses siguientes al requerimiento, se entenderá desistido. El reclamo completo será atendido en un máximo de quince días hábiles; de ser necesaria una prórroga, se informará el motivo y la nueva fecha, que no excederá ocho días hábiles adicionales.'
  )
  doc.addParagraph(
    'Cuando Finto actúe como Encargado, podrá trasladar la solicitud al cliente Responsable y colaborar con su atención de acuerdo con el contrato y la ley.'
  )

  doc.addSection('15', 'Seguridad y gestión de incidentes')
  doc.addParagraph(
    'Finto adoptará medidas técnicas, humanas, administrativas y organizacionales razonables y proporcionales al riesgo. Estas podrán incluir gestión de identidades y accesos, mínimo privilegio, autenticación, cifrado, copias de seguridad, monitoreo, registro de eventos, segregación de ambientes, gestión de vulnerabilidades, continuidad, eliminación segura, acuerdos de confidencialidad y controles sobre proveedores.'
  )
  doc.addParagraph(
    'Los incidentes se gestionarán conforme a los procedimientos internos y a las obligaciones contractuales o legales de evaluación, contención, documentación y reporte a los clientes o autoridades cuando corresponda.'
  )

  doc.addSection('16', 'Conservación y supresión')
  doc.addParagraph(
    'Finto conservará los datos durante el tiempo necesario para cumplir la finalidad informada y las obligaciones legales, contables, tributarias, laborales, contractuales, probatorias y de seguridad. La duración podrá variar según el tipo de información, el servicio y las instrucciones del cliente Responsable.'
  )
  doc.addBullet('durante los términos de conservación exigidos por la ley y los plazos necesarios para atender auditorías, requerimientos o controversias.', '• Información contractual, contable, tributaria, laboral y de seguridad social:')
  doc.addBullet('durante la relación contractual y el período acordado para devolución, migración, bloqueo o eliminación segura.', '• Información tratada por cuenta de clientes:')
  doc.addBullet('mientras exista una finalidad comercial vigente, autorización aplicable o interés legítimo permitido, con revisión periódica de necesidad.', '• Prospectos y contactos comerciales:')
  doc.addBullet('durante los ciclos técnicos, contractuales o legales definidos, con acceso restringido.', '• Registros técnicos, copias de seguridad y evidencias de seguridad:')
  doc.addParagraph(
    'Cuando los datos dejen de ser necesarios y no exista obligación de conservarlos, Finto los eliminará, anonimizará o dispondrá de manera segura. La supresión puede estar sujeta a ciclos de respaldo o bloqueo temporal destinados exclusivamente a seguridad y cumplimiento.'
  )

  doc.addSection('17', 'Confidencialidad')
  doc.addParagraph(
    'Las personas que intervengan en el Tratamiento deberán mantener la reserva de la información incluso después de terminar su relación con Finto, cuando la naturaleza de los datos o la ley así lo exijan. Finto procurará que colaboradores, contratistas y proveedores conozcan y cumplan estas obligaciones.'
  )

  doc.addSection('18', 'Modificaciones, vigencia y control de versiones')
  doc.addParagraph(
    'Finto podrá actualizar esta Política para reflejar cambios legales, tecnológicos, operativos o en las finalidades del Tratamiento. Las modificaciones relevantes se comunicarán por los canales disponibles y se solicitarán nuevas autorizaciones cuando sean legalmente necesarias.'
  )
  doc.addCallout(
    'Control de versión',
    'Versión: 1.0\nFecha de entrada en vigencia: 30 de septiembre de 2026\nÚltima actualización: 30 de septiembre de 2026'
  )

  doc.finalizeFooters()

  const pdfBytes = await pdfDoc.save()
  fs.writeFileSync(path.join(PUBLIC_DOCS, 'politica-tratamiento-datos-personales-finto.pdf'), pdfBytes)
  console.log('✅ Generated public/docs/politica-tratamiento-datos-personales-finto.pdf')
}

async function run() {
  await generateUserManual()
  await generateDataPolicy()
}

run().catch(console.error)
