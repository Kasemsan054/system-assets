/* ---------------------------- ASSETS VIEW ---------------------------- */
let assetFilter = { q: '', category: '', status: '', department: '' };
let assetPagination = { page: 1, limit: 10 };
let assetSort = { key: '', order: 'desc' };
let assetSelection = [];
let settingsUnlocked = false;
// Module-level ref so external functions (confirmDeleteAsset, openAssetForm) can refresh table
let _fetchAndRenderAssetRows = null;

async function renderAssetsList(view) {
  setHeader('ทะเบียนทรัพย์สิน', 'ทะเบียนทรัพย์สินทั้งหมด');

  // Static shell render (only once per view entry)
  view.innerHTML = `
    <div class="card">
      <div class="table-toolbar">
        <div class="search-box">
          ${ICONS.search}
          <input id="assetSearch"
                 placeholder="ค้นหาชื่อ / หมายเลข SN / สถานที่ / ผู้ถือครอง"
                 value="${escapeHtml(assetFilter.q)}">
        </div>
        <select class="filter-select" id="filterCategory">
          <option value="">ทุกหมวดหมู่</option>
          ${DB.categories.map(c => `
            <option value="${c.id}" ${assetFilter.category === c.id ? 'selected' : ''}>
              ${escapeHtml(c.name)}
            </option>`).join('')}
        </select>
        <select class="filter-select" id="filterStatus">
          <option value="">ทุกสถานะ</option>
          ${Object.entries(STATUS_LABELS).map(([k, v]) => `
            <option value="${k}" ${assetFilter.status === k ? 'selected' : ''}>
              ${v.label}
            </option>`).join('')}
        </select>
        <select class="filter-select" id="filterDept">
          <option value="">ทุกแผนก</option>
          ${DB.departments.map(d => `
            <option value="${d.id}" ${assetFilter.department === d.id ? 'selected' : ''}>
              ${escapeHtml(d.name)}
            </option>`).join('')}
        </select>
        <div class="toolbar-right">
          ${API.canEdit('assets') ? `
            <button class="btn btn-outline" id="btnBulkAction"
                    style="${assetSelection.length > 0 ? '' : 'display:none;'}">
              จัดการที่เลือก (<span id="assetBulkCount">${assetSelection.length}</span>)
            </button>` : ''}
          ${API.canEdit('assets') ? `
            <button class="btn btn-primary" id="btnAddAsset">
              ${ICONS.plus}เพิ่มทรัพย์สิน
            </button>` : ''}
        </div>
      </div>
      <div style="overflow-x:auto;">
      <table class="data-table">
        <thead><tr id="assetsTableHead">
          ${API.canEdit('assets') ? `
            <th style="width:40px;text-align:center;">
              <input type="checkbox" id="selectAllCheckbox">
            </th>` : ''}
          ${sortHeaderHtml('ชื่อทรัพย์สิน', 'name', assetSort.key, assetSort.order)}
          ${sortHeaderHtml('หมายเลขเครื่อง (S/N)', 'serial', assetSort.key, assetSort.order)}
          ${sortHeaderHtml('ผู้ถือครอง', 'holder', assetSort.key, assetSort.order)}
          ${sortHeaderHtml('สถานะ', 'status', assetSort.key, assetSort.order)}
          <th style="text-align:right;">
            ${API.canEdit('assets') ? 'การจัดการ' : 'ดูข้อมูล'}
          </th>
        </tr></thead>
        <tbody id="assetsTableBody">
          <tr>
            <td colspan="${API.canEdit('assets') ? 6 : 5}">
              <div style="padding:30px;text-align:center;color:var(--ink-500);">
                ${ICONS.assets} กำลังโหลดข้อมูล...
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
      <div class="table-toolbar" id="assetsPaginationBar"
           style="border-top:1px solid var(--line);border-bottom:none;justify-content:space-between;">
      </div>
    </div>
  `;

  // --- UI Update for Checkbox Selection without flickering ---
  function updateAssetSelectionUI() {
    view.querySelectorAll('.row-checkbox').forEach(cb => {
      cb.checked = assetSelection.includes(cb.value);
    });
    const selectAllCb = document.getElementById('selectAllCheckbox');
    if (selectAllCb) {
      const currentRows = DB.assets || [];
      selectAllCb.checked = currentRows.length > 0 &&
        currentRows.every(a => assetSelection.includes(a.id));
    }
    const btnBulk = document.getElementById('btnBulkAction');
    const countSpan = document.getElementById('assetBulkCount');
    if (btnBulk && countSpan) {
      countSpan.textContent = assetSelection.length;
      btnBulk.style.display = (API.canEdit('assets') && assetSelection.length > 0)
        ? 'inline-flex'
        : 'none';
    }
  }

  // --- Core Table Body & Pagination Render ---
  async function fetchAndRenderAssetRows() {
    // Expose to module scope so outside functions can call it
    _fetchAndRenderAssetRows = fetchAndRenderAssetRows;
    const tbody = document.getElementById('assetsTableBody');
    const pbar = document.getElementById('assetsPaginationBar');
    if (!tbody || !pbar) return;

    tbody.style.opacity = '0.6';

    let res = { data: [], total: 0 };
      res = await API.get('assets', {
        page: assetPagination.page,
        limit: assetPagination.limit,
        q: assetFilter.q,
        category: assetFilter.category,
        status: assetFilter.status,
        department: assetFilter.department,
        sortBy: assetSort.key,
        sortOrder: assetSort.order
      });
    } catch (e) {
      tbody.style.opacity = '1';
      tbody.innerHTML = `
        <tr>
          <td colspan="${API.canEdit('assets') ? 6 : 5}">
            <div style="padding:20px;text-align:center;color:var(--red-700);">
              เกิดข้อผิดพลาด: ${escapeHtml(e.message)}
            </div>
          </td>
        </tr>`;
      return;
    }

    tbody.style.opacity = '1';
    DB.assets = res.data || [];
    const paginated = DB.assets;
    const total = res.total || 0;
    const totalPages = Math.ceil(total / assetPagination.limit) || 1;
    if (assetPagination.page > totalPages) assetPagination.page = totalPages;
    const startIdx = (assetPagination.page - 1) * assetPagination.limit;

    // Render Table Body
    const canEdit = API.canEdit('assets');
    tbody.innerHTML = paginated.map(a => `
      <tr data-rowid="${escapeHtml(a.id)}" class="clickable-row" title="ดูรายละเอียด ${escapeHtml(a.name)}">
        ${canEdit ? `
          <td style="text-align:center;" data-norow>
            <input type="checkbox" class="row-checkbox" value="${a.id}">
          </td>` : ''}
        <td>
          <span class="asset-name-link">${escapeHtml(a.name)}</span>
          <div class="cell-sub">${escapeHtml(a.location || '')}</div>
        </td>
        <td>
          <span style="font-family:monospace;font-weight:600;color:var(--navy-800);">
            ${escapeHtml(a.id || a.serial || '-')}
          </span>
        </td>
        <td>${escapeHtml(holderDisplayName(a) || '—')}</td>
        <td>${statusTag(a.status)}</td>
        <td style="text-align:right;">
          <div class="row-actions" style="justify-content:flex-end;">
            <button class="icon-btn" data-view="${a.id}" title="ดูรายละเอียด">
              ${ICONS.eye}
            </button>
            ${canEdit ? `
              <button class="icon-btn" data-edit="${a.id}" title="แก้ไข">
                ${ICONS.edit}
              </button>
              <button class="icon-btn danger" data-del="${a.id}" title="ลบ">
                ${ICONS.trash}
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('') || `
      <tr>
        <td colspan="${canEdit ? 6 : 5}">
          <div class="empty-state">
            ${ICONS.box}
            <div class="et">ไม่พบทรัพย์สินที่ตรงกับเงื่อนไข</div>
            ลองปรับตัวกรองหรือเพิ่มทรัพย์สินใหม่
          </div>
        </td>
      </tr>`;

    // Render Pagination Bar
    pbar.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;font-size:12.5px;color:var(--ink-500);">
        <span>แสดง ${total === 0 ? 0 : startIdx + 1} ถึง
        ${Math.min(startIdx + assetPagination.limit, total)} จาก ${total} รายการ</span>
        <label style="display:flex;gap:5px;align-items:center;">
          ต่อหน้า:
          <select id="assetPageSize" class="filter-select" style="padding:3px 6px;min-width:auto;">
            ${[10, 25, 50, 100].map(n => `<option value="${n}" ${assetPagination.limit === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </label>
      </div>
      <div style="display:flex;gap:4px;align-items:center;">
        <button class="btn btn-outline btn-sm" id="btnPrevPage"
                ${assetPagination.page === 1 ? 'disabled' : ''}>ก่อนหน้า</button>
        <div style="padding:6px 10px;font-size:12.5px;">
          หน้า ${assetPagination.page} / ${totalPages}
        </div>
        <button class="btn btn-outline btn-sm" id="btnNextPage"
                ${assetPagination.page >= totalPages ? 'disabled' : ''}>ถัดไป</button>
      </div>
    `;

    // Bind Pagination Buttons
    document.getElementById('btnPrevPage')?.addEventListener('click', () => {
      assetPagination.page--;
      fetchAndRenderAssetRows();
    });
    document.getElementById('btnNextPage')?.addEventListener('click', () => {
      assetPagination.page++;
      fetchAndRenderAssetRows();
    });
    document.getElementById('assetPageSize')?.addEventListener('change', e => {
      assetPagination.limit = parseInt(e.target.value, 10) || 10;
      assetPagination.page = 1;
      fetchAndRenderAssetRows();
    });

    // Whole-row click → asset detail (ignore clicks on the checkbox column or action buttons)
    tbody.querySelectorAll('tr[data-rowid]').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button, input, a, [data-norow], .row-actions')) return;
        navigateTo('/assets/' + tr.dataset.rowid);
      });
    });

    // Bind Row Action Buttons
    tbody.querySelectorAll('[data-view]').forEach(b => {
      b.addEventListener('click', () => { navigateTo('/assets/' + b.dataset.view); });
    });
    tbody.querySelectorAll('[data-edit]').forEach(b => {
      b.addEventListener('click', () => openAssetForm(b.dataset.edit));
    });
    tbody.querySelectorAll('[data-del]').forEach(b => {
      b.addEventListener('click', () => confirmDeleteAsset(b.dataset.del));
    });

    // Bind Row Checkboxes (Zero flicker on click)
    tbody.querySelectorAll('.row-checkbox').forEach(cb => {
      cb.addEventListener('change', e => {
        if (e.target.checked) {
          if (!assetSelection.includes(e.target.value)) {
            assetSelection.push(e.target.value);
          }
        } else {
          assetSelection = assetSelection.filter(id => id !== e.target.value);
        }
        updateAssetSelectionUI();
      });
    });

    updateAssetSelectionUI();
  }

  // --- Filter Listeners ---
  // Debounce the search box so it fetches after the user pauses typing (~300ms) instead of every keystroke.
  let _searchTimer = null;
  document.getElementById('assetSearch')?.addEventListener('input', e => {
    assetFilter.q = e.target.value;
    assetPagination.page = 1;
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => fetchAndRenderAssetRows(), 300);
  });
  document.getElementById('filterCategory')?.addEventListener('change', e => {
    assetFilter.category = e.target.value;
    assetPagination.page = 1;
    fetchAndRenderAssetRows();
  });
  document.getElementById('filterStatus')?.addEventListener('change', e => {
    assetFilter.status = e.target.value;
    assetPagination.page = 1;
    fetchAndRenderAssetRows();
  });
  document.getElementById('filterDept')?.addEventListener('change', e => {
    assetFilter.department = e.target.value;
    assetPagination.page = 1;
    fetchAndRenderAssetRows();
  });

  // --- Sort & Header Binding ---
  function updateAssetHeaderUI() {
    const headTr = document.getElementById('assetsTableHead');
    if (!headTr) return;
    const canEdit = API.canEdit('assets');
    headTr.innerHTML = `
      ${canEdit ? `
        <th style="width:40px;text-align:center;">
          <input type="checkbox" id="selectAllCheckbox">
        </th>` : ''}
      ${sortHeaderHtml('ชื่อทรัพย์สิน', 'name', assetSort.key, assetSort.order)}
      ${sortHeaderHtml('หมายเลขเครื่อง (S/N)', 'serial', assetSort.key, assetSort.order)}
      ${sortHeaderHtml('ผู้ถือครอง', 'holder', assetSort.key, assetSort.order)}
      ${sortHeaderHtml('สถานะ', 'status', assetSort.key, assetSort.order)}
      <th style="text-align:right;">
        ${canEdit ? 'การจัดการ' : 'ดูข้อมูล'}
      </th>
    `;
    bindAssetSortEvents();
    bindSelectAllCheckbox();
  }

  function bindAssetSortEvents() {
    document.querySelectorAll('#assetsTableHead th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (assetSort.key === key) {
          assetSort.order = assetSort.order === 'asc' ? 'desc' : 'asc';
        } else {
          assetSort.key = key;
          assetSort.order = 'asc';
        }
        assetPagination.page = 1;
        updateAssetHeaderUI();
        fetchAndRenderAssetRows();
      });
    });
  }

  // --- Select All Checkbox ---
  function bindSelectAllCheckbox() {
    document.getElementById('selectAllCheckbox')?.addEventListener('change', e => {
      if (e.target.checked) {
        DB.assets.forEach(a => {
          if (!assetSelection.includes(a.id)) assetSelection.push(a.id);
        });
      } else {
        assetSelection = assetSelection.filter(id => !DB.assets.some(a => a.id === id));
      }
      updateAssetSelectionUI();
    });
  }

  bindAssetSortEvents();
  bindSelectAllCheckbox();

  // --- Bulk Action Button ---
  document.getElementById('btnBulkAction')?.addEventListener('click', () => {
    openModal(`
      <div class="modal-head" style="border-bottom:1px solid #fee2e2;background:#fff5f5;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;border-radius:50%;background:#fee2e2;` +
                     `color:#dc2626;display:flex;align-items:center;` +
                     `justify-content:center;flex-shrink:0;">
            ${ICONS.trash}
          </div>
          <h3 style="margin:0;color:#991b1b;">ยืนยันการลบหลายรายการ</h3>
        </div>
        <button class="modal-close" id="mClose">${ICONS.x}</button>
      </div>
      <div class="modal-body">
        <p style="margin:0;font-size:14px;color:var(--ink-800);">
          ยืนยันการลบทรัพย์สินจำนวน <b>${assetSelection.length}</b> รายการที่เลือกหรือไม่?
          ประวัติที่เกี่ยวข้องจะถูกลบและไม่สามารถกู้คืนได้
        </p>
      </div>
      <div class="modal-foot"
           style="background:var(--paper-alt);border-top:1px solid var(--line);">
        <button class="btn btn-outline" id="mCancel">ยกเลิก</button>
        <button class="btn btn-danger" id="mConfirmBulk">
          ${ICONS.trash} ยืนยันการลบ ${assetSelection.length} รายการ
        </button>
      </div>
    `);
    document.getElementById('mClose').onclick = closeModal;
    document.getElementById('mCancel').onclick = closeModal;
    document.getElementById('mConfirmBulk').onclick = async () => {
      const btn = document.getElementById('mConfirmBulk');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังลบ...'; }
      try {
        const count = assetSelection.length;
        const toDelete = [...assetSelection];
        DB.assets = DB.assets.filter(a => !toDelete.includes(a.id));
        await Promise.all(toDelete.map(id => API.remove('assets', id)));
        API.log('delete', 'assets', `ลบทรัพย์สินแบบกลุ่มจำนวน ${count} รายการ`);
        assetSelection = [];
        closeModal();
        toast('ลบรายการที่เลือกแล้ว');
        await fetchAndRenderAssetRows();
      } catch (e) {
        toast('เกิดข้อผิดพลาดในการลบ: ' + e.message, true);
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `${ICONS.trash} ยืนยันการลบ`;
        }
      }
    };
  });

  document.getElementById('btnAddAsset')?.addEventListener('click', () => openAssetForm());

  // Initial row render
  await fetchAndRenderAssetRows();
}

function confirmDeleteAsset(id) {
  if (!API.canEdit('assets')) {
    toast('ตำแหน่งของคุณไม่มีสิทธิ์ในการลบทรัพย์สิน', true);
    return;
  }
  const asset = getAsset(id);
  const assetName = asset?.name || id;
  openModal(`
    <div class="modal-head" style="border-bottom:1px solid #fee2e2;background:#fff5f5;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:34px;height:34px;border-radius:50%;background:#fee2e2;` +
                   `color:#dc2626;display:flex;align-items:center;` +
                   `justify-content:center;flex-shrink:0;">
          ${ICONS.trash}
        </div>
        <h3 style="margin:0;color:#991b1b;">ยืนยันการลบทรัพย์สิน</h3>
      </div>
      <button class="modal-close" id="mClose">${ICONS.x}</button>
    </div>
    <div class="modal-body">
      <p style="margin:0;font-size:14px;line-height:1.6;color:var(--ink-800);">
        ต้องการลบ <b>${escapeHtml(assetName)}</b> ออกจากทะเบียนหรือไม่? 
        ประวัติการเบิก-ยืมและการซ่อมบำรุงที่เกี่ยวข้องจะถูกลบไปด้วย และไม่สามารถกู้คืนได้
      </p>
    </div>
    <div class="modal-foot"
         style="background:var(--paper-alt);border-top:1px solid var(--line);">
      <button class="btn btn-outline" id="mCancel">ยกเลิก</button>
      <button class="btn btn-danger" id="mConfirm">
        ${ICONS.trash} ลบทรัพย์สิน
      </button>
    </div>
  `);
  document.getElementById('mClose').onclick = closeModal;
  document.getElementById('mCancel').onclick = closeModal;
  document.getElementById('mConfirm').onclick = async () => {
    const btn = document.getElementById('mConfirm');
    if (btn) { btn.disabled = true; btn.textContent = 'กำลังลบ...'; }
    try {
      DB.assets = DB.assets.filter(a => a.id !== id);
      await API.remove('assets', id);
      API.log(
        'delete', 'assets',
        `ลบทรัพย์สิน: ${assetName} (ID: ${id})`,
        id, assetName
      );
      closeModal(); 
      toast('ลบทรัพย์สินเรียบร้อยแล้ว');
      if (location.pathname.startsWith('/assets/')) {
        navigateTo('/assets');
      } else {
        if (_fetchAndRenderAssetRows) await _fetchAndRenderAssetRows();
        else navigateTo('/assets');
      }
    } catch (e) {
      toast('ลบไม่สำเร็จ: ' + e.message, true);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${ICONS.trash} ลบทรัพย์สิน`;
      }
    }
  };
}

async function openAssetForm(id) {
  if (!API.canEdit('assets')) {
    toast('ตำแหน่งของคุณไม่มีสิทธิ์ในการเพิ่มหรือแก้ไขข้อมูลทรัพย์สิน', true);
    return;
  }
  
  let asset = null;
  if (id) {
    asset = getAsset(id);
    if (!asset) {
      try {
        asset = await API.getById('assets', id);
        if (asset && !DB.assets.some(a => a.id === asset.id)) {
          DB.assets.push(asset);
        }
      } catch (e) {
        console.warn('Cannot fetch asset by id:', id, e);
      }
    }
  }

  const cats = DB.categories.map(c => `
    <option value="${c.id}" ${asset && asset.categoryId === c.id ? 'selected' : ''}>
      ${escapeHtml(c.name)}
    </option>`).join('');

  const currentHolderName = asset
    ? (asset.holderName || getEmployee(asset.holderId)?.name || '')
    : '';

  const statusOpts = Object.entries(STATUS_LABELS).map(([k, v]) => `
    <option value="${k}"
            ${asset && asset.status === k ? 'selected' : (!asset && k === 'ready' ? 'selected' : '')}>
      ${v.label}
    </option>`).join('');

  openModal(`
    <div class="modal-head">
      <h3>${asset ? 'แก้ไขข้อมูลทรัพย์สิน' : 'เพิ่มทรัพย์สินใหม่'}</h3>
      <button class="modal-close" id="mClose">${ICONS.x}</button>
    </div>
    <form id="assetForm">
    <div class="modal-body">
      <div class="form-grid">
        <div class="field">
          <label>หมายเลขเครื่อง / Serial Number (S/N) <span class="req">*</span></label>
          <input type="text" name="sn" id="assetSnInput" required
                 value="${asset ? escapeHtml(asset.id || asset.serial || '') : ''}"
                 ${asset ? 'readonly' : ''}
                 placeholder="เช่น SN-2026-001 หรือ NB-DELL-8842"
                 style="font-family:monospace;font-weight:700;` +
                       `${asset ? 'background:var(--paper-alt);' : ''}">
          <div id="assetSnFeedback" style="font-size:12px;margin-top:4px;display:none;"></div>
          <div style="font-size:11.5px;color:var(--ink-500);margin-top:3px;">
            ${asset ? 'หมายเลข SN (ID ของทรัพย์สิน) ไม่สามารถแก้ไขได้'
                    : 'ระบุหมายเลขเครื่อง/SN ซึ่งจะใช้เป็นรหัสทรัพย์สิน (ID) ในระบบ'}
          </div>
        </div>
        <div class="field">
          <label>ชื่อทรัพย์สิน <span class="req">*</span></label>
          <input type="text" name="name" required
                 value="${asset ? escapeHtml(asset.name) : ''}"
                 placeholder="เช่น คอมพิวเตอร์ตั้งโต๊ะ Dell OptiPlex">
        </div>
        <div class="field">
          <label>หมวดหมู่ <span class="req">*</span></label>
          <select name="categoryId" required>${cats}</select>
        </div>
        <div class="field">
          <label>สถานะ</label>
          <select name="status">${statusOpts}</select>
        </div>
        <div class="field">
          <label>วันที่เบิกไปใช้งาน</label>
          <input type="date" name="purchaseDate"
                 value="${asset && asset.purchaseDate ? asset.purchaseDate : ''}">
        </div>
        <div class="field">
          <label>วันที่นำกลับมาคืน</label>
          <input type="date" name="returnDate"
                 value="${asset && asset.returnDate ? asset.returnDate : ''}">
        </div>
        <div class="field">
          <label>ผู้ถือครองปัจจุบัน</label>
          <input type="text" name="holderName" list="holderNameList" autocomplete="off"
                 value="${escapeHtml(currentHolderName)}"
                 placeholder="พิมพ์ชื่อ หรือเลือกจากบุคลากร">
          <datalist id="holderNameList">
            ${DB.employees.map(e => `<option value="${escapeHtml(e.name)}"></option>`).join('')}
          </datalist>
          <div style="font-size:11.5px;color:var(--ink-500);margin-top:3px;">
            เลือกจากรายชื่อบุคลากร หรือพิมพ์ชื่อลูกค้า/ผู้ถือครองอื่นได้
          </div>
        </div>
        <div class="field">
          <label>สถานที่จัดเก็บ</label>
          <input type="text" name="location"
                 value="${asset ? escapeHtml(asset.location || '') : ''}"
                 placeholder="เช่น ห้อง IT ชั้น 2">
        </div>
        <div class="field full">
          <label>หมายเหตุ</label>
          <textarea name="note" rows="2">${asset ? escapeHtml(asset.note || '') : ''}</textarea>
        </div>
      </div>
      <div id="assetFormErr"
           style="color:var(--red-600);font-size:13px;margin-top:10px;` +
                 `padding:8px 12px;background:#fef2f2;border:1px solid #fee2e2;` +
                 `border-radius:var(--radius-s);display:none;"></div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-outline" id="mCancel">ยกเลิก</button>
      <button type="submit" class="btn btn-primary" id="btnSubmitAsset">
        ${ICONS.check}บันทึกข้อมูล
      </button>
    </div>
    </form>
  `, { wide: true });

  document.getElementById('mClose').onclick = closeModal;
  document.getElementById('mCancel').onclick = closeModal;

  // Real-time SN validation in Create mode
  const snInput = document.getElementById('assetSnInput');
  const snFeedback = document.getElementById('assetSnFeedback');
  let checkTimer = null;
  if (!asset && snInput && snFeedback) {
    snInput.addEventListener('input', () => {
      clearTimeout(checkTimer);
      const val = snInput.value.trim();
      if (!val) {
        snFeedback.style.display = 'none';
        return;
      }
      if (DB.assets.some(a => String(a.id).toLowerCase() === val.toLowerCase())) {
        snFeedback.style.display = 'block';
        snFeedback.style.color = 'var(--red-600)';
        snFeedback.innerHTML = `⚠️ หมายเลขเครื่อง/SN "${escapeHtml(val)}" มีอยู่ในระบบแล้ว`;
        return;
      }
      checkTimer = setTimeout(async () => {
        try {
          const existing = await API.getById('assets', val).catch(() => null);
          if (existing && existing.id) {
            snFeedback.style.display = 'block';
            snFeedback.style.color = 'var(--red-600)';
            snFeedback.innerHTML =
              `⚠️ หมายเลขเครื่อง/SN "${escapeHtml(val)}" มีอยู่ในระบบแล้ว ` +
              `(${escapeHtml(existing.name || '')})`;
          } else {
            snFeedback.style.display = 'block';
            snFeedback.style.color = 'var(--green-700)';
            snFeedback.innerHTML = `✓ หมายเลขเครื่อง/SN นี้สามารถใช้งานได้`;
          }
        } catch (e) {
          snFeedback.style.display = 'none';
        }
      }, 400);
    });
  }

  document.getElementById('assetForm').addEventListener('submit', async e => {
    e.preventDefault();
    const errBox = document.getElementById('assetFormErr');
    if (errBox) errBox.style.display = 'none';

    const submitBtn = document.getElementById('btnSubmitAsset');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        `<span class="spinner" style="width:14px;height:14px;display:inline-block;` +
        `vertical-align:middle;margin-right:6px;"></span> กำลังบันทึก...`;
    }

    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    const sn = (asset ? asset.id : (data.sn || '')).trim();
    if (!sn) {
      toast('กรุณาระบุหมายเลขเครื่อง / Serial Number (S/N)', true);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `${ICONS.check}บันทึกข้อมูล`;
      }
      return;
    }
    
    // Resolve holder: if the typed name matches a staff member, keep the link (holderId);
    // otherwise treat it as a free-text holder (customer / other) with holderId cleared.
    const holderNameVal = data.holderName ? data.holderName.trim() : '';
    const holderIdVal = getEmployeeByName(holderNameVal)?.id || null;

    try {
      if (asset) {
        await API.update('assets', asset.id, {
          name: data.name.trim(),
          categoryId: data.categoryId,
          status: data.status,
          purchaseDate: data.purchaseDate || '',
          returnDate: data.returnDate || '',
          location: data.location,
          serial: asset.id,
          note: data.note,
          holderName: holderNameVal,
          holderId: holderIdVal,
        });
        API.log(
          'update', 'assets',
          `แก้ไขข้อมูลทรัพย์สิน: ${data.name.trim()} (ID: ${asset.id})`,
          asset.id, data.name.trim()
        );
        toast('บันทึกการแก้ไขเรียบร้อยแล้ว');
      } else {
        // Pre-check duplicate to avoid 409
        if (DB.assets.some(a => String(a.id).toLowerCase() === sn.toLowerCase())) {
          throw new Error(`หมายเลขเครื่อง/SN '${sn}' มีอยู่ในระบบแล้ว กรุณาตรวจสอบ`);
        }
        const existing = await API.getById('assets', sn).catch(() => null);
        if (existing && existing.id) {
          throw new Error(`หมายเลขเครื่อง/SN '${sn}' มีอยู่ในระบบแล้ว กรุณาตรวจสอบ`);
        }

        const newAsset = {
          id: sn,
          serial: sn,
          name: data.name.trim(),
          categoryId: data.categoryId,
          status: data.status || 'ready',
          purchaseDate: data.purchaseDate || '',
          returnDate: data.returnDate || '',
          cost: 0,
          usefulLife: getCategory(data.categoryId)?.usefulLife || 5,
          salvagePct: 5,
          departmentId: '',
          holderId: holderIdVal,
          holderName: holderNameVal,
          location: data.location,
          vendor: '',
          note: data.note,
        };
        await API.create('assets', newAsset);
        API.log(
          'create', 'assets',
          `ลงทะเบียนทรัพย์สินใหม่: ${data.name.trim()} (ID: ${sn})`,
          sn, data.name.trim()
        );
        toast('เพิ่มทรัพย์สินใหม่เรียบร้อยแล้ว');
      }
      closeModal(); 
      if (_fetchAndRenderAssetRows) await _fetchAndRenderAssetRows();
      else navigateTo('/assets');
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `${ICONS.check}บันทึกข้อมูล`;
      }
      if (errBox) {
        errBox.style.display = 'block';
        errBox.textContent = err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
      }
      toast(err.message || 'เกิดข้อผิดพลาด', true);
    }
  });
}

/* ---------------------------- ASSET DETAIL ---------------------------- */
async function renderAssetDetail(view, id) {
  view.innerHTML = `
    <div style="padding:40px;text-align:center;color:var(--ink-500);">
      ${ICONS.assets} กำลังโหลดข้อมูล...
    </div>`;
  
  let asset;
  try {
    asset = await API.getById('assets', id);
  } catch (e) {
    navigateTo('/assets');
    return;
  }
  
  if (!asset) { navigateTo('/assets'); return; }
  setHeader('ทะเบียนทรัพย์สิน / รายละเอียด', asset.name);
  
  // Fetch assignments, maintenance, and real activity logs
  const [assignRes, maintRes, logsRes] = await Promise.all([
    API.get('assignments', { assetId: id }),
    API.get('maintenance', { assetId: id }),
    API.get('logs', { targetId: id, limit: 50 }).catch(() => ({ data: [] }))
  ]);
  
  // Temporarily store in DB cache so assetHistory function works
  DB.assignments = assignRes.data || [];
  DB.maintenance = maintRes.data || [];
  
  // We also need the asset itself in DB.assets for DBGetAssetPurchaseDate to work
  if (!DB.assets.find(a => a.id === id)) {
    DB.assets.push(asset);
  }
  
  const history = assetHistory(id);

  // Merge real activity logs
  const timelineItems = [];
  if (logsRes.data && logsRes.data.length > 0) {
    logsRes.data.forEach(l => {
      let icon = ICONS.check;
      let dotBg = 'var(--navy-800)';
      if (l.action === 'repair' || l.action === 'complete_repair') {
        icon = ICONS.wrench;
        dotBg = 'var(--amber-600)';
      } else if (l.action === 'assign' || l.action === 'return') {
        icon = ICONS.assign;
        dotBg = 'var(--blue-600)';
      } else if (l.action === 'create') {
        icon = ICONS.box;
        dotBg = 'var(--green-600)';
      } else if (l.action === 'update') {
        icon = ICONS.edit;
        dotBg = 'var(--navy-700)';
      } else if (l.action === 'delete') {
        icon = ICONS.trash;
        dotBg = 'var(--red-600)';
      }
      timelineItems.push({
        date: l.createdAt,
        type: l.action,
        text: l.details || l.action,
        meta: `โดย ${l.userName || 'ระบบ'}`,
        icon,
        dotBg
      });
    });
  }

  // Fallback / complement with computed history if not enough items
  if (timelineItems.length === 0) {
    history.forEach(h => {
      timelineItems.push({
        date: h.date,
        type: h.type,
        text: h.text,
        meta: h.meta,
        icon: h.type === 'maintenance'
          ? ICONS.wrench
          : (h.type === 'created' ? ICONS.box : ICONS.check),
        dotBg: h.type === 'maintenance'
          ? 'var(--amber-600)'
          : (h.type === 'created' ? 'var(--green-600)' : 'var(--navy-800)')
      });
    });
  }

  view.innerHTML = `
    <a href="/assets"
       style="display:inline-flex;align-items:center;gap:6px;` +
             `color:var(--ink-900);font-size:13px;margin-bottom:14px;text-decoration:none;">
      ${ICONS.arrowLeft} กลับไปยังทะเบียนทรัพย์สิน
    </a>
    <div class="card" style="margin-bottom:16px;">
      <div class="card-pad">
        <div class="detail-head">
          <div>
            <div class="detail-title">${escapeHtml(asset.name)}</div>
            ${statusTag(asset.status)}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${API.canEdit('assets') ? `
              <button class="btn btn-outline btn-sm" id="btnEditAsset">
                ${ICONS.edit}แก้ไข
              </button>` : ''}
            ${API.canEdit('assets') ? `
              <button class="btn btn-outline btn-sm danger" id="btnDeleteAsset">
                ${ICONS.trash}ลบ
              </button>` : ''}
            ${API.canEdit('assignments') ? `
              <button class="btn btn-outline btn-sm" id="btnAssignAsset">
                ${ICONS.assign}มอบหมาย/คืน
              </button>` : ''}
            <button class="btn btn-outline btn-sm" id="btnMaintainAsset">
              ${ICONS.wrench}แจ้งซ่อมบำรุง
            </button>
          </div>
        </div>
        <div class="kv-grid">
          <div class="kv-item">
            <div class="k">หมวดหมู่</div>
            <div class="v">${escapeHtml(getCategory(asset.categoryId)?.name || '-')}</div>
          </div>
          <div class="kv-item">
            <div class="k">แผนก</div>
            <div class="v">${escapeHtml(getDepartment(asset.departmentId)?.name || '-')}</div>
          </div>
          <div class="kv-item">
            <div class="k">ผู้ถือครอง</div>
            <div class="v">${escapeHtml(holderDisplayName(asset) || 'ไม่มีผู้ถือครอง')}</div>
          </div>
          <div class="kv-item">
            <div class="k">วันที่เบิกไปใช้งาน</div>
            <div class="v">${fmtDate(asset.purchaseDate)}</div>
          </div>
          <div class="kv-item">
            <div class="k">วันที่นำกลับมาคืน</div>
            <div class="v">${asset.returnDate ? fmtDate(asset.returnDate) : '-'}</div>
          </div>
          <div class="kv-item">
            <div class="k">สถานที่จัดเก็บ</div>
            <div class="v">${escapeHtml(asset.location || '-')}</div>
          </div>
          <div class="kv-item">
            <div class="k">หมายเลข SN (ID ทรัพย์สิน)</div>
            <div class="v"
                 style="font-family:monospace;font-weight:700;color:var(--navy-800);">
              ${escapeHtml(asset.id || asset.serial || '-')}
            </div>
          </div>
        </div>
        ${asset.note ? `
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line);">
            <div class="kv-item">
              <div class="k">หมายเหตุ</div>
              <div class="v" style="font-weight:400;">${escapeHtml(asset.note)}</div>
            </div>
          </div>` : ''}
      </div>
    </div>

    <div class="card">
      <div class="card-head"
           style="display:flex;justify-content:space-between;align-items:center;">
        <h3>ประวัติทรัพย์สิน</h3>
        <span style="font-size:12px;color:var(--ink-500);">ประวัติการดำเนินการและกิจกรรม</span>
      </div>
      <div class="card-pad">
        <div class="timeline">
          ${timelineItems.map(h => `
            <div class="tl-item">
              <div class="tl-dot"
                   style="background:${h.dotBg};color:#fff;` +
                         `display:flex;align-items:center;justify-content:center;">
                ${h.icon}
              </div>
              <div class="tl-content">
                <div class="tl-title"
                     style="font-weight:600;color:var(--ink-900);">
                  ${escapeHtml(h.text)}
                </div>
                <div class="tl-meta"
                     style="font-size:12px;color:var(--ink-500);margin-top:2px;">
                  🕒 ${fmtDateTime(h.date)}${h.meta ? ' · ' + escapeHtml(h.meta) : ''}
                </div>
              </div>
            </div>`).join('') || `
            <div class="empty-state">
              <div class="et">ยังไม่มีประวัติการทำรายการ</div>
            </div>`}
        </div>
      </div>
    </div>
  `;

  document.getElementById('btnEditAsset')?.addEventListener('click', () => {
    openAssetForm(asset.id);
  });
  document.getElementById('btnDeleteAsset')?.addEventListener('click', () => {
    confirmDeleteAsset(asset.id);
  });
  document.getElementById('btnAssignAsset')?.addEventListener('click', () => {
    openAssignmentForm(asset.id);
  });
  document.getElementById('btnMaintainAsset')?.addEventListener('click', () => {
    openMaintenanceForm(asset.id);
  });
}
