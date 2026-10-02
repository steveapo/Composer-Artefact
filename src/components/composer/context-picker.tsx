"use client"

import { useRef, useState, type KeyboardEvent } from "react"
import { PlusSignIcon, Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import type { ContextOption } from "./data"
import { Icon, type IconData } from "./icons"
import {
  EMPTY_STATE,
  MENU_ROW,
  MENU_SURFACE,
  MENU_TITLE,
  ROW_DESCRIPTION,
  SEARCH_FIELD,
  SEARCH_INPUT,
  rowIcon,
  rowLabel,
} from "./styles"

/**
 * Searchable picker card used by the context bar (branches, projects).
 * Type to filter; ↑/↓ move between the field and the rows; Enter picks the
 * first match, or creates a new entry when `onCreate` is provided.
 */
export function ContextPicker({
  title,
  icon,
  options,
  value,
  onValueChange,
  searchPlaceholder,
  onCreate,
  createLabel = (query) => `Create “${query}”`,
  className,
}: {
  title: string
  icon: IconData
  options: ContextOption[]
  value: string
  onValueChange: (id: string) => void
  searchPlaceholder: string
  onCreate?: (label: string) => void
  createLabel?: (query: string) => string
  className?: string
}) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const trimmed = query.trim()
  const needle = trimmed.toLowerCase()
  const matches = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options
  const exactMatch = options.some((option) => option.label.toLowerCase() === needle)
  const canCreate = Boolean(onCreate && trimmed && !exactMatch)

  function rows() {
    return Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio], [role=menuitem]") ?? [])
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      rows()[0]?.focus()
    } else if (event.key === "Enter") {
      event.preventDefault()
      if (matches[0]) onValueChange(matches[0].id)
      else if (canCreate) onCreate?.(trimmed)
    }
  }

  // Arrow-key roving focus between the rows; ↑ from the first row returns to the field.
  function handleListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
    event.preventDefault()
    const items = rows()
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === "ArrowUp" && current <= 0) {
      inputRef.current?.focus()
      return
    }
    const step = event.key === "ArrowDown" ? 1 : -1
    items[Math.min(items.length - 1, current + step)]?.focus()
  }

  return (
    <div className={cn("flex w-[320px] flex-col", MENU_SURFACE, className)}>
      <div data-morph-item className={cn("shrink-0 pt-2 pr-2 pb-1.5 pl-3.5", MENU_TITLE)}>
        {title}
      </div>

      <label data-morph-item className={cn("mx-1 mb-1 shrink-0", SEARCH_FIELD)}>
        <Icon icon={Search01Icon} aria-hidden className="size-[18px] shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className={SEARCH_INPUT}
        />
      </label>

      <div
        ref={listRef}
        role="menu"
        aria-label={title}
        onKeyDown={handleListKeyDown}
        className="flex max-h-[264px] min-h-0 flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {matches.map((option) => {
          const selected = option.id === value
          return (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              data-morph-item
              onClick={() => onValueChange(option.id)}
              className={MENU_ROW}
            >
              <Icon icon={icon} aria-hidden className={rowIcon(selected)} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn("truncate", rowLabel(selected))}>{option.label}</span>
                {option.description && (
                  <span className={cn("truncate", ROW_DESCRIPTION)}>{option.description}</span>
                )}
              </span>
              {selected && (
                <Icon
                  icon={Tick02Icon}
                  aria-hidden
                  className="size-4 shrink-0 text-[#2F7CF6]"
                  strokeWidth={2.25}
                />
              )}
            </button>
          )
        })}

        {canCreate && (
          <button
            type="button"
            role="menuitem"
            data-morph-item
            onClick={() => onCreate?.(trimmed)}
            className={MENU_ROW}
          >
            <Icon icon={PlusSignIcon} aria-hidden className={rowIcon(false)} />
            <span className={cn("truncate", rowLabel(true))}>{createLabel(trimmed)}</span>
          </button>
        )}

        {matches.length === 0 && !canCreate && (
          <p className={EMPTY_STATE}>No matches for “{trimmed}”</p>
        )}
      </div>
    </div>
  )
}
