import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
const [a64, c64] = ['ab1-old.png','ab1-new.png'].map(f=>readFileSync('shots/'+f).toString('base64'));
const out = await p.evaluate(async ([a64,c64]) => {
  const load=b64=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src='data:image/png;base64,'+b64;});
  const stat=(img)=>{const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;const x=cv.getContext('2d');x.drawImage(img,0,0);const d=x.getImageData(0,0,img.width,img.height).data;let n=0,b=[1e9,1e9,-1,-1];for(let i=0;i<d.length;i+=4){if(d[i+3]>8){n++;const px=(i/4)%img.width,py=Math.floor(i/4/img.width);if(px<b[0])b[0]=px;if(px>b[2])b[2]=px;if(py<b[1])b[1]=py;if(py>b[3])b[3]=py;}}return{n,b:b[2]<0?null:b};};
  const [ia,ic]=await Promise.all([load(a64),load(c64)]);
  return {old:stat(ia),nw:stat(ic)};
},[a64,c64]);
console.log(JSON.stringify(out));
await b.close();
