import test from 'node:test';
import fs from 'node:fs';

function decodePng(file){
  const b=fs.readFileSync(file);
  const w=b.readUInt32BE(16),h=b.readUInt32BE(20),depth=b[24],type=b[25];
  if(depth!==8||type!==6) throw new Error(`${file}: expected 8-bit RGBA PNG, got depth=${depth} type=${type}`);
  let off=8,raw=[];
  while(off<b.length){
    const len=b.readUInt32BE(off),kind=b.toString('ascii',off+4,off+8),data=b.subarray(off+8,off+8+len);
    if(kind==='IDAT')raw.push(data);
    off+=12+len;
  }
  const zlib=(await import('node:zlib')).default;
  const bytes=zlib.inflateSync(Buffer.concat(raw)),stride=w*4,out=Buffer.alloc(h*stride);
  let p=0;
  const pa=(i)=>(i<0?0:out[i]);
  for(let y=0;y<h;y++){
    const filter=bytes[p++],row=y*stride;
    for(let x=0;x<stride;x++){
      const a=x>=4?out[row+x-4]:0,bp=y?out[row-stride+x]:0,cp=(y&&x>=4)?out[row-stride+x-4]:0,v=bytes[p++];
      let val=v;
      if(filter===1)val=(v+a)&255;
      else if(filter===2)val=(v+bp)&255;
      else if(filter===3)val=(v+Math.floor((a+bp)/2))&255;
      else if(filter===4){
        const q=a+bp-cp,pa0=Math.abs(q-a),pb=Math.abs(q-bp),pc=Math.abs(q-cp);
        val=(v+(pa0<=pb&&pa0<=pc?a:pb<=pc?bp:cp))&255;
      } else if(filter!==0)throw new Error('unsupported PNG filter '+filter);
      out[row+x]=val;
    }
  }
  return {w,h,pixels:out};
}
function grid(file){
  const {w,h,pixels}=decodePng(file),cols=w/16,rows=h/16,rowsOut=[];
  for(let gy=0;gy<rows;gy++){
    let line='';
    for(let gx=0;gx<cols;gx++){
      let opaque=0;
      for(let y=gy*16;y<gy*16+16;y++)for(let x=gx*16;x<gx*16+16;x++)if(pixels[y*w*4+x*4+3]>8)opaque++;
      line+=opaque?'##':'..';
    }
    rowsOut.push(line);
  }
  return rowsOut;
}
test('inspect generated sprite-sheet occupancy',async()=>{
  for(const file of [
    'public/assets/objects/nature-atlas.png',
    'public/assets/objects/water-atlas.png',
    'public/assets/characters/player-atlas.png'
  ]){
    console.log('ASSET_GRID '+file);
    console.log(grid(file).join('|'));
  }
});
