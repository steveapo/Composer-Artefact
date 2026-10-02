"use client"

import { useRef, type KeyboardEvent } from "react"

import { cn } from "@/lib/utils"
import { DURATION, EASE, STAGE, dur, gsap, useGSAP } from "./motion"

/**
 * Borderless auto-growing textarea. Enter submits, Shift+Enter adds a newline.
 *
 * The placeholder is drawn as an overlay (one span per word) rather than the native
 * attribute, so it can be animated: whenever `revealKey` changes (e.g. after a send),
 * it's hidden straight away and then, after `revealDelay` seconds, its words come in
 * one by one, each sliding in from the right as it un-blurs and fades up.
 */
export function PromptInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Hi, what do you need today?",
  revealKey = 0,
  revealDelay = 0,
  autoFocus,
  className,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  /** Change this to replay the placeholder's word-by-word entrance. */
  revealKey?: number
  /** Seconds to hold the placeholder back first (e.g. while the card collapses). */
  revealDelay?: number
  autoFocus?: boolean
  className?: string
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const placeholderRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (revealKey === 0) return
      // Runs after React has emptied the field, so it's safe to bring the textarea
      // back from wherever the send animation left it: there's no old text to flash.
      if (textareaRef.current) {
        gsap.killTweensOf(textareaRef.current)
        gsap.set(textareaRef.current, { clearProps: "opacity,transform" })
      }
      const words = placeholderRef.current?.querySelectorAll("[data-placeholder-word]")
      if (!words?.length) return
      // fromTo renders the hidden state immediately, so nothing shows during the delay.
      gsap.fromTo(
        words,
        { opacity: 0, x: 10, filter: "blur(6px)" },
        {
          opacity: 1,
          x: 0,
          filter: "blur(0px)",
          duration: dur(DURATION.morph),
          ease: EASE.out,
          delay: dur(revealDelay),
          stagger: dur(STAGE.step * 1.6),
          clearProps: "opacity,transform,filter",
        }
      )
    },
    { dependencies: [revealKey] }
  )

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      onSubmit?.()
    }
  }

  const words = placeholder.split(" ")

  return (
    <div className="relative">
      {value === "" && (
        // Same box and type as the textarea's text, so it sits exactly where typing starts.
        <div
          ref={placeholderRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 px-2.5 py-3 text-[17px] leading-[1.45] text-[#A3A3A3] select-none"
        >
          {words.map((word, index) => (
            <span key={index}>
              <span data-placeholder-word className="inline-block">
                {word}
              </span>
              {index < words.length - 1 && " "}
            </span>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-placeholder={placeholder}
        autoFocus={autoFocus}
        rows={1}
        aria-label="Message"
        className={cn(
          "relative block field-sizing-content max-h-48 min-h-[3.25rem] w-full resize-none bg-transparent px-2.5 py-3 text-[17px] leading-[1.45] text-[#2A2A2A] caret-[#2F7CF6] outline-none",
          className
        )}
      />
    </div>
  )
}
