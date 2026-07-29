'use strict';
// ============================================================
// js/users.js — Phase-4P-3
// User Management: loadUsers, openUserModal, closeUserModal,
// editUser, saveUser, toggleUserActive
// Extracted verbatim from inline script.
// Loads after js/projects.js.
// Depends on globals: sb, currentUser, _validateEmpId,
//   toast, escapeHtml, fillFormMap, openModal, closeModal
// ============================================================

// ---- USER MANAGEMENT ----
async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:24px">กำลังโหลด...</td></tr>';
  const { data, error } = await sb.from('employees').select('*').order('employee_id');
  if (error) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--red);padding:24px">โหลดไม่สำเร็จ: ' + escapeHtml(error.message) + '</td></tr>';
    return;
  }
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:24px">ยังไม่มีผู้ใช้</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  data.forEach(u => {
    const tr = document.createElement('tr');
    if (!u.is_active) tr.className = 'inactive-row';
    tr.innerHTML = `
      <td class="uid-cell">${escapeHtml(u.employee_id)}</td>
      <td>${escapeHtml(u.full_name)}</td>
      <td><span class="role-pill">${escapeHtml(u.role)}</span></td>
      <td>${escapeHtml(u.department || '—')}</td>
      <td>${u.is_active ? '<span style="color:var(--green)">● ใช้งาน</span>' : '<span style="color:var(--text3)">○ ปิด</span>'}</td>
      <td style="text-align:right">
        <button class="btn-secondary" style="padding:4px 10px;font-size:11px" onclick='editUser(${JSON.stringify(u.id)})'>แก้ไข</button>
        <button class="btn-danger" onclick='toggleUserActive(${JSON.stringify(u.id)}, ${u.is_active})'>${u.is_active ? 'ปิด' : 'เปิด'}</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

let _userEditing = null;
function openUserModal() {
  _userEditing = null;
  fillFormMap({
    userModalDbId:'', userModalEmpId:'', userModalName:'',
    userModalRole:'Site Engineer', userModalDept:'', userModalPhone:'', userModalPw:''
  });
  const empIdEl = document.getElementById('userModalEmpId');
  const pwEl    = document.getElementById('userModalPwRow');
  const pw      = document.getElementById('userModalPw');
  if (empIdEl) empIdEl.disabled = false;
  // FIXED: Supabase auth signUp removed — employees is now a plain directory, no password.
  if (pwEl)    pwEl.style.display = 'none';
  if (pw)      pw.required = false;
  document.getElementById('userModalTitle').textContent = '👤 เพิ่มผู้ใช้';
  openModal('userModal');
}
function closeUserModal() { closeModal('userModal'); }

async function editUser(id) {
  const { data: u, error } = await sb.from('employees').select('*').eq('id', id).single();
  if (error) { toast('โหลดไม่สำเร็จ', 'error'); return; }
  _userEditing = u;
  fillFormMap({
    userModalDbId: u.id,             userModalEmpId: u.employee_id,
    userModalName: u.full_name,      userModalRole: u.role,
    userModalDept: u.department || '', userModalPhone: u.phone || '', userModalPw: ''
  });
  const empIdEl = document.getElementById('userModalEmpId');
  const pwEl    = document.getElementById('userModalPwRow');
  const pw      = document.getElementById('userModalPw');
  if (empIdEl) empIdEl.disabled = true;
  if (pwEl)    pwEl.style.display = 'none';
  if (pw)      pw.required = false;
  document.getElementById('userModalTitle').textContent = '✏ แก้ไขผู้ใช้: ' + u.employee_id;
  openModal('userModal');
}

async function saveUser(e) {
  e.preventDefault();
  const btn = document.getElementById('userModalSaveBtn');
  btn.disabled = true;
  const dbId = document.getElementById('userModalDbId').value;
  const empId = document.getElementById('userModalEmpId').value.trim().toUpperCase();
  const name = document.getElementById('userModalName').value.trim();
  const role = document.getElementById('userModalRole').value;
  const dept = document.getElementById('userModalDept').value.trim() || null;
  const phone = document.getElementById('userModalPhone').value.trim() || null;
  if (!dbId && !_validateEmpId(empId)) {
    toast('รหัสพนักงานต้องเป็น STE-XXX', 'error');
    btn.disabled = false; return;
  }
  try {
    if (dbId) {
      const { error } = await sb.from('employees')
        .update({ full_name: name, role, department: dept, phone })
        .eq('id', dbId);
      if (error) throw error;
      toast('แก้ไขเรียบร้อย', 'success');
    } else {
      // FIXED: no more Supabase Auth signUp (login removed) — employees is a
      // plain directory row now, no linked auth account / password.
      const { error: empErr } = await sb.from('employees').insert({
        employee_id: empId, full_name: name, role,
        department: dept, phone, is_active: true
      });
      if (empErr) throw empErr;
      toast('เพิ่มผู้ใช้ ' + empId + ' เรียบร้อย', 'success');
    }
    closeUserModal();
    await loadUsers();
  } catch (err) {
    console.error(err);
    toast('บันทึกไม่สำเร็จ: ' + (err.message || err), 'error');
  } finally {
    btn.disabled = false;
  }
}

async function toggleUserActive(id, currentlyActive) {
  const action = currentlyActive ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน';
  if (!confirm(action + 'บัญชีนี้?')) return;
  const { error } = await sb.from('employees').update({ is_active: !currentlyActive }).eq('id', id);
  if (error) { toast('ไม่สำเร็จ: ' + error.message, 'error'); return; }
  toast(action + 'เรียบร้อย', 'success');
  await loadUsers();
}
