import React, { useEffect, useId, useMemo, useRef, useState } from 'react'

import Icon from './Icon'

export type SearchSelectOption = {
  value: number
  label: string
  meta?: string
}

type Props = {
  options: SearchSelectOption[]
  value: number | null
  onChange: (value: number | null) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  emptyText?: string
  allowClear?: boolean
  id?: string
}

export default function SearchSelect({
  options,
  value,
  onChange,
  placeholder = '请选择',
  disabled = false,
  required = false,
  emptyText = '没有可选项',
  allowClear = false,
  id,
}: Props) {
  const generatedID = useId()
  const inputID = id ?? `adm-search-select-${generatedID}`
  const listboxID = `${inputID}-listbox`
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const selected = useMemo(
    () => options.find(option => option.value === value) ?? null,
    [options, value],
  )

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) {
      return options
    }
    return options.filter(option => (
      `${option.label} ${option.meta ?? ''}`.toLowerCase().includes(keyword)
    ))
  }, [options, query])

  useEffect(() => {
    if (!open) {
      return
    }

    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('mousedown', handleDocumentMouseDown)
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown)
  }, [open])

  useEffect(() => {
    if (!open) {
      setActiveIndex(0)
    }
  }, [open])

  const openMenu = () => {
    if (disabled) {
      return
    }
    setOpen(true)
    setQuery('')
    setActiveIndex(0)
  }

  const closeMenu = () => {
    setOpen(false)
    setQuery('')
  }

  const selectOption = (option: SearchSelectOption) => {
    onChange(option.value)
    closeMenu()
    inputRef.current?.blur()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        openMenu()
      } else {
        setActiveIndex(index => Math.min(index + 1, Math.max(filtered.length - 1, 0)))
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openMenu()
      } else {
        setActiveIndex(index => Math.max(index - 1, 0))
      }
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (open && filtered[activeIndex]) {
        selectOption(filtered[activeIndex])
      } else {
        openMenu()
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
      return
    }

    if (event.key === 'Tab') {
      closeMenu()
    }
  }

  const displayValue = open ? query : (selected?.label ?? '')

  return (
    <div
      ref={wrapperRef}
      className={[
        'adm-search-select',
        disabled ? 'adm-search-select--disabled' : '',
        open ? 'adm-search-select--open' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="adm-search-select__control">
        <Icon name="search" size={15} className="adm-search-select__search-icon" />
        <input
          ref={inputRef}
          id={inputID}
          className="adm-search-select__input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxID}
          aria-autocomplete="list"
          aria-required={required}
          autoComplete="off"
          disabled={disabled}
          value={displayValue}
          placeholder={selected ? selected.label : placeholder}
          onFocus={openMenu}
          onClick={openMenu}
          onChange={event => {
            setOpen(true)
            setQuery(event.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={handleKeyDown}
        />
        {allowClear && value !== null && !disabled && (
          <button
            type="button"
            className="adm-search-select__clear"
            aria-label="清除选择"
            onClick={() => {
              onChange(null)
              closeMenu()
            }}
          >
            <Icon name="close" size={13} />
          </button>
        )}
        <Icon name="chevron-down" size={15} className="adm-search-select__chevron" />
      </div>

      {open && (
        <div className="adm-search-select__menu" id={listboxID} role="listbox">
          {filtered.length === 0 && (
            <div className="adm-search-select__empty">{emptyText}</div>
          )}
          {filtered.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={[
                'adm-search-select__option',
                option.value === value ? 'adm-search-select__option--selected' : '',
                index === activeIndex ? 'adm-search-select__option--active' : '',
              ].filter(Boolean).join(' ')}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={event => {
                event.preventDefault()
                selectOption(option)
              }}
            >
              <span>{option.label}</span>
              {option.meta && <span className="adm-search-select__meta">{option.meta}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
