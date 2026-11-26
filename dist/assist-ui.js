// 関数アシスタントの表示。assistant.js の提案(検証結果つき)を描画し、数式エンジンで計算してシートに適用する。
(() => {
  const legacySuggest = suggest, legacyApply = applyProposal;
  const cellValue = (c, r) => {
    const cell = calculated[address(c, r)];
    return cell ? cell.value : rows[r - topRow]?.[c - left] ?? '';
  };
  const matrixOf = v => Array.isArray(v) ? (Array.isArray(v[0]) ? v : [v]) : [[v]];
  function display(v) {
    if (v == null) return '';
    if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('ja-JP') : String(Math.round(v * 1e6) / 1e6);
    if (v instanceof Date) return v.toLocaleDateString('ja-JP');
    return String(v);
  }
  function valueHtml(v) {
    if (v === undefined || v === null) return '<span class="muted">—</span>';
    const m = matrixOf(v);
    if (m.length === 1 && m[0].length === 1) return '<strong>' + esc(display(m[0][0])) + '</strong>';
    const shown = m.slice(0, 6);
    return '<table class="mini">' + shown.map(line => '<tr>' + line.slice(0, 8).map(x => '<td>' + esc(display(x)) + '</td>').join('') + '</tr>').join('') + '</table>' +
      (m.length > 6 ? '<small>ほか ' + (m.length - 6) + ' 行</small>' : '');
  }
  const verdicts = {
    verified: ['verified', '検証済み', '静的検証と実行結果の照合に合格した数式です。'],
    unverified: ['unverified', '未検証', '検証を完了できていません。結果を確認してから使ってください。'],
    'needs_input': ['needs-input', '確認が必要', ''],
  };
  async function copyText(button, text) {
    try { await navigator.clipboard.writeText(text); button.textContent = 'コピー済み'; }
    catch { button.textContent = '手動でコピーしてください'; }
  }
  function show(result) {
    const out = $('output');
    if (result.status === 'needs_input' || result.status === 'none' || !result.formula) {
      out.innerHTML = '<p class="verdict needs-input">確認が必要</p><p class="desc">' +
        esc(result.message || '条件を特定できませんでした。表の列名を使って「留学費用の合計」のように入力してください。') + '</p>';
      return;
    }
    const [cls, label, lead] = verdicts[result.status] || verdicts.unverified;
    const checks = (result.checks || []).map(c => {
      const state = c.ok === true ? 'ok' : c.ok === false ? 'ng' : 'skip';
      const mark = { ok: '合格', ng: '不合格', skip: '未実施' }[state];
      return '<li class="' + state + '" aria-label="' + mark + '"><b>' + esc(c.label || c.id) + '</b>' +
        (c.detail ? ' <small>' + esc(c.detail) + '</small>' : '') + '</li>';
    }).join('');
    const alts = (result.alternatives || []).filter(a => a?.formula).map(a =>
      '<li><span class="fn">' + esc(a.fn || '') + '</span><code>' + esc(a.formula) + '</code>' + (a.note ? '<small>' + esc(a.note) + '</small>' : '') + '</li>').join('');
    const newer = platform === 'Excel' && /\b(FILTER|UNIQUE|SORT|XLOOKUP|TEXTJOIN|IFS)\(/.test(result.formula) ? '（Microsoft 365 / Excel 2021 以降）' : '';
    out.innerHTML =
      '<p class="verdict ' + cls + '">' + label + '</p>' +
      '<p><span class="fn">' + esc(result.fn || '') + '</span><span class="subtitle">' + esc(result.title || catalog[result.fn] || '') + '</span></p>' +
      '<div class="code"><code>' + esc(result.formula) + '</code><span class="formula-actions"><button id="useFormula">数式を適用</button><button class="copy" id="copy">コピー</button></span></div>' +
      '<p class="desc">' + esc(result.note || '') + ' ' + esc(platform) + ' 用' + newer + '</p>' +
      (lead ? '<p class="desc">' + lead + '</p>' : '') +
      (checks ? '<h4>出力前の検証</h4><ul class="checks">' + checks + '</ul>' : '') +
      (result.expected !== undefined || result.actual !== undefined
        ? '<div class="compare"><div><span>期待値(表から直接計算)</span>' + valueHtml(result.expected) + '</div><div><span>数式の実行結果</span>' + valueHtml(result.actual) + '</div></div>' : '') +
      (alts ? '<h4>別の書き方</h4><ul class="alts">' + alts + '</ul>' : '') +
      '<p class="desc">「=」なしの解答欄用: <code>' + esc(result.formula.replace(/^=/, '')) + '</code></p>';
    $('useFormula').onclick = apply;
    $('copy').onclick = () => copyText($('copy'), result.formula);
  }
  function apply() {
    if (!proposal) return;
    if (!proposal.assisted || !window.FormulaEngine) return legacyApply();
    try {
      let matrix;
      try { matrix = FormulaEngine.evaluate(proposal.formula, cellValue); }
      catch (e) {
        if (e.message === '#UNSUPPORTED') throw Error('この関数はサイト内では計算できません。コピーして ' + platform + ' に貼り付けてください。');
        matrix = [[e.message]];
      }
      matrix = matrixOf(matrix).map(line => line.map(v => v instanceof Date ? v.toLocaleDateString('ja-JP') : v));
      const { c, r } = resultPosition(matrix), a = address(c, r), output = {};
      for (const [i, line] of matrix.entries()) for (const [j, value] of line.entries()) {
        const cell = address(c + j, r + i);
        if (c + j - left > 511 || r + i - topRow > 4999) throw Error('結果が表示範囲を超えます。');
        if (calculated[cell] || (c + j < left + rows[0].length && r + i < topRow + rows.length)) throw Error('元の表や計算結果と重なります。');
        output[cell] = { value, ...(i === 0 && j === 0 ? { formula: proposal.formula } : { spill: a }) };
      }
      checkpoint(); Object.assign(calculated, output); render(); selectCell(r - topRow, c - left); resetGridSelection();
      $('preview').querySelector('.selected')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const end = address(c + Math.max(...matrix.map(line => line.length)) - 1, r + matrix.length - 1);
      $('applyStatus').textContent = (end === a ? a : a + ' ～ ' + end) + ' に適用しました。「元に戻す」で取り消せます。';
    } catch (e) { $('applyStatus').textContent = e.message; }
  }
  suggest = function () {
    if (!window.FormulaAssistant) return legacySuggest();
    proposal = null; $('applyStatus').textContent = ''; suggestedGoal = $('goal').value;
    const q = $('goal').value.trim(), data = rows.slice(1);
    if (!q) { $('output').innerHTML = '<p class="desc">やりたいことを文章で入力すると、表に合わせた数式を作り、検証してから表示します。</p>'; return; }
    if (!data.length) { $('output').textContent = 'データ行を含めて貼り付けると数式を提案できます。'; return; }
    let result;
    try { result = FormulaAssistant.propose(q, { headers: rows[0], data, left, topRow, platform }); }
    catch (e) { console.error(e); return legacySuggest(); }
    if (!result) return legacySuggest();
    if (result.formula && result.status !== 'needs_input' && result.status !== 'none') proposal = { ...result, assisted: true };
    show(result);
  };
  $('run').onclick = () => suggest();
  suggest();
})();
