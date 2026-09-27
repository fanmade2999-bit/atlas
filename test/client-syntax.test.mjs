import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('browser clients parse as JavaScript', () => {
  const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8').replace(/^import[^\n]+\n/, '');
  const map = fs.readFileSync(new URL('../public/map.js', import.meta.url), 'utf8');
  const phaser = fs.readFileSync(new URL('../public/phaser-world.js', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new vm.Script(app, { filename: 'public/app.js' }));
  assert.doesNotThrow(() => new vm.Script(map.replace(/^export /gm, ''), { filename: 'public/map.js' }));
  assert.doesNotThrow(() => new vm.Script(phaser, { filename: 'public/phaser-world.js' }));
});
