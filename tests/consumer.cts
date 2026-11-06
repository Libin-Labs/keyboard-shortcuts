import { ShortcutManager, type ShortcutEvent, parseShortcut } from '@lp-labs/keyboard-shortcuts';
const m = new ShortcutManager({ clock: () => 0 });
const event: ShortcutEvent = { key: 'k', ctrlKey: true };
m.handle(event);
parseShortcut('ctrl+k');
// @ts-expect-error event requires key
m.handle({ ctrlKey: true });
// @ts-expect-error explicit clock required
new ShortcutManager({});
