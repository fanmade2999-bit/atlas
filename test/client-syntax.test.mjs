import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('browser client parses as JavaScript', () => {
  const source = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8').replace(/^import[^\n]+\n/, '');
  assert.doesNotThrow(() => new vm.Script(source, { filename: 'public/app.js' }));
});
