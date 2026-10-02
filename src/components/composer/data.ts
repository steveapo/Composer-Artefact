// Sample data + shared types for the AI chat composer and its parts.

export type AttachmentKind = "image" | "file" | "sheet" | "slides" | "component"

export type Attachment = {
  id: string
  name: string
  kind: AttachmentKind
  /** Only used by image attachments. */
  src?: string
}

export const SAMPLE_ATTACHMENTS: Attachment[] = [
  { id: "a1", name: "dunes.jpg", kind: "image", src: "/composer/attachment-photo.jpg" },
  { id: "a2", name: "payrollz-q3.pdf", kind: "file" },
  { id: "a3", name: "timetable-2025.xlsx", kind: "sheet" },
  { id: "a4", name: "presentation-draft.key", kind: "slides" },
  { id: "a5", name: "reactypes.tsx", kind: "component" },
]

/** Pool the "+" button draws from when adding demo attachments. */
export const EXTRA_ATTACHMENTS: Omit<Attachment, "id">[] = [
  { name: "invoice-march.pdf", kind: "file" },
  { name: "budget-plan.xlsx", kind: "sheet" },
  { name: "kickoff-deck.key", kind: "slides" },
  { name: "button.tsx", kind: "component" },
  { name: "moodboard.jpg", kind: "image", src: "/composer/attachment-photo.jpg" },
]

/** A selectable row in the branch / project pickers. */
export type ContextOption = {
  id: string
  label: string
  description?: string
}

export const BRANCHES: ContextOption[] = [
  { id: "main", label: "Main", description: "Default branch" },
  { id: "feat/composer-motion", label: "feat/composer-motion", description: "2 commits ahead" },
  { id: "fix/attachment-contrast", label: "fix/attachment-contrast", description: "Updated 3h ago" },
  { id: "release/1.4", label: "release/1.4", description: "Protected" },
]

export const PROJECTS: ContextOption[] = [
  { id: "project-sea", label: "project-sea", description: "~/code/project-sea" },
  { id: "atlas-web", label: "atlas-web", description: "~/code/atlas-web" },
  { id: "orbit-api", label: "orbit-api", description: "~/work/orbit-api" },
  { id: "design-tokens", label: "design-tokens", description: "~/work/design-tokens" },
]

export type PermissionId = "auto" | "manual" | "plan" | "bypass"

export type Permission = {
  id: PermissionId
  title: string
  description: string
}

export const PERMISSIONS: Permission[] = [
  { id: "auto", title: "Auto", description: "Agent decides by itself" },
  { id: "manual", title: "Manual", description: "Always ask before making a change" },
  { id: "plan", title: "Plan mode", description: "Create a plan before proceeding" },
  { id: "bypass", title: "Bypass all", description: "Agent handles permission decisions" },
]

export type ProviderId =
  | "openai"
  | "anthropic"
  | "perplexity"
  | "cursor"
  | "deepseek"
  | "ollama"

export type Model = {
  id: string
  name: string
  /** Whether the model exposes a reasoning-effort setting. */
  supportsEffort?: boolean
}

export type Provider = {
  id: ProviderId
  name: string
  models: Model[]
}

export const PROVIDERS: Provider[] = [
  {
    id: "openai",
    name: "OpenAI",
    models: [
      { id: "gpt-5.6-terra", name: "GPT-5.6 Terra", supportsEffort: true },
      { id: "gpt-5.6-mini", name: "GPT-5.6 Mini", supportsEffort: true },
      { id: "gpt-5.6-sol", name: "GPT-5.6 Sol", supportsEffort: true },
      { id: "gpt-5.5", name: "GPT-5.5", supportsEffort: true },
      { id: "gpt-5.4", name: "GPT-5.4" },
      { id: "gpt-5.4-mini", name: "GPT-5.4 Mini" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    models: [
      { id: "claude-opus-4.5", name: "Claude Opus 4.5", supportsEffort: true },
      { id: "claude-sonnet-4.5", name: "Claude Sonnet 4.5", supportsEffort: true },
      { id: "claude-haiku-4.5", name: "Claude Haiku 4.5" },
    ],
  },
  {
    id: "perplexity",
    name: "Perplexity",
    models: [
      { id: "sonar-pro", name: "Sonar Pro" },
      { id: "sonar-reasoning", name: "Sonar Reasoning", supportsEffort: true },
      { id: "sonar", name: "Sonar" },
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    models: [
      { id: "composer-1", name: "Composer 1" },
      { id: "cursor-small", name: "Cursor Small" },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    models: [
      { id: "deepseek-v3.2", name: "DeepSeek V3.2" },
      { id: "deepseek-r1", name: "DeepSeek R1", supportsEffort: true },
    ],
  },
  {
    id: "ollama",
    name: "Ollama",
    models: [
      { id: "llama-3.3-70b", name: "Llama 3.3 70B" },
      { id: "qwen-3-32b", name: "Qwen 3 32B" },
      { id: "gemma-3-27b", name: "Gemma 3 27B" },
    ],
  },
]

export type Effort = "Low" | "Medium" | "High"

export const EFFORTS: Effort[] = ["Low", "Medium", "High"]

export function findModel(modelId: string): { provider: Provider; model: Model } | undefined {
  for (const provider of PROVIDERS) {
    const model = provider.models.find((m) => m.id === modelId)
    if (model) return { provider, model }
  }
  return undefined
}
