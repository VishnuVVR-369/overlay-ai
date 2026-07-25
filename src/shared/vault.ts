/**
 * The caps the main process enforces when it writes the vault. They live here
 * so the editor can warn before content is silently trimmed on save.
 */
export const VAULT_LIMITS: {
  readonly fieldChars: number
  readonly storyTitleChars: number
  readonly storyBodyChars: number
  readonly storiesMax: number
} = {
  fieldChars: 8000,
  storyTitleChars: 120,
  storyBodyChars: 2000,
  storiesMax: 25,
}
