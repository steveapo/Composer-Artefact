"use client"

import { forwardRef, useRef, useState, type ComponentProps, type ReactNode } from "react"
import { Folder01Icon, GitBranchIcon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { ComposerPopover, useMergedRef } from "./composer-toolbar"
import { ContextPicker } from "./context-picker"
import { BRANCHES, PROJECTS, type ContextOption } from "./data"
import { Icon } from "./icons"
import { useSwapMorph } from "./motion"
import { FOCUS_RING } from "./styles"

/**
 * The pickers always open above the bar (never over the composer), so they
 * shrink to the room above and let their list scroll.
 */
const PICKER_FITS_ABOVE = "max-h-(--radix-popover-content-available-height)"

/**
 * Grey tab that peeks out behind the top of the composer card,
 * showing the active git branch and project folder. Each chip opens a
 * searchable picker; the branch picker can also create a new branch.
 * `tucked` adds bottom padding + negative margin so the card overlaps it.
 */
export function ContextBar({
  branch,
  project,
  onBranchChange,
  onProjectChange,
  tucked = false,
  className,
}: {
  branch: string
  project: string
  onBranchChange: (branchId: string) => void
  onProjectChange: (projectId: string) => void
  tucked?: boolean
  className?: string
}) {
  const [branchOpen, setBranchOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [branches, setBranches] = useState<ContextOption[]>(BRANCHES)

  const branchLabel = branches.find((b) => b.id === branch)?.label ?? branch
  const projectLabel = PROJECTS.find((p) => p.id === project)?.label ?? project

  function createBranch(name: string) {
    setBranches((current) => [
      { id: name, label: name, description: `New branch from ${branchLabel}` },
      ...current,
    ])
    onBranchChange(name)
    setBranchOpen(false)
  }

  return (
    <div
      data-context-bar
      className={cn(
        "flex items-center gap-1 rounded-[22px] bg-[#EAEAEA] px-2 py-1.5",
        tucked && "-mb-7 rounded-b-none pb-[calc(0.375rem+1.75rem)]",
        className
      )}
    >
      <ComposerPopover
        lockSide
        open={branchOpen}
        onOpenChange={setBranchOpen}
        trigger={<ContextChip icon={<Icon icon={GitBranchIcon} aria-hidden />} label={branchLabel} />}
      >
        <ContextPicker
          className={PICKER_FITS_ABOVE}
          title="Branches"
          icon={GitBranchIcon}
          options={branches}
          value={branch}
          onValueChange={(next) => {
            onBranchChange(next)
            setBranchOpen(false)
          }}
          searchPlaceholder="Find or create a branch"
          onCreate={createBranch}
          createLabel={(name) => `Create branch “${name}”`}
        />
      </ComposerPopover>

      <ComposerPopover
        lockSide
        open={projectOpen}
        onOpenChange={setProjectOpen}
        trigger={<ContextChip icon={<Icon icon={Folder01Icon} aria-hidden />} label={projectLabel} />}
      >
        <ContextPicker
          className={PICKER_FITS_ABOVE}
          title="Projects"
          icon={Folder01Icon}
          options={PROJECTS}
          value={project}
          onValueChange={(next) => {
            onProjectChange(next)
            setProjectOpen(false)
          }}
          searchPlaceholder="Find a project"
        />
      </ComposerPopover>
    </div>
  )
}

/** Chip trigger; its width and label morph when the selection changes. */
const ContextChip = forwardRef<
  HTMLButtonElement,
  ComponentProps<"button"> & { icon: ReactNode; label: string }
>(function ContextChip({ icon, label, className, ...props }, ref) {
  const localRef = useRef<HTMLButtonElement>(null)
  const mergedRef = useMergedRef(localRef, ref)
  useSwapMorph(localRef, label)
  return (
    <button
      ref={mergedRef}
      type="button"
      className={cn(
        "flex max-w-[240px] items-center gap-2 overflow-hidden rounded-full px-2.5 py-1 text-[15px] whitespace-nowrap text-[#6E6E6E] transition-colors hover:bg-black/[0.04] hover:text-[#3F3F3F] data-[state=open]:bg-black/[0.04] data-[state=open]:text-[#3F3F3F] [&_svg]:size-[18px] [&_svg]:text-[#8C8C8C]",
        FOCUS_RING,
        className
      )}
      {...props}
    >
      <span data-swap className="inline-flex shrink-0">
        {icon}
      </span>
      <span data-swap className="truncate">
        {label}
      </span>
    </button>
  )
})
