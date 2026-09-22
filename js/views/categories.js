/* ---------------------------- CATEGORIES VIEW ---------------------------- */
let categoryPagination = { page: 1, limit: 10 };
let categorySort = { key: 'code', order: 'asc' };
let categorySelection = [];

function renderCategories(view) {
  setHeader('การตั้งค่าทะเบียน', 'หมวดหมู่ทรัพย์สิน');
  const canEdit = API.canEdit('categories');

  view.innerHTML = `
    <div class="card">
      <div class="table-toolbar" style="justify-content:space-between;">
        <div style="display:flex;gap:10px;align-items:center;">
          <h3>รายการหมวดหมู่</h3>
        </div>
        <div class="toolbar-right">
          ${canEdit ? `
            <button class="btn btn-outline"
                    id="btnBulkCatAction"
                    style="${categorySelection.length > 0 ? '' : 'display:none;'}">
              จัดการที่เลือก (<span id="catBulkCount">${categorySelection.length}</span>)
            </button>
            <button class="btn btn-primary btn-sm" id="btnAddCat">
              ${ICONS.plus}เพิ่มหมวดหมู่
            </button>
          ` : ''}
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr id="catTableHead">
              ${canEdit ? `
                <th style="width:40px;text-align:center;">
                  <input type="checkbox" id="selectAllCatCheckbox">
                </th>
              ` : ''}
              ${sortHeaderHtml('รหัส', 'code', categorySort.key, categorySort.order)}
              ${sortHeaderHtml('ชื่อหมวดหมู่', 'name', categorySort.key, categorySort.order)}
              ${sortHeaderHtml('จำนวนทรัพย์สิน', 'count', categorySort.key, categorySort.order)}
              ${canEdit ? '<th style="text-align:right;">การจัดการ</th>' : ''}
            </tr>
          </thead>
          <tbody id="catTableBody"></tbody>
        </table>
      </div>
      <div class="table-toolbar"
           id="catPaginationBar"
           style="border-top:1px solid var(--line);border-bottom:none;justify-content:space-between;">
      </div>
    </div>
  `;

  function updateCatSelectionUI() {
    view.querySelectorAll('.row-checkbox-cat').forEach(cb => {
      cb.checked = categorySelection.includes(cb.value);
    });
    const selectAllCb = document.getElementById('selectAllCatCheckbox');
    if (selectAllCb) {
      const startIdx = (categoryPagination.page - 1) * categoryPagination.limit;
      const paginated = DB.categories.slice(startIdx, startIdx + categoryPagination.limit);
      selectAllCb.checked =
        paginated.length > 0 &&
        paginated.every(c => categorySelection.includes(c.id));
    }
    const btnBulk = document.getElementById('btnBulkCatAction');
    const countSpan = document.getElementById('catBulkCount');
    if (btnBulk && countSpan) {
      countSpan.textContent = categorySelection.length;
      btnBulk.style.display =
        canEdit && categorySelection.length > 0 ? 'inline-flex' : 'none';
    }
  }

  function renderCatRowsAndPagination() {
    const tbody = document.getElementById('catTableBody');
    const pbar = document.getElementById('catPaginationBar');
    if (!tbody || !pbar) return;

    const mult = categorySort.order === 'asc' ? 1 : -1;
    DB.categories.sort((a, b) => {
      if (categorySort.key === 'code') {
        return (a.code || '').localeCompare(b.code || '', 'th', { numeric: true }) * mult;
      }
      if (categorySort.key === 'name') {
        return (a.name || '').localeCompare(b.name || '', 'th') * mult;
      }
      if (categorySort.key === 'count') {
        return ((Number(a.assetCount) || 0) - (Number(b.assetCount) || 0)) * mult;
      }
      return 0;
    });

    const totalPages = Math.ceil(DB.categories.length / categoryPagination.limit) || 1;
    if (categoryPagination.page > totalPages) categoryPagination.page = totalPages;
    const startIdx = (categoryPagination.page - 1) * categoryPagination.limit;
    const paginated = DB.categories.slice(startIdx, startIdx + categoryPagination.limit);

    tbody.innerHTML = paginated.map(c => {
      const count = Number(c.assetCount) || 0;
      return `
        <tr>
          ${canEdit ? `
            <td style="text-align:center;">
              <input type="checkbox" class="row-checkbox-cat" value="${escapeHtml(c.id)}">
            </td>
          ` : ''}
          <td><span class="asset-code">${escapeHtml(c.code)}</span></td>
          <td>${escapeHtml(c.name)}</td>
          <td><b>${count}</b> รายการ</td>
          ${canEdit ? `
            <td style="text-align:right;">
              <div class="row-actions" style="justify-content:flex-end;">
                <button class="icon-btn"
                        data-edit="${escapeHtml(c.id)}"
                        title="แก้ไขหมวดหมู่">
                  ${ICONS.edit}
                </button>
                <button class="icon-btn danger"
                        data-del="${escapeHtml(c.id)}"
                        title="ลบหมวดหมู่">
                  ${ICONS.trash}
                </button>
              </div>
            </td>
          ` : ''}
        </tr>
      `;
    }).join('') || `
      <tr>
        <td colspan="${canEdit ? 5 : 3}">
          <div class="empty-state">${ICONS.box}<div class="et">ไม่มีข้อมูล</div></div>
        </td>
      </tr>
    `;

    const countStart = DB.categories.length === 0 ? 0 : startIdx + 1;
    const countEnd = Math.min(startIdx + categoryPagination.limit, DB.categories.length);

    pbar.innerHTML = `
      <div style="font-size:12.5px;color:var(--ink-500);">
        แสดง ${countStart} ถึง ${countEnd} จาก ${DB.categories.length} รายการ
      </div>
      <div style="display:flex;gap:4px;align-items:center;">
        <button class="btn btn-outline btn-sm"
                id="btnPrevPageCat"
                ${categoryPagination.page === 1 ? 'disabled' : ''}>
          ก่อนหน้า
        </button>
        <div style="padding:6px 10px;font-size:12.5px;">
          หน้า ${categoryPagination.page} / ${totalPages}
        </div>
        <button class="btn btn-outline btn-sm"
                id="btnNextPageCat"
                ${categoryPagination.page === totalPages ? 'disabled' : ''}>
          ถัดไป
        </button>
      </div>
    `;

    document.getElementById('btnPrevPageCat')?.addEventListener('click', () => {
      categoryPagination.page--;
      renderCatRowsAndPagination();
    });
    document.getElementById('btnNextPageCat')?.addEventListener('click', () => {
      categoryPagination.page++;
      renderCatRowsAndPagination();
    });

    tbody.querySelectorAll('[data-edit]').forEach(b => {
      b.addEventListener('click', () => openCategoryForm(b.dataset.edit));
    });

    tbody.querySelectorAll('[data-del]').forEach(b => {
      b.addEventListener('click', () => {
        if (!canEdit) {
          toast('ตำแหน่งของคุณไม่มีสิทธิ์ในการลบหมวดหมู่', true);
          return;
        }
        const catId = b.dataset.del;
        const cat = DB.categories.find(c => c.id === catId);
        const catName = cat?.name || catId;
        const assetCount = Number(cat?.assetCount) || 0;
        const inUse = assetCount > 0 || DB.assets.some(a => a.categoryId === catId);
        if (inUse) {
          const countMsg = assetCount > 0 ? `${assetCount} รายการ` : '';
          toast(`ไม่สามารถลบได้ เนื่องจากมีทรัพย์สิน ${countMsg} อยู่ในหมวดหมู่นี้`, true);
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
              <h3 style="margin:0;color:#991b1b;">ยืนยันการลบหมวดหมู่</h3>
            </div>
            <button class="modal-close" id="mClose">${ICONS.x}</button>
          </div>
          <div class="modal-body">
            <p style="margin:0;font-size:14px;color:var(--ink-800);">
              ต้องการลบหมวดหมู่ <b>${escapeHtml(catName)}</b> ออกจากระบบหรือไม่?
            </p>
          </div>
          <div class="modal-foot" style="background:var(--paper-alt);border-top:1px solid var(--line);">
            <button class="btn btn-outline" id="mCancel">ยกเลิก</button>
            <button class="btn btn-danger" id="mConfirmDelCat">
              ${ICONS.trash} ยืนยันการลบ
            </button>
          </div>
        `);
        document.getElementById('mClose').onclick = closeModal;
        document.getElementById('mCancel').onclick = closeModal;
        document.getElementById('mConfirmDelCat').onclick = async () => {
          const btn = document.getElementById('mConfirmDelCat');
          if (btn) {
            btn.disabled = true;
            btn.textContent = 'กำลังลบ...';
          }
          try {
            await API.remove('categories', catId);
            API.log(
              'delete',
              'categories',
              `ลบหมวดหมู่ทรัพย์สิน: ${catName} (ID: ${catId})`,
              catId,
              catName
            );
            categorySelection = categorySelection.filter(id => id !== catId);
            closeModal();
            toast('ลบหมวดหมู่เรียบร้อยแล้ว');
            await syncDB();
            renderCatRowsAndPagination();
          } catch (e) {
            toast('ลบไม่สำเร็จ: ' + e.message, true);
            if (btn) {
              btn.disabled = false;
              btn.innerHTML = `${ICONS.trash} ยืนยันการลบ`;
            }
          }
        };
      });
    });

    tbody.querySelectorAll('.row-checkbox-cat').forEach(cb => {
      cb.addEventListener('change', e => {
        if (e.target.checked) {
          if (!categorySelection.includes(e.target.value)) {
            categorySelection.push(e.target.value);
          }
        } else {
          categorySelection = categorySelection.filter(id => id !== e.target.value);
        }
        updateCatSelectionUI();
      });
    });

    updateCatSelectionUI();
  }

  function updateCatHeaderUI() {
    const headTr = document.getElementById('catTableHead');
    if (!headTr) return;
    headTr.innerHTML = `
      ${canEdit ? `
        <th style="width:40px;text-align:center;">
          <input type="checkbox" id="selectAllCatCheckbox">
        </th>
      ` : ''}
      ${sortHeaderHtml('รหัส', 'code', categorySort.key, categorySort.order)}
      ${sortHeaderHtml('ชื่อหมวดหมู่', 'name', categorySort.key, categorySort.order)}
      ${sortHeaderHtml('จำนวนทรัพย์สิน', 'count', categorySort.key, categorySort.order)}
      ${canEdit ? '<th style="text-align:right;">การจัดการ</th>' : ''}
    `;
    bindCatSortEvents();
    bindSelectAllCatCheckbox();
  }

  function bindCatSortEvents() {
    document.querySelectorAll('#catTableHead th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (categorySort.key === key) {
          categorySort.order = categorySort.order === 'asc' ? 'desc' : 'asc';
        } else {
          categorySort.key = key;
          categorySort.order = 'asc';
        }
        categoryPagination.page = 1;
        updateCatHeaderUI();
        renderCatRowsAndPagination();
      });
    });
  }

  function bindSelectAllCatCheckbox() {
    document.getElementById('selectAllCatCheckbox')?.addEventListener('change', e => {
      const startIdx = (categoryPagination.page - 1) * categoryPagination.limit;
      const paginated = DB.categories.slice(startIdx, startIdx + categoryPagination.limit);
      if (e.target.checked) {
        paginated.forEach(c => {
          if (!categorySelection.includes(c.id)) categorySelection.push(c.id);
        });
      } else {
        categorySelection = categorySelection.filter(id => !paginated.some(c => c.id === id));
      }
      updateCatSelectionUI();
    });
  }

  bindCatSortEvents();
  bindSelectAllCatCheckbox();

  document.getElementById('btnBulkCatAction')?.addEventListener('click', () => {
    const withAssets = categorySelection
      .map(id => DB.categories.find(c => c.id === id))
      .filter(c => c && (Number(c.assetCount) || 0) > 0);

    if (withAssets.length > 0) {
      const names = withAssets.map(c => c.name).slice(0, 3).join(', ');
      const more = withAssets.length > 3 ? '...' : '';
      toast(
        `ไม่สามารถลบได้: มี ${withAssets.length} หมวดหมู่ที่ยังมีทรัพย์สินผูกอยู่ (${names}${more})`,
        true
      );
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
          ยืนยันการลบหมวดหมู่จำนวน <b>${categorySelection.length}</b> รายการที่เลือกหรือไม่?
        </p>
      </div>
      <div class="modal-foot" style="background:var(--paper-alt);border-top:1px solid var(--line);">
        <button class="btn btn-outline" id="mCancel">ยกเลิก</button>
        <button class="btn btn-danger" id="mConfirmBulk">
          ${ICONS.trash} ยืนยันการลบ ${categorySelection.length} รายการ
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
        const count = categorySelection.length;
        await Promise.all(categorySelection.map(id => API.remove('categories', id)));
        API.log('delete', 'categories', `ลบหมวดหมู่แบบกลุ่มจำนวน ${count} รายการ`);
        categorySelection = [];
        closeModal();
        toast('ลบรายการที่เลือกแล้ว');
        await syncDB();
        renderCatRowsAndPagination();
      } catch (e) {
        toast('เกิดข้อผิดพลาดในการลบ: ' + e.message, true);
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `${ICONS.trash} ยืนยันการลบ`;
        }
      }
    };
  });

  document.getElementById('btnAddCat')?.addEventListener('click', () => openCategoryForm());

  renderCatRowsAndPagination();
}

function openCategoryForm(id) {
  if (!API.canEdit('categories')) {
    toast('ตำแหน่งของคุณไม่มีสิทธิ์ในการเพิ่มหรือแก้ไขหมวดหมู่', true);
    return;
  }
  const cat = id ? DB.categories.find(c => c.id === id) : null;
  openModal(`
    <div class="modal-head">
      <h3>${cat ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}</h3>
      <button class="modal-close" id="mClose">${ICONS.x}</button>
    </div>
    <form id="catForm">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field">
            <label>รหัสหมวดหมู่ <span class="req">*</span></label>
            <input name="code"
                   required
                   maxlength="4"
                   style="text-transform:uppercase"
                   value="${cat ? cat.code : ''}"
                   placeholder="เช่น IT">
          </div>
          <div class="field">
            <label>ชื่อหมวดหมู่ <span class="req">*</span></label>
            <input name="name"
                   required
                   value="${cat ? escapeHtml(cat.name) : ''}">
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

  document.getElementById('catForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());

    try {
      if (cat) {
        await API.update('categories', cat.id, {
          code: fd.code.toUpperCase(),
          name: fd.name
        });
      } else {
        await API.create('categories', {
          id: uid('cat'),
          code: fd.code.toUpperCase(),
          name: fd.name,
          usefulLife: 5,
          salvagePct: 5
        });
      }
      closeModal();
      toast('บันทึกหมวดหมู่เรียบร้อยแล้ว');
      await syncDB();
      rerender();
    } catch (err) {
      toast('เกิดข้อผิดพลาด: ' + err.message, true);
    }
  });
}
