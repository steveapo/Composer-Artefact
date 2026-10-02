"use client"

import { useRef, type KeyboardEvent } from "react"
import {
  ArrowUpRight01Icon,
  DashboardSpeed01Icon,
  GitBranchIcon,
  Route01Icon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { PERMISSIONS, type PermissionId } from "./data"
import { Icon, type IconData } from "./icons"
import {
  FOCUS_RING,
  MENU_ROW,
  MENU_SURFACE,
  MENU_TITLE,
  ROW_DESCRIPTION,
  rowIcon,
  rowLabel,
} from "./styles"

export const PERMISSION_ICONS: Record<PermissionId, IconData> = {
  auto: DashboardSpeed01Icon,
  manual: GitBranchIcon,
  plan: Route01Icon,
  bypass: ShieldCheckIcon,
}

/** "Permissions" card: pick how much autonomy the agent gets. */
export function PermissionsMenu({
  value,
  onValueChange,
  learnMoreHref = "#",
  className,
}: {
  value: PermissionId
  onValueChange: (value: PermissionId) => void
  learnMoreHref?: string
  className?: string
}) {
  const listRef = useRef<HTMLDivElement>(null)

  // Arrow-key roving focus between the options.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
    event.preventDefault()
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? []
    )
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    const step = event.key === "ArrowDown" ? 1 : -1
    const next = (current + step + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <div className={cn("w-[340px]", MENU_SURFACE, className)}>
      <div
        data-morph-item
        className={cn("flex items-center justify-between pt-2 pr-2 pb-1.5 pl-3.5", MENU_TITLE)}
      >
        <span>Permissions</span>
        <a
          href={learnMoreHref}
          className={cn(
            "flex h-7 items-center gap-1 rounded-full bg-[#F2F2F2] pr-2 pl-2.5 text-[13px] text-[#8A8A8A] transition-colors hover:bg-[#EAEAEA] hover:text-[#5A5A5A]",
            FOCUS_RING
          )}
        >
          Learn more
          <Icon icon={ArrowUpRight01Icon} aria-hidden className="size-3.5" strokeWidth={2} />
        </a>
      </div>

      <div ref={listRef} role="menu" aria-label="Permissions" onKeyDown={handleKeyDown}>
        {PERMISSIONS.map((permission) => {
          const selected = permission.id === value
          return (
            <button
              key={permission.id}
              type="button"
              role="menuitemradio"
              data-morph-item
              aria-checked={selected}
              onClick={() => onValueChange(permission.id)}
              className={MENU_ROW}
            >
              <Icon
                icon={PERMISSION_ICONS[permission.id]}
                aria-hidden
                className={rowIcon(selected)}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={rowLabel(selected)}>{permission.title}</span>
                <span className={ROW_DESCRIPTION}>{permission.description}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
