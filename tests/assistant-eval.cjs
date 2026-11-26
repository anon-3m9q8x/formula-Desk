// 関数アシスタントの評価: node tests/assistant-eval.cjs [--write-expected] [--verbose]
const fs=require('fs'),path=require('path');
const A=require('../dist/assistant.js');
let E=null;try{E=require('../dist/engine.js');E=E.FormulaEngine||E}catch(e){}
const file=path.join(__dirname,'eval-set.json'),set=JSON.parse(fs.readFileSync(file,'utf8'));
const write=process.argv.includes('--write-expected'),verbose=process.argv.includes('--verbose');
const colName=n=>{let s='';for(n++;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
const sheet=(t,cells)=>(c,r)=>{const k=colName(c)+r;if(cells&&k in cells)return String(cells[k]);const ci=c-t.left;if(ci<0||ci>=t.headers.length)return '';if(r===t.topRow)return t.headers[ci];const ri=r-t.topRow-1;return ri>=0&&ri<t.data.length?t.data[ri][ci]:''};
const run=(f,g)=>{try{return E.evaluate(f,g)}catch(e){return {error:String(e.message||e)}}};
const normF=f=>String(f).replace(/\s+/g,'').toUpperCase();
const same=A._internal.same;
if(!E){console.error('dist/engine.js が読み込めないため、結果値での判定ができません。');process.exit(2)}
let correct=0,answered=0,syntaxOk=0,falseVerified=0,unanswered=0,verified=0,expectFormula=0;const fails=[],byCat={};
for(const q of set.questions){
 const t=set.tables[q.table],g=sheet(t,q.cells);
 const r=A.propose(q.question,{headers:t.headers,data:t.data,left:t.left,topRow:t.topRow,platform:q.platform,cells:q.cells});
 let ok=false,why='';
 if(q.expect_status){ok=r.status===q.expect_status;why=ok?'':'status='+r.status+' '+(r.formula||'')}
 else{
  expectFormula++;
  let expected=q.expected;
  if(q.compare!=='formula'&&(write||q.dynamic||expected===undefined)){expected=run(q.answer,g);if(expected&&expected.error&&!q.allow_error)throw new Error(q.id+': 参照式がエラー '+q.answer+' → '+expected.error);if(write&&!q.dynamic)q.expected=expected}
  if(!r.formula){unanswered++;why='未回答('+r.status+'): '+(r.message||'')}
  else{answered++;
   const chk=E.check(r.formula,{platform:q.platform,bounds:{left:0,top:1,right:40,bottom:200}});if(chk.ok)syntaxOk++;
   if(q.compare==='formula'){ok=normF(r.formula)===normF(q.answer)}else{const actual=run(r.formula,g);ok=!(actual&&actual.error&&!(expected&&expected.error))&&same(expected,actual);if(!ok)why=r.formula+' → '+JSON.stringify(actual).slice(0,120)+' / 期待 '+JSON.stringify(expected).slice(0,120)}
   if(!ok&&!why)why=r.formula+' ≠ '+q.answer}
  if(r.status==='verified'){verified++;if(!ok)falseVerified++}}
 if(ok)correct++;else fails.push(q.id+' ['+q.category+'/'+q.platform+'] '+q.question+'\n    '+why);
 const k=q.category;byCat[k]=byCat[k]||[0,0];byCat[k][1]++;if(ok)byCat[k][0]++;
 if(verbose)console.log((ok?'OK ':'NG ')+q.id+' '+r.status.padEnd(11)+' '+q.question+'  =>  '+(r.formula||r.message));
}
if(write)fs.writeFileSync(file,JSON.stringify(set,null,1));
const n=set.questions.length,pct=(a,b)=>b?(a/b*100).toFixed(1)+'%':'-';
console.log('問題数: '+n+'(数式を期待 '+expectFormula+' / 確認を期待 '+(n-expectFormula)+')');
console.log('意味正答率: '+correct+'/'+n+' = '+pct(correct,n));
console.log('構文成功率: '+syntaxOk+'/'+answered+' = '+pct(syntaxOk,answered)+'(出力した数式のうち静的検証を通った割合)');
console.log('誤った verified 出力: '+falseVerified+' 件 / verified '+verified+' 件 = '+pct(falseVerified,verified));
console.log('未回答率: '+unanswered+'/'+expectFormula+' = '+pct(unanswered,expectFormula)+'(数式を期待する問題で式を出さなかった割合)');
console.log('分類別: '+Object.entries(byCat).map(([k,v])=>k+' '+v[0]+'/'+v[1]).join(', '));
if(fails.length){console.log('\n不正解:');fails.forEach(f=>console.log('  '+f))}
process.exit(correct/n>=0.8&&falseVerified===0?0:1);
