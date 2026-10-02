import { forwardRef } from "react"
import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react"
import {
  Attachment01Icon,
  CubeIcon,
  FishIcon,
  PawPrintIcon,
  Presentation01Icon,
  Table01Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import type { AttachmentKind, ProviderId } from "./data"

/* ------------------------------------------------------------------ */
/* Icon — the one icon component used across the interface (Hugeicons) */
/* ------------------------------------------------------------------ */

/** A Hugeicons icon definition, e.g. `Search01Icon` from `@hugeicons/core-free-icons`. */
export type IconData = HugeiconsIconProps["icon"]

/**
 * Renders a Hugeicon. It's tinted by `currentColor` and sized by `className`
 * (e.g. `size-[18px]`); the stroke defaults to 1.75 for the interface's weight.
 */
export const Icon = forwardRef<SVGSVGElement, HugeiconsIconProps>(function Icon(
  { strokeWidth = 1.75, ...props },
  ref
) {
  return <HugeiconsIcon ref={ref} strokeWidth={strokeWidth} {...props} />
})

/* ------------------------------------------------------------------ */
/* Provider logos — monochrome, tinted with currentColor               */
/* ------------------------------------------------------------------ */

function OpenAILogo({ className }: { className?: string }) {
  // The blossom asset is a white-on-transparent SVG with generous padding,
  // so it is used as a mask (tinted by currentColor) and scaled to fill.
  return (
    <span
      aria-hidden
      className={cn("inline-block bg-current", className)}
      style={{
        maskImage: "url(/composer/openai-blossom.svg)",
        WebkitMaskImage: "url(/composer/openai-blossom.svg)",
        maskSize: "200%",
        WebkitMaskSize: "200%",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }}
    />
  )
}

function AnthropicLogo({ className }: { className?: string }) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30)
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      {rays.map((deg, i) => (
        <line
          key={deg}
          x1="12"
          y1="12"
          x2="12"
          y2={i % 2 === 0 ? 1.5 : 3}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </svg>
  )
}

function PerplexityLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M12 2v20" />
      <path d="M4.5 3.5 12 10l7.5-6.5V8H4.5V3.5Z" />
      <path d="M4.5 8v8.5L12 13l7.5 3.5V8" />
      <path d="M7.5 15v5.5L12 16.5l4.5 4V15" />
    </svg>
  )
}

function CursorLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path d="M12 2 21 7v10l-9 5-9-5V7l9-5Z" fill="currentColor" opacity="0.55" />
      <path d="M12 2 21 7l-9 5-9-5 9-5Z" fill="currentColor" opacity="0.8" />
      <path d="M12 12 21 7v10l-9 5V12Z" fill="currentColor" />
    </svg>
  )
}

export function ProviderLogo({
  provider,
  className,
}: {
  provider: ProviderId
  className?: string
}) {
  const base = cn("size-5 shrink-0", className)
  switch (provider) {
    case "openai":
      return <OpenAILogo className={base} />
    case "anthropic":
      return <AnthropicLogo className={base} />
    case "perplexity":
      return <PerplexityLogo className={base} />
    case "cursor":
      return <CursorLogo className={base} />
    case "deepseek":
      return <Icon icon={FishIcon} aria-hidden className={base} />
    case "ollama":
      return <Icon icon={PawPrintIcon} aria-hidden className={base} />
  }
}

/* ------------------------------------------------------------------ */
/* File glyph — coloured document with a folded corner                 */
/* ------------------------------------------------------------------ */

const FILE_STYLES: Record<Exclude<AttachmentKind, "image">, { color: string; icon: IconData }> = {
  file: { color: "#C9C9C9", icon: Attachment01Icon },
  sheet: { color: "#2F7CF6", icon: Table01Icon },
  slides: { color: "#A57BF2", icon: Presentation01Icon },
  component: { color: "#12C9AE", icon: CubeIcon },
}

export function FileGlyph({
  kind,
  className,
}: {
  kind: Exclude<AttachmentKind, "image">
  className?: string
}) {
  const { color, icon } = FILE_STYLES[kind]
  return (
    <span className={cn("relative inline-flex h-[30px] w-6 shrink-0", className)}>
      <svg viewBox="0 0 24 30" aria-hidden className="absolute inset-0 size-full">
        <path
          d="M4 0h11.5L24 8.5V26a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4Z"
          fill={color}
        />
        <path d="M15.5 0 24 8.5h-5a3.5 3.5 0 0 1-3.5-3.5V0Z" fill="#fff" fillOpacity="0.45" />
      </svg>
      <Icon
        icon={icon}
        aria-hidden
        strokeWidth={2.25}
        className="absolute bottom-[5px] left-1/2 size-3 -translate-x-1/2 text-white"
      />
    </span>
  )
}
