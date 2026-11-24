function letters(c){let s='';for(c++;c;c=Math.floor((c-1)/26))s=String.fromCharCode(65+(c-1)%26)+s;return s}
function point(a){const m=/^([A-Z]{1,3})([1-9]\d*)$/.exec(a);if(!m)throw Error('セル番地を確認してください。');return {c:columnIndex(m[1]),r:Number(m[2])}}
function address(c,r){return letters(c)+r}
function populated(sheet){
  const cells=new Map();
  sheet.rows.forEach((row,i)=>row.forEach((value,j)=>{if(value!=='')cells.set(address(sheet.left+j,sheet.topRow+i),{value})}));
  for(const [a,v] of Object.entries(sheet.calculated))cells.set(a,v);
  return cells;
}
const xmlEscape=v=>String(v).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const xmlHead='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const mainNS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const relNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const pkgNS='http://schemas.openxmlformats.org/package/2006/relationships';
function numberCell(v){return typeof v==='number'||/^-?(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d+)?$/.test(String(v))}
async function buildBook(book){
  const z=new JSZip(), names=[], links=[], types=[];
  for(const [i,s] of book.entries()){
    const n=i+1,path='worksheets/sheet'+n+'.xml';
    names.push('<sheet name="'+xmlEscape(s.name)+'" sheetId="'+n+'" r:id="r'+n+'"/>');links.push('<Relationship Id="r'+n+'" Type="'+relNS+'/worksheet" Target="'+path+'"/>');types.push('<Override PartName="/xl/'+path+'" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
    const lines=new Map();
    for(const [a,cell] of populated(s)){
      if(cell.spill)continue;
      const {r,c}=point(a),v=cell.value??'',num=numberCell(v),typed=num?String(v).replaceAll(',',''):xmlEscape(v);
      let f=cell.formula?.slice(1);if(f)f=f.replace(/^FILTER\(/,'_xlfn._xlws.FILTER(').replace(/^UNIQUE\(/,'_xlfn.UNIQUE(');
      const content=f?'<c r="'+a+'" t="'+(num?'n':'str')+'"><f>'+xmlEscape(f)+'</f><v>'+typed+'</v></c>':num?'<c r="'+a+'"><v>'+typed+'</v></c>':'<c r="'+a+'" t="inlineStr"><is><t xml:space="preserve">'+xmlEscape(v)+'</t></is></c>';
      if(!lines.has(r))lines.set(r,[]);lines.get(r).push([c,content]);
    }
    const data=Array.from(lines).sort((a,b)=>a[0]-b[0]).map(([r,cells])=>'<row r="'+r+'">'+cells.sort((a,b)=>a[0]-b[0]).map(x=>x[1]).join('')+'</row>').join('');
    z.file('xl/'+path,xmlHead+'<worksheet xmlns="'+mainNS+'"><sheetData>'+data+'</sheetData></worksheet>');
  }
  z.file('[Content_Types].xml',xmlHead+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+types.join('')+'</Types>');
  z.file('_rels/.rels',xmlHead+'<Relationships xmlns="'+pkgNS+'"><Relationship Id="r1" Type="'+relNS+'/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  z.file('xl/workbook.xml',xmlHead+'<workbook xmlns="'+mainNS+'" xmlns:r="'+relNS+'"><sheets>'+names.join('')+'</sheets><calcPr fullCalcOnLoad="1"/></workbook>');
  z.file('xl/_rels/workbook.xml.rels',xmlHead+'<Relationships xmlns="'+pkgNS+'">'+links.join('')+'</Relationships>');
  return z.generateAsync({type:'blob',compression:'DEFLATE'});
}
async function loadBook(file){
 const zip=await JSZip.loadAsync(file);
 async function xml(path){const entry=zip.file(path);if(!entry)throw Error('ブックの構造を読み取れません。');const doc=new DOMParser().parseFromString(await entry.async('string'),'application/xml');if(doc.querySelector('parsererror'))throw Error('XML形式が不正です。');return doc}
 const book=await xml('xl/workbook.xml'), rels=await xml('xl/_rels/workbook.xml.rels'),paths=new Map(Array.from(rels.getElementsByTagName('Relationship'),n=>[n.getAttribute('Id'),new URL(n.getAttribute('Target'),'https://local/xl/workbook.xml').pathname.slice(1)]));
 const strings=zip.file('xl/sharedStrings.xml')?Array.from((await xml('xl/sharedStrings.xml')).getElementsByTagName('si'),n=>n.textContent):[], result=[];
 for(const item of book.getElementsByTagName('sheet')){
   const doc=await xml(paths.get(item.getAttributeNS(relNS,'id'))),cells=[], formulas={};
   let left=Infinity,top=Infinity,right=-1,bottom=0;
   for(const node of doc.getElementsByTagName('c')){
     const a=node.getAttribute('r'),t=node.getAttribute('t'),f=node.querySelector('f'),v=node.querySelector('v')?.textContent??'';
     const value=t==='s'?strings[Number(v)]??'':t==='inlineStr'?node.querySelector('is')?.textContent??'':v;
     if(value===''&&!f)continue;
     const {c,r}=point(a);left=Math.min(left,c);right=Math.max(right,c);top=Math.min(top,r);bottom=Math.max(bottom,r);cells.push({c,r,value});
     if(f){if(!f.textContent)throw Error('共有数式の展開には未対応です。対象範囲をコピーして貼り付けてください。');formulas[a]={formula:'='+f.textContent,value}}
   }
   if(!cells.length){left=0;top=1;bottom=1;right=-1}
   if((bottom-top+1)*(right-left+1)>200000||bottom-top>4999||right-left>511)throw Error('読み込み範囲は5,000行・512列・20万セル以内にしてください。');
   const rows=Array.from({length:bottom-top+1},()=>Array(right-left+1).fill(''));
   for(const cell of cells)rows[cell.r-top][cell.c-left]=cell.value;
   result.push({rows,left,topRow:top,name:item.getAttribute('name'),calculated:formulas});
 }
 if(!result.length)throw Error('シートが見つかりません。');return result;
}
