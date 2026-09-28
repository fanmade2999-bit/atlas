import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const files=[
  'public/assets/tiles/terrain-atlas.png',
  'public/assets/objects/nature-atlas.png',
  'public/assets/objects/water-atlas.png',
  'public/assets/characters/player-atlas.png'
];

function pngSize(file){
  const b=fs.readFileSync(file);
  assert.equal(b.readUInt32BE(0),0x89504e47);
  return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),bytes:b.length};
}

test('generated Atlas asset sheets exist and report dimensions',()=>{
  for(const relative of files){
    const file=path.resolve(relative);
    assert.equal(fs.existsSync(file),true,relative);
    const size=pngSize(file);
    console.log(`ASSET_DIMENSIONS ${relative} ${size.width}x${size.height} ${size.bytes} bytes`);
    assert.ok(size.width>0&&size.height>0);
  }
});
