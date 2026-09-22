/* ---------------------------- Modal helper ---------------------------- */
function openModal(html, opts={}){
  closeModal();
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.id = 'activeModal';
  bd.innerHTML = `<div class="modal ${opts.wide?'modal-wide':''}">${html}</div>`;
  bd.addEventListener('mousedown', (e)=>{ if(e.target===bd && !opts.noBackdropClose) closeModal(); });
  document.body.appendChild(bd);
  document.body.style.overflow='hidden';
}
function closeModal(){
  const m = document.getElementById('activeModal');
  if(m) m.remove();
  document.body.style.overflow='';
}

/* ---------------------------- Searchable select (datalist-based) ----------------------------
 * Renders a type-to-filter picker backed by a native <datalist>, plus a hidden field that
 * carries the real value (id) so downstream form code is unchanged. Labels should be unique
 * (include an id/SN suffix) so a typed label resolves back to exactly one value.
 *   options: [{ value, label }]
 *   allowFree: keep whatever the user typed as the value when it matches no option (e.g. holder)
 */
function searchableSelectHtml({ name, id, options, value = '', placeholder = 'พิมพ์เพื่อค้นหา...', required = false, allowFree = false }){
  const listId = id + '_dl';
  const selected = options.find(o => String(o.value) === String(value));
  const displayVal = selected ? selected.label : (allowFree ? value : '');
  return `
    <input list="${listId}" id="${id}_disp" autocomplete="off" placeholder="${escapeHtml(placeholder)}"
           value="${escapeHtml(displayVal)}" ${required ? 'required' : ''}>
    <datalist id="${listId}">
      ${options.map(o => `<option value="${escapeHtml(o.label)}"></option>`).join('')}
    </datalist>
    <input type="hidden" name="${name}" id="${id}" value="${escapeHtml(value)}">
  `;
}

/** Wire the datalist input to its hidden value field. Returns nothing; call after openModal(). */
function wireSearchableSelect(id, options, { allowFree = false, onChange = null } = {}){
  const disp = document.getElementById(id + '_disp');
  const hidden = document.getElementById(id);
  if (!disp || !hidden) return;
  const byLabel = new Map(options.map(o => [o.label, String(o.value)]));
  const sync = () => {
    const v = disp.value.trim();
    if (byLabel.has(v)) {
      hidden.value = byLabel.get(v);
      disp.setCustomValidity('');
    } else if (allowFree) {
      hidden.value = v;
      disp.setCustomValidity('');
    } else {
      hidden.value = '';
      disp.setCustomValidity(v ? 'กรุณาเลือกจากรายการที่มี' : '');
    }
    if (onChange) onChange(hidden.value);
  };
  disp.addEventListener('input', sync);
  disp.addEventListener('change', sync);
  sync();
}
