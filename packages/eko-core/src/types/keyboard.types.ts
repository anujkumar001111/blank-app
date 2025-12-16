/**
 * Types for keyboard input tools
 */

/**
 * Keyboard modifier keys
 */
export type KeyModifier = 'cmd' | 'ctrl' | 'alt' | 'shift' | 'meta';

/**
 * Special keyboard keys (non-character keys)
 */
export type SpecialKey =
  // Current keys (already supported)
  | 'enter'
  | 'tab'
  | 'space'
  | 'backspace'
  | 'delete'
  // Navigation keys (NEW)
  | 'escape'
  | 'home'
  | 'end'
  | 'pageup'
  | 'pagedown'
  | 'insert'
  // Arrow keys (NEW)
  | 'arrowup'
  | 'arrowdown'
  | 'arrowleft'
  | 'arrowright'
  // Function keys (NEW)
  | 'f1'
  | 'f2'
  | 'f3'
  | 'f4'
  | 'f5'
  | 'f6'
  | 'f7'
  | 'f8'
  | 'f9'
  | 'f10'
  | 'f11'
  | 'f12';

/**
 * Key descriptor for hotkey combinations
 * Format: "modifier+modifier+key"
 * Examples: "cmd+c", "ctrl+shift+a", "alt+f4"
 */
export type KeyDescriptor = string;
