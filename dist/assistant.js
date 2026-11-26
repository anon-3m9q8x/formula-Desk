/* Formula Desk 関数アシスタント
 * 要望文+表 → 構造化した意図 → ルールで数式生成 → 静的検証 → 実行結果と独立計算の期待値を照合 → エッジケース検証。
 * 検証をすべて通った候補だけ status:'verified'。曖昧な要望は needs_input で確認文を返す。 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FormulaAssistant=api})(typeof self!=='undefined'?self:this,function(){
'use strict';
const TITLES={SUM:'合計を求める',AVERAGE:'平均を求める',MAX:'最大値を求める',MIN:'最小値を求める',COUNT:'数値のセルを数える',COUNTA:'空白以外のセルを数える',COUNTBLANK:'空白のセルを数える',SUMIF:'1つの条件に合う行を合計する',COUNTIF:'1つの条件に合う行を数える',AVERAGEIF:'1つの条件に合う行を平均する',SUMIFS:'複数の条件に合う行を合計する',COUNTIFS:'複数の条件に合う行を数える',AVERAGEIFS:'複数の条件に合う行を平均する',MAXIFS:'条件に合う行の最大値',MINIFS:'条件に合う行の最小値',VLOOKUP:'表を検索して別の列の値を取り出す',XLOOKUP:'表を検索して別の列の値を取り出す','INDEX+MATCH':'位置を調べて別の列の値を取り出す',IFERROR:'エラーのときに別の値を表示する',MATCH:'何番目にあるかを調べる',IF:'条件で表示を分ける',IFS:'複数の条件で表示を分ける',FILTER:'条件に合う行を取り出す',SORT:'並べ替える',UNIQUE:'重複を除く',TRANSPOSE:'行と列を入れ替える',RANK:'順位を求める',LEFT:'先頭から文字を取り出す',RIGHT:'末尾から文字を取り出す',MID:'途中から文字を取り出す',LEN:'文字数を数える',FIND:'文字の位置を調べる',UPPER:'大文字に変換する',LOWER:'小文字に変換する',SUBSTITUTE:'文字を置き換える',CONCATENATE:'文字を連結する',TEXTJOIN:'区切り文字つきで連結する',JOIN:'区切り文字つきで連結する','&':'文字を連結する',TODAY:'今日の日付',DAY:'日付から日を取り出す',MONTH:'日付から月を取り出す',YEAR:'日付から年を取り出す',DATEDIF:'2つの日付の間の期間を求める',ROUND:'四捨五入する',ROUNDUP:'切り上げる',ROUNDDOWN:'切り捨てる','四則演算':'セル同士を計算する',ROW:'連番を振る',QUERY:'列を選んで取り出す',CHOOSECOLS:'列を選んで取り出す',ARRAYFORMULA:'複数行を一括で計算する'};
const GOOGLE_ONLY=['QUERY','ARRAYFORMULA','JOIN','IMPORTRANGE','ARRAY_CONSTRAIN'];
const colName=n=>{let s='';for(n++;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
const colIndex=s=>{let n=0;for(const ch of s)n=n*26+ch.charCodeAt(0)-64;return n-1};
const norm=v=>String(v??'').normalize('NFKC').replace(/締め?切り?/g,'締切').replace(/[「」『』"“”\s]/g,'');
const num=v=>{if(typeof v==='number')return v;const s=String(v??'').replace(/,/g,'').trim();return s!==''&&isFinite(Number(s))?Number(s):null};
const str=s=>'"'+String(s).replace(/"/g,'""')+'"';
const DAY=86400000,EPOCH=Date.UTC(1899,11,30);
function parseDate(v){if(v instanceof Date)return Date.UTC(v.getFullYear(),v.getMonth(),v.getDate());const m=String(v??'').trim().match(/^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})日?$/);if(!m)return null;const t=Date.UTC(+m[1],m[2]-1,+m[3]);return new Date(t).getUTCDate()===+m[3]?t:null}
const serial=t=>Math.round((t-EPOCH)/DAY);
const today=()=>{const d=new Date();return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())};
const err=code=>({error:code});
const CMP={'>=':(a,b)=>a>=b,'<=':(a,b)=>a<=b,'>':(a,b)=>a>b,'<':(a,b)=>a<b};
const CMPWORD=w=>/以上/.test(w)?'>=':/以下/.test(w)?'<=':/未満|小さ|少な|低|安|下回/.test(w)?'<':'>';
const CMPRE='以上|以下|未満|より大きい|より大きければ|より多い|より高い|より上|を超える|を超えて|を超え|超|を上回|より小さい|より少ない|より低い|より安い|を下回';
const UNITS='円|点|人|枠|件|個|名|%|週間|か月|ヶ月|カ月|日間|日|年|歳';
const M='';

function getEngine(){try{if(typeof window!=='undefined'&&window.FormulaEngine)return window.FormulaEngine;if(typeof self!=='undefined'&&self.FormulaEngine)return self.FormulaEngine;if(typeof require==='function'){const e=require('./engine.js');return e&&(e.FormulaEngine||e)}}catch(e){}return null}

/* ---------- 条件の判定(期待値計算用。数式とは別系統) ---------- */
function textEq(a,b){const x=num(a),y=num(b);if(x!==null&&y!==null)return x===y;return String(a).trim().toLowerCase()===String(b).trim().toLowerCase()}
function condMatch(row,c,S){const v=String(row[c.col]??'').trim(),lv=v.toLowerCase(),t=String(c.value??'').toLowerCase();
 switch(c.op){
  case'eq':return v!==''&&textEq(v,c.value);
  case'eqcell':{const k=String(S.at(c.ref)??'').trim();return k!==''&&textEq(v,k)}
  case'ne':return !textEq(v,c.value);
  case'blank':return v==='';
  case'notblank':return v!=='';
  case'starts':return lv.startsWith(t);
  case'ends':return lv.endsWith(t);
  case'contains':return lv.includes(t);
  default:{const f=CMP[c.op];if(c.unit){const m=v.match(/^(\d+(?:\.\d+)?)(.*)$/);return !!m&&m[2]===c.unit&&f(Number(m[1]),c.value)}const n=num(v);return n!==null&&f(n,c.value)}
 }}
const rowsMatching=(S,conds,logic)=>S.data.filter(r=>logic==='OR'?conds.some(c=>condMatch(r,c,S)):conds.every(c=>condMatch(r,c,S)));
function criterion(c){switch(c.op){case'eq':return str(c.value);case'eqcell':return c.ref;case'ne':return str('<>'+c.value);case'blank':return '""';case'notblank':return '"<>"';case'starts':return str(c.value+'*');case'ends':return str('*'+c.value);case'contains':return str('*'+c.value+'*');default:return str(c.op+c.value+(c.unit||''))}}
function boolExpr(c,R){const r=R(c.col),v=num(c.value)!==null&&c.numeric?c.value:str(c.value);switch(c.op){case'eq':return r+'='+v;case'eqcell':return r+'='+c.ref;case'ne':return r+'<>'+v;case'blank':return r+'=""';case'notblank':return r+'<>""';case'starts':return 'LEFT('+r+','+String(c.value).length+')='+str(c.value);case'ends':return 'RIGHT('+r+','+String(c.value).length+')='+str(c.value);case'contains':return 'ISNUMBER(SEARCH('+str(c.value)+','+r+'))';default:return r+c.op+(c.unit?str(c.value+c.unit):c.value)}}
function describe(c,headers){const h='「'+headers[c.col]+'」';switch(c.op){case'eq':return h+'が「'+c.value+'」';case'eqcell':return h+'が '+c.ref+' の値';case'ne':return h+'が「'+c.value+'」以外';case'blank':return h+'が空欄';case'notblank':return h+'が入力済み';case'starts':return h+'が「'+c.value+'」で始まる';case'ends':return h+'が「'+c.value+'」で終わる';case'contains':return h+'が「'+c.value+'」を含む';default:return h+'が '+c.value+(c.unit||'')+({'>=':' 以上','<=':' 以下','>':' より大きい','<':' 未満'})[c.op]}}

/* ---------- 03 意図解析 ---------- */
function analyse(question,ctx){
 const headers=ctx.headers.map(h=>String(h??'')),data=ctx.data.map(r=>headers.map((_,i)=>String(r[i]??'')));
 const left=ctx.left||0,topRow=ctx.topRow||1,first=topRow+1,last=topRow+Math.max(1,data.length),google=/Google/.test(ctx.platform||'');
 const raw=String(question??'').normalize('NFKC');
 const quotes=[...raw.matchAll(/「([^」]*)」|『([^』]*)』|"([^"]*)"|“([^”]*)”/g)].map(m=>m[1]??m[2]??m[3]??m[4]);
 const q=norm(question);let m=q;
 const mask=(p,l)=>{m=m.slice(0,p)+M.repeat(l)+m.slice(p+l)};
 const R=c=>colName(left+c)+first+':'+colName(left+c)+last;
 const ALL=colName(left)+first+':'+colName(left+headers.length-1)+last,ALLH=colName(left)+topRow+':'+colName(left+headers.length-1)+last;
 const isNumeric=c=>data.some(r=>r[c].trim())&&data.every(r=>!r[c].trim()||num(r[c])!==null);
 const problems=[];
 // セル番地
 const addrs=[];for(const a of m.matchAll(/(?<![A-Za-z])\$?([A-Z]{1,2})\$?([1-9]\d{0,3})(?![\d%])/g))addrs.push({pos:a.index,len:a[0].length,ref:a[1]+a[2]});
 addrs.forEach(a=>mask(a.pos,a.len));
 // データ内の値
 const valMap=new Map();
 data.forEach(r=>r.forEach((v,c)=>{const t=v.trim();if(!t||num(t)!==null||parseDate(t)!==null)return;const k=norm(t);if(k.length<2)return;if(!valMap.has(k))valMap.set(k,{value:t,cols:new Set()});valMap.get(k).cols.add(c)}));
 const vals=[];
 for(const [k,o] of [...valMap].sort((a,b)=>b[0].length-a[0].length)){let p=0;while((p=m.indexOf(k,p))>=0){vals.push({pos:p,len:k.length,value:o.value,cols:[...o.cols]});mask(p,k.length);p+=k.length}}
 vals.sort((a,b)=>a.pos-b.pos);
 // 見出し(別名つき)
 const aliasMap=new Map();
 headers.forEach((h,c)=>{const full=norm(h);if(!full)return;const set=new Set([full]);for(const a of [...set]){const b=a.replace(/^(留学先|留学|募集|実施|テスト)/,'');if(b)set.add(b)}for(const a of [...set]){const b=a.replace(/(名|数)$/,'');if(b.length>=2)set.add(b)}
  for(const a of set){if(a!==full&&a.length<2)continue;const e=aliasMap.get(a)||{full:[],derived:[]};(a===full?e.full:e.derived).push(c);aliasMap.set(a,e)}});
 const fields=[];
 for(const [a,e] of [...aliasMap].sort((x,y)=>y[0].length-x[0].length)){const cols=e.full.length?e.full:e.derived;let p=0;while((p=m.indexOf(a,p))>=0){fields.push({pos:p,len:a.length,cols,name:a});mask(p,a.length);p+=a.length}}
 fields.sort((a,b)=>a.pos-b.pos);
 const after=t=>m.slice(t.pos+t.len).match(/^[^]*/)[0];
 const prevField=pos=>fields.find(f=>!f.used&&f.pos+f.len<=pos&&/^(?:欄|列)?(?:が|は|の|で|に|:|=)?$/.test(m.slice(f.pos+f.len,pos)));
 const conds=[];
 for(const v of vals){
  let cols=v.cols;const pf=prevField(v.pos);
  if(pf){const both=cols.filter(c=>pf.cols.includes(c));if(both.length){cols=both;pf.used=true}}
  if(cols.length>1){problems.push('「'+v.value+'」は複数の列('+cols.map(c=>'「'+headers[c]+'」').join('・')+')にあります。どの列で絞り込むか、「'+headers[cols[0]]+'が'+v.value+'」のように列名を付けて指定してください。');continue}
  const aft=after(v),c={col:cols[0],op:'eq',value:v.value,pos:v.pos,tok:v};let mm;
  if((mm=aft.match(new RegExp('^('+CMPRE+')')))&&/^\d+(\.\d+)?\D+$/.test(v.value)){const u=v.value.match(/^(\d+(?:\.\d+)?)(\D+)$/);c.op=CMPWORD(mm[1]);c.value=Number(u[1]);c.unit=u[2]}
  else if(/^(?:以外|ではな|でな|じゃな|を除)/.test(aft))c.op='ne';
  else if(/^(?:から|で)(?:始|はじ)ま/.test(aft))c.op='starts';
  else if(/^で(?:終|お)わ/.test(aft))c.op='ends';
  else if(/^(?:を含|が含まれ)/.test(aft))c.op='contains';
  conds.push(c)}
 for(const f of fields){if(f.used)continue;const aft=after(f);let op=null;
  if(/^(?:欄|列)?(?:が|は|の|を|に)?(?:空白以外|空欄以外|空白でな|空欄でな|空白ではな|空欄ではな|未入力でな|入力され|入力済|入力があ|ある|あり|あって|設定され)/.test(aft))op='notblank';
  else if(/^(?:欄|列)?(?:が|は|の|を|に)?(?:なく|ない|なし|無し|無く|空白|空欄|未入力|未設定)/.test(aft))op='blank';
  if(!op)continue;f.used=true;
  if(f.cols.length>1){problems.push('「'+f.name+'」に当てはまる列が複数あります('+f.cols.map(c=>'「'+headers[c]+'」').join('・')+')。列名を正確に指定してください。');continue}
  conds.push({col:f.cols[0],op,value:'',pos:f.pos})}
 const cmps=[];
 for(const mm of m.matchAll(new RegExp('(\\d[\\d,]*(?:\\.\\d+)?)(万|千)?('+UNITS+')?('+CMPRE+')','g'))){
  let n=Number(mm[1].replace(/,/g,''))*(mm[2]==='万'?10000:mm[2]==='千'?1000:1);const unit=mm[3]||'',op=CMPWORD(mm[4]);
  const item={n,unit,op,pos:mm.index,end:mm.index+mm[0].length};cmps.push(item);
  const pf=prevField(mm.index);let col=null;
  if(pf&&pf.cols.length===1){col=pf.cols[0];item.field=pf}
  else if(unit){const cand=headers.map((_,c)=>c).filter(c=>!isNumeric(c)&&data.some(r=>new RegExp('^\\d+(\\.\\d+)?'+unit+'$').test(r[c].trim())));if(cand.length===1)col=cand[0]}
  item.col=col;if(col===null)continue;
  item.cond=isNumeric(col)?{col,op,value:n,numeric:true,pos:mm.index}:{col,op,value:n,unit,pos:mm.index}}
 for(const mm of m.matchAll(/([^がはでのをに、,。]+?)((?:から|で)(?:始|はじ)ま|で(?:終|お)わ|を含|が含まれ)/g)){
  const pf=prevField(mm.index),value=mm[1],op=/始|はじ/.test(mm[2])?'starts':/終|おわ/.test(mm[2])?'ends':'contains';
  const test=v=>{const s=norm(v).toLowerCase(),t=value.toLowerCase();return op==='starts'?s.startsWith(t):op==='ends'?s.endsWith(t):s.includes(t)};
  let cols=pf?pf.cols:headers.map((_,c)=>c).filter(c=>data.some(r=>r[c].trim()&&test(r[c])));
  if(cols.length!==1){problems.push('「'+value+'」'+({starts:'で始まる',ends:'で終わる',contains:'を含む'})[op]+'の条件をどの列に当てるか特定できません。列名を指定してください。');continue}
  if(pf)pf.used=true;conds.push({col:cols[0],op,value,pos:mm.index})}
 conds.sort((a,b)=>a.pos-b.pos);
 const free=fields.filter(f=>!f.used);
 // 行キー+列名 → セル
 const cells=addrs.map(a=>({pos:a.pos,ref:a.ref}));
 const keyConds=[];
 vals.forEach((v,i)=>{const c=conds.find(x=>x.tok===v&&x.op==='eq');if(!c)return;const rows=data.map((r,ri)=>textEq(r[c.col],c.value)?ri:-1).filter(x=>x>=0);if(rows.length!==1)return;
  const next=vals[i+1]?vals[i+1].pos:Infinity;
  for(const f of free){if(f.pos<v.pos||f.pos>next||f.cols.length!==1)continue;cells.push({pos:f.pos,ref:colName(left+f.cols[0])+(first+rows[0]),c:f.cols[0],r:rows[0],field:f,key:c});keyConds.push(c)}});
 cells.sort((a,b)=>a.pos-b.pos);
 return {headers,data,left,topRow,first,last,google,raw,quotes,q,m,R,ALL,ALLH,isNumeric,problems,addrs,vals,fields,conds,cmps,free,cells,keyConds};
}

/* ---------- 05 ルールエンジン(意図 → 数式候補+期待値の計算方法) ---------- */
function plan(A,ctx){
 const {headers,data,left,topRow,first,last,google,quotes,q,m,R,ALL,ALLH,isNumeric,problems,conds,cmps,free,cells}=A;
 const ask=message=>({ask:message});
 const one=f=>f.cols.length===1?f.cols[0]:null;
 const ambiguousField=f=>ask('「'+f.name+'」に当てはまる列が複数あります('+f.cols.map(c=>'「'+headers[c]+'」').join('・')+')。どの列か指定してください。');
 const cellVal=(S,cell)=>cell.r!=null?S.data[cell.r][cell.c]:S.at(cell.ref);
 const needCell=what=>ask(what+'対象のセルを特定できません。「シアトルの費用」のように行の値と列名で指定するか、「J29」のようにセル番地を書いてください。');
 const ext=(cell,samples)=>cell.r==null?[{ref:cell.ref,samples}]:[];
 const TXT=['Tokyo Office 東京都港区1-2-3','abcDEF 大阪府北区9-8'],NUMS=['1234.567','88'],DATES=['2001/04/15','1995/12/31'];
 const colsNote=cs=>cs.map(c=>'「'+headers[c]+'」').join('、');
 const sup=/最大|最高|最も高|一番高|最も多|一番多|一番大き|最も大き|MAX/.test(q),inf=/最小|最低|最も安|一番安|最も低|一番低|最も少|一番少|一番小さ|最も小さ|MIN/.test(q);
 const dateWord=/年齢|経過|何日経|経ってい|までの(?:残り)?日数|残り日数|あと何日|勤続/.test(q);

 // TODAY
 if(/TODAY|(?:今日|本日)の日付|今日は何日/.test(q)&&!dateWord&&!cells.length)return {intent:{operation:'TODAY'},cands:[{fn:'TODAY',formula:'=TODAY()'}],note:'今日の日付を返します。引数はありません。',expect:()=>serial(today()),noEdge:true};
 // QUERY / 列抽出
 if(/QUERY|クエリ/i.test(q)||/列(?:だけ|のみ)|列を(?:抽出|取り出|選)/.test(q)&&free.length&&!conds.length){
  if(!free.length)return ask('取り出す列を特定できません。「国、都市、留学先大学名の列を抽出」のように列名を指定してください。');
  for(const f of free)if(one(f)===null)return ambiguousField(f);
  const cs=[...new Set(free.map(one))],pick=S=>[cs.map(c=>headers[c]),...S.data.map(r=>cs.map(c=>r[c]))];
  const choose={fn:'CHOOSECOLS',formula:'=CHOOSECOLS('+ALLH+','+cs.map(c=>c+1).join(',')+')'};
  const query={fn:'QUERY',formula:'=QUERY('+ALLH+',"select '+cs.map(c=>colName(left+c)).join(',')+'")'};
  return {intent:{operation:'SELECT_COLUMNS',columns:cs},cands:google?[query,choose]:[choose],note:colsNote(cs)+'の列を見出しごと取り出します。',expect:pick}}
 if(/行と列を?入れ替|行列を?入れ替|縦横を?入れ替|縦と横を?入れ替|転置|TRANSPOSE/.test(q))return {intent:{operation:'TRANSPOSE'},cands:[{fn:'TRANSPOSE',formula:'=TRANSPOSE('+ALLH+')'}],note:'見出しを含む表全体 '+ALLH+' の行と列を入れ替えます。',expect:S=>headers.map((h,c)=>[h,...S.data.map(r=>r[c])])};
 if(/重複|ユニーク|一意|UNIQUE/.test(q)){
  if(!free.length)return ask('重複を除く列を特定できません。「実施大学の重複を除く」のように列名を指定してください。');
  const c=one(free[0]);if(c===null)return ambiguousField(free[0]);
  return {intent:{operation:'UNIQUE',target:c},cands:[{fn:'UNIQUE',formula:'=UNIQUE('+R(c)+')'}],note:'「'+headers[c]+'」列の重複を除いた一覧を返します。',expect:S=>{const seen=new Set(),out=[];for(const r of S.data){const k=r[c].trim().toLowerCase();if(!seen.has(k)){seen.add(k);out.push([r[c]])}}return out}}}
 if(/並べ替|並び替|並べ変|並び変|ソート|順に並|SORT/.test(q)){
  if(!free.length)return ask('どの列で並べ替えるか特定できません。「留学費用の昇順で並べ替え」のように列名を指定してください。');
  const c=one(free[0]);if(c===null)return ambiguousField(free[0]);
  const desc=/降順|大きい順|高い順|多い順|新しい順|遅い順/.test(q);
  if(!desc&&!/昇順|小さい順|低い順|安い順|少ない順|古い順|早い順/.test(q))return ask('昇順(小さい順)と降順(大きい順)のどちらで並べ替えるか指定してください。');
  const key=v=>{const t=v.trim();if(t==='')return [2,0];const n=num(t)??(parseDate(t)!==null?serial(parseDate(t)):null);return n!==null?[0,n]:[1,t]};
  return {intent:{operation:'SORT',target:c,order:desc?'desc':'asc'},cands:[{fn:'SORT',formula:'=SORT('+ALL+','+(c+1)+','+(google?(desc?'FALSE':'TRUE'):(desc?'-1':'1'))+')'}],note:'データ行 '+ALL+' を「'+headers[c]+'」の'+(desc?'降順':'昇順')+'で並べ替えます。',
   expect:S=>S.data.map((r,i)=>({r,i,k:key(r[c])})).sort((a,b)=>{if(a.k[0]===2||b.k[0]===2)return a.k[0]-b.k[0]||a.i-b.i;const d=a.k[0]-b.k[0]||(a.k[1]<b.k[1]?-1:a.k[1]>b.k[1]?1:0);return (desc?-d:d)||a.i-b.i}).map(x=>x.r)}}

 // 文字列
 const cell=cells[0];
 const strOp=(fn,formula,f,note,samples)=>cell?{intent:{operation:fn,cell:cell.ref},cands:[{fn,formula}],note,expect:S=>f(String(cellVal(S,cell)??'')),cellsUsed:[cell],ext:ext(cell,samples||TXT)}:needCell('');
 let mm;
 if(mm=m.match(/(\d+)文字目から(\d+)文字/)){const a=+mm[1],b=+mm[2];return strOp('MID','=MID('+(cell&&cell.ref)+','+a+','+b+')',s=>s.substr(a-1,b),(cell&&cell.ref)+' の '+a+' 文字目から '+b+' 文字を取り出します。')}
 if((mm=m.match(/(\d+)(?:文字|桁)/))&&/先頭|左から|最初|頭から|LEFT|末尾|右から|最後|後ろ|RIGHT/.test(q)){const n=+mm[1],right=/末尾|右から|最後|後ろ|RIGHT/.test(q),fn=right?'RIGHT':'LEFT';return strOp(fn,'='+fn+'('+(cell&&cell.ref)+','+n+')',s=>right?(n?s.slice(-n):''):s.slice(0,n),(cell&&cell.ref)+' の'+(right?'末尾':'先頭')+'から '+n+' 文字を取り出します。')}
 if(/置換|置き換|SUBSTITUTE|に変更|に変え|に直/.test(q)){let a=quotes[0],b=quotes[1];if(a==null||b==null){const x=q.match(/(?:の|、)([^のをに、]+)を([^のをに、]+)に(?:置換|置き換|変更|変え|直)/);if(x){a=x[1];b=x[2]}}
  if(a==null||b==null)return ask('置き換える前の文字と後の文字を「」で囲んで指定してください。例:「の」を「」に置換');
  return strOp('SUBSTITUTE','=SUBSTITUTE('+(cell&&cell.ref)+','+str(a)+','+str(b)+')',s=>a===''?s:s.split(a).join(b),(cell&&cell.ref)+' の「'+a+'」を「'+b+'」に置き換えます。',[a+'テスト'+a,'該当なし'])}
 if(/何文字目|何番目の文字|FIND/.test(q)){let t=quotes[0];if(t==null){const x=m.match(/([^がはでのをに、,。])(?:が|は)何文字目/);if(x)t=x[1]}if(t==null)return ask('位置を調べる文字を「」で囲んで指定してください。例:「区」が何文字目か');
  return strOp('FIND','=FIND('+str(t)+','+(cell&&cell.ref)+')',s=>{const i=s.indexOf(t);return i<0?err('#VALUE!'):i+1},(cell&&cell.ref)+' の中で「'+t+'」が何文字目にあるかを返します。見つからない場合はエラーになります。',['東京'+t+'1-2',t+'から'])}
 if(/文字数|何文字|LEN/.test(q))return strOp('LEN','=LEN('+(cell&&cell.ref)+')',s=>s.length,(cell&&cell.ref)+' の文字数を返します。');
 if(/大文字|UPPER/.test(q))return strOp('UPPER','=UPPER('+(cell&&cell.ref)+')',s=>s.toUpperCase(),(cell&&cell.ref)+' を大文字に変換します。');
 if(/小文字|LOWER/.test(q))return strOp('LOWER','=LOWER('+(cell&&cell.ref)+')',s=>s.toLowerCase(),(cell&&cell.ref)+' を小文字に変換します。');
 if(/連結|結合|つなげ|つなぐ|つない|繋|くっつけ|CONCAT|TEXTJOIN|JOIN/.test(q)){
  if(cells.length<2)return ask('連結するセルを2つ以上特定できません。「シアトルの国と都市を連結」やセル番地(B23 と C23)で指定してください。');
  let sep=/区切|挟|はさ|間に|入れて|つきで/.test(q)?quotes[0]:undefined;if(sep==null)sep=/アンダーバー|アンダースコア/.test(q)?'_':/ハイフン/.test(q)?'-':/カンマ|コンマ/.test(q)?',':/スペース|空白で区切/.test(q)?' ':/スラッシュ/.test(q)?'/':null;
  const refs=cells.map(c=>c.ref),amp={fn:'&',formula:'='+refs.join(sep!=null?'&'+str(sep)+'&':'&')},con={fn:'CONCATENATE',formula:'=CONCATENATE('+refs.join(sep!=null?','+str(sep)+',':',')+')'};
  let cands=sep!=null?[google?{fn:'JOIN',formula:'=JOIN('+str(sep)+','+refs.join(',')+')'}:{fn:'TEXTJOIN',formula:'=TEXTJOIN('+str(sep)+',TRUE,'+refs.join(',')+')'},con,amp]:[amp,con];
  if(/CONCATENATE/.test(q))cands=[con,...cands.filter(c=>c!==con)];
  return {intent:{operation:'CONCAT',cells:refs,separator:sep},cands,note:refs.join('、')+' を'+(sep!=null?'「'+sep+'」で区切って':'')+'連結します。',expect:S=>cells.map(c=>String(cellVal(S,c)??'')).join(sep??''),ext:cells.flatMap((c,i)=>ext(c,['A'+i,'b'+i])),noCellEdge:true}}

 // 日付
 if(dateWord){
  if(!cell)return needCell('日付の');
  const future=/までの(?:残り)?日数|残り日数|あと何日/.test(q),unit=/年齢|年数|何年|勤続/.test(q)?'Y':/月数|何か月|何ヶ月/.test(q)?'M':'D';
  const diff=(a,b)=>{if(a===null||b===null)return err('#VALUE!');if(a>b)return err('#NUM!');if(unit==='D')return Math.round((b-a)/DAY);const x=new Date(a),y=new Date(b);let mo=(y.getUTCFullYear()-x.getUTCFullYear())*12+y.getUTCMonth()-x.getUTCMonth()-(y.getUTCDate()<x.getUTCDate()?1:0);return unit==='M'?mo:Math.floor(mo/12)};
  return {intent:{operation:'DATEDIF',cell:cell.ref,unit,direction:future?'until':'since'},cands:[{fn:'DATEDIF',formula:future?'=DATEDIF(TODAY(),'+cell.ref+',"'+unit+'")':'=DATEDIF('+cell.ref+',TODAY(),"'+unit+'")'}],note:future?'今日から '+cell.ref+' の日付までの'+({Y:'年数',M:'月数',D:'日数'})[unit]+'を返します。':cell.ref+' の日付から今日までの'+({Y:'満年数',M:'月数',D:'日数'})[unit]+'を返します。',
   expect:S=>{const d=parseDate(cellVal(S,cell));return future?diff(today(),d):diff(d,today())},ext:ext(cell,future?['2099/01/01','2090/06/30']:DATES),noCellEdge:true}}
 if(mm=(m.match(/(年|月|日)(?:だけ|のみ|の部分|の数字)?を(?:取り出|抽出|求め|表示|出)/)||q.match(/(YEAR|MONTH|DAY)/))){
  if(!cell)return needCell('日付の');
  const fn=({年:'YEAR',月:'MONTH',日:'DAY'})[mm[1]]||mm[1];
  return {intent:{operation:fn,cell:cell.ref},cands:[{fn,formula:'='+fn+'('+cell.ref+')'}],note:cell.ref+' の日付から'+({YEAR:'年',MONTH:'月',DAY:'日'})[fn]+'を取り出します。',expect:S=>{const raw=String(cellVal(S,cell)??'').trim();if(raw==='')return fn==='YEAR'?1900:fn==='MONTH'?1:0;const d=parseDate(raw);if(d===null)return err('#VALUE!');const x=new Date(d);return fn==='YEAR'?x.getUTCFullYear():fn==='MONTH'?x.getUTCMonth()+1:x.getUTCDate()},ext:ext(cell,DATES),noCellEdge:true}}

 // IF / IFS
 if(/合格|判定|IF関数|IFS|そうでなければ|それ以外は|でなければ/.test(m)&&!/IFERROR|エラー/.test(q)){
  const clean=s=>s.replace(/(?:と|を)?(?:表示|判定|する|返す|出す|します).*$/,'');
  const steps=[...m.matchAll(/(\d+)(?:点|円|人)?以上(?:は|なら|ならば|で|を|が|の場合は?)?([^、,。\d]+?)(?=、|,|。|$)/g)].map(x=>({n:+x[1],label:clean(x[2])})).filter(x=>x.label);
  if(steps.length>=2||/IFS/.test(q)&&steps.length){
   if(!cell)return needCell('判定する');
   const fb=m.match(/(?:それ未満|それ以外|その他|\d+(?:点)?未満)(?:は|なら|を|が)?([^、,。]+?)(?:、|,|。|$)/),other=fb?clean(fb[1]):null;
   const args=steps.map(s=>cell.ref+'>='+s.n+','+str(s.label));if(other)args.push('TRUE,'+str(other));
   return {intent:{operation:'IFS',cell:cell.ref,steps,otherwise:other},cands:[{fn:'IFS',formula:'=IFS('+args.join(',')+')'}],note:cell.ref+' の値を上から順に判定し、最初に当てはまった表示を返します。',expect:S=>{const n=num(cellVal(S,cell))??0;const s=steps.find(s=>n>=s.n);return s?s.label:other??err('#N/A')},ext:ext(cell,[String(steps[0].n),String(steps[steps.length-1].n-1)]),numCells:true,boundary:steps.map(s=>s.n)}}
  let a=quotes[0],b=quotes[1];if(a==null||b==null){if(/不合格/.test(q)){a='合格';b='不合格'}else return ask('条件に合うときと合わないときに表示する文字を「」で囲んで指定してください。例:「合格」「不合格」')}
  const cmp=cmps[0];let rhs,rhsOf,op;
  if(cmp&&cells.length>=1){rhs=String(cmp.n);rhsOf=()=>cmp.n;op=cmp.op;const tail=q.slice(q.search(new RegExp(CMPRE))),pa=tail.indexOf(a),pb=tail.indexOf(b);if(pb>=0&&(pa<0||pb<pa&&!(b.includes(a)&&pa===pb+b.indexOf(a)&&false))&&pb<=pa)op=({'>=':'<','<=':'>','>':'<=','<':'>='})[op];else if(pb>=0&&pa<0)op=({'>=':'<','<=':'>','>':'<=','<':'>='})[op]}
  else if(cells.length>=2){rhs=cells[1].ref;rhsOf=S=>num(cellVal(S,cells[1]))??0;const w=q.match(new RegExp(CMPRE));if(!w)return ask('どういう条件で「'+a+'」にするか(以上・より大きい・以下・未満)を指定してください。');op=CMPWORD(w[0])}
  else return cells.length?ask('比較する基準(「85点以上」などの数値か、合格点のセル)を指定してください。'):needCell('判定する');
  return {intent:{operation:'IF',cell:cell.ref,op,compare:rhs,whenTrue:a,whenFalse:b},cands:[{fn:'IF',formula:'=IF('+cell.ref+op+rhs+','+str(a)+','+str(b)+')'}],note:cell.ref+' が '+rhs+' '+({'>=':'以上','<=':'以下','>':'より大きい','<':'未満'})[op]+'なら「'+a+'」、そうでなければ「'+b+'」を返します。',expect:S=>CMP[op](num(cellVal(S,cell))??0,rhsOf(S))?a:b,ext:cells.slice(0,cmp?1:2).flatMap((c,i)=>ext(c,cmp?[String(cmp.n),String(cmp.n+1)]:[String(70+i*10),String(90-i*30)])),numCells:true,boundary:cmp?[cmp.n]:null,cellsUsed:cells.slice(0,cmp?1:2)}}

 // 順位
 if(/順位|何位|ランキング|RANK/.test(q)){
  if(!cell)return needCell('順位を求める');
  let c=cell.c;if(c==null){const f=free.find(f=>one(f)!==null&&isNumeric(one(f)));if(!f)return ask('順位を付ける範囲の列を特定できません。列名を指定してください。');c=one(f)}
  const asc=/小さい順|低い順|安い順|昇順|少ない順/.test(q);
  return {intent:{operation:'RANK',cell:cell.ref,target:c,order:asc?'asc':'desc'},cands:[{fn:'RANK',formula:'=RANK('+cell.ref+','+R(c)+(asc?',1':'')+')'},{fn:'RANK',formula:'=RANK.EQ('+cell.ref+','+R(c)+(asc?',1':'')+')'}],note:cell.ref+' が「'+headers[c]+'」列の中で'+(asc?'小さい':'大きい')+'順に何位かを返します。',expect:S=>{const v=num(cellVal(S,cell));if(v===null)return err('#N/A');const ns=S.data.map(r=>num(r[c])).filter(x=>x!==null);if(!ns.includes(v))return err('#N/A');return 1+ns.filter(x=>asc?x<v:x>v).length},ext:ext(cell,[data[0][c],data[data.length-1][c]]),noCellEdge:true}}

 // 検索
 if(/検索|LOOKUP|探|調べ|対応する|IFERROR|エラー|見つから/.test(q)&&!/何番目|何行目/.test(q)){
  const guard=/IFERROR|エラー|見つからな|ない場合|なければ/.test(q);
  const addr=A.addrs[0],keyCond=conds.find(c=>c.op==='eq'&&c.tok);
  const fs=free.filter(f=>!addr||true);for(const f of fs)if(one(f)===null)return ambiguousField(f);
  let key,keyCol,ret,keyOf,extRefs=[];
  if(addr){if(fs.length<2)return ask(addr.ref+' の値をどの列で探し、どの列の値を取り出すかを特定できません。「'+addr.ref+' の都市に対応する留学費用を検索」のように、探す列と取り出す列の両方を指定してください。');
   keyCol=one(fs[0]);ret=one(fs[fs.length-1]);key=addr.ref;keyOf=S=>S.at(addr.ref);extRefs=[{ref:addr.ref,samples:[data[Math.min(2,data.length-1)][keyCol],data[0][keyCol],'該当なし__']}]}
  else if(keyCond){const f=fs.filter(f=>one(f)!==keyCond.col);if(!f.length)return ask('「'+keyCond.value+'」の行から取り出す列を特定できません。「'+keyCond.value+'の留学費用を検索」のように列名を指定してください。');keyCol=keyCond.col;ret=one(f[f.length-1]);key=str(keyCond.value);keyOf=()=>keyCond.value}
  else return ask('検索する値を特定できません。表にある値(例:「シアトル」)か、検索値を入れるセル番地(例:J29)を指定してください。');
  if(ret===keyCol)return ask('探す列と取り出す列が同じです。取り出す列を指定してください。');
  const fallback=guard?(quotes.length?quotes[quotes.length-1]:/ハイフン/.test(q)?'-':/空白|空欄|何も表示しない/.test(q)?'':null):null;
  if(guard&&fallback===null)return ask('エラーのときに表示する文字を「」で囲んで指定してください。例:見つからない場合は「-」を表示');
  const wrap=(fn,f)=>guard?{fn:'IFERROR',formula:'=IFERROR('+f+','+str(fallback)+')',note:fn+' を IFERROR で包んだ形'}:{fn,formula:'='+f};
  const v=ret>keyCol?[wrap('VLOOKUP','VLOOKUP('+key+','+colName(left+keyCol)+first+':'+colName(left+ret)+last+','+(ret-keyCol+1)+',FALSE)')]:[];
  const im=wrap('INDEX+MATCH','INDEX('+R(ret)+',MATCH('+key+','+R(keyCol)+',0))'),xl=wrap('XLOOKUP','XLOOKUP('+key+','+R(keyCol)+','+R(ret)+')');
  return {intent:{operation:'LOOKUP',key:addr?{cell:addr.ref}:{value:keyCond.value},keyColumn:keyCol,target:ret,onError:guard?fallback:undefined},cands:[...v,im,xl],note:'「'+headers[keyCol]+'」列で '+(addr?addr.ref+' の値':'「'+keyCond.value+'」')+' を探し、同じ行の「'+headers[ret]+'」を返します(完全一致)。'+(guard?'見つからないときは「'+fallback+'」を表示します。':'')+(ret<keyCol?'取り出す列が検索列より左にあるため VLOOKUP は使えません。':''),
   expect:S=>{const k=String(keyOf(S)??'').trim();const row=k===''?null:S.data.find(r=>r[keyCol].trim()!==''&&textEq(r[keyCol],k));return row?row[ret]:guard?fallback:err('#N/A')},ext:extRefs,lookupKeyCol:keyCol,noCellEdge:true}}
 // 位置
 if(/何番目|何行目|MATCH|位置/.test(q)){
  const addr=A.addrs[0],kc=conds.find(c=>c.op==='eq'&&c.tok);
  if(kc)return {intent:{operation:'MATCH',key:{value:kc.value},keyColumn:kc.col},cands:[{fn:'MATCH',formula:'=MATCH('+str(kc.value)+','+R(kc.col)+',0)'}],note:'「'+kc.value+'」が「'+headers[kc.col]+'」列('+R(kc.col)+')の上から何番目にあるかを返します。',expect:S=>{const i=S.data.findIndex(r=>textEq(r[kc.col],kc.value)&&r[kc.col].trim()!=='');return i<0?err('#N/A'):i+1},lookupKeyCol:kc.col};
  if(addr&&free.length&&one(free[0])!==null){const c=one(free[0]);return {intent:{operation:'MATCH',key:{cell:addr.ref},keyColumn:c},cands:[{fn:'MATCH',formula:'=MATCH('+addr.ref+','+R(c)+',0)'}],note:addr.ref+' の値が「'+headers[c]+'」列の上から何番目にあるかを返します。',expect:S=>{const k=String(S.at(addr.ref)??'').trim();const i=k===''?-1:S.data.findIndex(r=>r[c].trim()!==''&&textEq(r[c],k));return i<0?err('#N/A'):i+1},ext:[{ref:addr.ref,samples:[data[Math.min(2,data.length-1)][c],'該当なし__']}]}}
  return ask('位置を調べる値と列を特定できません。「シアトルは都市の何番目か」のように指定してください。')}
 // 最大・最小の行の別列
 if((sup||inf)&&sup!==inf){
  const single=free.filter(f=>one(f)!==null),nums=single.filter(f=>isNumeric(one(f))),pos=q.search(sup?/最大|最高|最も|一番|MAX/:/最小|最低|最も|一番|MIN/);
  const nf=nums.filter(f=>f.pos<pos).pop()||nums[0],rf=nf&&single.filter(f=>f!==nf&&one(f)!==one(nf)).pop();
  if(nf&&rf){if(conds.length||problems.length)return ask('条件付きで最大・最小の行を取り出す式は自動生成の対象外です。条件を外すか、先に FILTER で絞り込んでください。');
   const n=one(nf),r=one(rf),F=sup?'MAX':'MIN';
   return {intent:{operation:'ARG'+F,by:n,target:r},cands:[{fn:'INDEX+MATCH',formula:'=INDEX('+R(r)+',MATCH('+F+'('+R(n)+'),'+R(n)+',0))'},{fn:'XLOOKUP',formula:'=XLOOKUP('+F+'('+R(n)+'),'+R(n)+','+R(r)+')'}],note:'「'+headers[n]+'」が'+(sup?'最大':'最小')+'の行にある「'+headers[r]+'」を返します。同じ値が複数ある場合は上の行が優先されます。',expect:S=>{let best=null;for(const row of S.data){const v=num(row[n]);if(v!==null&&(best===null||(sup?v>best.v:v<best.v)))best={v,row}}return best?best.row[r]:err('#N/A')},lookupKeyCol:n}}}

 // 端数・四則
 const round=/四捨五入|ROUND(?!UP|DOWN)/.test(q)?'ROUND':/切り上げ|繰り上げ|ROUNDUP/.test(q)?'ROUNDUP':/切り捨て|ROUNDDOWN/.test(q)?'ROUNDDOWN':null;
 const opw=/差|引い|引く|引き|マイナス/.test(q)?'-':/割合|割っ|割る|割り|÷|比率|パーセント/.test(q)?'/':/掛け|かけ(?:た|る|て|算)|倍|乗じ|×/.test(q)?'*':/足し|足す|加え|プラス|和を/.test(q)?'+':null;
 const batch=/ARRAYFORMULA|一括|まとめて|全行/.test(q);
 if(batch&&opw){const fs=free.filter(f=>one(f)!==null&&isNumeric(one(f)));if(fs.length>=2){const a=one(fs[0]),b=one(fs[1]),e=R(a)+opw+R(b),calc=(x,y)=>opw==='-'?x-y:opw==='/'?(y===0?err('#DIV/0!'):x/y):opw==='*'?x*y:x+y;
   return {intent:{operation:'ARRAY_ARITH',operator:opw,columns:[a,b]},cands:[google?{fn:'ARRAYFORMULA',formula:'=ARRAYFORMULA('+e+')'}:{fn:'四則演算',formula:'='+e}],note:'「'+headers[a]+'」'+opw+'「'+headers[b]+'」を全行まとめて計算します。'+(google?'':'Excel(Microsoft 365 / 2021 以降)では結果が下のセルに自動で展開されます。'),expect:S=>S.data.map(r=>{const v=calc(num(r[a])??0,num(r[b])??0);return [v&&v.error?v.error:v]}),noNoMatch:true}}}
 if(round||opw&&cells.length){
  const numsIn=[...m.matchAll(/\d+(?:\.\d+)?/g)].filter(x=>!/^(?:文字|位|桁|番目|行目)/.test(m.slice(x.index+x[0].length))&&!/[第]$/.test(m.slice(0,x.index))).map(x=>({pos:x.index,n:Number(x[0]),lit:x[0]}));
  let ops=[...cells.map(c=>({pos:c.pos,cell:c})),...numsIn].sort((a,b)=>a.pos-b.pos);
  if(cells.length){
   let expr,calc,used;
   if(opw&&ops.length>=2){let [x,y]=ops;if(opw==='/'&&x.cell==null&&/^(?:点)?(?:満点|中|のうち|に対)/.test(m.slice(x.pos+x.lit.length))&&false)[x,y]=[y,x];if(opw==='/'&&/に対する/.test(m.slice(x.pos,y.pos))===false&&x.cell==null&&y.cell)[x,y]=[y,x];
    const t=o=>o.cell?o.cell.ref:o.lit,v=(S,o)=>o.cell?(num(cellVal(S,o.cell))??0):o.n;expr=t(x)+opw+t(y);used=[x,y].filter(o=>o.cell).map(o=>o.cell);
    calc=S=>{const p=v(S,x),r=v(S,y);return opw==='-'?p-r:opw==='/'?(r===0?err('#DIV/0!'):p/r):opw==='*'?p*r:p+r}}
   else if(round){expr=cell.ref;used=[cell];calc=S=>num(cellVal(S,cell))??0}
   else return ask('計算する2つの値を特定できません。セル番地や「シアトルの費用とボストンの費用」のように指定してください。');
   if(!round)return {intent:{operation:'ARITH',expression:expr},cands:[{fn:'四則演算',formula:'='+expr}],note:expr+' を計算します。'+(opw==='/'?'パーセント表示にする場合はセルの表示形式を変更してください。':''),expect:calc,ext:used.flatMap((c,i)=>ext(c,[String(120+i*30),String(7+i)])),numCells:true,cellsUsed:used};
   let d=0;const dm=m.match(/小数(?:点)?第?(\d)位(まで|を|で|以下)?/)||q.match(/小数(?:点)?第?(\d)位(まで|を|で|以下)?/);if(dm)d=dm[2]==='まで'?+dm[1]:Math.max(0,+dm[1]-(dm[2]==='以下'?1:1));
   const rd=v=>{if(v&&v.error)return v;const f=Math.pow(10,d),x=Math.abs(v)*f,e=1e-9;const r=round==='ROUND'?Math.floor(x+0.5+e):round==='ROUNDUP'?Math.ceil(x-e):Math.floor(x+e);return Math.sign(v)*r/f};
   return {intent:{operation:round,expression:expr,digits:d},cands:[{fn:round,formula:'='+round+'('+expr+','+d+')'}],note:expr+' を小数第 '+d+' 位'+(d===0?'(整数)':'')+'までに'+({ROUND:'四捨五入',ROUNDUP:'切り上げ',ROUNDDOWN:'切り捨て'})[round]+'します。',expect:S=>rd(calc(S)),ext:used.flatMap((c,i)=>ext(c,['1234.567','88.25'])),numCells:true,cellsUsed:used}}
  if(round)return needCell('端数処理する')}
 if(/連番|通し番号|ROW関数|ROW\(/.test(q))return {intent:{operation:'ROW'},cands:[{fn:'ROW',formula:'=ROW('+colName(left)+first+')-'+topRow}],note:'最初のデータ行('+first+' 行目)に入力すると 1 になり、下にコピーすると 2、3…と増えます。',expect:()=>1,noEdge:true};

 // ここから先は条件を使う
 const extract=/抽出|絞り込|取り出|だけを?表示|のみを?表示|FILTER|フィルタ|一覧/.test(q);
 const op=/平均|AVERAGE/.test(q)?'AVERAGE':/合計|総額|合算|総和|トータル|足し|SUM/.test(q)?'SUM':/件数|何件|数え|カウント|個数|いくつ|人数|何人|の数|COUNT/.test(q)?'COUNT':sup&&!inf?'MAX':inf&&!sup?'MIN':null;
 if(!op&&!extract)return null;
 if(problems.length)return ask(problems[0]);
 for(const c of cmps)if(c.col===null)return ask('「'+c.n+c.unit+({'>=':'以上','<=':'以下','>':'より大きい','<':'未満'})[c.op]+'」の条件をどの列に当てるか特定できません。「留学費用が'+c.n+c.unit+'以上」のように列名を付けてください。');
 let C=[...conds.map(c=>({...c})),...cmps.map(c=>c.cond)].sort((a,b)=>a.pos-b.pos);
 cmps.forEach(c=>{if(c.field)c.field.used=true});
 let tfree=free.filter(f=>!f.used);
 // 「〜ごと」: 条件セルを参照する形
 const grouped=/ごと|別に|別の|別で|別集計|毎/.test(q);let groupNote='';
 if(grouped&&op&&!C.length){const gf=tfree.find(f=>one(f)!==null&&/^(?:ごと|別|毎)/.test(m.slice(f.pos+f.len)))||tfree.find(f=>one(f)!==null&&!isNumeric(one(f)));
  if(!gf)return ask('何ごとに集計するか(例:国ごと)を列名で指定してください。');
  const ref=colName(left+headers.length)+first,gc=one(gf),samples=[...new Set(data.map(r=>r[gc]).filter(v=>v.trim()))].slice(0,2);
  C=[{col:gc,op:'eqcell',ref,pos:gf.pos,samples}];tfree=tfree.filter(f=>f!==gf);groupNote=ref+' に集計したい「'+headers[gc]+'」の値を入力して使います。'}
 // OR / AND
 const orWord=/または|またわ|もしくは|あるいは|のどちらか|いずれか/.test(q);let logic='AND';
 const sameCol=C.length>1&&C.every(c=>c.col===C[0].col&&c.op==='eq');
 if(sameCol)logic='OR';
 else if(orWord)return ask('「または」の条件が別々の列にまたがっています。1つの式にまとめる前に、「どちらか一方でも当てはまる行」を対象にするのか「両方当てはまる行」なのかを確認させてください。同じ列の中の「または」(例:国がアメリカまたはカナダ)は自動で対応できます。');
 else if(C.filter(c=>c.op==='eq').some((c,i,a)=>a.findIndex(x=>x.col===c.col)!==i))return ask('同じ列に対する条件が複数あり、他の列の条件と組み合わさっています。「かつ」「または」の関係を指定してください。');
 // 既存挙動: 「〇〇がなく」の列が該当行で全部入力済みなら、該当行が全部空欄の列に読み替える
 const remap=[];
 if(logic==='AND'){const filled=C.filter(c=>c.op!=='blank'),S0={data,at:()=>''},matching=filled.length?rowsMatching(S0,filled,'AND'):[];
  for(const c of C){if(c.op!=='blank'||!filled.length||!matching.length||matching.some(r=>!r[c.col].trim()))continue;
   const used=new Set(C.map(x=>x.col));
   const cand=headers.map((h,i)=>i).filter(i=>headers[i].trim()&&!used.has(i)&&data.some(r=>r[i].trim())&&matching.every(r=>!r[i].trim())&&!isNumeric(i)).sort((a,b)=>Math.abs(a-c.col)-Math.abs(b-c.col));
   if(cand.length){remap.push({named:c.col,col:cand[0]});c.named=c.col;c.col=cand[0]}}}
 const condNote=C.length?C.map(c=>describe(c,headers)).join(logic==='OR'?' または ':'、')+'の行を対象にします。':'';
 const remapNote=remap.map(r=>'「'+headers[r.named]+'」は該当する行がすべて入力済みのため、空欄の「'+headers[r.col]+'」を「ない」として扱いました。').join('');
 const pub=C.map(c=>({col:c.col,op:c.op,value:c.op==='eqcell'?c.ref:c.unit?c.value+c.unit:c.value,...(c.named!=null?{named:c.named}:{})}));
 const extRefs=C.filter(c=>c.op==='eqcell').map(c=>({ref:c.ref,samples:c.samples}));
 const pick=S=>C.length?rowsMatching(S,C,logic):S.data;

 if(extract&&!op){
  if(!C.length)return ask('抽出する条件を特定できません。「国がカナダの行を抽出」のように、列名と値を指定してください。');
  for(const f of tfree)if(one(f)===null)return ambiguousField(f);
  const outs=[...new Set(tfree.map(one))].filter(c=>!C.some(x=>x.col===c)),rng=outs.length===1?R(outs[0]):ALL;
  const be=C.length===1?boolExpr(C[0],R):C.map(c=>'('+boolExpr(c,R)+')').join(logic==='OR'?'+':'*');
  return {intent:{operation:'FILTER',conditions:pub,logic,columns:outs.length===1?outs:null},conds:C,logic,cands:[{fn:'FILTER',formula:'=FILTER('+rng+','+be+')'}],note:condNote+(outs.length===1?'「'+headers[outs[0]]+'」列だけを返します。':'データ行全体 '+ALL+' から取り出します。')+'該当する行がないとエラーになります。',expect:S=>{const rows=pick(S);return rows.length?rows.map(r=>outs.length===1?[r[outs[0]]]:r):err('#CALC!')},ext:extRefs}}

 // 集計
 const blankOnly=C.length===1&&C[0].op==='blank',notBlankOnly=C.length===1&&C[0].op==='notblank';
 if(op==='COUNT'&&(blankOnly||notBlankOnly)){const c=C[0].col,fn=blankOnly?'COUNTBLANK':'COUNTA';return {intent:{operation:fn,target:c,conditions:pub},conds:C,logic,target:c,cands:[{fn,formula:'='+fn+'('+R(c)+')'}],note:'「'+headers[c]+'」列 '+R(c)+' の'+(blankOnly?'空白':'空白以外')+'のセルを数えます。',expect:S=>S.data.filter(r=>(r[c].trim()==='')===blankOnly).length}}
 for(const f of tfree)if(one(f)===null)return ambiguousField(f);
 const tcols=[...new Set(tfree.map(one))];
 if(op==='COUNT'&&!C.length){
  const c=tcols.length?tcols[0]:0,blank=/空白|空欄|未入力/.test(q),not=/空白(?:で|では)な|空欄(?:で|では)な|空白以外|空欄以外|入力され|入力済/.test(q),numeric=/数値|数字|COUNT(?!A|BLANK|IF)/.test(q);
  const fn=not?'COUNTA':blank?'COUNTBLANK':numeric?'COUNT':'COUNTA';
  if(fn==='COUNT'&&!tcols.length){const n=headers.map((_,i)=>i).filter(isNumeric);if(n.length!==1)return ask('数値を数える列を特定できません。列名を指定してください。');return plan2(n[0])}
  if((blank||not)&&!tcols.length)return ask('どの列の空白を数えるか、列名を指定してください。');
  return plan2(c);
  function plan2(c){return {intent:{operation:fn,target:c,conditions:[]},conds:[],target:c,cands:[{fn,formula:'='+fn+'('+R(c)+')'}],note:'「'+headers[c]+'」列 '+R(c)+' の'+({COUNT:'数値が入ったセル',COUNTA:'空白以外のセル',COUNTBLANK:'空白のセル'})[fn]+'を数えます。'+(!tcols.length?'列の指定がないため、表の先頭列でデータの件数を数えています。':''),expect:S=>S.data.filter(r=>fn==='COUNT'?num(r[c])!==null:fn==='COUNTA'?r[c].trim()!=='':r[c].trim()==='').length}}}
 let target=null;
 if(op!=='COUNT'){const tn=tcols.filter(isNumeric),allNum=headers.map((_,i)=>i).filter(i=>isNumeric(i)&&!C.some(c=>c.col===i));
  if(tn.length===1)target=tn[0];
  else if(tn.length>1)return ask('集計する列の候補が複数あります('+colsNote(tn)+')。どの列を'+({SUM:'合計',AVERAGE:'平均',MAX:'最大値',MIN:'最小値'})[op]+'するか1つ指定してください。');
  else if(!tcols.length&&allNum.length===1)target=allNum[0];
  else if(!tn.length&&cmps.length===1&&cmps[0].cond&&cmps[0].cond.numeric&&!tcols.length)target=cmps[0].col;
  else return ask('集計する数値列を特定できません。「留学費用の合計」のように列名を指定してください。')}
 const values=S=>pick(S).map(r=>num(r[target])).filter(v=>v!==null);
 const agg=S=>{if(op==='COUNT')return pick(S).length;const v=values(S);if(op==='SUM')return v.reduce((a,b)=>a+b,0);if(op==='AVERAGE')return v.length?v.reduce((a,b)=>a+b,0)/v.length:err('#DIV/0!');return v.length?(op==='MAX'?Math.max(...v):Math.min(...v)):0};
 const targetNote=target!=null?'「'+headers[target]+'」列 '+R(target)+' を'+({SUM:'合計',AVERAGE:'平均',MAX:'最大値に',MIN:'最小値に'})[op]+'します。':'';
 const base={intent:{operation:op,target,conditions:pub,logic},conds:C,logic,target,expect:agg,ext:extRefs,note:condNote+targetNote+remapNote+groupNote};
 if(!C.length)return {...base,cands:[{fn:op,formula:'='+op+'('+R(target)+')'}]};
 const abs=s=>extRefs.length?s.replace(/([A-Z]+)(\d+)/g,'$$$1$$$2'):s,RR=c=>abs(R(c));
 if(logic==='OR'){const one1=c=>op==='COUNT'?'COUNTIF('+RR(c.col)+','+criterion(c)+')':'SUMIF('+RR(c.col)+','+criterion(c)+','+RR(target)+')';
  if(op==='COUNT'||op==='SUM')return {...base,cands:[{fn:op+'IF',formula:'='+C.map(one1).join('+')}],note:base.note+'同じ列の「または」条件のため、条件ごとの '+op+'IF を足し合わせています。'};
  if(op==='AVERAGE')return {...base,cands:[{fn:'AVERAGEIF',formula:'=('+C.map(one1.bind(null)).map((_,i)=>'SUMIF('+RR(C[i].col)+','+criterion(C[i])+','+RR(target)+')').join('+')+')/('+C.map(c=>'COUNTIFS('+RR(c.col)+','+criterion(c)+','+RR(target)+',"<>")').join('+')+')'}],note:base.note+'同じ列の「または」条件のため、合計 ÷ 件数で平均を求めています。'};
  return ask('「または」条件での最大・最小は自動生成の対象外です。条件を1つにしてください。')}
 const pairs=C.map(c=>RR(c.col)+','+criterion(c)).join(',');
 if(op==='MAX'||op==='MIN')return {...base,cands:[{fn:op+'IFS',formula:'='+op+'IFS('+RR(target)+','+pairs+')'}],note:base.note+(google?'':op+'IFS は Excel 2019 以降で使えます。')};
 const ifs={fn:op+'IFS',formula:'='+op+'IFS('+(op==='COUNT'?'':RR(target)+',')+pairs+')'};
 if(C.length===1){const c=C[0];return {...base,cands:[{fn:op+'IF',formula:'='+op+'IF('+RR(c.col)+','+criterion(c)+(op==='COUNT'?'':','+RR(target))+')'},ifs]}}
 return {...base,cands:[ifs]};
}

/* ---------- 06〜08 検証 ---------- */
function sameCell(a,b,grid){
 const blank=v=>v===''||v==null;
 if(a instanceof Date)a=serial(parseDate(a));if(b instanceof Date)b=serial(parseDate(b));
 if(blank(a)&&blank(b))return true;
 if(grid&&(blank(a)&&b===0||blank(b)&&a===0))return true;
 if(typeof a==='boolean'||typeof b==='boolean')return String(a).toUpperCase()===String(b).toUpperCase();
 let x=num(a),y=num(b);
 if(x===null&&!blank(a)&&parseDate(a)!==null&&y!==null)x=serial(parseDate(a));
 if(y===null&&!blank(b)&&parseDate(b)!==null&&x!==null)y=serial(parseDate(b));
 if(x!==null&&y!==null)return Math.abs(x-y)<=1e-9*Math.max(1,Math.abs(x),Math.abs(y));
 if(x!==null||y!==null)return false;
 return String(a).trim()===String(b).trim()}
function same(exp,act){
 const ee=exp&&exp.error,ae=act&&act.error;if(ee||ae)return !!ee&&!!ae;
 const g=v=>Array.isArray(v)?(Array.isArray(v[0])?v:[v]):[[v]];const E=g(exp),X=g(act);
 if(E.length!==X.length)return false;const grid=E.length>1||E[0].length>1;
 return E.every((r,i)=>r.length===X[i].length&&r.every((v,j)=>sameCell(v,X[i][j],grid)))}
function makeSheet(ctx,data,over){const left=ctx.left||0,topRow=ctx.topRow||1,headers=ctx.headers;
 const getCell=(c,r)=>{const key=colName(c)+r;if(over&&key in over)return over[key];const ci=c-left;if(ci>=0&&ci<headers.length){if(r===topRow)return String(headers[ci]??'');const ri=r-topRow-1;if(ri>=0&&ri<data.length)return String(data[ri][ci]??'')}if(ctx.cells&&key in ctx.cells)return String(ctx.cells[key]);return ''};
 return {data,getCell,at:ref=>{const m=String(ref).replace(/\$/g,'').match(/^([A-Z]+)(\d+)$/);return m?getCell(colIndex(m[1]),+m[2]):''}}}
function localStatic(formula,platform){const errors=[];let depth=0,inStr=false;for(const ch of formula){if(ch==='"')inStr=!inStr;else if(!inStr){if(ch==='(')depth++;if(ch===')')depth--;if(depth<0)break}}
 if(depth!==0)errors.push({code:'PAREN',message:'かっこの対応が取れていません。'});if(inStr)errors.push({code:'QUOTE',message:'引用符が閉じていません。'});
 if(!/Google/.test(platform||'')){const bare=formula.replace(/"(?:[^"]|"")*"/g,'""');for(const fn of GOOGLE_ONLY)if(new RegExp('(?<![A-Z_.])'+fn+'\\(').test(bare))errors.push({code:'PLATFORM',message:fn+' は Google スプレッドシート専用です。'})}
 return errors}
function mutations(P,ctx){
 const data=ctx.data.map(r=>ctx.headers.map((_,i)=>String(r[i]??''))),copy=()=>data.map(r=>r.slice()),out=[];
 const base={};(P.ext||[]).forEach(e=>{if(!(ctx.cells&&e.ref in ctx.cells))base[e.ref]=e.samples[0]});
 const S0=makeSheet(ctx,data,base),C=P.conds||[];
 const flip=c=>c.op==='ne'?String(c.value):c.op==='blank'?'x':c.op==='notblank'?'':CMP[c.op]?String(c.value+(c.op[0]==='>'?-1:1))+(c.unit||''):'該当なし__';
 const hit=()=>{const i=data.findIndex(r=>C.every(c=>condMatch(r,c,S0)));return i<0?0:i};
 C.forEach((c,i)=>{if(c.op==='eqcell')return;const d=copy();d[hit()][c.col]=flip(c);out.push({label:'条件'+(i+1)+'を外した行',data:d,over:base})});
 C.filter(c=>CMP[c.op]).forEach(c=>{const d=copy();[0,-1,1].forEach((x,i)=>{if(d[i])d[i][c.col]=String(c.value+x)+(c.unit||'')});out.push({label:'境界値',data:d,over:base})});
 if(P.target!=null){const d=copy();d[hit()][P.target]='';out.push({label:'集計対象が空白',data:d,over:base})}
 if(C.length&&C[0].op!=='eqcell'&&!P.noNoMatch){const d=copy();d.forEach(r=>r[C[0].col]=flip(C[0]));out.push({label:'該当なし',data:d,over:base})}
 if(data.length>1&&!P.noEdge){const d=copy();[d[0],d[d.length-1]]=[d[d.length-1],d[0]];out.push({label:'行の入れ替え',data:d,over:base})}
 if(P.lookupKeyCol!=null&&!(P.ext||[]).length&&P.intent.key&&P.intent.key.value!=null){const d=copy();d.forEach(r=>{if(textEq(r[P.lookupKeyCol],P.intent.key.value))r[P.lookupKeyCol]='該当なし__'});out.push({label:'検索値なし',data:d,over:base})}
 if(!P.noCellEdge)(P.cellsUsed||[]).forEach(c=>{if(c.r==null)return;const d=copy(),v=d[c.r][c.c];d[c.r][c.c]=P.numCells||num(v)!==null?String((num(v)??0)+7):'Xy'+v+'Z';out.push({label:'セルの値を変更',data:d,over:base});if(!P.numCells){const e=copy();e[c.r][c.c]='';out.push({label:'セルが空白',data:e,over:base})}});
 (P.boundary||[]).forEach(n=>(P.cellsUsed||[]).slice(0,1).forEach(c=>{if(c.r==null)return;[n,n-1,n+1].forEach(x=>{const d=copy();d[c.r][c.c]=String(x);out.push({label:'境界値 '+x,data:d,over:base})})}));
 (P.ext||[]).forEach(e=>e.samples.slice(ctx.cells&&e.ref in ctx.cells?0:1).forEach(s=>out.push({label:e.ref+' に別の値',data:copy(),over:{...base,[e.ref]:s}})));
 (P.boundary||[]).forEach(n=>(P.ext||[]).slice(0,1).forEach(e=>[n,n-1].forEach(x=>out.push({label:'境界値 '+x,data:copy(),over:{...base,[e.ref]:String(x)}}))));
 return {base,list:P.noEdge?[]:out}}
function show(v){if(v&&v.error)return v.error;return v}
function verify(P,cand,ctx,engine){
 const checks=[],left=ctx.left||0,topRow=ctx.topRow||1,platform=ctx.platform||'Excel';
 const data=ctx.data.map(r=>ctx.headers.map((_,i)=>String(r[i]??'')));
 const refs=[...cand.formula.replace(/"(?:[^"]|"")*"/g,'').matchAll(/\$?([A-Z]{1,3})\$?(\d+)/g)].map(m=>[colIndex(m[1]),+m[2]]);
 const bounds={left:Math.min(left,...refs.map(r=>r[0])),top:Math.min(topRow,...refs.map(r=>r[1])),right:Math.max(left+ctx.headers.length-1,...refs.map(r=>r[0])),bottom:Math.max(topRow+data.length,...refs.map(r=>r[1]))};
 let errors=localStatic(cand.formula,platform);
 if(engine&&typeof engine.check==='function'){try{const r=engine.check(cand.formula,{platform,bounds});if(r&&r.ok===false)errors=errors.concat(r.errors||[{code:'CHECK',message:'静的検証エラー'}])}catch(e){errors.push({code:'CHECK',message:String(e.message||e)})}}
 const staticOk=!errors.length;
 checks.push({id:'static',label:'静的検証(構文・関数名・引数・参照範囲)',ok:staticOk,detail:staticOk?(engine?'問題なし':'かっこ・引用符・製品別の関数のみ確認(数式エンジン未読込)'):errors.map(e=>e.message).join(' / ')});
 const {base,list}=mutations(P,ctx);
 const usesSample=Object.keys(base).length>0;
 let expected,actual,execOk=null,edgeOk=null,execDetail='数式エンジンが読み込まれていないため未実施',edgeDetail='未実施';
 const S=makeSheet(ctx,data,base);
 try{expected=P.expect(S)}catch(e){expected=undefined}
 const run=sheet=>{try{const r=engine.evaluate(cand.formula,sheet.getCell);return Array.isArray(r)&&r.length===1&&Array.isArray(r[0])&&r[0].length===1?r[0][0]:r}catch(e){const msg=String(e&&e.message||e);return {error:/^#/.test(msg)?msg:'#ERROR '+msg}}};
 if(engine&&typeof engine.evaluate==='function'&&staticOk&&expected!==undefined){
  actual=run(S);
  if(actual&&actual.error&&/UNSUPPORTED|#ERROR|#NAME/.test(actual.error)){execDetail='この関数は内蔵エンジンで実行できないため未実施('+actual.error+')';actual=undefined}
  else{execOk=same(expected,actual);execDetail=execOk?'実行結果が、数式を使わずに計算した期待値と一致'+(usesSample?'(表の外のセルには検証用の値を入れて確認)':''):'実行結果が期待値と一致しません';
   if(execOk){const bad=[];for(const mu of list){const s=makeSheet(ctx,mu.data,mu.over);let e;try{e=P.expect(s)}catch(x){bad.push(mu.label);continue}if(!same(e,run(s)))bad.push(mu.label)}
    edgeOk=list.length?!bad.length:(P.noEdge?true:null);edgeDetail=!list.length?(P.noEdge?'表の内容に依存しない式のため対象なし':'対象なし'):bad.length?'一致しなかったケース: '+[...new Set(bad)].join('、'):list.length+' 件のテストデータ('+[...new Set(list.map(l=>l.label))].join('、')+')で期待値と一致'}}}
 else if(!staticOk)execDetail='静的検証に失敗したため未実施';
 checks.push({id:'execute',label:'実行結果と期待値の照合',ok:execOk,detail:execDetail});
 checks.push({id:'edge',label:'エッジケース検証',ok:edgeOk,detail:edgeDetail});
 return {checks,expected:show(expected),actual:show(actual),passed:staticOk&&execOk===true&&edgeOk===true,staticOk,failed:execOk===false||edgeOk===false}}

/* ---------- 公開 API ---------- */
function propose(question,ctx){
 ctx=ctx||{};const headers=ctx.headers||[],data=ctx.data||[];
 const blank={fn:'',formula:'',title:'',note:'',intent:null,checks:[],expected:undefined,actual:undefined,alternatives:[]};
 if(!String(question??'').trim())return {...blank,status:'none',message:'やりたいことを文章で入力してください。'};
 if(!headers.length||!data.length)return {...blank,status:'needs_input',message:'データ行を含めて表を貼り付けると数式を提案できます。'};
 const seen={};for(const h of headers){const k=norm(h);if(k&&seen[k]&&norm(question).includes(k))return {...blank,status:'needs_input',message:'「'+h+'」という見出しの列が複数あります。どちらの列を使うか、見出しを区別できる名前に変えるか列番号で指定してください。'};seen[k]=true}
 ctx={...ctx,headers,data};
 let A,P;
 try{A=analyse(question,ctx);P=plan(A,ctx)}catch(e){return {...blank,status:'none',message:'要望を解析できませんでした。列名と、求めたい内容(合計・件数・検索など)を書いてください。'}}
 if(!P)return {...blank,status:A.problems.length?'needs_input':'none',message:A.problems[0]||'要望から関数を特定できませんでした。表の列名を使って「留学費用の合計」「国がカナダの行を抽出」のように入力してください。'};
 if(P.ask)return {...blank,status:'needs_input',message:P.ask};
 const engine=getEngine();
 const intentCheck={id:'intent',label:'要望の読み取り',ok:true,detail:P.note};
 let chosen=null,result=null,fallback=null;
 for(const cand of P.cands.slice(0,4)){const r=verify(P,cand,ctx,engine);if(r.passed){chosen=cand;result=r;break}if(!fallback||(!fallback.r.staticOk&&r.staticOk)||(fallback.r.failed&&!r.failed&&r.staticOk))fallback={cand,r}}
 const verified=!!chosen;if(!chosen){chosen=fallback.cand;result=fallback.r}
 const conds=(P.intent.conditions||[]),c0=conds[0];
 return {status:verified?'verified':'unverified',fn:chosen.fn,formula:chosen.formula,title:TITLES[chosen.fn]||'',note:P.note,
  intent:{conditions:[],...P.intent,platform:ctx.platform||'Excel'},
  checks:[intentCheck,...result.checks],expected:result.expected,actual:result.actual,
  alternatives:P.cands.filter(c=>c!==chosen).map(c=>({fn:c.fn,formula:c.formula,note:c.note||TITLES[c.fn]||''})),
  message:verified?'':'この式は自動検証を完了していません(未検証)。'+result.checks.filter(c=>c.ok!==true).map(c=>c.label+': '+c.detail).join(' / '),
  target:P.intent.target,conditions:conds,cond:c0?c0.col:undefined,match:c0&&c0.op==='eq'?{i:c0.col,v:c0.value}:undefined,crit:c0&&P.conds&&P.conds[0]?criterion(P.conds[0]):undefined,idx:P.intent.target??(c0?c0.col:0)}}

return {propose,_internal:{analyse,same,norm,colName}};
});
