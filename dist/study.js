/* Formula Desk 学習モード: 用途別レッスン / クイズ / 単語帳 / 進捗 */
(function () {
  'use strict';
  var KEY = 'formuladesk.study.v1';

  /* ---------- 教材データ ---------- */
  var CATS = [
    { id: 'agg', name: '合計・平均・最大最小', notes: [
      '範囲をまとめて計算するなら `SUM` `AVERAGE` `MAX` `MIN`。2〜3個のセルの差や割合は演算子(`+` `-` `*` `/`)で十分。',
      '`AVERAGE` は空白セルを無視するが、`0` は平均に含める。未入力を 0 で埋めると平均が下がる。',
      '割合は `=L23/900` のように割り算だけ書き、パーセント表示はセルの表示形式で行う(`*100` は付けない)。'
    ] },
    { id: 'count', name: '件数を数える', notes: [
      '`COUNT` は数値のセルだけ、`COUNTA` は文字も含めて空白でないセル、`COUNTBLANK` は空白のセルを数える。',
      '「プランが何件あるか」は、必ず入力される列を `COUNTA` で数える。文字の列に `COUNT` を使うと 0 になる。',
      '条件が1つなら `COUNTIF(範囲, 条件)`、2つ以上なら `COUNTIFS(条件範囲1, 条件1, 条件範囲2, 条件2, …)`。',
      '数値の条件は `">=600"` `"<=300000"` のように、比較演算子ごと引用符で囲む。'
    ] },
    { id: 'cond', name: '条件付き集計', notes: [
      '引数の順番が逆になる。`SUMIF(範囲, 条件, 合計範囲)` は合計範囲が最後、`SUMIFS(合計範囲, 条件範囲1, 条件1, …)` は合計範囲が先頭。',
      '迷ったら条件が1つでも `SUMIFS` に統一すると、順番を1種類だけ覚えればよい。`AVERAGEIF` と `AVERAGEIFS` も同じ関係。',
      'ワイルドカード: `*` は任意の文字列、`?` は任意の1文字。「ロで始まる」は `"ロ*"`、「枠で終わる」は `"*枠"`。文字列のセルにだけ一致し、数値のセルには一致しない。',
      '空白の条件は `""`、空白以外は `"<>"`。'
    ] },
    { id: 'lookup', name: '表から検索', notes: [
      '`VLOOKUP` は検索する列が範囲の左端にある必要があり、右方向にしか取り出せない。列番号は範囲の左端を 1 として数える。',
      '`XLOOKUP` は検索範囲と戻り範囲を別々に指定するので左方向にも検索でき、見つからないときの値も指定できる(Excel 2021 / Microsoft 365 と Google スプレッドシート)。',
      '`INDEX` + `MATCH` は古い Excel でも動き、左方向の検索や「最大値の行の別の列」のような検索に使える。',
      '数式をコピーするなら範囲を `$C$10:$H$25` のように絶対参照で固定する(範囲を選んで F4)。',
      '範囲に名前を付けると(名前付き範囲)、`=VLOOKUP(J29, プラン表, 6, FALSE)` のようにセル番地の代わりに名前を書ける。'
    ] },
    { id: 'logic', name: '条件分岐・エラー処理', notes: [
      '2通りに分けるなら `IF`、3通り以上なら `IFS`(Excel 2019 以降と Google スプレッドシート)か `IF` の入れ子。',
      '「以上」は `>=`、「より大きい」は `>`。境界の値をどちらに入れるかを先に決める。',
      '`IFERROR` はすべてのエラーを置き換える。検索で見つからない場合(`#N/A`)だけを置き換えたいなら `IFNA`。',
      '複数の条件は `AND`(すべて満たす)と `OR`(どれか満たす)を `IF` の論理式に入れる。'
    ] },
    { id: 'text', name: '文字列操作', notes: [
      '取り出す位置で使い分ける。先頭から `LEFT`、末尾から `RIGHT`、途中から `MID(文字列, 開始位置, 文字数)`。',
      '連結は3通り。少数なら `&`、関数で書くなら `CONCATENATE`(新しい Excel では `CONCAT`)、範囲を同じ区切り文字でつなぐなら `TEXTJOIN`。',
      '`FIND` は大文字・小文字を区別し、`SEARCH` は区別せずワイルドカードも使える。',
      '`TEXTJOIN` は Excel 2019 以降と Google スプレッドシート。Google には `JOIN` もある(Excel にはない)。'
    ] },
    { id: 'date', name: '日付・期間', notes: [
      '`TODAY()` は日付だけ、`NOW()` は日付と時刻。どちらも引数なしで、かっこは必要。',
      '日付から一部を取り出すのは `YEAR` `MONTH` `DAY`。逆に数値から日付を作るのは `DATE(年, 月, 日)`。',
      '`DATEDIF(開始日, 終了日, 単位)` の単位は `"Y"` 満年数、`"M"` 満月数、`"D"` 日数。開始日が終了日より後だとエラーになる。',
      '単純な日数の差は `=F10-TODAY()` のような引き算でも求められる。'
    ] },
    { id: 'array', name: '並べ替え・抽出・重複除去', notes: [
      '`SORT` `FILTER` `UNIQUE` `SEQUENCE` は結果が複数のセルに広がる(スピル)。Excel 2021 / Microsoft 365 と Google スプレッドシートで使える。',
      '展開先のセルに値が入っているとエラーになる(Excel は `#SPILL!`、Google は `#REF!`)。展開先を空白にしておけば解消する。',
      '`SORT` の3つ目の引数は Excel が `1`(昇順)/`-1`(降順)、Google スプレッドシートが `TRUE`(昇順)/`FALSE`(降順)。',
      '`FILTER` の条件は、範囲と同じ行数で `B10:B25="カナダ"` のように書く。'
    ] },
    { id: 'round', name: '端数処理・順位', notes: [
      '`ROUND` 四捨五入、`ROUNDDOWN` 切り捨て、`ROUNDUP` 切り上げ。2つ目の引数は桁数で、`0` が整数、`1` が小数第1位まで、`-3` が千の位まで。',
      '`INT` は小数点以下を切り捨てるが、負の数では小さい方向に丸める(`INT(-1.5)` は -2、`ROUNDDOWN(-1.5, 0)` は -1)。',
      '`RANK` は3つ目の引数を省略するか `0` で大きい順、`1` で小さい順。新しい Excel の `RANK.EQ` も同じ動作。'
    ] },
    { id: 'gs', name: 'スプレッドシート専用', notes: [
      'このカテゴリの関数は Google スプレッドシート専用で、Excel にはない。',
      'Excel で近いことをするには、`QUERY` は `FILTER` や `CHOOSECOLS`、`JOIN` は `TEXTJOIN`、`ARRAYFORMULA` は不要(Microsoft 365 は自動でスピル)。',
      'Excel のファイルをスプレッドシートで開くと、配列数式が `ARRAY_CONSTRAIN(ARRAYFORMULA(式), 行数, 列数)` の形に自動変換されることがある。'
    ] },
    { id: 'key', name: 'ショートカットキー', notes: [
      '同じキーでもアプリで動作が違う。Ctrl+T は Excel でテーブル作成、Chrome で新しいタブ。',
      'Ctrl+R は Excel で右へコピー、Chrome で再読み込み。Ctrl+D は Excel で下へコピー、Chrome でブックマーク。',
      'Ctrl+H は Excel とスプレッドシートで置換、Chrome で履歴。Ctrl+Shift+L は Excel でフィルター、スプレッドシートで左揃え。',
      'Excel の日付は Ctrl+;、時刻は Ctrl+:。Ctrl+Space は列、Shift+Space は行の選択。'
    ] }
  ];

  var FUNCS = [];
  /* c:カテゴリ n:名前 use:用途 syn:構文 ex:使用例 exd:例の説明 vs:使い分け miss:よくあるミス d:誤答候補 app:E/G/EG */
  function F(c, n, use, syn, ex, exd, vs, miss, d, app) {
    FUNCS.push({ c: c, n: n, use: use, syn: syn, ex: ex, exd: exd, vs: vs, miss: miss, d: d.split(','), app: app || 'EG' });
  }

  F('agg', 'SUM', '数値をすべて足して合計を出したい', '=SUM(範囲)', '=SUM(E10:E25)', '全プランの留学費用の合計',
    '条件に合う行だけ合計するなら SUMIF / SUMIFS。', '文字列として入力された数字は合計に入らない。', 'AVERAGE,COUNT,MAX');
  F('agg', 'AVERAGE', '数値の平均を出したい', '=AVERAGE(範囲)', '=AVERAGE(E10:E25)', '留学費用の平均',
    '条件付きの平均は AVERAGEIF / AVERAGEIFS。', '空白は無視されるが 0 は計算に入る。', 'SUM,COUNT,MIN');
  F('agg', 'MAX', '一番大きい値(最高額など)を知りたい', '=MAX(範囲)', '=MAX(E10:E25)', '一番高い留学費用',
    '条件付きなら MAXIFS。何番目に大きいかは RANK。', '最大値の「行にある別の列」は MAX だけでは取れない。INDEX + MATCH と組み合わせる。', 'MIN,SUM,RANK');
  F('agg', 'MIN', '一番小さい値(最安値など)を知りたい', '=MIN(範囲)', '=MIN(E10:E25)', '一番安い留学費用',
    '条件付きなら MINIFS。', '範囲に文字列の数字が混ざると無視される。', 'MAX,AVERAGE,ROUNDDOWN');
  F('agg', '演算子 ( + - * / )', '2つのセルの和・差・割合を出したい(関数を使うまでもない計算)', '=セル1 - セル2   =セル1 / セル2', '=E10/14', 'サンフランシスコの留学費用を14日で割った1日あたりの費用',
    '3個以上をまとめて足すなら SUM の方が短い。', '割合に *100 を付けない。パーセントは表示形式で付ける。引く順番(どちらからどちらを引くか)にも注意。', 'SUM,AVERAGE,ROUND');

  F('count', 'COUNT', '数値が入っているセルの個数を数えたい', '=COUNT(範囲)', '=COUNT(E10:E25)', '留学費用が数値で入っているプランの数',
    '文字も数えるなら COUNTA。', '文字列の列(国、都市など)に使うと 0 になる。', 'COUNTA,COUNTBLANK,SUM');
  F('count', 'COUNTA', '空白でないセル(文字も含む)の個数を数えたい', '=COUNTA(範囲)', '=COUNTA(B10:B25)', '国が入力されている行の数 = プランの件数',
    '数値だけなら COUNT、空白だけなら COUNTBLANK。', '空白に見えても、スペースや空文字を返す数式が入っているセルは数えられる。', 'COUNT,COUNTBLANK,LEN');
  F('count', 'COUNTBLANK', '空白のセルの個数を数えたい', '=COUNTBLANK(範囲)', '=COUNTBLANK(G10:G25)', '残り枠が空白(枠制限なし)のプランの数',
    '入力済みを数えるのは COUNTA。', 'スペースだけが入ったセルは空白として数えられない。', 'COUNTA,COUNT,COUNTIF');
  F('count', 'COUNTIF', '条件1つに合うセルの個数を数えたい', '=COUNTIF(範囲, 条件)', '=COUNTIF(B10:B25,"アメリカ")', 'アメリカのプランの数。数値の条件は =COUNTIF(E10:E25,">=300000")',
    '条件が2つ以上なら COUNTIFS。', '比較演算子は引用符の中に書く(">=600")。範囲は表全体ではなく該当する列だけを指定する。', 'COUNTA,SUMIF,COUNTBLANK');
  F('count', 'COUNTIFS', '複数の条件すべてに合う行の数を数えたい', '=COUNTIFS(条件範囲1, 条件1, 条件範囲2, 条件2, …)', '=COUNTIFS(H10:H25,"明治大学",I10:I25,"費用の5%バック")', '明治大学が実施し、キャンセル料が「費用の5%バック」のプランの数',
    'COUNTIF は条件1つだけ。COUNTIFS は条件1つでも使える。', '条件範囲の行数がそろっていないとエラーになる。', 'COUNTIF,SUMIFS,COUNTA');

  F('cond', 'SUMIF', '条件1つに合う行だけ合計したい', '=SUMIF(範囲, 条件, [合計範囲])', '=SUMIF(C10:C25,"ロ*",E10:E25)', '都市が「ロ」で始まるプランの留学費用の合計',
    'SUMIFS とは引数の順番が逆(SUMIF は合計範囲が最後)。', '合計範囲を先頭に書いてしまう。', 'SUM,COUNTIF,AVERAGEIF');
  F('cond', 'SUMIFS', '複数の条件すべてに合う行だけ合計したい', '=SUMIFS(合計範囲, 条件範囲1, 条件1, 条件範囲2, 条件2, …)', '=SUMIFS(E10:E25,B10:B25,"アメリカ",D10:D25,"4週間")', 'アメリカの4週間プランの留学費用の合計',
    'SUMIF は条件1つだけで、合計範囲が最後に来る。', '合計範囲を最後に書いてしまう。条件範囲と合計範囲の行数をそろえる。', 'SUMIF,COUNTIFS,AVERAGEIFS');
  F('cond', 'AVERAGEIF', '条件1つに合う行だけの平均を出したい', '=AVERAGEIF(範囲, 条件, [平均範囲])', '=AVERAGEIF(B10:B25,"カナダ",E10:E25)', 'カナダのプランの留学費用の平均',
    '条件が複数なら AVERAGEIFS(平均範囲が先頭)。', '条件に合う行が1つもないと #DIV/0! になる。', 'AVERAGE,SUMIF,COUNTIF');
  F('cond', 'AVERAGEIFS', '複数の条件すべてに合う行だけの平均を出したい', '=AVERAGEIFS(平均範囲, 条件範囲1, 条件1, …)', '=AVERAGEIFS(E10:E25,B10:B25,"アメリカ",D10:D25,"4週間")', 'アメリカの4週間プランの留学費用の平均',
    'SUMIFS と同じ並びで、平均範囲が先頭。', 'AVERAGEIF の順番(平均範囲が最後)と混同する。', 'AVERAGEIF,SUMIFS,COUNTIFS');
  F('cond', 'MAXIFS / MINIFS', '条件に合う行の中での最大値・最小値を出したい', '=MAXIFS(最大範囲, 条件範囲1, 条件1, …)', '=MAXIFS(E10:E25,B10:B25,"カナダ")', 'カナダのプランの中で一番高い留学費用(MINIFS なら一番安い費用)',
    '条件なしなら MAX / MIN。', 'Excel 2019 より前のバージョンでは使えない。', 'MAX,SUMIFS,RANK');

  F('lookup', 'VLOOKUP', '表の左端の列でキーを探し、同じ行の右側にある列の値を取り出したい', '=VLOOKUP(検索値, 範囲, 列番号, FALSE)', '=VLOOKUP(J29,$C$10:$H$25,6,FALSE)', 'J29 に入力した都市名から実施大学(範囲の6列目)を取り出す',
    '左方向に取り出したい、列の挿入に強くしたいなら XLOOKUP か INDEX + MATCH。', '4つ目の FALSE(完全一致)を省略すると近似一致になる。検索列が範囲の左端にない。範囲を $ で固定せずにコピーしてずれる。', 'HLOOKUP,MATCH,FILTER');
  F('lookup', 'XLOOKUP', '検索列が左端になくても検索でき、見つからないときの表示も一緒に指定したい', '=XLOOKUP(検索値, 検索範囲, 戻り範囲, [見つからない場合])', '=XLOOKUP(J29,C10:C25,H10:H25,"-")', '都市名から実施大学を取り出し、見つからなければ「-」を表示',
    'VLOOKUP + IFERROR を1つで書ける。列番号を数えなくてよい。', 'Excel 2019 以前では使えない。検索範囲と戻り範囲の行数をそろえる。', 'VLOOKUP,HLOOKUP,MATCH');
  F('lookup', 'HLOOKUP', '見出しが横に並んだ表で、上端の行を探して下の行の値を取り出したい', '=HLOOKUP(検索値, 範囲, 行番号, FALSE)', '=HLOOKUP("留学費用",B9:I25,2,FALSE)', '見出し行から「留学費用」を探し、その列の2行目(10行目の費用)を取り出す',
    '縦に並んだ表は VLOOKUP。H は Horizontal(横)、V は Vertical(縦)。', 'VLOOKUP と向きを取り違える。', 'VLOOKUP,TRANSPOSE,INDEX');
  F('lookup', 'MATCH', '検索値が範囲の何番目にあるか(位置)を知りたい', '=MATCH(検索値, 範囲, 0)', '=MATCH("モントリオール",C10:C25,0)', '都市の列でモントリオールが上から何番目かを返す',
    '値そのものを取り出すには INDEX と組み合わせる。文字列の中の位置は FIND。', '3つ目の 0(完全一致)を省略すると近似一致になる。返るのは行番号ではなく範囲内の順番。', 'INDEX,FIND,VLOOKUP');
  F('lookup', 'INDEX', '範囲の中の「上から◯行目・左から◯列目」の値を取り出したい', '=INDEX(範囲, 行番号, [列番号])', '=INDEX(B10:I25,7,2)', 'データの7行目・2列目(都市)の値を取り出す',
    '位置が分からないときは MATCH で位置を求めて渡す。', '行番号はシートの行番号ではなく、範囲の先頭を 1 とした番号。範囲に見出し行を含めると1行ずれる。', 'MATCH,VLOOKUP,ROW');
  F('lookup', 'INDEX + MATCH', '最大値の行にある別の列の値など、VLOOKUP では書きにくい検索を古い Excel でも動く形で書きたい', '=INDEX(取り出す列, MATCH(検索値, 検索列, 0))', '=INDEX(C10:C25,MATCH(MAX(E10:E25),E10:E25,0))', '留学費用が最大のプランの都市を取り出す',
    'VLOOKUP と違い左方向にも検索できる。新しい環境なら XLOOKUP でも書ける。', '取り出す列と検索列の行範囲がずれている。', 'VLOOKUP,HLOOKUP,RANK');

  F('logic', 'IF', '条件に合うかどうかで表示を2通りに分けたい', '=IF(論理式, 真の場合, 偽の場合)', '=IF(E10>=500000,"高額","通常")', '留学費用が50万円以上なら「高額」、それ以外は「通常」',
    '3通り以上は IFS か IF の入れ子。エラーの置き換えは IFERROR。', '>= と > の取り違え(境界の値の扱い)。文字列を引用符で囲み忘れる。', 'IFERROR,COUNTIF,AND');
  F('logic', 'IFS', '優・良・可のように3段階以上に分けたい(IF の入れ子を避けたい)', '=IFS(条件1, 値1, 条件2, 値2, …)', '=IFS(E10>=600000,"高",E10>=300000,"中",TRUE,"低")', '留学費用を3段階に分ける。最後の TRUE は「それ以外」',
    '2通りなら IF で十分。', '上から順に判定されるので、厳しい条件を先に書く。どの条件にも当てはまらないと #N/A になる。Excel 2016 以前では使えない。', 'IFERROR,AND,COUNTIFS');
  F('logic', 'IFERROR', '数式がエラーになったとき、エラーの種類を問わず別の表示に置き換えたい', '=IFERROR(式, エラーの場合の値)', '=IFERROR(VLOOKUP(J29,$C$10:$H$25,6,FALSE),"-")', '都市が見つからないとき #N/A の代わりに「-」を表示',
    '#N/A だけを置き換えるなら IFNA。XLOOKUP なら4つ目の引数で指定できる。', '数式の書き間違いによるエラーまで隠してしまう。', 'IF,AND,COUNTBLANK');
  F('logic', 'IFNA', '検索で見つからない(#N/A)ときだけ置き換え、ほかのエラーは気づけるよう残したい', '=IFNA(式, #N/A の場合の値)', '=IFNA(VLOOKUP(J29,$C$10:$H$25,6,FALSE),"該当なし")', '都市が表にないときだけ「該当なし」を表示',
    'IFERROR はすべてのエラーを置き換える。', '#VALUE! や #REF! は置き換わらない(それが利点)。', 'IFERROR,IF,COUNTBLANK');
  F('logic', 'AND', '「AかつB」のように、複数の条件をすべて満たすか判定したい', '=AND(条件1, 条件2, …)', '=IF(AND(B10="アメリカ",E10<=500000),"候補","")', 'アメリカで、かつ50万円以下のプランに「候補」と表示',
    'どれか1つでよければ OR。', 'AND 単体は TRUE / FALSE を返すだけ。表示を変えるには IF の論理式に入れる。', 'OR,IFERROR,SUMIFS');
  F('logic', 'OR', '「AまたはB」のように、複数の条件のどれか1つでも満たすか判定したい', '=OR(条件1, 条件2, …)', '=IF(OR(B10="カナダ",B10="韓国"),"対象","")', 'カナダまたは韓国のプランに「対象」と表示',
    'すべて満たす必要があるなら AND。', '=B10="カナダ" OR "韓国" のようには書けない。条件ごとに比較式を書く。', 'AND,IFERROR,COUNTIF');

  F('text', 'LEFT', '文字列の先頭から指定した文字数を取り出したい', '=LEFT(文字列, 文字数)', '=LEFT(H10,2)', '「明治大学」から先頭の2文字「明治」を取り出す',
    '末尾からは RIGHT、途中からは MID。', '全角も半角も1文字として数える。', 'RIGHT,MID,LEN');
  F('text', 'RIGHT', '文字列の末尾から指定した文字数を取り出したい', '=RIGHT(文字列, 文字数)', '=RIGHT(D10,2)', '「2週間」から末尾の2文字「週間」を取り出す',
    '先頭からは LEFT、途中からは MID。', '末尾に余分なスペースがあると、それも1文字として取り出される。', 'LEFT,MID,FIND');
  F('text', 'MID', '文字列の途中(◯文字目から)を指定した文字数だけ取り出したい', '=MID(文字列, 開始位置, 文字数)', '=MID(I10,4,2)', '「費用の5%バック」の4文字目から2文字「5%」を取り出す',
    '開始位置が毎回違うなら FIND で位置を求めて渡す。', '2つ目は開始位置、3つ目は文字数(終了位置ではない)。', 'LEFT,RIGHT,SUBSTITUTE');
  F('text', 'LEN', '文字数を数えたい', '=LEN(文字列)', '=LEN(C10)', '「サンフランシスコ」の文字数(8)を返す',
    'セルの個数を数えるのは COUNTA。', 'スペースも1文字として数える。', 'COUNTA,FIND,LEFT');
  F('text', 'FIND', '特定の文字が何文字目にあるかを、大文字・小文字を区別して調べたい', '=FIND(検索文字列, 対象, [開始位置])', '=FIND("の",I10)', '「費用の5%バック」の中で「の」が何文字目か(3)を返す',
    '大文字・小文字を区別しない、ワイルドカードを使うなら SEARCH。', '見つからないと #VALUE! になる。開始位置は省略すると 1。', 'MATCH,LEN,MID');
  F('text', 'SEARCH', '大文字・小文字を区別せず、ワイルドカードも使って文字の位置を調べたい', '=SEARCH(検索文字列, 対象, [開始位置])', '=SEARCH("usa",A1)', '「USA」「Usa」のどちらでも位置を返す',
    '厳密に区別するなら FIND。', '? や * そのものを探すときは前に ~ を付ける。', 'FIND,MATCH,LEN');
  F('text', 'UPPER', '英字をすべて大文字にそろえたい', '=UPPER(文字列)', '=UPPER("seattle")', '「SEATTLE」を返す',
    '小文字は LOWER、先頭だけ大文字は PROPER。', '元のセルは変わらない。結果を値として残すなら値貼り付けをする。', 'LOWER,TRIM,TEXT');
  F('text', 'LOWER', '英字をすべて小文字にそろえたい', '=LOWER(文字列)', '=LOWER("SEATTLE")', '「seattle」を返す',
    '大文字は UPPER。', '全角の英字は全角のまま小文字になる。', 'UPPER,TRIM,LEN');
  F('text', 'CONCATENATE / CONCAT', '複数のセルの文字を、間に入れる文字を1つずつ指定しながら関数でつなげたい', '=CONCATENATE(文字列1, 文字列2, …)', '=CONCATENATE(B10,"_",C10)', '「アメリカ_サンフランシスコ」を作る',
    '新しい Excel では CONCAT(範囲も指定できる)。同じ区切り文字を何度も挟むなら TEXTJOIN。', 'CONCATENATE は範囲(B10:D10)をまとめて渡せない。', 'SUBSTITUTE,LEFT,SUM');
  F('text', '& 演算子', '2〜3個のセルや文字を、関数を使わず手早くつなげたい', '=セル1 & "文字" & セル2', '=B10&C10', '国と都市をつなげて「アメリカサンフランシスコ」を作る',
    '数が多いときや区切り文字を入れるなら TEXTJOIN。', '+ では文字はつながらない(エラーになる)。', 'SUM,LEN,TRIM');
  F('text', 'TEXTJOIN', '多数のセルや範囲を、同じ区切り文字でつなげたい(空白は飛ばしたい)', '=TEXTJOIN(区切り文字, 空白を無視するか, 文字列1, …)', '=TEXTJOIN("_",TRUE,B10:D10)', '国・都市・留学期間を「_」区切りでつなげる',
    '少数なら & や CONCATENATE。Google スプレッドシートには JOIN もある。', '2つ目の引数(TRUE / FALSE)を忘れて、文字列を2つ目に書いてしまう。Excel 2016 以前では使えない。', 'CONCATENATE,SUBSTITUTE,TRANSPOSE');
  F('text', 'SUBSTITUTE', '文字列の中の特定の文字を別の文字に置き換えたい(消したい)', '=SUBSTITUTE(文字列, 検索文字列, 置換文字列, [何番目])', '=SUBSTITUTE(I10,"の","")', '「費用の5%バック」から「の」を消して「費用5%バック」にする',
    '位置で置き換えるなら REPLACE。シート全体を一度に直すなら Ctrl+H の置換。', '置換文字列を "" にすると削除になる。大文字・小文字は区別される。', 'MID,TRIM,FIND');
  F('text', 'TRIM', '文字列の前後にある余分なスペースを取り除きたい', '=TRIM(文字列)', '=TRIM(C10)', '都市名の前後のスペースを取り除く(検索で一致しない原因をなくす)',
    'すべてのスペースを消すなら SUBSTITUTE。', '単語の間のスペースは1つ残る。Excel の TRIM は全角スペースを前後から取り除くが、Google スプレッドシートでは残る。', 'LEN,LEFT,ROUNDDOWN');
  F('text', 'TEXT', '数値や日付を、指定した表示形式の文字列に変えたい', '=TEXT(値, 表示形式)', '=TEXT(F10,"yyyy/mm/dd")', '募集締め切りを「2024/04/30」の形の文字列にする。=TEXT(E10,"#,##0")&"円" で「450,000円」',
    '見た目だけ変えるならセルの表示形式(Ctrl+1)で十分。', '結果は文字列になるので、そのままでは計算に使えない。', 'UPPER,DAY,ROUND');

  F('date', 'TODAY', '今日の日付(時刻なし)を自動で入れたい', '=TODAY()', '=TODAY()', 'ファイルを開くたびにその日の日付になる',
    '時刻も必要なら NOW。変わらない日付を入れるなら Ctrl+;。', 'かっこを省略できない。日付は開くたびに更新される。', 'NOW,DAY,DATE');
  F('date', 'NOW', '現在の日付と時刻を自動で入れたい', '=NOW()', '=NOW()', '再計算のたびに現在の日時になる',
    '日付だけなら TODAY。変わらない時刻を入れるなら Ctrl+:。', '日付だけを比べたい計算に使うと、時刻の分だけずれる。', 'TODAY,DAY,DATEDIF');
  F('date', 'YEAR', '日付から「年」だけを取り出したい', '=YEAR(日付)', '=YEAR(F10)', '募集締め切りの年(2024 など)を返す',
    '月は MONTH、日は DAY。', '文字列として入力された日付ではエラーになることがある。', 'MONTH,DAY,DATEDIF');
  F('date', 'MONTH', '日付から「月」だけを取り出したい', '=MONTH(日付)', '=MONTH(F10)', '募集締め切りの月(1〜12)を返す',
    '年は YEAR、日は DAY。', '月の名前ではなく数値が返る。', 'DAY,YEAR,WEEKDAY');
  F('date', 'DAY', '日付から「日」だけを取り出したい', '=DAY(日付)', '=DAY(F10)', '募集締め切りの日(1〜31)を返す',
    '年は YEAR、月は MONTH。日数の差は DATEDIF。', '曜日や日数が返るわけではない。', 'MONTH,YEAR,TODAY');
  F('date', 'DATEDIF', '2つの日付の間の年数・月数・日数(年齢や経過日数)を求めたい', '=DATEDIF(開始日, 終了日, 単位)', '=DATEDIF(F14,TODAY(),"D")', '募集締め切り(F14)から今日までの経過日数。年齢は =DATEDIF(生年月日,TODAY(),"Y")',
    '単純な日数だけなら引き算(終了日 - 開始日)でもよい。', '開始日が終了日より後だとエラーになる。Excel では入力候補に表示されないので手で入力する。単位は引用符で囲む。', 'YEAR,TODAY,DAY');
  F('date', 'DATE', '年・月・日の数値から日付を組み立てたい', '=DATE(年, 月, 日)', '=DATE(2025,4,30)', '2025年4月30日の日付を作る',
    '逆に日付を分解するのは YEAR / MONTH / DAY。', '引数の順番は年・月・日。', 'TODAY,TEXT,DAY');
  F('date', 'WEEKDAY', '日付の曜日を番号で求めたい', '=WEEKDAY(日付, [種類])', '=WEEKDAY(F10)', '募集締め切りの曜日を 1(日曜)〜7(土曜)で返す',
    '「月」「火」のような文字で表示するなら TEXT(日付,"aaa")。', '種類を省略すると日曜が 1。月曜を 1 にするなら種類に 2 を指定する。', 'DAY,MONTH,TEXT');
  F('date', 'EDATE', 'ある日付の◯か月後(前)の同じ日を求めたい', '=EDATE(開始日, 月数)', '=EDATE(F10,1)', '募集締め切りの1か月後の日付',
    '◯日後は足し算(=F10+7)でよい。', '結果が数値(シリアル値)で表示されたら、表示形式を日付にする。', 'DATE,DATEDIF,MONTH');

  F('array', 'SORT', '表を指定した列の昇順・降順に並べ替えた結果を、別の場所に表示したい', 'Excel: =SORT(範囲, 列番号, 順序, [方向])\nGoogle: =SORT(範囲, 列番号, 昇順なら TRUE)', 'Excel: =SORT(B10:I25,4,-1)\nGoogle: =SORT(B10:I25,4,FALSE)', '留学費用(範囲の4列目)の高い順に表を並べ替える',
    '元の表そのものを並べ替えるなら、データタブの並べ替え機能。', '順序の書き方が違う(Excel は 1 / -1、Google は TRUE / FALSE)。範囲に見出し行を含めると見出しも並べ替えられる。', 'FILTER,RANK,UNIQUE');
  F('array', 'FILTER', '条件に合う行だけを抜き出して、別の場所に表示したい', '=FILTER(範囲, 条件)', '=FILTER(B10:I25,B10:B25="カナダ")', 'カナダのプランの行だけを表示する',
    '1件だけ取り出すなら VLOOKUP / XLOOKUP。必要な列だけ選ぶなら Google の QUERY。', '条件の範囲と元の範囲の行数がそろっていない。複数条件は Excel では (条件1)*(条件2)、Google ではカンマで条件を追加する。', 'SORT,VLOOKUP,UNIQUE');
  F('array', 'UNIQUE', '重複を除いた一覧を作りたい', '=UNIQUE(範囲)', '=UNIQUE(H10:H25)', '実施大学の一覧を重複なしで表示する',
    '元データから重複行を消すなら、データタブの「重複の削除」。種類の数は =COUNTA(UNIQUE(範囲))。', '展開先のセルに値があるとエラーになる。展開先は空白にしておく。', 'FILTER,COUNTA,SORT');
  F('array', 'TRANSPOSE', '表の行と列(縦と横)を入れ替えたい', '=TRANSPOSE(範囲)', '=TRANSPOSE(B9:I25)', '見出しが左端に縦に並ぶ表に変える',
    '一度きりなら、コピーして「行/列の入れ替え」貼り付けでもよい。', '元の表を変えると結果も変わる。展開先に十分な空きが必要。', 'SORT,INDEX,HLOOKUP');
  F('array', 'ROW', '行番号を使って、行を削除しても崩れない連番をふりたい', '=ROW([セル])', '=ROW()-9', '10行目で 1 になる連番(見出しより上の行数 9 を引く)',
    '列番号は COLUMN。', '引く数は「データの先頭行 - 1」。引数を省略すると数式を入れたセル自身の行番号。', 'COUNT,INDEX,RANK');
  F('array', 'SEQUENCE', '1, 2, 3, … のような連続した数値を、1つの数式でまとめて作りたい', '=SEQUENCE(行数, [列数], [開始], [増分])', '=SEQUENCE(16)', '1〜16 の連番を縦に16行ぶん作る',
    '1セルずつ連番を入れるなら ROW()-9。', 'Excel 2019 以前では使えない。展開先に値があるとエラーになる。', 'COUNT,RANK,UNIQUE');

  F('round', 'ROUND', '指定した桁で四捨五入したい', '=ROUND(数値, 桁数)', '=ROUND(E10/14,0)', '1日あたりの費用を整数に四捨五入する',
    '切り捨ては ROUNDDOWN、切り上げは ROUNDUP。', '表示形式で小数を隠しても、中身の値は丸められていない。桁数 0 が整数、-3 が千の位まで。', 'ROUNDDOWN,ROUNDUP,INT');
  F('round', 'ROUNDDOWN', '指定した桁で切り捨てたい', '=ROUNDDOWN(数値, 桁数)', '=ROUNDDOWN(E10/14,0)', '1日あたりの費用の小数点以下を切り捨てる',
    '四捨五入は ROUND、切り上げは ROUNDUP。', '桁数を省略できない(Excel)。0 で小数点以下を切り捨て。', 'ROUND,ROUNDUP,MIN');
  F('round', 'ROUNDUP', '指定した桁で切り上げたい', '=ROUNDUP(数値, 桁数)', '=ROUNDUP(E10/14,-2)', '1日あたりの費用を百円単位に切り上げる',
    '四捨五入は ROUND、切り捨ては ROUNDDOWN。', '桁数のマイナスは整数部分の位(-2 は十の位以下を切り上げ)。', 'ROUND,ROUNDDOWN,MAX');
  F('round', 'INT', '桁数を指定せず、手早く小数点以下を切り捨てて整数にしたい', '=INT(数値)', '=INT(E10/14)', '1日あたりの費用を整数にする',
    '桁を指定するなら ROUNDDOWN。', '負の数は小さい方向に丸める(INT(-1.5) は -2)。', 'ROUND,ROUNDUP,LEN');
  F('round', 'RANK', '範囲の中で、その数値が何位かを求めたい', '=RANK(数値, 範囲, [順序])', '=RANK(E10,$E$10:$E$25)', 'サンフランシスコの留学費用が高い順で何位か',
    '新しい Excel の RANK.EQ も同じ動作。最大値そのものは MAX。', '範囲を $ で固定せずにコピーするとずれる。順序は省略か 0 で大きい順、1 で小さい順。', 'MAX,SORT,MATCH');

  F('gs', 'QUERY', '表から必要な列だけを抜き出したり、SQL に似た書き方で絞り込み・集計をしたい', '=QUERY(範囲, "select 列, 列, …", [見出しの行数])', '=QUERY(B9:I25,"select B, C, E where E >= 300000")', '国・都市・留学費用の列だけを、30万円以上の行に絞って表示',
    '行の絞り込みだけなら FILTER。Excel にはない。', '列はシートの列記号(B、C、E)で書く。命令文全体を引用符で囲む。select の大文字・小文字は区別されない。', 'FILTER,IMPORTRANGE,VLOOKUP', 'G');
  F('gs', 'IMPORTRANGE', '別のスプレッドシート(別ファイル)のセル範囲を取り込みたい', '=IMPORTRANGE("スプレッドシートのURLまたはID", "シート名!範囲")', '=IMPORTRANGE("https://docs.google.com/spreadsheets/d/…","プラン詳細!A2:K30")', '別ファイルの「プラン詳細」シートの A2:K30 を取り込む',
    '同じファイルの別シートなら =シート名!A2:K30 と書くだけでよい。', '2つの引数はどちらも半角の引用符で囲む。初回は「アクセスを許可」を押す必要がある。', 'QUERY,VLOOKUP,ARRAYFORMULA', 'G');
  F('gs', 'ARRAYFORMULA', '1つの数式を範囲全体に一括で適用したい(行ごとにコピーしたくない)', '=ARRAYFORMULA(式)', '=ARRAYFORMULA(IF(E10:E25="","",E10:E25/14))', '全プランの1日あたり費用を1つの数式で求める',
    'Microsoft 365 の Excel は自動でスピルするので不要。', '式の中はセル1つではなく範囲で書く。展開先に値があるとエラーになる。', 'ARRAY_CONSTRAIN,QUERY,TRANSPOSE', 'G');
  F('gs', 'ARRAY_CONSTRAIN', '配列の結果を、先頭の◯行×◯列だけに制限したい', '=ARRAY_CONSTRAIN(配列, 行数, 列数)', '=ARRAY_CONSTRAIN(SORT(B10:I25,4,FALSE),5,8)', '留学費用の高い順に並べた表の上位5行だけを表示',
    'Excel で近いのは TAKE(Microsoft 365)。', '行数・列数の両方が必要。', 'ARRAYFORMULA,FILTER,INDEX', 'G');
  F('gs', 'JOIN', 'Google スプレッドシート専用の関数で、区切り文字つきの連結を短く書きたい(Excel にはない)', '=JOIN(区切り文字, 値または配列1, …)', '=JOIN(",",B10,C10,H10)', '国・都市・実施大学をカンマ区切りでつなげる',
    'Excel と両方で使うなら TEXTJOIN。', 'Excel で開くと動かない。空白を飛ばす指定はできない。', 'TEXTJOIN,CONCATENATE,QUERY', 'G');

  /* 数式の穴埋め */
  var FILLS = [
    ['cond', 'アメリカの4週間プランの留学費用を合計する', '=SUMIFS( ? , B10:B25, "アメリカ", D10:D25, "4週間")', 'E10:E25', ['B10:B25', 'D10:D25', '"アメリカ"'], 'SUMIFS は合計範囲が先頭。その後に条件範囲と条件の組を並べる。'],
    ['cond', '都市が「ロ」で始まるプランの留学費用を合計する', '=SUMIF(C10:C25, "ロ*", ? )', 'E10:E25', ['C10:C25', 'B10:B25', '"ロ"'], 'SUMIF は(範囲, 条件, 合計範囲)の順で、合計範囲が最後。'],
    ['cond', '都市が「ロ」で始まる、という条件を書く', '=SUMIF(C10:C25, ? , E10:E25)', '"ロ*"', ['"*ロ"', '"ロ"', 'ロ*'], '* は任意の文字列。「ロ*」で「ロで始まる」。条件は引用符で囲む。'],
    ['cond', 'アメリカのプランの留学費用の平均を出す', '=AVERAGEIFS( ? , B10:B25, "アメリカ")', 'E10:E25', ['B10:B25', '"アメリカ"', 'B10:I25'], 'AVERAGEIFS も SUMIFS と同じく、計算する範囲が先頭。'],
    ['cond', '条件が1つのとき、合計範囲を最後に書く関数は?', '= ? (B10:B25, "カナダ", E10:E25)', 'SUMIF', ['SUMIFS', 'COUNTIF', 'SUM'], 'SUMIF は合計範囲が最後、SUMIFS は先頭。'],
    ['count', '留学費用が30万円以下で、国がカナダのプランを数える', '=COUNTIFS(E10:E25, ? , B10:B25, "カナダ")', '"<=300000"', ['<=300000', '"=<300000"', '">=300000"'], '比較演算子は引用符の中に書く。「以下」は <=。'],
    ['count', '募集締め切りが空白のプランを数える', '= ? (F10:F25)', 'COUNTBLANK', ['COUNT', 'COUNTA', 'COUNTIF'], '空白セルを数えるのは COUNTBLANK。'],
    ['count', '国(文字)が入力されている行を数えて、プランの件数を出す', '= ? (B10:B25)', 'COUNTA', ['COUNT', 'COUNTBLANK', 'SUM'], '文字も含めて数えるのは COUNTA。COUNT は数値だけなので 0 になる。'],
    ['count', '実施大学が日本大学のプランを数える', '=COUNTIF( ? , "日本大学")', 'H10:H25', ['B10:I25', 'H10', '"実施大学"'], 'COUNTIF は(範囲, 条件)。範囲は該当する列だけを指定する。'],
    ['lookup', '都市名(J29)と完全に一致する行を探す', '=VLOOKUP(J29, $C$10:$H$25, 6, ? )', 'FALSE', ['TRUE', '1', '"完全"'], '4つ目を FALSE にすると完全一致。省略や TRUE は近似一致になる。'],
    ['lookup', '都市名(J29)から実施大学(H列)を取り出す', '=VLOOKUP(J29, $C$10:$H$25, ? , FALSE)', '6', ['5', '8', 'H'], '列番号は範囲の左端(C列)を 1 として数える。C=1, D=2, E=3, F=4, G=5, H=6。'],
    ['lookup', 'モントリオールの行にある実施大学を取り出す', '=INDEX(H10:H25, ? ("モントリオール", C10:C25, 0))', 'MATCH', ['FIND', 'VLOOKUP', 'ROW'], 'MATCH で何番目かを求め、INDEX でその位置の値を取り出す。'],
    ['lookup', '都市名(J29)から実施大学を取り出す', '=XLOOKUP(J29, ? , H10:H25, "-")', 'C10:C25', ['B10:I25', 'H10:H25', '6'], 'XLOOKUP は(検索値, 検索範囲, 戻り範囲, 見つからない場合)。'],
    ['lookup', 'モントリオールが都市の列の何番目かを、完全一致で調べる', '=MATCH("モントリオール", C10:C25, ? )', '0', ['1', '-1', '2'], 'MATCH の3つ目は 0 で完全一致。'],
    ['lookup', '数式をコピーしても検索範囲がずれないようにする', '=VLOOKUP(J29, ? , 6, FALSE)', '$C$10:$H$25', ['C10:H25', '$C10:$H25', 'C$10$:H$25$'], '列記号と行番号の両方の前に $ を付けると絶対参照。F4 で切り替えられる。'],
    ['logic', '留学費用が50万円「以上」なら高額と表示する', '=IF(E10 ? 500000, "高額", "通常")', '>=', ['>', '=>', '<='], '「以上」は >=。> だと50万円ちょうどが入らない。=> という書き方はない。'],
    ['logic', '検索がエラーになったら「-」を表示する', '= ? (VLOOKUP(J29, $C$10:$H$25, 6, FALSE), "-")', 'IFERROR', ['IF', 'IFS', 'AND'], 'IFERROR(式, エラーの場合の値)。'],
    ['logic', 'どの条件にも当てはまらないときは「低」にする', '=IFS(E10>=600000, "高", E10>=300000, "中", ? , "低")', 'TRUE', ['FALSE', 'ELSE', '"それ以外"'], 'IFS の最後の条件を TRUE にすると「それ以外」になる。'],
    ['logic', 'アメリカで、かつ50万円以下のプランに「候補」と表示する', '=IF( ? (B10="アメリカ", E10<=500000), "候補", "")', 'AND', ['OR', 'IFS', 'SUMIFS'], '「かつ」は AND、「または」は OR。'],
    ['text', '「明治大学」から先頭の「明治」を取り出す', '= ? (H10, 2)', 'LEFT', ['RIGHT', 'MID', 'LEN'], '先頭から取り出すのは LEFT。'],
    ['text', '「費用の5%バック」から「5%」を取り出す', '=MID(I10, ? , 2)', '4', ['3', '5', '2'], 'MID の2つ目は開始位置。「5」は4文字目(費・用・の・5)。'],
    ['text', '国・都市・留学期間を「_」でつなげ、空白は飛ばす', '=TEXTJOIN("_", ? , B10:D10)', 'TRUE', ['FALSE', '"_"', '3'], 'TEXTJOIN の2つ目は「空白を無視するか」。TRUE で空白を飛ばす。'],
    ['text', '「費用の5%バック」から「の」を消す', '=SUBSTITUTE(I10, ? , "")', '"の"', ['""', 'の', '"*の*"'], 'SUBSTITUTE(文字列, 検索文字列, 置換文字列)。置換文字列を "" にすると削除。'],
    ['text', '国(B10)と都市(C10)を「_」を挟んでつなげる', '=B10 ? "_" ? C10', '&', ['+', ',', ':'], '文字の連結は &。+ は足し算なので文字には使えない。'],
    ['text', '「2週間」から末尾の「週間」を取り出す', '= ? (D10, 2)', 'RIGHT', ['LEFT', 'MID', 'TRIM'], '末尾から取り出すのは RIGHT。'],
    ['date', '生年月日から今日時点の年齢(満年数)を求める', '=DATEDIF(生年月日, TODAY(), ? )', '"Y"', ['"D"', '"M"', 'YEAR'], '単位 "Y" は満年数、"M" は月数、"D" は日数。'],
    ['date', '募集締め切り(F14)から今日までの経過日数を求める', '=DATEDIF(F14, ? , "D")', 'TODAY()', ['TODAY', 'DAY(F14)', '"今日"'], '今日の日付は TODAY()。かっこは省略できない。'],
    ['date', '募集締め切り(F10)の「日」だけを取り出す', '= ? (F10)', 'DAY', ['DATE', 'TODAY', 'WEEKDAY'], 'DAY は日、MONTH は月、YEAR は年。'],
    ['array', '【Excel】留学費用(4列目)の高い順に並べ替える', '=SORT(B10:I25, 4, ? )', '-1', ['1', '0', '"DESC"'], 'Excel の SORT は 1 が昇順、-1 が降順。'],
    ['array', '【Google スプレッドシート】留学費用(4列目)の高い順に並べ替える', '=SORT(B10:I25, 4, ? )', 'FALSE', ['TRUE', '"DESC"', '降順'], 'Google スプレッドシートの SORT は TRUE が昇順、FALSE が降順。'],
    ['array', 'カナダのプランの行だけを表示する', '=FILTER(B10:I25, ? )', 'B10:B25="カナダ"', ['"カナダ"', 'B10="カナダ"', 'B10:I25="カナダ"'], '条件は、範囲と同じ行数の列に対して書く。'],
    ['array', '実施大学の一覧を重複なしで表示する', '= ? (H10:H25)', 'UNIQUE', ['FILTER', 'SORT', 'COUNTA'], '重複を除くのは UNIQUE。'],
    ['round', '1日あたりの費用の小数点以下を切り捨てる', '=ROUNDDOWN(E10/14, ? )', '0', ['1', '-1', '2'], '桁数 0 で小数点以下を切り捨てて整数にする。'],
    ['round', '順位の数式を下へコピーしても範囲がずれないようにする', '=RANK(E10, ? )', '$E$10:$E$25', ['E10:E25', '$E10:$E25', 'E$10$:E$25$'], '行番号の前にも $ が必要。$E10:$E25 は列だけの固定で、下へコピーすると行がずれる。'],
    ['gs', '国(B)・都市(C)・留学費用(E)の列だけを抜き出す', '=QUERY(B9:I25, ? )', '"select B, C, E"', ['select B, C, E', '"B, C, E"', '"select 国, 都市, 留学費用"'], '命令文全体を引用符で囲み、列はシートの列記号で書く。'],
    ['gs', '別ファイルの「プラン詳細」シートの A2:K30 を取り込む', '=IMPORTRANGE("スプレッドシートのURL", ? )', '"プラン詳細!A2:K30"', ['プラン詳細!A2:K30', '"プラン詳細", "A2:K30"', '"プラン詳細.A2:K30"'], '2つ目の引数は "シート名!範囲" を1つの文字列として引用符で囲む。'],
    ['agg', '一番安い留学費用を求める', '= ? (E10:E25)', 'MIN', ['MAX', 'SUM', 'RANK'], '最小値は MIN、最大値は MAX。'],
    ['agg', '合格点(L23)が満点 900 点の何割かを求める', '=L23 ? 900', '/', ['*', '-', '%'], '割合は割り算。パーセント表示はセルの表示形式で行う。']
  ];

  /* ショートカット(実際の動作) */
  var APPS = { E: 'Excel', G: 'Google スプレッドシート', C: 'Chrome', W: 'Windows' };
  var KEYS = [
    ['E', 'Ctrl+N', '新しいブックを作成する'], ['E', 'Alt+Enter', 'セル内で改行する'],
    ['E', 'F4', '絶対参照と相対参照を切り替える(数式の編集中)'], ['E', 'F12', '名前を付けて保存する'],
    ['E', 'Ctrl+R', '左のセルを右へコピーする'], ['E', 'Ctrl+D', '上のセルを下へコピーする'],
    ['E', 'Ctrl+G', 'ジャンプのダイアログを開く'], ['E', 'Ctrl+F', '検索する'],
    ['E', 'Ctrl+1', 'セルの書式設定のダイアログを開く'], ['E', 'Ctrl+5', '取り消し線を付ける'],
    ['E', 'Ctrl+Q', 'クイック分析を開く'], ['E', 'Ctrl+F1', 'リボンの表示と非表示を切り替える'],
    ['E', 'Ctrl+T', 'テーブルを作成する'], ['E', 'Ctrl+Space', '列全体を選択する'],
    ['E', 'Shift+Space', '行全体を選択する'], ['E', 'Ctrl+Shift+V', '値のみ貼り付ける'],
    ['E', 'Ctrl+E', 'フラッシュフィル(法則を検知して自動入力)を実行する'], ['E', 'Ctrl+;', '今日の日付を入力する'],
    ['E', 'Ctrl+:', '現在の時刻を入力する'], ['E', 'Ctrl+Shift+L', 'フィルターを設定・解除する'],
    ['E', 'Shift+F11', '新しいシートを追加する'], ['E', 'Ctrl+B', '太字にする'],
    ['E', 'Ctrl+PgDn', '右隣のシートに移動する'], ['E', 'Ctrl+PgUp', '左隣のシートに移動する'],
    ['E', 'Ctrl+H', '置換のダイアログを開く'], ['E', 'Ctrl+「-」', '選択した行・列・セルを削除する'],
    ['E', 'Ctrl+「+」', '行・列・セルを挿入する'], ['E', 'F2', 'セルを編集状態にする'],
    ['E', 'F11', 'グラフシートを作成する'], ['E', 'Ctrl+↓', 'データの一番下のセルへ移動する'],
    ['E', 'Shift+矢印', '矢印の方向に選択範囲を広げる'], ['E', 'Ctrl+O', 'ファイルを開く'],
    ['E', 'Ctrl+9', '行を非表示にする'], ['E', 'Ctrl+0', '列を非表示にする'],
    ['E', 'Ctrl+K', 'ハイパーリンクを挿入する'], ['E', 'Ctrl+Enter', '選択範囲に同じ値を一括入力する'],
    ['E', 'Ctrl+Shift+「-」', '外枠の罫線を削除する'],
    ['C', 'Ctrl+R(F5)', 'ページを再読み込みする'], ['C', 'Ctrl+D', '現在のページをブックマークに追加する'],
    ['C', 'Ctrl+Shift+T', '閉じたタブをもう一度開く'], ['C', 'Ctrl+T', '新しいタブを開く'],
    ['C', 'Ctrl+Tab', '次のタブに移動する'], ['C', 'Ctrl+H', '履歴ページを開く'],
    ['C', 'Ctrl+「+」', 'ページを拡大する'], ['C', 'Alt+←', '前のページに戻る'],
    ['C', 'F11', '全画面表示のオン・オフを切り替える'], ['C', 'Ctrl+J', 'ダウンロードページを開く'],
    ['C', 'Ctrl+9', '右端のタブに移動する'], ['C', 'Ctrl+1〜8', '左から数えた番号のタブに移動する'],
    ['C', 'Ctrl+L', 'アドレスバーにカーソルを合わせる'], ['C', 'Ctrl+0', '拡大率を標準(100%)に戻す'],
    ['C', 'Ctrl+クリック', 'リンク先を新しいタブで開く'], ['C', 'Ctrl+Shift+B', 'ブックマークバーの表示と非表示を切り替える'],
    ['C', 'Home', 'ページの先頭に移動する'],
    ['G', 'Ctrl+Shift+L', '左揃えにする'], ['G', 'Ctrl+Shift+E', '中央揃えにする'],
    ['G', 'Ctrl+Shift+R', '右揃えにする'], ['G', 'Ctrl+Alt+M', 'コメントを挿入する'],
    ['G', 'Shift+F11', '新しいシートを挿入する'], ['G', 'Alt+↓', '次(右隣)のシートに移動する'],
    ['G', 'Ctrl+H', '検索と置換を開く'], ['G', 'Ctrl+K', 'リンクを挿入する'],
    ['W', 'Alt+Tab', '起動しているアプリを切り替える'], ['W', 'Windowsキー+→', 'ウィンドウを画面の右半分に寄せる'],
    ['W', 'Windowsキー+←', 'ウィンドウを画面の左半分に寄せる'], ['W', 'F2(エクスプローラー)', 'ファイルの名前を変更する'],
    ['W', 'Windowsキー+L', '画面をロックする'], ['W', 'Windowsキー+Space', '入力言語・キーボードレイアウトを切り替える'],
    ['W', 'Windowsキー+Shift+S', '範囲を選んでスクリーンショットを撮る'], ['W', 'Alt+Enter(エクスプローラー)', 'ファイルのプロパティを開く']
  ];

  /* ---------- 問題の組み立て ---------- */
  var QUESTIONS = [];
  FUNCS.forEach(function (f) {
    QUESTIONS.push({ id: 'u:' + f.n, cat: f.c, type: 'use', q: '次の用途に最適なのはどれ?', sub: f.use, a: f.n, o: f.d,
      ex: f.n + ' … ' + f.syn.replace(/\n/g, ' / ') + '。' + f.vs, mono: true });
  });
  FILLS.forEach(function (r, i) {
    QUESTIONS.push({ id: 'f:' + i, cat: r[0], type: 'fill', q: '「?」に入るものを選んでください。', sub: r[1], code: r[2], a: r[3], o: r[4], ex: r[5], mono: true });
  });
  KEYS.forEach(function (k, i) {
    var same = KEYS.filter(function (x) { return x[0] === k[0] && x !== k; });
    var rev = i % 3 === 2;
    QUESTIONS.push({ id: 'k:' + k[0] + ':' + k[1], cat: 'key', type: 'key',
      q: rev ? '【' + APPS[k[0]] + '】次の操作をするキーは?' : '【' + APPS[k[0]] + '】このキーを押すとどうなる?',
      sub: rev ? k[2] : k[1], a: rev ? k[1] : k[2],
      pool: same.map(function (x) { return rev ? x[1] : x[2]; }),
      ex: APPS[k[0]] + ' の ' + k[1] + ' は「' + k[2] + '」。' + otherApps(k), mono: rev });
  });
  function otherApps(k) {
    var base = k[1].replace(/\(.*\)/, '');
    var o = KEYS.filter(function (x) { return x !== k && x[1].replace(/\(.*\)/, '') === base; });
    return o.map(function (x) { return APPS[x[0]] + ' では「' + x[2] + '」。'; }).join('');
  }

  /* ---------- 保存 ---------- */
  var store = load();
  function blank() { return { v: 1, stats: {}, wrong: {}, cards: {} }; }
  function load() {
    try {
      var s = JSON.parse(window.localStorage.getItem(KEY) || 'null');
      if (s && s.v === 1 && s.stats && s.wrong && s.cards) return s;
    } catch (e) { /* 保存領域が使えない環境ではメモリ上だけで動かす */ }
    return blank();
  }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 無視 */ }
  }

  /* ---------- 小道具 ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function rich(s) { return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>'); }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function catName(id) { for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i].name; return id; }
  function appBadge(app) {
    if (app === 'G') return '<span class="fs-badge fs-badge-g">スプレッドシート専用</span>';
    if (app === 'E') return '<span class="fs-badge">Excel 専用</span>';
    return '';
  }
  function wrongIds() { return Object.keys(store.wrong).filter(function (id) { return QUESTIONS.some(function (q) { return q.id === id; }); }); }

  /* ---------- 画面の状態 ---------- */
  var ui = { tab: 'lesson', cat: 'agg', qcat: 'all', qtype: 'all', quiz: null, ccat: 'all', conly: false, deck: null, ci: 0, flip: false, confirmReset: false };
  var TABS = [['lesson', 'レッスン'], ['quiz', 'クイズ'], ['cards', '単語帳'], ['progress', '進捗']];
  var TYPES = [['all', 'すべて'], ['use', '用途 → 関数'], ['fill', '数式の穴埋め'], ['key', 'ショートカット']];
  var root = null;

  function chips(act, list, cur, label) {
    return '<div class="fs-chips" role="group" aria-label="' + esc(label) + '">' + list.map(function (c) {
      return '<button type="button" class="fs-chip" data-a="' + act + '" data-v="' + esc(c[0]) + '" aria-pressed="' + (c[0] === cur) + '">' + esc(c[1]) + '</button>';
    }).join('') + '</div>';
  }

  /* ---------- レッスン ---------- */
  function viewLesson() {
    var cat = CATS.filter(function (c) { return c.id === ui.cat; })[0] || CATS[0];
    var h = '<p class="fs-lead">やりたいこと(用途)から、使う関数を選べるようになるためのレッスンです。使用例は留学プラン一覧表(見出しが9行目、データが10〜25行目)を題材にしています。</p>'
      + '<div class="fs-table" role="group" aria-label="題材の表の列">'
      + ['B 国', 'C 都市', 'D 留学期間', 'E 留学費用', 'F 募集締め切り', 'G 残り枠', 'H 実施大学', 'I キャンセル料'].map(function (c) { return '<span><b>' + c.charAt(0) + '</b>' + esc(c.slice(1)) + '</span>'; }).join('')
      + '</div>'
      + chips('cat', CATS.map(function (c) { return [c.id, c.name]; }), cat.id, '用途カテゴリ')
      + '<h3 class="fs-h" tabindex="-1" data-focus="cat">' + esc(cat.name) + '</h3>'
      + '<div class="fs-notes"><h4>使い分けのポイント</h4><ul>' + cat.notes.map(function (n) { return '<li>' + rich(n) + '</li>'; }).join('') + '</ul></div>';
    if (cat.id === 'key') {
      h += Object.keys(APPS).map(function (a) {
        return '<section class="fs-keys"><h4>' + esc(APPS[a]) + '</h4><dl>' + KEYS.filter(function (k) { return k[0] === a; }).map(function (k) {
          return '<div><dt><kbd>' + esc(k[1]) + '</kbd></dt><dd>' + esc(k[2]) + '</dd></div>';
        }).join('') + '</dl></section>';
      }).join('');
      return h;
    }
    h += '<div class="fs-grid">' + FUNCS.filter(function (f) { return f.c === cat.id; }).map(function (f) {
      return '<article class="fs-card"><p class="fs-use">' + esc(f.use) + '</p>'
        + '<h4 class="fs-fn"><span aria-hidden="true">→</span> ' + esc(f.n) + ' ' + appBadge(f.app) + '</h4>'
        + '<dl><div><dt>構文</dt><dd><code class="fs-code">' + esc(f.syn) + '</code></dd></div>'
        + '<div><dt>使用例</dt><dd><code class="fs-code">' + esc(f.ex) + '</code><span class="fs-exd">' + esc(f.exd) + '</span></dd></div>'
        + '<div><dt>使い分け</dt><dd>' + esc(f.vs) + '</dd></div>'
        + '<div class="fs-miss"><dt>よくあるミス</dt><dd>' + esc(f.miss) + '</dd></div></dl></article>';
    }).join('') + '</div>';
    return h;
  }

  /* ---------- クイズ ---------- */
  function pool() {
    return QUESTIONS.filter(function (q) { return (ui.qcat === 'all' || q.cat === ui.qcat) && (ui.qtype === 'all' || q.type === ui.qtype); });
  }
  function choicesFor(q) {
    var wrong = q.o ? q.o.slice() : shuffle(q.pool.filter(function (x) { return x !== q.a; })).slice(0, 3);
    return shuffle([q.a].concat(wrong.slice(0, 3)));
  }
  function startQuiz(review) {
    var src = review ? QUESTIONS.filter(function (q) { return store.wrong[q.id]; }) : pool();
    if (!src.length) return;
    var list = shuffle(src).slice(0, 10);
    ui.quiz = { list: list, i: 0, right: 0, picked: null, review: !!review, done: false, choices: choicesFor(list[0]), missed: [] };
  }
  function answer(idx) {
    var z = ui.quiz; if (!z || z.done || z.picked !== null) return;
    var q = z.list[z.i]; if (idx < 0 || idx >= z.choices.length) return;
    z.picked = idx;
    var ok = z.choices[idx] === q.a;
    var st = store.stats[q.cat] || (store.stats[q.cat] = [0, 0]);
    st[1] += 1;
    if (ok) { st[0] += 1; z.right += 1; delete store.wrong[q.id]; } else { store.wrong[q.id] = 1; z.missed.push(q); }
    save();
  }
  function nextQ() {
    var z = ui.quiz; if (!z || z.picked === null) return;
    if (z.i + 1 >= z.list.length) { z.done = true; return; }
    z.i += 1; z.picked = null; z.choices = choicesFor(z.list[z.i]);
  }
  function viewQuiz() {
    var z = ui.quiz, wn = wrongIds().length;
    if (!z) {
      var n = pool().length;
      return '<p class="fs-lead">1セット10問。答えるとすぐに正誤と解説が出ます。数字キー 1〜4 でも回答できます。</p>'
        + '<h4 class="fs-label">出題範囲</h4>' + chips('qcat', [['all', '全範囲']].concat(CATS.map(function (c) { return [c.id, c.name]; })), ui.qcat, '出題範囲')
        + '<h4 class="fs-label">出題形式</h4>' + chips('qtype', TYPES, ui.qtype, '出題形式')
        + '<p class="fs-count" role="status">' + (n ? '対象の問題: ' + n + '問(この中から' + Math.min(10, n) + '問を出題)' : 'この組み合わせに当てはまる問題がありません。範囲か形式を変えてください。') + '</p>'
        + '<div class="fs-row"><button type="button" class="fs-btn fs-primary" data-a="start"' + (n ? '' : ' disabled') + '>クイズを始める</button>'
        + '<button type="button" class="fs-btn" data-a="review"' + (wn ? '' : ' disabled') + '>間違えた問題を復習(' + wn + '問)</button></div>';
    }
    if (z.done) {
      var pct = Math.round(z.right / z.list.length * 100);
      return '<div class="fs-result" tabindex="-1" data-focus="result"><p class="fs-score"><b>' + z.right + '</b> / ' + z.list.length + ' 問正解<span>(' + pct + '%)</span></p>'
        + (z.missed.length ? '<h4>間違えた問題</h4><ul class="fs-missed">' + z.missed.map(function (q) {
          return '<li><span>' + esc(q.sub) + '</span>' + (q.code ? '<code class="fs-code">' + esc(q.code) + '</code>' : '') + '<b class="' + (q.mono ? 'fs-mono' : '') + '">' + esc(q.a) + '</b></li>';
        }).join('') + '</ul>' : '<p>全問正解です。</p>')
        + '<div class="fs-row"><button type="button" class="fs-btn fs-primary" data-a="' + (z.review ? 'review' : 'start') + '"' + (z.review && !wn ? ' disabled' : '') + '>もう1セット</button>'
        + (!z.review && wn ? '<button type="button" class="fs-btn" data-a="review">間違えた問題を復習(' + wn + '問)</button>' : '')
        + '<button type="button" class="fs-btn" data-a="quit">出題設定に戻る</button></div></div>';
    }
    var q = z.list[z.i], done = z.picked !== null, ok = done && z.choices[z.picked] === q.a;
    var h = '<div class="fs-qhead"><span>' + (z.review ? '復習 ' : '') + '第 ' + (z.i + 1) + ' 問 / ' + z.list.length + '</span><span>' + esc(catName(q.cat)) + '</span>'
      + '<button type="button" class="fs-link" data-a="quit">やめる</button></div>'
      + '<div class="fs-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + z.list.length + '" aria-valuenow="' + (z.i + (done ? 1 : 0)) + '" aria-label="進み具合"><i style="width:' + ((z.i + (done ? 1 : 0)) / z.list.length * 100) + '%"></i></div>'
      + '<p class="fs-q" tabindex="-1" data-focus="q">' + esc(q.q) + '</p>'
      + '<p class="fs-sub' + (q.type === 'key' && !q.mono ? ' fs-mono' : '') + '">' + esc(q.sub) + '</p>'
      + (q.code ? '<code class="fs-code fs-qcode">' + esc(q.code) + '</code>' : '')
      + '<div class="fs-choices" role="group" aria-label="選択肢">' + z.choices.map(function (c, i) {
        var cls = 'fs-choice' + (q.mono ? ' fs-mono' : ''), mark = '';
        if (done) {
          if (c === q.a) { cls += ' is-right'; mark = '<span class="fs-mark">正解</span>'; }
          else if (i === z.picked) { cls += ' is-wrong'; mark = '<span class="fs-mark">あなたの回答</span>'; }
        }
        return '<button type="button" class="' + cls + '" data-a="pick" data-v="' + i + '"' + (done ? ' aria-disabled="true"' : '') + '><span class="fs-num" aria-hidden="true">' + (i + 1) + '</span><span class="fs-ctext">' + esc(c) + '</span>' + mark + '</button>';
      }).join('') + '</div>';
    if (done) {
      h += '<div class="fs-fb ' + (ok ? 'is-right' : 'is-wrong') + '" role="status"><b>' + (ok ? '正解' : '不正解') + '</b><p>' + esc(q.ex) + '</p></div>'
        + '<div class="fs-row"><button type="button" class="fs-btn fs-primary" data-a="next" data-focus="next">' + (z.i + 1 >= z.list.length ? '結果を見る' : '次の問題へ') + '</button></div>';
    }
    return h;
  }

  /* ---------- 単語帳 ---------- */
  function buildDeck() {
    ui.deck = FUNCS.filter(function (f) { return (ui.ccat === 'all' || f.c === ui.ccat) && (!ui.conly || store.cards[f.n] !== 1); });
    ui.ci = 0; ui.flip = false;
  }
  function viewCards() {
    if (!ui.deck) buildDeck();
    var d = ui.deck, known = FUNCS.filter(function (f) { return store.cards[f.n] === 1; }).length;
    var h = '<p class="fs-lead">表に用途、裏に関数と構文が出ます。カードを押す(または Enter / Space)とめくれます。</p>'
      + chips('ccat', [['all', '全範囲']].concat(CATS.filter(function (c) { return c.id !== 'key'; }).map(function (c) { return [c.id, c.name]; })), ui.ccat, '単語帳の範囲')
      + '<div class="fs-row"><button type="button" class="fs-chip" data-a="conly" aria-pressed="' + ui.conly + '">「まだ」のカードだけ</button>'
      + '<button type="button" class="fs-chip" data-a="cshuffle">シャッフル</button><span class="fs-count">覚えた: ' + known + ' / ' + FUNCS.length + '</span></div>';
    if (!d.length) return h + '<p class="fs-empty" role="status">この範囲のカードはすべて「覚えた」になっています。</p>';
    if (ui.ci >= d.length) ui.ci = 0;
    var f = d[ui.ci], st = store.cards[f.n];
    h += '<p class="fs-count" role="status">' + (ui.ci + 1) + ' / ' + d.length + ' 枚 ・ ' + esc(catName(f.c)) + (st === 1 ? ' ・ 覚えた' : st === 0 ? ' ・ まだ' : '') + '</p>'
      + '<button type="button" class="fs-flash' + (ui.flip ? ' is-back' : '') + '" data-a="flip" data-focus="flip" aria-label="' + (ui.flip ? '裏面。押すと表に戻る' : '表面。押すと答えを表示') + '">'
      + (ui.flip
        ? '<span class="fs-side">関数</span><span class="fs-fname">' + esc(f.n) + '</span><code class="fs-code">' + esc(f.syn) + '</code><span class="fs-side">使用例</span><code class="fs-code">' + esc(f.ex) + '</code><span class="fs-exd">' + esc(f.exd) + '</span>'
        : '<span class="fs-side">用途</span><span class="fs-front">' + esc(f.use) + '</span><span class="fs-hint">押して答えを見る</span>')
      + '</button>'
      + '<div class="fs-row fs-center"><button type="button" class="fs-btn" data-a="cprev" aria-label="前のカード">← 前</button>'
      + '<button type="button" class="fs-btn fs-still" data-a="cstill">まだ</button>'
      + '<button type="button" class="fs-btn fs-primary" data-a="cknow">覚えた</button>'
      + '<button type="button" class="fs-btn" data-a="cnext" aria-label="次のカード">次 →</button></div>';
    return h;
  }

  /* ---------- 進捗 ---------- */
  function viewProgress() {
    var tr = 0, tt = 0, wn = wrongIds().length;
    var rows = CATS.map(function (c) {
      var s = store.stats[c.id] || [0, 0]; tr += s[0]; tt += s[1];
      var p = s[1] ? Math.round(s[0] / s[1] * 100) : 0;
      return '<li><div class="fs-prow"><span>' + esc(c.name) + '</span><span>' + (s[1] ? p + '%(' + s[0] + ' / ' + s[1] + ')' : '未回答') + '</span></div>'
        + '<div class="fs-bar' + (s[1] && p < 60 ? ' is-low' : '') + '" role="img" aria-label="' + esc(c.name) + ' 正答率 ' + (s[1] ? p + 'パーセント' : '未回答') + '"><i style="width:' + p + '%"></i></div></li>';
    }).join('');
    var known = FUNCS.filter(function (f) { return store.cards[f.n] === 1; }).length;
    return '<div class="fs-stats"><div><b>' + (tt ? Math.round(tr / tt * 100) + '%' : '-') + '</b><span>全体の正答率(' + tr + ' / ' + tt + ')</span></div>'
      + '<div><b>' + known + '<small> / ' + FUNCS.length + '</small></b><span>単語帳で覚えた関数</span></div>'
      + '<div><b>' + wn + '</b><span>復習待ちの問題</span></div></div>'
      + '<div class="fs-row"><button type="button" class="fs-btn fs-primary" data-a="review"' + (wn ? '' : ' disabled') + '>間違えた問題だけ復習する(' + wn + '問)</button></div>'
      + '<h3 class="fs-h">カテゴリ別の正答率</h3><ul class="fs-plist">' + rows + '</ul>'
      + '<div class="fs-row"><button type="button" class="fs-btn fs-danger" data-a="reset" data-focus="reset">' + (ui.confirmReset ? 'もう一度押すと記録をすべて消します' : '学習記録をリセット') + '</button>'
      + (ui.confirmReset ? '<button type="button" class="fs-btn" data-a="noreset">やめる</button>' : '') + '</div>'
      + '<p class="fs-fine">記録はこのブラウザの中にだけ保存されます。</p>';
  }

  /* ---------- 描画とイベント ---------- */
  function render(focusKey) {
    if (!root) return;
    var body = ui.tab === 'lesson' ? viewLesson() : ui.tab === 'quiz' ? viewQuiz() : ui.tab === 'cards' ? viewCards() : viewProgress();
    root.innerHTML = '<div class="fs-wrap"><div class="fs-top"><h2 class="fs-title">学習</h2><p>用途ごとに、どの関数が最適かを覚える</p></div>'
      + '<div class="fs-tabs" role="tablist" aria-label="学習メニュー">' + TABS.map(function (t) {
        var on = t[0] === ui.tab;
        return '<button type="button" role="tab" id="fs-tab-' + t[0] + '" aria-selected="' + on + '" aria-controls="fs-panel" tabindex="' + (on ? 0 : -1) + '" data-a="tab" data-v="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>'
      + '<div class="fs-panel" id="fs-panel" role="tabpanel" aria-labelledby="fs-tab-' + ui.tab + '">' + body + '</div></div>';
    if (focusKey) {
      var el = null;
      try { el = root.querySelector(focusKey); } catch (e) { el = null; }
      if (el && el.focus) { try { el.focus({ preventScroll: focusKey.indexOf('data-a=') > -1 }); } catch (e2) { el.focus(); } }
    }
  }
  function sel(a, v) { return '[data-a="' + a + '"]' + (v !== undefined && v !== null ? '[data-v="' + v + '"]' : ''); }

  function act(a, v) {
    var f = sel(a, v);
    switch (a) {
      case 'tab': ui.tab = v; ui.confirmReset = false; if (v === 'cards') ui.deck = null; break;
      case 'cat': ui.cat = v; break;
      case 'qcat': ui.qcat = v; break;
      case 'qtype': ui.qtype = v; break;
      case 'start': startQuiz(false); f = '[data-focus="q"]'; break;
      case 'review': ui.tab = 'quiz'; startQuiz(true); f = ui.quiz ? '[data-focus="q"]' : null; break;
      case 'quit': ui.quiz = null; f = sel('start'); break;
      case 'pick': answer(Number(v)); f = '[data-focus="next"]'; break;
      case 'next': nextQ(); f = ui.quiz && ui.quiz.done ? '[data-focus="result"]' : '[data-focus="q"]'; break;
      case 'ccat': ui.ccat = v; buildDeck(); break;
      case 'conly': ui.conly = !ui.conly; buildDeck(); break;
      case 'cshuffle': if (!ui.deck) buildDeck(); ui.deck = shuffle(ui.deck); ui.ci = 0; ui.flip = false; break;
      case 'flip': ui.flip = !ui.flip; f = '[data-focus="flip"]'; break;
      case 'cprev': ui.ci = (ui.ci - 1 + ui.deck.length) % ui.deck.length; ui.flip = false; break;
      case 'cnext': ui.ci = (ui.ci + 1) % ui.deck.length; ui.flip = false; break;
      case 'cknow': case 'cstill':
        if (ui.deck && ui.deck.length) {
          store.cards[ui.deck[ui.ci].n] = a === 'cknow' ? 1 : 0; save();
          if (ui.conly && a === 'cknow') { ui.deck.splice(ui.ci, 1); if (ui.ci >= ui.deck.length) ui.ci = 0; }
          else ui.ci = (ui.ci + 1) % ui.deck.length;
          ui.flip = false;
        }
        f = '[data-focus="flip"]';
        break;
      case 'reset':
        if (ui.confirmReset) { store = blank(); save(); ui.confirmReset = false; ui.deck = null; } else ui.confirmReset = true;
        f = '[data-focus="reset"]';
        break;
      case 'noreset': ui.confirmReset = false; f = '[data-focus="reset"]'; break;
      default: return;
    }
    render(f);
  }

  function onClick(e) {
    var b = e.target.closest ? e.target.closest('[data-a]') : null;
    if (!b || !root.contains(b) || b.disabled) return;
    act(b.getAttribute('data-a'), b.getAttribute('data-v'));
  }
  function onKey(e) {
    var t = e.target;
    if (t && t.getAttribute && t.getAttribute('role') === 'tab' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End')) {
      var i = 0; TABS.forEach(function (x, n) { if (x[0] === ui.tab) i = n; });
      i = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
      e.preventDefault(); act('tab', TABS[i][0]); return;
    }
    if (ui.tab === 'quiz' && ui.quiz && !ui.quiz.done && !e.ctrlKey && !e.metaKey && !e.altKey && /^[1-4]$/.test(e.key) && ui.quiz.picked === null) {
      e.preventDefault(); act('pick', Number(e.key) - 1);
    }
  }

  function mount(el) {
    if (!el) return;
    if (root !== el) {
      if (root) { root.removeEventListener('click', onClick); root.removeEventListener('keydown', onKey); }
      root = el;
      root.addEventListener('click', onClick);
      root.addEventListener('keydown', onKey);
    }
    store = load();
    render(null);
  }

  window.FormulaStudy = { mount: mount, _counts: { categories: CATS.length, functions: FUNCS.length, questions: QUESTIONS.length, use: FUNCS.length, fill: FILLS.length, key: KEYS.length } };

  function boot() { var el = document.getElementById('study'); if (el) mount(el); }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }
})();
