function questionText(value){
 return String(value).normalize('NFKC').replace(/締め?切り?/g,'締切').replace(/[「」『』\s]/g,'');
}
function questionAggregate(text,headers,data,range){
 const q=questionText(text);
 const operation=/平均/.test(q)?'AVERAGE':/件数|何件|数え/.test(q)?'COUNT':/合計|総額|合算/.test(q)?'SUM':null;
 if(!operation||!data.length)return null;
 const conditions=[];
 const fields=headers.map((header,col)=>{
  const full=questionText(header);
  const names=[full,full.replace(/^(留学|募集|実施)/,'')].filter(Boolean);
  const alias=names.find(n=>q.includes(n));
  return {col,alias,names,header};
 });
 for(const f of fields){
  if(!f.header.trim())continue;
  const pos=f.alias?q.indexOf(f.alias):-1;
  const after=pos<0?'':q.slice(pos+f.alias.length);
  if(/^(?:欄)?(?:が|は|の|を)?(?:なく|ない|なし|無し|無く|空白|空欄|未入力|未設定)/.test(after)){
   conditions.push({col:f.col,value:'',pos});continue;
  }
  const values=[...new Set(data.map(r=>String(r[f.col]??'')).filter(Boolean))];
  const found=values.filter(v=>!/^\d+$/.test(v)&&q.includes(questionText(v))).sort((a,b)=>b.length-a.length);
  if(found.length){conditions.push({col:f.col,value:found[0],pos:q.indexOf(questionText(found[0]))});continue}
  const duration=f.names.includes('期間')&&q.match(/\d+(?:週間|か月|ヶ月|日間)/);
  if(duration)conditions.push({col:f.col,value:duration[0],pos:Math.min(...[pos,duration.index].filter(n=>n>=0))});
 }
 conditions.sort((a,b)=>a.pos-b.pos);
 if(!conditions.length||conditions.length===1&&conditions[0].value!=='')return null;
 if(/または|またわ|もしくは|あるいは|以外|以上|以下|未満/.test(q))return {error:'条件を特定できません。列名と、一致させる値または「空欄」を指定してください。'};
 const numeric=fields.filter(f=>!conditions.some(c=>c.col===f.col)&&data.some(r=>r[f.col]?.trim())&&data.every(r=>!r[f.col]?.trim()||numberCell(r[f.col])));
 const targets=numeric.filter(f=>f.alias);
 const target=targets.length===1?targets[0]:numeric.length===1?numeric[0]:null;
 if(operation!=='COUNT'&&!target)return {error:'集計する数値列を特定できません。「留学費用の合計」のように列名を指定してください。'};
 const fn=operation+'IFS';
 const args=operation==='COUNT'?[]:[range(target.col)];
 for(const c of conditions)args.push(range(c.col),'"'+c.value.replaceAll('"','""')+'"');
 return {fn,formula:'='+fn+'('+args.join(',')+')',target:target?.col,conditions,note:conditions.map(c=>'「'+headers[c.col]+'」が'+(c.value?'「'+c.value+'」':'空欄')).join('、')+'の行を対象にします。'};
}
