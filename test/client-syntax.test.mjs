import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('browser clients parse as JavaScript', () => {
  const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8').replace(/^import[^\n]+\n/, '');
  const map = fs.readFileSync(new URL('../public/map.js', import.meta.url), 'utf8');
  const phaser = fs.readFileSync(new URL('../public/phaser-world.js', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../public/observer.html', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new vm.Script(app, { filename: 'public/app.js' }));
  assert.match(html, /id="game-panel"/);
  assert.match(html, /id="game-vision"/);
  assert.match(html, /id="info-panel"/);
  assert.equal(/id="game-info"/.test(html), false);
  assert.equal(/data-action="a"/.test(html), false);
  assert.equal(/data-action="b"/.test(html), false);
  assert.equal(/action\(['"]a['"]\)/.test(app), false);
  assert.equal(/action\(['"]b['"]\)/.test(app), false);
  assert.doesNotThrow(() => new vm.Script(map.replace(/^export /gm, ''), { filename: 'public/map.js' }));
  assert.match(app, /const MOVE_REPEAT_MS=125/);
  assert.match(app, /pointerdown/);
  assert.match(app, /document\.onkeyup/);
  assert.match(app, /activeHeldDirection/);
  assert.match(app, /holdDirection\('gamepad',gamepadDirection\)/);
  assert.match(phaser, /visualPlayer/);
  assert.match(phaser, /cameraTarget/);
    assert.doesNotThrow(() => new vm.Script(phaser, { filename: 'public/phaser-world.js' }));
});
