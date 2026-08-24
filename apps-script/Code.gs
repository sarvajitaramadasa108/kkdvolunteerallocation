const SPREADSHEET_ID = "19Q1rLf0i9ndcIsDvH6PrIPWCdEfnaCY6DG0qsKhCihg";
const FORM_SHEET = "Form responses 1";
const SERVICE_SHEET = "Service Master";
const ASSIGNMENT_SHEET = "Assignment Map";
const CATEGORIES = ["FOLK", "Congregation", "Employee"];

function doGet(e) { return response_(route_(String(e?.parameter?.action || "registrations.list"), e?.parameter || {})); }
function doPost(e) { try { const body = JSON.parse(e?.postData?.contents || "{}"); return response_(route_(String(body.action || "registrations.list"), body)); } catch (error) { return response_({ ok: false, error: String(error?.message || error) }); } }
function route_(action, payload) {
  try {
    if (action === "registrations.list") return { ok: true, data: listRegistrations_() };
    if (action === "services.list") return { ok: true, data: listServices_() };
    if (action === "status.list") return { ok: true, data: listStatus_() };
    if (action === "registrations.assign") return { ok: true, data: assignRegistration_(payload) };
    if (action === "setup") return { ok: true, data: setup_() };
    return { ok: false, error: "Unknown action: " + action };
  } catch (error) { return { ok: false, error: String(error?.message || error) }; }
}
function response_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }

function listRegistrations_() {
  const sheet = findSheet_(FORM_SHEET); if (!sheet) throw new Error('Sheet "Form responses 1" not found');
  const values = sheet.getDataRange().getDisplayValues(); const map = formMap_(values[0] || []); const assignments = readAssignments_(); const live = []; const assigned = [];
  for (let i = 1; i < values.length; i += 1) { const row = mapRegistration_(values[i], i + 1, map); if (!row.fullName && !row.mobile) continue; const a = assignments[row.responseKey] || assignments[String(row.sourceRow)] || null; const merged = Object.assign({}, row, a || {}, { assigned: Boolean(a?.serviceName && a?.category) }); if (merged.assigned) assigned.push(merged); else live.push(merged); }
  return { live: live, assigned: assigned, syncedAt: new Date().toISOString() };
}

function listServices_() {
  const sheet = findSheet_(SERVICE_SHEET); if (!sheet) return [];
  const values = sheet.getDataRange().getDisplayValues(); if (values.length < 2) return []; const map = serviceMap_(values[0] || []);
  return values.slice(1).map(function(row, i) { return { serviceName: String(row[map.serviceName] || "").trim(), requiredCount: Number(row[5] || 0) || 0, rowNumber: i + 2 }; }).filter(function(row) { return row.serviceName; }).sort(function(a, b) { return a.serviceName.localeCompare(b.serviceName); });
}

function listStatus_() {
  const registrations = listRegistrations_(); const allocated = {};
  registrations.assigned.forEach(function(row) { const name = String(row.serviceName || "").trim(); if (name) allocated[name] = (allocated[name] || 0) + 1; });
  return listServices_().map(function(service) { const allotted = allocated[service.serviceName] || 0; return { serviceName: service.serviceName, requirement: service.requiredCount || 0, allotted: allotted, remaining: Math.max((service.requiredCount || 0) - allotted, 0) }; });
}

function assignRegistration_(payload) {
  const responseKey = String(payload?.responseKey || "").trim(); const sourceRow = String(payload?.sourceRow || "").trim(); const serviceName = String(payload?.serviceName || "").trim(); const category = String(payload?.category || "").trim();
  if (!responseKey || !sourceRow) throw new Error("Registration identifier is missing"); if (!serviceName) throw new Error("Select a service"); if (CATEGORIES.indexOf(category) === -1) throw new Error("Select a valid category"); if (!listServices_().some(function(row) { return row.serviceName === serviceName; })) throw new Error("Select a valid service");
  const sheet = assignmentSheet_(); const values = sheet.getDataRange().getDisplayValues(); let target = -1;
  for (let i = 1; i < values.length; i += 1) if (String(values[i][0] || "").trim() === responseKey || String(values[i][1] || "").trim() === sourceRow) { target = i + 1; break; }
  const row = [responseKey, sourceRow, serviceName, category, new Date().toISOString()]; if (target > 0) sheet.getRange(target, 1, 1, row.length).setValues([row]); else sheet.appendRow(row); return listRegistrations_();
}

function readAssignments_() { const values = assignmentSheet_().getDataRange().getDisplayValues(); const result = {}; values.slice(1).forEach(function(row) { const serviceName = String(row[2] || "").trim(); const category = String(row[3] || "").trim(); if (!serviceName || !category) return; const value = { serviceName: serviceName, category: category }; if (row[0]) result[String(row[0]).trim()] = value; if (row[1]) result[String(row[1]).trim()] = value; }); return result; }

function mapRegistration_(row, sourceRow, map) {
  const timestamp = cell_(row, map.timestamp); const availability = function(index) { return availabilityValue_(cell_(row, index)); };
  return { responseKey: (timestamp || "row") + "::" + sourceRow, sourceRow: sourceRow, fullName: cell_(row, map.fullName), age: cell_(row, map.age), mobile: cell_(row, map.mobile), gender: cell_(row, map.gender), collegeName: cell_(row, map.collegeName), availabilityOn3: availability(map.day3), availabilityOn4: availability(map.day4), availabilityOn5: availability(map.day5) };
}
function cell_(row, index) { return index >= 0 ? String(row[index] || "").trim() : ""; }
function availabilityValue_(value) { return String(value || "").trim() || "Not available"; }

function formMap_(headers) { const normalized = headers.map(normalize_); const find = function(names, fallback) { for (let i = 0; i < normalized.length; i += 1) if (names.some(function(name) { return normalized[i] === normalize_(name); })) return i; return fallback; }; const day = function(dayNumber) { for (let i = 0; i < normalized.length; i += 1) if (normalized[i].includes("service slots") && (normalized[i].includes("0" + dayNumber) || normalized[i].includes(" " + dayNumber) || normalized[i].includes(dayNumber + "th") || normalized[i].includes(dayNumber + "nd") || normalized[i].includes(dayNumber + "rd"))) return i; for (let i = 0; i < normalized.length; i += 1) if (normalized[i].includes("availability on " + dayNumber)) return i; return -1; }; return { timestamp: find(["Timestamp"], 0), fullName: find(["Full Name", "Name"], 1), age: find(["Age"], 2), mobile: find(["Mobile Number", "Mobile Number (WhatsApp Number)", "Mobile"], 3), gender: find(["Gender"], 4), collegeName: find(["College Name", "College"], 3), day2: day(2), day3: day(3), day4: day(4), day5: day(5), day6: day(6) }; }
function serviceMap_(headers) { const normalized = headers.map(normalize_); const index = normalized.findIndex(function(value) { return value === "service name" || value === "service"; }); return { serviceName: index >= 0 ? index : 1 }; }
function normalize_(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function assignmentSheet_() { const ss = SpreadsheetApp.openById(SPREADSHEET_ID); let sheet = findSheet_(ASSIGNMENT_SHEET); if (!sheet) sheet = ss.insertSheet(ASSIGNMENT_SHEET); if (sheet.getLastRow() === 0) sheet.appendRow(["Response Key", "Source Row", "Service Name", "Category", "Updated At"]); return sheet; }
function findSheet_(name) { const ss = SpreadsheetApp.openById(SPREADSHEET_ID); const target = String(name || "").toLowerCase(); return ss.getSheets().find(function(sheet) { return String(sheet.getName() || "").toLowerCase() === target; }) || null; }
function setup_() { if (!findSheet_(FORM_SHEET)) throw new Error('Sheet "Form responses 1" not found'); assignmentSheet_(); return { ready: true }; }
