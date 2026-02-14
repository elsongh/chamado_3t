// app.js - controle simples de chamados usando localStorage
(() => {
  const STORAGE_KEY = 'chamados';

  // elementos
  const form = document.getElementById('chamadoForm');
  const dataInput = document.getElementById('data');
  const chamadoInput = document.getElementById('chamado');
  const solicitanteInput = document.getElementById('solicitante');
  const usuarioInput = document.getElementById('usuario');
  const localidadeInput = document.getElementById('localidade');
  const atividadeInput = document.getElementById('atividade');
  const clearBtn = document.getElementById('clearBtn');
  const listaTbody = document.querySelector('#lista tbody');
  const saveBtn = document.getElementById('saveBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFileInput = document.getElementById('importFile');

  let chamados = []; // array de objetos
  let editId = null; // id do chamado em edição

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      chamados = raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Erro ao carregar storage', e);
      chamados = [];
    }
  }

  function saveStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chamados));
  }

  function clearForm() {
    form.reset();
    editId = null;
    saveBtn.textContent = 'Adicionar';
  }

  function render() {
    listaTbody.innerHTML = '';
    if (chamados.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7;
      td.className = 'empty';
      td.textContent = 'Nenhum chamado registrado.';
      tr.appendChild(td);
      listaTbody.appendChild(tr);
      return;
    }

    chamados.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.data || ''}</td>
        <td>${escapeHtml(item.chamado)}</td>
        <td>${escapeHtml(item.solicitante)}</td>
        <td>${escapeHtml(item.usuario)}</td>
        <td>${escapeHtml(item.localidade)}</td>
        <td>${escapeHtml(item.atividade)}</td>
        <td class="acoes">
          <button class="edit" data-id="${item.id}">Editar</button>
          <button class="del" data-id="${item.id}">Excluir</button>
        </td>
      `;
      listaTbody.appendChild(tr);
    });

    // ligar eventos dos botões gerados
    listaTbody.querySelectorAll('button.edit').forEach(b => b.addEventListener('click', onEdit));
    listaTbody.querySelectorAll('button.del').forEach(b => b.addEventListener('click', onDelete));
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function onDelete(e) {
    const id = e.currentTarget.dataset.id;
    if (!confirm('Excluir este chamado?')) return;
    chamados = chamados.filter(c => c.id !== id);
    saveStorage();
    render();
  }

  function onEdit(e) {
    const id = e.currentTarget.dataset.id;
    const item = chamados.find(c => c.id === id);
    if (!item) return;
    // preencher form
    dataInput.value = item.data || '';
    chamadoInput.value = item.chamado || '';
    solicitanteInput.value = item.solicitante || '';
    usuarioInput.value = item.usuario || '';
    localidadeInput.value = item.localidade || '';
    atividadeInput.value = item.atividade || '';

    editId = id;
    saveBtn.textContent = 'Salvar';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function onSubmit(e) {
    e.preventDefault();
    const entry = {
      id: editId || String(Date.now()),
      data: dataInput.value,
      chamado: chamadoInput.value.trim(),
      solicitante: solicitanteInput.value.trim(),
      usuario: usuarioInput.value.trim(),
      localidade: localidadeInput.value.trim(),
      atividade: atividadeInput.value.trim()
    };

    // validação simples
    if (!entry.data || !entry.chamado) {
      alert('Preencha Data e Chamado antes de salvar.');
      return;
    }

    if (editId) {
      chamados = chamados.map(c => (c.id === editId ? entry : c));
    } else {
      chamados.unshift(entry); // novo no topo
    }

    saveStorage();
    render();
    clearForm();
  }

  // CSV export/import helpers
  function csvEscape(s) {
    if (s == null) return '';
    s = String(s);
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function toCSV(arr) {
    const header = ['Data','Chamado','Solicitante','Usuario','Localidade','Atividade'];
    const lines = [header.join(',')];
    arr.forEach(item => {
      const row = [item.data || '', item.chamado || '', item.solicitante || '', item.usuario || '', item.localidade || '', item.atividade || '']
        .map(csvEscape)
        .join(',');
      lines.push(row);
    });
    return lines.join('\r\n');
  }

  function downloadCSV() {
    const csv = toCSV(chamados);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    a.download = `chamados_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Simple but reasonably robust CSV parser (handles quoted fields and escaped quotes)
  function parseCSV(text) {
    const rows = [];
    let cur = '';
    let row = [];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i+1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { row.push(cur); cur = ''; }
        else if (ch === '\r') { continue; }
        else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
        else { cur += ch; }
      }
    }
    // push last
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  function onImportFile(e) {
    const file = (e && e.target && e.target.files && e.target.files[0]) || null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      const text = evt.target.result;
      const rows = parseCSV(text);
      if (!rows || rows.length < 2) { alert('CSV vazio ou inválido.'); return; }
      const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
      const mapHeaderToField = h => {
        if (!h) return null;
        h = h.normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase();
        if (h.includes('data')) return 'data';
        if (h.includes('cham')) return 'chamado';
        if (h.includes('solicit')) return 'solicitante';
        if (h.includes('usuario') || h.includes('user')) return 'usuario';
        if (h.includes('local')) return 'localidade';
        if (h.includes('ativ')) return 'atividade';
        return null;
      };

      const headerFields = headers.map(mapHeaderToField);
      const imported = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.every(cell => String(cell||'').trim() === '')) continue; // skip empty lines
        const obj = { id: String(Date.now()) + '_' + i };
        for (let j = 0; j < headerFields.length; j++) {
          const field = headerFields[j];
          if (!field) continue;
          obj[field] = (r[j] || '').trim();
        }
        // basic validation: require chamado at least
        if (!obj.chamado) obj.chamado = obj.atividade || 'importado';
        imported.push(obj);
      }
      if (imported.length === 0) { alert('Nenhuma linha válida encontrada no CSV.'); return; }
      // adicionar no topo, preservando existente
      chamados = imported.reverse().concat(chamados);
      saveStorage();
      render();
      alert(`${imported.length} registro(s) importado(s).`);
      importFileInput.value = '';
    };
    reader.onerror = function() { alert('Erro ao ler o arquivo.'); };
    reader.readAsText(file, 'utf-8');
  }

  // inicialização
  form.addEventListener('submit', onSubmit);
  clearBtn.addEventListener('click', clearForm);
  if (exportBtn) exportBtn.addEventListener('click', downloadCSV);
  if (importBtn && importFileInput) {
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', onImportFile);
  }

  load();
  render();

})();
