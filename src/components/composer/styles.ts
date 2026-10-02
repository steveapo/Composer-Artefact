/**
 * Shared visual vocabulary for the composer's floating surfaces, so every
 * dropdown reads as one family: same card, header, rows, fields, focus.
 *
 * Radii are concentric: a 26px card with 6px padding holds 20px rows, and
 * fields inset 10px from the card edge use 16px.
 */

/** Keyboard focus ring for buttons and controls on white. */
export const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-black/10"

/** The floating card behind every dropdown. */
export const MENU_SURFACE =
  "rounded-[26px] bg-white p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-8px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06]"

/** Muted heading at the top of a dropdown. */
export const MENU_TITLE = "text-[14px] text-[#A3A3A3]"

/** A selectable row inside a dropdown. */
export const MENU_ROW =
  "flex w-full items-center gap-3 rounded-[20px] px-3 py-2.5 text-left transition-colors outline-none hover:bg-[#F6F6F6] focus-visible:bg-[#F6F6F6]"

/** Row icon (20px), darker when its row is selected. */
export const rowIcon = (selected: boolean) =>
  `size-5 shrink-0 transition-colors ${selected ? "text-[#5A5A5A]" : "text-[#8C8C8C]"}`

/** Row label (15px), darker when its row is selected. */
export const rowLabel = (selected: boolean) =>
  `text-[15px] leading-tight transition-colors ${selected ? "text-[#2A2A2A]" : "text-[#6E6E6E]"}`

/** Secondary line under a row label. */
export const ROW_DESCRIPTION = "text-[13px] leading-tight text-[#A3A3A3]"

/** Filled search field at the top of a dropdown (holds a Search icon + input). */
export const SEARCH_FIELD =
  "flex h-10 items-center gap-2 rounded-[16px] bg-[#F5F5F5] px-3 text-[14px] text-[#A3A3A3]"

export const SEARCH_INPUT =
  "min-w-0 flex-1 bg-transparent text-[#2A2A2A] outline-none placeholder:text-[#A3A3A3]"

/** "Nothing found" message inside a dropdown. */
export const EMPTY_STATE = "px-3 py-6 text-center text-[14px] text-[#A3A3A3]"

/** Borderless toolbar trigger that opens a dropdown (permission mode, model). */
export const GHOST_TRIGGER = `flex h-9 items-center gap-2 overflow-hidden rounded-full px-3 text-[15px] whitespace-nowrap text-[#8A8A8A] transition-colors hover:bg-black/[0.04] hover:text-[#5A5A5A] data-[state=open]:bg-black/[0.04] data-[state=open]:text-[#5A5A5A] ${FOCUS_RING}`

/**
 * Round grey 44px toolbar button (add attachment, effort level): the same size
 * and inset as the send button. Holds a 24px icon.
 */
export const ROUND_BUTTON = `grid size-11 shrink-0 place-items-center rounded-full bg-[#EEEEEE] text-[#6B6B6B] transition-[background-color,scale] hover:bg-[#E6E6E6] active:scale-95 data-[state=open]:bg-[#E6E6E6] ${FOCUS_RING}`
