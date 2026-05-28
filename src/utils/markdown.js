import DOMPurify from 'dompurify'
import { marked } from 'marked'

export const MARKDOWN_TOOLBAR_BUTTONS = Object.freeze([
  { id: 'bold', label: 'B', title: 'Жирный текст' },
  { id: 'italic', label: 'I', title: 'Курсив' },
  { id: 'strike', label: 'S', title: 'Зачеркнутый текст' },
  { id: 'heading', label: 'H', title: 'Заголовок' },
  { id: 'bulletList', label: '•', title: 'Маркированный список' },
  { id: 'numberList', label: '1.', title: 'Нумерованный список' },
  { id: 'link', label: 'Link', title: 'Ссылка' },
  { id: 'image', label: 'Img', title: 'Изображение' },
  { id: 'spoiler', label: '@@@', title: 'Спойлер' },
  { id: 'code', label: '</>', title: 'Блок кода' },
  { id: 'quote', label: '>', title: 'Цитата' },
])

export const MARKDOWN_COLOR_MAP = Object.freeze({
  orange: '#fb923c',
  green: '#4ade80',
  red: '#f87171',
  blue: '#60a5fa',
  yellow: '#facc15',
  white: '#ffffff',
  delta: '#8a9a4e',
})

function sanitizeCssColor(value) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (/^#([0-9a-fA-F]{3,8})$/.test(normalized)) return normalized
  if (/^(rgb|rgba|hsl|hsla)\([\d\s.,%]+\)$/.test(normalized)) return normalized
  if (/^[a-zA-Z]+$/.test(normalized)) return normalized.toLowerCase()
  return ''
}

function sanitizeInlineStyles(root) {
  const styleSanitizers = {
    color: sanitizeCssColor,
    'background-color': sanitizeCssColor,
    'text-align': (value) => {
      const normalized = value.trim().toLowerCase()
      return ['left', 'center', 'right', 'justify'].includes(normalized) ? normalized : ''
    },
  }

  root.querySelectorAll('[style]').forEach((element) => {
    const declarations = element
      .getAttribute('style')
      ?.split(';')
      .map(part => part.trim())
      .filter(Boolean) || []

    const safeDeclarations = declarations.reduce((result, declaration) => {
      const [property, ...valueParts] = declaration.split(':')
      if (!property || !valueParts.length) return result

      const normalizedProperty = property.trim().toLowerCase()
      const sanitizer = styleSanitizers[normalizedProperty]
      if (!sanitizer) return result

      const safeValue = sanitizer(valueParts.join(':').trim())
      if (!safeValue) return result

      result.push(`${normalizedProperty}: ${safeValue}`)
      return result
    }, [])

    if (safeDeclarations.length) {
      element.setAttribute('style', safeDeclarations.join('; '))
    } else {
      element.removeAttribute('style')
    }
  })
}

function transformColorShortcodes(content) {
  return content.replace(/\{(\w+)\}([\s\S]*?)\{\/\1\}/g, (_, color, text) => {
    const hex = MARKDOWN_COLOR_MAP[color.toLowerCase()]
    if (!hex) return text
    return `<span style="color:${hex}">${text}</span>`
  })
}

function transformCustomSpoilers(content) {
  return content.replace(
    /^@@@\s+(.+?)\s*\r?\n([\s\S]*?)^\s*@@@\s*$/gm,
    (_, summary = '', body = '') => `<details><summary>${summary.trim()}</summary>\n${body.trim()}\n</details>`,
  )
}

function renderDetailsBlocks(content) {
  return content.replace(/<details(\s+open)?>([\s\S]*?)<\/details>/gi, (_, openAttr = '', innerContent = '') => {
    const match = innerContent.match(/<summary>([\s\S]*?)<\/summary>([\s\S]*)/i)
    if (!match) return _

    const [, summaryContent = '', bodyContent = ''] = match
    const summaryHtml = marked.parseInline(summaryContent.trim())
    const bodyHtml = marked.parse(bodyContent.trim(), {
      breaks: true,
      gfm: true,
    })

    return `<details class="task-spoiler"${openAttr || ''}><summary>${summaryHtml}</summary><div class="task-spoiler__content">${bodyHtml}</div></details>`
  })
}

export function renderRichMarkdown(content) {
  if (!content?.trim()) return ''

  const preparedContent = renderDetailsBlocks(
    transformCustomSpoilers(
      transformColorShortcodes(content),
    ),
  )

  const rawHtml = marked.parse(preparedContent, {
    breaks: true,
    gfm: true,
  })

  const sanitizedHtml = DOMPurify.sanitize(rawHtml, {
    ADD_TAGS: ['details', 'summary'],
    ADD_ATTR: ['target', 'rel', 'style', 'loading', 'decoding', 'class', 'open'],
  })

  const parser = new DOMParser()
  const documentFragment = parser.parseFromString(sanitizedHtml, 'text/html')

  documentFragment.querySelectorAll('a[href]').forEach((link) => {
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer')
  })

  documentFragment.querySelectorAll('img').forEach((image) => {
    image.setAttribute('loading', 'lazy')
    image.setAttribute('decoding', 'async')
    if (!image.getAttribute('alt')) {
      image.setAttribute('alt', 'Встроенное изображение')
    }
  })

  sanitizeInlineStyles(documentFragment.body)

  return documentFragment.body.innerHTML
}

function applyUpdate({ textarea, nextValue, selectionStart, selectionEnd, setValue, afterUpdate }) {
  setValue(nextValue)
  afterUpdate?.(() => {
    textarea.focus()
    textarea.setSelectionRange(selectionStart, selectionEnd)
  })
}

function wrapSelection({ textarea, value, setValue, afterUpdate }, before, after, placeholder) {
  const start = textarea.selectionStart ?? value.length
  const end = textarea.selectionEnd ?? value.length
  const selected = value.slice(start, end)
  const inserted = selected || placeholder
  const nextValue = `${value.slice(0, start)}${before}${inserted}${after}${value.slice(end)}`
  const selectionStart = start + before.length
  const selectionEnd = selectionStart + inserted.length

  applyUpdate({ textarea, nextValue, selectionStart, selectionEnd, setValue, afterUpdate })
}

function prefixSelectedLines({ textarea, value, setValue, afterUpdate }, prefix, fallbackText) {
  const start = textarea.selectionStart ?? value.length
  const end = textarea.selectionEnd ?? value.length
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const lineEndIndex = value.indexOf('\n', end)
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex
  const block = value.slice(lineStart, lineEnd)
  const lines = (block || fallbackText).split('\n')
  const updatedBlock = lines.map(line => `${prefix}${line || fallbackText}`).join('\n')
  const nextValue = `${value.slice(0, lineStart)}${updatedBlock}${value.slice(lineEnd)}`

  applyUpdate({
    textarea,
    nextValue,
    selectionStart: lineStart,
    selectionEnd: lineStart + updatedBlock.length,
    setValue,
    afterUpdate,
  })
}

function insertTemplate({ textarea, value, setValue, afterUpdate }, template, selectFromOffset = 0, selectToOffset = 0) {
  const start = textarea.selectionStart ?? value.length
  const end = textarea.selectionEnd ?? value.length
  const nextValue = `${value.slice(0, start)}${template}${value.slice(end)}`
  const selectionStart = start + selectFromOffset
  const selectionEnd = start + (selectToOffset || template.length)

  applyUpdate({
    textarea,
    nextValue,
    selectionStart,
    selectionEnd,
    setValue,
    afterUpdate,
  })
}

export function applyMarkdownToolbarAction({ actionId, textarea, value, setValue, afterUpdate }) {
  if (!textarea) return

  const context = { textarea, value, setValue, afterUpdate }

  switch (actionId) {
    case 'bold':
      wrapSelection(context, '**', '**', 'жирный текст')
      break
    case 'italic':
      wrapSelection(context, '*', '*', 'курсив')
      break
    case 'strike':
      wrapSelection(context, '~~', '~~', 'зачеркнутый текст')
      break
    case 'heading':
      prefixSelectedLines(context, '## ', 'Заголовок')
      break
    case 'bulletList':
      prefixSelectedLines(context, '- ', 'Пункт')
      break
    case 'numberList':
      insertTemplate(context, '1. Пункт 1\n2. Пункт 2', 0, 23)
      break
    case 'link':
      wrapSelection(context, '[', '](https://example.com)', 'текст ссылки')
      break
    case 'image':
      insertTemplate(context, '![Описание](https://placehold.co/1200x630/png)', 2, 10)
      break
    case 'spoiler':
      insertTemplate(context, '@@@ Заголовок\nСодержимое спойлера\n@@@', 4, 13)
      break
    case 'code':
      insertTemplate(context, '```text\nтекст\n```', 8, 13)
      break
    case 'quote':
      prefixSelectedLines(context, '> ', 'Цитата')
      break
  }
}
