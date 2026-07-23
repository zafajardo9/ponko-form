import type { InvoiceModel } from './invoice'

/**
 * Small, dependency-free PDF writer for the respondent invoice. Keeping the
 * document deliberately simple removes the full React PDF renderer from the
 * browser while retaining a real, selectable-text PDF.
 */

type Color = readonly [number, number, number]
type PdfPage = { commands: string[] }

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const LEFT = 40
const RIGHT = PAGE_WIDTH - 40
const CONTENT_WIDTH = RIGHT - LEFT

const COLORS = {
  ink: [0.078, 0.078, 0.075] as Color,
  muted: [0.557, 0.545, 0.51] as Color,
  soft: [0.424, 0.416, 0.392] as Color,
  border: [0.902, 0.875, 0.847] as Color,
  panel: [0.98, 0.976, 0.961] as Color,
  accent: [0.8, 0.471, 0.361] as Color,
  green: [0.184, 0.49, 0.322] as Color,
  greenPanel: [0.847, 0.941, 0.878] as Color,
}

function number(value: number) {
  return Number(value.toFixed(3)).toString()
}

function color(value: Color) {
  return value.map(number).join(' ')
}

function pdfText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7e]/g, '?')
    .replace(/([\\()])/g, '\\$1')
}

function approximateTextWidth(value: string, fontSize: number, bold = false) {
  return value.length * fontSize * (bold ? 0.56 : 0.52)
}

function wrapText(value: string, maxWidth: number, fontSize: number, bold = false) {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (approximateTextWidth(candidate, fontSize, bold) <= maxWidth) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    if (approximateTextWidth(word, fontSize, bold) <= maxWidth) {
      current = word
      continue
    }

    const maxCharacters = Math.max(1, Math.floor(maxWidth / (fontSize * (bold ? 0.56 : 0.52))))
    for (let index = 0; index < word.length; index += maxCharacters) {
      const chunk = word.slice(index, index + maxCharacters)
      if (chunk.length === maxCharacters || index + maxCharacters < word.length) lines.push(chunk)
      else current = chunk
    }
  }
  if (current) lines.push(current)
  return lines
}

function addText(
  page: PdfPage,
  value: string,
  x: number,
  y: number,
  size: number,
  options: { bold?: boolean; fill?: Color; align?: 'left' | 'right' } = {},
) {
  const safe = pdfText(value)
  const actualX = options.align === 'right'
    ? x - approximateTextWidth(safe, size, options.bold)
    : x
  page.commands.push(
    `BT /${options.bold ? 'F2' : 'F1'} ${number(size)} Tf ${color(options.fill ?? COLORS.ink)} rg 1 0 0 1 ${number(actualX)} ${number(y)} Tm (${safe}) Tj ET`,
  )
}

function addLine(page: PdfPage, x1: number, y1: number, x2: number, y2: number, stroke = COLORS.border) {
  page.commands.push(
    `${color(stroke)} RG 0.7 w ${number(x1)} ${number(y1)} m ${number(x2)} ${number(y2)} l S`,
  )
}

function addRect(
  page: PdfPage,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: Color,
  stroke?: Color,
) {
  page.commands.push(
    `${color(fill)} rg${stroke ? ` ${color(stroke)} RG 0.7 w` : ''} ${number(x)} ${number(y)} ${number(width)} ${number(height)} re ${stroke ? 'B' : 'f'}`,
  )
}

function addHeader(page: PdfPage, invoice: InvoiceModel, continuation = false) {
  addText(page, invoice.issuer, LEFT, 790, continuation ? 13 : 16, { bold: true })
  addText(page, continuation ? 'Invoice continued' : 'Receipt / Invoice', LEFT, 772, 9.5, { fill: COLORS.muted })
  addText(page, continuation ? 'INVOICE - CONTINUED' : 'INVOICE', RIGHT, 790, continuation ? 14 : 21, {
    bold: true,
    fill: COLORS.accent,
    align: 'right',
  })
  addText(page, invoice.invoiceNo, RIGHT, 772, 9.5, { fill: COLORS.muted, align: 'right' })
  if (!continuation) {
    addText(page, invoice.dateText, RIGHT, 758, 9.5, { fill: COLORS.muted, align: 'right' })
    if (invoice.paid) {
      addRect(page, RIGHT - 42, 727, 42, 19, COLORS.greenPanel)
      addText(page, 'PAID', RIGHT - 21, 733, 9, { bold: true, fill: COLORS.green, align: 'right' })
    }
  }
  addLine(page, LEFT, 716, RIGHT, 716)
}

function addPageNumber(page: PdfPage, index: number, total: number) {
  addText(page, `Page ${index + 1} of ${total}`, RIGHT, 28, 8.5, {
    fill: COLORS.muted,
    align: 'right',
  })
}

function createInvoicePages(invoice: InvoiceModel) {
  const pages: PdfPage[] = [{ commands: [] }]
  let page = pages[0]
  addHeader(page, invoice)
  let y = 686

  if (invoice.lines.length > 0) {
    addText(page, 'DETAILS', LEFT, y, 8.5, { bold: true, fill: COLORS.muted })
    y -= 20

    for (const line of invoice.lines) {
      const labelLines = wrapText(line.label, CONTENT_WIDTH * 0.48, 10)
      const valueLines = wrapText(line.value, CONTENT_WIDTH * 0.48, 10, true)
      const lineCount = Math.max(labelLines.length, valueLines.length)
      const rowHeight = Math.max(28, lineCount * 13 + 12)

      if (y - rowHeight < 105) {
        page = { commands: [] }
        pages.push(page)
        addHeader(page, invoice, true)
        y = 686
        addText(page, 'DETAILS (CONTINUED)', LEFT, y, 8.5, { bold: true, fill: COLORS.muted })
        y -= 20
      }

      for (let index = 0; index < lineCount; index += 1) {
        if (labelLines[index]) {
          addText(page, labelLines[index], LEFT, y - 12 - index * 13, 10, { fill: COLORS.soft })
        }
        if (valueLines[index]) {
          addText(page, valueLines[index], RIGHT, y - 12 - index * 13, 10, { bold: true, align: 'right' })
        }
      }
      y -= rowHeight
      addLine(page, LEFT, y, RIGHT, y)
    }
    y -= 22
  }

  const footerHeight = (invoice.totalText ? 65 : 0)
    + (invoice.gatewayName ? 14 : 0)
    + (invoice.reference ? 14 : 0)
    + 42
  if (y - footerHeight < 55) {
    page = { commands: [] }
    pages.push(page)
    addHeader(page, invoice, true)
    y = 680
  }

  if (invoice.totalText) {
    addRect(page, LEFT, y - 45, CONTENT_WIDTH, 52, COLORS.panel, COLORS.border)
    addText(page, 'Amount paid', LEFT + 14, y - 17, 10, { fill: COLORS.soft })
    addText(page, invoice.totalText, RIGHT - 14, y - 22, 17, { bold: true, align: 'right' })
    y -= 66
  }

  if (invoice.gatewayName) {
    addText(page, `Paid via ${invoice.gatewayName}`, LEFT, y, 9, { fill: COLORS.muted })
    y -= 14
  }
  if (invoice.reference) {
    addText(page, `Reference: ${invoice.reference}`, LEFT, y, 9, { fill: COLORS.muted })
    y -= 14
  }
  addText(page, 'Thank you for your payment.', LEFT, y - 8, 9, { fill: COLORS.muted })

  pages.forEach((item, index) => addPageNumber(item, index, pages.length))
  return pages
}

function encodePdf(invoice: InvoiceModel) {
  const pages = createInvoicePages(invoice)
  const objects: string[] = ['']
  const pageObjectIds = pages.map((_, index) => 5 + index * 2)
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] >>`
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'

  pages.forEach((page, index) => {
    const pageId = pageObjectIds[index]
    const contentId = pageId + 1
    const stream = page.commands.join('\n')
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${number(PAGE_WIDTH)} ${number(PAGE_HEIGHT)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`
    objects[contentId] = `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`
  })

  const encoder = new TextEncoder()
  let output = '%PDF-1.4\n%PonkoForm\n'
  const offsets = [0]
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = encoder.encode(output).length
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }
  const xrefOffset = encoder.encode(output).length
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let id = 1; id < objects.length; id += 1) {
    output += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  }
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return encoder.encode(output)
}

export async function generateInvoicePdf(invoice: InvoiceModel): Promise<Blob> {
  return new Blob([encodePdf(invoice)], { type: 'application/pdf' })
}
