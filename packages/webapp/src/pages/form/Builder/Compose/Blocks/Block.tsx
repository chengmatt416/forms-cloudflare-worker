import { FieldLayoutAlignEnum } from '@heyform-inc/shared-types-enums'
import { IconCode, IconTable } from '@tabler/icons-react'
import type { FC } from 'react'
import { RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn, isImageURL } from '@/utils'
import { htmlUtils } from '@heyform-inc/answer-utils'
import { helper } from '@heyform-inc/utils'

import { FormFieldType } from '@/types'

import { RichText } from '../../RichText'
import { useStoreContext } from '../../store'
import { Layout } from '../Layout'

const ALLOWED_BLOCK_TAGS = [
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'hr',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'colgroup',
  'col',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'section',
  'article'
]
const ALLOWED_TAGS = [
  'text',
  'span',
  'bold',
  'strong',
  'code',
  'a',
  'b',
  'i',
  'u',
  's',
  'sub',
  'sup',
  'mark',
  'small',
  'del',
  'ins',
  'em',
  'img',
  'mention',
  'variable',
  'hiddenfield',
  ...ALLOWED_BLOCK_TAGS
]
const ALLOWED_ATTRIBUTES = [
  'href',
  'class',
  'data-mention',
  'data-variable',
  'data-hiddenfield',
  'contenteditable',
  'style',
  'border',
  'cellpadding',
  'cellspacing',
  'colspan',
  'rowspan',
  'align',
  'valign',
  'width',
  'height',
  'scope',
  'src',
  'alt',
  'title',
  'target',
  'rel',
  'id'
]
const UNSAFE_URL_PROTOCOLS = new Set(['javascript', 'vbscript', 'data'])
const URL_PROTOCOL_CONTROL_CHARS_REGEX = /[\u0000-\u001f\u007f\s]+/g

function isUnsafeUrlProtocol(value: unknown): boolean {
  const matched = String(value || '')
    .trimStart()
    .match(/^([^:]+):/)

  if (!matched) {
    return false
  }

  const protocol = matched[1].replace(URL_PROTOCOL_CONTROL_CHARS_REGEX, '').toLowerCase()
  return UNSAFE_URL_PROTOCOLS.has(protocol)
}

function escapeText(value: unknown): string {
  return String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttribute(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function sanitizeAttributes(attributes: Record<string, any> = {}): Record<string, string> {
  const result: Record<string, string> = {}

  for (const key of Object.keys(attributes)) {
    if (!ALLOWED_ATTRIBUTES.includes(key)) {
      continue
    }

    const value = String(attributes[key] || '')

    if (key === 'href' && isUnsafeUrlProtocol(value)) {
      continue
    }

    result[key] = escapeAttribute(value)
  }

  return result
}

function sanitizeRichTextNode(node: unknown): any[] | string | undefined {
  if (typeof node === 'string') {
    return escapeText(node)
  }

  if (!Array.isArray(node)) {
    return
  }

  const [tag, body, attributes] = node

  if (!ALLOWED_TAGS.includes(tag)) {
    return
  }

  const sanitizedBody = Array.isArray(body) ? body.map(sanitizeRichTextNode).filter(Boolean) : []
  const sanitizedAttributes = sanitizeAttributes(attributes)
  const sanitizedNode: any[] = [tag]

  if (sanitizedBody.length > 0 || tag === 'td' || tag === 'th' || tag === 'tr') {
    sanitizedNode.push(sanitizedBody)
  }

  if (Object.keys(sanitizedAttributes).length > 0) {
    if (sanitizedBody.length < 1) {
      sanitizedNode.push([])
    }

    sanitizedNode.push(sanitizedAttributes)
  }

  return sanitizedNode
}

function sanitizeRichTextNodes(nodes: unknown[]): any[] {
  return nodes.map(sanitizeRichTextNode).filter(Boolean)
}

const SERIALIZE_OPTIONS = {
  allowedTags: ALLOWED_TAGS,
  allowedBlockTags: ALLOWED_BLOCK_TAGS,
  allowedAttributes: ALLOWED_ATTRIBUTES
}

function sanitizeRichTextHTML(value: unknown): string {
  if (Array.isArray(value)) {
    return htmlUtils.serialize(sanitizeRichTextNodes(value), SERIALIZE_OPTIONS)
  }

  if (typeof value === 'string') {
    return htmlUtils.serialize(
      sanitizeRichTextNodes(htmlUtils.parse(value, SERIALIZE_OPTIONS)),
      SERIALIZE_OPTIONS
    )
  }

  return ''
}

export interface BlockProps extends ComponentProps {
  field: FormFieldType
  locale: string
  parentField?: FormFieldType
}

export const Block: FC<BlockProps> = ({
  className,
  field,
  locale: _locale,
  parentField,
  children,
  ...restProps
}) => {
  const { dispatch } = useStoreContext()
  const { t } = useTranslation()

  const titleRef = useRef<HTMLDivElement>(undefined)
  const descriptionRef = useRef<HTMLDivElement>(undefined)

  const isCoverShow = helper.isValid(field.layout?.mediaUrl)
  const isImageCover = isImageURL(field.layout?.mediaUrl)

  const [isHtmlMode, setIsHtmlMode] = useState(false)

  function handleTitleChange(title: string) {
    dispatch({
      type: 'updateField',
      payload: {
        id: field.id,
        updates: {
          title
        }
      }
    })
  }

  function handleDescriptionChange(description: string) {
    dispatch({
      type: 'updateField',
      payload: {
        id: field.id,
        updates: {
          description
        }
      }
    })
  }

  function handleInsertTable() {
    const tableTemplate = `<table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 8px;">
  <thead>
    <tr><th style="padding: 8px; border: 1px solid #ccc; font-weight: 600;">Header 1</th><th style="padding: 8px; border: 1px solid #ccc; font-weight: 600;">Header 2</th><th style="padding: 8px; border: 1px solid #ccc; font-weight: 600;">Header 3</th></tr>
  </thead>
  <tbody>
    <tr><td style="padding: 8px; border: 1px solid #ccc;">Row 1 Col 1</td><td style="padding: 8px; border: 1px solid #ccc;">Row 1 Col 2</td><td style="padding: 8px; border: 1px solid #ccc;">Row 1 Col 3</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ccc;">Row 2 Col 1</td><td style="padding: 8px; border: 1px solid #ccc;">Row 2 Col 2</td><td style="padding: 8px; border: 1px solid #ccc;">Row 2 Col 3</td></tr>
  </tbody>
</table>`
    const currentDesc = String(field.description || '')
    const newDesc = currentDesc ? `${currentDesc}<br />${tableTemplate}` : tableTemplate
    handleDescriptionChange(newDesc)
    if (descriptionRef.current) {
      descriptionRef.current.innerHTML = sanitizeRichTextHTML(newDesc)
    }
  }

  function handleTableAction(action: 'addRow' | 'delRow' | 'addCol' | 'delCol') {
    const currentDesc = String(field.description || '')
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(currentDesc, 'text/html')
      const table = doc.querySelector('table')
      if (!table) return

      const thead = table.querySelector('thead')
      let tbody = table.querySelector('tbody')
      if (!tbody) {
        tbody = table as unknown as HTMLTableSectionElement
      }

      if (action === 'addRow') {
        const bodyRows = tbody.querySelectorAll('tr')
        let colCount = 3
        if (thead) {
          const ths = thead.querySelectorAll('th, td')
          if (ths.length > 0) colCount = ths.length
        } else if (bodyRows.length > 0) {
          colCount = bodyRows[0].querySelectorAll('td, th').length || 3
        }
        const newRowIndex = bodyRows.length + 1
        const tr = doc.createElement('tr')
        for (let c = 1; c <= colCount; c++) {
          const td = doc.createElement('td')
          td.setAttribute('style', 'padding: 8px; border: 1px solid #ccc;')
          td.textContent = `Row ${newRowIndex} Col ${c}`
          tr.appendChild(td)
        }
        tbody.appendChild(tr)
      } else if (action === 'delRow') {
        const bodyRows = tbody.querySelectorAll('tr')
        if (bodyRows.length > 1) {
          bodyRows[bodyRows.length - 1].remove()
        }
      } else if (action === 'addCol') {
        if (thead) {
          const headerRows = thead.querySelectorAll('tr')
          headerRows.forEach(hr => {
            const cells = hr.querySelectorAll('th, td')
            const th = doc.createElement('th')
            th.setAttribute('style', 'padding: 8px; border: 1px solid #ccc; font-weight: 600;')
            th.textContent = `Header ${cells.length + 1}`
            hr.appendChild(th)
          })
        }
        const bodyRows = tbody.querySelectorAll('tr')
        bodyRows.forEach((tr, rIdx) => {
          const cells = tr.querySelectorAll('td, th')
          const td = doc.createElement('td')
          td.setAttribute('style', 'padding: 8px; border: 1px solid #ccc;')
          td.textContent = `Row ${rIdx + 1} Col ${cells.length + 1}`
          tr.appendChild(td)
        })
      } else if (action === 'delCol') {
        if (thead) {
          thead.querySelectorAll('tr').forEach(hr => {
            const cells = hr.querySelectorAll('th, td')
            if (cells.length > 1) {
              cells[cells.length - 1].remove()
            }
          })
        }
        const bodyRows = tbody.querySelectorAll('tr')
        bodyRows.forEach(tr => {
          const cells = tr.querySelectorAll('td, th')
          if (cells.length > 1) {
            cells[cells.length - 1].remove()
          }
        })
      }

      const updatedDesc = doc.body.innerHTML
      handleDescriptionChange(updatedDesc)
      if (descriptionRef.current && !isHtmlMode) {
        descriptionRef.current.innerHTML = sanitizeRichTextHTML(updatedDesc)
      }
    } catch {
      // fallback
    }
  }

  const handleTitleChangeCallback = useCallback(handleTitleChange, [field.id])
  const handleDescriptionChangeCallback = useCallback(handleDescriptionChange, [field.id])

  useEffect(() => {
    if (titleRef.current) {
      titleRef.current!.innerHTML = sanitizeRichTextHTML(field.title)
    }

    if (descriptionRef.current && !isHtmlMode) {
      descriptionRef.current!.innerHTML = sanitizeRichTextHTML(field.description)
    }
  }, [field.id, isHtmlMode])

  return (
    <>
      <div className="heyform-theme-background" />

      {field.layout?.align !== FieldLayoutAlignEnum.INLINE && (
        <Layout className={`heyform-layout-${field.layout?.align}`} layout={field.layout} />
      )}

      {parentField && (
        <div className="heyform-block-group rounded-t-lg">
          <div className="heyform-block-group-container">
            <div className="heyform-block-title">
              {htmlUtils.plain(parentField.title as string)}
            </div>
          </div>
        </div>
      )}

      <div
        className={cn('heyform-block-container', {
          [`heyform-block-${field.layout?.align}`]: field.layout?.align
        })}
      >
        <div className="flex min-h-full flex-col items-center justify-center">
          <div className={cn('heyform-block', className)} {...restProps}>
            <div className="mb-10">
              <RichText
                className="heyform-block-title"
                innerRef={titleRef as RefObject<HTMLDivElement>}
                placeholder={t('form.builder.compose.question')}
                onChange={handleTitleChangeCallback}
              />
              <div className="group/desc relative">
                {isHtmlMode ? (
                  <div className="my-2">
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-mono font-medium">HTML Source Code Editor</span>
                      <button
                        type="button"
                        className="text-primary-500 cursor-pointer hover:underline"
                        onClick={() => setIsHtmlMode(false)}
                      >
                        Switch to Visual View
                      </button>
                    </div>
                    <textarea
                      className="focus:ring-primary-500 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-sm text-slate-800 focus:ring-1 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      rows={5}
                      value={(field.description as string) || ''}
                      onChange={e => handleDescriptionChange(e.target.value)}
                    />
                  </div>
                ) : (
                  <RichText
                    className="heyform-block-description"
                    innerRef={descriptionRef as RefObject<HTMLDivElement>}
                    placeholder={t('form.builder.compose.description')}
                    onChange={handleDescriptionChangeCallback}
                  />
                )}
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 opacity-80 transition-opacity hover:opacity-100">
                  <button
                    type="button"
                    title="Insert a table into description"
                    className="inline-flex cursor-pointer items-center space-x-1 rounded border border-slate-200 px-2 py-0.5 text-slate-700 shadow-xs hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    onClick={handleInsertTable}
                  >
                    <IconTable className="h-3.5 w-3.5" />
                    <span>+ Table</span>
                  </button>
                  {String(field.description || '').includes('<table') && (
                    <div className="inline-flex items-center space-x-1 rounded border border-slate-200 bg-slate-50/80 px-1.5 py-0.5 shadow-xs dark:border-slate-700 dark:bg-slate-800/80">
                      <span className="mr-0.5 text-[11px] font-medium text-slate-500">Table:</span>
                      <button
                        type="button"
                        title="Add a new row to table"
                        className="py-0.2 inline-flex cursor-pointer items-center rounded px-1.5 font-medium text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700"
                        onClick={() => handleTableAction('addRow')}
                      >
                        + Row
                      </button>
                      <button
                        type="button"
                        title="Delete last row from table"
                        className="py-0.2 inline-flex cursor-pointer items-center rounded px-1.5 font-medium text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700"
                        onClick={() => handleTableAction('delRow')}
                      >
                        - Del Row
                      </button>
                      <span className="text-slate-300 dark:text-slate-600">|</span>
                      <button
                        type="button"
                        title="Add a new column to table"
                        className="py-0.2 inline-flex cursor-pointer items-center rounded px-1.5 font-medium text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700"
                        onClick={() => handleTableAction('addCol')}
                      >
                        + Col
                      </button>
                      <button
                        type="button"
                        title="Delete last column from table"
                        className="py-0.2 inline-flex cursor-pointer items-center rounded px-1.5 font-medium text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700"
                        onClick={() => handleTableAction('delCol')}
                      >
                        - Del Col
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    title="Toggle HTML source editor"
                    className="inline-flex cursor-pointer items-center space-x-1 rounded border border-slate-200 px-2 py-0.5 text-slate-700 shadow-xs hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    onClick={() => setIsHtmlMode(!isHtmlMode)}
                  >
                    <IconCode className="h-3.5 w-3.5" />
                    <span>{isHtmlMode ? 'Visual View' : 'HTML Code'}</span>
                  </button>
                </div>
              </div>
            </div>

            {isCoverShow && field.layout?.align === FieldLayoutAlignEnum.INLINE && (
              <div className="heyform-block-image">
                {isImageCover ? (
                  <img src={field.layout?.mediaUrl} />
                ) : (
                  <div
                    style={{
                      backgroundImage: field.layout?.mediaUrl
                    }}
                  ></div>
                )}
              </div>
            )}

            {children}
          </div>
        </div>
      </div>
    </>
  )
}
