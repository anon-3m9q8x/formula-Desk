// 関数一覧: 構文セルと詳細行を表に足し、検索・カテゴリ・対応ソフトで絞り込む。
(() => {
  const byId = id => document.getElementById(id);
  const table = byId('fntable');
  if (!table || !table.tBodies[0]) return;
  const syntaxData = () => window.FN_SYNTAX || {};
  const norm = text => String(text).normalize('NFKC').toLowerCase().trim();
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const splitArgs = text => String(text || '').split('｜').map(part => part.trim()).filter(Boolean).map(part => {
    const m = /^(.+?)\s*[:：]\s*(.+)$/s.exec(part);
    return m ? [m[1], m[2]] : ['', part];
  });
  async function copyText(text, button) {
    const label = button.dataset.label || button.textContent;
    button.dataset.label = label;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'コピー済み';
    } catch {
      const area = el('textarea');
      area.value = text; area.setAttribute('readonly', ''); area.style.cssText = 'position:fixed;opacity:0';
      document.body.append(area); area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch {}
      area.remove();
      button.textContent = ok ? 'コピー済み' : 'コピーできません';
    }
    setTimeout(() => { button.textContent = label; }, 1600);
  }

  const headRow = table.tHead?.rows[0];
  if (headRow) {
    const th = el('th', null, '構文'); th.scope = 'col';
    headRow.cells[0].after(th);
    headRow.cells[6]?.classList.add('fn-note');
  }
  const columns = headRow ? headRow.cells.length : 7;

  const items = Array.from(table.tBodies[0].rows, (row, index) => {
    const name = row.cells[0].textContent.trim();
    const entry = syntaxData()[name];
    const known = Array.isArray(entry) && entry[0];
    const item = {
      row, name, index,
      syntax: known ? String(entry[0]) : '=' + name + '(…)',
      args: known ? splitArgs(entry[1]) : [],
      category: row.cells[1].textContent.trim(),
      excel: row.cells[2].textContent.trim() === '○',
      sheets: row.cells[3].textContent.trim() === '○',
      summary: row.cells[4].textContent.trim(),
      note: row.cells[5]?.textContent.trim() || '',
      open: false, detail: null
    };
    item.text = norm([name, item.category, item.summary, item.note, item.syntax, known ? entry[1] : ''].join(' '));

    const toggle = el('button', 'fn-toggle', name);
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    row.cells[0].replaceChildren(toggle);
    item.toggle = toggle;

    const cell = el('td', 'fn-syntax');
    cell.append(el('code', null, item.syntax));
    const copy = el('button', 'copy fn-copy', 'コピー');
    copy.type = 'button';
    copy.setAttribute('aria-label', name + ' の構文をコピー');
    cell.append(copy);
    row.cells[0].after(cell);

    row.cells[2].classList.add('fn-cat');
    row.cells[3].classList.add('fn-soft'); row.cells[3].dataset.label = 'Excel';
    row.cells[4].classList.add('fn-soft'); row.cells[4].dataset.label = 'スプレッドシート';
    for (const i of [3, 4]) {
      const ok = row.cells[i].textContent.trim() === '○';
      row.cells[i].classList.add(ok ? 'yes' : 'no');
      row.cells[i].setAttribute('aria-label', row.cells[i].dataset.label + (ok ? ' 対応' : ' 非対応'));
    }
    row.cells[5].classList.add('fn-summary');
    row.cells[6]?.classList.add('fn-note');
    row.classList.add('fn-row');
    row.dataset.fn = String(index);
    return item;
  });
  table.classList.add('enhanced');

  function buildDetail(item) {
    const tr = el('tr', 'fn-detail');
    const td = el('td'); td.colSpan = columns;
    const box = el('div', 'fn-detail-box');
    box.id = 'fn-detail-' + item.index;

    const code = el('div', 'code');
    code.append(el('code', null, item.syntax));
    const copy = el('button', 'copy', '構文をコピー'); copy.type = 'button';
    copy.onclick = () => copyText(item.syntax, copy);
    const actions = el('span', 'formula-actions'); actions.append(copy);
    code.append(actions);
    box.append(code);

    const grid = el('div', 'fn-detail-grid');
    const argsBlock = el('div');
    argsBlock.append(el('h4', null, '引数'));
    if (item.args.length) {
      const dl = el('dl', 'fn-args');
      for (const [term, desc] of item.args) {
        if (term) dl.append(el('dt', null, term));
        const dd = el('dd', null, desc);
        if (!term) dd.className = 'wide';
        dl.append(dd);
      }
      argsBlock.append(dl);
    } else {
      argsBlock.append(el('p', 'fn-none', 'この関数の引数の説明はまだ登録されていません。'));
    }
    const facts = el('dl', 'fn-facts');
    const fact = (term, value) => { facts.append(el('dt', null, term), el('dd', null, value)); };
    fact('機能', item.summary || '—');
    fact('カテゴリ', item.category);
    fact('対応ソフト', [item.excel ? 'Excel' : '', item.sheets ? 'Google スプレッドシート' : ''].filter(Boolean).join('、') || '—');
    if (item.note) fact('備考', item.note);
    grid.append(argsBlock, facts);
    box.append(grid);
    td.append(box); tr.append(td);
    item.toggle.setAttribute('aria-controls', box.id);
    return tr;
  }
  function setOpen(item, open) {
    item.open = open;
    if (open && !item.detail) { item.detail = buildDetail(item); item.row.after(item.detail); }
    if (item.detail) item.detail.hidden = !open;
    item.row.classList.toggle('open', open);
    item.toggle.setAttribute('aria-expanded', String(open));
  }
  table.tBodies[0].addEventListener('click', event => {
    const row = event.target.closest('tr.fn-row');
    if (!row) return;
    const item = items[Number(row.dataset.fn)];
    const copy = event.target.closest('.fn-copy');
    if (copy) { copyText(item.syntax, copy); return; }
    if (!event.target.closest('.fn-toggle') && String(getSelection()).trim()) return;
    setOpen(item, !item.open);
  });

  function filterFunctions() {
    const terms = norm(byId('fnsearch').value).split(/\s+/).filter(Boolean);
    const category = byId('fncategory').value;
    const software = byId('fnsoftware').value;
    let count = 0;
    for (const item of items) {
      const visible = (!category || item.category === category) &&
        (!software || (software === '2' ? item.excel : item.sheets)) &&
        terms.every(term => item.text.includes(term));
      item.row.hidden = !visible;
      if (item.detail) item.detail.hidden = !visible || !item.open;
      if (visible) count++;
    }
    byId('fncount').textContent = count + ' / ' + items.length + ' 件';
    byId('fnempty').hidden = count > 0;
    const scroller = table.closest('.libscroll');
    if (scroller) scroller.hidden = count === 0;
  }
  byId('fnsearch').oninput = filterFunctions;
  byId('fncategory').onchange = filterFunctions;
  byId('fnsoftware').onchange = filterFunctions;
  window.filterFunctions = filterFunctions;
  filterFunctions();
})();
