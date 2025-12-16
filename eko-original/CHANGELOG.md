# Changelog

All notable changes to the Eko project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - System Tools Feature

#### SystemAgent (`@eko-ai/eko-nodejs`)

- **New Agent**: `SystemAgent` - Provides secure shell execution and file system operations for Node.js environments
  - Configurable security options: `workPath`, `enableShellSafety`, `restrictToWorkPath`, `allowedPaths`
  - Default secure configuration prevents path traversal and dangerous commands

#### Shell Execution Tool

- **`shell_exec`** - Execute shell commands with comprehensive security controls
  - Output capture for stdout, stderr, exit code, and execution duration
  - Timeout handling with configurable limit (default: 30 seconds)
  - Security features:
    - Dangerous pattern blocking (rm -rf /, mkfs, fork bombs, etc.)
    - Environment variable injection
    - Working directory control
    - Maximum buffer size limit (10MB default)

#### File Operation Tools

- **`file_read`** - Read file contents as string
  - Path traversal protection via `resolvePath` security module
  - UTF-8 encoding support

- **`file_write`** - Write content to files
  - Automatic parent directory creation
  - Append mode support
  - Path security validation

- **`file_delete`** - Delete files or directories
  - Recursive directory removal
  - Automatic file/directory detection
  - Security-controlled path resolution

- **`file_list`** - List directory contents
  - Returns detailed file metadata (name, path, size, modified date, type)
  - Human-readable file size formatting

- **`file_find`** - Search files using glob patterns
  - Standard glob syntax support: `*`, `**`, `?`, `[abc]`, `{a,b,c}`
  - Returns matching files with full metadata

#### Keyboard Support (`@eko-ai/eko-core`, `@eko-ai/eko-nodejs`, `@eko-ai/eko-electron`)

- **`hotkey`** - Execute keyboard shortcut combinations
  - Support for modifier keys: cmd, ctrl, shift, alt, meta
  - Cross-platform modifier mapping (cmd→Meta on macOS, cmd→Control on Windows/Linux)
  - Multiple key combinations (e.g., "cmd+shift+a")

- **Expanded `press` tool** - Extended keyboard key support from 5 to 27 keys:
  - **Navigation**: arrow_up, arrow_down, arrow_left, arrow_right, home, end, page_up, page_down
  - **Function keys**: f1-f12
  - **Editing**: enter, tab, space, backspace, delete, escape, insert

- **Type definitions**: New `KeyDescriptor`, `SpecialKey`, `KeyModifier` types in `@eko-ai/eko-core/types`

#### Architecture & Security

- **ADR-0001**: Security architecture for system tools with defense-in-depth approach
- **ADR-0002**: Code reuse strategy and type sharing between packages
- **ADR-0003**: Keyboard input implementation pattern across platforms
- Shared security module with `resolvePath` and `formatFileSize` utilities

#### Documentation

- Comprehensive README section for SystemAgent with usage examples
- JSDoc comments for all public APIs with examples
- Security best practices and configuration guidance

#### Testing

- 52 comprehensive tests covering:
  - Shell execution (success, failure, timeout, security blocking)
  - File operations (read, write, delete, list, find with security validation)
  - Keyboard input (hotkey parsing, modifier mapping, extended press keys)
  - SystemAgent integration (tool composition, context passing)

---

## [4.0.5] - 2025-11

### Added
- Eko 4.0 supports chat conversations & optimizes agent logic

### Changed
- Monorepo tooling migrated to pnpm for consistent workspace management

## [3.0.0] - 2025-09

### Added
- Dependency-aware parallel agent execution
- New pause, resume, and interrupt controls
- `task_snapshot` workflow recovery

---

[Unreleased]: https://github.com/FellouAI/eko/compare/v4.0.5...HEAD
[4.0.5]: https://github.com/FellouAI/eko/releases/tag/v4.0.5
[3.0.0]: https://github.com/FellouAI/eko/releases/tag/v3.0.0
