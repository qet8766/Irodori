import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import { useLocation } from 'react-router-dom'

const TranslateOptions = () => {
  const location = useLocation()
  const params = useMemo(() => new URLSearchParams(location.search), [location.search])
  const optionsRaw = params.get('options') || '[]'
  const input = params.get('input') || ''
  const options: string[] = useMemo(() => {
    try {
      return JSON.parse(decodeURIComponent(optionsRaw))
    } catch {
      return []
    }
  }, [optionsRaw])

  const listRef = useRef<HTMLUListElement>(null)
  const selectedRef = useRef(0)

  useEffect(() => {
    listRef.current?.querySelector('button')?.focus()
  }, [])

  const handleSelect = (option: string) => {
    window.irodori.translateOptions.select(option)
  }

  const handleClose = () => {
    window.irodori.translateOptions.close()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'Escape') {
      handleClose()
      return
    }

    const buttons = listRef.current?.querySelectorAll('button')
    if (!buttons?.length) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedRef.current = Math.min(selectedRef.current + 1, buttons.length - 1)
      ;(buttons[selectedRef.current] as HTMLElement).focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedRef.current = Math.max(selectedRef.current - 1, 0)
      ;(buttons[selectedRef.current] as HTMLElement).focus()
    } else if (e.key >= '1' && e.key <= '6') {
      const idx = parseInt(e.key) - 1
      if (idx < options.length) {
        handleSelect(options[idx])
      }
    }
  }

  return (
    <div className="translate-options-shell">
      <div className="translate-options-header">
        <span className="muted">{decodeURIComponent(input)}</span>
      </div>
      <ul
        ref={listRef}
        className="translate-options-list"
        onKeyDown={handleKeyDown}
      >
        {options.map((option, idx) => (
          <li key={idx}>
            <button
              className="translate-option-item"
              onClick={() => handleSelect(option)}
            >
              <span className="option-number">{idx + 1}</span>
              <span className="option-text">{option}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default TranslateOptions
