const histories=new WeakMap(), grid=$('preview'), bar=$('value');
let anchorR=selectedRow,anchorC=selectedCol,dragging=false;
function historyForSheet(){
 const sheet=sheets[activeSheet];
 if(!histories.has(sheet))histories.set(sheet,{past:[],future:[]});
 return histories.get(sheet);
}
function snapshot(){return structuredClone({formats,rows,calculated,left,topRow,sample,selectedRow,selectedCol})}
function checkpoint(){
 const h=historyForSheet();h.past.push(snapshot());if(h.past.length>25)h.past.shift();h.future=[];
}
function resetGridSelection(){anchorR=selectedRow;anchorC=selectedCol;$('gridMessage').textContent=''}
function refreshGrid(r,c){
 render();selectCell(r,c);resetGridSelection();examples();suggest();$('origin').value=col(0)+topRow;
}
function stepHistory(reverse){
 const h=historyForSheet(),from=reverse?h.future:h.past,to=reverse?h.past:h.future;
 if(!from.length)return;
 to.push(snapshot());const state=from.pop();({formats,rows,calculated,left,topRow,sample}=state);
 refreshGrid(state.selectedRow,state.selectedCol);
}
function rect(){return [Math.min(anchorR,selectedRow),Math.min(anchorC,selectedCol),Math.max(anchorR,selectedRow),Math.max(anchorC,selectedCol)]}
function mark(r,c,extend){
 if(!grid.querySelector('[data-r="'+r+'"][data-c="'+c+'"]'))return;
 selectCell(r,c);if(!extend){anchorR=r;anchorC=c}
 const [t,l,b,end]=rect();
 for(const td of grid.querySelectorAll('td'))td.classList.toggle('range',td.dataset.r>=t&&td.dataset.r<=b&&td.dataset.c>=l&&td.dataset.c<=end);
 $('address').textContent=col(l)+(t+topRow)+(t!==b||l!==end?' : '+col(end)+(topRow+b):'');
}
function raw(r,c){const cell=calculated[col(c)+(topRow+r)];return String(cell?.formula??cell?.value??rows[r]?.[c]??'')}
function recalculate(){
 const done=new Set(),visiting=new Set();
 for(const [a,v] of Object.entries(calculated))if(v.spill)delete calculated[a];
 function get(a){
  a=a.replaceAll('$','').toUpperCase();const p=point(a), cell=calculated[a];
  if(!cell)return rows[p.r-topRow]?.[p.c-left]??'';
  if(!cell.formula||done.has(a))return cell.value;
  if(visiting.has(a))throw Error('#CIRC!');
  visiting.add(a);
  try{
   const matrix=evaluateCell(cell.formula,get);
   if(matrix){const spill=[];matrix.forEach((line,i)=>line.forEach((value,j)=>{
     if(i||j){const target=address(p.c+j,p.r+i);if(calculated[target]||rows[p.r-topRow+i]?.[p.c-left+j])throw Error('#SPILL!');spill.push([target,{value,spill:a}])}
   }));Object.assign(calculated,Object.fromEntries(spill));cell.value=matrix[0][0]}
  }catch(e){cell.value=e.message}
  visiting.delete(a);done.add(a);return cell.value;
 }
 for(const a of Object.keys(calculated))get(a);
}
function evaluateCell(formula,get){
 const expr=formula.slice(1).replace(/^_xlfn\.(?:_xlws\.)?/i,'').trim();
 const fn=/^(\w+)\((.*)\)$/s.exec(expr);
 const scalar=s=>/^"/.test(s)?s.slice(1,-1).replaceAll('""','"'):get(s);
 function range(s){
  const [start,end=start]=s.replaceAll('$','').toUpperCase().split(':').map(point);
  if((end.r-start.r+1)*(end.c-start.c+1)>200000||end.r<start.r||end.c<start.c)throw Error('#REF!');
  return Array.from({length:end.r-start.r+1},(_,i)=>Array.from({length:end.c-start.c+1},(_,j)=>get(address(start.c+j,start.r+i))));
 }
 if(fn&&Object.hasOwn(catalog,fn[1].toUpperCase())){
  const name=fn[1].toUpperCase(),args=fn[2].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(s=>s.trim());let data=range(args[0]);
  if(['SUMIFS','AVERAGEIFS','COUNTIFS'].includes(name)){
   const offset=name==='COUNTIFS'?0:1;
   if(args.length<=offset||(args.length-offset)%2)throw Error('#VALUE!');
   const masks=[];
   for(let i=offset;i<args.length;i+=2){
    const cells=range(args[i]).flat(), expected=String(scalar(args[i+1])).toLowerCase();
    if(cells.length!==data.flat().length)throw Error('#VALUE!');
    masks.push(cells.map(cell=>String(cell).toLowerCase()===expected));
   }
   const values=data.flat().filter((_,i)=>masks.every(mask=>mask[i]));
   if(name==='COUNTIFS')return [[values.length]];
   data=[values];
  }
  if(name==='FILTER'){const m=/^([^=]+)=(.+)$/.exec(args[1]);if(!m)throw Error('#VALUE!');const cond=range(m[1]),v=scalar(m[2]);data=data.filter((_,i)=>String(cond[i]?.[0]).toLowerCase()===String(v).toLowerCase());if(!data.length)throw Error('#CALC!');return data}
  if(name==='UNIQUE')return [...new Map(data.map(row=>[JSON.stringify(row),row])).values()];
  if(name.endsWith('IF')){const v=String(scalar(args[1])).toLowerCase(),values=args[2]?range(args[2]):data;data=values.filter((_,i)=>String(data[i]?.[0]).toLowerCase()===v);if(name==='COUNTIF')return [[data.length]]}
  const flat=data.flat();if(name==='COUNTA')return [[flat.filter(v=>v!=='').length]];
  const error=flat.find(v=>typeof v==='string'&&/^#(?:CIRC|DIV|VALUE|REF|SPILL|CALC)/.test(v));if(error)throw Error(error);
  const nums=flat.filter(numberCell).map(v=>Number(String(v).replaceAll(',',''))),sum=nums.reduce((a,b)=>a+b,0);
  if(name.startsWith('AVERAGE')){if(!nums.length)throw Error('#DIV/0!');return [[sum/nums.length]]}
  if(name==='MIN'||name==='MAX')return [[nums.length?nums.reduce(name==='MIN'?(a,b)=>Math.min(a,b):(a,b)=>Math.max(a,b)):0]];
  return [[sum]];
 }
 if(fn)return null;
 const tokens=expr.toUpperCase().replace(/\s/g,'').match(/\$?[A-Z]+\$?\d+|(?:\d+\.?\d*|\.\d+)|[()+*/-]/g)||[];
 if(tokens.join('')!==expr.toUpperCase().replace(/\s/g,''))throw Error('#VALUE!');
 let i=0;
 function atom(){const t=tokens[i++];if(t==='-')return -atom();if(t==='+')return atom();if(t==='('){const n=add();if(tokens[i++]!==')')throw Error('#VALUE!');return n}
 if(!t||!/[\d]$/.test(t))throw Error('#VALUE!');const v=/[A-Z]/.test(t)?get(t):t;if(String(v).startsWith('#'))throw Error(v);const n=Number(String(v).replaceAll(',',''));if(!Number.isFinite(n))throw Error('#VALUE!');return n}
 function mul(){let n=atom();while(['*','/'].includes(tokens[i])){const op=tokens[i++],b=atom();if(op==='/'&&!b)throw Error('#DIV/0!');n=op==='*'?n*b:n/b}return n}
 function add(){let n=mul();while(['+','-'].includes(tokens[i])){const op=tokens[i++],b=mul();n=op==='+'?n+b:n-b}return n}
 const n=add();if(i!==tokens.length)throw Error('#VALUE!');return [[n]];
}
function writeCells(r,c,matrix,options={}){
 const w=matrix.reduce((n,line)=>Math.max(n,line.length),0);
 const width=Math.max(rows[0].length,c+w), height=Math.max(rows.length,r+matrix.length);
 if(width>512||height>5000||width*height>200000){$('gridMessage').textContent='編集範囲は5,000行・512列・20万セル以内です。';return}
 for(const [i,line] of matrix.entries())for(const [j] of line.entries()){
  const spill=calculated[col(c+j)+(topRow+r+i)]?.spill;if(spill){const p=point(spill);if(p.r<topRow+r||p.c<left+c||p.r>=topRow+r+matrix.length||p.c>=left+c+w){$('gridMessage').textContent='配列数式は先頭セルから編集してください。';return}}
 }
 checkpoint();
 if(options.clear){const [t,l,b,e]=options.clear;for(let y=t;y<=b;y++)for(let x=l;x<=e;x++){const a=col(x)+(topRow+y);delete calculated[a];delete formats[a];if(rows[y]&&x<rows[y].length)rows[y][x]=''}}
 for(let i=0;i<height;i++){rows[i]??=[];while(rows[i].length<width)rows[i].push('')}
 matrix.forEach((line,i)=>line.forEach((v,j)=>{const a=col(c+j)+(topRow+r+i);delete calculated[a];if(options.styles){const style=options.styles[i]?.[j];if(style)formats[a]={...style};else delete formats[a]}const formula=!options.literal&&v.startsWith('=');rows[r+i][c+j]=formula?'':v;if(formula)calculated[a]={formula:v,value:'#NAME?'}}));
 sample=false;recalculate();refreshGrid(r,c);return true;
}
function clearSelection(){const [t,l,b,e]=rect();writeCells(t,l,Array.from({length:b-t+1},()=>Array(e-l+1).fill('')))}
grid.onclick=null;
grid.onpointerdown=e=>{const td=e.target.closest('td');if(!td||e.button!==0)return;mark(+td.dataset.r,+td.dataset.c,e.shiftKey);dragging=true;grid.focus()};
grid.onpointerover=e=>{const td=e.target.closest('td');if(td&&dragging&&e.buttons===1)mark(+td.dataset.r,+td.dataset.c,true)};
window.addEventListener('pointerup',()=>dragging=false);
grid.ondblclick=()=>{bar.focus();bar.select()};
bar.onchange=()=>{if(bar.value!==raw(selectedRow,selectedCol))writeCells(selectedRow,selectedCol,[[bar.value]])};
bar.onkeydown=e=>{if(e.isComposing)return;if(e.key==='Escape'){bar.value=raw(selectedRow,selectedCol);grid.focus()}if(e.key==='Enter'){e.preventDefault();bar.blur();grid.focus()}};
grid.onkeydown=e=>{
 if(e.isComposing)return;
 if(e.ctrlKey||e.metaKey){if(e.key.toLowerCase()==='z'||e.key.toLowerCase()==='y'){e.preventDefault();stepHistory(e.shiftKey||e.key.toLowerCase()==='y')}return}
 const moves={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1],Tab:[0,e.shiftKey?-1:1],Enter:[e.shiftKey?-1:1,0]};
 if(moves[e.key]){e.preventDefault();const [dr,dc]=moves[e.key];mark(selectedRow+dr,selectedCol+dc,e.shiftKey&&e.key.startsWith('Arrow'));grid.querySelector('.selected')?.scrollIntoView({block:'nearest',inline:'nearest'});return}
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();clearSelection()}else if(e.key==='F2'){e.preventDefault();bar.focus();bar.select()}else if(e.key.length===1&&!e.altKey){e.preventDefault();bar.focus();bar.value=e.key}
};
$('undoCell').onclick=()=>stepHistory(false);$('redoCell').onclick=()=>stepHistory(true);$('clearCells').onclick=clearSelection;

function shiftFormula(v,dr,dc){
 if(!v.startsWith('='))return v;
 return v.replace(/"(?:[^"]|"")*"|(?<![A-Z0-9_.])(\$?)([A-Z]{1,3})(\$?)([1-9]\d*)(?![A-Z0-9_(])/gi,(token,ac,letter,ar,n)=>{
  if(token.startsWith('"'))return token;
  const c=columnIndex(letter.toUpperCase())+(ac?0:dc),r=Number(n)+(ar?0:dr);
  return c<0||r<1?'#REF!':ac+letters(c)+ar+r;
 });
}
function captureRange(bounds){
 const [t,l,b,e]=bounds, data=[],values=[],styles=[];
 for(let r=t;r<=b;r++){
  const d=[],v=[],s=[];for(let c=l;c<=e;c++){
   const a=col(c)+(topRow+r);d.push(raw(r,c));v.push(String(calculated[a]?.value??rows[r]?.[c]??''));s.push(formats[a]||null);
  }data.push(d);values.push(v);styles.push(s);
 }
 return {data,values,styles,r:topRow+t,c:left+l};
}
function styleRange(key){
 const bounds=rect(),[t,l,b,e]=bounds,enable=!formats[col(l)+(t+topRow)]?.[key];
 checkpoint();for(let r=t;r<=b;r++)for(let c=l;c<=e;c++){const a=col(c)+(r+topRow);formats[a]={...formats[a],[key]:enable}}
 refreshGrid(t,l);mark(b,e,true);
}
$('boldCell').onclick=()=>styleRange('bold');$('italicCell').onclick=()=>styleRange('italic');
let clip=null,valuesNext=false;
const clipType='application/x-formuladesk-selection';
function copyRange(e,cut){
 const [t,l,b,end]=rect(), pack=captureRange(rect());
 const text=pack.data.map(row=>row.map(v=>/[\n\t"]/.test(v)?'"'+v.replaceAll('"','""')+'"':v).join('\t')).join('\n');
 const token=crypto.randomUUID();
 e.clipboardData.setData('text/plain',text);e.clipboardData.setData(clipType,token);e.preventDefault();
 clip={...pack,cut,token,text};
 if(cut){const blanks=pack.data.map(row=>row.map(()=>''));if(!writeCells(t,l,blanks,{styles:blanks}))clip.cut=false}
}
grid.oncopy=e=>copyRange(e,false);grid.oncut=e=>copyRange(e,true);
function pasteRange(text,pack,valuesOnly){
 const [r,c]=rect();
 if(pack){const matrix=valuesOnly?pack.values:pack.data.map(row=>row.map(v=>pack.cut?v:shiftFormula(v,r+topRow-pack.r,c+left-pack.c)));
  writeCells(r,c,matrix,valuesOnly?{literal:true}:{styles:pack.styles});return}
 const s=text.replace(/\r\n?/g,'\n').replace(/\n$/,'');
 // A range copied with column letters or row numbers is placed at its original cells.
 if(!valuesOnly&&s.includes('\n')){let table=null;try{table=readTable(s)}catch{}if(table?.positioned){ingest(s);resetGridSelection();return}}
 if(!valuesOnly&&/^\s*\|/.test(s)&&s.includes('\n')&&/^\s*\|?[ :-]*-{2}/.test(s.split('\n')[1])){ingest(s);resetGridSelection();return}
 writeCells(r,c,readDelimited(s,'\t'),{literal:valuesOnly});
}
grid.addEventListener('keydown',e=>{valuesNext=(e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='v'});
grid.onpaste=e=>{e.preventDefault();const t=e.clipboardData.getData('text/plain'),token=e.clipboardData.getData(clipType);try{pasteRange(t,clip&&(token===clip.token||(!token&&valuesNext&&t===clip.text))?clip:null,valuesNext)}catch(err){$('gridMessage').textContent=err.message}finally{valuesNext=false}};
$('pasteValues').onclick=async()=>{try{const t=await navigator.clipboard.readText();pasteRange(t,clip?.text===t?clip:null,true)}catch{if(clip)pasteRange(clip.text,clip,true);else $('gridMessage').textContent='セルを選び、Ctrl／⌘＋Shift＋V で値を貼り付けてください。'}};
const mod=(n,m)=>(n%m+m)%m;
function seriesValue(seed,k){
 const v=seed[mod(k,seed.length)];
 const day=/^(日|月|火|水|木|金|土)(曜日|曜)?$/,week='日月火水木金土';
 if(seed.every(s=>day.test(s))){const first=seed[0].match(day),step=seed.length>1?week.indexOf(seed[1][0])-week.indexOf(first[1]):1;return week[mod(week.indexOf(first[1])+step*k,7)]+(first[2]||'')}
 const dates=seed.map(s=>/^(\d{4})([-/])(\d{1,2})\2(\d{1,2})$/.exec(s));
 if(dates.every(Boolean)){const days=dates.map(m=>Date.UTC(+m[1],+m[3]-1,+m[4])/86400000),d=new Date((days[0]+k*(days.length>1?days[1]-days[0]:1))*86400000),m=dates[0];return [d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(m[3].length,'0'),String(d.getUTCDate()).padStart(m[4].length,'0')].join(m[2])}
 if(seed.length>1&&seed.every(s=>s.trim()!==''&&Number.isFinite(Number(s))))return String(Number(seed[0])+k*(Number(seed[1])-Number(seed[0])));
 return v;
}
function fillArea(box,r,c){
 const [t,l,b,e]=box,dy=r<t?r-t:r>b?r-b:0,dx=c<l?c-l:c>e?c-e:0;
 if(!dy&&!dx)return null;
 if(Math.abs(dy)>=Math.abs(dx))return {vertical:true,t:dy<0?r:b+1,b:dy<0?t-1:r,l,e,tipR:r,tipC:Math.min(e,Math.max(l,c))};
 return {vertical:false,t,b,l:dx<0?c:e+1,e:dx<0?l-1:c,tipR:Math.min(b,Math.max(t,r)),tipC:c};
}
function fillEntry(box,pack,area,y,x){
 const [t,l,b,e]=box,sy=mod(y-t,b-t+1),sx=mod(x-l,e-l+1);
 const seed=area.vertical?pack.data.map(row=>row[sx]):pack.data[sy];
 return {value:shiftFormula(seriesValue(seed,area.vertical?y-t:x-l),y-t-sy,x-l-sx),style:pack.styles[sy][sx]};
}
function fillTo(box,r,c,pack=captureRange(box)){
 const area=fillArea(box,r,c);if(!area)return;
 const data=[],styles=[];
 for(let y=area.t;y<=area.b;y++){
  const line=[],style=[];
  for(let x=area.l;x<=area.e;x++){const cell=fillEntry(box,pack,area,y,x);line.push(cell.value);style.push(cell.style)}
  data.push(line);styles.push(style);
 }
 writeCells(area.t,area.l,data,{styles});
}
function moveTo(box,r,c){
 const [t,l]=box;if(r===t&&c===l)return;
 const pack=captureRange(box);
 writeCells(r,c,pack.data,{clear:box,styles:pack.styles});
}
function paintHandles(){
 const [t,l,b,e]=rect();
 for(const el of grid.querySelectorAll('.grip'))el.remove();
 for(const td of grid.querySelectorAll('td')){
  const r=Number(td.dataset.r),c=Number(td.dataset.c);if(r<t||r>b||c<l||c>e)continue;
  const edges=[];if(r===t)edges.push('north');if(r===b)edges.push('south');if(c===l)edges.push('west');if(c===e)edges.push('east');if(r===b&&c===e)edges.push('fill');
  for(const edge of edges){const span=document.createElement('span');span.className='grip '+edge;span.dataset.action=edge==='fill'?'fill':'move';span.title=edge==='fill'?'オートフィル':'選択範囲を移動';td.append(span)}
 }
}
let repaint=0;
function scheduleHandles(){cancelAnimationFrame(repaint);repaint=requestAnimationFrame(paintHandles)}
new MutationObserver(changes=>{if(changes.some(m=>m.type==='attributes'||Array.from(m.addedNodes).some(n=>n.nodeName==='TABLE')))scheduleHandles()}).observe(grid,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
paintHandles();
const ghost=document.createElement('div'), outline=document.createElement('div'), hint=document.createElement('div');
ghost.className='fill-ghost';outline.className='fill-outline';hint.className='fill-hint';
ghost.append(outline);ghost.hidden=true;hint.hidden=true;document.body.append(ghost,hint);
let gesture=null,frame=0;

function stopGesture(){
 cancelAnimationFrame(frame);frame=0;gesture=null;ghost.hidden=true;hint.hidden=true;
 document.documentElement.classList.remove('filling-cells');
}
function dragCell(x,y){return document.elementFromPoint(x,y)?.closest('#preview td')}
function previewFill(){
 frame=0;const g=gesture;if(!g||g.type!=='fill')return;
 const bounds=grid.getBoundingClientRect(),x=g.x,y=g.y;
 const head=grid.querySelector('thead').getBoundingClientRect();
 const cellX=Math.max(bounds.left+2,Math.min(bounds.right-4,x)),cellY=Math.max(head.bottom+2,Math.min(bounds.bottom-4,y));
 const td=dragCell(cellX,cellY);
 if(td){
  const r=+td.dataset.r,c=+td.dataset.c,area=fillArea(g.box,r,c);
  if(area){
   const body=td.parentNode.parentNode,first=body.rows[area.t].cells[area.l+1],last=body.rows[area.b].cells[area.e+1];
   const start=first.getBoundingClientRect(),end=last.getBoundingClientRect();
   const clipTop=Math.max(bounds.top,head.bottom);
   Object.assign(ghost.style,{left:bounds.left+'px',top:clipTop+'px',width:grid.clientWidth+'px',height:Math.max(0,bounds.top+grid.clientHeight-clipTop)+'px'});
   Object.assign(outline.style,{left:(start.left-bounds.left)+'px',top:(start.top-clipTop)+'px',width:(end.right-start.left)+'px',height:(end.bottom-start.top)+'px'});
   if(r!==g.lastR||c!==g.lastC){
    const v=fillEntry(g.box,g.pack,area,area.tipR,area.tipC).value;
    hint.textContent=col(area.tipC)+(area.tipR+topRow)+'　'+(v||'（空欄）');
   }
   ghost.hidden=false;hint.hidden=false;
   hint.style.left=Math.max(4,Math.min(innerWidth-hint.offsetWidth-4,x+14))+'px';
   hint.style.top=Math.max(4,y+30>innerHeight-8?y-32:y+16)+'px';
  }else{ghost.hidden=true;hint.hidden=true}
  g.lastR=r;g.lastC=c;
 }
 const dx=x>bounds.right-16?12:x<bounds.left+16?-12:0,dy=y>bounds.bottom-16?10:y<bounds.top+16?-10:0;
 if(dx||dy){const ox=grid.scrollLeft,oy=grid.scrollTop;grid.scrollBy(dx,dy);if(ox!==grid.scrollLeft||oy!==grid.scrollTop)frame=requestAnimationFrame(previewFill)}
}
grid.addEventListener('pointerdown',e=>{
 const handle=e.target.closest('.grip');if(!handle||e.button!==0||gesture)return;
 const td=handle.closest('td'),box=rect();
 gesture={box,type:handle.dataset.action,r:+td.dataset.r,c:+td.dataset.c,id:e.pointerId,x:e.clientX,y:e.clientY};
 if(gesture.type==='fill'){gesture.pack=captureRange(box);document.documentElement.classList.add('filling-cells')}
 e.stopImmediatePropagation();e.preventDefault();grid.focus();grid.setPointerCapture(e.pointerId);
},true);
grid.addEventListener('pointermove',e=>{
 if(!gesture||gesture.id!==e.pointerId)return;
 gesture.x=e.clientX;gesture.y=e.clientY;
 if(gesture.type==='fill'){if(!frame)frame=requestAnimationFrame(previewFill);return}
 const td=dragCell(e.clientX,e.clientY);if(td)$('gridMessage').textContent='移動：'+col(+td.dataset.c)+(topRow+Number(td.dataset.r));
});
grid.addEventListener('pointerup',e=>{
 if(!gesture||gesture.id!==e.pointerId)return;
 const g=gesture,td=dragCell(e.clientX,e.clientY);stopGesture();
 if(!td&&!(g.type==='fill'&&g.lastR!=null))return;
 const r=td?+td.dataset.r:g.lastR,c=td?+td.dataset.c:g.lastC;
 if(g.type==='fill')fillTo(g.box,r,c,g.pack);else moveTo(g.box,Math.max(0,g.box[0]+r-g.r),Math.max(0,g.box[1]+c-g.c));
});
grid.addEventListener('lostpointercapture',stopGesture);
grid.addEventListener('pointercancel',stopGesture);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&gesture){const id=gesture.id;stopGesture();if(grid.hasPointerCapture(id))grid.releasePointerCapture(id)}});
