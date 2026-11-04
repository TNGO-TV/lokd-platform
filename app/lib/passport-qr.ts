// ISO/IEC 18004 byte-mode QR, version 5, level L. Fixed-size encoding keeps
// private passport URLs in the browser; no QR service receives their tokens.
export function passportQr(value:string):boolean[][] {
 const bytes=new TextEncoder().encode(value);
 if(bytes.length>106)throw new Error('The passport link is too long for this QR code.');
 const bits:number[]=[];
 const append=(value:number,count:number)=>{for(let i=count-1;i>=0;i--)bits.push((value>>>i)&1);};
 append(4,4);append(bytes.length,8);for(const byte of bytes)append(byte,8);
 append(0,Math.min(4,864-bits.length));while(bits.length%8)bits.push(0);
 const data:number[]=[];for(let i=0;i<bits.length;i+=8)data.push(bits.slice(i,i+8).reduce((a,b)=>(a<<1)|b,0));
 for(let pad=0;data.length<108;pad++)data.push(pad%2?0x11:0xec);
 const multiply=(a:number,b:number)=>{let product=0;for(let i=7;i>=0;i--){product=(product<<1)^((product>>>7)*0x11d);product^=((b>>>i)&1)*a;}return product;};
 const divisor=Array(26).fill(0);divisor[25]=1;let root=1;
 for(let i=0;i<26;i++){for(let j=0;j<26;j++){divisor[j]=multiply(divisor[j],root);if(j+1<26)divisor[j]^=divisor[j+1];}root=multiply(root,2);}
 const remainder=Array(26).fill(0);
 for(const byte of data){const factor=byte^remainder.shift()!;remainder.push(0);for(let j=0;j<26;j++)remainder[j]^=multiply(divisor[j],factor);}
 const codewords=[...data,...remainder],size=37;
 const modules=Array.from({length:size},()=>Array<boolean>(size).fill(false));
 const reserved=Array.from({length:size},()=>Array<boolean>(size).fill(false));
 const set=(x:number,y:number,dark:boolean)=>{modules[y][x]=dark;reserved[y][x]=true;};
 for(let i=0;i<size;i++){set(6,i,i%2===0);set(i,6,i%2===0);}
 for(const [cx,cy] of [[3,3],[size-4,3],[3,size-4]])for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
  const x=cx+dx,y=cy+dy;if(x>=0&&x<size&&y>=0&&y<size){const distance=Math.max(Math.abs(dx),Math.abs(dy));set(x,y,distance!==2&&distance!==4);}
 }
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(30+dx,30+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
 const format=0x77c4; // Level L, mask 0, BCH protected and XOR masked.
 const formatBit=(i:number)=>((format>>>i)&1)!==0;
 for(let i=0;i<=5;i++)set(8,i,formatBit(i));
 set(8,7,formatBit(6));set(8,8,formatBit(7));set(7,8,formatBit(8));
 for(let i=9;i<15;i++)set(14-i,8,formatBit(i));
 for(let i=0;i<8;i++)set(size-1-i,8,formatBit(i));
 for(let i=8;i<15;i++)set(8,size-15+i,formatBit(i));
 set(8,size-8,true);
 let index=0;
 for(let right=size-1;right>=1;right-=2){if(right===6)right=5;for(let vertical=0;vertical<size;vertical++)for(let j=0;j<2;j++){
  const x=right-j,y=((right+1)&2)===0?size-1-vertical:vertical;
  if(!reserved[y][x]){const bit=index<codewords.length*8?((codewords[index>>>3]>>>(7-(index&7)))&1)!==0:false;modules[y][x]=bit!==((x+y)%2===0);index++;}
 }}
 return modules;
}
export function passportQrPath(matrix:boolean[][]){return matrix.flatMap((row,y)=>row.flatMap((dark,x)=>dark?[`M${x+4},${y+4}h1v1h-1z`]:[])).join('');}
