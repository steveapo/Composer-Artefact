"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Dialog as DialogPrimitive } from "radix-ui"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import type { Attachment } from "./data"
import { FileGlyph, Icon } from "./icons"
import { FOCUS_RING } from "./styles"
import { DURATION, EASE, STAGE, dur, gsap, useGSAP, usePresenceMorph } from "./motion"

/**
 * Horizontally scrolling row of attachment tiles.
 * A fresh tray cascades its tiles in; a tile added to an existing tray is
 * scrolled into view and then pops in.
 */
export function AttachmentTray({
  attachments,
  onRemove,
  className,
}: {
  attachments: Attachment[]
  onRemove?: (id: string) => void
  className?: string
}) {
  const trayRef = useRef<HTMLDivElement>(null)
  // Ids already on screen. `null` until the first paint, which never animates.
  const seen = useRef<Set<string> | null>(null)
  // On-screen x of every tile, captured right before a removal so the
  // survivors can slide (FLIP, transform-only) from where they were.
  const beforeRemoval = useRef<Map<string, number> | null>(null)
  const idsKey = attachments.map((a) => a.id).join("|")

  function captureTilePositions() {
    const tray = trayRef.current
    if (!tray) return
    beforeRemoval.current = new Map(
      Array.from(tray.querySelectorAll<HTMLElement>("[data-attachment-tile]")).map((tile) => [
        tile.dataset.id ?? "",
        tile.getBoundingClientRect().left,
      ])
    )
  }

  useGSAP(
    () => {
      const tray = trayRef.current
      const ids = attachments.map((a) => a.id)
      if (!tray) {
        // Tray is hidden: whatever shows up next is a fresh tray.
        seen.current = new Set()
        beforeRemoval.current = null
        return
      }
      const previous = seen.current
      seen.current = new Set(ids)
      if (previous === null) return

      // A tile was removed: slide the remaining tiles from their old spots into their new ones.
      const before = beforeRemoval.current
      beforeRemoval.current = null
      if (before) {
        tray.querySelectorAll<HTMLElement>("[data-attachment-tile]").forEach((tile) => {
          const oldLeft = before.get(tile.dataset.id ?? "")
          if (oldLeft === undefined) return
          // Drop any in-flight slide so we measure the true new layout position.
          gsap.killTweensOf(tile, "x")
          gsap.set(tile, { x: 0 })
          const dx = oldLeft - tile.getBoundingClientRect().left
          if (Math.abs(dx) < 0.5) {
            gsap.set(tile, { clearProps: "transform" })
            return
          }
          gsap.fromTo(
            tile,
            { x: dx },
            {
              x: 0,
              duration: dur(DURATION.morph),
              ease: EASE.morph,
              force3D: true,
              clearProps: "transform",
            }
          )
        })
      }

      const tiles = ids
        .filter((id) => !previous.has(id))
        .map((id) => tray.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`))
        .filter((tile): tile is HTMLElement => tile !== null)
      if (tiles.length === 0) return

      if (previous.size === 0) {
        // A fresh tray (e.g. the reset after a send), in slow motion: the card opens
        // up first, then the tiles scale in one after another with a soft settle.
        gsap.fromTo(
          tiles,
          { opacity: 0, scale: 0.6 },
          {
            opacity: 1,
            scale: 1,
            duration: dur(0.5),
            ease: EASE.settle,
            // The expansion (sine in-out) is ~80% open at 70% of the way through;
            // the first tile starts there so it lands just as the room finishes opening.
            delay: dur(DURATION.expand * 0.7),
            stagger: dur(0.07),
            force3D: true,
            clearProps: "opacity,transform",
          }
        )
        return
      }

      // Added to the end, so nothing shifts: glide the tray to its end first,
      // then pop the new tile in (scroll + transform/opacity only).
      gsap
        .timeline()
        .to(
          tray,
          {
            scrollLeft: Math.max(0, tray.scrollWidth - tray.clientWidth),
            duration: dur(DURATION.morph),
            ease: EASE.morph,
          },
          0
        )
        .fromTo(
          tiles,
          { opacity: 0, scale: 0.6 },
          {
            opacity: 1,
            scale: 1,
            duration: dur(DURATION.swap),
            ease: EASE.pop,
            stagger: dur(STAGE.step),
            force3D: true,
            clearProps: "opacity,transform",
          },
          dur(STAGE.follow)
        )
    },
    { dependencies: [idsKey], scope: trayRef }
  )

  if (attachments.length === 0) return null
  return (
    <div
      ref={trayRef}
      data-attachment-tray
      className={cn(
        "-mx-1 flex gap-2.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {attachments.map((attachment) => (
        <AttachmentTile
          key={attachment.id}
          attachment={attachment}
          onRemove={
            onRemove
              ? () => {
                  captureTilePositions()
                  onRemove(attachment.id)
                }
              : undefined
          }
        />
      ))}
    </div>
  )
}

/** Whether the image behind the remove button is light or dark. */
type CornerTone = "light" | "dark"

/** Measured once per image src and shared by every tile that shows it. */
const cornerToneCache = new Map<string, CornerTone>()

/** WCAG relative luminance of an sRGB colour (0 = black, 1 = white). */
function relativeLuminance(r: number, g: number, b: number) {
  const channel = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/**
 * Samples the top-right corner of the image as the square tile shows it
 * (`object-cover` crops to the centred square), which is where the remove button sits.
 */
function measureCornerTone(image: HTMLImageElement): CornerTone | null {
  const side = Math.min(image.naturalWidth, image.naturalHeight)
  if (!side) return null
  const cropLeft = (image.naturalWidth - side) / 2
  const cropTop = (image.naturalHeight - side) / 2
  const region = side * 0.4

  const canvas = document.createElement("canvas")
  canvas.width = 8
  canvas.height = 8
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) return null
  context.drawImage(image, cropLeft + side - region, cropTop, region, region, 0, 0, 8, 8)

  let pixels: Uint8ClampedArray
  try {
    pixels = context.getImageData(0, 0, 8, 8).data
  } catch {
    return null // cross-origin image without CORS: keep the default chip
  }
  let total = 0
  for (let i = 0; i < pixels.length; i += 4) {
    total += relativeLuminance(pixels[i], pixels[i + 1], pixels[i + 2])
  }
  const luminance = total / (pixels.length / 4)
  // Pick whichever icon colour has the higher WCAG contrast against the background:
  // above ~0.179, black contrasts more than white.
  return luminance > 0.179 ? "light" : "dark"
}

/** Tone of the image under the remove button, or `null` until it has been measured. */
function useCornerTone(src: string | undefined): CornerTone | null {
  const [tone, setTone] = useState<CornerTone | null>(() =>
    src ? cornerToneCache.get(src) ?? null : null
  )

  useEffect(() => {
    if (!src) return
    const cached = cornerToneCache.get(src)
    if (cached) {
      setTone(cached)
      return
    }
    let cancelled = false
    const image = new window.Image()
    image.decoding = "async"
    image.onload = () => {
      if (cancelled) return
      const measured = measureCornerTone(image)
      if (!measured) return
      cornerToneCache.set(src, measured)
      setTone(measured)
    }
    image.src = src
    return () => {
      cancelled = true
    }
  }, [src])

  return tone
}

/**
 * A single 76px tile: image thumbnail or file glyph + truncated name.
 * Removing it scales/fades it out on the compositor (no layout work per frame);
 * the tray then slides its neighbours into the gap.
 */
export function AttachmentTile({
  attachment,
  onRemove,
}: {
  attachment: Attachment
  onRemove?: () => void
}) {
  const tileRef = useRef<HTMLDivElement>(null)
  const leaving = useRef(false)
  const isImage = attachment.kind === "image"
  const cornerTone = useCornerTone(isImage ? attachment.src : undefined)
  const { contextSafe } = useGSAP({ scope: tileRef })

  const handleRemove = contextSafe(() => {
    const tile = tileRef.current
    if (!onRemove || !tile || leaving.current) return
    leaving.current = true
    tile.style.pointerEvents = "none"
    gsap.to(tile, {
      scale: 0.6,
      opacity: 0,
      duration: dur(DURATION.exit),
      ease: EASE.in,
      force3D: true,
      onComplete: onRemove,
    })
  })

  return (
    <div
      ref={tileRef}
      data-attachment-tile
      data-id={attachment.id}
      title={attachment.name}
      className="group/tile relative size-[76px] shrink-0 overflow-hidden rounded-[18px] border border-[#E6E6E6] bg-white"
    >
      {attachment.kind === "image" ? (
        <ImagePreview attachment={attachment} />
      ) : (
        <div className="flex size-full flex-col justify-between px-2.5 pt-2.5 pb-2">
          <FileGlyph kind={attachment.kind} />
          <span className="truncate text-[12.5px] leading-none text-[#6B6B6B]">
            {attachment.name}
          </span>
        </div>
      )}

      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${attachment.name}`}
          onClick={handleRemove}
          className={cn(
            "absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full transition-[scale,background-color,color] outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-black/20 active:scale-95",
            !isImage && "bg-[#EFEFEF] text-[#6B6B6B] hover:bg-[#E4E4E4]",
            // Over a photo, flip the chip to whichever colour contrasts with what's behind it.
            // A dark chip is the safe default until the image has been measured.
            isImage &&
              (cornerTone === "dark"
                ? "bg-white/80 text-[#1F1F1F] backdrop-blur-sm hover:bg-white/95"
                : "bg-black/40 text-white backdrop-blur-sm hover:bg-black/55")
          )}
        >
          <Icon icon={Cancel01Icon} aria-hidden className="size-2.5" strokeWidth={3.5} />
        </button>
      )}
    </div>
  )
}

/**
 * Image thumbnail that opens the full image in a modal when clicked.
 * The modal grows out of the thumbnail and shrinks back into it on close,
 * so it's always clear where the preview belongs.
 */
function ImagePreview({ attachment }: { attachment: Attachment }) {
  const src = attachment.src ?? ""
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const restRect = useRef<DOMRect | null>(null)

  /** Offset + scale that places the modal exactly over the thumbnail. */
  function thumbnailPose(rest: DOMRect) {
    const thumb = triggerRef.current?.getBoundingClientRect()
    if (!thumb) return { x: 0, y: 20, scale: 0.9 }
    return {
      x: thumb.left + thumb.width / 2 - (rest.left + rest.width / 2),
      y: thumb.top + thumb.height / 2 - (rest.top + rest.height / 2),
      scale: thumb.width / rest.width,
    }
  }

  const presence = usePresenceMorph<HTMLDivElement>(open, {
    enter: (el) => {
      gsap.set(el, { x: 0, y: 0, scale: 1 })
      const rest = el.getBoundingClientRect()
      restRect.current = rest
      if (overlayRef.current) overlayRef.current.style.pointerEvents = ""
      return gsap
        .timeline()
        .fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: dur(0.24), ease: "none" }, 0)
        .fromTo(
          el,
          thumbnailPose(rest),
          { x: 0, y: 0, scale: 1, duration: dur(0.42), ease: EASE.morph },
          0
        )
        .fromTo(el, { opacity: 0 }, { opacity: 1, duration: dur(0.14), ease: "none" }, 0)
        // The frame morphs out of the thumbnail first; its header settles in after.
        .fromTo(
          el.querySelectorAll("[data-morph-item]"),
          { opacity: 0, y: -6 },
          {
            opacity: 1,
            y: 0,
            duration: dur(DURATION.swap),
            ease: EASE.out,
            stagger: dur(STAGE.step),
            clearProps: "opacity,transform",
          },
          dur(STAGE.follow * 1.5)
        )
    },
    exit: (el) => {
      const rest = restRect.current ?? el.getBoundingClientRect()
      if (overlayRef.current) overlayRef.current.style.pointerEvents = "none"
      return gsap
        .timeline()
        .to(overlayRef.current, { opacity: 0, duration: dur(0.22), ease: "none" }, 0)
        .to(el, { ...thumbnailPose(rest), duration: dur(DURATION.swap), ease: EASE.in }, 0)
        .to(el, { opacity: 0, duration: dur(DURATION.exit), ease: "none" }, dur(0.12))
    },
  })

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        ref={triggerRef}
        aria-label={`Open ${attachment.name}`}
        className="absolute inset-0 cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-inset"
      >
        <Image
          src={src}
          alt={attachment.name}
          fill
          sizes="76px"
          className="object-cover transition-transform duration-300 group-hover/tile:scale-105"
        />
      </DialogPrimitive.Trigger>

      {presence.mounted && (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay
            ref={overlayRef}
            forceMount
            className="fixed inset-0 z-50 bg-black/20"
          />
          <DialogPrimitive.Content
            ref={presence.ref}
            forceMount
            className="fixed top-1/2 left-1/2 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-2 rounded-[26px] bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-8px_rgba(0,0,0,0.16)] ring-1 ring-black/[0.06] outline-none"
          >
            <div
              data-morph-item
              className="flex items-center justify-between gap-3 pt-1 pr-1 pl-3"
            >
              <DialogPrimitive.Title className="truncate text-[15px] text-[#6E6E6E]">
                {attachment.name}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                aria-label="Close preview"
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full bg-[#EFEFEF] text-[#6B6B6B] transition-[scale,background-color] hover:scale-110 hover:bg-[#E4E4E4] active:scale-95",
                  FOCUS_RING
                )}
              >
                <Icon icon={Cancel01Icon} aria-hidden className="size-3.5" strokeWidth={3} />
              </DialogPrimitive.Close>
            </div>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[20px] border border-[#E6E6E6]">
              <Image src={src} alt={attachment.name} fill sizes="380px" className="object-cover" />
            </div>
            <DialogPrimitive.Description className="sr-only">
              Preview of the attached image
            </DialogPrimitive.Description>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </DialogPrimitive.Root>
  )
}
