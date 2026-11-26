/* Formula Desk 数式エンジン: 構文解析(AST)・静的検証・実行。依存なし。 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FormulaEngine=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';

/* ---------- 共通 ---------- */
class FErr{constructor(code){this.code=code}}
const fail=code=>{throw new Error(code)};
const ERR_RE=/^#(?:N\/A|VALUE!|DIV\/0!|REF!|NAME\?|CALC!|NUM!|CIRC!|SPILL!|UNSUPPORTED)$/;
const isErrMsg=e=>e instanceof Error&&/^#/.test(e.message);
const MAX_ROW=5000, MAX_CELLS=200000;
function colName(c){let s='';for(c++;c>0;c=Math.floor((c-1)/26))s=String.fromCharCode(65+(c-1)%26)+s;return s}
function colIndex(s){let n=0;for(const ch of s.toUpperCase())n=n*26+ch.charCodeAt(0)-64;return n-1}
function syntaxError(code,message){const e=new Error(message);e.code=code;return e}

/* ---------- 字句解析 ---------- */
const OPS=['<=','>=','<>','+','-','*','/','^','&','=','<','>','(',')',',',':','%','{','}',';'];
function tokenize(src){
 const out=[];let i=0;const n=src.length;
 while(i<n){
  const ch=src[i];
  if(/\s/.test(ch)){i++;continue}
  if(ch==='"'){
   let j=i+1,s='';
   for(;;){
    if(j>=n)throw syntaxError('quote','文字列の引用符 " が閉じられていません。');
    if(src[j]==='"'){if(src[j+1]==='"'){s+='"';j+=2;continue}break}
    s+=src[j++];
   }
   out.push({t:'str',v:s});i=j+1;continue;
  }
  const rest=src.slice(i);let m,sheet=null;
  if((m=/^(?:'[^']+'|[\p{L}\p{N}_]+)!/u.exec(rest))){
   sheet=m[0].slice(0,-1).replace(/^'|'$/g,'');
   const after=rest.slice(m[0].length);
   const r=/^\$?[A-Za-z]{1,3}\$?[1-9]\d{0,6}(?![\p{L}\p{N}_(.])/u.exec(after)||/^\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}(?![\p{L}\p{N}_(.$])/u.exec(after);
   if(!r)throw syntaxError('syntax','シート名「'+sheet+'」の後にセル参照がありません。');
   i+=m[0].length;
  }
  const cur=src.slice(i);
  if((m=/^\$?([A-Za-z]{1,3}):\$?([A-Za-z]{1,3})(?![\p{L}\p{N}_(.$])/u.exec(cur))){
   const a=colIndex(m[1]),b=colIndex(m[2]);
   out.push({t:'range',c1:Math.min(a,b),r1:1,c2:Math.max(a,b),r2:MAX_ROW,whole:true,sheet});i+=m[0].length;continue;
  }
  if((m=/^(\$?)([A-Za-z]{1,3})(\$?)([1-9]\d{0,6})(?![\p{L}\p{N}_(.])/u.exec(cur))){
   out.push({t:'ref',col:colIndex(m[2]),row:Number(m[4]),absCol:!!m[1],absRow:!!m[3],sheet});i+=m[0].length;continue;
  }
  if((m=/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(cur))){out.push({t:'num',v:Number(m[0])});i+=m[0].length;continue}
  if((m=/^[\p{L}_][\p{L}\p{N}_.]*/u.exec(cur))){
   out.push({t:'id',v:m[0].replace(/^(?:_xlfn\.|_xlws\.)+/i,'').toUpperCase()});i+=m[0].length;continue;
  }
  const op=OPS.find(o=>cur.startsWith(o));
  if(!op)throw syntaxError('syntax','数式で使えない文字「'+ch+'」があります。');
  out.push({t:'op',v:op});i+=op.length;
 }
 return out;
}

/* ---------- 構文解析 ---------- */
function parse(formula){
 let src=String(formula??'').trim();
 if(src.startsWith('='))src=src.slice(1);
 if(!src.trim())throw syntaxError('syntax','数式が空です。');
 const tk=tokenize(src);let p=0;
 const peek=v=>tk[p]&&tk[p].t==='op'&&tk[p].v===v;
 const take=v=>peek(v)?(p++,true):false;
 const show=t=>!t?'数式の終わり':t.t==='str'?'"'+t.v+'"':t.t==='ref'?colName(t.col)+t.row:String(t.v??'範囲');
 function binary(next,ops){return function(){let l=next();while(tk[p]&&tk[p].t==='op'&&ops.includes(tk[p].v)){const op=tk[p++].v;l={type:'binary',op,left:l,right:next()}}return l}}
 function primary(){
  const t=tk[p++];
  if(!t)throw syntaxError('syntax','数式が途中で終わっています。');
  if(t.t==='num')return {type:'num',value:t.v};
  if(t.t==='str')return {type:'str',value:t.v};
  if(t.t==='range')return {type:'range',c1:t.c1,r1:t.r1,c2:t.c2,r2:t.r2,whole:true,sheet:t.sheet};
  if(t.t==='ref'){
   if(peek(':')){
    const e=tk[p+1];
    if(!e||e.t!=='ref')throw syntaxError('syntax','範囲指定「:」の後にセル参照がありません。');
    p+=2;
    return {type:'range',c1:Math.min(t.col,e.col),r1:Math.min(t.row,e.row),c2:Math.max(t.col,e.col),r2:Math.max(t.row,e.row),sheet:t.sheet};
   }
   return {type:'ref',col:t.col,row:t.row,absCol:t.absCol,absRow:t.absRow,sheet:t.sheet};
  }
  if(t.t==='id'){
   if(take('(')){
    const args=[];
    if(!take(')')){
     for(;;){
      if(peek(',')||peek(')'))args.push({type:'empty'});else args.push(expr());
      if(take(','))continue;
      if(take(')'))break;
      throw syntaxError(tk[p]?'syntax':'paren',tk[p]?t.v+' の引数の区切りが不正です(「'+show(tk[p])+'」の前に , か ) が必要)。':t.v+' の閉じ括弧 ) がありません。');
     }
    }
    if((t.v==='TRUE'||t.v==='FALSE')&&!args.length)return {type:'bool',value:t.v==='TRUE'};
    return {type:'call',name:t.v,args};
   }
   if(t.v==='TRUE'||t.v==='FALSE')return {type:'bool',value:t.v==='TRUE'};
   return {type:'name',name:t.v};
  }
  if(t.v==='('){const e=expr();if(!take(')'))throw syntaxError('paren','閉じ括弧 ) がありません。');return {type:'group',arg:e}}
  if(t.v==='{'){
   const rows=[[]];
   for(;;){
    let sign=1;if(take('-'))sign=-1;else take('+');
    const e=tk[p++];
    if(!e||!['num','str','id'].includes(e.t))throw syntaxError('syntax','配列定数 { } の中身が不正です。');
    rows[rows.length-1].push(e.t==='num'?sign*e.v:e.t==='str'?e.v:e.v==='TRUE'?true:e.v==='FALSE'?false:e.v);
    if(take(','))continue;
    if(take(';')){rows.push([]);continue}
    if(take('}'))break;
    throw syntaxError('syntax','配列定数の閉じ括弧 } がありません。');
   }
   if(rows.some(r=>r.length!==rows[0].length))throw syntaxError('syntax','配列定数の各行の要素数が揃っていません。');
   return {type:'array',rows};
  }
  throw syntaxError(t.v===')'?'paren':'syntax',t.v===')'?'開き括弧 ( に対応しない ) があります。':'「'+t.v+'」の位置が不正です。');
 }
 function postfix(){let e=primary();while(take('%'))e={type:'percent',arg:e};return e}
 function unary(){if(take('-'))return {type:'unary',op:'-',arg:unary()};if(take('+'))return unary();return postfix()}
 const pow=binary(unary,['^']),mul=binary(pow,['*','/']),add=binary(mul,['+','-']),cat=binary(add,['&']),cmp=binary(cat,['=','<>','<','>','<=','>=']);
 function expr(){return cmp()}
 const ast=expr();
 if(p<tk.length)throw syntaxError(peek(')')?'paren':'syntax',peek(')')?'開き括弧 ( に対応しない ) があります。':'「'+show(tk[p])+'」の前に演算子または , がありません。');
 return ast;
}

/* ---------- 値の変換 ---------- */
function parseNum(s){
 const t=s.trim();
 const m=/^([+-]?)[¥￥$]?(\d{1,3}(?:,\d{3})+|\d+)?(\.\d+)?(%?)$/.exec(t);
 if(!m||(m[2]===undefined&&m[3]===undefined))return null;
 let n=Number((m[2]||'0').replaceAll(',','')+(m[3]||''));
 if(m[1]==='-')n=-n;if(m[4])n/=100;
 return n;
}
const serial=(y,m,d)=>Math.round(Date.UTC(y,m-1,d)/864e5)+25569;
const fromSerial=n=>new Date((Math.floor(n)-25569)*864e5);
function parseDate(s){
 const m=/^\s*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s*$/.exec(s)||/^\s*(\d{4})年(\d{1,2})月(\d{1,2})日\s*$/.exec(s);
 if(!m)return null;
 const y=+m[1],mo=+m[2],d=+m[3];
 if(mo<1||mo>12||d<1||d>31)return null;
 const n=serial(y,mo,d);
 return fromSerial(n).getUTCDate()===d?n:null;
}
function cellVal(raw){
 if(raw===null||raw===undefined||raw==='')return null;
 if(typeof raw==='number'||typeof raw==='boolean')return raw;
 const s=String(raw);
 if(ERR_RE.test(s))return new FErr(s);
 const n=parseNum(s);if(n!==null)return n;
 if(s==='TRUE'||s==='FALSE')return s==='TRUE';
 return s;
}
const isMat=v=>Array.isArray(v);
const M=v=>isMat(v)?v:[[v]];
const scalar=v=>isMat(v)?v[0][0]:v;
const big=v=>isMat(v)&&(v.length>1||v[0].length>1);
function toNum(v){
 if(v instanceof FErr)fail(v.code);
 if(typeof v==='number')return v;
 if(typeof v==='boolean')return v?1:0;
 if(v===null||v===undefined)return 0;
 const n=parseNum(v)??parseDate(v);
 if(n===null)fail('#VALUE!');
 return n;
}
const clean=n=>Number.isFinite(n)?Number(n.toPrecision(15)):n;
function toStr(v){
 if(v instanceof FErr)fail(v.code);
 if(v===null||v===undefined)return '';
 if(typeof v==='boolean')return v?'TRUE':'FALSE';
 if(typeof v==='number')return String(clean(v));
 return v;
}
function toBool(v){
 if(v instanceof FErr)fail(v.code);
 if(typeof v==='boolean')return v;
 if(typeof v==='number')return v!==0;
 if(v===null||v===undefined)return false;
 if(/^true$/i.test(v))return true;if(/^false$/i.test(v))return false;
 fail('#VALUE!');
}
/* 範囲内の値を数値として読む(数値と日付文字列のみ。その他は NaN) */
function numOf(v){
 if(typeof v==='number')return v;
 if(typeof v==='string'){const d=parseDate(v);if(d!==null)return d}
 return NaN;
}
function nums(args){
 const out=[];
 for(const a of args){
  if(a===undefined)continue;
  if(isMat(a)){for(const row of a)for(const v of row){if(v instanceof FErr)fail(v.code);const n=numOf(v);if(!Number.isNaN(n))out.push(n)}}
  else if(a!==null)out.push(toNum(a));
 }
 return out;
}
function bmap(args,fn){
 if(!args.some(big))return fn(...args.map(scalar));
 const ms=args.map(a=>a===undefined?undefined:M(a));
 const rows=Math.max(...ms.map(m=>m?m.length:1)),cols=Math.max(...ms.map(m=>m?m[0].length:1));
 const pick=(m,i,j)=>{
  if(!m)return undefined;
  const r=m.length===1?0:i,c=m[0].length===1?0:j;
  return r<m.length&&c<m[0].length?m[r][c]:new FErr('#N/A');
 };
 return Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>{
  try{return fn(...ms.map(m=>pick(m,i,j)))}catch(e){if(isErrMsg(e))return new FErr(e.message);throw e}
 }));
}
function cmpVals(a,b){
 if(a instanceof FErr)fail(a.code);if(b instanceof FErr)fail(b.code);
 const blank=o=>typeof o==='string'?'':typeof o==='boolean'?false:0;
 if(a===null||a===undefined)a=blank(b);
 if(b===null||b===undefined)b=blank(a);
 if(typeof a==='string'&&typeof b==='string'){
  const da=parseDate(a),db=parseDate(b);
  if(da!==null&&db!==null){a=da;b=db}else{a=a.toLowerCase();b=b.toLowerCase()}
 }else{
  if(typeof a==='string'&&typeof b==='number'){const d=parseDate(a);if(d!==null)a=d}
  if(typeof b==='string'&&typeof a==='number'){const d=parseDate(b);if(d!==null)b=d}
 }
 const rank=v=>typeof v==='number'?0:typeof v==='string'?1:2;
 if(rank(a)!==rank(b))return rank(a)<rank(b)?-1:1;
 return a<b?-1:a>b?1:0;
}
function wildcard(pattern){
 let re='';
 for(let i=0;i<pattern.length;i++){
  const ch=pattern[i];
  if(ch==='~'&&'*?~'.includes(pattern[i+1]||' ')){re+='\\'+pattern[++i];continue}
  re+=ch==='*'?'[\\s\\S]*':ch==='?'?'[\\s\\S]':ch.replace(/[.*+?^${}()|[\]\\\/]/g,'\\$&');
 }
 return new RegExp('^'+re+'$','i');
}
function criterion(c){
 c=scalar(c);
 if(c instanceof FErr)return ()=>false;
 if(c===null||c===undefined)c=0;
 if(typeof c==='number')return v=>numOf(v)===c;
 if(typeof c==='boolean')return v=>v===c;
 const m=/^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(c),op=m[1]||'=',rest=m[2];
 const blank=v=>v===null||v===undefined||v==='';
 if(rest==='')return op==='='?blank:op==='<>'?v=>!blank(v):()=>false;
 const n=parseNum(rest)??parseDate(rest);
 if(n!==null){
  switch(op){
   case '=':return v=>numOf(v)===n;
   case '<>':return v=>!(v instanceof FErr)&&numOf(v)!==n;
   case '<':return v=>numOf(v)<n;
   case '>':return v=>numOf(v)>n;
   case '<=':return v=>numOf(v)<=n;
   default:return v=>numOf(v)>=n;
  }
 }
 if(/^(true|false)$/i.test(rest)){const b=/^true$/i.test(rest);return op==='<>'?v=>v!==b:v=>v===b}
 const re=wildcard(rest),low=rest.toLowerCase();
 const text=v=>typeof v==='string'&&parseDate(v)===null;
 if(op==='=')return v=>text(v)&&re.test(v);
 if(op==='<>')return v=>!(v instanceof FErr)&&!(text(v)&&re.test(v));
 return v=>{
  if(!text(v))return false;
  const s=v.toLowerCase();
  return op==='<'?s<low:op==='>'?s>low:op==='<='?s<=low:s>=low;
 };
}
function mask(pairs,rows,cols){
 let keep=Array(rows*cols).fill(true);
 for(let i=0;i<pairs.length;i+=2){
  const r=M(pairs[i]);
  if(r.length!==rows||r[0].length!==cols)fail('#VALUE!');
  const test=criterion(pairs[i+1]),flat=r.flat();
  keep=keep.map((k,j)=>k&&test(flat[j]));
 }
 return keep;
}
function ifsValues(target,pairs){
 const t=M(target),keep=mask(pairs,t.length,t[0].length);
 const out=[];
 t.flat().forEach((v,i)=>{if(!keep[i])return;if(v instanceof FErr)fail(v.code);const n=numOf(v);if(!Number.isNaN(n))out.push(n)});
 return out;
}
function singleIf(range,crit,target){
 const r=M(range);let t=r;
 if(target!==undefined){
  t=M(target);
  if(t.length!==r.length||t[0].length!==r[0].length){
   if(!target.ref||!CTX)fail('#VALUE!');
   t=readRange(target.ref.c1,target.ref.r1,target.ref.c1+r[0].length-1,target.ref.r1+r.length-1);
  }
 }
 return ifsValues(t,[r,crit]);
}
const sum=a=>clean(a.reduce((x,y)=>x+y,0));
function roundTo(x,d,mode){
 x=toNum(x);d=Math.trunc(toNum(d));
 const f=10**Math.abs(d);let y=Math.abs(x);
 y=Number((d>=0?y*f:y/f).toPrecision(15));
 y=mode==='up'?Math.ceil(y):mode==='down'?Math.floor(y):Math.round(y);
 return clean((x<0?-1:1)*(d>=0?y/f:y*f));
}
function lookEq(v,exact){
 if(typeof v==='string'){
  const d=parseDate(v);
  if(d!==null)return x=>numOf(x)===d;
  if(!exact&&/[*?]/.test(v)){const re=wildcard(v);return x=>typeof x==='string'&&re.test(x)}
  const low=v.toLowerCase();return x=>typeof x==='string'&&x.toLowerCase()===low;
 }
 if(typeof v==='number')return x=>numOf(x)===v;
 if(typeof v==='boolean')return x=>x===v;
 return ()=>false;
}
const sameKind=(x,v)=>{
 const k=o=>typeof o==='number'||(typeof o==='string'&&parseDate(o)!==null)?'n':typeof o;
 return x!==null&&!(x instanceof FErr)&&k(x)===k(v);
};
/* 近似一致: dir=-1 は v 以下で最大、dir=1 は v 以上で最小 */
function approx(list,v,dir){
 let best=-1;
 list.forEach((x,i)=>{
  if(!sameKind(x,v))return;
  const c=cmpVals(x,v);
  if(dir<0?c<=0:c>=0){if(best<0||(dir<0?cmpVals(x,list[best])>=0:cmpVals(x,list[best])<0))best=i}
 });
 return best;
}
function lookupValue(v){v=scalar(v);if(v instanceof FErr)fail(v.code);return v}
function sortCmp(a,b){
 const key=v=>v===null||v===undefined||v===''?[3,0]:v instanceof FErr?[2.5,0]:!Number.isNaN(numOf(v))?[0,numOf(v)]:typeof v==='string'?[1,v.toLowerCase()]:[2,v?1:0];
 const x=key(a),y=key(b);
 if(x[0]!==y[0])return {blank:x[0]===3||y[0]===3,c:x[0]-y[0]};
 return {blank:false,c:x[1]<y[1]?-1:x[1]>y[1]?1:0};
}
const transpose=m=>m[0].map((_,j)=>m.map(r=>r[j]));
function dateParts(v){const d=fromSerial(toNum(v));return {y:d.getUTCFullYear(),m:d.getUTCMonth()+1,d:d.getUTCDate(),w:d.getUTCDay()}}
function formatText(v,f){
 if(v instanceof FErr)fail(v.code);
 f=toStr(f);
 if(typeof v==='string'&&parseNum(v)===null&&parseDate(v)===null)return v;
 const n=toNum(v),bare=f.replace(/"[^"]*"/g,'');
 if(/[ymdhsa]/i.test(bare)&&!/[0#]/.test(bare)){
  const p=dateParts(n),frac=n-Math.floor(n),secs=Math.round(frac*86400),H=Math.floor(secs/3600),Mi=Math.floor(secs%3600/60),S=secs%60;
  const wd='日月火水木金土',en=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],mo=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const z=x=>String(x).padStart(2,'0');let afterHour=false;
  return f.replace(/"([^"]*)"|yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|aaaa|aaa|hh|h|ss|s/gi,(t,lit)=>{
   if(lit!==undefined)return lit;
   const k=t.toLowerCase(),min=afterHour;afterHour=k[0]==='h';
   switch(k){
    case 'yyyy':return p.y;case 'yy':return z(p.y%100);
    case 'mmmm':return mo[p.m-1];case 'mmm':return mo[p.m-1].slice(0,3);
    case 'mm':return min?z(Mi):z(p.m);case 'm':return min?Mi:p.m;
    case 'dddd':return en[p.w];case 'ddd':return en[p.w].slice(0,3);
    case 'dd':return z(p.d);case 'd':return p.d;
    case 'aaaa':return wd[p.w]+'曜日';case 'aaa':return wd[p.w];
    case 'hh':return z(H);case 'h':return H;case 'ss':return z(S);default:return S;
   }
  });
 }
 const core=/[0#?][0#?,.]*/.exec(bare);
 if(!core)return f==='@'||/^general$/i.test(f)?toStr(v):f.replace(/"/g,'');
 const unq=s=>s.replace(/"([^"]*)"/g,'$1').replace(/\\(.)/g,'$1');
 const at=f.indexOf(core[0]),pre=unq(f.slice(0,at)),post=unq(f.slice(at+core[0].length));
 const [ip,dp='']=core[0].split('.'),dec=dp.replace(/[^0#?]/g,'').length,minInt=(ip.match(/0/g)||[]).length;
 let x=n*(/%/.test(bare)?100:1);
 let [a,b]=Math.abs(roundTo(x,dec)).toFixed(dec).split('.');
 a=a.padStart(minInt,'0');if(minInt===0&&a==='0'&&dec>0)a='';
 if(ip.includes(','))a=a.replace(/\B(?=(\d{3})+$)/g,',');
 return (roundTo(x,dec)<0?'-':'')+pre+a+(b?'.'+b:'')+post;
}

/* ---------- 関数定義 ---------- */
const FN={};
/* kind: 's' = スカラー関数(配列は要素ごと), 'v' = 値(配列可), 'lazy' = AST を受け取る */
function def(names,min,max,impl,kind='v',platform='both'){for(const n of names.split(' '))FN[n]={min,max,impl,kind,platform}}
const INF=Infinity;
let CTX=null;
function readRange(c1,r1,c2,r2){
 if((r2-r1+1)*(c2-c1+1)>MAX_CELLS||r2<r1||c2<c1)fail('#REF!');
 const m=Array.from({length:r2-r1+1},(_,i)=>Array.from({length:c2-c1+1},(_,j)=>cellVal(CTX.get(c1+j,r1+i))));
 m.ref={c1,r1,c2,r2};return m;
}

def('SUM',1,INF,(...a)=>sum(nums(a)));
def('AVERAGE',1,INF,(...a)=>{const n=nums(a);if(!n.length)fail('#DIV/0!');return clean(sum(n)/n.length)});
def('MAX',1,INF,(...a)=>{const n=nums(a);return n.length?Math.max(...n):0});
def('MIN',1,INF,(...a)=>{const n=nums(a);return n.length?Math.min(...n):0});
def('PRODUCT',1,INF,(...a)=>clean(nums(a).reduce((x,y)=>x*y,1)));
def('MEDIAN',1,INF,(...a)=>{const n=nums(a).sort((x,y)=>x-y);if(!n.length)fail('#NUM!');const h=n.length>>1;return n.length%2?n[h]:clean((n[h-1]+n[h])/2)});
def('COUNT',1,INF,(...a)=>a.reduce((c,x)=>c+(isMat(x)?x.flat().filter(v=>!Number.isNaN(numOf(v))).length:(typeof x==='number'||typeof x==='boolean'||(typeof x==='string'&&(parseNum(x)??parseDate(x))!==null)?1:0)),0));
def('COUNTA',1,INF,(...a)=>a.reduce((c,x)=>c+M(x).flat().filter(v=>v!==null&&v!==undefined&&v!=='').length,0));
def('COUNTBLANK',1,1,a=>M(a).flat().filter(v=>v===null||v==='').length);
def('COUNTUNIQUE',1,INF,(...a)=>new Set(a.flatMap(x=>M(x).flat()).filter(v=>v!==null&&v!=='').map(v=>typeof v+':'+v)).size,'v','google');
def('SUMIF',2,3,(r,c,t)=>sum(singleIf(r,c,t)));
def('AVERAGEIF',2,3,(r,c,t)=>{const n=singleIf(r,c,t);if(!n.length)fail('#DIV/0!');return clean(sum(n)/n.length)});
def('COUNTIF',2,2,(r,c)=>{const t=criterion(c);return M(r).flat().filter(t).length});
def('COUNTIFS',2,INF,(...p)=>{const r=M(p[0]);return mask(p,r.length,r[0].length).filter(Boolean).length});
def('SUMIFS',3,INF,(t,...p)=>sum(ifsValues(t,p)));
def('AVERAGEIFS',3,INF,(t,...p)=>{const n=ifsValues(t,p);if(!n.length)fail('#DIV/0!');return clean(sum(n)/n.length)});
def('MAXIFS',3,INF,(t,...p)=>{const n=ifsValues(t,p);return n.length?Math.max(...n):0});
def('MINIFS',3,INF,(t,...p)=>{const n=ifsValues(t,p);return n.length?Math.min(...n):0});
def('SUMPRODUCT',1,INF,(...a)=>{
 const ms=a.map(M);
 if(ms.some(m=>m.length!==ms[0].length||m[0].length!==ms[0][0].length))fail('#VALUE!');
 let total=0;
 ms[0].forEach((row,i)=>row.forEach((_,j)=>{let p=1;for(const m of ms){const v=m[i][j];if(v instanceof FErr)fail(v.code);p*=typeof v==='number'?v:0}total+=p}));
 return clean(total);
});

/* 論理 */
const safe=(ev,node)=>{try{return ev(node)}catch(e){if(isErrMsg(e)&&e.message!=='#UNSUPPORTED')return new FErr(e.message);throw e}};
def('IF',2,3,(nodes,ev)=>{
 const c=ev(nodes[0]),other=n=>n&&n.type!=='empty';
 if(big(c))return bmap([c,safe(ev,nodes[1]),other(nodes[2])?safe(ev,nodes[2]):false],(x,a,b)=>toBool(x)?a:b);
 return toBool(scalar(c))?ev(nodes[1]):other(nodes[2])?ev(nodes[2]):false;
},'lazy');
def('IFS',2,INF,(nodes,ev)=>{
 for(let i=0;i<nodes.length;i+=2)if(toBool(scalar(ev(nodes[i]))))return ev(nodes[i+1]);
 fail('#N/A');
},'lazy');
function ifErr(only){return (nodes,ev)=>{
 const hit=e=>e instanceof FErr&&(!only||e.code===only);
 const alt=()=>nodes[1]&&nodes[1].type!=='empty'?ev(nodes[1]):'';
 const v=safe(ev,nodes[0]);
 if(hit(v))return alt();
 if(isMat(v)&&v.flat().some(hit)){const a=scalar(alt());const m=v.map(r=>r.map(x=>hit(x)?a:x));return m}
 if(v instanceof FErr)fail(v.code);
 return v;
}}
def('IFERROR',1,2,ifErr(null),'lazy');
def('IFNA',1,2,ifErr('#N/A'),'lazy');
const logical=a=>{const out=[];for(const x of a){if(isMat(x)){for(const v of x.flat()){if(v instanceof FErr)fail(v.code);if(typeof v==='boolean'||typeof v==='number')out.push(!!v)}}else out.push(toBool(x))}if(!out.length)fail('#VALUE!');return out};
def('AND',1,INF,(...a)=>logical(a).every(Boolean));
def('OR',1,INF,(...a)=>logical(a).some(Boolean));
def('NOT',1,1,v=>!toBool(v),'s');
def('ISBLANK',1,1,v=>v===null,'s');
def('ISNUMBER',1,1,v=>typeof v==='number','s');
def('ISTEXT',1,1,v=>typeof v==='string','s');
def('ISERROR',1,1,(nodes,ev)=>{const v=safe(ev,nodes[0]);return isMat(v)?bmap([v],x=>x instanceof FErr):v instanceof FErr},'lazy');
def('ISNA',1,1,(nodes,ev)=>{const na=x=>x instanceof FErr&&x.code==='#N/A';const v=safe(ev,nodes[0]);return isMat(v)?bmap([v],na):na(v)},'lazy');
def('SWITCH',3,INF,(v,...r)=>{v=scalar(v);for(let i=0;i+1<r.length;i+=2)if(cmpVals(v,scalar(r[i]))===0)return r[i+1];if(r.length%2)return r[r.length-1];fail('#N/A')});
def('CHOOSE',2,INF,(i,...r)=>{i=Math.trunc(toNum(scalar(i)));if(i<1||i>r.length)fail('#VALUE!');return r[i-1]});

/* 検索 */
function vh(v,table,idx,range,horizontal){
 v=lookupValue(v);let t=M(table);if(horizontal)t=transpose(t);
 idx=Math.trunc(toNum(scalar(idx)));
 if(idx<1)fail('#VALUE!');if(idx>t[0].length)fail('#REF!');
 const keys=t.map(r=>r[0]),isApprox=range===undefined?true:toBool(scalar(range));
 const i=isApprox?approx(keys,v,-1):keys.findIndex(lookEq(v,false));
 if(i<0)fail('#N/A');
 const out=t[i][idx-1];if(out instanceof FErr)fail(out.code);return out;
}
def('VLOOKUP',3,4,(v,t,i,r)=>vh(v,t,i,r,false));
def('HLOOKUP',3,4,(v,t,i,r)=>vh(v,t,i,r,true));
function findIndex(v,list,mode,search){
 const order=list.map((_,i)=>i);if(search<0)order.reverse();
 const eq=lookEq(v,mode!==2);let i=order.find(k=>eq(list[k]));
 if(i===undefined&&(mode===-1||mode===1)){const k=approx(list,v,mode);i=k<0?undefined:k}
 return i===undefined?-1:i;
}
def('XLOOKUP',3,6,(nodes,ev)=>{
 const v=lookupValue(ev(nodes[0])),la=M(ev(nodes[1])),ra=M(ev(nodes[2]));
 const opt=(i,d)=>nodes[i]&&nodes[i].type!=='empty'?toNum(scalar(ev(nodes[i]))):d;
 if(la.length>1&&la[0].length>1)fail('#VALUE!');
 const vertical=la[0].length===1&&(la.length>1||ra.length===1&&ra[0].length===1||ra.length===la.length&&ra[0].length!==1);
 const list=la.flat();
 if((vertical?ra.length:ra[0].length)!==list.length)fail('#VALUE!');
 const i=findIndex(v,list,opt(4,0),opt(5,1));
 if(i<0){if(nodes[3]&&nodes[3].type!=='empty')return ev(nodes[3]);fail('#N/A')}
 return vertical?[ra[i].slice()]:ra.map(r=>[r[i]]);
},'lazy');
def('MATCH',2,3,(v,arr,type)=>{
 v=lookupValue(v);const m=M(arr);
 if(m.length>1&&m[0].length>1)fail('#N/A');
 const list=m.flat(),t=type===undefined?1:toNum(scalar(type));
 const i=t===0?list.findIndex(lookEq(v,false)):approx(list,v,t>0?-1:1);
 if(i<0)fail('#N/A');return i+1;
});
def('XMATCH',2,4,(v,arr,mode,search)=>{
 const i=findIndex(lookupValue(v),M(arr).flat(),mode===undefined?0:toNum(scalar(mode)),search===undefined?1:toNum(scalar(search)));
 if(i<0)fail('#N/A');return i+1;
});
def('INDEX',2,3,(arr,r,c)=>{
 const m=M(arr);
 r=r===undefined?0:Math.trunc(toNum(scalar(r)));c=c===undefined?undefined:Math.trunc(toNum(scalar(c)));
 if(c===undefined){if(m.length===1&&m[0].length>1){c=r;r=1}else c=m[0].length===1?1:0}
 if(r<0||c<0)fail('#VALUE!');if(r>m.length||c>m[0].length)fail('#REF!');
 if(r===0&&c===0)return m;
 if(r===0)return m.map(row=>[row[c-1]]);
 if(c===0)return [m[r-1].slice()];
 const v=m[r-1][c-1];if(v instanceof FErr)fail(v.code);return v;
});
function refOf(node,ev){
 while(node&&node.type==='group')node=node.arg;
 if(!node||node.type==='empty')return null;
 if(node.type==='ref')return {c1:node.col,r1:node.row,c2:node.col,r2:node.row};
 if(node.type==='range')return node;
 const v=ev(node);if(isMat(v)&&v.ref)return v.ref;fail('#VALUE!');
}
def('ROW',0,1,(nodes,ev)=>{const r=refOf(nodes[0],ev);if(!r)return CTX.row||1;return r.r1===r.r2?r.r1:Array.from({length:r.r2-r.r1+1},(_,i)=>[r.r1+i])},'lazy');
def('COLUMN',0,1,(nodes,ev)=>{const r=refOf(nodes[0],ev);if(!r)return (CTX.col??0)+1;return r.c1===r.c2?r.c1+1:[Array.from({length:r.c2-r.c1+1},(_,i)=>r.c1+i+1)]},'lazy');
def('ROWS',1,1,a=>M(a).length);
def('COLUMNS',1,1,a=>M(a)[0].length);

/* 文字列 */
const len=(n,d)=>{n=n===undefined?d:Math.trunc(toNum(n));if(n<0)fail('#VALUE!');return n};
def('LEFT',1,2,(s,n)=>toStr(s).slice(0,len(n,1)),'s');
def('RIGHT',1,2,(s,n)=>{s=toStr(s);n=len(n,1);return n?s.slice(-n):''},'s');
def('MID',3,3,(s,a,n)=>{a=Math.trunc(toNum(a));if(a<1)fail('#VALUE!');return toStr(s).substr(a-1,len(n,0))},'s');
def('LEN',1,1,s=>toStr(s).length,'s');
def('FIND',2,3,(f,s,a)=>{a=a===undefined?1:Math.trunc(toNum(a));s=toStr(s);if(a<1||a>s.length+1)fail('#VALUE!');const i=s.indexOf(toStr(f),a-1);if(i<0)fail('#VALUE!');return i+1},'s');
def('SEARCH',2,3,(f,s,a)=>{
 a=a===undefined?1:Math.trunc(toNum(a));s=toStr(s);if(a<1||a>s.length+1)fail('#VALUE!');
 const re=new RegExp(wildcard(toStr(f)).source.slice(1,-1).replace(/\[\\s\\S\]\*/g,'[\\s\\S]*?'),'i');
 const m=re.exec(s.slice(a-1));if(!m)fail('#VALUE!');return m.index+a;
},'s');
def('UPPER',1,1,s=>toStr(s).toUpperCase(),'s');
def('LOWER',1,1,s=>toStr(s).toLowerCase(),'s');
def('TRIM',1,1,s=>toStr(s).replace(/^ +| +$/g,'').replace(/ {2,}/g,' '),'s');
def('EXACT',2,2,(a,b)=>toStr(a)===toStr(b),'s');
def('REPT',2,2,(s,n)=>toStr(s).repeat(len(n,0)),'s');
def('REPLACE',4,4,(s,a,n,t)=>{s=toStr(s);a=Math.trunc(toNum(a));if(a<1)fail('#VALUE!');return s.slice(0,a-1)+toStr(t)+s.slice(a-1+len(n,0))},'s');
def('CONCATENATE',1,INF,(...a)=>a.map(toStr).join(''),'s');
def('CONCAT',1,INF,(...a)=>a.flatMap(x=>M(x).flat()).map(toStr).join(''));
def('TEXTJOIN',3,INF,(d,skip,...a)=>{skip=toBool(scalar(skip));const ds=M(d).flat().map(toStr);const items=a.flatMap(x=>M(x).flat()).map(toStr).filter(s=>!skip||s!=='');return items.reduce((s,x,i)=>i?s+ds[(i-1)%ds.length]+x:x,'')});
def('JOIN',2,INF,(d,...a)=>a.flatMap(x=>M(x).flat()).map(toStr).join(toStr(scalar(d))),'v','google');
def('SPLIT',2,4,(s,d,each,removeEmpty)=>{s=toStr(scalar(s));d=toStr(scalar(d));const byEach=each===undefined||toBool(scalar(each));let parts=byEach&&d.length>1?s.split(new RegExp('['+d.replace(/[\]\\^-]/g,'\\$&')+']')):s.split(d);if(removeEmpty===undefined||toBool(scalar(removeEmpty)))parts=parts.filter(x=>x!=='');return [parts.map(x=>cellVal(x))]},'v','google');
def('SUBSTITUTE',3,4,(s,o,n,k)=>{
 s=toStr(s);o=toStr(o);n=toStr(n);if(o==='')return s;
 if(k===undefined)return s.split(o).join(n);
 k=Math.trunc(toNum(k));if(k<1)fail('#VALUE!');
 let at=-1;for(let i=0;i<k;i++){at=s.indexOf(o,at+1);if(at<0)return s}
 return s.slice(0,at)+n+s.slice(at+o.length);
},'s');
def('TEXT',2,2,formatText,'s');
def('VALUE',1,1,v=>{if(typeof v==='string'&&v.trim()==='')fail('#VALUE!');return toNum(v)},'s');
const regex=p=>{try{return new RegExp(toStr(p))}catch(e){fail('#VALUE!')}};
def('REGEXMATCH',2,2,(s,p)=>regex(p).test(toStr(s)),'s','google');
def('REGEXEXTRACT',2,2,(s,p)=>{const m=regex(p).exec(toStr(s));if(!m)fail('#N/A');return m[1]??m[0]},'s','google');
def('REGEXREPLACE',3,3,(s,p,r)=>toStr(s).replace(new RegExp(regex(p).source,'g'),toStr(r)),'s','google');

/* 数値 */
def('ROUND',1,2,(x,d=0)=>roundTo(x,d,'round'),'s');
def('ROUNDUP',1,2,(x,d=0)=>roundTo(x,d,'up'),'s');
def('ROUNDDOWN',1,2,(x,d=0)=>roundTo(x,d,'down'),'s');
def('INT',1,1,x=>Math.floor(toNum(x)),'s');
def('ABS',1,1,x=>Math.abs(toNum(x)),'s');
def('SQRT',1,1,x=>{x=toNum(x);if(x<0)fail('#NUM!');return Math.sqrt(x)},'s');
def('POWER',2,2,(a,b)=>clean(toNum(a)**toNum(b)),'s');
def('MOD',2,2,(n,d)=>{n=toNum(n);d=toNum(d);if(!d)fail('#DIV/0!');return clean(n-d*Math.floor(n/d))},'s');
def('CEILING',1,2,(x,s=1)=>{x=toNum(x);s=toNum(s);return s?clean(Math.ceil(Number((x/s).toPrecision(15)))*s):0},'s');
def('FLOOR',1,2,(x,s=1)=>{x=toNum(x);s=toNum(s);if(!s)fail('#DIV/0!');return clean(Math.floor(Number((x/s).toPrecision(15)))*s)},'s');
function rank(n,ref,order){
 n=toNum(scalar(n));const list=nums([M(ref)]),asc=order!==undefined&&toNum(scalar(order))!==0;
 if(!list.includes(n))fail('#N/A');
 return 1+list.filter(x=>asc?x<n:x>n).length;
}
def('RANK RANK.EQ',2,3,rank);
def('LARGE',2,2,(a,k)=>{const n=nums([M(a)]).sort((x,y)=>y-x);k=Math.trunc(toNum(scalar(k)));if(k<1||k>n.length)fail('#NUM!');return n[k-1]});
def('SMALL',2,2,(a,k)=>{const n=nums([M(a)]).sort((x,y)=>x-y);k=Math.trunc(toNum(scalar(k)));if(k<1||k>n.length)fail('#NUM!');return n[k-1]});

/* 日付 */
const now=()=>{const d=CTX&&CTX.now?new Date(CTX.now):new Date();return serial(d.getFullYear(),d.getMonth()+1,d.getDate())+(d.getHours()*3600+d.getMinutes()*60+d.getSeconds())/86400};
def('TODAY',0,0,()=>Math.floor(now()));
def('NOW',0,0,()=>now());
def('DAY',1,1,v=>dateParts(v).d,'s');
def('MONTH',1,1,v=>dateParts(v).m,'s');
def('YEAR',1,1,v=>dateParts(v).y,'s');
def('WEEKDAY',1,2,(v,t=1)=>{const w=dateParts(v).w;t=toNum(t);return t===2?(w+6)%7+1:t===3?(w+6)%7:w+1},'s');
def('DATE',3,3,(y,m,d)=>serial(Math.trunc(toNum(y)),Math.trunc(toNum(m)),Math.trunc(toNum(d))),'s');
const addMonths=(v,k,end)=>{const p=dateParts(v),t=p.y*12+p.m-1+Math.trunc(toNum(k)),y=Math.floor(t/12),m=t%12+1,last=fromSerial(serial(y,m+1,1)-1).getUTCDate();return serial(y,m,end?last:Math.min(p.d,last))};
def('EDATE',2,2,(v,k)=>addMonths(v,k,false),'s');
def('EOMONTH',2,2,(v,k)=>addMonths(v,k,true),'s');
def('DAYS',2,2,(e,s)=>Math.floor(toNum(e))-Math.floor(toNum(s)),'s');
def('DATEDIF',3,3,(s,e,u)=>{
 s=Math.floor(toNum(s));e=Math.floor(toNum(e));if(s>e)fail('#NUM!');
 const a=dateParts(s),b=dateParts(e),months=(b.y-a.y)*12+b.m-a.m-(b.d<a.d?1:0);
 switch(toStr(u).toUpperCase()){
  case 'Y':return Math.floor(months/12);
  case 'M':return months;
  case 'D':return e-s;
  case 'YM':return months%12;
  case 'MD':return b.d>=a.d?b.d-a.d:e-serial(b.y,b.m-1,a.d);
  case 'YD':{let t=serial(b.y,a.m,a.d);if(t>e)t=serial(b.y-1,a.m,a.d);return e-t}
  default:fail('#NUM!');
 }
},'s');

/* 配列 */
def('UNIQUE',1,3,(a,byCol,once)=>{
 let m=M(a);const cols=byCol!==undefined&&toBool(scalar(byCol));if(cols)m=transpose(m);
 const key=r=>JSON.stringify(r.map(v=>v instanceof FErr?['e',v.code]:typeof v==='string'?v.toLowerCase():v)),count=new Map();
 for(const r of m)count.set(key(r),(count.get(key(r))||0)+1);
 const seen=new Set();let out=m.filter(r=>{const k=key(r);if(seen.has(k))return false;seen.add(k);return true});
 if(once!==undefined&&toBool(scalar(once)))out=out.filter(r=>count.get(key(r))===1);
 if(!out.length)fail('#CALC!');
 return cols?transpose(out):out;
});
def('FILTER',2,INF,(a,inc,...rest)=>{
 let m=M(a);const conds=[inc];let ifEmpty;
 const fits=c=>isMat(c)&&m.length*m[0].length>1&&((c.length===m.length&&c[0].length===1)||(c.length===1&&c[0].length===m[0].length));
 rest.forEach((x,i)=>{if(fits(x))conds.push(x);else if(i===0&&rest.length===1)ifEmpty=x;else fail('#VALUE!')});
 const src=m,empty=()=>{if(ifEmpty!==undefined)return ifEmpty;fail('#CALC!')};
 const cs=conds.map(M);
 if(cs.every(c=>c.length===src.length&&c[0].length===1)){
  m=src.filter((_,i)=>cs.every(c=>toBool(c[i][0])));
  return m.length?m:empty();
 }
 if(cs.every(c=>c.length===1&&c[0].length===src[0].length)){
  const keep=src[0].map((_,j)=>cs.every(c=>toBool(c[0][j])));
  return keep.some(Boolean)?src.map(r=>r.filter((_,j)=>keep[j])):empty();
 }
 fail('#VALUE!');
});
def('SORT',1,INF,(a,...o)=>{
 let m=M(a).map(r=>r.slice());
 const byCol=o.length===3&&o[2]!==undefined&&toBool(scalar(o[2]));if(byCol)m=transpose(m);
 const keys=[];
 const pairs=o.length===3?o.slice(0,2):o;
 for(let i=0;i<Math.max(pairs.length,1);i+=2){
  const idx=pairs[i]===undefined?1:Math.trunc(toNum(scalar(pairs[i]))),ord=pairs[i+1]===undefined?1:scalar(pairs[i+1]);
  if(idx<1||idx>m[0].length)fail('#VALUE!');
  const asc=typeof ord==='boolean'?ord:toNum(ord)===1?true:toNum(ord)===-1||toNum(ord)===0?false:fail('#VALUE!');
  keys.push([idx-1,asc]);
 }
 m=m.map((r,i)=>[r,i]).sort((x,y)=>{
  for(const [k,asc] of keys){const {blank,c}=sortCmp(x[0][k],y[0][k]);if(c)return blank||asc?c:-c}
  return x[1]-y[1];
 }).map(x=>x[0]);
 return byCol?transpose(m):m;
});
def('TRANSPOSE',1,1,a=>transpose(M(a)));
def('ARRAYFORMULA',1,1,a=>a,'v','google');
def('ARRAY_CONSTRAIN',3,3,(a,r,c)=>{r=Math.trunc(toNum(scalar(r)));c=Math.trunc(toNum(scalar(c)));if(r<1||c<1)fail('#VALUE!');return M(a).slice(0,r).map(row=>row.slice(0,c))},'v','google');
def('SEQUENCE',1,4,(r,c,s,st)=>{const n=(x,d)=>x===undefined?d:toNum(scalar(x));const R=Math.trunc(n(r,1)),C=Math.trunc(n(c,1));if(R<1||C<1||R*C>MAX_CELLS)fail('#CALC!');return Array.from({length:R},(_,i)=>Array.from({length:C},(_,j)=>clean(n(s,1)+(i*C+j)*n(st,1))))});
def('QUERY',2,3,()=>fail('#UNSUPPORTED'),'lazy','google');
def('IMPORTRANGE',2,2,()=>fail('#UNSUPPORTED'),'lazy','google');

/* ---------- 実行 ---------- */
const BIN={
 '+':(a,b)=>clean(toNum(a)+toNum(b)),'-':(a,b)=>clean(toNum(a)-toNum(b)),'*':(a,b)=>clean(toNum(a)*toNum(b)),
 '/':(a,b)=>{a=toNum(a);b=toNum(b);if(!b)fail('#DIV/0!');return clean(a/b)},
 '^':(a,b)=>{const v=toNum(a)**toNum(b);if(!Number.isFinite(v))fail('#NUM!');return clean(v)},
 '&':(a,b)=>toStr(a)+toStr(b),
 '=':(a,b)=>cmpVals(a,b)===0,'<>':(a,b)=>cmpVals(a,b)!==0,'<':(a,b)=>cmpVals(a,b)<0,'>':(a,b)=>cmpVals(a,b)>0,'<=':(a,b)=>cmpVals(a,b)<=0,'>=':(a,b)=>cmpVals(a,b)>=0
};
function ev(node){
 switch(node.type){
  case 'num':case 'str':case 'bool':return node.value;
  case 'empty':return undefined;
  case 'group':return ev(node.arg);
  case 'array':return node.rows.map(r=>r.map(v=>typeof v==='string'&&ERR_RE.test(v)?new FErr(v):v));
  case 'name':fail('#NAME?');
  case 'ref':if(node.sheet)fail('#REF!');return readRange(node.col,node.row,node.col,node.row);
  case 'range':if(node.sheet)fail('#REF!');return readRange(node.c1,node.r1,node.c2,node.r2);
  case 'unary':return bmap([ev(node.arg)],v=>{const n=-toNum(v);return n===0?0:n});
  case 'percent':return bmap([ev(node.arg)],v=>clean(toNum(v)/100));
  case 'binary':return bmap([ev(node.left),ev(node.right)],BIN[node.op]);
  case 'call':{
   const f=Object.hasOwn(FN,node.name)?FN[node.name]:null;
   if(!f)fail('#NAME?');
   if(node.args.length<f.min||node.args.length>f.max)fail(node.name==='QUERY'||node.name==='IMPORTRANGE'?'#UNSUPPORTED':'#N/A');
   if(f.kind==='lazy')return f.impl(node.args,ev);
   const args=node.args.map(ev);
   return f.kind==='s'?bmap(args,f.impl):f.impl(...args);
  }
 }
 fail('#VALUE!');
}
function output(v){
 const fix=x=>x===null||x===undefined?'':x instanceof FErr?x.code:typeof x==='number'?(Number.isFinite(x)?clean(x):'#NUM!'):x;
 if(!isMat(v))v=[[v]];
 if(!v.length||!v[0].length)fail('#CALC!');
 if(v.length===1&&v[0].length===1){const x=fix(v[0][0]);if(v[0][0] instanceof FErr||x==='#NUM!')fail(x);return [[x]]}
 return v.map(r=>r.map(fix));
}
function evaluate(formula,getCell,context){
 let ast;
 try{ast=typeof formula==='string'?parse(formula):formula}
 catch(e){const err=new Error('#VALUE!');err.detail=e.message;throw err}
 const saved=CTX;
 CTX=Object.assign({},context,{get:getCell||(()=>'')});
 try{return output(ev(ast))}
 catch(e){
  if(e instanceof RangeError){const err=new Error('#VALUE!');err.detail=e.message;throw err}
  throw e;
 }
 finally{CTX=saved}
}

/* ---------- 静的検証 ---------- */
const PARITY={SUMIFS:1,AVERAGEIFS:1,MAXIFS:1,MINIFS:1,COUNTIFS:0,IFS:0};
const SIZE_ARGS={SUMIFS:1,AVERAGEIFS:1,MAXIFS:1,MINIFS:1,COUNTIFS:0};
function check(formula,opts){
 opts=opts||{};const errors=[],add=(code,message)=>errors.push({code,message});
 const src=String(formula??'');
 let depth=0,inStr=false,extra=false;
 for(const ch of src){
  if(ch==='"')inStr=!inStr;
  else if(!inStr){if(ch==='(')depth++;else if(ch===')'&&--depth<0){extra=true;depth=0}}
 }
 if(inStr)add('quote','文字列の引用符 " が閉じられていません。');
 else if(extra)add('paren','閉じ括弧 ) が多すぎます。開き括弧 ( と数を合わせてください。');
 else if(depth>0)add('paren','閉じ括弧 ) が '+depth+' 個足りません。');
 if(errors.length)return {ok:false,errors};
 let ast;
 try{ast=parse(src)}catch(e){add(e.code||'syntax',e.message);return {ok:false,errors}}
 const platform=/google|スプレッドシート|sheets/i.test(opts.platform||'')?'google':/excel/i.test(opts.platform||'')?'excel':null;
 const b=opts.bounds;
 const label=n=>n.type==='ref'?colName(n.col)+n.row:n.whole?colName(n.c1)+':'+colName(n.c2):colName(n.c1)+n.r1+':'+colName(n.c2)+n.r2;
 const rect=n=>n.type==='ref'?{c1:n.col,r1:n.row,c2:n.col,r2:n.row}:n.type==='range'?n:null;
 const strip=n=>{while(n&&n.type==='group')n=n.arg;return n};
 const size=n=>{const r=rect(strip(n));return r?(r.r2-r.r1+1)+'x'+(r.c2-r.c1+1):null};
 (function walk(n){
  if(!n||typeof n!=='object')return;
  if(n.type==='name')add('unknown_name','「'+n.name+'」は関数でもセル参照でもありません。文字列は " で囲んでください。');
  if((n.type==='ref'||n.type==='range')&&b&&!n.sheet){
   const r=rect(n);
   if(r.c2<b.left||r.c1>b.right||r.r2<b.top||r.r1>b.bottom)add('ref',label(n)+' はデータ範囲('+colName(b.left)+b.top+':'+colName(b.right)+b.bottom+')の外を参照しています。');
  }
  if(n.type==='call'){
   const f=Object.hasOwn(FN,n.name)?FN[n.name]:null,count=n.args.length;
   if(!f)add('unknown_function','関数 '+n.name+' は存在しないか、未対応です。');
   else{
    const want=f.max===INF?f.min+' 個以上':f.min===f.max?f.min+' 個':f.min+'〜'+f.max+' 個';
    if(count<f.min||count>f.max)add('arity',n.name+' の引数は '+want+' です(現在 '+count+' 個)。');
    else if(n.name in PARITY&&count%2!==PARITY[n.name])add('arity',n.name+' は「範囲, 条件」を組で指定します(引数の数が合っていません)。');
    if(platform&&f.platform!=='both'&&f.platform!==platform)add('platform',n.name+' は '+(f.platform==='google'?'Google スプレッドシート':'Excel')+' 専用の関数で、'+(platform==='google'?'Google スプレッドシート':'Excel')+' では使えません。');
    let group=null;
    if(n.name in SIZE_ARGS)group=n.args.filter((_,i)=>i===0||(i>=SIZE_ARGS[n.name]&&(i-SIZE_ARGS[n.name])%2===0));
    else if(n.name==='SUMIF'||n.name==='AVERAGEIF')group=[n.args[0],n.args[2]];
    else if(n.name==='SUMPRODUCT')group=n.args;
    if(group){
     const sizes=group.filter(Boolean).map(a=>[strip(a),size(a)]).filter(x=>x[1]);
     const bad=sizes.find(x=>x[1]!==sizes[0][1]);
     if(bad)add('range_size',n.name+' の範囲の大きさが揃っていません('+label(sizes[0][0])+' と '+label(bad[0])+')。');
    }
   }
   n.args.forEach(walk);
  }
  walk(n.left);walk(n.right);walk(n.arg);
 })(ast);
 return {ok:!errors.length,errors};
}

const spec={};
for(const [name,f] of Object.entries(FN))spec[name]={min:f.min,max:f.max,platform:f.platform};
return {parse,check,evaluate,functions:Object.keys(FN),spec,colName,colIndex};
});
