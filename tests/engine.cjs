const assert = require('node:assert/strict');
const E = require('../dist/engine.js');

// 表: B9 見出し、B10:I25 データ(import-positions.cjs と同じ留学プラン表)
const countries = ['アメリカ','アメリカ','アメリカ','アメリカ','アメリカ','イギリス','オーストラリア','オーストラリア','カナダ','カナダ','カナダ','韓国','韓国','韓国','ヨーロッパ','ヨーロッパ'];
const cities = 'サンフランシスコ シアトル マイアミ ニューヨーク ロサンゼルス ロンドン シドニー メルボルン バンクーバー モントリオール トロント ソウル インチョン プサン パリ アイルランド'.split(' ');
const weeks = [2,3,2,4,4,4,1,3,1,1,2,2,1,2,2,3];
const costs = '306,000 425,000 561,000 716,000 750,000 604,000 270,000 550,000 259,000 373,000 375,000 249,000 154,000 139,000 310,000 445,000'.split(' ');
const full = '定員に達し次第終了';
const deadlines = ['','7月15日まで','8月31日まで',full,full,'10月1日まで',full,'8月31日まで',full,'','12月31日まで','','',full,'','9月30日まで'];
const slots = {3:'4枠',4:'2枠',6:'10枠',8:'5枠',13:'6枠'};
const schools = '上智 明治 上智 明治 中央 明治 法政 明治 明治 上智 明治 日本 日本 法政 明治 上智'.split(' ');
const rebates = [10,5,0,0,0,0,5,15,5,0,10,5,5,5,5,15];
const sheet = {};
const put = (a, v) => { sheet[a] = v; };
['国','都市','留学期間','留学費用','募集締め切り','残り枠','実施大学','キャンセル料'].forEach((h, i) => put(E.colName(1 + i) + 9, h));
cities.forEach((city, i) => [countries[i], city, weeks[i] + '週間', costs[i], deadlines[i], slots[i] || '', schools[i] + '大学', rebates[i] ? '費用の' + rebates[i] + '%バック' : 'バックなし']
  .forEach((v, j) => put(E.colName(1 + j) + (10 + i), v)));
// 補助表: K1:N6(名前・点数・日付・コード)
[['名前','点数','入社日','コード'],['佐藤',80,'2020/4/1','ab-001'],['鈴木','1,200','2021-10-15','CD-002'],['高橋',65,'2019年7月20日','ef-003'],['田中',80,'2024/4/30','gh-004'],['伊藤','','2022/1/5','']]
  .forEach((row, i) => row.forEach((v, j) => put(E.colName(10 + j) + (1 + i), v)));
put('P1', '  Hello   World  '); put('P2', '#N/A'); put('P3', 0); put('P4', 'TRUE');
const get = (c, r) => sheet[E.colName(c) + r] ?? '';
const ev = f => E.evaluate(f, get);
const one = f => { const m = ev(f); assert.equal(m.length, 1, f); assert.equal(m[0].length, 1, f); return m[0][0]; };
const err = (f, code) => assert.throws(() => ev(f), e => e.message === code, f + ' → ' + code);
let n = 0;
const failures = [];
const attempt = fn => { n++; try { fn(); } catch (e) { failures.push(e.message.split('\n').slice(0, 6).join(' | ')); } };
const eq = (f, expected) => attempt(() => assert.deepEqual(one(f), expected, f));
const mat = (f, expected) => attempt(() => assert.deepEqual(ev(f), expected, f));
const bad = (f, code) => attempt(() => err(f, code));

// --- 演算子・リテラル
eq('=1+2*3', 7); eq('1+2*3', 7); eq('=(1+2)*3', 9); eq('=-2^2', 4); eq('=2^3^2', 64); eq('=50%*200', 100);
eq('="a"&"b"&1', 'ab1'); eq('="彼は""はい""と言った"', '彼は"はい"と言った'); eq('=TRUE', true); eq('=1=1', true);
eq('="a"<>"A"', false); eq('=3>=2', true); eq('=0.1+0.2', 0.3); eq('=$E$10+E$11+$E12', 306000 + 425000 + 561000);
bad('=1/0', '#DIV/0!'); bad('="a"+1', '#VALUE!'); bad('=FOO(1)', '#NAME?'); bad('=abc', '#NAME?'); bad('=P2+1', '#N/A');
mat('=B10:C11', [['アメリカ','サンフランシスコ'],['アメリカ','シアトル']]);
mat('=L2:L4*2', [[160],[2400],[130]]); mat('={1,2;3,4}*10', [[10,20],[30,40]]);

// --- 集計
eq('=SUM(E10:E25)', 6486000); eq('=SUM(L2:L6,1,"2")', 1428); eq('=AVERAGE(L2:L6)', 356.25); eq('=MAX(E10:E25)', 750000);
eq('=MIN(E10:E25)', 139000); eq('=COUNT(L1:L6)', 4); eq('=COUNTA(G10:G25)', 5); eq('=COUNTBLANK(G10:G25)', 11);
eq('=MEDIAN(L2:L5)', 80); eq('=SUMPRODUCT((B10:B25="カナダ")*(E10:E25))', 1007000); eq('=SUMPRODUCT(L2:L3,L4:L5)', 80 * 65 + 1200 * 80);
bad('=AVERAGE(B10:B25)', '#DIV/0!');

// --- 条件付き集計
eq('=SUMIFS(E10:E25,G10:G25,"",D10:D25,"3週間")', 1420000);
eq('=SUMIF(B10:B25,"カナダ",E10:E25)', 1007000); eq('=SUMIF(E10:E25,">=600000")', 716000 + 750000 + 604000);
eq('=SUMIF(B10:B25,"韓国",E10)', 542000);
eq('=COUNTIF(B10:B25,"アメリカ")', 5); eq('=COUNTIF(G10:G25,"*枠")', 5); eq('=COUNTIF(G10:G25,"<>")', 5); eq('=COUNTIF(G10:G25,"")', 11);
eq('=COUNTIF(C10:C25,"ロ*")', 2); eq('=COUNTIF(C10:C25,"??")', 1); eq('=COUNTIF(B10:B25,"<>アメリカ")', 11);
eq('=COUNTIF(E10:E25,"<=300000")', 5); eq('=COUNTIF(E10:E25,"3*")', 0); eq('=COUNTIF(N2:N5,"AB-001")', 1);
eq('=COUNTIFS(E10:E25,">=300000",E10:E25,"<=600000")', 8); eq('=COUNTIFS(B10:B25,"アメリカ",D10:D25,"4週間")', 2);
eq('=AVERAGEIF(B10:B25,"韓国",E10:E25)', Number((542000 / 3).toPrecision(15))); eq('=AVERAGEIFS(E10:E25,B10:B25,"カナダ",D10:D25,"1週間")', 316000);
eq('=MAXIFS(E10:E25,B10:B25,"アメリカ")', 750000); eq('=MINIFS(E10:E25,B10:B25,"アメリカ")', 306000);
eq('=COUNTIF(M2:M6,">=2021/1/1")', 3);
bad('=SUMIFS(E10:E25,B10:B24,"カナダ")', '#VALUE!'); bad('=AVERAGEIF(B10:B25,"日本",E10:E25)', '#DIV/0!');

// --- 論理
eq('=IF(L2>=70,"合格","不合格")', '合格'); eq('=IF(L4>=70,"合格")', false); eq('=IFS(L4>=80,"A",L4>=60,"B",TRUE,"C")', 'B');
eq('=IFERROR(VLOOKUP("中国",B10:E25,4,FALSE),"該当なし")', '該当なし'); eq('=IFERROR(1/0,0)', 0); eq('=IFERROR(5,0)', 5);
eq('=AND(L2>70,L4>60)', true); eq('=OR(L2>90,L4>90)', false); eq('=NOT(P4)', false);
mat('=IF(L2:L4>=80,"○","×")', [['○'],['○'],['×']]);
bad('=IFS(1>2,"a")', '#N/A');

// --- 検索
eq('=VLOOKUP("ロンドン",C10:E25,3,FALSE)', 604000); eq('=VLOOKUP("シド*",C10:E25,2,0)', '1週間');
bad('=VLOOKUP("東京",C10:E25,3,FALSE)', '#N/A'); bad('=VLOOKUP("ロンドン",C10:E25,9,FALSE)', '#REF!');
eq('=VLOOKUP(70,{0,"C";60,"B";80,"A"},2)', 'B'); eq('=HLOOKUP("点数",K1:N6,3,FALSE)', 1200);
eq('=XLOOKUP("パリ",C10:C25,E10:E25)', 310000); eq('=XLOOKUP("東京",C10:C25,E10:E25,"なし")', 'なし');
mat('=XLOOKUP("パリ",C10:C25,B10:D25)', [['ヨーロッパ','パリ','2週間']]); bad('=XLOOKUP("東京",C10:C25,E10:E25)', '#N/A');
eq('=INDEX(C10:C25,MATCH(MAX(E10:E25),E10:E25,0))', 'ロサンゼルス'); eq('=MATCH("トロント",C10:C25,0)', 11);
eq('=INDEX(B10:I25,2,2)', 'シアトル'); bad('=INDEX(B10:I25,99,1)', '#REF!'); bad('=MATCH("なし",C10:C25,0)', '#N/A');
eq('=MATCH(70,{10,60,80},1)', 2);

// --- 文字列
eq('=LEFT(C10,3)', 'サンフ'); eq('=RIGHT(H10,2)', '大学'); eq('=MID(C10,2,3)', 'ンフラ'); eq('=LEN(C10)', 8);
eq('=FIND("-",N2)', 3); eq('=SEARCH("CD",N3)', 1); bad('=FIND("x",N2)', '#VALUE!');
eq('=UPPER(N2)', 'AB-001'); eq('=LOWER(N3)', 'cd-002'); eq('=TRIM(P1)', 'Hello World');
eq('=CONCATENATE(B10,"/",C10)', 'アメリカ/サンフランシスコ'); eq('=CONCAT(K2:K4)', '佐藤鈴木高橋');
eq('=TEXTJOIN("、",TRUE,G10:G25)', '4枠、2枠、10枠、5枠、6枠'); eq('=TEXTJOIN(",",FALSE,K2:K3,"x")', '佐藤,鈴木,x');
eq('=JOIN("-",K2:K4)', '佐藤-鈴木-高橋'); eq('=SUBSTITUTE(D10,"週間","")', '2'); eq('=SUBSTITUTE("a-b-c","-","+",2)', 'a-b+c');
eq('=VALUE(SUBSTITUTE(D11,"週間",""))*7', 21); eq('=TEXT(1234.5,"#,##0")', '1,235'); eq('=TEXT(0.256,"0.0%")', '25.6%');
eq('=TEXT(M2,"yyyy年m月d日")', '2020年4月1日'); eq('=TEXT(M5,"yyyy/mm/dd")', '2024/04/30'); eq('=TEXT(5,"000")', '005');
eq('=VALUE("1,200")', 1200); bad('=VALUE("abc")', '#VALUE!');
mat('=ARRAYFORMULA(LEFT(K2:K4,1)&"さん")', [['佐さん'],['鈴さん'],['高さん']]);

// --- 数値
eq('=ROUND(2.5,0)', 3); eq('=ROUND(-2.5,0)', -3); eq('=ROUND(1.005,2)', 1.01); eq('=ROUND(1234.5,-2)', 1200);
eq('=ROUNDUP(3.141,2)', 3.15); eq('=ROUNDDOWN(3.149,2)', 3.14); eq('=ROUNDDOWN(E10*0.1,-3)', 30000); eq('=ROUNDDOWN(-3.7,0)', -3);
eq('=INT(-3.2)', -4); eq('=ABS(-5)', 5); eq('=MOD(10,3)', 1); eq('=MOD(-1,3)', 2); bad('=MOD(1,0)', '#DIV/0!');
eq('=RANK(E14,E10:E25)', 1); eq('=RANK(E23,E10:E25,1)', 1); eq('=RANK.EQ(80,L2:L5)', 2); bad('=RANK(1,E10:E25)', '#N/A');
eq('=LARGE(E10:E25,2)', 716000); eq('=SMALL(E10:E25,2)', 154000); bad('=LARGE(E10:E25,99)', '#NUM!');

// --- 日付
eq('=YEAR(M2)', 2020); eq('=MONTH(M3)', 10); eq('=DAY(M4)', 20); eq('=DATE(2024,4,30)', 45412); eq('=DATE(2024,4,30)=M5', true);
eq('=DATEDIF(M2,M5,"Y")', 4); eq('=DATEDIF(M2,M5,"M")', 48); eq('=DATEDIF("2024/1/31","2024/3/1","D")', 30);
eq('=DATEDIF(M2,M5,"YM")', 0); eq('=DATEDIF(M2,M5,"MD")', 29); bad('=DATEDIF(M5,M2,"D")', '#NUM!');
eq('=M5-M2', 1490); eq('=MAX(M2:M6)', 45412);
n++; assert.equal(one('=TODAY()'), Math.floor(one('=NOW()')));
n++; assert.equal(E.evaluate('=YEAR(TODAY())', get, { now: '2026-11-26T10:00:00' })[0][0], 2026);
eq('=ROW(B10)', 10); eq('=COLUMN(E10)', 5); mat('=ROW(A1:A3)', [[1],[2],[3]]);

// --- 配列
mat('=FILTER(C10:C25,B10:B25="カナダ")', [['バンクーバー'],['モントリオール'],['トロント']]);
mat('=FILTER(C10:E25,(B10:B25="アメリカ")*(D10:D25="4週間"))', [['ニューヨーク','4週間',716000],['ロサンゼルス','4週間',750000]]);
mat('=FILTER(C10:C25,B10:B25="韓国",E10:E25<200000)', [['インチョン'],['プサン']]);
eq('=FILTER(C10:C25,B10:B25="日本","なし")', 'なし'); bad('=FILTER(C10:C25,B10:B25="日本")', '#CALC!');
bad('=FILTER(C10:C25,B10:B24="カナダ")', '#VALUE!');
mat('=SORT(L2:L5,1,-1)', [[1200],[80],[80],[65]]); mat('=SORT(K2:L5,2,FALSE)', [['鈴木',1200],['佐藤',80],['田中',80],['高橋',65]]);
mat('=SORT(L2:L5)', [[65],[80],[80],[1200]]);
mat('=UNIQUE(B10:B25)', [['アメリカ'],['イギリス'],['オーストラリア'],['カナダ'],['韓国'],['ヨーロッパ']]);
eq('=COUNTA(UNIQUE(H10:H25))', 5); mat('=TRANSPOSE(K1:L2)', [['名前','佐藤'],['点数',80]]);
mat('=ARRAY_CONSTRAIN(SORT(C10:E25,3,FALSE),2,1)', [['ロサンゼルス'],['ニューヨーク']]);
mat('=K5:L6', [['田中',80],['伊藤','']]);
bad('=QUERY(B9:I25,"select B")', '#UNSUPPORTED'); bad('=IMPORTRANGE("url","A1:B2")', '#UNSUPPORTED');
bad('=SUM(', '#VALUE!');

// --- parse
n++; assert.deepEqual(E.parse('=SUM($A$1:B2)'), { type: 'call', name: 'SUM', args: [{ type: 'range', c1: 0, r1: 1, c2: 1, r2: 2, sheet: null }] });
n++; assert.equal(E.parse('1+2').type, 'binary');
n++; assert.throws(() => E.parse('=SUM(A1'), /閉じ括弧/);
n++; assert.throws(() => E.parse('="abc'), /引用符/);
n++; assert.throws(() => E.parse('=1 2'), /演算子/);
n++; assert.equal(E.parse('=_xlfn.XLOOKUP(1,A1:A2,B1:B2)').name, 'XLOOKUP');

// --- check
const bounds = { left: 1, top: 9, right: 8, bottom: 25 };
const codes = (f, o) => E.check(f, o).errors.map(e => e.code);
const chk = (f, o, expected) => attempt(() => { assert.deepEqual(codes(f, o), expected, f); assert.equal(E.check(f, o).ok, !expected.length); });
chk('=SUMIFS(E10:E25,G10:G25,"",D10:D25,"3週間")', { platform: 'Excel', bounds }, []);
chk('=SUM(E10:E25', {}, ['paren']); chk('=SUM(E10:E25))', {}, ['paren']); chk('=IF(A1="x,1,2)', {}, ['quote']);
chk('=SUMM(E10:E25)', {}, ['unknown_function']); chk('=VLOOKUP(A1,B1:C5)', {}, ['arity']); chk('=SUMIFS(E10:E25,B10:B25)', {}, ['arity']);
chk('=QUERY(B9:I25,"select B")', { platform: 'Excel' }, ['platform']); chk('=QUERY(B9:I25,"select B")', { platform: 'Google スプレッドシート' }, []);
chk('=ARRAYFORMULA(JOIN(",",B10:B12))', { platform: 'Excel' }, ['platform', 'platform']);
chk('=XLOOKUP("a",B10:B25,C10:C25)&TEXTJOIN(",",TRUE,B10:B25)', { platform: 'Google スプレッドシート' }, []);
chk('=SUMIFS(E10:E25,G10:G24,"")', {}, ['range_size']); chk('=COUNTIFS(B10:B25,"a",D10:D20,"b")', {}, ['range_size']);
chk('=SUMIF(B10:B25,"a",E10:E24)', {}, ['range_size']);
chk('=SUM(K10:K25)', { bounds }, ['ref']); chk('=SUM(E20:E40)', { bounds }, []); chk('=A1+E10', { bounds }, ['ref']);
chk('=SUM(E10:E25)+', {}, ['syntax']); chk('', {}, ['syntax']);
n++; assert.ok(E.check('=SUMM(1)').errors[0].message.includes('SUMM'));

// --- 公開 API
const required = 'SUM AVERAGE MAX MIN COUNT COUNTA COUNTBLANK SUMIF SUMIFS COUNTIF COUNTIFS AVERAGEIF AVERAGEIFS MAXIFS MINIFS IF IFS IFERROR AND OR NOT VLOOKUP HLOOKUP XLOOKUP INDEX MATCH LEFT RIGHT MID LEN FIND SEARCH UPPER LOWER TRIM CONCATENATE CONCAT TEXTJOIN JOIN SUBSTITUTE TEXT VALUE ROUND ROUNDUP ROUNDDOWN INT ABS MOD RANK RANK.EQ LARGE SMALL TODAY NOW DAY MONTH YEAR DATE DATEDIF ROW COLUMN UNIQUE FILTER SORT TRANSPOSE ARRAYFORMULA ARRAY_CONSTRAIN SUMPRODUCT MEDIAN QUERY IMPORTRANGE'.split(' ');
n++; assert.deepEqual(required.filter(f => !E.functions.includes(f)), []);
n++; assert.deepEqual([E.spec.VLOOKUP.min, E.spec.VLOOKUP.max, E.spec.VLOOKUP.platform, E.spec.QUERY.platform], [3, 4, 'both', 'google']);

// --- grid.js の evaluateCell(アドレス文字列の get と互換)
const vm = require('node:vm'), fs = require('node:fs');
const src = fs.readFileSync(__dirname + '/../dist/grid.js', 'utf8');
const body = src.slice(src.indexOf('function evaluateCell('), src.indexOf('function writeCells('));
const ctx = vm.createContext({ FormulaEngine: E, address: (c, r) => E.colName(c) + r });
const evaluateCell = vm.runInContext(body + ';evaluateCell', ctx);
const getA = a => sheet[a] ?? '';
n++; assert.equal(evaluateCell('=SUMIFS(E10:E25,G10:G25,"",D10:D25,"3週間")', getA)[0][0], 1420000);
n++; assert.equal(evaluateCell('=1=1', getA)[0][0], 'TRUE');
n++; assert.throws(() => evaluateCell('=QUERY(B9:I25,"select B")', getA), e => e.message === '#N/A');
n++; assert.throws(() => evaluateCell('=NOPE(1)', getA), e => e.message === '#NAME?');

assert.equal(failures.length, 0, failures.length + ' 件失敗:\n' + failures.join('\n'));
console.log('engine tests passed: ' + n);
