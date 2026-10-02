"use client"

import { useEffect, useRef, useState, type RefObject } from "react"

import { cn } from "@/lib/utils"
import {
  EXTRA_ATTACHMENTS,
  SAMPLE_ATTACHMENTS,
  findModel,
  type Attachment,
  type Effort,
  type PermissionId,
} from "./data"
import { AttachmentTray } from "./attachment-tray"
import {
  AddButton,
  ComposerPopover,
  ModelTrigger,
  PermissionTrigger,
  PopoverMorphGroup,
  SendButton,
} from "./composer-toolbar"
import { ContextBar } from "./context-bar"
import { EffortToolbarControl } from "./effort-level"
import { ModelPicker } from "./model-picker"
import {
  DURATION,
  EASE,
  STAGE,
  gsap,
  prefersReducedMotion,
  useGSAP,
  useHeightMorph,
} from "./motion"
import { PermissionsMenu } from "./permissions-menu"
import { PromptInput } from "./prompt-input"

/** How long the send button shows its "working" animation before the composer resets. */
const WORKING_MS = 2400

export type ComposerMessage = {
  text: string
  attachments: Attachment[]
  permission: PermissionId
  modelId: string
  effort: Effort
  branch: string
  project: string
}

/** The full AI chat composer, assembled from its parts. */
export function ChatComposer({
  onSend,
  className,
}: {
  onSend?: (message: ComposerMessage) => void
  className?: string
}) {
  const [text, setText] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>(SAMPLE_ATTACHMENTS)
  const [permission, setPermission] = useState<PermissionId>("bypass")
  const [modelId, setModelId] = useState("gpt-5.6-mini")
  const [effort, setEffort] = useState<Effort>("Medium")
  const [branch, setBranch] = useState("main")
  const [project, setProject] = useState("project-sea")
  const [permissionsOpen, setPermissionsOpen] = useState(false)
  const [modelsOpen, setModelsOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [placeholderReveal, setPlaceholderReveal] = useState({ key: 0, delay: 0 })
  const addCount = useRef(0)
  const workTimer = useRef<number | undefined>(undefined)
  const cardRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const sendOutro = useRef<gsap.core.Timeline | null>(null)
  // Fixed-position copies of the tiles that fly into the send button.
  const flyers = useRef<HTMLElement[]>([])

  function removeFlyers() {
    flyers.current.forEach((flyer) => flyer.remove())
    flyers.current = []
  }

  useEffect(
    () => () => {
      window.clearTimeout(workTimer.current)
      removeFlyers()
    },
    []
  )

  // The card smoothly grows/shrinks as attachments and lines come and go.
  useHeightMorph(cardRef, contentRef)
  useComposerIntro(rootRef)
  const { contextSafe } = useGSAP({ scope: cardRef })

  const canSend = !working && (text.trim().length > 0 || attachments.length > 0)

  function addAttachment() {
    const template = EXTRA_ATTACHMENTS[addCount.current % EXTRA_ATTACHMENTS.length]
    addCount.current += 1
    setAttachments((current) => [...current, { ...template, id: `added-${addCount.current}` }])
  }

  /** Put the composer back exactly as it first appeared. */
  function resetToOriginal() {
    window.clearTimeout(workTimer.current)
    sendOutro.current?.kill()
    sendOutro.current = null
    removeFlyers()
    const textarea = cardRef.current?.querySelector("textarea")
    if (textarea) gsap.set(textarea, { clearProps: "opacity,transform" })
    const tiles = cardRef.current?.querySelectorAll("[data-attachment-tile]")
    if (tiles?.length) gsap.set(tiles, { clearProps: "opacity,transform" })
    setWorking(false)
    setText("")
    setAttachments(SAMPLE_ATTACHMENTS)
    setPermission("bypass")
    setModelId("gpt-5.6-mini")
    setEffort("Medium")
  }

  /**
   * Sending plays in stages before the message actually goes:
   * 1. each visible attachment shrinks in place,
   * 2. then swoops along an arc into the send button while the text slides toward it,
   * 3. the button swells as they land and gulps them down,
   * 4. then the message sends and the button morphs into its "working" state.
   */
  const send = contextSafe(() => {
    // `sendOutro` guards against double-sends during the flight without greying out the button.
    if (!canSend || sendOutro.current) return
    const message: ComposerMessage = {
      text: text.trim(),
      attachments,
      permission,
      modelId,
      effort,
      branch,
      project,
    }

    const card = cardRef.current
    const tray = card?.querySelector<HTMLElement>("[data-attachment-tray]") ?? null
    const tiles = Array.from(card?.querySelectorAll<HTMLElement>("[data-attachment-tile]") ?? [])
    const textarea = card?.querySelector("textarea") ?? null
    const button = card?.querySelector<HTMLElement>("[data-send-button]") ?? null

    function commit() {
      sendOutro.current = null
      onSend?.(message)
      setWorking(true)
      setText("")
      setAttachments([])
      // Reset choreography: the card first closes up where the tray was, then the
      // empty field's placeholder writes itself back in, word by word. (The prompt
      // input also brings the drifted-off textarea back, once it's been emptied.)
      setPlaceholderReveal((current) => ({
        key: current.key + 1,
        delay: message.attachments.length > 0 ? DURATION.collapse : 0,
      }))
      // Later, the reset grows the card back and the attachments pop in after it.
      workTimer.current = window.setTimeout(resetToOriginal, WORKING_MS)
    }

    if (prefersReducedMotion() || !button) {
      commit()
      return
    }

    // Only tiles the user can actually see fly; ones scrolled out of the tray just vanish.
    const target = button.getBoundingClientRect()
    const targetX = target.left + target.width / 2
    const targetY = target.top + target.height / 2
    const trayBox = tray?.getBoundingClientRect()
    const visible = tiles.filter((tile) => {
      const box = tile.getBoundingClientRect()
      return trayBox ? box.right > trayBox.left && box.left < trayBox.right : true
    })

    // The tray and card clip overflow, so the flight uses fixed-position copies
    // on <body>. Moving them is transform/opacity only, so it stays on the compositor.
    removeFlyers()
    const flights = visible.map((tile) => {
      const box = tile.getBoundingClientRect()
      const flyer = tile.cloneNode(true) as HTMLElement
      flyer.removeAttribute("data-attachment-tile")
      flyer.removeAttribute("data-id")
      flyer.removeAttribute("title")
      flyer.setAttribute("aria-hidden", "true")
      flyer.setAttribute("inert", "")
      flyer.querySelector("[aria-label^='Remove']")?.remove()
      gsap.set(flyer, { clearProps: "all" })
      Object.assign(flyer.style, {
        position: "fixed",
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
        margin: "0",
        zIndex: "60",
        pointerEvents: "none",
      })
      document.body.appendChild(flyer)
      flyers.current.push(flyer)
      return {
        flyer,
        size: box.width,
        dx: targetX - (box.left + box.width / 2),
        dy: targetY - (box.top + box.height / 2),
      }
    })
    gsap.set(tiles, { opacity: 0 })

    // The tiles become drops of the button's own colour as they fly, so on arrival
    // they merge into it instead of fading out on top of it.
    const buttonColor = getComputedStyle(button).backgroundColor
    const buttonSize = target.width

    // Choreography: the tile closest to the button leads, the rest follow like a loose flock.
    flights.reverse()
    const step = Math.min(0.075, 0.32 / Math.max(1, flights.length))
    const windUp = 0.16 // anticipation before launch
    const flight = 0.52
    const arrivalOf = (i: number) => i * step + windUp + flight
    // Text-only messages have nothing to fly, so the gulp comes as soon as the text arrives.
    const lastArrival = flights.length ? arrivalOf(flights.length - 1) : 0.3

    const tl = gsap.timeline()
    flights.forEach(({ flyer, size, dx, dy }, i) => {
      const at = i * step
      const launch = at + windUp
      const lean = i % 2 === 0 ? 1 : -1

      // 1. Anticipation: a small crouch and counter-lean before take-off.
      tl.to(
        flyer,
        {
          scale: 0.86,
          y: 6,
          rotation: -6 * lean,
          duration: windUp,
          ease: "power2.out",
          force3D: true,
        },
        at
      )

      // 2. Flight: each tile takes its own curved path, rising up and over, then
      //    gets pulled down into the button, accelerating as it's drawn in.
      tl.to(
        flyer,
        {
          motionPath: {
            path: [
              { x: dx * 0.35, y: -34 - i * 7 },
              { x: dx * 0.8, y: dy * 0.35 - 18 },
              { x: dx, y: dy },
            ],
            curviness: 1.4,
          },
          duration: flight,
          ease: "power2.inOut",
        },
        launch
      )

      // 3. Morph while flying: shrink and round into a drop of the button's colour.
      tl.to(
        flyer,
        {
          scale: (buttonSize * 0.42) / size,
          borderRadius: size / 2,
          rotation: 18 * lean,
          duration: flight * 0.85,
          ease: "power2.in",
        },
        launch
      )
      tl.to(flyer.children, { opacity: 0, duration: flight * 0.45, ease: "power1.in" }, launch + flight * 0.2)
      tl.to(
        flyer,
        { backgroundColor: buttonColor, borderColor: buttonColor, duration: flight * 0.5, ease: "power1.in" },
        launch + flight * 0.35
      )

      // 4. Swallowed: the drop sinks into the centre of the button.
      tl.to(flyer, { scale: 0.04, duration: 0.12, ease: "power2.in" }, launch + flight * 0.85)
      tl.set(flyer, { opacity: 0 }, arrivalOf(i))

      // The button swells a little more with each drop it takes in, as if it's getting fuller.
      tl.to(
        button,
        {
          scale: 1 + Math.min(0.045 * (i + 1), 0.16),
          duration: 0.12,
          ease: "power2.out",
          overwrite: false,
        },
        arrivalOf(i) - 0.04
      )
    })

    // The text drifts toward the button and dissolves while the tiles fly.
    if (textarea) {
      tl.to(textarea, { x: 28, opacity: 0, duration: 0.3, ease: "power2.in" }, windUp * 0.5)
    }

    // 5. The gulp: squash, stretch, then an elastic recoil, with a ripple rolling outward.
    const gulp = lastArrival + 0.06
    tl.to(button, { scaleX: 1.2, scaleY: 0.84, duration: 0.1, ease: "power2.out", overwrite: false }, gulp)
      .to(button, { scaleX: 0.9, scaleY: 1.1, duration: 0.1, ease: "power2.inOut", overwrite: false }, gulp + 0.1)
      .to(
        button,
        {
          scale: 1,
          duration: 0.6,
          ease: "elastic.out(1, 0.4)",
          overwrite: false,
          clearProps: "transform",
        },
        gulp + 0.2
      )

    const ripple = document.createElement("div")
    ripple.setAttribute("aria-hidden", "true")
    Object.assign(ripple.style, {
      position: "fixed",
      left: `${target.left}px`,
      top: `${target.top}px`,
      width: `${target.width}px`,
      height: `${target.height}px`,
      borderRadius: "9999px",
      border: `2px solid ${buttonColor}`,
      opacity: "0",
      zIndex: "60",
      pointerEvents: "none",
    })
    document.body.appendChild(ripple)
    flyers.current.push(ripple)
    // The message commits mid-ripple and the card shrinks, moving the button, so the
    // ripple re-centres on the button every frame (transform only: the button's centre
    // is unaffected by its own scale).
    const rippleHome = { x: targetX, y: targetY }
    const setRippleX = gsap.quickSetter(ripple, "x", "px")
    const setRippleY = gsap.quickSetter(ripple, "y", "px")
    const followButton = () => {
      const box = button.getBoundingClientRect()
      setRippleX(box.left + box.width / 2 - rippleHome.x)
      setRippleY(box.top + box.height / 2 - rippleHome.y)
    }
    tl.fromTo(
      ripple,
      { scale: 1, opacity: 0.35 },
      {
        scale: 1.9,
        opacity: 0,
        duration: 0.55,
        ease: "power2.out",
        force3D: true,
        onUpdate: followButton,
      },
      gulp + 0.1
    )

    // 6. Send once the button has swallowed everything; the working morph plays
    //    while it's still springing back, so there's no dead time.
    tl.call(commit, [], gulp + 0.22)
    // Tidy up the flight copies and ripple once the recoil has finished.
    tl.call(removeFlyers, [], gulp + 0.8)
    sendOutro.current = tl
  })

  return (
    // All of the composer's dropdowns share one group, so switching between any two travels.
    <PopoverMorphGroup>
      {/* Server-rendered hidden so nothing flashes before the intro takes over. */}
      <div
        ref={rootRef}
        data-intro-hidden
        className={cn("flex w-full max-w-[680px] flex-col data-[intro-hidden]:invisible", className)}
      >
        <ContextBar
          tucked
          className="mx-6"
          branch={branch}
          project={project}
          onBranchChange={setBranch}
          onProjectChange={setProject}
        />

        <div
          ref={cardRef}
          data-composer-card
          className="relative z-10 overflow-hidden rounded-[28px] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-8px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06]"
        >
          <div ref={contentRef} className="flex flex-col gap-1">
            <AttachmentTray
              attachments={attachments}
              onRemove={(id) => setAttachments((current) => current.filter((a) => a.id !== id))}
            />

            <PromptInput
              value={text}
              onChange={setText}
              onSubmit={send}
              revealKey={placeholderReveal.key}
              revealDelay={placeholderReveal.delay}
            />

            <div data-toolbar className="flex items-center gap-2">
              <AddButton onClick={addAttachment} />

              <ComposerPopover
                open={permissionsOpen}
                onOpenChange={setPermissionsOpen}
                trigger={<PermissionTrigger value={permission} />}
              >
                <PermissionsMenu
                  value={permission}
                  onValueChange={(next) => {
                    setPermission(next)
                    setPermissionsOpen(false)
                  }}
                />
              </ComposerPopover>

              <div data-toolbar-group className="ml-auto flex min-w-0 items-center gap-1.5">
                <ComposerPopover
                  align="end"
                  open={modelsOpen}
                  onOpenChange={setModelsOpen}
                  trigger={<ModelTrigger value={modelId} />}
                >
                  <ModelPicker
                    value={modelId}
                    onValueChange={setModelId}
                    effort={effort}
                    onEffortChange={setEffort}
                  />
                </ComposerPopover>
                {/* Effort level for models that support it, right after the model it applies to. */}
                <EffortToolbarControl
                  visible={Boolean(findModel(modelId)?.model.supportsEffort)}
                  value={effort}
                  onValueChange={setEffort}
                />
                <SendButton
                  disabled={!canSend}
                  working={working}
                  onClick={working ? resetToOriginal : send}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </PopoverMorphGroup>
  )
}

/**
 * First-load intro. The composer is server-rendered hidden (`data-intro-hidden`);
 * this sets every part's starting pose before the first paint, unhides the root,
 * then brings things in progressively, containers before their contents:
 *
 * 1. the card rises into place,
 * 2. the branch/project tab slides up out from behind it,
 * 3. the contents follow top to bottom, overlapping like a wave: the tab's chips,
 *    the attachment tiles (pop), the placeholder words (blur in from the right,
 *    as after a send) and finally the toolbar controls, left to right (pop).
 *
 * With reduced motion it simply unhides everything.
 */
function useComposerIntro(rootRef: RefObject<HTMLDivElement | null>) {
  useGSAP(
    () => {
      const root = rootRef.current
      if (!root) return
      const unhide = () => root.removeAttribute("data-intro-hidden")
      if (prefersReducedMotion()) {
        unhide()
        return
      }

      const q = gsap.utils.selector(root)
      const toolbarItems = Array.from(root.querySelector("[data-toolbar]")?.children ?? []).flatMap(
        (child) => (child.hasAttribute("data-toolbar-group") ? Array.from(child.children) : [child])
      )
      const settled = { opacity: 1, x: 0, y: 0, scale: 1, clearProps: "opacity,transform" }

      gsap
        .timeline({ delay: 0.1, defaults: { force3D: true } })
        // 1. The card.
        .fromTo(
          q("[data-composer-card]"),
          { opacity: 0, y: 28, scale: 0.98 },
          { ...settled, duration: 0.8, ease: EASE.morph },
          0
        )
        // 2. The tab, from behind the card (the card sits above it and covers its lower edge).
        .fromTo(
          q("[data-context-bar]"),
          { opacity: 0, y: 24 },
          { ...settled, duration: 0.7, ease: EASE.morph },
          0.2
        )
        // 3. Contents, top to bottom.
        .fromTo(
          q("[data-context-bar] button"),
          { opacity: 0, y: 6 },
          { ...settled, duration: DURATION.swap, ease: EASE.out, stagger: STAGE.step * 1.5 },
          0.4
        )
        .fromTo(
          q("[data-attachment-tile]"),
          { opacity: 0, scale: 0.6 },
          { ...settled, duration: DURATION.morph, ease: EASE.pop, stagger: STAGE.step * 1.5 },
          0.32
        )
        .fromTo(
          q("[data-placeholder-word]"),
          { opacity: 0, x: 10, filter: "blur(6px)" },
          {
            ...settled,
            filter: "blur(0px)",
            duration: DURATION.morph,
            ease: EASE.out,
            stagger: STAGE.step * 1.6,
            clearProps: "opacity,transform,filter",
          },
          0.46
        )
        .fromTo(
          toolbarItems,
          { opacity: 0, y: 8, scale: 0.9 },
          { ...settled, duration: DURATION.morph, ease: EASE.pop, stagger: STAGE.step * 1.4 },
          0.56
        )

      // Every part now holds its hidden starting pose, so the root can be shown.
      unhide()
    },
    { scope: rootRef }
  )
}
