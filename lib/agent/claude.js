// Placeholder for the Claude API provider (vision + text). Wired in later.
// Contract: generate({ analysis, imagePath }) -> { tiktok, instagram } (see mock.js for the shape).
export async function generate() {
  throw new Error('The Claude provider is not connected yet. Use AGENT_PROVIDER=mock.');
}
