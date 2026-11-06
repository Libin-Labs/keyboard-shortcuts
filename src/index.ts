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
export function parseShortcut(input: string): readonly ShortcutChord[] {
  if (!input.trim()) throw new SyntaxError('Empty shortcut');
  return Object.freeze(
    input
      .trim()
      .split(/\s+/u)
      .map((part) => {
        const tokens = part.split('+');
        const modifiers = { ctrl: false, alt: false, shift: false, meta: false };
        let key: string | undefined;
        let kind: 'key' | 'code' = 'key';
        for (const token of tokens) {
          const lower = token.toLowerCase();
          const mod = lower === 'control' ? 'ctrl' : lower === 'cmd' ? 'meta' : lower;
          if (mod === 'ctrl' || mod === 'alt' || mod === 'shift' || mod === 'meta') {
            if (modifiers[mod]) throw new SyntaxError('Duplicate modifier');
            modifiers[mod] = true;
          } else {
            if (key !== undefined || !token)
              throw new SyntaxError('Expected exactly one key per chord');
            kind = lower.startsWith('code:') ? 'code' : 'key';
            key =
              kind === 'code'
                ? token.slice(5).toLowerCase()
                : lower === 'space'
                  ? ' '
                  : lower === 'esc'
                    ? 'escape'
                    : lower;
            if (!key) throw new SyntaxError('Empty key or code');
          }
        }
        if (key === undefined) throw new SyntaxError('Missing key');
        return Object.freeze({ key, kind, ...modifiers });
      }),
  );
}
function editable(target: unknown): boolean {
  if (typeof target !== 'object' || target === null) return false;
  const element = target as {
    tagName?: string;
    isContentEditable?: boolean;
    closest?: (selector: string) => unknown;
  };
  return (
    element.isContentEditable === true ||
    /^(input|textarea|select)$/iu.test(element.tagName ?? '') ||
    (typeof element.closest === 'function' &&
      !!element.closest('[contenteditable="true"], [contenteditable=""]'))
  );
}
function assertSynchronous(result: unknown): void {
  if (
    result !== null &&
    (typeof result === 'object' || typeof result === 'function') &&
    typeof (result as { then?: unknown }).then === 'function'
  ) {
    void Promise.resolve(result).catch(() => {});
    throw new TypeError('Shortcut handlers must be synchronous');
  }
}
interface Registration {
  chords: readonly ShortcutChord[];
  handler: (event: ShortcutEvent) => void;
  options: ShortcutOptions;
  progress: number;
  last: number;
}
export class ShortcutManager {
  private readonly registrations = new Set<Registration>();
  private readonly bindings = new Set<() => void>();
  private readonly clock: () => number;
  private readonly timeout: number;
  private readonly isEditable: (target: unknown) => boolean;
  private lastClock = -Infinity;
  private currentScope = 'default';
  private closed = false;
  constructor(options: ShortcutManagerOptions) {
    this.clock = options.clock;
    this.timeout = options.sequenceTimeout ?? 1000;
    this.isEditable = options.isEditable ?? editable;
    if (!Number.isFinite(this.timeout) || this.timeout < 0)
      throw new RangeError('Invalid sequence timeout');
  }
  get scope(): string {
    return this.currentScope;
  }
  setScope(scope: string): void {
    if (this.closed) throw new Error('Shortcuts disposed');
    if (!scope) throw new RangeError('Empty scope');
    this.currentScope = scope;
    for (const registration of this.registrations) registration.progress = 0;
  }
  register(
    shortcut: string,
    handler: (event: ShortcutEvent) => void,
    options: ShortcutOptions = {},
  ): () => void {
    if (this.closed) throw new Error('Shortcuts disposed');
    if (options.scope === '') throw new RangeError('Empty scope');
    const registration: Registration = {
      chords: parseShortcut(shortcut),
      handler,
      options: { ...options },
      progress: 0,
      last: 0,
    };
    this.registrations.add(registration);
    return () => {
      this.registrations.delete(registration);
    };
  }
  handle(event: ShortcutEvent): number {
    if (this.closed) throw new Error('Shortcuts disposed');
    const now = this.clock();
    if (!Number.isFinite(now) || now < this.lastClock)
      throw new RangeError('Clock must be monotonic milliseconds');
    this.lastClock = now;
    const isInput = this.isEditable(event.target);
    const matches = (chord: ShortcutChord | undefined) =>
      chord !== undefined &&
      chord.key === (chord.kind === 'code' ? (event.code ?? '') : event.key).toLowerCase() &&
      chord.ctrl === !!event.ctrlKey &&
      chord.alt === !!event.altKey &&
      chord.shift === !!event.shiftKey &&
      chord.meta === !!event.metaKey;
    let count = 0;
    const errors: unknown[] = [];
    for (const registration of [...this.registrations]) {
      if (!this.registrations.has(registration)) continue;
      const { options, chords } = registration;
      if (
        (options.scope ?? 'default') !== this.currentScope ||
        event.isComposing ||
        (isInput && !options.allowEditable) ||
        (event.repeat && !options.allowRepeat)
      ) {
        registration.progress = 0;
        continue;
      }
      if (now - registration.last > this.timeout) registration.progress = 0;
      if (matches(chords[registration.progress])) registration.progress++;
      else registration.progress = matches(chords[0]) ? 1 : 0;
      registration.last = now;
      if (registration.progress === chords.length) {
        registration.progress = 0;
        count++;
        try {
          if (options.preventDefault) event.preventDefault?.();
          assertSynchronous(registration.handler(event));
        } catch (error) {
          errors.push(error);
        }
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Shortcut handlers failed');
    return count;
  }
  bind(target: ShortcutTarget): () => void {
    if (this.closed) throw new Error('Shortcuts disposed');
    const listener = (event: ShortcutEvent) => {
      this.handle(event);
    };
    target.addEventListener('keydown', listener);
    let bound = true;
    const unbind = () => {
      if (!bound) return;
      target.removeEventListener('keydown', listener);
      bound = false;
      this.bindings.delete(unbind);
    };
    this.bindings.add(unbind);
    return unbind;
  }
  dispose(): void {
    this.closed = true;
    this.registrations.clear();
    const errors: unknown[] = [];
    for (const unbind of [...this.bindings])
      try {
        unbind();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, 'Shortcut binding cleanup failed');
  }
}
