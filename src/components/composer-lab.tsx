import { ChatComposer } from "@/components/composer/chat-composer"

/** Full-screen grey stage for designing and testing the chat composer, docked at the bottom like a chat input. */
export function ComposerLab() {
  return (
    <main className="flex flex-1 flex-col items-center justify-end bg-[#F2F2F2] px-6 pt-16 pb-6">
      <ChatComposer />
    </main>
  )
}
