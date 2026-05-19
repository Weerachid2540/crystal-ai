'use strict';
// ============================================================
// Crystal AI — i18n.js  (Phase-4D-1 extraction)
// i18n system: I18N object + tr/t/applyLang/setLang
// Depends on: utils.js (escapeHtml) — must load after utils.js + toast.js
// Runtime deps: renderQuickBtns, renderWelcome, updateChatInfo,
//               renderDashQuickBtns — resolved at call time (inline script)
// ============================================================

// ============================================================
// 1. i18n SYSTEM (3 modes: mix / th / en)
// ============================================================
const I18N = {
  mix: {
    brand_name: 'Crystal AI', brand_sub: 'Engineering Assistant',
    online: 'ONLINE', offline: 'OFFLINE',
    menu_main: 'เมนูหลัก', menu_doc: 'จัดซื้อ / Documents', menu_personal: 'ส่วนตัว / Personal',
    nav_chat: 'AI Chatbot', nav_daily: 'Report รายวัน', nav_weekly: 'Report รายสัปดาห์', nav_monthly: 'Report รายเดือน', nav_boq: 'จัดซื้อ / BOQ', nav_salary: '💰 เงินเดือน / Salary',
    tab_salary: 'เงินเดือน',
    salary_title: '💰 บันทึกเงินเดือน', salary_desc: 'คลิกที่วันในปฏิทินเพื่อเลือกไซต์ที่ไป — AI คำนวณเงินเดือนให้อัตโนมัติ',
    salary_today: '📅 วันนี้', salary_settings: '⚙️ ตั้งค่า', salary_grand_total: 'รวมสุทธิ / Net Total',
    salary_export: 'Export PDF', salary_clear_month: '🗑 ล้างเดือนนี้',
    salary_sig_title: '✍️ ลายเซ็นผู้รับเงินเดือน / Employee Signature',
    salary_sig_label: 'Signed by Employee',
    salary_sites_q: '📍 ไปที่ไหนวันนี้?', salary_ot_q: '⏰ OT วันนี้?',
    salary_day_clear: '🗑 ล้างวันนี้', btn_save: '💾 บันทึก', btn_cancel: 'ยกเลิก',
    salary_settings_title: '⚙️ ตั้งค่ารายการเงินเดือน', salary_base_label: '💵 เงินเดือนหลัก (Base Salary)',
    salary_sites_label: 'ไซต์งาน / ค่าเดินทาง', salary_otrates_label: 'อัตรา OT',
    salary_extras_label: 'รายได้พิเศษ (auto ทุกเดือน)', salary_deductions_label: 'รายหัก (auto ทุกเดือน)',
    salary_add_site: '+ เพิ่มไซต์', salary_add_otrate: '+ เพิ่มอัตรา OT',
    salary_add_extra: '+ เพิ่มรายได้', salary_add_deduction_item: '+ เพิ่มรายหัก',
    btn_save_settings: '💾 บันทึกตั้งค่า', salary_reset_config: '↻ คืนค่าตัวอย่าง',
    tab_chat: 'AI Chat', tab_daily: 'รายวัน', tab_weekly: 'รายสัปดาห์', tab_monthly: 'รายเดือน',
    clear_chat: '🗑 Clear Chat', generating: 'AI กำลังสร้าง...',
    daily_title: '📋 Daily Report', daily_desc: 'กรอกข้อมูลหน้างาน แล้วให้ AI สร้าง Report ให้อัตโนมัติ',
    weekly_title: '📅 Weekly Report', weekly_desc: 'สรุป Progress และผลงานรายสัปดาห์',
    monthly_title: '📊 Monthly Report', monthly_desc: 'สรุปภาพรวม Project ประจำเดือน',
    boq_title: 'จัดซื้อ / BOQ', boq_desc: 'สร้างเอกสารจัดซื้อและ Bill of Quantities',
    vo_desc: 'สร้างเอกสาร VO / Change Order สำหรับงานเพิ่ม-ลด',
    basic_info: 'ข้อมูลพื้นฐาน / Basic Info', work_today: 'งานที่ดำเนินการวันนี้',
    issue_plan: 'ปัญหา & Plan', progress: 'Progress', summary: 'สรุปผลงาน',
    photos_title: '📸 รูปภาพหน้างาน', photos_upload: 'คลิกหรือลากรูปมาวางที่นี่', photos_hint: 'JPG / PNG / WebP — สูงสุด 20 รูป',
    report_info: '📋 ข้อมูล Report', lbl_report_no: 'Report No.', lbl_dept: 'Department', lbl_worktype: 'Work Type',
    lbl_workdesc: 'Work Description', lbl_proj_code: 'Project Code', lbl_period_from: 'Period from', lbl_period_to: 'Period to',
    lbl_approver: 'Approved by',
    sec1_week: '1. งาน Week นี้ / This Week Activities', sec1_month: '1. งานเดือนนี้ / This Month Activities',
    sec2_issues: '2. ปัญหาและ Issue สำคัญ', sec3_next_week: '3. Plan สัปดาห์หน้า / Next Week',
    sec3_next_month: '3. Plan เดือนหน้า / Next Month', sec4_targets: '4. เป้าหมายสำคัญ / Important Targets',
    th_desc: 'รายการงาน / Description', th_issue: 'ปัญหา / Issue', th_target: 'เป้าหมาย / Target', btn_add_row: '+ เพิ่มแถว',
    signatures: '✍️ ลายเซ็น / Signatures', sig_reporter: 'Reported by', sig_approver: 'Approved by',
    sig_clear: '🗑 ล้าง', sig_hint: 'เซ็นที่นี่', sig_role_reporter: 'Civil Engineer', sig_role_approver: 'Managing Director',
    doc_type: 'ประเภทเอกสาร', doc_info: 'ข้อมูลเอกสาร', material_list: 'รายการวัสดุ / งาน',
    vo_info: 'ข้อมูล VO', detail: 'รายละเอียด',
    lbl_project: 'ชื่อ Project', lbl_date: 'วันที่', lbl_reporter: 'ผู้รายงาน', lbl_weather: 'สภาพอากาศ',
    lbl_struct: 'งาน Structural', lbl_arch: 'งาน Architectural', lbl_mep: 'งาน MEP (Electrical/Plumbing/HVAC)',
    lbl_issue: 'ปัญหา / อุปสรรค', lbl_plan_tom: 'Plan พรุ่งนี้',
    lbl_week: 'Week / ช่วงวันที่', lbl_plan_pct: 'Plan สัปดาห์นี้ (%)', lbl_actual_pct: 'Actual (%)',
    lbl_done_week: 'งานที่เสร็จสัปดาห์นี้', lbl_problem: 'ปัญหาและการแก้ไข', lbl_plan_next_w: 'Plan สัปดาห์หน้า',
    lbl_month: 'Month / ปี', lbl_plan_cum: 'Plan สะสม (%)', lbl_actual_cum: 'Actual สะสม (%)',
    lbl_done_month: 'งานหลักที่เสร็จเดือนนี้', lbl_issue_main: 'ปัญหาสำคัญและการแก้ไข', lbl_plan_next_m: 'Plan เดือนหน้า',
    lbl_category: 'หมวดงาน', lbl_detail: 'รายละเอียดเพิ่มเติม',
    lbl_vo_no: 'เลขที่ VO', lbl_vo_type: 'ประเภท', lbl_vo_orig: 'งานเดิม (ตาม Contract)', lbl_vo_change: 'งานที่เปลี่ยนแปลง', lbl_vo_impact: 'Impact (ค่าใช้จ่าย / เวลา)',
    btn_generate: 'Generate Report', btn_gen_doc: 'Generate เอกสาร', btn_gen_vo: 'Generate VO',
    btn_copy: 'คัดลอก', btn_regen: '↻ สร้างใหม่', btn_export: '💾 Export .txt', btn_print: '🖨 Print',
    btn_save: 'บันทึก', btn_cancel: 'ยกเลิก',
    th_item: 'รายการ', th_qty: 'จำนวน', th_unit: 'หน่วย', th_price: 'ราคา/หน่วย', th_total: 'รวม (บาท)',
    add_row: 'เพิ่มรายการ', clear_all: '🗑 ล้างทั้งหมด', clear_form: '🗑 ล้างฟอร์ม',
    grand_total: 'รวมทั้งหมด', baht: 'บาท',
    doc_po: 'ใบสั่งซื้อ', doc_quote: 'ใบเสนอราคา',
    err_required: 'กรุณากรอกข้อมูลที่จำเป็น',
    settings_title: 'API Settings', provider: 'AI Provider',
    key_safe: 'API Key เก็บใน browser ของคุณ (localStorage) และส่งโดยตรงไปยัง AI Provider ที่เลือกเท่านั้น — เหมาะกับใช้ส่วนตัว ไม่เหมาะกับเครื่อง public',
    msg_count: '{n} messages', placeholder_chat: 'พิมพ์ข้อความ หรือบอกสิ่งที่ต้องการ... (Enter ส่ง / Shift+Enter ขึ้นบรรทัด)',
    no_key: '❌ กรุณาตั้งค่า API Key ก่อน — กดไอคอน ⚙ ที่มุมขวาบน',
    saved: '💾 saved', draft_loaded: '📂 โหลด draft แล้ว', busy: '⏳ กรุณารอคำตอบก่อนหน้าให้เสร็จ',
    reset_title: 'Privacy / Reset',
    reset_drafts: '🗑 ลบ Drafts ทั้งหมด', reset_chat: '🗑 ลบ Chat History', reset_all: '⚠️ Reset ทั้งหมด (รวม API Keys)',
    confirm_clear_chat: 'ล้างประวัติแชททั้งหมด?', confirm_clear_boq: 'ล้างรายการ BOQ ทั้งหมด?', confirm_clear_form: 'ล้างฟอร์มและ draft ใน panel นี้?',
    confirm_reset_drafts: 'ลบ draft ทุก form? (Settings และ Chat ไม่ลบ)', confirm_reset_chat: 'ลบประวัติแชททั้งหมด?',
    confirm_reset_all: '⚠️ ลบทุกอย่าง — API Keys, Drafts, Chat, BOQ, Settings? (ไม่สามารถกู้คืนได้)',
    sys_prompt: 'You are an AI assistant for Crystal Engineering Corporation field engineers. Reply in mixed Thai-English style: use Thai for general communication but keep technical/engineering terms in English (e.g., Report, BOQ, MEP, Structural, Progress, Variance, Schedule, Material, etc.). Be clear, concise, and professional.',
    qbtns: [
      ['📋 Report รายวัน', 'ช่วยเขียน Daily Report หน่วยงาน'],
      ['⚡ BOQ Electrical', 'ช่วยทำ BOQ สำหรับงาน Electrical'],
      ['📝 VO งานเพิ่ม', 'ช่วยร่าง Variation Order งานเพิ่ม'],
      ['⚠️ หนังสือเตือน', 'ช่วยทำหนังสือเตือน Subcontractor ที่ทำงานล่าช้า'],
      ['📊 สรุป Progress', 'ช่วยสรุป Progress งานสัปดาห์นี้แบบสั้นกระชับ'],
      ['🗒️ MOM', 'ช่วยร่าง Minutes of Meeting หน่วยงาน']
    ],
    // FIXED v5.1: Welcome message — BUG-1
    welcome: `สวัสดีครับ! ผมคือ <strong>Crystal AI Assistant 🏗️</strong><br><br>ผมช่วยได้เรื่อง:<ul><li>เขียน Daily / Weekly / Monthly Report</li><li>ทำ BOQ, Quotation, Variation Order</li><li>ตอบคำถามงาน Construction, MEP, Structural</li><li>ร่างหนังสือ, MOM, Warning Letter</li></ul>พิมพ์ถามได้เลย หรือเลือกจากปุ่มด้านล่าง 👇`
  },
  th: {
    brand_name: 'Crystal AI', brand_sub: 'ผู้ช่วยวิศวกร',
    online: 'ออนไลน์', offline: 'ออฟไลน์',
    menu_main: 'เมนูหลัก', menu_doc: 'จัดซื้อ / เอกสาร', menu_personal: 'ส่วนตัว',
    nav_chat: 'แชท AI', nav_daily: 'รายงานรายวัน', nav_weekly: 'รายงานรายสัปดาห์', nav_monthly: 'รายงานรายเดือน', nav_boq: 'จัดซื้อ / รายการวัสดุ', nav_salary: '💰 เงินเดือน',
    tab_salary: 'เงินเดือน',
    salary_title: '💰 บันทึกเงินเดือน', salary_desc: 'คลิกที่วันในปฏิทินเพื่อเลือกไซต์ที่ไป AI จะคำนวณเงินเดือนให้อัตโนมัติ',
    salary_today: '📅 วันนี้', salary_settings: '⚙️ ตั้งค่า', salary_grand_total: 'รวมสุทธิ',
    salary_export: 'ส่งออก PDF', salary_clear_month: '🗑 ล้างเดือนนี้',
    salary_sig_title: '✍️ ลายเซ็นผู้รับเงินเดือน',
    salary_sig_label: 'ผู้รับเงินเดือน',
    salary_sites_q: '📍 ไปที่ไหนวันนี้?', salary_ot_q: '⏰ OT วันนี้?',
    salary_day_clear: '🗑 ล้างวันนี้', btn_save: '💾 บันทึก', btn_cancel: 'ยกเลิก',
    salary_settings_title: '⚙️ ตั้งค่ารายการเงินเดือน', salary_base_label: '💵 เงินเดือนหลัก',
    salary_sites_label: 'ไซต์งาน / ค่าเดินทาง', salary_otrates_label: 'อัตรา OT',
    salary_extras_label: 'รายได้พิเศษ (อัตโนมัติทุกเดือน)', salary_deductions_label: 'รายหัก (อัตโนมัติทุกเดือน)',
    salary_add_site: '+ เพิ่มไซต์', salary_add_otrate: '+ เพิ่มอัตรา OT',
    salary_add_extra: '+ เพิ่มรายได้', salary_add_deduction_item: '+ เพิ่มรายหัก',
    btn_save_settings: '💾 บันทึกตั้งค่า', salary_reset_config: '↻ คืนค่าตัวอย่าง',
    tab_chat: 'แชท AI', tab_daily: 'รายวัน', tab_weekly: 'รายสัปดาห์', tab_monthly: 'รายเดือน',
    clear_chat: '🗑 ล้างประวัติแชท', generating: 'AI กำลังสร้าง...',
    daily_title: '📋 รายงานรายวัน', daily_desc: 'กรอกข้อมูลหน้างาน แล้วให้ AI สร้างรายงานให้อัตโนมัติ',
    weekly_title: '📅 รายงานรายสัปดาห์', weekly_desc: 'สรุปความคืบหน้าและผลงานรายสัปดาห์',
    monthly_title: '📊 รายงานรายเดือน', monthly_desc: 'สรุปภาพรวมโครงการประจำเดือน',
    boq_title: 'จัดซื้อ / รายการวัสดุ', boq_desc: 'สร้างเอกสารจัดซื้อและรายการวัสดุ',
    vo_desc: 'สร้างเอกสารคำสั่งเปลี่ยนแปลงสำหรับงานเพิ่ม-ลด',
    basic_info: 'ข้อมูลพื้นฐาน', work_today: 'งานที่ดำเนินการวันนี้',
    issue_plan: 'ปัญหาและแผนงาน', progress: 'ความคืบหน้า', summary: 'สรุปผลงาน',
    photos_title: '📸 รูปภาพหน้างาน', photos_upload: 'คลิกหรือลากรูปมาวางที่นี่', photos_hint: 'JPG / PNG / WebP — สูงสุด 20 รูป',
    report_info: '📋 ข้อมูลรายงาน', lbl_report_no: 'เลขที่รายงาน', lbl_dept: 'แผนก', lbl_worktype: 'ประเภทงาน',
    lbl_workdesc: 'รายละเอียดงาน', lbl_proj_code: 'รหัสโครงการ', lbl_period_from: 'ตั้งแต่วันที่', lbl_period_to: 'ถึงวันที่',
    lbl_approver: 'ผู้อนุมัติ',
    sec1_week: '1. งานที่ทำสัปดาห์นี้', sec1_month: '1. งานที่ทำเดือนนี้',
    sec2_issues: '2. ปัญหาและประเด็นสำคัญ', sec3_next_week: '3. แผนงานสัปดาห์หน้า',
    sec3_next_month: '3. แผนงานเดือนหน้า', sec4_targets: '4. เป้าหมายสำคัญที่ต้องเร่ง',
    th_desc: 'รายการงาน', th_issue: 'รายละเอียดปัญหา', th_target: 'เป้าหมายที่ต้องเร่ง', btn_add_row: '+ เพิ่มแถว',
    signatures: '✍️ ลายเซ็น', sig_reporter: 'ผู้รายงาน', sig_approver: 'ผู้อนุมัติ',
    sig_clear: '🗑 ล้าง', sig_hint: 'เซ็นที่นี่', sig_role_reporter: 'วิศวกรโยธา', sig_role_approver: 'กรรมการผู้จัดการ',
    doc_type: 'ประเภทเอกสาร', doc_info: 'ข้อมูลเอกสาร', material_list: 'รายการวัสดุ / งาน',
    vo_info: 'ข้อมูลคำสั่งเปลี่ยนแปลง', detail: 'รายละเอียด',
    lbl_project: 'ชื่อโครงการ', lbl_date: 'วันที่', lbl_reporter: 'ผู้รายงาน', lbl_weather: 'สภาพอากาศ',
    lbl_struct: 'งานโครงสร้าง', lbl_arch: 'งานสถาปัตยกรรม', lbl_mep: 'งานระบบ (ไฟฟ้า/ประปา/ปรับอากาศ)',
    lbl_issue: 'ปัญหา / อุปสรรค', lbl_plan_tom: 'แผนงานพรุ่งนี้',
    lbl_week: 'สัปดาห์ที่ / ช่วงวันที่', lbl_plan_pct: 'แผนงานสัปดาห์นี้ (%)', lbl_actual_pct: 'ผลงานจริง (%)',
    lbl_done_week: 'งานที่เสร็จสัปดาห์นี้', lbl_problem: 'ปัญหาและการแก้ไข', lbl_plan_next_w: 'แผนสัปดาห์หน้า',
    lbl_month: 'เดือน / ปี', lbl_plan_cum: 'แผนงานสะสม (%)', lbl_actual_cum: 'ผลงานสะสม (%)',
    lbl_done_month: 'งานหลักที่เสร็จเดือนนี้', lbl_issue_main: 'ปัญหาสำคัญและการแก้ไข', lbl_plan_next_m: 'แผนเดือนหน้า',
    lbl_category: 'หมวดงาน', lbl_detail: 'รายละเอียดเพิ่มเติม',
    lbl_vo_no: 'เลขที่เอกสาร', lbl_vo_type: 'ประเภท', lbl_vo_orig: 'งานเดิม (ตามสัญญา)', lbl_vo_change: 'งานที่เปลี่ยนแปลง', lbl_vo_impact: 'ผลกระทบ (ค่าใช้จ่าย / เวลา)',
    btn_generate: 'สร้างรายงาน', btn_gen_doc: 'สร้างเอกสาร', btn_gen_vo: 'สร้างเอกสารคำสั่งเปลี่ยนแปลง',
    btn_copy: 'คัดลอก', btn_regen: '↻ สร้างใหม่', btn_export: '💾 บันทึกเป็นไฟล์', btn_print: '🖨 พิมพ์',
    btn_save: 'บันทึก', btn_cancel: 'ยกเลิก',
    th_item: 'รายการ', th_qty: 'จำนวน', th_unit: 'หน่วย', th_price: 'ราคา/หน่วย', th_total: 'รวม (บาท)',
    add_row: 'เพิ่มรายการ', clear_all: '🗑 ล้างทั้งหมด', clear_form: '🗑 ล้างฟอร์ม',
    grand_total: 'รวมทั้งหมด', baht: 'บาท',
    doc_po: 'ใบสั่งซื้อ', doc_quote: 'ใบเสนอราคา',
    err_required: 'กรุณากรอกข้อมูลที่จำเป็น',
    settings_title: 'ตั้งค่ารหัสเชื่อมต่อ AI', provider: 'ผู้ให้บริการ AI',
    key_safe: 'รหัสเก็บในเบราว์เซอร์ของคุณ (localStorage) และส่งโดยตรงไปยังผู้ให้บริการ AI ที่เลือกเท่านั้น — เหมาะกับใช้ส่วนตัว ไม่เหมาะกับเครื่องสาธารณะ',
    msg_count: '{n} ข้อความ', placeholder_chat: 'พิมพ์ข้อความ หรือบอกสิ่งที่ต้องการ... (Enter ส่ง / Shift+Enter ขึ้นบรรทัด)',
    no_key: '❌ กรุณาตั้งค่ารหัสเชื่อมต่อก่อน — กดไอคอน ⚙ ที่มุมขวาบน',
    saved: '💾 บันทึกแล้ว', draft_loaded: '📂 โหลดข้อมูลที่บันทึกไว้แล้ว', busy: '⏳ กรุณารอคำตอบก่อนหน้าให้เสร็จ',
    reset_title: 'ความเป็นส่วนตัว / ล้างข้อมูล',
    reset_drafts: '🗑 ลบข้อมูลที่บันทึกไว้ทั้งหมด', reset_chat: '🗑 ลบประวัติแชท', reset_all: '⚠️ ล้างทั้งหมด (รวมรหัสเชื่อมต่อ)',
    confirm_clear_chat: 'ล้างประวัติแชททั้งหมด?', confirm_clear_boq: 'ล้างรายการทั้งหมด?', confirm_clear_form: 'ล้างฟอร์มและข้อมูลที่บันทึกไว้ใน panel นี้?',
    confirm_reset_drafts: 'ลบข้อมูลที่บันทึกไว้ทุกฟอร์ม? (รหัสและประวัติแชทไม่ลบ)', confirm_reset_chat: 'ลบประวัติแชททั้งหมด?',
    confirm_reset_all: '⚠️ ลบทุกอย่าง — รหัสเชื่อมต่อ ข้อมูลฟอร์ม ประวัติแชท รายการ BOQ การตั้งค่า? (ไม่สามารถกู้คืนได้)',
    sys_prompt: 'คุณคือผู้ช่วย AI ของวิศวกรสนามบริษัท Crystal Engineering Corporation ตอบเป็นภาษาไทยล้วนทั้งหมด ใช้ภาษาทางการ ชัดเจน กระชับ เหมาะสำหรับงานก่อสร้างและวิศวกรรม หลีกเลี่ยงคำทับศัพท์ภาษาอังกฤษเท่าที่ทำได้',
    qbtns: [
      ['📋 รายงานรายวัน', 'ช่วยเขียนรายงานรายวันหน่วยงาน'],
      ['⚡ รายการวัสดุไฟฟ้า', 'ช่วยทำรายการวัสดุสำหรับงานไฟฟ้า'],
      ['📝 คำสั่งเปลี่ยนแปลง', 'ช่วยร่างคำสั่งเปลี่ยนแปลงงานเพิ่ม'],
      ['⚠️ หนังสือเตือน', 'ช่วยทำหนังสือเตือนผู้รับเหมาช่วงที่ทำงานล่าช้า'],
      ['📊 สรุปความคืบหน้า', 'ช่วยสรุปความคืบหน้างานสัปดาห์นี้แบบสั้นกระชับ'],
      ['🗒️ บันทึกประชุม', 'ช่วยร่างบันทึกการประชุมหน่วยงาน']
    ],
    // FIXED v5.1: Welcome message — BUG-1
    welcome: `สวัสดีครับ! ผมคือ <strong>Crystal AI Assistant 🏗️</strong><br><br>ผมช่วยได้เรื่อง:<ul><li>เขียนรายงานรายวัน / รายสัปดาห์ / รายเดือน</li><li>ทำรายการวัสดุ ใบเสนอราคา คำสั่งเปลี่ยนแปลง</li><li>ตอบคำถามงานก่อสร้าง งานระบบ งานโครงสร้าง</li><li>ร่างหนังสือ บันทึกประชุม หนังสือเตือน</li></ul>พิมพ์ถามได้เลย หรือเลือกจากปุ่มด้านล่าง 👇`
  },
  en: {
    brand_name: 'Crystal AI', brand_sub: 'Engineering Assistant',
    online: 'ONLINE', offline: 'OFFLINE',
    menu_main: 'MAIN MENU', menu_doc: 'PROCUREMENT / DOCS', menu_personal: 'PERSONAL',
    nav_salary: '💰 Salary',
    tab_salary: 'Salary',
    salary_title: '💰 Salary Tracker', salary_desc: 'Click a date in the calendar to log site visits — AI computes everything else',
    salary_today: '📅 Today', salary_settings: '⚙️ Settings', salary_grand_total: 'Net Total',
    salary_export: 'Export PDF', salary_clear_month: '🗑 Clear month',
    salary_sig_title: '✍️ Employee Signature',
    salary_sig_label: 'Signed by Employee',
    salary_sites_q: '📍 Where did you go today?', salary_ot_q: '⏰ Any OT today?',
    salary_day_clear: '🗑 Clear day', btn_save: '💾 Save', btn_cancel: 'Cancel',
    salary_settings_title: '⚙️ Salary Settings', salary_base_label: '💵 Base Salary',
    salary_sites_label: 'Sites / Travel allowance', salary_otrates_label: 'OT rates',
    salary_extras_label: 'Extra income (auto every month)', salary_deductions_label: 'Deductions (auto every month)',
    salary_add_site: '+ Add site', salary_add_otrate: '+ Add OT rate',
    salary_add_extra: '+ Add income', salary_add_deduction_item: '+ Add deduction',
    btn_save_settings: '💾 Save settings', salary_reset_config: '↻ Reset to example',
    nav_chat: 'AI Chatbot', nav_daily: 'Daily Report', nav_weekly: 'Weekly Report', nav_monthly: 'Monthly Report', nav_boq: 'Procurement / BOQ',
    tab_chat: 'AI Chat', tab_daily: 'Daily', tab_weekly: 'Weekly', tab_monthly: 'Monthly',
    clear_chat: '🗑 Clear Chat', generating: 'AI is generating...',
    daily_title: '📋 Daily Report', daily_desc: 'Fill site info and let AI generate the report automatically',
    weekly_title: '📅 Weekly Report', weekly_desc: 'Summarize weekly progress and achievements',
    monthly_title: '📊 Monthly Report', monthly_desc: 'Project overview for the month',
    boq_title: 'Procurement / BOQ', boq_desc: 'Generate procurement documents and Bill of Quantities',
    vo_desc: 'Generate Variation Order / Change Order for additional or omitted work',
    basic_info: 'Basic Information', work_today: "Today's Work",
    issue_plan: 'Issues & Plan', progress: 'Progress', summary: 'Summary',
    photos_title: '📸 Site Photos', photos_upload: 'Click or drag photos here', photos_hint: 'JPG / PNG / WebP — up to 20 photos',
    report_info: '📋 Report Info', lbl_report_no: 'Report No.', lbl_dept: 'Department', lbl_worktype: 'Work Type',
    lbl_workdesc: 'Work Description', lbl_proj_code: 'Project Code', lbl_period_from: 'Period from', lbl_period_to: 'Period to',
    lbl_approver: 'Approved by',
    sec1_week: '1. This Week Activities', sec1_month: '1. This Month Activities',
    sec2_issues: '2. Major Issues & Outstanding', sec3_next_week: '3. Next Week Activities',
    sec3_next_month: '3. Next Month Activities', sec4_targets: '4. Current Important Targets',
    th_desc: 'Description', th_issue: 'Issue', th_target: 'Target', btn_add_row: '+ Add Row',
    signatures: '✍️ Signatures', sig_reporter: 'Reported by', sig_approver: 'Approved by',
    sig_clear: '🗑 Clear', sig_hint: 'Sign here', sig_role_reporter: 'Civil Engineer', sig_role_approver: 'Managing Director',
    doc_type: 'Document Type', doc_info: 'Document Info', material_list: 'Materials / Work Items',
    vo_info: 'VO Information', detail: 'Details',
    lbl_project: 'Project Name', lbl_date: 'Date', lbl_reporter: 'Reporter', lbl_weather: 'Weather',
    lbl_struct: 'Structural Work', lbl_arch: 'Architectural Work', lbl_mep: 'MEP Work (Electrical/Plumbing/HVAC)',
    lbl_issue: 'Issues / Obstacles', lbl_plan_tom: "Tomorrow's Plan",
    lbl_week: 'Week / Date Range', lbl_plan_pct: 'This Week Plan (%)', lbl_actual_pct: 'Actual (%)',
    lbl_done_week: 'Completed This Week', lbl_problem: 'Problems & Solutions', lbl_plan_next_w: 'Next Week Plan',
    lbl_month: 'Month / Year', lbl_plan_cum: 'Cumulative Plan (%)', lbl_actual_cum: 'Cumulative Actual (%)',
    lbl_done_month: 'Main Work Completed This Month', lbl_issue_main: 'Major Issues & Solutions', lbl_plan_next_m: 'Next Month Plan',
    lbl_category: 'Category', lbl_detail: 'Additional Details',
    lbl_vo_no: 'VO Number', lbl_vo_type: 'Type', lbl_vo_orig: 'Original Scope (per Contract)', lbl_vo_change: 'Changed Scope', lbl_vo_impact: 'Impact (Cost / Time)',
    btn_generate: 'Generate Report', btn_gen_doc: 'Generate Document', btn_gen_vo: 'Generate VO',
    btn_copy: 'Copy', btn_regen: '↻ Regenerate', btn_export: '💾 Export .txt', btn_print: '🖨 Print',
    btn_save: 'Save', btn_cancel: 'Cancel',
    th_item: 'Item', th_qty: 'Qty', th_unit: 'Unit', th_price: 'Unit Price', th_total: 'Total (THB)',
    add_row: 'Add Row', clear_all: '🗑 Clear All', clear_form: '🗑 Clear Form',
    grand_total: 'Grand Total', baht: 'THB',
    doc_po: 'Purchase Order', doc_quote: 'Quotation',
    err_required: 'This field is required',
    settings_title: 'API Settings', provider: 'AI Provider',
    key_safe: 'API Key is stored in your browser only (localStorage) and sent directly to the selected AI Provider — suitable for personal use, not recommended on public devices',
    msg_count: '{n} messages', placeholder_chat: 'Type your message... (Enter to send / Shift+Enter for new line)',
    no_key: '❌ Please configure API Key first — click ⚙ icon at top right',
    saved: '💾 saved', draft_loaded: '📂 Draft restored', busy: '⏳ Please wait for the current response',
    reset_title: 'Privacy / Reset',
    reset_drafts: '🗑 Delete all drafts', reset_chat: '🗑 Clear chat history', reset_all: '⚠️ Reset everything (incl. API Keys)',
    confirm_clear_chat: 'Clear all chat history?', confirm_clear_boq: 'Clear all rows?', confirm_clear_form: 'Clear form and saved draft for this panel?',
    confirm_reset_drafts: 'Delete all form drafts? (Settings and chat history will be kept)', confirm_reset_chat: 'Delete all chat history?',
    confirm_reset_all: '⚠️ Delete everything — API Keys, drafts, chat, BOQ, settings? (Cannot be undone)',
    sys_prompt: 'You are an AI assistant for Crystal Engineering Corporation field engineers. Reply in clear, concise, professional English suitable for construction and engineering work.',
    qbtns: [
      ['📋 Daily Report', 'Help me write a daily site report'],
      ['⚡ Electrical BOQ', 'Help me make a BOQ for electrical work'],
      ['📝 VO Addition', 'Help draft a Variation Order for additional work'],
      ['⚠️ Warning Letter', 'Help draft a warning letter to a subcontractor for delays'],
      ['📊 Progress Summary', "Briefly summarize this week's progress"],
      ['🗒️ MOM', 'Help draft Minutes of Meeting']
    ],
    // FIXED v5.1: Welcome message — BUG-1
    welcome: `Hello! I am <strong>Crystal AI Assistant 🏗️</strong><br><br>I can help with:<ul><li>Writing Daily / Weekly / Monthly Reports</li><li>Creating BOQ, Quotations, Variation Orders</li><li>Construction, MEP, Structural questions</li><li>Drafting letters, MOMs, warning letters</li></ul>Type your question or pick a quick option below 👇`
  }
};

// FIXED #4: validate currentLang against known values
const _storedLang = localStorage.getItem('crystal_lang');
let currentLang = (I18N[_storedLang]) ? _storedLang : 'th';

function tr(key) { return I18N[currentLang][key] || I18N.mix[key] || key; }
// alias: many existing calls use t() — keep both, but tr() is the canonical now to avoid shadowing
const t = tr;

function applyLang() {
  document.documentElement.lang = currentLang === 'en' ? 'en' : 'th';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = tr(key);
    if (typeof val === 'string') el.textContent = val;
  });
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === currentLang));
  const ci = document.getElementById('chatInput');
  if (ci) ci.placeholder = tr('placeholder_chat');
  renderQuickBtns();
  if (chatHistory.length === 0) renderWelcome();
  updateChatInfo();
  try { renderDashQuickBtns && renderDashQuickBtns(); } catch (e) {}
}

function setLang(lang) {
  if (!I18N[lang]) lang = 'mix';
  currentLang = lang;
  localStorage.setItem('crystal_lang', lang);
  applyLang();
}
