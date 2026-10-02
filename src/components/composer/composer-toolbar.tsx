"use client"

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useRef,
  useState,
  type ComponentProps,
  type ForwardedRef,
  type ReactNode,
} from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { ArrowDown01Icon, ArrowUp02Icon, PlusSignIcon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { PERMISSIONS, findModel, type PermissionId } from "./data"
import { Icon, ProviderLogo } from "./icons"
import {
  DURATION,
  EASE,
  STAGE,
  dur,
  gsap,
  handoffMorph,
  popoverMorph,
  useGSAP,
  useMorphOnChange,
  usePresenceMorph,
  useSwapMorph,
  type ExitingLayer,
} from "./motion"
import { PERMISSION_ICONS } from "./permissions-menu"
import { FOCUS_RING, GHOST_TRIGGER, ROUND_BUTTON } from "./styles"

/** Attach one DOM node to a local ref and a forwarded ref. */
export function useMergedRef<T>(local: { current: T | null }, forwarded: ForwardedRef<T>) {
  return useCallback(
    (node: T | null) => {
      local.current = node
      if (typeof forwarded === "function") forwarded(node)
      else if (forwarded) forwarded.current = node
    },
    [local, forwarded]
  )
}

/** Round grey "+" button for adding attachments. The plus spins a quarter turn to confirm each add. */
export function AddButton({ className, onClick, ...props }: ComponentProps<"button">) {
  const iconRef = useRef<SVGSVGElement>(null)
  return (
    <button
      type="button"
      aria-label="Add attachment"
      onClick={(event) => {
        gsap.fromTo(
          iconRef.current,
          { rotate: 0 },
          { rotate: 90, duration: dur(DURATION.morph), ease: EASE.pop, clearProps: "transform" }
        )
        onClick?.(event)
      }}
      className={cn(ROUND_BUTTON, className)}
      {...props}
    >
      <Icon ref={iconRef} icon={PlusSignIcon} aria-hidden className="size-6" />
    </button>
  )
}

/** Ghost trigger showing the active permission mode, e.g. "Bypass all". */
export const PermissionTrigger = forwardRef<
  HTMLButtonElement,
  Omit<ComponentProps<"button">, "value"> & { value: PermissionId }
>(function PermissionTrigger({ value, className, ...props }, ref) {
  const label = PERMISSIONS.find((p) => p.id === value)?.title
  const localRef = useRef<HTMLButtonElement>(null)
  const mergedRef = useMergedRef(localRef, ref)
  useSwapMorph(localRef, value)
  return (
    <button
      ref={mergedRef}
      type="button"
      className={cn(GHOST_TRIGGER, className)}
      {...props}
    >
      <Icon
        icon={PERMISSION_ICONS[value]}
        data-swap
        aria-hidden
        className="size-[18px] shrink-0"
      />
      <span data-swap>{label}</span>
    </button>
  )
})

/** Ghost trigger showing the active model. */
export const ModelTrigger = forwardRef<
  HTMLButtonElement,
  Omit<ComponentProps<"button">, "value"> & { value: string }
>(function ModelTrigger({ value, className, ...props }, ref) {
  const match = findModel(value)
  const localRef = useRef<HTMLButtonElement>(null)
  const mergedRef = useMergedRef(localRef, ref)
  useSwapMorph(localRef, value)
  return (
    <button
      ref={mergedRef}
      type="button"
      className={cn(GHOST_TRIGGER, "pr-2.5", className)}
      {...props}
    >
      {match && (
        <span data-swap className="inline-flex shrink-0">
          <ProviderLogo provider={match.provider.id} className="size-[18px]" />
        </span>
      )}
      <span data-swap className="truncate">
        {match?.model.name ?? "Select model"}
      </span>
      <Icon icon={ArrowDown01Icon} aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
    </button>
  )
})

/**
 * Circular send button — dark when there is something to send, with a small
 * pop the moment it becomes available.
 * While `working`, the arrow flies up and out, a stop square morphs in and a
 * ring spins around the button (clicking it stops the run).
 */
export function SendButton({
  disabled,
  working = false,
  className,
  ...props
}: ComponentProps<"button"> & { working?: boolean }) {
  const active = working || !disabled
  const rootRef = useRef<HTMLButtonElement>(null)
  const spin = useRef<gsap.core.Tween | null>(null)

  // Put the parts in the right resting state for the first paint.
  useGSAP(
    () => {
      const q = gsap.utils.selector(rootRef)
      gsap.set(q("[data-send-arrow]"), working ? { y: -22, opacity: 0 } : { y: 0, opacity: 1 })
      gsap.set(q("[data-send-stop]"), working ? { scale: 1, opacity: 1 } : { scale: 0.3, opacity: 0 })
      gsap.set(q("[data-send-ring]"), { opacity: working ? 1 : 0 })
      if (working) {
        spin.current = gsap.to(q("[data-send-ring]"), {
          rotate: "+=360",
          duration: 0.9,
          ease: "none",
          repeat: -1,
        })
      }
    },
    { scope: rootRef }
  )

  // Arrow ⇄ stop morph.
  useMorphOnChange(
    working,
    () => {
      const q = gsap.utils.selector(rootRef)
      const arrow = q("[data-send-arrow]")
      const stop = q("[data-send-stop]")
      const ring = q("[data-send-ring]")
      spin.current?.kill()
      spin.current = null

      if (working) {
        // Arrow leaves first, then the stop square and ring follow it in.
        gsap
          .timeline()
          .to(arrow, { y: -22, opacity: 0, duration: dur(DURATION.swap), ease: EASE.in }, 0)
          .fromTo(
            stop,
            { scale: 0.3, rotate: -45, opacity: 0 },
            { scale: 1, rotate: 0, opacity: 1, duration: dur(DURATION.morph), ease: EASE.pop },
            dur(STAGE.follow)
          )
          .fromTo(
            ring,
            { scale: 0.8, opacity: 0 },
            { scale: 1, opacity: 1, duration: dur(DURATION.morph), ease: EASE.out },
            dur(STAGE.follow * 0.6)
          )
        // The spinner is informative (work is happening), so it keeps turning even with reduced motion.
        spin.current = gsap.to(ring, { rotate: "+=360", duration: 0.9, ease: "none", repeat: -1 })
      } else {
        gsap
          .timeline()
          .to(stop, { scale: 0.3, opacity: 0, duration: dur(DURATION.exit), ease: EASE.in }, 0)
          .to(ring, { scale: 0.9, opacity: 0, duration: dur(DURATION.exit), ease: EASE.in }, 0)
          .fromTo(
            arrow,
            { y: 14, opacity: 0 },
            { y: 0, opacity: 1, duration: dur(DURATION.morph), ease: EASE.out },
            dur(STAGE.follow * 0.5)
          )
      }
    },
    rootRef
  )

  // "Ready to send" pop when the button turns on.
  useMorphOnChange(
    active,
    (wasActive) => {
      if (wasActive || working) return
      gsap.fromTo(
        rootRef.current,
        { scale: 0.88 },
        { scale: 1, duration: dur(DURATION.morph), ease: EASE.pop, clearProps: "transform" }
      )
    },
    rootRef
  )

  return (
    <button
      ref={rootRef}
      type="button"
      data-send-button
      aria-label={working ? "Stop" : "Send message"}
      aria-busy={working}
      disabled={disabled && !working}
      className={cn(
        "relative grid size-11 shrink-0 place-items-center rounded-full transition-[background-color,color,scale] active:scale-95",
        FOCUS_RING,
        active ? "bg-[#1F1F1F] text-white hover:bg-[#333333]" : "bg-[#EEEEEE] text-[#B5B5B5]",
        className
      )}
      {...props}
    >
      <Icon
        icon={ArrowUp02Icon}
        data-send-arrow
        aria-hidden
        className="absolute size-5"
        strokeWidth={2.25}
      />
      <span
        data-send-stop
        aria-hidden
        className="absolute size-3 rounded-[3px] bg-white"
        style={{ opacity: 0 }}
      />
      {/* Working ring: 3px outside the 44px button, a quarter-circle arc. */}
      <svg
        data-send-ring
        aria-hidden
        viewBox="0 0 50 50"
        className="pointer-events-none absolute -inset-[3px] size-[50px]"
        style={{ opacity: 0 }}
      >
        <circle
          cx="25"
          cy="25"
          r="23.5"
          fill="none"
          stroke="#1F1F1F"
          strokeOpacity="0.35"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="37 111"
        />
      </svg>
    </button>
  )
}

/**
 * Groups dropdowns so that switching straight from one to another plays as a
 * single card travelling between them (see `handoffMorph`) instead of two cards cross-fading.
 */
const PopoverMorphGroupContext = createContext<{ current: ExitingLayer | null } | null>(null)

export function PopoverMorphGroup({ children }: { children: ReactNode }) {
  const exiting = useRef<ExitingLayer | null>(null)
  return (
    <PopoverMorphGroupContext.Provider value={exiting}>{children}</PopoverMorphGroupContext.Provider>
  )
}

/**
 * Unstyled popover shell: the menus bring their own card styling.
 * The card morphs out of its trigger and its `[data-morph-item]` rows cascade in;
 * it stays mounted just long enough to fade back out.
 */
export function ComposerPopover({
  trigger,
  children,
  open,
  onOpenChange,
  align = "start",
  lockSide = false,
}: {
  trigger: ReactNode
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  align?: "start" | "center" | "end"
  /**
   * Always open above the trigger, never flipping below it (e.g. so it never covers the composer).
   * Content can size itself to the room above with `--radix-popover-content-available-height`.
   */
  lockSide?: boolean
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isOpen = open ?? uncontrolledOpen
  const group = useContext(PopoverMorphGroupContext)
  const presence = usePresenceMorph<HTMLDivElement>(isOpen, {
    enter: (el) => {
      if (!group) return popoverMorph.enter(el)
      // Radix dismisses the old dropdown on the document `click`, i.e. *after* this one has
      // opened. So open invisibly, and decide on the next frame: by then any dropdown being
      // switched away from has started closing, whichever order the events arrived in.
      gsap.set(el, { opacity: 0 })
      gsap.set(el.querySelectorAll("[data-morph-item]"), { opacity: 0 })
      const controller = gsap.timeline()
      controller.to({}, { duration: 0.05 }, 0) // keeps the controller alive until it decides
      controller.call(
        () => {
          const previous = group.current
          group.current = null
          // Note: not `isActive()`, which stays false until an animation has rendered once,
          // and the old dropdown's exit is often created in this very frame.
          const switching =
            previous !== null &&
            previous.node !== el &&
            previous.node.isConnected &&
            previous.animation.progress() < 1
          if (switching) {
            // Cut short (e.g. this dropdown closes mid-switch)? Still unmount the old one.
            controller.eventCallback("onInterrupt", previous.release)
            // Old items out → container travels → new items in.
            controller.add(handoffMorph(previous, el), controller.time())
          } else {
            controller.add(popoverMorph.enter(el), controller.time())
          }
        },
        [],
        0.001
      )
      return controller
    },
    exit: (el) => {
      const animation = popoverMorph.exit(el)
      if (group) {
        group.current = {
          node: el,
          animation,
          release: () => {
            presence.unmount()
          },
        }
      }
      return animation
    },
  })

  function handleOpenChange(next: boolean) {
    setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      {presence.mounted && (
        <PopoverPrimitive.Portal forceMount>
          <PopoverPrimitive.Content
            ref={presence.ref}
            forceMount
            side="top"
            align={align}
            sideOffset={10}
            collisionPadding={16}
            avoidCollisions={!lockSide}
            className="z-50 origin-(--radix-popover-content-transform-origin) outline-none"
          >
            {children}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      )}
    </PopoverPrimitive.Root>
  )
}
