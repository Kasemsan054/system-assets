/* ---------------------------- ASSIGNMENTS VIEW ----------------------------
 * "Current holdings" are derived directly from the asset registry: every asset that
 * has a holder (a staff member via holderId, OR a free-text customer/external holder
 * via holderName) is shown here — even when it was never assigned through this page.
 * Returned items come from the Assignment history records.
 */
let assignmentPagination = { page: 1, limit: 10 };
let assignFilter = 'all'; // 'all' | 'active' | 'returned'
let assignSort = { key: 'dateOut', order: 'desc' };
let _holdActive = [];     // current holdings (from assets)
let _holdReturned = [];   // returned assignment history

async function renderAssignments(view) {
  setHeader('การเบิก–ยืม/มอบหมาย', 'ทรัพย์สินที่ถือครองอยู่และประวัติการมอบหมาย');
  const canEdit = API.canEdit('assignments');

  view.innerHTML = `
    <div class="card">
      <div class="table-toolbar" style="justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
          <div class="seg-filter" id="assignFilterTabs" role="tablist">
            <button class="seg-btn ${assignFilter === 'all' ? 'active' : ''}" data-afilter="all">ทั้งหมด</button>
            <button class="seg-btn ${assignFilter === 'active' ? 'active' : ''}" data-afilter="active">กำลังถือครอง</button>
            <button class="seg-btn ${assignFilter === 'returned' ? 'active' : ''}" data-afilter="returned">คืนแล้ว</button>
          </div>
          <div class="hint" id="assignTotalHint" style="font-size:12.5px;color:var(--ink-500)">กำลังโหลด...</div>
        </div>
        <div class="toolbar-right">
          ${canEdit ? `
            <button class="btn btn-primary" id="btnNewAssign">
              ${ICONS.plus}มอบหมายทรัพย์สิน
            </button>
          ` : ''}
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr id="assignTableHead">
              ${sortHeaderHtml('ทรัพย์สิน', 'asset', assignSort.key, assignSort.order)}
              ${sortHeaderHtml('ผู้รับมอบ', 'holder', assignSort.key, assignSort.order)}
              ${sortHeaderHtml('แผนก', 'department', assignSort.key, assignSort.order)}
              ${sortHeaderHtml('วันที่มอบหมาย', 'dateOut', assignSort.key, assignSort.order)}
              ${sortHeaderHtml('วันที่คืน', 'dateReturn', assignSort.key, assignSort.order)}
              ${sortHeaderHtml('สถานะ', 'status', assignSort.key, assignSort.order)}
              ${canEdit ? '<th style="text-align:right;">การจัดการ</th>' : ''}
            </tr>
          </thead>
          <tbody id="assignTableBody">
            <tr>
              <td colspan="${canEdit ? 7 : 6}">
                <div style="padding:30px;text-align:center;color:var(--ink-500);">
                  ${ICONS.assets} กำลังโหลดข้อมูล...
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="table-toolbar" id="assignPaginationBar"
           style="border-top:1px solid var(--line);border-bottom:none;justify-content:space-between;">
      </div>
    </div>
  `;

  // ── Load current holdings (from assets) + assignment history ────────────────
  async function loadHoldings() {
    const [assetsRes, asgRes] = await Promise.all([
      API.get('assets', { held: 'true', limit: 1000 }).catch(() => ({ data: [] })),
      API.get('assignments', { limit: 1000 }).catch(() => ({ data: [] })),
    ]);
    const assets = assetsRes.data || [];
    const asg = asgRes.data || [];

    // Keep caches warm so getAsset()/helpers resolve.
    assets.forEach(a => { if (!DB.assets.find(x => x.id === a.id)) DB.assets.push(a); });
    DB.assignments = asg;

    // The open (not-yet-returned) assignment record per asset, if any — used to link
    // edit/return actions back to a real record.
    const openByAsset = {};
    asg.forEach(a => { if (!a.dateReturn && !openByAsset[a.assetId]) openByAsset[a.assetId] = a; });

    _holdActive = assets.map(asset => {
      const rec = openByAsset[asset.id];
      const emp = getEmployee(asset.holderId);
      const holderName = (asset.holderName && asset.holderName.trim()) || (rec?.holderName && rec.holderName.trim()) || emp?.name || '-';
      const external = !asset.holderId && !!((asset.holderName && asset.holderName.trim()) || (rec?.holderName && rec.holderName.trim()));
      return {
        assetId: asset.id,
        asset,
        holderName,
        external,
        departmentId: (rec && rec.departmentId) || asset.departmentId || null,
        dateOut: (rec && rec.dateOut) || asset.purchaseDate || null,
        dateReturn: null,
        assignmentId: rec ? rec.id : null,
      };
    });

    // Also include any active assignment whose asset wasn't flagged as held in Assets table
    const activeAssetIds = new Set(_holdActive.map(h => h.assetId));
    asg.forEach(a => {
      if (!a.dateReturn && !activeAssetIds.has(a.assetId)) {
        const asset = getAsset(a.assetId);
        const emp = getEmployee(a.employeeId);
        const holderName = (a.holderName && a.holderName.trim()) || emp?.name || a.employeeId || '-';
        const external = !a.employeeId && !!(a.holderName && a.holderName.trim());
        _holdActive.push({
          assetId: a.assetId,
          asset,
          holderName,
          external,
          departmentId: a.departmentId || asset?.departmentId || null,
          dateOut: a.dateOut || asset?.purchaseDate || null,
          dateReturn: null,
          assignmentId: a.id,
        });
        activeAssetIds.add(a.assetId);
      }
    });

    _holdActive.sort((a, b) => new Date(b.dateOut || 0) - new Date(a.dateOut || 0));

    _holdReturned = asg.filter(a => a.dateReturn).map(a => ({
      assetId: a.assetId,
      asset: getAsset(a.assetId),
      holderName: getEmployee(a.employeeId)?.name || a.holderName || '-',
      external: !a.employeeId && !!a.holderName,
      departmentId: a.departmentId,
      dateOut: a.dateOut,
      dateReturn: a.dateReturn,
      assignmentId: a.id,
    })).sort((a, b) => new Date(b.dateReturn || 0) - new Date(a.dateReturn || 0));
  }

  const DAY_MS = 86400000;
  function rowHtml(h) {
    const returned = !!h.dateReturn;
    const heldDays = h.dateOut
      ? Math.max(0, Math.floor(((returned ? new Date(h.dateReturn) : new Date()) - new Date(h.dateOut)) / DAY_MS))
      : null;
    const assetLink = h.asset ? `
      <a href="/assets/${encodeURIComponent(h.asset.id)}"
         style="color:var(--navy-800);text-decoration:none;font-weight:600;">
        ${escapeHtml(h.asset.name)}
      </a>
      <div class="cell-sub" style="font-family:monospace;">${escapeHtml(h.asset.id || h.asset.serial || '')}</div>
    ` : `<span class="cell-sub">${escapeHtml(h.assetId)} (ถูกลบแล้ว)</span>`;

    const statusBadge = returned
      ? `<span class="tag tag-disposed"><span class="tag-dot"></span>คืนแล้ว</span>
         ${heldDays != null ? `<div class="cell-sub" style="margin-top:3px;">ถือครอง ${heldDays} วัน</div>` : ''}`
      : `<span class="tag tag-active"><span class="tag-dot"></span>ถือครองอยู่</span>
         ${heldDays != null ? `<div class="cell-sub" style="margin-top:3px;">ถือครองมาแล้ว ${heldDays} วัน</div>` : ''}`;

    const actions = canEdit ? `
      <td style="text-align:right;">
        <div class="row-actions" style="justify-content:flex-end;">
          ${!returned && h.asset ? `
            <button class="btn btn-sm btn-return" data-return-asset="${escapeHtml(h.assetId)}"
                    data-return-asg="${h.assignmentId || ''}" title="รับคืนทรัพย์สินนี้">
              ${ICONS.check} รับคืน
            </button>
          ` : ''}
          ${h.assignmentId ? `
            <button class="icon-btn" title="แก้ไขการมอบหมาย" data-editassign="${h.assignmentId}">
              ${ICONS.edit}
            </button>
            <button class="icon-btn danger" title="ลบประวัติการมอบหมาย" data-delassign="${h.assignmentId}">
              ${ICONS.trash}
            </button>
          ` : ''}
        </div>
      </td>` : '';

    return `
      <tr>
        <td>${assetLink}</td>
        <td>${escapeHtml(h.holderName)}</td>
        <td>${escapeHtml(getDepartment(h.departmentId)?.name || '-')}</td>
        <td>${fmtDate(h.dateOut)}</td>
        <td>${returned ? fmtDate(h.dateReturn) : '—'}</td>
        <td>${statusBadge}</td>
        ${actions}
      </tr>`;
  }

  function updateAssignHeaderUI() {
    const headTr = document.getElementById('assignTableHead');
    if (!headTr) return;
    headTr.innerHTML = `
      ${sortHeaderHtml('ทรัพย์สิน', 'asset', assignSort.key, assignSort.order)}
      ${sortHeaderHtml('ผู้รับมอบ', 'holder', assignSort.key, assignSort.order)}
      ${sortHeaderHtml('แผนก', 'department', assignSort.key, assignSort.order)}
      ${sortHeaderHtml('วันที่มอบหมาย', 'dateOut', assignSort.key, assignSort.order)}
      ${sortHeaderHtml('วันที่คืน', 'dateReturn', assignSort.key, assignSort.order)}
      ${sortHeaderHtml('สถานะ', 'status', assignSort.key, assignSort.order)}
      ${canEdit ? '<th style="text-align:right;">การจัดการ</th>' : ''}
    `;
    bindAssignSortEvents();
  }

  function bindAssignSortEvents() {
    document.querySelectorAll('#assignTableHead th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (assignSort.key === key) {
          assignSort.order = assignSort.order === 'asc' ? 'desc' : 'asc';
        } else {
          assignSort.key = key;
          assignSort.order = 'asc';
        }
        assignmentPagination.page = 1;
        updateAssignHeaderUI();
        renderHoldings();
      });
    });
  }

  // ── Render the filtered/paginated holdings from the in-memory cache ─────────
  function renderHoldings() {
    const tbody = document.getElementById('assignTableBody');
    const pbar = document.getElementById('assignPaginationBar');
    const hint = document.getElementById('assignTotalHint');
    if (!tbody || !pbar) return;

    const list = assignFilter === 'active' ? [..._holdActive]
      : assignFilter === 'returned' ? [..._holdReturned]
        : [..._holdActive, ..._holdReturned];

    const mult = assignSort.order === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (assignSort.key === 'asset') {
        const nameA = a.asset?.name || a.assetId || '';
        const nameB = b.asset?.name || b.assetId || '';
        return nameA.localeCompare(nameB, 'th', { numeric: true }) * mult;
      }
      if (assignSort.key === 'holder') {
        const hA = a.holderName || '';
        const hB = b.holderName || '';
        return hA.localeCompare(hB, 'th', { numeric: true }) * mult;
      }
      if (assignSort.key === 'department') {
        const dA = getDepartment(a.departmentId)?.name || '';
        const dB = getDepartment(b.departmentId)?.name || '';
        return dA.localeCompare(dB, 'th') * mult;
      }
      if (assignSort.key === 'dateOut') {
        const tA = new Date(a.dateOut || 0).getTime();
        const tB = new Date(b.dateOut || 0).getTime();
        return (tA - tB) * mult;
      }
      if (assignSort.key === 'dateReturn') {
        const tA = new Date(a.dateReturn || 0).getTime();
        const tB = new Date(b.dateReturn || 0).getTime();
        return (tA - tB) * mult;
      }
      if (assignSort.key === 'status') {
        const sA = a.dateReturn ? 'returned' : 'active';
        const sB = b.dateReturn ? 'returned' : 'active';
        return sA.localeCompare(sB) * mult;
      }
      return 0;
    });

    const total = list.length;
    const limit = assignmentPagination.limit;
    const totalPages = Math.ceil(total / limit) || 1;
    if (assignmentPagination.page > totalPages) assignmentPagination.page = totalPages;
    const startIdx = (assignmentPagination.page - 1) * limit;
    const pageRows = list.slice(startIdx, startIdx + limit);

    const filterLabel = assignFilter === 'active' ? 'กำลังถือครอง' : assignFilter === 'returned' ? 'คืนแล้ว' : 'ทั้งหมด';
    if (hint) hint.textContent = `${filterLabel} ${total} รายการ`;

    tbody.innerHTML = pageRows.map(rowHtml).join('') || `
      <tr>
        <td colspan="${canEdit ? 7 : 6}">
          <div class="empty-state">
            ${ICONS.assign}
            <div class="et">${assignFilter === 'returned' ? 'ยังไม่มีรายการที่รับคืน' : 'ยังไม่มีทรัพย์สินที่ถือครองอยู่'}</div>
          </div>
        </td>
      </tr>`;

    const countStart = total === 0 ? 0 : startIdx + 1;
    const countEnd = Math.min(startIdx + limit, total);
    pbar.innerHTML = `
      <div style="font-size:12.5px;color:var(--ink-500);">
        แสดง ${countStart} ถึง ${countEnd} จาก ${total} รายการ
      </div>
      <div style="display:flex;gap:4px;align-items:center;">
        <button class="btn btn-outline btn-sm" id="btnPrevPageAssign"
                ${assignmentPagination.page === 1 ? 'disabled' : ''}>ก่อนหน้า</button>
        <div style="padding:6px 10px;font-size:12.5px;">หน้า ${assignmentPagination.page} / ${totalPages}</div>
        <button class="btn btn-outline btn-sm" id="btnNextPageAssign"
                ${assignmentPagination.page >= totalPages ? 'disabled' : ''}>ถัดไป</button>
      </div>
    `;

    document.getElementById('btnPrevPageAssign')?.addEventListener('click', () => {
      assignmentPagination.page--;
      renderHoldings();
    });
    document.getElementById('btnNextPageAssign')?.addEventListener('click', () => {
      assignmentPagination.page++;
      renderHoldings();
    });

    tbody.querySelectorAll('[data-return-asset]').forEach(b => {
      b.addEventListener('click', () => {
        const asgId = b.dataset.returnAsg;
        if (asgId) markReturned(asgId);
        else markReturnedAsset(b.dataset.returnAsset);
      });
    });
    tbody.querySelectorAll('[data-editassign]').forEach(b => {
      b.addEventListener('click', () => openEditAssignmentModal(b.dataset.editassign));
    });
    tbody.querySelectorAll('[data-delassign]').forEach(b => {
      b.addEventListener('click', () => deleteAssignment(b.dataset.delassign));
    });
  }

  document.getElementById('btnNewAssign')?.addEventListener('click', () => openAssignmentForm());

  document.querySelectorAll('#assignFilterTabs [data-afilter]').forEach(b => {
    b.addEventListener('click', () => {
      assignFilter = b.dataset.afilter;
      assignmentPagination.page = 1;
      document.querySelectorAll('#assignFilterTabs .seg-btn').forEach(x => x.classList.toggle('active', x === b));
      renderHoldings();
    });
  });

  bindAssignSortEvents();

  try {
    await loadHoldings();
  } catch (e) {
    const tbody = document.getElementById('assignTableBody');
    if (tbody) tbody.innerHTML = `
      <tr><td colspan="${canEdit ? 7 : 6}">
        <div style="padding:20px;text-align:center;color:var(--red-700);">เกิดข้อผิดพลาด: ${escapeHtml(e.message)}</div>
      </td></tr>`;
    return;
  }
  renderHoldings();
}

// Return an asset-level holding (customer / external, or any asset with no open assignment record).
function markReturnedAsset(assetId) {
  const asset = getAsset(assetId);
  if (!asset) return;
  const holderName = (asset.holderName && asset.holderName.trim()) || getEmployee(asset.holderId)?.name || '-';
  const heldDays = asset.purchaseDate ? Math.max(0, Math.floor((Date.now() - new Date(asset.purchaseDate)) / 86400000)) : null;
  openModal(`
    <div class="modal-head">
      <h3>รับคืนทรัพย์สิน</h3>
      <button class="modal-close" id="mClose">${ICONS.x}</button>
    </div>
    <form id="returnAssetForm">
      <div class="modal-body">
        <div style="background:var(--paper-alt,#f4f6fa);border:1px solid var(--line);border-radius:var(--radius-m);padding:12px 14px;margin-bottom:14px;font-size:13px;line-height:1.7;">
          <div>ทรัพย์สิน: <b>${escapeHtml(asset.name)}</b>
            <span style="font-family:monospace;color:var(--ink-500);">${escapeHtml(asset.id || asset.serial || '')}</span></div>
          <div>ผู้ถือครอง: <b>${escapeHtml(holderName)}</b></div>
          ${asset.purchaseDate ? `<div>มอบหมายเมื่อ: ${fmtDate(asset.purchaseDate)}${heldDays != null ? ` · ถือครองมาแล้ว <b>${heldDays} วัน</b>` : ''}</div>` : ''}
        </div>
        <div class="field full">
          <label>วันที่รับคืน</label>
          <input type="date" name="dateReturn" required value="${new Date().toISOString().slice(0, 10)}">
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-outline" id="mCancel">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">${ICONS.check}ยืนยันรับคืน</button>
      </div>
    </form>
  `);
  document.getElementById('mClose').onclick = closeModal;
  document.getElementById('mCancel').onclick = closeModal;
  document.getElementById('returnAssetForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    if (asset.purchaseDate && fd.dateReturn && fd.dateReturn < asset.purchaseDate) {
      toast('วันที่รับคืนต้องไม่ก่อนวันที่มอบหมาย', true);
      return;
    }
    try {
      await API.update('assets', assetId, {
        holderId: null,
        holderName: '',
        returnDate: fd.dateReturn,
        status: ['issued', 'borrowed', 'assigned'].includes(asset.status) ? 'ready' : asset.status
      });
      API.log('return', 'assignments', `รับคืนทรัพย์สิน: ${asset.name} จาก ${holderName}`, assetId, asset.name);
      closeModal();
      toast('บันทึกการรับคืนทรัพย์สินแล้ว');
      rerender();
    } catch (err) {
      toast('เกิดข้อผิดพลาด: ' + err.message, true);
    }
  });
}

function markReturned(assignId) {
  const a = DB.assignments.find(x => x.id === assignId);
  if (!a) return;
  const asset = getAsset(a.assetId);
  const emp = getEmployee(a.employeeId);
  const heldDays = a.dateOut ? Math.max(0, Math.floor((Date.now() - new Date(a.dateOut)) / 86400000)) : null;
  openModal(`
    <div class="modal-head">
      <h3>รับคืนทรัพย์สิน</h3>
      <button class="modal-close" id="mClose">${ICONS.x}</button>
    </div>
    <form id="returnForm">
      <div class="modal-body">
        <div style="background:var(--paper-alt,#f4f6fa);border:1px solid var(--line);border-radius:var(--radius-m);padding:12px 14px;margin-bottom:14px;font-size:13px;line-height:1.7;">
          <div>ทรัพย์สิน: <b>${escapeHtml(asset?.name || a.assetId)}</b>
            <span style="font-family:monospace;color:var(--ink-500);">${escapeHtml(asset?.id || asset?.serial || '')}</span></div>
          <div>ผู้ถือครอง: <b>${escapeHtml(emp?.name || a.holderName || a.employeeId || '-')}</b></div>
          <div>มอบหมายเมื่อ: ${fmtDate(a.dateOut)}${heldDays != null ? ` · ถือครองมาแล้ว <b>${heldDays} วัน</b>` : ''}</div>
        </div>
        <div class="field full">
          <label>วันที่รับคืน</label>
          <input type="date"
                 name="dateReturn"
                 required
                 value="${new Date().toISOString().slice(0, 10)}">
        </div>
        <div class="field full" style="margin-top:10px;">
          <label>หมายเหตุ</label>
          <textarea name="note" rows="2" placeholder="สภาพทรัพย์สินขณะรับคืน (ถ้ามี)"></textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-outline" id="mCancel">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">${ICONS.check}ยืนยันรับคืน</button>
      </div>
    </form>
  `);
  document.getElementById('mClose').onclick = closeModal;
  document.getElementById('mCancel').onclick = closeModal;
  document.getElementById('returnForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    if (a.dateOut && fd.dateReturn && fd.dateReturn < a.dateOut) {
      toast('วันที่รับคืนต้องไม่ก่อนวันที่มอบหมาย', true);
      return;
    }
    const newNote = (a.note ? a.note + ' / ' : '') + (fd.note || '');

    try {
      await API.update('assignments', assignId, {
        dateReturn: fd.dateReturn,
        note: newNote
      });
      const asset = getAsset(a.assetId);
      // Clear the holder on the asset whether it was a staff member or an external holder.
      if (asset && (asset.holderId === a.employeeId || (a.holderName && asset.holderName === a.holderName))) {
        await API.update('assets', a.assetId, {
          holderId: null,
          holderName: '',
          returnDate: fd.dateReturn,
          status: ['issued', 'borrowed', 'assigned'].includes(asset.status) ? 'ready' : asset.status
        });
      }
      closeModal();
      toast('บันทึกการรับคืนทรัพย์สินแล้ว');
      rerender();
    } catch (err) {
      toast('เกิดข้อผิดพลาด: ' + err.message, true);
    }
  });
}

async function openAssignmentForm(presetAssetId) {
  if (!API.canEdit('assignments')) {
    toast('ตำแหน่งของคุณไม่มีสิทธิ์ในการมอบหมายทรัพย์สิน', true);
    return;
  }
  if (DB.assets.length < 50) {
    const res = await API.get('assets', { limit: 1000 }).catch(() => null);
    if (res && res.data) DB.assets = res.data;
  }
  const availableAssets = DB.assets.filter(a => a.status !== 'broken');
  const assetOpts = availableAssets.map(a => ({ value: a.id, label: `${a.name} · ${a.id || a.serial}` }));
  const empOpts = DB.employees.map(e => ({ value: e.id, label: `${e.name} · ${e.id}` }));
  openModal(`
    <div class="modal-head">
      <h3>มอบหมายทรัพย์สิน</h3>
      <button class="modal-close" id="mClose">${ICONS.x}</button>
    </div>
    <form id="assignForm">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field full">
            <label>ทรัพย์สิน <span class="req">*</span></label>
            ${searchableSelectHtml({ name: 'assetId', id: 'asgAsset', options: assetOpts, value: presetAssetId || '', required: true, placeholder: 'พิมพ์ชื่อหรือ SN เพื่อค้นหา' })}
          </div>
          <div class="field">
            <label>มอบหมายให้ <span class="req">*</span></label>
            ${searchableSelectHtml({ name: 'holderRef', id: 'asgHolder', options: empOpts, required: true, allowFree: true, placeholder: 'พิมพ์ชื่อบุคลากร หรือลูกค้า/บุคคลภายนอก' })}
            <div style="font-size:11.5px;color:var(--ink-500);margin-top:3px;">
              เลือกบุคลากรจากรายการ หรือพิมพ์ชื่อลูกค้า/ผู้ถือครองภายนอกที่ยังไม่มีในระบบ
            </div>
          </div>
          <div class="field">
            <label>แผนก</label>
            <select name="departmentId" id="asgDept">
              <option value="">— ไม่ระบุ —</option>
              ${DB.departments.map(d => `
                <option value="${d.id}">${escapeHtml(d.name)}</option>
              `).join('')}
            </select>
          </div>
          <div class="field">
            <label>วันที่มอบหมาย <span class="req">*</span></label>
            <input type="date"
                   name="dateOut"
                   required
                   value="${new Date().toISOString().slice(0, 10)}">
          </div>
          <div class="field full">
            <label>หมายเหตุ</label>
            <textarea name="note" rows="2"></textarea>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-outline" id="mCancel">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">${ICONS.check}บันทึกการมอบหมาย</button>
      </div>
    </form>
  `);
  document.getElementById('mClose').onclick = closeModal;
  document.getElementById('mCancel').onclick = closeModal;
  wireSearchableSelect('asgAsset', assetOpts);
  wireSearchableSelect('asgHolder', empOpts, {
    allowFree: true,
    onChange: (ref) => {
      // Auto-fill the department only when the holder is a known employee.
      const dept = document.getElementById('asgDept');
      const emp = getEmployee(ref) || getEmployeeByName(ref);
      if (dept && emp && emp.departmentId) dept.value = emp.departmentId;
    }
  });
  document.getElementById('assignForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());

    // Resolve the holder: a matching staff member links via employeeId; anything else
    // (a customer / external person) is stored as a free-text holderName.
    const ref = (fd.holderRef || '').trim();
    const emp = getEmployee(ref) || getEmployeeByName(ref);
    const employeeId = emp ? emp.id : null;
    const holderName = emp ? '' : ref;

    try {
      await API.create('assignments', {
        id: uid('asg'),
        assetId: fd.assetId,
        employeeId,
        holderName,
        departmentId: fd.departmentId,
        dateOut: fd.dateOut,
        dateReturn: null,
        note: fd.note
      });
      const asset = getAsset(fd.assetId);
      if (asset) {
        await API.update('assets', fd.assetId, {
          holderId: employeeId,
          holderName: emp ? '' : holderName,
          departmentId: fd.departmentId || asset.departmentId,
          purchaseDate: fd.dateOut || asset.purchaseDate,
          returnDate: '',
          status: ['ready', 'broken', 'awaiting_parts'].includes(asset.status) ? 'issued' : asset.status
        });
      }
      closeModal();
      toast('มอบหมายทรัพย์สินเรียบร้อยแล้ว');
      rerender();
    } catch (err) {
      toast('เกิดข้อผิดพลาด: ' + err.message, true);
    }
  });
}

async function openEditAssignmentModal(assignId) {
  if (!API.canEdit('assignments')) {
    toast('ตำแหน่งของคุณไม่มีสิทธิ์ในการแก้ไขการมอบหมายทรัพย์สิน', true);
    return;
  }
  if (DB.assets.length < 50) {
    const res = await API.get('assets', { limit: 1000 }).catch(() => null);
    if (res && res.data) DB.assets = res.data;
  }
  const a = DB.assignments.find(x => x.id === assignId);
  if (!a) return;

  const assetOpts = DB.assets.map(asset => ({ value: asset.id, label: `${asset.name} · ${asset.id || asset.serial}` }));
  const empOpts = DB.employees.map(e => ({ value: e.id, label: `${e.name} · ${e.id}` }));

  openModal(`
    <div class="modal-head">
      <h3>แก้ไขข้อมูลการมอบหมาย</h3>
      <button class="modal-close" id="mClose">${ICONS.x}</button>
    </div>
    <form id="editAssignForm">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field full">
            <label>ทรัพย์สิน <span class="req">*</span></label>
            ${searchableSelectHtml({ name: 'assetId', id: 'edAsgAsset', options: assetOpts, value: a.assetId, required: true, placeholder: 'พิมพ์ชื่อหรือ SN เพื่อค้นหา' })}
          </div>
          <div class="field">
            <label>มอบหมายให้ <span class="req">*</span></label>
            ${searchableSelectHtml({ name: 'holderRef', id: 'edAsgHolder', options: empOpts, value: a.employeeId || a.holderName || '', required: true, allowFree: true, placeholder: 'พิมพ์ชื่อบุคลากร หรือลูกค้า/บุคคลภายนอก' })}
          </div>
          <div class="field">
            <label>แผนก</label>
            <select name="departmentId">
              <option value="">— ไม่ระบุ —</option>
              ${DB.departments.map(d => `
                <option value="${d.id}" ${a.departmentId === d.id ? 'selected' : ''}>
                  ${escapeHtml(d.name)}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="field">
            <label>วันที่มอบหมาย <span class="req">*</span></label>
            <input type="date"
                   name="dateOut"
                   required
                   value="${a.dateOut ? a.dateOut.slice(0, 10) : ''}">
          </div>
          <div class="field">
            <label>วันที่คืน (เว้นว่างหากยังถือครองอยู่)</label>
            <input type="date"
                   name="dateReturn"
                   value="${a.dateReturn ? a.dateReturn.slice(0, 10) : ''}">
          </div>
          <div class="field full">
            <label>หมายเหตุ</label>
            <textarea name="note" rows="2">${escapeHtml(a.note || '')}</textarea>
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
  wireSearchableSelect('edAsgAsset', assetOpts);
  wireSearchableSelect('edAsgHolder', empOpts, { allowFree: true });

  document.getElementById('editAssignForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    // Guard against a return date earlier than the assignment date.
    if (fd.dateReturn && fd.dateOut && fd.dateReturn < fd.dateOut) {
      toast('วันที่คืนต้องไม่ก่อนวันที่มอบหมาย', true);
      return;
    }
    // Resolve holder: staff member → employeeId, otherwise free-text holderName.
    const ref = (fd.holderRef || '').trim();
    const emp = getEmployee(ref) || getEmployeeByName(ref);
    const employeeId = emp ? emp.id : null;
    const holderName = emp ? '' : ref;

    const payload = {
      assetId: fd.assetId,
      employeeId,
      holderName,
      departmentId: fd.departmentId || null,
      dateOut: fd.dateOut,
      dateReturn: fd.dateReturn ? fd.dateReturn : null,
      note: fd.note ? fd.note.trim() : ''
    };

    try {
      await API.update('assignments', assignId, payload);
      Object.assign(a, payload);

      const asset = getAsset(fd.assetId);
      if (asset) {
        if (payload.dateReturn) {
          await API.update('assets', asset.id, {
            holderId: null,
            holderName: '',
            returnDate: payload.dateReturn,
            status: ['issued', 'borrowed', 'assigned'].includes(asset.status) ? 'ready' : asset.status
          });
        } else {
          await API.update('assets', asset.id, {
            holderId: employeeId,
            holderName: emp ? '' : holderName,
            departmentId: payload.departmentId || asset.departmentId,
            purchaseDate: fd.dateOut || asset.purchaseDate,
            returnDate: '',
            status: ['ready', 'broken', 'awaiting_parts'].includes(asset.status) ? 'issued' : asset.status
          });
        }
      }

      closeModal();
      toast('แก้ไขข้อมูลการมอบหมายเรียบร้อยแล้ว');
      rerender();
    } catch (err) {
      toast('เกิดข้อผิดพลาด: ' + err.message, true);
    }
  });
}

function deleteAssignment(assignId) {
  if (!API.canEdit('assignments')) {
    toast('ตำแหน่งของคุณไม่มีสิทธิ์ในการลบข้อมูลได้', true);
    return;
  }
  const a = DB.assignments.find(x => x.id === assignId);
  const asset = a ? getAsset(a.assetId) : null;
  const emp = a ? getEmployee(a.employeeId) : null;
  const assetName = asset?.name || a?.assetId || '';
  const empName = emp?.name || a?.holderName || a?.employeeId || '';

  openModal(`
    <div class="modal-head" style="border-bottom:1px solid #fee2e2;background:#fff5f5;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:34px;height:34px;border-radius:50%;background:#fee2e2;
                    color:#dc2626;display:flex;align-items:center;
                    justify-content:center;flex-shrink:0;">
          ${ICONS.trash}
        </div>
        <h3 style="margin:0;color:#991b1b;">ยืนยันการลบประวัติการมอบหมาย</h3>
      </div>
      <button class="modal-close" id="mClose">${ICONS.x}</button>
    </div>
    <div class="modal-body">
      <p style="margin:0;font-size:14px;color:var(--ink-800);">
        คุณต้องการลบประวัติการมอบหมายทรัพย์สิน <b>${escapeHtml(assetName)}</b>
        ให้กับ <b>${escapeHtml(empName)}</b> ใช่หรือไม่? การลบไม่สามารถกู้คืนได้
      </p>
    </div>
    <div class="modal-foot" style="background:var(--paper-alt);border-top:1px solid var(--line);">
      <button class="btn btn-outline" id="mCancel">ยกเลิก</button>
      <button class="btn btn-danger" id="mConfirmDelAssign">
        ${ICONS.trash} ยืนยันการลบ
      </button>
    </div>
  `);
  document.getElementById('mClose').onclick = closeModal;
  document.getElementById('mCancel').onclick = closeModal;
  document.getElementById('mConfirmDelAssign').onclick = async () => {
    const btn = document.getElementById('mConfirmDelAssign');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'กำลังลบ...';
    }
    try {
      await API.remove('assignments', assignId);
      DB.assignments = DB.assignments.filter(x => x.id !== assignId);
      API.log(
        'delete',
        'assignments',
        `ลบประวัติการมอบหมาย: ${assetName} ให้ ${empName}`,
        a?.assetId,
        assetName
      );
      closeModal();
      toast('ลบประวัติการมอบหมายเรียบร้อยแล้ว');
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
