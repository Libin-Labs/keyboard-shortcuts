import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as library from '../dist/esm/index.js';
const { parseShortcut, ShortcutManager } = library;

test('parse normalizes aliases and rejects malformed chords', () => {
  const c = parseShortcut('Control+Shift+K cmd+code:KeyX');
  assert.deepEqual(c[0], {
    key: 'k',
    kind: 'key',
    ctrl: true,
    alt: false,
    shift: true,
    meta: false,
  });
  assert.equal(c[1].kind, 'code');
  for (const s of ['', 'ctrl', 'ctrl+ctrl+x', 'ctrl++x', 'x+y'])
    assert.throws(() => parseShortcut(s), SyntaxError);
});
test('key and physical code differ with exact modifiers', () => {
  const m = new ShortcutManager({ clock: () => 0 });
  const out = [];
  m.register('ctrl+k', () => out.push('key'));
  m.register('ctrl+code:KeyK', () => out.push('code'));
  assert.equal(m.handle({ key: 'x', code: 'KeyK', ctrlKey: true }), 1);
  assert.deepEqual(out, ['code']);
  assert.equal(m.handle({ key: 'k', ctrlKey: true, shiftKey: true }), 0);
});
test('sequences timeout mismatch restart and scope reset', () => {
  let time = 0;
  const m = new ShortcutManager({ clock: () => time, sequenceTimeout: 10 });
  let n = 0;
  m.register('g g', () => n++);
  m.handle({ key: 'g' });
  time = 11;
  assert.equal(m.handle({ key: 'g' }), 0);
  time = 12;
  assert.equal(m.handle({ key: 'g' }), 1);
  assert.equal(n, 1);
  m.handle({ key: 'g' });
  m.setScope('modal');
  m.handle({ key: 'g' });
  m.setScope('default');
  assert.equal(m.handle({ key: 'g' }), 0);
});
test('editable composing repeats skipped with explicit opt in', () => {
  const m = new ShortcutManager({ clock: () => 0 });
  m.register('a', () => {});
  assert.equal(m.handle({ key: 'a', target: { tagName: 'INPUT' } }), 0);
  assert.equal(m.handle({ key: 'a', repeat: true }), 0);
  assert.equal(m.handle({ key: 'a', isComposing: true }), 0);
  m.register('a', () => {}, { allowEditable: true, allowRepeat: true });
  assert.equal(m.handle({ key: 'a', target: { isContentEditable: true }, repeat: true }), 1);
});
test('handler failures aggregate and removal is idempotent', () => {
  const m = new ShortcutManager({ clock: () => 0 });
  let last = false;
  const off = m.register('a', () => {
    throw undefined;
  });
  m.register('a', () => {
    last = true;
    throw 'second';
  });
  assert.throws(
    () => m.handle({ key: 'a' }),
    (e) => e instanceof AggregateError && e.errors[0] === undefined && e.errors[1] === 'second',
  );
  assert.equal(last, true);
  off();
  off();
});
test('binding cleanup prevention and no DOM dependency', () => {
  const m = new ShortcutManager({ clock: () => 0 });
  let callback;
  let removed = 0;
  const target = {
    addEventListener(t, fn) {
      assert.equal(t, 'keydown');
      callback = fn;
    },
    removeEventListener(t, fn) {
      assert.equal(fn, callback);
      removed++;
    },
  };
  let prevented = 0;
  m.register('a', () => {}, { preventDefault: true });
  const unbind = m.bind(target);
  callback({ key: 'a', preventDefault: () => prevented++ });
  assert.equal(prevented, 1);
  unbind();
  unbind();
  m.bind(target);
  m.dispose();
  assert.equal(removed, 2);
  assert.throws(() => m.handle({ key: 'a' }), /disposed/);
});
