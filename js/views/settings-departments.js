// js/views/settings-departments.js - Department Management Module
// Handles department listing, pagination, selection, creation, editing, and deletion.

(function() {
  let departmentPagination = { page: 1, limit: 10 };
  let departmentSelection = [];
  let _options = {};

  function updateDeptSelectionUI(paginatedDepts = []) {
    const container = _options.container || document;
    container.querySelectorAll('.row-checkbox-dept').forEach(cb => {
      cb.checked = departmentSelection.includes(cb.value);
    });

    const selectAllCb = document.getElementById('selectAllDeptCheckbox');
    if (selectAllCb) {
      selectAllCb.checked =
        paginatedDepts.length > 0 &&
        paginatedDepts.every(d => departmentSelection.includes(d.id));
    }

    const btnBulk = document.getElementById('btnBulkDeptAction');
    const countSpan = document.getElementById('deptBulkCount');
    if (btnBulk && countSpan) {
      countSpan.textContent = departmentSelection.length;
      btnBulk.style.display = departmentSelection.length > 0 ? 'inline-flex' : 'none';
    }
  }

  function renderDeptTable() {
    const tbody = document.getElementById('deptTableBody');
    const pbar = document.getElementById('deptPaginationToolbar');
    if (!tbody || !pbar) return;

    const canEdit = _options.canEdit !== false && API.canEdit('settings');
    const totalPages = Math.ceil(DB.departments.length / departmentPagination.limit) || 1;
    if (departmentPagination.page > totalPages) {
      departmentPagination.page = totalPages;
    }

    const startIdx = (departmentPagination.page - 1) * departmentPagination.limit;
    const paginated = DB.departments.slice(startIdx, startIdx + departmentPagination.limit);

    tbody.innerHTML = paginated.map(d => {
      const empCount = d.employeeCount !== undefined
        ? Number(d.employeeCount)
        : DB.employees.filter(e => e.department === d.id || e.departmentId === d.id).length;

      return `
        <tr>
          ${canEdit ? `
            <td style="text-align:center;">
              <input type="checkbox" class="row-checkbox-dept" value="${d.id}">
            </td>
          ` : ''}
          <td><b>${escapeHtml(d.name)}</b></td>
          <td>${empCount} คน</td>
          ${canEdit ? `
            <td style="text-align:right;">
              <div class="row-actions" style="justify-content:flex-end;">
                <button class="icon-btn"
                        title="แก้ไขแผนก"
                        data-editdept="${d.id}">
                  ${ICONS.edit}
                </button>
                <button class="icon-btn danger"
                        title="ลบแผนก"
                        data-deldept="${d.id}">
                  ${ICONS.trash}
                </button>
              </div>
            </td>
          ` : ''}
        </tr>
      `;
    }).join('') || `
      <tr>
        <td colspan="${canEdit ? 4 : 2}">
          <div class="empty-state">
            <div class="et">ไม่มีข้อมูลแผนก</div>
          </div>
        </td>
      </tr>
    `;

    const countStart = DB.departments.length === 0 ? 0 : startIdx + 1;
    const countEnd = Math.min(startIdx + departmentPagination.limit, DB.departments.length);

    pbar.innerHTML = `
      <div style="font-size:12.5px;color:var(--ink-500);">
        แสดง ${countStart} ถึง ${countEnd} จาก ${DB.departments.length} รายการ
      </div>
      <div style="display:flex;gap:4px;align-items:center;">
        <button class="btn btn-outline btn-sm"
                id="btnPrevPageDept"
                ${departmentPagination.page === 1 ? 'disabled' : ''}>
          ก่อนหน้า
        </button>
        <div style="padding:4px 10px;font-size:12.5px;">
          หน้า ${departmentPagination.page} / ${totalPages}
        </div>
        <button class="btn btn-outline btn-sm"
                id="btnNextPageDept"
                ${departmentPagination.page >= totalPages ? 'disabled' : ''}>
          ถัดไป
        </button>
      </div>
    `;

    document.getElementById('btnPrevPageDept')?.addEventListener('click', () => {
      departmentPagination.page--;
      renderDeptTable();
    });

    document.getElementById('btnNextPageDept')?.addEventListener('click', () => {
      departmentPagination.page++;
      renderDeptTable();
    });

    tbody.querySelectorAll('.row-checkbox-dept').forEach(cb => {
      cb.addEventListener('change', e => {
        if (e.target.checked) {
          if (!departmentSelection.includes(e.target.value)) {
            departmentSelection.push(e.target.value);
          }
        } else {
          departmentSelection = departmentSelection.filter(id => id !== e.target.value);
        }
        updateDeptSelectionUI(paginated);
      });
    });

    tbody.querySelectorAll('[data-editdept]').forEach(b => {
      b.addEventListener('click', () => openEditDeptModal(b.dataset.editdept));
    });

    tbody.querySelectorAll('[data-deldept]').forEach(b => {
      b.addEventListener('click', () => deleteDeptAction(b.dataset.deldept));
    });

    updateDeptSelectionUI(paginated);
  }

  function openAddDeptModal() {
    openModal(`
      <div class="modal-head">
        <h3>เพิ่มแผนก</h3>
        <button class="modal-close" id="mClose">${ICONS.x}</button>
      </div>
      <form id="deptForm">
        <div class="modal-body">
          <div class="field">
            <label>ชื่อแผนก <span class="req">*</span></label>
            <input name="name" required placeholder="เช่น แผนกบัญชีและการเงิน">
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

    document.getElementById('deptForm').addEventListener('submit', async ev => {
      ev.preventDefault();
      const fd = Object.fromEntries(new FormData(ev.target).entries());
      const name = fd.name ? fd.name.trim() : '';
      if (!name) {
        toast('กรุณากรอกชื่อแผนก', true);
        return;
      }
      try {
        const newDept = { id: uid('dep'), name };
        await API.create('departments', newDept);
        closeModal();
        toast('เพิ่มแผนกเรียบร้อยแล้ว');
        await syncDB();
        renderDeptTable();
        if (_options.onDataChange) _options.onDataChange();
      } catch (err) {
        toast('เกิดข้อผิดพลาด: ' + err.message, true);
      }
    });
  }

  function openEditDeptModal(deptId) {
    const targetDept = DB.departments.find(d => d.id === deptId);
    if (!targetDept) return;

    openModal(`
      <div class="modal-head">
        <h3>แก้ไขแผนก</h3>
        <button class="modal-close" id="mClose">${ICONS.x}</button>
      </div>
      <form id="editDeptForm">
        <div class="modal-body">
          <div class="field">
            <label>ชื่อแผนก <span class="req">*</span></label>
            <input name="name"
                   value="${escapeHtml(targetDept.name)}"
                   required
                   placeholder="ชื่อแผนก">
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

    document.getElementById('editDeptForm').addEventListener('submit', async ev => {
      ev.preventDefault();
      const fd = Object.fromEntries(new FormData(ev.target).entries());
      const name = fd.name ? fd.name.trim() : '';
      if (!name) {
        toast('กรุณากรอกชื่อแผนก', true);
        return;
      }
      try {
        await API.update('departments', deptId, { name });
        targetDept.name = name;
        closeModal();
        toast('แก้ไขแผนกเรียบร้อยแล้ว');
        renderDeptTable();
        if (_options.onDataChange) _options.onDataChange();
      } catch (err) {
        toast('เกิดข้อผิดพลาด: ' + err.message, true);
      }
    });
  }

  function deleteDeptAction(deptId) {
    const targetDept = DB.departments.find(d => d.id === deptId);
    const deptName = targetDept?.name || deptId;
    const hasAssets = (Number(targetDept?.assetCount) || 0) > 0 ||
      DB.assets.some(a => a.departmentId === deptId);

    if (hasAssets) {
      toast('ไม่สามารถลบได้ เนื่องจากมีทรัพย์สินอยู่ในแผนกนี้', true);
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
          <h3 style="margin:0;color:#991b1b;">ยืนยันการลบแผนก</h3>
        </div>
        <button class="modal-close" id="mClose">${ICONS.x}</button>
      </div>
      <div class="modal-body">
        <p style="margin:0;font-size:14px;color:var(--ink-800);">
          ต้องการลบแผนก <b>${escapeHtml(deptName)}</b> ออกจากระบบหรือไม่? การลบไม่สามารถกู้คืนได้
        </p>
      </div>
      <div class="modal-foot" style="background:var(--paper-alt);border-top:1px solid var(--line);">
        <button class="btn btn-outline" id="mCancel">ยกเลิก</button>
        <button class="btn btn-danger" id="mConfirmDelDept">
          ${ICONS.trash} ยืนยันการลบ
        </button>
      </div>
    `);

    document.getElementById('mClose').onclick = closeModal;
    document.getElementById('mCancel').onclick = closeModal;

    document.getElementById('mConfirmDelDept').onclick = async () => {
      const btn = document.getElementById('mConfirmDelDept');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'กำลังลบ...';
      }
      try {
        await API.remove('departments', deptId);
        API.log('delete', 'departments', `ลบแผนก: ${deptName} (ID: ${deptId})`, deptId, deptName);
        departmentSelection = departmentSelection.filter(id => id !== deptId);
        closeModal();
        toast('ลบแผนกเรียบร้อยแล้ว');
        await syncDB();
        renderDeptTable();
        if (_options.onDataChange) _options.onDataChange();
      } catch (err) {
        toast('ลบไม่สำเร็จ: ' + err.message, true);
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `${ICONS.trash} ยืนยันการลบ`;
        }
      }
    };
  }

  function handleBulkDeptDelete() {
    if (departmentSelection.length === 0) return;

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
          ยืนยันการลบแผนก/หน่วยงานจำนวน <b>${departmentSelection.length}</b> รายการที่เลือกหรือไม่?
        </p>
      </div>
      <div class="modal-foot" style="background:var(--paper-alt);border-top:1px solid var(--line);">
        <button class="btn btn-outline" id="mCancel">ยกเลิก</button>
        <button class="btn btn-danger" id="mConfirmBulkDept">
          ${ICONS.trash} ยืนยันการลบ ${departmentSelection.length} รายการ
        </button>
      </div>
    `);

    document.getElementById('mClose').onclick = closeModal;
    document.getElementById('mCancel').onclick = closeModal;

    document.getElementById('mConfirmBulkDept').onclick = async () => {
      const btn = document.getElementById('mConfirmBulkDept');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'กำลังลบ...';
      }
      try {
        const count = departmentSelection.length;
        await Promise.all(departmentSelection.map(id => API.remove('departments', id)));
        API.log('delete', 'departments', `ลบแผนก/หน่วยงานแบบกลุ่มจำนวน ${count} รายการ`);
        departmentSelection = [];
        closeModal();
        toast('ลบรายการที่เลือกแล้ว');
        await syncDB();
        renderDeptTable();
        if (_options.onDataChange) _options.onDataChange();
      } catch (e) {
        toast('เกิดข้อผิดพลาดในการลบ: ' + e.message, true);
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `${ICONS.trash} ยืนยันการลบ`;
        }
      }
    };
  }

  function init(options = {}) {
    _options = options;
    departmentSelection = [];
    departmentPagination.page = 1;

    document.getElementById('selectAllDeptCheckbox')?.addEventListener('change', e => {
      const startIdx = (departmentPagination.page - 1) * departmentPagination.limit;
      const paginated = DB.departments.slice(startIdx, startIdx + departmentPagination.limit);
      if (e.target.checked) {
        paginated.forEach(d => {
          if (!departmentSelection.includes(d.id)) departmentSelection.push(d.id);
        });
      } else {
        departmentSelection = departmentSelection.filter(id => !paginated.some(d => d.id === id));
      }
      updateDeptSelectionUI(paginated);
    });

    document.getElementById('btnBulkDeptAction')?.addEventListener('click', handleBulkDeptDelete);
    document.getElementById('btnAddDept')?.addEventListener('click', openAddDeptModal);

    renderDeptTable();
  }

  window.SettingsDepartments = {
    init,
    renderTable: renderDeptTable,
    openAddModal: openAddDeptModal,
    openEditModal: openEditDeptModal,
    deleteAction: deleteDeptAction
  };
})();
