"use client"

import { useRef, useState, type KeyboardEvent } from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { ArrowRight01Icon, Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { PROVIDERS, findModel, type Effort, type Model, type ProviderId } from "./data"
import { EffortLevelIcon, EffortPanel, effortPanelMorph } from "./effort-level"
import { Icon, ProviderLogo } from "./icons"
import {
  EMPTY_STATE,
  FOCUS_RING,
  MENU_SURFACE,
  MENU_TITLE,
  SEARCH_FIELD,
  SEARCH_INPUT,
  rowLabel,
} from "./styles"
import {
  DURATION,
  EASE,
  STAGE,
  dur,
  gsap,
  useGSAP,
  useMorphOnChange,
  usePresenceMorph,
  useSwapMorph,
} from "./motion"

/**
 * Provider rail + model list. A model with reasoning effort shows an "effort level"
 * chip in its row, which opens a vertical slider panel to the right of the picker.
 */
export function ModelPicker({
  value,
  onValueChange,
  effort,
  onEffortChange,
  className,
}: {
  value: string
  onValueChange: (modelId: string) => void
  effort: Effort
  onEffortChange: (effort: Effort) => void
  className?: string
}) {
  const [providerId, setProviderId] = useState<ProviderId>(
    () => findModel(value)?.provider.id ?? PROVIDERS[0].id
  )
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState("")
  const [effortOpen, setEffortOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const railRef = useRef<HTMLElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const provider = PROVIDERS.find((p) => p.id === providerId) ?? PROVIDERS[0]
  const trimmed = query.trim().toLowerCase()
  /** What the list is showing: a provider's models, or cross-provider search results. */
  const listKey: ProviderId | "search" = trimmed ? "search" : providerId

  // Active-provider pill: placed instantly on first paint, then slides between providers.
  const placedFor = useRef<string | null>(null)
  useGSAP(
    () => {
      const pill = pillRef.current
      const button = railRef.current?.querySelector<HTMLElement>(`[data-provider="${providerId}"]`)
      if (!pill || !button) return
      const pose =
        listKey === "search"
          ? { y: button.offsetTop, opacity: 0, scale: 0.7 }
          : { y: button.offsetTop, opacity: 1, scale: 1 }
      if (placedFor.current === null || placedFor.current === listKey) gsap.set(pill, pose)
      else gsap.to(pill, { ...pose, duration: dur(DURATION.morph), ease: EASE.morph })
      placedFor.current = listKey
    },
    { dependencies: [listKey], scope: railRef }
  )

  // Switching provider slides the new list in from the direction of travel on the rail.
  // Typing further search characters doesn't re-animate, so filtering stays instant.
  useMorphOnChange(
    listKey,
    (previous) => {
      const from = PROVIDERS.findIndex((p) => p.id === previous)
      const to = PROVIDERS.findIndex((p) => p.id === listKey)
      const direction = from !== -1 && to !== -1 && to < from ? -1 : 1
      gsap.fromTo(
        listRef.current?.querySelectorAll("[data-morph-item]") ?? [],
        { opacity: 0, y: 10 * direction },
        {
          opacity: 1,
          y: 0,
          duration: dur(DURATION.swap),
          ease: EASE.out,
          // The rail pill leads; the list follows it.
          delay: dur(STAGE.follow * 0.5),
          stagger: dur(STAGE.step),
          clearProps: "opacity,transform",
        }
      )
    },
    listRef
  )

  // "Models / Quick search" header morphs into the search field and back.
  useMorphOnChange(
    searching,
    () => {
      gsap.fromTo(
        headerRef.current?.children ?? [],
        { opacity: 0, x: searching ? 12 : -12 },
        {
          opacity: 1,
          x: 0,
          duration: dur(DURATION.swap),
          ease: EASE.out,
          stagger: dur(STAGE.step),
          clearProps: "opacity,transform",
        }
      )
    },
    headerRef
  )

  // While searching, match across every provider; otherwise show the active provider.
  const rows: { providerId: ProviderId; model: Model }[] = trimmed
    ? PROVIDERS.flatMap((p) =>
        p.models
          .filter((m) => m.name.toLowerCase().includes(trimmed))
          .map((model) => ({ providerId: p.id, model }))
      )
    : provider.models.map((model) => ({ providerId: provider.id, model }))

  function openSearch() {
    setSearching(true)
    requestAnimationFrame(() => searchRef.current?.focus())
  }

  function closeSearch() {
    setSearching(false)
    setQuery("")
  }

  // The effort panel only makes sense while the selected model (with effort) is on screen.
  const effortAvailable = rows.some((row) => row.model.id === value && row.model.supportsEffort)
  const effortPanelOpen = effortOpen && effortAvailable
  const effortPanel = usePresenceMorph<HTMLDivElement>(effortPanelOpen, effortPanelMorph)

  return (
    // The whole card anchors the effort panel, so it opens beside the picker (not the chip).
    <PopoverPrimitive.Root open={effortPanelOpen} onOpenChange={setEffortOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div className={cn("flex w-[360px] gap-1.5", MENU_SURFACE, className)}>
          {/* Provider rail */}
          <nav
            ref={railRef}
            data-morph-item
            aria-label="Providers"
            className="relative flex w-12 shrink-0 flex-col items-center gap-1.5 overflow-y-auto rounded-[20px] bg-[#F5F5F5] py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {/* Sliding highlight behind the active provider */}
            <span
              ref={pillRef}
              aria-hidden
              className="pointer-events-none absolute top-0 left-1/2 -ml-5 size-10 rounded-full bg-[#E8E8E8] opacity-0"
            />
            {PROVIDERS.map((p) => {
              const active = p.id === providerId && !trimmed
              return (
                <button
                  key={p.id}
                  type="button"
                  data-provider={p.id}
                  title={p.name}
                  aria-label={p.name}
                  aria-pressed={active}
                  onClick={() => {
                    setProviderId(p.id)
                    closeSearch()
                  }}
                  className={cn(
                    "relative grid size-10 shrink-0 place-items-center rounded-full transition-[color,background-color,scale] active:scale-95",
                    FOCUS_RING,
                    active
                      ? "text-[#7A7A7A]"
                      : "text-[#ABABAB] hover:bg-[#EDEDED] hover:text-[#8A8A8A]"
                  )}
                >
                  <ProviderLogo provider={p.id} className="size-[22px]" />
                </button>
              )
            })}
          </nav>

          {/* Model list */}
          {/* The gap separates the header (title or search field) from the first row. */}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div
              ref={headerRef}
              data-morph-item
              className={cn(
                "flex h-10 items-center justify-between gap-2",
                MENU_TITLE,
                !searching && "pr-1 pl-2"
              )}
            >
              {searching ? (
                <div className={cn("flex-1", SEARCH_FIELD)}>
                  <Icon icon={Search01Icon} aria-hidden className="size-[18px] shrink-0" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => event.key === "Escape" && closeSearch()}
                    placeholder="Find a model"
                    aria-label="Find a model"
                    className={SEARCH_INPUT}
                  />
                  <button
                    type="button"
                    aria-label="Close search"
                    onClick={closeSearch}
                    className={cn(
                      "-mr-1 grid size-6 shrink-0 place-items-center rounded-full transition-colors hover:bg-black/[0.04] hover:text-[#6E6E6E]",
                      FOCUS_RING
                    )}
                  >
                    <Icon icon={Cancel01Icon} aria-hidden className="size-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <>
                  <span>Models</span>
                  <button
                    type="button"
                    onClick={openSearch}
                    className={cn(
                      "flex items-center gap-2 rounded-full transition-colors hover:text-[#6E6E6E]",
                      FOCUS_RING
                    )}
                  >
                    Quick search
                    <Icon icon={Search01Icon} aria-hidden className="size-[18px]" />
                  </button>
                </>
              )}
            </div>

            <div ref={listRef} role="radiogroup" aria-label="Model" className="flex flex-col">
              {rows.map(({ providerId: rowProvider, model }) => (
                <ModelRow
                  key={model.id}
                  providerId={rowProvider}
                  model={model}
                  selected={model.id === value}
                  effort={effort}
                  onSelect={() => onValueChange(model.id)}
                />
              ))}
              {rows.length === 0 && (
                <p className={EMPTY_STATE}>No matches for “{query.trim()}”</p>
              )}
            </div>
          </div>
        </div>
      </PopoverPrimitive.Anchor>

      {effortPanel.mounted && (
        <PopoverPrimitive.Portal forceMount>
          <PopoverPrimitive.Content
            ref={effortPanel.ref}
            forceMount
            side="right"
            align="center"
            sideOffset={8}
            collisionPadding={16}
            className="z-50 origin-(--radix-popover-content-transform-origin) outline-none"
          >
            <EffortPanel value={effort} onValueChange={onEffortChange} />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      )}
    </PopoverPrimitive.Root>
  )
}

function ModelRow({
  providerId,
  model,
  selected,
  effort,
  onSelect,
}: {
  providerId: ProviderId
  model: Model
  selected: boolean
  effort: Effort
  onSelect: () => void
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onSelect()
    }
  }

  // Selecting is progressive too: the row highlights and the radio fills first,
  // then the effort chip pops in beside it (and tucks away when deselected).
  // Transform/opacity only, so neighbouring rows never reflow mid-animation.
  const effortPresence = usePresenceMorph<HTMLSpanElement>(selected && !!model.supportsEffort, {
    enter: (el) =>
      gsap.fromTo(
        el,
        { opacity: 0, scale: 0.85, x: 8 },
        {
          opacity: 1,
          scale: 1,
          x: 0,
          duration: dur(DURATION.swap),
          ease: EASE.pop,
          delay: dur(STAGE.follow),
          clearProps: "opacity,transform",
        }
      ),
    exit: (el) =>
      gsap.to(el, { opacity: 0, scale: 0.85, x: 6, duration: dur(DURATION.exit), ease: EASE.in }),
  })

  return (
    <div
      role="radio"
      aria-checked={selected}
      data-morph-item
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex h-12 cursor-pointer items-center gap-3 rounded-[20px] pr-3 pl-2.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-black/10",
        selected ? "bg-[#F5F5F5]" : "hover:bg-[#FAFAFA]"
      )}
    >
      <ProviderLogo provider={providerId} className="size-[22px] text-[#9E9E9E]" />
      <span className={cn("min-w-0 flex-1 truncate", rowLabel(selected))}>{model.name}</span>
      {effortPresence.mounted && (
        <span ref={effortPresence.ref} className="flex shrink-0">
          <EffortTrigger value={effort} />
        </span>
      )}
      <RadioDot checked={selected} />
    </div>
  )
}

/** "Effort level" chip in the selected row: opens the slider panel beside the picker. */
function EffortTrigger({ value }: { value: Effort }) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  useSwapMorph(triggerRef, value)

  return (
    <PopoverPrimitive.Trigger
      ref={triggerRef}
      aria-label={`Effort level: ${value}`}
      // Don't let the chip also (re)select its row.
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      className={cn(
        "group/effort flex h-7 shrink-0 items-center gap-1.5 overflow-hidden rounded-full bg-[#EBEBEB] pr-2 pl-2.5 text-[14px] whitespace-nowrap text-[#6E6E6E] transition-colors hover:bg-[#E3E3E3] data-[state=open]:bg-[#E3E3E3] data-[state=open]:text-[#2A2A2A]",
        FOCUS_RING
      )}
    >
      <EffortLevelIcon value={value} className="size-3.5 shrink-0" />
      <span data-swap>{value}</span>
      <Icon
        icon={ArrowRight01Icon}
        aria-hidden
        className="size-3.5 shrink-0 transition-transform group-data-[state=open]/effort:translate-x-0.5"
        strokeWidth={2}
      />
    </PopoverPrimitive.Trigger>
  )
}

function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors",
        checked ? "border-[#2F7CF6] bg-[#2F7CF6]" : "border-[#D6D6D6] bg-white"
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full bg-white transition-transform duration-200",
          checked ? "scale-100" : "scale-0"
        )}
      />
    </span>
  )
}
