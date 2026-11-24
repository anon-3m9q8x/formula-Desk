const $=id=>document.getElementById(id);
let rows=[[]], platform='Excel',sample=false;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let formats={},calculated={},proposal=null;
let left=0,topRow=1;
function col(i){i+=left;let r='';for(i++;i;i=Math.floor((i-1)/26))r=String.fromCharCode(65+(i-1)%26)+r;return r}
const catalog={SUMIFS:'指定した条件をすべて満たす行の合計',AVERAGEIFS:'指定した条件をすべて満たす行の平均',COUNTIFS:'指定した条件をすべて満たす行の件数',SUM:'数値を合計',SUMIF:'条件に一致する数値を合計',AVERAGE:'数値の平均を計算',AVERAGEIF:'条件に一致する数値の平均を計算',MAX:'最大値を取得',MIN:'最小値を取得',COUNTA:'空白以外のセルを数える',COUNTIF:'条件に一致するセルを数える',UNIQUE:'重複を除いた一覧を表示',FILTER:'条件に一致する行を抽出'};
let selectedRow=0,selectedCol=0;
function selectCell(r,c){
  const grid=$('preview');
  grid.querySelectorAll('.selected,.axis').forEach(el=>el.classList.remove('selected','axis'));
  const cell=grid.querySelector('[data-r="'+r+'"][data-c="'+c+'"]');
  if(!cell)return;
  selectedRow=r;selectedCol=c;
  cell.classList.add('selected');
  cell.parentElement.firstElementChild.classList.add('axis');
  grid.querySelector('thead tr').children[c+1].classList.add('axis');
  $('address').textContent=col(c)+(r+topRow);
  const a=col(c)+(r+topRow);$('value').value=calculated[a]?.formula ?? calculated[a]?.value ?? rows[r]?.[c]??'';
}
function render(){
  const points=Object.keys(calculated).map(point); const width=Math.max(rows[0].length+2,5,...points.map(p=>p.c-left+1)),height=Math.max(11,Math.min(rows.length+1,101),...points.map(p=>p.r-topRow+1));
  const columns=Array.from({length:width},(_,i)=>'<th>'+col(i)+'</th>').join('');
  const body=Array.from({length:height},(_,r)=>{
    const cells=Array.from({length:width},(_,c)=>{
      const value=String(calculated[col(c)+(topRow+r)]?.value ?? rows[r]?.[c]??'');
      const cls=r===0&&c<rows[0].length?'datahead':value.trim()&&Number.isFinite(Number(value.replaceAll(',','')))?'num':'';
      return '<td class="'+cls+'" data-r="'+r+'" data-c="'+c+'">'+'<span class="cell-text" style="'+(formats[col(c)+(r+topRow)]?.bold?'font-weight:bold;':'')+(formats[col(c)+(r+topRow)]?.italic?'font-style:italic;':'')+'">'+esc(value)+'</span></td>';
    }).join('');
    return '<tr><th>'+(r+topRow)+'</th>'+cells+'</tr>';
  }).join('');
  $('preview').innerHTML='<table style="min-width:'+Math.max(480,width*84+40)+'px"><thead><tr><th></th>'+columns+'</tr></thead><tbody>'+body+'</tbody></table>';
  $('size').textContent=(sample?'サンプル · ':'')+(rows.length-1)+' 行 × '+rows[0].length+' 列'+(rows.length>101?'（データは先頭100行まで表示）':'');
  selectCell(0,0);
}
$('preview').onclick=e=>{const cell=e.target.closest('td');if(cell){selectCell(Number(cell.dataset.r),Number(cell.dataset.c));$('preview').focus()}};
$('preview').onkeydown=e=>{const direction={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[e.key];if(direction){e.preventDefault();selectCell(selectedRow+direction[0],selectedCol+direction[1]);$('preview').querySelector('.selected')?.scrollIntoView({block:'nearest',inline:'nearest'})}};
let suggestedGoal="";
function suggest(){proposal=null;$('applyStatus').textContent='';suggestedGoal=$('goal').value;let q=$('goal').value.trim(),h=rows[0],data=rows.slice(1),first=topRow+1,last=topRow+rows.length-1,range=i=>col(i)+first+':'+col(i)+last;let mentioned=h.map((v,i)=>q.includes(columnLabel(i))?i:-1).filter(i=>i>=0),numeric=h.map((_,i)=>data.some(r=>r[i]?.trim())&&data.every(r=>!r[i]?.trim()||Number.isFinite(Number(r[i].replaceAll(',',''))))?i:-1).filter(i=>i>=0);let target=mentioned.find(i=>numeric.includes(i))??numeric[numeric.length-1];let matches=[];for(const r of data)r.forEach((v,i)=>{if(v&&q.includes(v)&&!matches.some(m=>m.i===i&&m.v===v))matches.push({i,v})});matches.sort((a,b)=>b.v.length-a.v.length);let match=matches[0],group=mentioned.find(i=>i!==target)??h.findIndex((name,i)=>name.trim() && !numeric.includes(i)),grouped=/ごと|別に|別の|別で|別売上|別集計/.test(q),conditional=match||grouped,cond=match?.i??group,crit=match?'"'+match.v.replaceAll('"','""')+'"':col(h.length)+first,idx=mentioned[0]??0,fn='',args='',note='';if(/合計|合算|総額|足し/.test(q)){fn=conditional?'SUMIF':'SUM'}else if(/平均/.test(q))fn=conditional?'AVERAGEIF':'AVERAGE';else if(/最大|最高|一番高/.test(q))fn='MAX';else if(/最小|最低|一番低/.test(q))fn='MIN';else if(/件数|数え|カウント|何件|人数/.test(q))fn=conditional?'COUNTIF':'COUNTA';else if(/重複|ユニーク|一意/.test(q))fn='UNIQUE';else if(/抽出|絞り込|取り出/.test(q)&&match)fn='FILTER';
const parsed=questionAggregate(q,h,data,range);
if(parsed){if(parsed.error){$('output').textContent=parsed.error;return}proposal=parsed;showProposal(parsed);return}
if(!data.length){$('output').textContent='データ行を含めて貼り付けると数式を提案できます。';return}
if(!fn||(['SUM','SUMIF','MAX','MIN','AVERAGE','AVERAGEIF'].includes(fn)&&target==null)||(conditional&&cond<0)||((fn==='MAX'||fn==='MIN')&&conditional)){ $('output').innerHTML='<p class="desc">条件を特定できませんでした。表の列名を使って「'+esc(h[target??0])+'の平均」のように入力してください。</p>';return}
if(['SUMIF','AVERAGEIF','COUNTIF','FILTER'].includes(fn)){args=fn==='FILTER'?col(0)+first+':'+col(h.length-1)+last+','+range(cond)+'='+crit:range(cond)+','+crit+(fn==='COUNTIF'?'':','+range(target));note=match?'「'+h[cond]+'」が「'+match.v+'」の行を対象にします。':col(h.length)+first+' に集計したい「'+h[cond]+'」を入力し、その右隣に数式を貼り付けてください。各行に別の条件を入力して使えるよう、参照範囲を固定しています。';if(!match)args=args.replace(/[A-Z]+\d+:[A-Z]+\d+/g,r=>r.replace(/([A-Z]+)(\d+)/g,'$$$1$$$2'))}else{const i=['UNIQUE','COUNTA'].includes(fn)?idx:target;args=range(i);note='「'+columnLabel(i)+'」列の '+args+' を対象にします。'}const formula='='+fn+'('+args+')'; proposal={formula,fn,target,idx,cond,match,crit,note};showProposal(proposal)}
function showProposal({fn,formula,note}){$('output').innerHTML='<p><span class="fn">'+fn+'</span><span class="subtitle">'+catalog[fn]+'</span></p><div class="code"><code>'+esc(formula)+'</code><span class="formula-actions"><button id="useFormula">数式を適用</button><button class="copy" id="copy">コピー</button></span></div><p class="desc">'+esc(note)+' '+platform+' 用'+(platform==='Excel'&&['FILTER','UNIQUE'].includes(fn)?'（Microsoft 365 / Excel 2021 以降）':'')+'</p><p class="desc">正答（「=」不要の解答欄用）: <code>'+esc(formula.replace(/^=/,''))+'</code></p>';$('useFormula').onclick=applyProposal;$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(formula);$('copy').textContent='コピー済み'}catch{const r=document.createRange();r.selectNodeContents(document.querySelector('code'));getSelection().removeAllRanges();getSelection().addRange(r);$('copy').textContent='選択済み · 手動コピー'}}}
function ingest(s){try{const table=readTable(s);checkpoint();formats={};calculated={};rows=table.rows;left=table.left;topRow=table.top;$('origin').value=col(0)+topRow;sample=false;render();resetGridSelection();examples();suggest();return true}catch(e){$('error').textContent=e.message;return false}}
function columnLabel(i){return rows[0][i]?.trim() || col(i)+'列'}
function examples(){if(!rows[0].length){$('chips').replaceChildren();return}const j=rows[0].findIndex((name,i)=>name.trim() && rows.slice(1).some(r=>r[i]?.trim())&&rows.slice(1).every(r=>!r[i]?.trim()||Number.isFinite(Number(r[i].replaceAll(',','')))));const firstNamed=Math.max(0,rows[0].findIndex(name=>name.trim()));const last=columnLabel(j<0?firstNamed:j);$('chips').replaceChildren();for(const [label,q] of [['合計',last+'の合計'],['平均',last+'の平均'],['件数',columnLabel(firstNamed)+'の件数']]){const b=document.createElement('button');b.className='chip';b.textContent=label;b.onclick=()=>{$('goal').value=q;suggest()};$('chips').append(b)}}
$('edit').onclick=()=>{$('raw').value='';$('error').textContent='';$('modal').showModal();$('raw').focus()};$('cancel').onclick=()=>$('modal').close();$('apply').onclick=()=>{if(ingest($('raw').value))$('modal').close()};$('preview').onpaste=e=>{e.preventDefault();const s=e.clipboardData.getData('text/plain');if(!ingest(s)){$('raw').value=s;$('modal').showModal()}};$('run').onclick=suggest;
function showPlatform(name) {
  platform = name;
  for (const [id,label] of [['excel','Excel'], ['google','Google スプレッドシート']]) {
    const selected = label === name;
    $(id).classList.toggle('on',selected);
    $(id).setAttribute('aria-pressed',String(selected));
  }
}
for (const [id,name] of [['excel','Excel'], ['google','Google スプレッドシート']]) {
  $(id).onclick=()=>{ showPlatform(name); suggest(); };
}
for(const id of ['home','dict'])$(id).onclick=()=>{let d=id==='dict';$('work').hidden=d;$('library').hidden=!d;$('platforms').hidden=d;$('title').textContent=d?'関数一覧':'関数ワークベンチ';$('intro').textContent=d?'目的に合わせて使える関数と、その役割を確認できます。':'シートに表を貼り付けて、目的に合った数式を作成。';$('home').classList.toggle('active',!d);$('dict').classList.toggle('active',d)};
render();examples();suggest();

$('origin').onchange=()=>{
  const field=$('origin'), match=/^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(field.value.trim().toUpperCase());
  if(!match){field.value=col(0)+topRow;return}
  if(Object.keys(calculated).length){field.value=col(0)+topRow;$('applyStatus').textContent='数式の参照位置を保持するため、このシートの起点は固定されています。';return} left=columnIndex(match[1]);topRow=Number(match[2]);field.value=col(0)+topRow;render();suggest();
};

const normalizeSearch = text => text.normalize('NFKC').toLowerCase().trim();
const functionRows = Array.from($('fntable').tBodies[0].rows, row => ({
  row, text: normalizeSearch(Array.from(row.cells, cell => cell.textContent).join(' '))
}));
function filterFunctions() {
  const terms = normalizeSearch($('fnsearch').value).split(/\s+/).filter(Boolean);
  const category = $('fncategory').value;
  const software = $('fnsoftware').value;
  let count = 0;
  for (const {row, text} of functionRows) {
    const visible = (!category || row.cells[1].textContent === category) &&
      (!software || row.cells[Number(software)].textContent === '○') &&
      terms.every(term => text.includes(term));
    row.hidden = !visible;
    if (visible) count++;
  }
  $('fncount').textContent = count + ' / ' + functionRows.length + ' 件';
  $('fnempty').hidden = count > 0;
}
$('fnsearch').oninput = filterFunctions;
$('fncategory').onchange = filterFunctions;
$('fnsoftware').onchange = filterFunctions;
if (location.hash === '#functions') $('dict').click();

const sheets = [];
let activeSheet = 0;
let nextSheetNumber = 2;

function captureSheet() {
  return {formats,calculated,rows, left, topRow, platform, sample, selectedRow, selectedCol,
    goal: $('goal').value, suggestedGoal, scrollLeft: $('preview').scrollLeft,
    scrollTop: $('preview').scrollTop};
}
function displaySheet(index) {
  activeSheet = index;
  const sheet = sheets[index];
  ({rows, left, topRow, sample, calculated, formats} = sheet);
  showPlatform(sheet.platform);
  $('origin').value = col(0) + topRow;
  render();
  selectCell(sheet.selectedRow, sheet.selectedCol);
  $('preview').scrollLeft = sheet.scrollLeft;
  $('preview').scrollTop = sheet.scrollTop;
  examples();
  $('goal').value = sheet.suggestedGoal;
  suggest();
  $('goal').value = sheet.goal;
  Array.from($('sheets').children).forEach((tab,i) => tab.firstElementChild.setAttribute('aria-pressed',String(i===index)));
  $('sheets').children[index].firstElementChild.focus();
  resetGridSelection();
}
function appendSheetTab(index) {
  const tab = document.createElement('button');
  tab.textContent = sheets[index].name;
  tab.setAttribute('aria-pressed',String(index===activeSheet));
  tab.onclick = () => { if(index!==activeSheet) switchSheet(index); };
  const group=document.createElement('span'), close=document.createElement('button');
  group.className='sheet-tab';close.className='close-tab';close.textContent='×';
  close.setAttribute('aria-label',sheets[index].name+' を削除');
  close.onclick=()=>requestDelete(index);
  group.append(tab,close);$('sheets').append(group);
}
function switchSheet(index) {
  Object.assign(sheets[activeSheet], captureSheet());
  displaySheet(index);
}
function nextAvailableSheetName(){
  let name;
  do {name='Sheet '+nextSheetNumber++} while(sheets.some(s=>s.name.toLowerCase()===name.toLowerCase()));
  return name;
}
function blankSheet() {
  return {name:nextAvailableSheetName(), formats:{},calculated:{},rows:[[]],left:0,topRow:1,platform,sample:false,
    selectedRow:0,selectedCol:0,goal:'',suggestedGoal:'',scrollLeft:0,scrollTop:0};
}
sheets.push({name:'Sheet 1',...captureSheet()});
appendSheetTab(0);
$('addsheet').onclick = () => {
  const index = sheets.length;
  sheets.push(blankSheet());
  appendSheetTab(index);
  switchSheet(index);
};
let deleteIndex=0;
function requestDelete(index){
  deleteIndex=index;
  const next = sheets.length === 1 ? ' 削除後は空のシートが開きます。' : '';
  $('deleteMessage').textContent = '「'+sheets[index].name+'」を削除しますか？'+next;
  $('deleteDialog').showModal();
};
$('keepSheet').onclick = () => $('deleteDialog').close();
$('confirmDelete').onclick = () => {
  $('deleteDialog').close();
  Object.assign(sheets[activeSheet],captureSheet());
  const keep=sheets[activeSheet];
  sheets.splice(deleteIndex,1);
  if (!sheets.length) sheets.push(blankSheet());
  $('sheets').replaceChildren();
  sheets.forEach((_,index)=>appendSheetTab(index));
  displaySheet(sheets.includes(keep)?sheets.indexOf(keep):Math.min(deleteIndex,sheets.length-1));
};

function calculateProposal(p, criterion) {
  const data=rows.slice(1), numeric=v=>numberCell(v)&&v!=='', num=v=>Number(String(v).replaceAll(',',''));
  const filtered=p.conditions?data.filter(r=>p.conditions.every(c=>String(r[c.col]??'').toLowerCase()===c.value.toLowerCase())):p.fn==='FILTER'||p.fn.endsWith('IF')?data.filter(r=>String(r[p.cond]??'').toLocaleLowerCase()===String(criterion??'').toLocaleLowerCase()):data;
  if(p.fn==='FILTER'){if(!filtered.length)throw Error('一致する行がありません。');return filtered}
  if(p.fn==='UNIQUE')return Array.from(new Set(data.map(r=>r[p.idx]??'')),v=>[v]);
  if(p.fn==='COUNTIF'||p.fn==='COUNTIFS')return [[filtered.length]];
  if(p.fn==='COUNTA')return [[data.filter(r=>r[p.idx]!==''&&r[p.idx]!=null).length]];
  const values=filtered.map(r=>r[p.target]).filter(numeric).map(num);
  if(p.fn.startsWith('AVERAGE')&&!values.length)throw Error('平均を計算する数値がありません。');
  const sum=values.reduce((a,b)=>a+b,0);
  if(p.fn.startsWith('AVERAGE'))return [[sum/values.length]];
  if(p.fn==='MAX'||p.fn==='MIN')return [[values.length?values.reduce((a,b)=>p.fn==='MAX'?Math.max(a,b):Math.min(a,b)):0]];
  return [[sum]];
}
function resultPosition(matrix, reserved) {
  const height=matrix.length, width=Math.max(...matrix.map(line=>line.length));
  const tableWidth=rows[0].length, tableHeight=rows.length;
  const occupied=Object.keys(calculated).map(point);
  if(reserved)occupied.push(point(reserved));
  // Search the first data row to the right, then the rows below the table.
  function find(startCol,startRow,rightSide){
    const lastRow=rightSide?startRow:5000-height;
    for(let y=startRow;y<=lastRow && y+height<=5000;y++){
      let x=startCol;
      while(x+width<=512){
        const hit=occupied.find(p=>p.c>=left+x && p.c<left+x+width && p.r>=topRow+y && p.r<topRow+y+height);
        if(!hit)return {c:left+x,r:topRow+y};
        x=hit.c-left+1;
      }
    }
  }
  const result=find(tableWidth,1,true)||find(0,tableHeight,false);
  if(!result)throw Error('シート内に結果が収まる空き範囲がありません。');
  return result;
}
function applyProposal(){
 try{
  if(!proposal)return;
  let criterion=proposal.match?.v, criterionCell=null;
  if(proposal.fn.endsWith('IF')&&!proposal.match){
    criterionCell=proposal.crit;
    criterion=calculated[criterionCell]?.value??'';
    if(!criterion){criterion=window.prompt(criterionCell+' に入力する「'+columnLabel(proposal.cond)+'」の値');if(criterion===null)return;}
  }
  const matrix=calculateProposal(proposal,criterion);
  const {c,r}=resultPosition(matrix,criterionCell),a=address(c,r);
  const output={};
  for(const [i,line] of matrix.entries())for(const [j,value] of line.entries()){
    const cell=address(c+j,r+i);
    if(c+j-left>511||r+i-topRow>4999)throw Error('結果が表示範囲を超えます。');
    if(cell===criterionCell||calculated[cell]||(c+j<left+rows[0].length&&r+i<topRow+rows.length))throw Error('元の表や計算結果と重なります。表の右側または下の空きセルを指定してください。');
    output[cell]={value,...(i===0&&j===0?{formula:proposal.formula}:{spill:a})};
  }
  if(criterionCell&&!calculated[criterionCell])output[criterionCell]={value:criterion};
  checkpoint();Object.assign(calculated,output);render();selectCell(r-topRow,c-left);resetGridSelection();
  $('preview').querySelector('.selected')?.scrollIntoView({block:'nearest',inline:'nearest'});
  const end=address(c+Math.max(...matrix.map(line=>line.length))-1,r+matrix.length-1);
  $('applyStatus').textContent=(end===a?a:a+' ～ '+end)+' に適用しました。';
 }catch(e){$('applyStatus').textContent=e.message}
};
$('writeBook').onclick=async()=>{
 try{
   Object.assign(sheets[activeSheet],captureSheet());
   const url=URL.createObjectURL(await buildBook(sheets)),link=document.createElement('a');
   link.href=url;link.download='Formula-Desk.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
   $('transferStatus').textContent='全シートを書き出しました。';
 }catch(e){$('transferStatus').textContent=e.message}
};
$('copySheet').onclick=async()=>{
 try{
   const cells=populated(captureSheet());let right=left,bottom=topRow;
   for(const a of cells.keys()){const p=point(a);right=Math.max(right,p.c);bottom=Math.max(bottom,p.r)}
   const lines=Array.from({length:bottom-topRow+1},(_,i)=>Array.from({length:right-left+1},(_,j)=>{
     const cell=cells.get(address(left+j,topRow+i)),value=String(cell?.spill?'':cell?.formula??cell?.value??'');
     return /[\t\n"]/.test(value)?'"'+value.replaceAll('"','""')+'"':value;
   }).join('\t'));
   await navigator.clipboard.writeText(lines.join('\n'));$('transferStatus').textContent=address(left,topRow)+' を選んで貼り付けてください。';
 }catch{$('transferStatus').textContent='コピーできませんでした。.xlsx 書き出しをご利用ください。'}
};
$('readBook').onclick=()=>$('bookFile').click();
$('bookFile').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 try{
   const loaded=await loadBook(await file.arrayBuffer());
   const names=new Set(sheets.map(s=>s.name.toLowerCase()));const start=sheets.length;
   for(const s of loaded){const base=s.name;
     if(names.has(base.toLowerCase()) && loaded.some(sheet=>Object.values(sheet.calculated).some(cell=>cell.formula.includes('!'))))throw Error('シート名が重複し、シート間参照が変わる可能性があります。元のブックで名前を変更してください。');
     let suffix=2;while(names.has(s.name.toLowerCase())){const tail=' ('+suffix+++')';s.name=base.slice(0,31-tail.length)+tail}names.add(s.name.toLowerCase())}

   const originals=loaded.map(s=>s.name);
   for(const s of loaded){sheets.push({...blankSheet(),...s});appendSheetTab(sheets.length-1)}
   switchSheet(start);$('transferStatus').textContent=originals.join('、')+' を読み込みました。';
 }catch(err){$('transferStatus').textContent='読み込みできませんでした。'+err.message}finally{e.target.value=''}
};
