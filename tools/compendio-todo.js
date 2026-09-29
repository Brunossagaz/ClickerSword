/*
 * compendio-todo.js — aba To-do do Compêndio.
 *
 * Lista de tarefas { id, title, desc, status, created } salva em
 * tools/todo-data.json pela rota POST /api/todo do tools/dev_server.py
 * (salva sozinha ~0,6s depois de cada mudança). Sem o servidor, guarda uma
 * cópia no localStorage e tenta mandar de novo na próxima vez que abrir.
 *
 * Tudo que vem do arquivo/usuário entra na página só por textContent/value
 * (nada de innerHTML com dados).
 */
const TodoView = (() => {
  const STATUSES = [
    ['todo', 'A fazer'],
    ['think', 'A se pensar'],
    ['done', 'Concluído'],
    ['nonsense', 'Não faz sentido'],
  ];
  const STATUS_KEYS = STATUSES.map(s => s[0]);
  const LOCAL_KEY = 'compendioTodo';
  const $ = id => document.getElementById(id);

  let items = [];
  let filter = '';        // '' = todas
  let saveTimer = null;
  let saving = false, dirty = false;

  // mesmas regras do servidor (tools/dev_server.py → _save_todo)
  function clean(list){
    if(!Array.isArray(list)) return [];
    const out = [];
    for(const it of list.slice(0, 1000)){
      if(!it || typeof it !== 'object') continue;
      const id = typeof it.id === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(it.id) ? it.id : newId();
      const title = typeof it.title === 'string' ? it.title.trim().slice(0, 120) : '';
      if(!title) continue;
      out.push({
        id, title,
        desc: typeof it.desc === 'string' ? it.desc.slice(0, 2000) : '',
        status: STATUS_KEYS.includes(it.status) ? it.status : 'todo',
        created: typeof it.created === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.created) ? it.created : '',
      });
    }
    return out;
  }
  function newId(){ return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function today(){ return new Date().toISOString().slice(0, 10); }

  function readLocal(){
    try{ return JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); }catch(e){ return null; }
  }
  function writeLocal(pending){
    try{ localStorage.setItem(LOCAL_KEY, JSON.stringify({ pending, items })); }catch(e){}
  }

  async function load(){
    let fromFile = null;
    try{
      const res = await fetch('tools/todo-data.json', { cache: 'no-store' });
      if(res.ok) fromFile = clean((await res.json()).items);
    }catch(e){}
    const local = readLocal();
    // cópia local que não chegou ao arquivo (servidor fora do ar) ganha
    if(local && local.pending){
      items = clean(local.items);
      render();
      scheduleSave(0);
      return;
    }
    items = fromFile || (local ? clean(local.items) : []);
    setStatus(fromFile ? 'Carregado de tools/todo-data.json' : 'Sem arquivo — salvando neste navegador');
    render();
  }

  function scheduleSave(delay = 600){
    dirty = true;
    setStatus('Não salvo…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, delay);
  }
  async function save(){
    if(saving){ scheduleSave(); return; }
    saving = true; dirty = false;
    writeLocal(true);
    try{
      const res = await fetch('api/todo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
      if(!res.ok) throw new Error('HTTP ' + res.status);
      writeLocal(false);
      setStatus('Salvo em tools/todo-data.json');
    }catch(e){
      setStatus('Salvo só neste navegador (rode tools/dev_server.py pra gravar no arquivo)', true);
    }
    saving = false;
  }
  function setStatus(text, warn){
    const el = $('todoSaveStatus');
    el.textContent = text;
    el.style.color = warn ? 'var(--ember)' : '';
  }

  function statusSelect(value){
    const sel = document.createElement('select');
    for(const [k, label] of STATUSES){
      const o = document.createElement('option');
      o.value = k; o.textContent = label;
      if(k === value) o.selected = true;
      sel.appendChild(o);
    }
    return sel;
  }

  function itemEl(it){
    const box = document.createElement('div');
    box.className = 'todo-item st-' + it.status;

    const title = document.createElement('input');
    title.className = 'todo-title';
    title.maxLength = 120;
    title.value = it.title;
    title.addEventListener('input', () => {
      if(title.value.trim()){ it.title = title.value.trim(); scheduleSave(); }
    });
    title.addEventListener('change', () => { if(!title.value.trim()) title.value = it.title; });

    const actions = document.createElement('div');
    actions.className = 'todo-actions';
    const sel = statusSelect(it.status);
    sel.title = 'Situação';
    sel.addEventListener('change', () => { it.status = sel.value; scheduleSave(); render(); });
    const del = document.createElement('button');
    del.className = 'x';
    del.title = 'Excluir tarefa';
    del.textContent = '×';
    del.addEventListener('click', () => {
      if(!confirm(`Excluir a tarefa "${it.title}"?`)) return;
      items = items.filter(x => x !== it);
      scheduleSave(); render();
    });
    actions.append(sel, del);

    const desc = document.createElement('textarea');
    desc.maxLength = 2000;
    desc.placeholder = 'O que deve ser feito…';
    desc.value = it.desc;
    desc.addEventListener('input', () => { it.desc = desc.value; scheduleSave(); });

    box.append(title, actions, desc);
    if(it.created){
      const meta = document.createElement('div');
      meta.className = 'todo-meta';
      meta.textContent = 'Incluída em ' + it.created.split('-').reverse().join('/');
      box.appendChild(meta);
    }
    return box;
  }

  function render(){
    // resumo por situação (cada um filtra a lista)
    const sum = $('todoSummary');
    sum.textContent = '';
    const mk = (key, label, n) => {
      const b = document.createElement('button');
      b.textContent = `${label}: ${n}`;
      b.classList.toggle('on', filter === key);
      b.addEventListener('click', () => { filter = filter === key ? '' : key; $('todoFilter').value = filter; render(); });
      sum.appendChild(b);
    };
    mk('', 'Todas', items.length);
    for(const [k, label] of STATUSES) mk(k, label, items.filter(i => i.status === k).length);

    const q = $('todoSearch').value.trim().toLowerCase();
    const shown = items.filter(i => (!filter || i.status === filter) &&
      (!q || i.title.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)));
    const list = $('todoList');
    list.textContent = '';
    if(!shown.length){
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = items.length ? 'Nenhuma tarefa com esse filtro.' : 'Nenhuma tarefa ainda — inclua a primeira acima.';
      list.appendChild(p);
      return;
    }
    // mantém a ordem da lista, mas agrupa por situação na ordem de STATUSES
    for(const k of STATUS_KEYS) for(const it of shown) if(it.status === k) list.appendChild(itemEl(it));
  }

  function add(){
    const t = $('todoNewTitle'), d = $('todoNewDesc');
    const title = t.value.trim();
    if(!title){ t.focus(); return; }
    items.unshift({ id: newId(), title: title.slice(0, 120), desc: d.value.slice(0, 2000), status: $('todoNewStatus').value, created: today() });
    t.value = d.value = '';
    scheduleSave(); render();
    t.focus();
  }

  function init(){
    const fill = (sel, opts) => { for(const [k, label] of opts){ const o = document.createElement('option'); o.value = k; o.textContent = label; sel.appendChild(o); } };
    fill($('todoNewStatus'), STATUSES);
    fill($('todoFilter'), [['', 'Todas'], ...STATUSES]);
    $('todoAddBtn').addEventListener('click', add);
    for(const id of ['todoNewTitle', 'todoNewDesc']) $(id).addEventListener('keydown', e => { if(e.key === 'Enter') add(); });
    $('todoFilter').addEventListener('change', () => { filter = $('todoFilter').value; render(); });
    $('todoSearch').addEventListener('input', render);
    window.addEventListener('beforeunload', e => {
      if(dirty || saving){ clearTimeout(saveTimer); save(); e.preventDefault(); e.returnValue = ''; }
    });
    load();
  }

  return { init };
})();
document.addEventListener('DOMContentLoaded', () => TodoView.init());
