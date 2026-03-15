# Changelog

## 1.0.0 - 2026-03-16

- Added VSCode extension scaffold and command registration.
- Implemented onboarding for Maintainer and Developer roles.
- Added Notion token storage via VSCode `secretStorage`.
- Implemented maintainer setup for Sprint Board, Activity Logs, Developers databases.
- Added idempotent maintainer setup with duplicate detection and rollback.
- Implemented developer actions: My Tasks, Start Task, View Status, Complete Task.
- Added session persistence in `.hellodev/session.json`.
- Added git hook installer and pending-commit watcher ingestion.
- Added standup generation with preview panel and optional Notion publish.
- Added MCP tools aligned with runtime actions.
