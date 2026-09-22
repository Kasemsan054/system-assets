/* ---------------------------- Derived helpers ---------------------------- */
function getCategory(id){ return DB.categories.find(c=>c.id===id); }
function getDepartment(id){ return DB.departments.find(d=>d.id===id); }
function getEmployee(id){ return DB.employees.find(e=>e.id===id); }
function getEmployeeByName(name){
  if(!name) return null;
  const n = String(name).trim().toLowerCase();
  return DB.employees.find(e => (e.name||'').trim().toLowerCase() === n) || null;
}
function getAsset(id){ return DB.assets.find(a=>a.id===id); }
function holderDisplayName(asset){
  return (asset.holderName && asset.holderName.trim()) ||
         getEmployee(asset.holderId)?.name || '';
}

// Single source of truth for asset statuses — keep in sync with ASSET_STATUSES
// in functions/_lib/models.js. `color` is used by the dashboard donut/legend.
const STATUS_LABELS = {
  ready:          {label:'พร้อมใช้',    cls:'tag-active',      color:'#1f6d45'},
  issued:         {label:'เบิกใช้แล้ว',  cls:'tag-idle',        color:'#1f5f9a'},
  assigned:       {label:'มอบหมายแล้ว',  cls:'tag-idle',        color:'#2563eb'},
  borrowed:       {label:'ติดยืม',       cls:'tag-borrowed',    color:'#6b3fa0'},
  repair:         {label:'ส่งซ่อม',      cls:'tag-maintenance', color:'#9a6c14'},
  maintenance:    {label:'ซ่อมบำรุง',    cls:'tag-maintenance', color:'#b45309'},
  awaiting_parts: {label:'รออะไหล่',     cls:'tag-disposed',    color:'#8590a0'},
  broken:         {label:'เสีย',         cls:'tag-lost',        color:'#a3352e'},
  retired:        {label:'ปลดระวาง',     cls:'tag-disposed',    color:'#6b7280'},
  lost:           {label:'สูญหาย',       cls:'tag-lost',        color:'#dc2626'},
};
function statusTag(status){
  const s = STATUS_LABELS[status] || STATUS_LABELS.ready;
  return `<span class="tag ${s.cls}"><span class="tag-dot"></span>${s.label}</span>`;
}

function assetHistory(assetId){
  const items = [];
  DB.assignments.filter(a=>a.assetId===assetId).forEach(a=>{
    const holder = getEmployee(a.employeeId)?.name || a.holderName || '-';
    items.push({
      date: a.dateOut, type: 'assign',
      text: `มอบหมายให้ ${holder}`,
      meta: getDepartment(a.departmentId)?.name || ''
    });
    if(a.dateReturn){
      items.push({
        date: a.dateReturn, type: 'return',
        text: `คืนทรัพย์สินจาก ${holder}`,
        meta: a.note || ''
      });
    }
  });
  DB.maintenance.filter(m=>m.assetId===assetId).forEach(m=>{
    items.push({
      date: m.date, type: 'maintenance',
      text: `${m.type}: ${m.description}`,
      meta: `${m.vendor || ''}`
    });
    if (m.completedDate) {
      items.push({
        date: m.completedDate, type: 'done',
        text: 'ซ่อมบำรุงเสร็จสิ้น', meta: m.description
      });
    }
  });
  items.push({
    date: null, type: 'created', text: 'ขึ้นทะเบียนทรัพย์สิน',
    meta: `วันที่จัดซื้อ ${fmtDate(DBGetAssetPurchaseDate(assetId))}`,
    sortDate: getAsset(assetId)?.purchaseDate
  });
  items.forEach(i=>{ if(!i.sortDate) i.sortDate = i.date; });
  items.sort((a,b)=> new Date(a.sortDate||0) - new Date(b.sortDate||0));
  return items;
}
function DBGetAssetPurchaseDate(id){ return getAsset(id)?.purchaseDate; }

/* ---------------------------- Excel Import / Export ---------------------------- */
function normalizeDateForImport(v){
  if(v===undefined || v===null || v==='') return '';
  if(v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10);
  if(typeof v === 'number' && window.XLSX && XLSX.SSF){
    const d = XLSX.SSF.parse_date_code(v);
    if(d) return `${d.y}-${pad(d.m,2)}-${pad(d.d,2)}`;
  }
  const s = String(v).trim();
  const parsed = new Date(s);
  if(!isNaN(parsed) && /\d{4}/.test(s)) return parsed.toISOString().slice(0,10);
  return s;
}

function buildWorkbook(customData = {}){
  const wb = XLSX.utils.book_new();

  const categories = customData.categories || DB.categories;
  const departments = customData.departments || DB.departments;
  const employees = customData.employees || DB.employees;
  const assets = customData.assets || DB.assets;
  const assignments = customData.assignments || DB.assignments;
  const maintenance = customData.maintenance || DB.maintenance;

  const catRows = categories.map(c=>({
    'รหัสอ้างอิง':c.id, 'รหัสหมวดหมู่':c.code, 'ชื่อหมวดหมู่':c.name, 'อายุการใช้งาน(ปี)':c.usefulLife,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows), 'หมวดหมู่');

  const depRows = departments.map(d=>({ 'รหัสอ้างอิง':d.id, 'ชื่อแผนก':d.name }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(depRows), 'แผนก');

  const empRows = employees.map(e=>({
    'รหัสอ้างอิง':e.id, 'ชื่อ-นามสกุล':e.name, 'รหัสแผนก':e.department||e.departmentId||'',
    'แผนก':getDepartment(e.department||e.departmentId)?.name||'', 'ตำแหน่ง':e.position||e.location||'',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empRows), 'บุคลากร');

  const assetRows = assets.map(a=>({
    'หมายเลขเครื่อง/SN (ID)':a.id, 'ชื่อทรัพย์สิน':a.name,
    'รหัสหมวดหมู่':a.categoryId, 'หมวดหมู่':getCategory(a.categoryId)?.name||'',
    'รหัสแผนก':a.departmentId||'', 'แผนก':getDepartment(a.departmentId)?.name||'',
    'รหัสผู้ถือครอง':a.holderId||'', 'ผู้ถือครอง':holderDisplayName(a),
    'วันที่เบิกไปใช้งาน':a.purchaseDate||'', 'อายุการใช้งาน(ปี)':a.usefulLife,
    'สถานะ':STATUS_LABELS[a.status]?.label||a.status,
    'สถานที่จัดเก็บ':a.location||'', 'หมายเลขเครื่อง/SN':a.serial||a.id||'', 'หมายเหตุ':a.note||'',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assetRows), 'ทรัพย์สิน');

  const asgRows = assignments.map(a=>({
    'รหัสอ้างอิง': a.id, 'รหัสทรัพย์สิน': a.assetId,
    'ทรัพย์สิน': (assets.find(ast => ast.id === a.assetId) || getAsset(a.assetId))?.name || '',
    'รหัสบุคลากร':a.employeeId, 'ผู้รับมอบ':getEmployee(a.employeeId)?.name||'',
    'รหัสแผนก':a.departmentId||'', 'แผนก':getDepartment(a.departmentId)?.name||'',
    'วันที่มอบหมาย':a.dateOut||'', 'วันที่คืน':a.dateReturn||'', 'หมายเหตุ':a.note||'',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(asgRows), 'การมอบหมาย');

  const mntRows = maintenance.map(m=>({
    'รหัสอ้างอิง': m.id, 'รหัสทรัพย์สิน': m.assetId,
    'ทรัพย์สิน': (assets.find(ast => ast.id === m.assetId) || getAsset(m.assetId))?.name || '',
    'วันที่แจ้ง': m.date || '', 'ประเภทงาน': m.type || '',
    'ผู้รับซ่อม': m.vendor || '', 'รายละเอียด': m.description || '',
    'สถานะ': m.status==='in_progress' ? 'กำลังดำเนินการ' : 'เสร็จสิ้น',
    'วันที่เสร็จสิ้น':m.completedDate||'',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mntRows), 'ซ่อมบำรุง');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    {'ชื่อองค์กร':DB.orgName||'', 'ชื่อรอง':DB.orgSub||''}
  ]), 'ข้อมูลองค์กร');

  return wb;
}

function sheetToRows(wb, name){
  const ws = wb.Sheets[name];
  if(!ws) return [];
  return XLSX.utils.sheet_to_json(ws, {defval:''});
}

function parseWorkbook(wb){
  const catRows = sheetToRows(wb, 'หมวดหมู่');
  const categories = catRows.map(r=>({
    id: String(r['รหัสอ้างอิง']||uid('cat')),
    code: String(r['รหัสหมวดหมู่']||'').toUpperCase(),
    name: String(r['ชื่อหมวดหมู่']||''),
    usefulLife: Number(r['อายุการใช้งาน(ปี)'])||5,
  })).filter(c=>c.name);

  let depRows = sheetToRows(wb, 'แผนก');
  if (!depRows.length) depRows = sheetToRows(wb, 'หน่วยงาน');
  const departments = depRows.map(r=>({
    id: String(r['รหัสอ้างอิง']||uid('dep')),
    name: String(r['ชื่อแผนก']||r['ชื่อหน่วยงาน']||''),
  })).filter(d=>d.name);

  const empRows = sheetToRows(wb, 'บุคลากร');
  const employees = empRows.map(r=>({
    id: String(r['รหัสอ้างอิง']||uid('emp')),
    name: String(r['ชื่อ-นามสกุล']||''),
    department: String(r['รหัสแผนก']||r['รหัสหน่วยงาน']||''),
    departmentId: String(r['รหัสแผนก']||r['รหัสหน่วยงาน']||''),
    position: String(r['ตำแหน่ง']||r['สถานที่']||''),
    location: String(r['ตำแหน่ง']||r['สถานที่']||''),
  })).filter(e=>e.name);

  const statusReverse = {};
  Object.entries(STATUS_LABELS).forEach(([k,v])=>{ statusReverse[v.label] = k; });

  const assetRows = sheetToRows(wb, 'ทรัพย์สิน');
  const assets = assetRows.map(r=>{
    const sn = String(
      r['หมายเลขเครื่อง/SN (ID)'] || r['หมายเลขเครื่อง/SN'] ||
      r['รหัสอ้างอิง'] || uid('ast')
    ).trim();
    return {
      id: sn,
      name: String(r['ชื่อทรัพย์สิน']||''),
      categoryId: String(r['รหัสหมวดหมู่']||''),
      departmentId: String(r['รหัสแผนก']||r['รหัสหน่วยงาน']||''),
      holderId: r['รหัสผู้ถือครอง'] ? String(r['รหัสผู้ถือครอง']) : null,
      holderName: r['ผู้ถือครอง'] ? String(r['ผู้ถือครอง']) : '',
      purchaseDate: normalizeDateForImport(r['วันที่เบิกไปใช้งาน'] || r['วันที่จัดซื้อ']),
      usefulLife: Number(r['อายุการใช้งาน(ปี)'])||5,
      status: statusReverse[String(r['สถานะ']||'').trim()] || 'ready',
      location: String(r['สถานที่จัดเก็บ']||''),
      serial: sn,
      note: String(r['หมายเหตุ']||''),
    };
  }).filter(a=>a.name);

  const asgRows = sheetToRows(wb, 'การมอบหมาย');
  const assignments = asgRows.map(r=>({
    id: String(r['รหัสอ้างอิง']||uid('asg')),
    assetId: String(r['รหัสทรัพย์สิน']||''),
    employeeId: String(r['รหัสบุคลากร']||''),
    departmentId: String(r['รหัสแผนก']||r['รหัสหน่วยงาน']||''),
    dateOut: normalizeDateForImport(r['วันที่มอบหมาย']),
    dateReturn: r['วันที่คืน'] ? normalizeDateForImport(r['วันที่คืน']) : null,
    note: String(r['หมายเหตุ']||''),
  })).filter(a=>a.assetId);

  const mntRows = sheetToRows(wb, 'ซ่อมบำรุง');
  const maintenance = mntRows.map(r=>({
    id: String(r['รหัสอ้างอิง']||uid('mnt')),
    assetId: String(r['รหัสทรัพย์สิน']||''),
    date: normalizeDateForImport(r['วันที่แจ้ง']),
    type: String(r['ประเภทงาน']||''),
    vendor: String(r['ผู้รับซ่อม']||''),
    description: String(r['รายละเอียด']||''),
    status: String(r['สถานะ']||'').trim()==='เสร็จสิ้น' ? 'done' : 'in_progress',
    completedDate: r['วันที่เสร็จสิ้น'] ? normalizeDateForImport(r['วันที่เสร็จสิ้น']) : null,
  })).filter(m=>m.assetId);

  const orgRows = sheetToRows(wb, 'ข้อมูลองค์กร');
  const orgName = (orgRows[0] && orgRows[0]['ชื่อองค์กร']) || 'องค์กรของคุณ';
  const orgSub = (orgRows[0] && orgRows[0]['ชื่อรอง']) || '';

  if(!categories.length && !assets.length){ throw new Error('invalid workbook'); }

  return {orgName, orgSub, categories, departments, employees, assets, assignments, maintenance, seq:{}};
}

/* ---------------------------- Toast ---------------------------- */
function toast(msg, isErr){
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast'+(isErr?' err':'');
  
  // Use icon map to map specific error or success icons
  const icon = isErr ? ICONS.x : ICONS.check;
  el.innerHTML = `${icon}<span>${escapeHtml(msg)}</span>`;
  wrap.appendChild(el);
  
  setTimeout(()=>{ 
      el.style.opacity = '0'; 
      el.style.transform = 'translateY(15px) scale(0.9)'; 
      el.style.transition = 'all 0.3s ease'; 
      setTimeout(()=>el.remove(), 300); 
  }, 3000);
}

/* ---------------------------- Sortable Table Header Helper ---------------------------- */
function sortHeaderHtml(label, key, currentKey, currentOrder) {
  const isCurrent = currentKey === key;
  const icon = isCurrent ? (currentOrder === 'asc' ? '▲' : '▼') : '↕';
  const cls = isCurrent ? `sortable sort-${currentOrder}` : 'sortable';
  return `<th class="${cls}" data-sort="${key}" title="คลิกเพื่อเรียงลำดับตาม${escapeHtml(label)}">` +
    `<span class="th-sort-content"><span>${escapeHtml(label)}</span><span class="sort-icon">${icon}</span></span></th>`;
}
