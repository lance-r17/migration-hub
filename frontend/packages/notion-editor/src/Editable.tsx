import { useRef, useState, useLayoutEffect, useEffect, type KeyboardEvent, type ReactNode } from 'react'

interface EditableProps {
  value?: string
  onChange?: (html: string) => void
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void
  onFocus?: () => void
  onBlur?: () => void
  onInput?: (e: React.FormEvent<HTMLDivElement>) => void
  className?: string
  placeholder?: string
  style?: React.CSSProperties
  autoFocus?: boolean
  plain?: boolean
  blockId?: string
  onMount?: (el: HTMLDivElement) => void
  readOnly?: boolean
  children?: ReactNode
}

export function Editable({
  value,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
  onInput,
  className = '',
  placeholder = '',
  style,
  autoFocus,
  plain = false,
  blockId,
  onMount,
  readOnly,
  children,
}: EditableProps) {
  const ref = useRef<HTMLDivElement>(null)
  const lastValueRef = useRef(value)
  const [empty, setEmpty] = useState(!value)

  useLayoutEffect(() => {
    if (!ref.current) return
    if (ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || ''
    }
    setEmpty(!ref.current.textContent)
    lastValueRef.current = value
  }, [value])

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus()
      const range = document.createRange()
      range.selectNodeContents(ref.current)
      range.collapse(false)
      const sel = window.getSelection()
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
  }, [autoFocus])

  useEffect(() => {
    if (onMount && ref.current) onMount(ref.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    let html = plain ? target.textContent || '' : target.innerHTML
    // Normalize browser-inserted <br> in empty contenteditable
    if (!plain && /^\s*<br\s*\/?>\s*$/i.test(html)) {
      html = ''
      target.innerHTML = ''
    }
    lastValueRef.current = html
    setEmpty(!target.textContent)
    onChange?.(html)
    onInput?.(e)
  }

  return (
    <div
      ref={ref}
      className={`notion-editable ${className}`}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      spellCheck
      data-empty={empty ? 'true' : 'false'}
      data-placeholder={placeholder}
      data-block-id={blockId}
      onInput={handleInput}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      style={style}
    >
      {children}
    </div>
  )
}
