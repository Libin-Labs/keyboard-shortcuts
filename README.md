# @lp-labs/keyboard-shortcuts

DOM-free event-like shortcut chords and scoped sequences with explicit binding cleanup.

## Install

```sh
npm install @lp-labs/keyboard-shortcuts
```

Zero runtime, peer, or sibling dependencies. Node 18+; strict TypeScript declarations and independent ESM/CommonJS builds. Version 0.1.0, MIT.

## Quickstart

```js
import { ShortcutManager, parseShortcut } from '@lp-labs/keyboard-shortcuts';
let now = 0;
const shortcuts = new ShortcutManager({ clock: () => now, sequenceTimeout: 500 });
const off = shortcuts.register('ctrl+k ctrl+c', () => console.log('comment'));
shortcuts.handle({ key: 'k', ctrlKey: true });
now = 100;
shortcuts.handle({ key: 'c', ctrlKey: true }); // comment
console.log(parseShortcut('meta+code:KeyS'));
off();
shortcuts.dispose();
```

## API and contracts

parseShortcut splits whitespace-delimited sequences and +-delimited chords. Modifier aliases control/ctrl, cmd/meta are case-insensitive; esc means escape and space means a literal space. Use code:KeyK for physical code (case-insensitive comparison), otherwise event.key is used. Exactly one nonmodifier token is required; malformed syntax throws SyntaxError. Literal plus can use code:Equal with shift, not an ambiguous + token. Matching uses exact modifiers; AltGraph is not inferred. ShortcutManager requires monotonic millisecond clock; sequenceTimeout defaults to 1000 inclusive, invalid clocks/timeouts throw RangeError. Mismatch restarts from the first chord; completion resets; no greedy prefix suppression or multi-overlap algorithm. Scope defaults to default, setScope resets partial progress, registration options scope/allowEditable/allowRepeat/preventDefault default to default/false/false/false. Composing events are always skipped; editable targets use input/textarea/select/contenteditable detection, customizable via isEditable. Skipped events reset progress. handle invokes all complete matches and aggregates synchronous failures (including undefined); handlers are synchronous. bind uses a minimal event-like target; pass a browser KeyboardEvent adapter if your target has a different listener signature. Unbind/dispose remove listeners idempotently; failed removals aggregate and may be retried by dispose. No DOM access at import, global hotkey hook, network, or OS interception. O(registrations) work per event and O(chord count) registration storage; caller bounds registration count.

Handlers returning thenables fail explicitly with an aggregated TypeError; internal rejection observation prevents unhandled branches, but asynchronous continuations cannot be stopped.

## Full declarations

The complete public declarations below are generated from the package's strict source. All runtime exports, interfaces, options, return types and readonly state are listed here.

<!-- declarations -->

```ts
export interface ShortcutChord {
  readonly key: string;
  readonly kind: 'key' | 'code';
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  readonly meta: boolean;
}
export interface ShortcutEvent {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  target?: unknown;
  preventDefault?: () => void;
}
export interface ShortcutOptions {
  scope?: string;
  allowEditable?: boolean;
  allowRepeat?: boolean;
  preventDefault?: boolean;
}
export interface ShortcutManagerOptions {
  clock: () => number;
  sequenceTimeout?: number;
  isEditable?: (target: unknown) => boolean;
}
export interface ShortcutTarget {
  addEventListener(type: 'keydown', listener: (event: ShortcutEvent) => void): void;
  removeEventListener(type: 'keydown', listener: (event: ShortcutEvent) => void): void;
}
export declare function parseShortcut(input: string): readonly ShortcutChord[];
export declare class ShortcutManager {
  private readonly registrations;
  private readonly bindings;
  private readonly clock;
  private readonly timeout;
  private readonly isEditable;
  private lastClock;
  private currentScope;
  private closed;
  constructor(options: ShortcutManagerOptions);
  get scope(): string;
  setScope(scope: string): void;
  register(
    shortcut: string,
    handler: (event: ShortcutEvent) => void,
    options?: ShortcutOptions,
  ): () => void;
  handle(event: ShortcutEvent): number;
  bind(target: ShortcutTarget): () => void;
  dispose(): void;
}
```

<!-- end declarations -->

## Development

```sh
npm ci --offline
npm run build
npm run typecheck
npm test
npm run format:check
```

All tests use deterministic clocks, immediate injected sleeps, or explicit promise gates rather than timing guesses. Package exports select ESM for import and CommonJS for require, with separate declaration trees. No runtime configuration files or global hooks.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
