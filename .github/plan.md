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

### In Progress
- Migrating core flows from server-first runtime to extension runtime:
  - `startTask`
  - `completeTask`
  - `viewStatus`
  - `myTasks`

### Next 3 Implementation Slices
1. Onboarding + role picker webview scaffold (`src/onboarding/OnboardingPanel.js`).
2. Notion auth service scaffold with VSCode `secretStorage` (`src/onboarding/notionAuth.js`).
3. Replace placeholder command handlers with real task/session wiring.

## Definition of Done for Foundation Phase
- Extension activates in VSCode and all HelloDev commands are registered.
- No runtime JSON conflicts or broken manifest metadata.
- Extension has a central lifecycle owner for MCP startup/shutdown.
