import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';

function decode(file){
  const b=fs.readFileSync(file);
  const w=b.readUInt32BE(16), h=b.readUInt32BE(20), bit=b[24], ct=b[25];
  assert.equal(bit,8); assert.equal(ct,6);
  let o=8, chunks=[];
  while(o<b.length){
    const n=b.readUInt32BE(o), type=b.toString('ascii',o+4,o+8);
    if(type==='IDAT') chunks.push(b.subarray(o+8,o+8+n));
    o += 12+n;
  }
  const raw=zlib.inflateSync(Buffer.concat(chunks)), stride=w*4, out=Buffer.alloc(w*h*4);
  let prev=Buffer.alloc(stride), pos=0;
  const paeth=(a,b,c)=>{const q=a+b-c,pa=Math.abs(q-a),pb=Math.abs(q-b),pc=Math.abs(q-c);return pa<=pb? a:pb<=pc? b:c};
  for(let y=0;y<h;y++){
    const f=raw[pos++], row=Buffer.alloc(stride);
    for(let x=0;x<stride;x++){
      const a=x>=4?row[x-4]:0,b=prev[x]||0,c=x>=4?prev[x-4]||0:0,v=raw[pos++];
      row[x]=f===0?v:f===1?(v+a)&255:f===2?(v+b)&255:f===3?(v+Math.floor((a+b)/2))&255:f===4?(v+paeth(a,b,c))&255:v;
    }
    row.copy(out,y*stride); prev=row;
  }
  return {w,h,out};
}

function cells(file){
  const d=decode(file), cols=d.w/16, rows=d.h/16, s=[];
  for(let r=0;r<rows;r++) for(let col=0;col<cols;col++){
    let opaque=0, nonzero=0, blue=0, green=0;
    for(let y=0;y<16;y++) for(let x=0;x<16;x++){
      const i=((r*16+y)*d.w+(col*16+x))*4, a=d.out[i+3];
      nonzero += a>0; opaque += a===255;
      const rr=d.out[i], gg=d.out[i+1], bb=d.out[i+2];
      if(bb>rr+20 && bb>=gg-5) blue++;
      if(gg>rr+10 && gg>=bb-10) green++;
    }
    s.push({col,row:r,opaquePct:Math.round(opaque/2.56),alphaPct:Math.round(nonzero/2.56),blue,green});
  }
  return s;
}

test('atlas-frame-diagnostic',()=>{
  for(const file of ['public/assets/objects/water-atlas.png','public/assets/tiles/terrain-atlas.png']){
    console.log('ATLAS_FRAMES',file,JSON.stringify(cells(file)));
  }
  assert.ok(true);
});
