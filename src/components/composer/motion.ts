"use client"

import { useLayoutEffect, useRef, useState, type RefObject } from "react"
import gsap from "gsap"
import { MotionPathPlugin } from "gsap/MotionPathPlugin"
import { useGSAP } from "@gsap/react"

gsap.registerPlugin(useGSAP, MotionPathPlugin)
// Every tween only fights over the properties it shares with a running tween,
// so rapid clicks re-target smoothly instead of queueing up.
gsap.defaults({ overwrite: "auto" })
gsap.config({ nullTargetWarn: false })

/**
 * Motion vocabulary for the composer.
 * Short, transform/opacity-first, interruptible — motion should explain what
 * changed, never make the user wait for it.
 */
export const DURATION = {
  /** Exits and tiny confirmations. */
  exit: 0.14,
  /** Content swaps and staggered items. */
  swap: 0.26,
  /** Size / position morphs. */
  morph: 0.36,
  /** A container closing up (e.g. the attachment tray leaving): slow enough to read as a glide. */
  collapse: 0.6,
  /** A container opening up (e.g. the tray coming back): the same slow glide, contents after. */
  expand: 0.6,
}

export const EASE = {
  out: "power3.out",
  in: "power2.in",
  inOut: "power2.inOut",
  morph: "expo.out",
  pop: "back.out(1.8)",
  /** Gentlest in-out curve (lowest peak speed), for collapses. */
  collapse: "sine.inOut",
  /** Same gentle curve for expansions, so opening and closing feel like one motion. */
  expand: "sine.inOut",
  /** Softer overshoot than `pop`, for slower, larger entrances (e.g. tiles after a reset). */
  settle: "back.out(1.4)",
}

/**
 * Every animation is progressive: the container moves first, and its contents
 * follow once it has mostly arrived (`follow`), one after another (`step`).
 */
export const STAGE = {
  follow: 0.14,
  step: 0.035,
  /** Exits stagger tighter than entrances: leaving should never hold the user up. */
  exitStep: 0.012,
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** Seconds, or 0 when the user prefers reduced motion (state still changes, just instantly). */
export function dur(seconds: number) {
  return prefersReducedMotion() ? 0 : seconds
}

export { gsap, useGSAP }

/**
 * Runs `animate` only when `key` actually changes (never on mount, and safe
 * under React strict mode's double effects). Receives the previous key.
 */
export function useMorphOnChange<K>(
  key: K,
  animate: (previous: K) => void,
  scope?: RefObject<Element | null>
) {
  const previous = useRef(key)
  useGSAP(
    () => {
      if (Object.is(previous.current, key)) return
      const from = previous.current
      previous.current = key
      animate(from)
    },
    { dependencies: [key], scope }
  )
}

/**
 * Smoothly morphs `outer`'s height to follow `inner`'s content height.
 * `outer` must be a block container (not flex) so `inner` keeps its natural height.
 * Duration scales with the distance travelled: small nudges are near-instant.
 *
 * Growing and shrinking (e.g. the attachment tray coming and going) both glide from
 * the top: `inner` is held against `outer`'s bottom edge while the height eases, so the
 * text and toolbar stay put instead of jumping and waiting for the edge to catch up.
 */
export function useHeightMorph(
  outerRef: RefObject<HTMLElement | null>,
  innerRef: RefObject<HTMLElement | null>
) {
  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    const setInnerY = gsap.quickSetter(inner, "y", "px")
    let last = -1
    const observer = new ResizeObserver((entries) => {
      const style = getComputedStyle(outer)
      const chrome =
        parseFloat(style.paddingTop) +
        parseFloat(style.paddingBottom) +
        parseFloat(style.borderTopWidth) +
        parseFloat(style.borderBottomWidth)
      // Layout height (sub-pixel), unaffected by transforms on the card, such as the
      // page intro's scale-up, which would otherwise make it measure short.
      const entry = entries[entries.length - 1]
      const contentHeight = entry?.borderBoxSize?.[0]?.blockSize ?? inner.offsetHeight
      const target = contentHeight + chrome
      if (last < 0) {
        gsap.set(outer, { height: target })
        last = target
        return
      }
      if (Math.abs(target - last) < 0.5) return
      const distance = Math.abs(target - last)
      const growing = target > last
      last = target

      // Both directions glide slowly and gently (the tray's ~90px takes the full 0.6s;
      // a text line ~0.2–0.3s), with the content held against the card's bottom edge:
      // offset by however much the card's height still differs from its content's.
      // The text and toolbar never move; the top edge opens or closes around them.
      // Re-targeting mid-way stays continuous, since the offset follows the live height.
      const pinToBottom = () => setInnerY(Number(gsap.getProperty(outer, "height")) - target)
      pinToBottom()
      gsap.to(outer, {
        height: target,
        duration: dur(
          growing
            ? gsap.utils.clamp(0.2, DURATION.expand, distance / 150)
            : gsap.utils.clamp(0.3, DURATION.collapse, distance / 150)
        ),
        ease: growing ? EASE.expand : EASE.collapse,
        overwrite: true,
        onUpdate: pinToBottom,
        onComplete: () => gsap.set(inner, { clearProps: "transform" }),
      })
    })
    observer.observe(inner)

    return () => {
      observer.disconnect()
      gsap.killTweensOf(outer)
      gsap.set(outer, { clearProps: "height" })
      gsap.set(inner, { clearProps: "transform" })
    }
  }, [outerRef, innerRef])
}

/**
 * When `key` changes, the control updates in two stages:
 * 1. it resizes from its old width to its new one, with the new content held back,
 * 2. once it has essentially arrived, the `[data-swap]` content lifts in.
 * While resizing, truncating labels clip instead of showing an ellipsis, so there's
 * never a half-width "proj…" frame before the full label appears.
 */
export function useSwapMorph(ref: RefObject<HTMLElement | null>, key: unknown) {
  const width = useRef<number | null>(null)

  // Keep the resting width current (fonts loading, container resizes…).
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    width.current = el.getBoundingClientRect().width
    const observer = new ResizeObserver(() => {
      if (!gsap.isTweening(el)) width.current = el.getBoundingClientRect().width
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  useMorphOnChange(key, () => {
    const el = ref.current
    if (!el) return
    const from = gsap.isTweening(el) ? el.getBoundingClientRect().width : width.current
    gsap.killTweensOf(el, "width")
    gsap.set(el, { clearProps: "width" })
    const to = el.getBoundingClientRect().width
    width.current = to

    const content = el.querySelectorAll<HTMLElement>("[data-swap]")
    const resizes = from !== null && Math.abs(from - to) > 1
    // Wait until the resize is ~98% done (expo.out at 60%) before the content comes in.
    const contentAt = resizes ? dur(DURATION.morph * 0.6) : 0

    const tl = gsap.timeline()
    if (resizes) {
      // 1. Resize with the new content held back and clipping (not ellipsizing).
      gsap.set(content, { textOverflow: "clip" })
      tl.fromTo(
        el,
        { width: from },
        { width: to, duration: dur(DURATION.morph), ease: EASE.morph, clearProps: "width" },
        0
      )
    }
    // 2. Then the new label settles into the finished shape.
    tl.fromTo(
      content,
      { opacity: 0, y: 6 },
      {
        opacity: 1,
        y: 0,
        duration: dur(DURATION.swap),
        ease: EASE.out,
        stagger: dur(STAGE.step),
        clearProps: "opacity,transform,textOverflow",
      },
      contentAt
    )
  })
}

type PresenceMorph<T extends HTMLElement> = {
  enter: (el: T) => gsap.core.Animation
  exit: (el: T) => gsap.core.Animation
}

/**
 * Keeps an overlay mounted long enough for a GSAP exit.
 * Render the Radix Portal/Content with `forceMount` while `mounted`, and pass
 * `ref` to the animated element. Pointer events are disabled while leaving so
 * an exiting layer never swallows the user's next click.
 */
export function usePresenceMorph<T extends HTMLElement>(open: boolean, morph: PresenceMorph<T>) {
  const [mounted, setMounted] = useState(open)
  const [node, setNode] = useState<T | null>(null)
  if (open && !mounted) setMounted(true)

  useLayoutEffect(() => {
    if (!node || !mounted) return
    node.style.pointerEvents = open ? "" : "none"
    const animation = open ? morph.enter(node) : morph.exit(node)
    if (!open) {
      if (animation.duration() === 0 || animation.progress() === 1) setMounted(false)
      else animation.eventCallback("onComplete", () => setMounted(false))
    }
    return () => {
      animation.kill()
    }
    // `morph` is intentionally read fresh from the render that toggled `open`.
  }, [open, mounted, node])

  return {
    mounted,
    ref: setNode,
    /** Unmount now, e.g. when another layer has taken over this one's exit (see `handoffMorph`). */
    unmount: () => setMounted(false),
  }
}

/** Shared popover/menu morph, played in stages. */
export const popoverMorph: PresenceMorph<HTMLElement> = {
  // 1. The card opens out of its trigger. 2. Once it's mostly open, its rows cascade in.
  enter: (el) =>
    gsap
      .timeline()
      .fromTo(
        el,
        { opacity: 0, scale: 0.92, y: 10 },
        { opacity: 1, scale: 1, y: 0, duration: dur(DURATION.morph), ease: EASE.morph }
      )
      .fromTo(
        el.querySelectorAll("[data-morph-item]"),
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: dur(DURATION.swap),
          ease: EASE.out,
          stagger: dur(STAGE.step),
          clearProps: "opacity,transform",
        },
        dur(STAGE.follow)
      ),
  // Reverse, but tight: the rows drop out last-to-first, then the card folds away.
  exit: (el) =>
    gsap
      .timeline()
      .to(
        el.querySelectorAll("[data-morph-item]"),
        {
          opacity: 0,
          y: 4,
          duration: dur(DURATION.exit * 0.7),
          ease: EASE.in,
          stagger: { each: dur(STAGE.exitStep), from: "end" },
        },
        0
      )
      .to(
        el,
        { opacity: 0, scale: 0.95, y: 6, duration: dur(DURATION.exit), ease: EASE.in },
        dur(0.05)
      ),
}

/** A popover that has started closing and can be taken over by the next one opening. */
export type ExitingLayer = {
  node: HTMLElement
  animation: gsap.core.Animation
  /** Unmount the old layer (safe to call more than once). */
  release: () => void
}

/**
 * Switching straight from one open dropdown to another plays as one card
 * travelling, in stages:
 * 1. the old items clear out (the old card holds its shape),
 * 2. the new card takes the old card's exact place and size, then glides to its own,
 * 3. the new items cascade in once it has mostly arrived.
 * Transform/opacity only. The new card is measured at the swap, by which point
 * the popper has positioned it.
 */
export function handoffMorph(from: ExitingLayer, to: HTMLElement): gsap.core.Timeline {
  const card = from.node
  const elapsed = from.animation.time()
  from.animation.kill()
  const fromRect = card.getBoundingClientRect()
  const toItems = to.querySelectorAll("[data-morph-item]")

  // The new card waits, invisible and empty, until the old one has cleared.
  gsap.set(to, { opacity: 0 })
  gsap.set(toItems, { opacity: 0, y: 8 })

  // The old card may already be partway through its exit: only clear what's left.
  const swapAt = dur(Math.max(0.06, 0.12 - elapsed))
  const glide = dur(DURATION.morph + 0.04)

  // If this handoff is cut short (e.g. the new dropdown closes), still unmount the old one.
  const tl = gsap.timeline({ onInterrupt: from.release })
  // Keeps the timeline alive for the stages that are added at swap time.
  tl.to({}, { duration: swapAt + glide + dur(0.4) }, 0)

  // 1. Old items clear out; the old card un-folds if its exit had begun.
  tl.to(
    card.querySelectorAll("[data-morph-item]"),
    {
      opacity: 0,
      y: -4,
      duration: swapAt,
      ease: EASE.in,
      stagger: { each: dur(STAGE.exitStep), from: "end" },
    },
    0
  )
  tl.to(card, { opacity: 1, scale: 1, y: 0, duration: swapAt, ease: EASE.out }, 0)

  tl.call(
    () => {
      // 2. Swap: the new card appears exactly over the old one and travels to its own place.
      gsap.set(to, { x: 0, y: 0, scaleX: 1, scaleY: 1 })
      const toRect = to.getBoundingClientRect()
      card.style.visibility = "hidden"
      from.release()
      tl.fromTo(
        to,
        {
          transformOrigin: "0% 0%",
          x: fromRect.left - toRect.left,
          y: fromRect.top - toRect.top,
          scaleX: fromRect.width / toRect.width,
          scaleY: fromRect.height / toRect.height,
          opacity: 1,
        },
        {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          duration: glide,
          ease: EASE.morph,
          clearProps: "transform,transformOrigin",
        },
        swapAt
      )
      // 3. The new items come in once the card has mostly arrived.
      tl.to(
        toItems,
        {
          opacity: 1,
          y: 0,
          duration: dur(DURATION.swap),
          ease: EASE.out,
          stagger: dur(STAGE.step),
          clearProps: "opacity,transform",
        },
        swapAt + dur(STAGE.follow + 0.06)
      )
    },
    [],
    swapAt
  )

  return tl
}
