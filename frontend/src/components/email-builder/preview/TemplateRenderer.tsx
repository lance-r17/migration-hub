import type { EmailTemplate, EmailRow, EmailColumn, EmailComponent } from '@/types/email'
import { TABLE_DATA_SOURCES } from '@/types/email'

type RenderData = Record<string, string | Record<string, unknown>[]>

// ─── Variable substitution ────────────────────────────────────────────────────

function resolveVariables(text: string, data: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => data[key.trim()] ?? `{{${key.trim()}}}`)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function resolveItemLinkPattern(pattern: string, item: Record<string, unknown>, data: RenderData): string {
  // Phase 1: resolve top-level {{var}} template variables
  let url = pattern.replace(/\{\{([^}]+)\}\}/g, (_, k) => String((data as Record<string, string>)[k.trim()] ?? ''))
  // Phase 2: resolve item-level {field} tokens
  url = url.replace(/\{(\w+)\}/g, (_, k) => String(item[k] ?? ''))
  return url
}

// ─── Inline styles ────────────────────────────────────────────────────────────

function inlinePadding(comp: EmailComponent): string {
  const { paddingTop = 0, paddingBottom = 0, paddingLeft = 0, paddingRight = 0 } = comp.style
  return `padding: ${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px;`
}

function renderComponent(comp: EmailComponent, template: EmailTemplate, data: Record<string, string>): string {
  const { accentColor, textColor, fontFamily, fontSize } = template.templateStyle
  const base = `${inlinePadding(comp)} text-align: ${comp.style.textAlign ?? 'left'}; font-family: ${fontFamily}; font-size: ${fontSize}px; color: ${textColor};`

  switch (comp.type) {
    case 'text': {
      const html = resolveVariables(comp.content.html ?? '', data)
      return `<div class="prose" style="${base}">${html}</div>`
    }
    case 'hero-image': {
      if (!comp.content.imageUrl) return `<div style="${base} height: ${comp.style.height ?? '160px'}; background: #e5e7eb; display: flex; align-items: center; justify-content: center;"><p style="color: #9ca3af; font-size: 12px;">Hero image</p></div>`
      const url = resolveVariables(comp.content.imageUrl, data)
      return `<img src="${url}" alt="${comp.content.altText ?? ''}" style="display: block; width: ${comp.style.width ?? '100%'}; height: ${comp.style.height ?? 'auto'}; object-fit: cover; border-radius: ${comp.style.borderRadius ?? 0}px; ${inlinePadding(comp)}" />`
    }
    case 'image': {
      if (!comp.content.imageUrl) return `<div style="${base} height: 80px; background: #e5e7eb;"></div>`
      const url = resolveVariables(comp.content.imageUrl, data)
      return `<img src="${url}" alt="${comp.content.altText ?? ''}" style="display: block; max-width: 100%; width: ${comp.style.width ?? 'auto'}; height: ${comp.style.height ?? 'auto'}; border-radius: ${comp.style.borderRadius ?? 0}px; ${inlinePadding(comp)}" />`
    }
    case 'cta': {
      const btnBg = comp.style.backgroundColor ?? accentColor
      const btnColor = comp.style.textColor ?? '#ffffff'
      const btnText = resolveVariables(comp.content.buttonText ?? 'Click here', data)
      const href = resolveVariables(comp.config.linkUrl ?? '#', data)
      const align = comp.style.textAlign ?? 'center'
      return `<div style="${inlinePadding(comp)} text-align: ${align};"><a href="${href}" target="${comp.config.openInNewTab ? '_blank' : '_self'}" style="display: inline-block; background-color: ${btnBg}; color: ${btnColor}; font-weight: 600; padding: 10px 24px; border-radius: ${comp.style.borderRadius ?? 6}px; text-decoration: none; font-family: ${fontFamily}; font-size: ${fontSize}px;">${btnText}</a></div>`
    }
    case 'divider':
      return `<div style="${inlinePadding(comp)}"><hr style="border: none; border-top: ${comp.content.thickness ?? 1}px solid ${comp.content.color ?? '#e5e7eb'};" /></div>`
    case 'spacer':
      return `<div style="height: ${comp.content.spacerHeight ?? 16}px;"></div>`
    default:
      return ''
  }
}

function renderColumn(col: EmailColumn, template: EmailTemplate, data: Record<string, string>, width: string): string {
  const inner = col.components.map(c => renderComponent(c, template, data)).join('')
  return `<td class="email-col" style="width: ${width}; vertical-align: top; padding: 0;">${inner}</td>`
}

function renderRow(row: EmailRow, template: EmailTemplate, data: RenderData): string {
  const scalarData = data as Record<string, string>
  const { accentColor, fontFamily, fontSize, textColor } = template.templateStyle

  let colWidths: string[]
  switch (row.layout) {
    case 'full': colWidths = ['100%']; break
    case 'two-col': colWidths = ['50%', '50%']; break
    case 'three-col': colWidths = ['33.33%', '33.33%', '33.33%']; break
    case 'left-sidebar': colWidths = ['35%', '65%']; break
    case 'table': {
      const n = row.columns.length || 3
      const w = `${(100 / n).toFixed(2)}%`
      colWidths = Array(n).fill(w)
      break
    }
    default: colWidths = ['100%']
  }

  // Table layout with data source: render rows from the data array
  if (row.layout === 'table' && row.tableConfig) {
    const tc = row.tableConfig
    const n = row.columns.length || 3
    const colW = `${(100 / n).toFixed(2)}%`

    let headerHtml = ''
    if (tc.headerEnabled && tc.headerTexts?.length) {
      const ths = Array.from({ length: n }).map((_, i) => {
        const label = tc.headerTexts[i] || `Column ${i + 1}`
        return `<th style="width: ${colW}; padding: 8px; text-align: left; font-family: ${fontFamily}; font-size: ${fontSize}px; font-weight: 600; background-color: ${accentColor}20; border-bottom: 2px solid ${accentColor}; color: inherit;">${escapeHtml(label)}</th>`
      }).join('')
      headerHtml = `<tr>${ths}</tr>`
    }

    let dataRowsHtml = ''
    if (tc.dataSource && tc.columnConfigs?.length) {
      const rawItems = data[tc.dataSource]
      let items = Array.isArray(rawItems) ? rawItems as Record<string, unknown>[] : []

      // Fall back to stub items from the registry when no real data is provided
      if (items.length === 0) {
        const sourceDef = TABLE_DATA_SOURCES.find(ds => ds.key === tc.dataSource)
        if (sourceDef) {
          items = Array.from({ length: Math.min(tc.numRows || 3, 3) }, () => {
            const obj: Record<string, unknown> = {}
            sourceDef.fields.forEach(f => { obj[f.key] = f.example })
            return obj
          })
        }
      }

      dataRowsHtml = items.map((item, rowIdx) => {
        const tds = tc.columnConfigs!.map((cc, i) => {
          const rawValue = escapeHtml(String(item[cc.fieldKey] ?? ''))
          let cellHtml: string
          if (cc.type === 'link' && cc.linkPattern) {
            const href = resolveItemLinkPattern(cc.linkPattern, item, data)
            cellHtml = `<a href="${href}" style="color: ${accentColor}; text-decoration: underline;">${rawValue}</a>`
          } else {
            cellHtml = rawValue
          }
          const rowBg = rowIdx % 2 === 1 ? 'background-color: #f9fafb;' : ''
          return `<td style="width: ${colW}; padding: 8px; font-family: ${fontFamily}; font-size: ${fontSize}px; color: ${textColor}; border-bottom: 1px solid #e5e7eb; vertical-align: top; ${rowBg}">${cellHtml}</td>`
        }).join('')
        return `<tr>${tds}</tr>`
      }).join('')
    }

    return `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td colspan="${n}" style="padding: 0;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">${headerHtml}${dataRowsHtml}</table></td></tr></table>`
  }

  // Non-table rows
  const cells = row.columns.map((col, i) => renderColumn(col, template, scalarData, colWidths[i] ?? '100%')).join('')

  let headerRow = ''
  if (row.layout === 'table' && row.tableConfig?.headerEnabled && row.tableConfig.headerTexts?.length) {
    const ths = row.columns.map((_, i) => {
      const label = row.tableConfig!.headerTexts[i] || `Column ${i + 1}`
      return `<th style="width: ${colWidths[i] ?? '100%'}; padding: 8px; text-align: left; font-family: ${fontFamily}; font-size: ${fontSize}px; font-weight: 600; background-color: ${accentColor}20; border-bottom: 2px solid ${accentColor}; color: inherit;">${label}</th>`
    }).join('')
    headerRow = `<tr>${ths}</tr>`
  }

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0">${headerRow}<tr>${cells}</tr></table>`
}

// ─── Public API ───────────────────────────────────────────────────────────────

const GOOGLE_FONTS: Record<string, string> = {
  'Montserrat': 'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
  'Roboto':     'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
  'Open Sans':  'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap',
  'Lato':       'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap',
  'Inter':      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
}

export function generateEmailHtml(template: EmailTemplate, sampleData: RenderData): string {
  const { backgroundColor, maxWidth, paddingX, paddingY, fontFamily, fontSize, textColor } = template.templateStyle
  const subject = resolveVariables(template.subject, sampleData as Record<string, string>)
  const rows = template.rows.map(r => renderRow(r, template, sampleData)).join('')

  const googleFontLink = GOOGLE_FONTS[fontFamily]
    ? `  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${GOOGLE_FONTS[fontFamily]}" rel="stylesheet" />`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
${googleFontLink}
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background: #F5F1E6; font-family: ${fontFamily}, sans-serif; }
    * { box-sizing: border-box; }
    .prose p { margin: 0; line-height: 1.6; }
    .prose h1, .prose h2, .prose h3 { margin: 0 0 8px; }
    .prose ul, .prose ol { margin: 4px 0; padding-left: 20px; }
    .prose a { color: ${template.templateStyle.accentColor}; }
    @media screen and (max-width: 480px) {
      body { padding: 12px !important; }
      .email-content { width: 100% !important; }
      .email-col { display: block !important; width: 100% !important; box-sizing: border-box !important; }
    }
  </style>
</head>
<body style="background: #F5F1E6; padding: 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <table
          class="email-content"
          width="${maxWidth}"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="max-width: ${maxWidth}px; background-color: ${backgroundColor}; border-radius: 8px; overflow: hidden; font-family: ${fontFamily}, sans-serif; font-size: ${fontSize}px; color: ${textColor};"
        >
          <tr>
            <td style="padding: 0; line-height: 0; font-size: 0;">
              <img src="/email-banner.png" alt="Migration Hub" width="${maxWidth}" style="display: block; width: 100%; max-width: ${maxWidth}px; height: auto; border: 0;" />
            </td>
          </tr>
          <tr>
            <td style="padding: ${paddingY}px ${paddingX}px;">
              ${rows || '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 32px; text-align: center; color: #9ca3af; font-size: 13px;">No content yet — add rows in the builder</td></tr></table>'}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
