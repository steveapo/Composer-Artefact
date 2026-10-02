"use client"

import { forwardRef, useMemo, useRef, useState, type ComponentProps, type CSSProperties } from "react"
import { Slider as SliderPrimitive } from "radix-ui"
import { SignalFull02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { ComposerPopover } from "./composer-toolbar"
import { EFFORTS, type Effort } from "./data"
import { Icon, type IconData } from "./icons"
import { DURATION, EASE, STAGE, dur, gsap, useGSAP, usePresenceMorph } from "./motion"
import { FOCUS_RING, MENU_SURFACE, MENU_TITLE, ROUND_BUTTON, ROW_DESCRIPTION, rowLabel } from "./styles"

/** Level colours, also the stops of the slider's colour-graded fill (cyan → blue → violet). */
export const EFFORT_COLORS: Record<Effort, string> = {
  Low: "#38BDF8",
  Medium: "#2F7CF6",
  High: "#8B5CF6",
}

/** One-line hints shown beside each effort level. */
const EFFORT_HINTS: Record<Effort, string> = {
  Low: "Fastest replies",
  Medium: "Balanced",
  High: "Thinks the longest",
}

/** Height of the slider track in px (the 152px column minus the 8px inset top and bottom). */
const TRACK_HEIGHT = 136

/* ------------------------------------------------------------------ */
/* Morphing effort icon                                                 */
/* ------------------------------------------------------------------ */

/** The bars' shared baseline in the 24×24 icon grid. */
const BAR_BASELINE = 19
/** Top edge of each bar (low, mid, high) in SignalFull02's 24×24 grid. */
const BAR_TOPS = [14, 10, 6]
/** Height (grid units) an inactive bar flattens to: a short solid stub on the baseline. */
const STUB_HEIGHT = 2

/** Vertical scale that flattens bar `index` into a stub. */
function collapsedScale(index: number) {
  return STUB_HEIGHT / (BAR_BASELINE - BAR_TOPS[index])
}

type IconNode = readonly [string, Readonly<Record<string, string | number>>]

/**
 * SignalFull02's three bars (low, mid, high) as solid shapes with no outline,
 * with inactive bars already flattened for the first paint.
 */
function signalBars(level: number): IconData {
  return (SignalFull02Icon as readonly IconNode[]).map(
    ([tag, attrs], index): IconNode => [
      tag,
      {
        ...attrs,
        fill: "currentColor",
        ...(index > level
          ? {
              transform: `translate(0 ${BAR_BASELINE}) scale(1 ${collapsedScale(index)}) translate(0 ${-BAR_BASELINE})`,
            }
          : {}),
      },
    ]
  )
}

/**
 * Effort level as signal bars that morph between levels. All three bars are
 * always drawn; changing level grows the newly active bars up from the baseline
 * (low to high), or flattens the ones being dropped (high to low), in place,
 * instead of swapping one icon out for another.
 */
export function EffortLevelIcon({
  value,
  className,
  style,
}: {
  value: Effort
  className?: string
  style?: CSSProperties
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const level = EFFORTS.indexOf(value)
  // Only the starting level is frozen: the bars' initial pose is baked in for the
  // first paint, then GSAP owns their transforms. The bar styling itself is derived
  // (not stored in state) so edits to it reach icons that are already mounted.
  const [initialLevel] = useState(level)
  const icon = useMemo(() => signalBars(initialLevel), [initialLevel])
  const shownLevel = useRef<number | null>(null)

  useGSAP(
    () => {
      const bars = Array.from(svgRef.current?.querySelectorAll("path") ?? [])
      const from = shownLevel.current
      shownLevel.current = level

      // First paint (and strict-mode re-runs): hand the initial pose over to GSAP, no motion.
      if (from === null || from === level) {
        bars.forEach((bar, index) => {
          bar.removeAttribute("transform")
          gsap.set(bar, { transformOrigin: "50% 100%", scaleY: index <= level ? 1 : collapsedScale(index) })
        })
        return
      }

      const rising = level > from
      bars.forEach((bar, index) => {
        const active = index <= level
        const changes = rising ? index > from && active : index > level && index <= from
        if (!changes) return
        // Bars grow one after another away from the baseline, and flatten from the top down.
        const order = rising ? index - from - 1 : from - index
        gsap.to(bar, {
          scaleY: active ? 1 : collapsedScale(index),
          duration: dur(active ? DURATION.morph : DURATION.swap),
          ease: active ? EASE.pop : EASE.in,
          delay: dur(STAGE.step * 1.5 * order),
        })
      })
    },
    { dependencies: [level], scope: svgRef }
  )

  return (
    <Icon
      ref={svgRef}
      icon={icon}
      aria-hidden
      className={className}
      // No outline: the Icon wrapper always sets a stroke, so zero its width.
      strokeWidth={0}
      style={style}
    />
  )
}

/**
 * Side panel morph (opens to the right of the model picker), in stages: the
 * panel slides out from the picker's edge, then its title, slider and labels
 * come in one after another.
 */
export const effortPanelMorph = {
  enter: (el: HTMLElement) =>
    gsap
      .timeline()
      .fromTo(
        el,
        { opacity: 0, x: -10, scale: 0.96 },
        { opacity: 1, x: 0, scale: 1, duration: dur(DURATION.morph), ease: EASE.morph }
      )
      .fromTo(
        el.querySelectorAll("[data-morph-item]"),
        { opacity: 0, x: -6 },
        {
          opacity: 1,
          x: 0,
          duration: dur(DURATION.swap),
          ease: EASE.out,
          stagger: dur(STAGE.step),
          clearProps: "opacity,transform",
        },
        dur(STAGE.follow)
      ),
  exit: (el: HTMLElement) =>
    gsap
      .timeline()
      .to(
        el.querySelectorAll("[data-morph-item]"),
        {
          opacity: 0,
          duration: dur(DURATION.exit * 0.7),
          ease: EASE.in,
          stagger: { each: dur(STAGE.exitStep), from: "end" },
        },
        0
      )
      .to(
        el,
        { opacity: 0, x: -6, scale: 0.97, duration: dur(DURATION.exit), ease: EASE.in },
        dur(0.05)
      ),
}

/**
 * Toolbar button to the right of the model trigger, styled like the add-attachment
 * button: shows the current effort level as signal bars that morph between levels,
 * and opens the effort slider. Only shown for models with reasoning effort.
 */
export const EffortLevelButton = forwardRef<
  HTMLButtonElement,
  Omit<ComponentProps<"button">, "value"> & { value: Effort }
>(function EffortLevelButton({ value, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`Effort level: ${value}`}
      title={`Effort level: ${value}`}
      className={cn(ROUND_BUTTON, className)}
      {...props}
    >
      <EffortLevelIcon value={value} className="size-6" />
    </button>
  )
})

/**
 * The toolbar's effort control: an `EffortLevelButton` that opens the effort slider
 * above the toolbar. It's only there for models with reasoning effort, and it opens
 * and closes its own gap progressively: the space opens first, then the button
 * pops in (and the reverse), so the model trigger beside it slides over instead of jumping.
 */
export function EffortToolbarControl({
  visible,
  value,
  onValueChange,
}: {
  visible: boolean
  value: Effort
  onValueChange: (effort: Effort) => void
}) {
  const [open, setOpen] = useState(false)
  // Already visible on the first paint: no entrance (avoids a flash on load).
  const visibleOnMount = useRef(visible)

  const presence = usePresenceMorph<HTMLSpanElement>(visible, {
    enter: (el) => {
      if (visibleOnMount.current) return gsap.set(el, {})
      const width = el.offsetWidth
      const gap = parseFloat(getComputedStyle(el.parentElement ?? el).columnGap) || 0
      return gsap
        .timeline()
        .fromTo(
          el,
          { width: 0, marginRight: -gap, overflow: "hidden" },
          {
            width,
            marginRight: 0,
            duration: dur(DURATION.morph),
            ease: EASE.morph,
            clearProps: "width,marginRight,overflow",
          }
        )
        .fromTo(
          el.firstElementChild,
          { opacity: 0, scale: 0.6 },
          {
            opacity: 1,
            scale: 1,
            duration: dur(DURATION.swap),
            ease: EASE.pop,
            clearProps: "opacity,transform",
          },
          dur(STAGE.follow)
        )
    },
    exit: (el) => {
      visibleOnMount.current = false
      const gap = parseFloat(getComputedStyle(el.parentElement ?? el).columnGap) || 0
      gsap.set(el, { overflow: "hidden" })
      return gsap
        .timeline()
        .to(el.firstElementChild, { opacity: 0, scale: 0.6, duration: dur(DURATION.exit), ease: EASE.in }, 0)
        .to(
          el,
          { width: 0, marginRight: -gap, duration: dur(DURATION.morph * 0.8), ease: EASE.inOut },
          dur(DURATION.exit * 0.6)
        )
    },
  })

  if (!presence.mounted) return null
  return (
    <span ref={presence.ref} className="flex shrink-0">
      <ComposerPopover
        align="center"
        open={visible && open}
        onOpenChange={setOpen}
        trigger={<EffortLevelButton value={value} />}
      >
        <EffortPanel value={value} onValueChange={onValueChange} />
      </ComposerPopover>
    </span>
  )
}

/**
 * Vertical effort slider: Low at the bottom, High at the top, on a colour-graded
 * track. Drag or use the arrow keys on the thumb, or click a level. Changes
 * apply live; the panel stays open.
 */
export function EffortPanel({
  value,
  onValueChange,
  className,
}: {
  value: Effort
  onValueChange: (effort: Effort) => void
  className?: string
}) {
  const index = EFFORTS.indexOf(value)

  return (
    <div className={cn("w-[228px]", MENU_SURFACE, className)}>
      <div data-morph-item className={cn("pt-2 pr-2 pb-1.5 pl-3.5", MENU_TITLE)}>
        Effort level
      </div>

      <div className="px-3.5 pt-1 pb-3">
        {/* Labels are 36px tall and the slider is inset by 8px + half its 20px thumb (18px),
            so each label lines up with its stop. */}
        <div className="flex h-[152px] gap-3">
          <div data-morph-item className="h-full py-2">
            <SliderPrimitive.Root
              orientation="vertical"
              min={0}
              max={EFFORTS.length - 1}
              step={1}
              value={[index]}
              onValueChange={([next]) => onValueChange(EFFORTS[next])}
              // The last child is the thumb's positioning wrapper: let it glide between stops.
              className="relative flex h-full w-5 touch-none flex-col items-center select-none [&>span:last-child]:transition-[bottom] [&>span:last-child]:duration-150 [&>span:last-child]:ease-out"
            >
              <SliderPrimitive.Track className="relative w-1.5 grow overflow-hidden rounded-full bg-[#EBEBEB]">
                <SliderPrimitive.Range
                  className="absolute w-full rounded-full transition-[top] duration-150 ease-out"
                  // The gradient is sized to the whole track and pinned to its bottom, so the
                  // fill reveals it rather than stretching it: each level shows its own colour.
                  style={{
                    backgroundImage: `linear-gradient(to top, ${EFFORT_COLORS.Low}, ${EFFORT_COLORS.Medium}, ${EFFORT_COLORS.High})`,
                    backgroundSize: `100% ${TRACK_HEIGHT}px`,
                    backgroundPosition: "bottom",
                    backgroundRepeat: "no-repeat",
                  }}
                />
              </SliderPrimitive.Track>
              <SliderPrimitive.Thumb
                aria-label="Effort level"
                aria-valuetext={value}
                className={cn(
                  "block size-5 cursor-grab rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06] transition-[scale] hover:scale-110 active:scale-95 active:cursor-grabbing",
                  FOCUS_RING
                )}
              />
            </SliderPrimitive.Root>
          </div>

          {/* Clickable level labels, top (High) to bottom (Low). The slider carries the
              keyboard and screen-reader semantics. */}
          <div aria-hidden className="flex h-full min-w-0 flex-1 flex-col justify-between">
            {[...EFFORTS].reverse().map((option) => {
              const selected = option === value
              return (
                <button
                  key={option}
                  type="button"
                  tabIndex={-1}
                  data-morph-item
                  // Keep focus on the slider thumb (these are pointer shortcuts only).
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onValueChange(option)}
                  className="flex h-9 min-w-0 items-center gap-2.5 text-left outline-none"
                >
                  <EffortLevelIcon
                    value={option}
                    className="size-[18px] shrink-0 transition-colors"
                    style={{ color: selected ? EFFORT_COLORS[option] : "#B5B5B5" }}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className={cn("truncate", rowLabel(selected))}>{option}</span>
                    <span className={cn("truncate", ROW_DESCRIPTION)}>{EFFORT_HINTS[option]}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
