import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ShortcutManager } from '../dist/esm/index.js';

test('failed binding removal is aggregated and retried on later dispose', () => {
  const shortcuts = new ShortcutManager({ clock: () => 0 });
  let fail = true;
  let removals = 0;
  const target = {
    addEventListener() {},
    removeEventListener() {
      removals++;
      if (fail) throw undefined;
    },
  };
  shortcuts.bind(target);
  assert.throws(
    () => shortcuts.dispose(),
    (error) => error instanceof AggregateError && error.errors[0] === undefined,
  );
  fail = false;
  shortcuts.dispose();
  shortcuts.dispose();
  assert.equal(removals, 2);
});

test('custom editable adapter, scope matching, inclusive sequence deadline', () => {
  let now = 0;
  const shortcuts = new ShortcutManager({
    clock: () => now,
    sequenceTimeout: 10,
    isEditable: (target) => target === 'input',
  });
  let calls = 0;
  shortcuts.register(
    'g h',
    () => {
      calls++;
    },
    { scope: 'editor', allowEditable: true },
  );
  shortcuts.setScope('editor');
  shortcuts.handle({ key: 'g', target: 'input' });
  now = 10;
  assert.equal(shortcuts.handle({ key: 'h', target: 'input' }), 1);
  assert.equal(calls, 1);
  now = 9;
  assert.throws(() => shortcuts.handle({ key: 'h' }), RangeError);
});

test('async handler misuse reports a failure without an unhandled internal rejection', async () => {
  const shortcuts = new ShortcutManager({ clock: () => 0 });
  const unhandled = [];
  const observer = (error) => unhandled.push(error);
  process.on('unhandledRejection', observer);
  try {
    shortcuts.register('a', async () => {
      throw undefined;
    });
    assert.throws(
      () => shortcuts.handle({ key: 'a' }),
      (error) => error instanceof AggregateError && error.errors[0] instanceof TypeError,
    );
    await new Promise(setImmediate);
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', observer);
  }
});
