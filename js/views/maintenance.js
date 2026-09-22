/* ---------------------------- MAINTENANCE VIEW ---------------------------- */
let maintenancePagination = { page: 1, limit: 10 };
let maintenanceSort = { key: 'date', order: 'desc' };
let maintenanceSelection = [];

async function renderMaintenance(view) {
  setHeader('ซ่อมบำรุง', 'บันทึกการซ่อมบำรุงทรัพย์สิน');

  view.innerHTML = `
    <div class="grid grid-2" style="margin-bottom:16px;">
      <div class="card kpi-card">
        <div class="kpi-bar" style="background:var(--amber-700)"></div>
        <div class="kpi-label">กำลังซ่อมบำรุง</div>
        <div class="kpi-value" id="maintInProgressVal">0</div>
      </div>
      <div class="card kpi-card">
        <div class="kpi-bar" style="background:var(--navy-800)"></div>
        <div class="kpi-label">บันทึกทั้งหมด</div>
        <div class="kpi-value" id="maintTotalVal">0</div>
      </div>
    </div>
    <div class="card">
      <div class="table-toolbar" style="justify-content:space-between;">
        <div style="display:flex;gap:10px;align-items:center;">
          <div class="hint"
               id="maintTotalHint"
               style="font-size:12.5px;color:var(--ink-500)">
            กำลังโหลดข้อมูล...
          </div>
        </div>
        <div class="toolbar-right">
          ${API.canEdit('maintenance') ? `
            <button class="btn btn-outline"
                    id="btnBulkMaintAction"
                    style="${maintenanceSelection.length > 0 ? '' : 'display:none;'}">
              จัดการที่เลือก (<span id="maintBulkCount">${maintenanceSelection.length}</span>)
            </button>
            <button class="btn btn-primary" id="btnNewMaint">
              ${ICONS.plus}แจ้งซ่อมบำรุง
            </button>
          ` : ''}
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr id="maintTableHead">
              ${API.canEdit('maintenance') ? `
                <th style="width:40px;text-align:center;">
                  <input type="checkbox" id="selectAllMaintCheckbox">
                </th>
              ` : ''}
              ${sortHeaderHtml('ทรัพย์สิน', 'asset', maintenanceSort.key, maintenanceSort.order)}
              ${sortHeaderHtml('ประเภท', 'type', maintenanceSort.key, maintenanceSort.order)}
              ${sortHeaderHtml('วันที่แจ้ง', 'date', maintenanceSort.key, maintenanceSort.order)}
              ${sortHeaderHtml('ผู้รับซ่อม', 'vendor', maintenanceSort.key, maintenanceSort.order)}
              ${sortHeaderHtml('สถานะ', 'status', maintenanceSort.key, maintenanceSort.order)}
              ${API.canEdit('maintenance') ? '<th style="text-align:right;">การจัดการ</th>' : ''}
            </tr>
          </thead>
          <tbody id="maintTableBody">
            <tr>
              <td colspan="${API.canEdit('maintenance') ? 7 : 5}">
                <div style="padding:30px;text-align:center;color:var(--ink-500);">
                  ${ICONS.wrench} กำลังโหลดข้อมูล...
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="table-toolbar"
           id="maintPaginationBar"
           style="border-top:1px solid var(--line);border-bottom:none;justify-content:space-between;">
      </div>
    </div>
  `;

  function updateMaintSelectionUI() {
    view.querySelectorAll('.row-checkbox-maint').forEach(cb => {
      cb.checked = maintenanceSelection.includes(cb.value);
    });
    const selectAllCb = document.getElementById('selectAllMaintCheckbox');
    if (selectAllCb) {
      const currentRows = DB.maintenance || [];
      selectAllCb.checked =
        currentRows.length > 0 &&
        currentRows.every(m => maintenanceSelection.includes(m.id));
    }
    const btnBulk = document.getElementById('btnBulkMaintAction');
    const countSpan = document.getElementById('maintBulkCount');
    if (btnBulk && countSpan) {
      countSpan.textContent = maintenanceSelection.length;
      btnBulk.style.display =
        API.canEdit('maintenance') && maintenanceSelection.length > 0
          ? 'inline-flex'
          : 'none';
    }
  }

  async function fetchAndRenderMaintRows() {
    const tbody = document.getElementById('maintTableBody');
    const pbar = document.getElementById('maintPaginationBar');
    const hint = document.getElementById('maintTotalHint');
    const inProgEl = document.getElementById('maintInProgressVal');
    const totalEl = document.getElementById('maintTotalVal');
    if (!tbody || !pbar) return;

    tbody.style.opacity = '0.5';

    let res, dashData;
    try {
      res = await API.get('maintenance', {
        page: maintenancePagination.page,
        limit: maintenancePagination.limit
      });
      dashData = await API.get('dashboard');
    } catch (e) {
      tbody.style.opacity = '1';
      tbody.innerHTML = `
        <tr>
          <td colspan="${API.canEdit('maintenance') ? 7 : 5}">
            <div style="padding:20px;text-align:center;color:var(--red-700);">
              เกิดข้อผิดพลาด: ${escapeHtml(e.message)}
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.style.opacity = '1';
    const rows = res.data || [];
    const total = res.total || 0;
    const inProgress = dashData && dashData.dueMaintenance ? dashData.dueMaintenance.length : 0;

    if (inProgEl) inProgEl.textContent = inProgress;
    if (totalEl) totalEl.textContent = total;
    if (hint) hint.textContent = `ทั้งหมด ${total} รายการ`;

    // Cache missing assets
    const missingAssetIds = [
      ...new Set(
        rows.map(m => m.assetId).filter(id => !DB.assets.find(ast => ast.id === id))
      )
    ];
    if (missingAssetIds.length > 0) {
      const fetchedAssets = await Promise.all(
        missingAssetIds.map(id => API.getById('assets', id).catch(() => null))
      );
      fetchedAssets.filter(Boolean).forEach(ast => DB.assets.push(ast));
    }

    DB.maintenance = rows;

    const mult = maintenanceSort.order === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      if (maintenanceSort.key === 'asset') {
        const nA = getAsset(a.assetId)?.name || a.assetId || '';
        const nB = getAsset(b.assetId)?.name || b.assetId || '';
        return nA.localeCompare(nB, 'th', { numeric: true }) * mult;
      }
      if (maintenanceSort.key === 'type') {
        return (a.type || '').localeCompare(b.type || '', 'th') * mult;
      }
      if (maintenanceSort.key === 'date') {
        return (new Date(a.date || 0) - new Date(b.date || 0)) * mult;
      }
      if (maintenanceSort.key === 'vendor') {
        return (a.vendor || '').localeCompare(b.vendor || '', 'th') * mult;
      }
      if (maintenanceSort.key === 'status') {
        return (a.status || '').localeCompare(b.status || '', 'th') * mult;
      }
      return 0;
    });

    const totalPages = Math.ceil(total / maintenancePagination.limit) || 1;
    if (maintenancePagination.page > totalPages) maintenancePagination.page = totalPages;
    const startIdx = (maintenancePagination.page - 1) * maintenancePagination.limit;

    const canEdit = API.canEdit('maintenance');
    tbody.innerHTML = rows.map(m => {
      const asset = getAsset(m.assetId);
      const assetLink = asset ? `
        <a href="/assets/${encodeURIComponent(asset.id)}"
           style="color:var(--ink-900);text-decoration:none;font-weight:600;">
          ${escapeHtml(asset.name)}
        </a>
      ` : '<span class="cell-sub">ทรัพย์สินถูกลบแล้ว</span>';

      const statusBadge = m.status === 'in_progress'
        ? '<span class="tag tag-maintenance"><span class="tag-dot"></span>กำลังดำเนินการ</span>'
        : '<span class="tag tag-active"><span class="tag-dot"></span>เสร็จสิ้น</span>';

      return `
        <tr>
          ${canEdit ? `
            <td style="text-align:center;">
              <input type="checkbox" class="row-checkbox-maint" value="${m.id}">
            </td>
          ` : ''}
          <td>${assetLink}</td>
          <td>
            ${escapeHtml(m.type)}
            <div class="cell-sub">${escapeHtml(m.description || '')}</div>
          </td>
          <td>${fmtDate(m.date)}</td>
          <td>${escapeHtml(m.vendor || '-')}</td>
          <td>${statusBadge}</td>
          ${canEdit ? `
          <td style="text-align:right;">
            <div class="row-actions" style="justify-content:flex-end;">
              ${m.status === 'in_progress' ? `
                <button class="btn btn-outline btn-sm" data-complete="${m.id}">
                  แจ้งเสร็จสิ้น
                </button>
              ` : ''}
              <button class="icon-btn"
                      title="แก้ไขบันทึกซ่อมบำรุง"
                      data-editmaint="${m.id}">
                ${ICONS.edit}
              </button>
              <button class="icon-btn danger"
                      title="ลบบันทึกซ่อมบำรุง"
                      data-delmaint="${m.id}">
                ${ICONS.trash}
              </button>
            </div>
          </td>
          ` : ''}
        </tr>
      `;
    }).join('') || `
      <tr>
        <td colspan="${canEdit ? 7 : 5}">
          <div class="empty-state">
            ${ICONS.wrench}
            <div class="et">ยังไม่มีบันทึกการซ่อมบำรุง</div>
          </div>
        </td>
      </tr>
    `;

    const countStart = total === 0 ? 0 : startIdx + 1;
    const countEnd = Math.min(startIdx + maintenancePagination.limit, total);

    pbar.innerHTML = `
      <div style="font-size:12.5px;color:var(--ink-500);">
        แสดง ${countStart} ถึง ${countEnd} จาก ${total} รายการ
      </div>
      <div style="display:flex;gap:4px;align-items:center;">
        <button class="btn btn-outline btn-sm"
                id="btnPrevPageMaint"
                ${maintenancePagination.page === 1 ? 'disabled' : ''}>
          ก่อนหน้า
        </button>
        <div style="padding:6px 10px;font-size:12.5px;">
          หน้า ${maintenancePagination.page} / ${totalPages}
        </div>
        <button class="btn btn-outline btn-sm"
                id="btnNextPageMaint"
                ${maintenancePagination.page >= totalPages ? 'disabled' : ''}>
          ถัดไป
        </button>
      </div>
    `;

    document.getElementById('btnPrevPageMaint')?.addEventListener('click', () => {
      maintenancePagination.page--;
      fetchAndRenderMaintRows();
    });
    document.getElementById('btnNextPageMaint')?.addEventListener('click', () => {
      maintenancePagination.page++;
      fetchAndRenderMaintRows();
    });

    tbody.querySelectorAll('[data-complete]').forEach(b => {
      b.addEventListener('click', () => completeMaintenance(b.dataset.complete));
    });
    tbody.querySelectorAll('[data-editmaint]').forEach(b => {
      b.addEventListener('click', () => openEditMaintenanceModal(b.dataset.editmaint));
    });
    tbody.querySelectorAll('[data-delmaint]').forEach(b => {
      b.addEventListener('click', () => deleteMaintenance(b.dataset.delmaint));
    });

    tbody.querySelectorAll('.row-checkbox-maint').forEach(cb => {
      cb.addEventListener('change', e => {
        if (e.target.checked) {
          if (!maintenanceSelection.includes(e.target.value)) {
            maintenanceSelection.push(e.target.value);
          }
        } else {
          maintenanceSelection = maintenanceSelection.filter(id => id !== e.target.value);
        }
        updateMaintSelectionUI();
      });
    });

    updateMaintSelectionUI();
  }

  function updateMaintHeaderUI() {
    const headTr = document.getElementById('maintTableHead');
    if (!headTr) return;
    const canEdit = API.canEdit('maintenance');
    headTr.innerHTML = `
      ${canEdit ? `
        <th style="width:40px;text-align:center;">
          <input type="checkbox" id="selectAllMaintCheckbox">
        </th>
      ` : ''}
      ${sortHeaderHtml('ทรัพย์สิน', 'asset', maintenanceSort.key, maintenanceSort.order)}
      ${sortHeaderHtml('ประเภท', 'type', maintenanceSort.key, maintenanceSort.order)}
      ${sortHeaderHtml('วันที่แจ้ง', 'date', maintenanceSort.key, maintenanceSort.order)}
      ${sortHeaderHtml('ผู้รับซ่อม', 'vendor', maintenanceSort.key, maintenanceSort.order)}
      ${sortHeaderHtml('สถานะ', 'status', maintenanceSort.key, maintenanceSort.order)}
      ${canEdit ? '<th style="text-align:right;">การจัดการ</th>' : ''}
    `;
    bindMaintSortEvents();
    bindSelectAllMaintCheckbox();
  }

  function bindMaintSortEvents() {
    document.querySelectorAll('#maintTableHead th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (maintenanceSort.key === key) {
          maintenanceSort.order = maintenanceSort.order === 'asc' ? 'desc' : 'asc';
        } else {
          maintenanceSort.key = key;
          maintenanceSort.order = 'asc';
        }
        maintenancePagination.page = 1;
        updateMaintHeaderUI();
        fetchAndRenderMaintRows();
      });
    });
  }

  function bindSelectAllMaintCheckbox() {
    document.getElementById('selectAllMaintCheckbox')?.addEventListener('change', e => {
      if (e.target.checked) {
        DB.maintenance.forEach(m => {
          if (!maintenanceSelection.includes(m.id)) maintenanceSelection.push(m.id);
        });
      } else {
        maintenanceSelection = maintenanceSelection.filter(
          id => !DB.maintenance.some(m => m.id === id)
        );
      }
      updateMaintSelectionUI();
    });
  }

  bindMaintSortEvents();
  bindSelectAllMaintCheckbox();

  document.getElementById('btnBulkMaintAction')?.addEventListener('click', () => {
    if (!API.canEdit('maintenance')) {
      toast('ตำแหน่งของคุณไม่มีสิทธิ์ในการลบข้อมูลได้', true);
      return;
    }
    openModal(`
      <div class="modal-head" style="border-bottom:1px solid #fee2e2;background:#fff5f5;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;border-radius:50%;background:#fee2e2;
                      color:#dc2626;display:flex;align-items:center;
                      justify-content:center;flex-shrink:0;">
            ${ICONS.trash}
          </div>
          <h3 style="margin:0;color:#991b1b;">ยืนยันการลบหลายรายการ</h3>
        </div>
        <button class="modal-close" id="mClose">${ICONS.x}</button>
      </div>
      <div class="modal-body">
        <p style="margin:0;font-size:14px;color:var(--ink-800);">
          ยืนยันการลบบันทึกซ่อมบำรุงจำนวน <b>${maintenanceSelection.length}</b> รายการที่เลือกหรือไม่?
        </p>
      </div>
      <div class="modal-foot" style="background:var(--paper-alt);border-top:1px solid var(--line);">
        <button class="btn btn-outline" id="mCancel">ยกเลิก</button>
        <button class="btn btn-danger" id="mConfirmBulk">
          ${ICONS.trash} ยืนยันการลบ ${maintenanceSelection.length} รายการ
        </button>
      </div>
    `);
    document.getElementById('mClose').onclick = closeModal;
    document.getElementById('mCancel').onclick = closeModal;
    document.getElementById('mConfirmBulk').onclick = async () => {
      const btn = document.getElementById('mConfirmBulk');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'กำลังลบ...';
      }
      try {
        const count = maintenanceSelection.length;
        await Promise.all(maintenanceSelection.map(id => API.remove('maintenance', id)));
        API.log('delete', 'maintenance', `ลบบันทึกซ่อมบำรุงแบบกลุ่มจำนวน ${count} รายการ`);
        maintenanceSelection = [];
        closeModal();
        toast('ลบรายการที่เลือกแล้ว');
        await fetchAndRenderMaintRows();
      } catch (e) {
        toast('เกิดข้อผิดพลาดในการลบ: ' + e.message, true);
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `${ICONS.trash} ยืนยันการลบ`;
        }
      }
    };
  });

  document.getElementById('btnNewMaint')?.addEventListener('click', () => openMaintenanceForm());

  await fetchAndRenderMaintRows();
}

function completeMaintenance(id) {
  const m = DB.maintenance.find(x => x.id === id);
  if (!m) return;

  openModal(`
    <div class="modal-head">
      <h3>ยืนยันการแจ้งซ่อมเสร็จสิ้น</h3>
      <button class="modal-close" id="mClose">${ICONS.x}</button>
    </div>
    <div class="modal-body">
      <p>ต้องการบันทึกว่าการซ่อมบำรุงนี้เสร็จสิ้นแล้วใช่หรือไม่?</p>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" id="mCancel">ยกเลิก</button>
      <button class="btn btn-primary" id="mConfirm">${ICONS.check}ยืนยัน</button>
    </div>
  `);
  document.getElementById('mClose').onclick = closeModal;
  document.getElementById('mCancel').onclick = closeModal;
  document.getElementById('mConfirm').onclick = async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      await API.update('maintenance', id, {
        status: 'done',
        completedDate: todayStr
      });
      const asset = getAsset(m.assetId);
      if (asset && asset.status === 'repair') {
        const stillOpen = DB.maintenance.some(
          x => x.assetId === asset.id && x.status === 'in_progress' && x.id !== m.id
        );
        if (!stillOpen) {
          await API.update('assets', asset.id, { status: 'ready' });
        }
      }
      closeModal();
      toast('บันทึกการซ่อมบำรุงเสร็จสิ้นแล้ว');
      rerender();
    } catch (err) {
      toast('เกิดข้อผิดพลาด: ' + err.message, true);
    }
  };
}

async function openMaintenanceForm(presetAssetId) {
  if (DB.assets.length < 50) {
    const res = await API.get('assets', { limit: 1000 }).catch(() => null);
    if (res && res.data) DB.assets = res.data;
  }
  const mntAssetOpts = DB.assets.map(a => ({ value: a.id, label: `${a.name} · ${a.id || a.serial}` }));
  openModal(`
    <div class="modal-head">
      <h3>แจ้งซ่อมบำรุงทรัพย์สิน</h3>
      <button class="modal-close" id="mClose">${ICONS.x}</button>
    </div>
    <form id="maintForm">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field full">
            <label>ทรัพย์สิน <span class="req">*</span></label>
            ${searchableSelectHtml({ name: 'assetId', id: 'mntAsset', options: mntAssetOpts, value: presetAssetId || '', required: true, placeholder: 'พิมพ์ชื่อหรือ SN เพื่อค้นหา' })}
          </div>
          <div class="field">
            <label>ประเภทงาน <span class="req">*</span></label>
            <select name="type" required>
              <option>ตรวจเช็คตามระยะ</option>
              <option>ซ่อมบำรุงตามระยะ</option>
              <option>ซ่อมแซม</option>
              <option>อื่นๆ</option>
            </select>
          </div>
          <div class="field">
            <label>วันที่แจ้ง <span class="req">*</span></label>
            <input type="date"
                   name="date"
                   required
                   value="${new Date().toISOString().slice(0, 10)}">
          </div>
          <div class="field">
            <label>ผู้รับซ่อม / ร้าน</label>
            <input type="text" name="vendor">
          </div>
          <div class="field full">
            <label>รายละเอียดอาการ/งานที่ทำ</label>
            <textarea name="description" rows="2"></textarea>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-outline" id="mCancel">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">${ICONS.check}บันทึก</button>
      </div>
    </form>
  `);
  document.getElementById('mClose').onclick = closeModal;
  document.getElementById('mCancel').onclick = closeModal;
  wireSearchableSelect('mntAsset', mntAssetOpts);
  document.getElementById('maintForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());

    try {
      await API.create('maintenance', {
        id: uid('mnt'),
        assetId: fd.assetId,
        date: fd.date,
        type: fd.type,
        vendor: fd.vendor,
        description: fd.description,
        status: 'in_progress',
        completedDate: null
      });
      const asset = getAsset(fd.assetId);
      if (asset) {
        await API.update('assets', fd.assetId, { status: 'repair' });
      }
      closeModal();
      toast('แจ้งซ่อมบำรุงเรียบร้อยแล้ว');
      rerender();
    } catch (err) {
      toast('เกิดข้อผิดพลาด: ' + err.message, true);
    }
  });
}

async function openEditMaintenanceModal(maintId) {
  if (DB.assets.length < 50) {
    const res = await API.get('assets', { limit: 1000 }).catch(() => null);
    if (res && res.data) DB.assets = res.data;
  }
  const m = DB.maintenance.find(x => x.id === maintId);
  if (!m) return;

  const mntAssetOpts = DB.assets.map(a => ({ value: a.id, label: `${a.name} · ${a.id || a.serial}` }));

  openModal(`
    <div class="modal-head">
      <h3>แก้ไขบันทึกซ่อมบำรุง</h3>
      <button class="modal-close" id="mClose">${ICONS.x}</button>
    </div>
    <form id="editMaintForm">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field full">
            <label>ทรัพย์สิน <span class="req">*</span></label>
            ${searchableSelectHtml({ name: 'assetId', id: 'edMntAsset', options: mntAssetOpts, value: m.assetId, required: true, placeholder: 'พิมพ์ชื่อหรือ SN เพื่อค้นหา' })}
          </div>
          <div class="field">
            <label>ประเภทงาน <span class="req">*</span></label>
            <select name="type" required>
              <option value="ตรวจเช็คตามระยะ" ${m.type === 'ตรวจเช็คตามระยะ' ? 'selected' : ''}>
                ตรวจเช็คตามระยะ
              </option>
              <option value="ซ่อมบำรุงตามระยะ" ${m.type === 'ซ่อมบำรุงตามระยะ' ? 'selected' : ''}>
                ซ่อมบำรุงตามระยะ
              </option>
              <option value="ซ่อมแซม" ${m.type === 'ซ่อมแซม' ? 'selected' : ''}>
                ซ่อมแซม
              </option>
              <option value="อื่นๆ" ${m.type === 'อื่นๆ' ? 'selected' : ''}>
                อื่นๆ
              </option>
            </select>
          </div>
          <div class="field">
            <label>วันที่แจ้ง <span class="req">*</span></label>
            <input type="date"
                   name="date"
                   required
                   value="${m.date ? m.date.slice(0, 10) : ''}">
          </div>
          <div class="field">
            <label>ผู้รับซ่อม / ร้าน</label>
            <input type="text"
                   name="vendor"
                   value="${escapeHtml(m.vendor || '')}">
          </div>
          <div class="field">
            <label>สถานะ</label>
            <select name="status">
              <option value="in_progress" ${m.status === 'in_progress' ? 'selected' : ''}>
                กำลังดำเนินการ
              </option>
              <option value="done" ${m.status === 'done' ? 'selected' : ''}>
                เสร็จสิ้น
              </option>
            </select>
          </div>
          <div class="field">
            <label>วันที่เสร็จสิ้น</label>
            <input type="date"
                   name="completedDate"
                   value="${m.completedDate ? m.completedDate.slice(0, 10) : ''}">
          </div>
          <div class="field">
            <label>ค่าใช้จ่าย (บาท)</label>
            <input type="number" step="0.01" name="cost" value="${m.cost || ''}">
          </div>
          <div class="field full">
            <label>รายละเอียดอาการ/งานที่ทำ</label>
            <textarea name="description" rows="2">${escapeHtml(m.description || '')}</textarea>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-outline" id="mCancel">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">${ICONS.check}บันทึกการแก้ไข</button>
      </div>
    </form>
  `);
  document.getElementById('mClose').onclick = closeModal;
  document.getElementById('mCancel').onclick = closeModal;
  wireSearchableSelect('edMntAsset', mntAssetOpts);

  document.getElementById('editMaintForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const todayStr = new Date().toISOString().slice(0, 10);
    const payload = {
      assetId: fd.assetId,
      type: fd.type,
      date: fd.date,
      vendor: fd.vendor ? fd.vendor.trim() : '',
      status: fd.status,
      completedDate: fd.status === 'done' ? (fd.completedDate || todayStr) : null,
      cost: fd.cost ? parseFloat(fd.cost) : null,
      description: fd.description ? fd.description.trim() : ''
    };

    try {
      await API.update('maintenance', maintId, payload);
      Object.assign(m, payload);

      const asset = getAsset(fd.assetId);
      if (asset) {
        if (payload.status === 'done') {
          const stillOpen = DB.maintenance.some(
            x => x.assetId === asset.id && x.status === 'in_progress' && x.id !== maintId
          );
          if (!stillOpen && asset.status === 'repair') {
            await API.update('assets', asset.id, { status: 'ready' });
            asset.status = 'ready';
          }
        } else if (payload.status === 'in_progress') {
          await API.update('assets', asset.id, { status: 'repair' });
          asset.status = 'repair';
        }
      }

      closeModal();
      toast('แก้ไขบันทึกซ่อมบำรุงเรียบร้อยแล้ว');
      rerender();
    } catch (err) {
      toast('เกิดข้อผิดพลาด: ' + err.message, true);
    }
  });
}

function deleteMaintenance(maintId) {
  if (!API.canEdit('maintenance')) {
    toast('ตำแหน่งของคุณไม่มีสิทธิ์ในการลบข้อมูลได้', true);
    return;
  }
  const m = DB.maintenance.find(x => x.id === maintId);
  const asset = m ? getAsset(m.assetId) : null;
  const assetName = asset?.name || m?.assetId || '';
  const maintType = m?.type || '';

  openModal(`
    <div class="modal-head" style="border-bottom:1px solid #fee2e2;background:#fff5f5;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:34px;height:34px;border-radius:50%;background:#fee2e2;
                    color:#dc2626;display:flex;align-items:center;
                    justify-content:center;flex-shrink:0;">
          ${ICONS.trash}
        </div>
        <h3 style="margin:0;color:#991b1b;">ยืนยันการลบบันทึกซ่อมบำรุง</h3>
      </div>
      <button class="modal-close" id="mClose">${ICONS.x}</button>
    </div>
    <div class="modal-body">
      <p style="margin:0;font-size:14px;color:var(--ink-800);">
        คุณต้องการลบบันทึกซ่อมบำรุงของทรัพย์สิน <b>${escapeHtml(assetName)}</b>
        (${escapeHtml(maintType)}) ใช่หรือไม่? การลบไม่สามารถกู้คืนได้
      </p>
    </div>
    <div class="modal-foot" style="background:var(--paper-alt);border-top:1px solid var(--line);">
      <button class="btn btn-outline" id="mCancel">ยกเลิก</button>
      <button class="btn btn-danger" id="mConfirmDelMaint">
        ${ICONS.trash} ยืนยันการลบ
      </button>
    </div>
  `);
  document.getElementById('mClose').onclick = closeModal;
  document.getElementById('mCancel').onclick = closeModal;
  document.getElementById('mConfirmDelMaint').onclick = async () => {
    const btn = document.getElementById('mConfirmDelMaint');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'กำลังลบ...';
    }
    try {
      await API.remove('maintenance', maintId);
      DB.maintenance = DB.maintenance.filter(x => x.id !== maintId);
      API.log(
        'delete',
        'maintenance',
        `ลบบันทึกซ่อมบำรุง: ${assetName} (${maintType})`,
        m?.assetId,
        assetName
      );

      // Check if asset should revert from repair
      if (m && m.status === 'in_progress') {
        const asset = getAsset(m.assetId);
        if (asset && asset.status === 'repair') {
          const stillOpen = DB.maintenance.some(
            x => x.assetId === asset.id && x.status === 'in_progress' && x.id !== maintId
          );
          if (!stillOpen) {
            await API.update('assets', asset.id, { status: 'ready' });
            asset.status = 'ready';
          }
        }
      }

      closeModal();
      toast('ลบบันทึกซ่อมบำรุงเรียบร้อยแล้ว');
      rerender();
    } catch (err) {
      toast('เกิดข้อผิดพลาดในการลบ: ' + err.message, true);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${ICONS.trash} ยืนยันการลบ`;
      }
    }
  };
}
