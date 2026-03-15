# HelloDev VSCode MCP Ship Plan

## Progress Snapshot (March 15, 2026)

### Completed
- Extension scaffold created with VSCode command contributions in `package.json`.
- Extension entrypoint added in `src/extension.js` with activate/deactivate lifecycle.
- Runtime state container added in `src/runtime/state.js`.
- Output channel logger added in `src/utils/output.js`.
- Command registration scaffold added in `src/ui/commands.js`.
- MCP host bootstrap seam added in `src/mcp/host.js`.
- Existing `package.json` merge conflict markers resolved.
- Onboarding webview scaffold added in `src/onboarding/OnboardingPanel.js`.
- Notion token capture scaffold added in `src/onboarding/notionAuth.js` (stored in VSCode `secretStorage`).
- `hellodev.openOnboarding` now opens the real onboarding panel.

### In Progress
- Migrating core flows from server-first runtime to extension runtime:
  - `startTask`
  - `completeTask`
  - `viewStatus`
  - `myTasks`

### Next 3 Implementation Slices
1. Add `setupMaintainer.js` scaffold and maintainer path branching in onboarding.
2. Refactor Notion client to read token from runtime state (`secretStorage`) instead of `.env`.
3. Replace `startTask/completeTask/viewStatus/myTasks` placeholder commands with extension-runtime handlers.

## Definition of Done for Foundation Phase
- Extension activates in VSCode and all HelloDev commands are registered.
- No runtime JSON conflicts or broken manifest metadata.
- Extension has a central lifecycle owner for MCP startup/shutdown.
