// ═══════════════════════════════════════════════════════════════════════════════
//  VAN SOEST LIVING — UNIFIED APPS SCRIPT  v2.3
//  Dynamic product allocation · Delivery-date emails/WhatsApp · n8n webhooks
//  DPD small products · Stofstaal export · Clear allocation status display
//
//  NEW IN v2.3  (fixes three bugs from v2.2):
//    • FIXED: ScriptApp.getProjectTriggers permission error in doPost.
//      Allocation now runs DIRECTLY inside the stock-update request instead of
//      using a deferred one-shot trigger. No scriptapp scope needed.
//    • FIXED: n8n retries tripling stock.
//      doPost no longer returns success:false when stock is written, so n8n
//      will not retry. Additionally, include a unique `requestId` field in
//      the n8n payload (e.g. {{$now}} or a UUID) and the script will silently
//      skip any duplicate delivery of the same request.
//    • FIXED: Allocation + email sequence not firing.
//      With the two bugs above resolved the full chain works automatically:
//      stock update → allocate orders → VERWERKT=YES → Email 1 sent.
//
//  HOW AUTO-FLOW WORKS:
//    n8n POST (type=stock/return) → write B (Allocation Received) only
//    Hourly checkFollowUps → scanAndAllocatePending (reads B−C) → runAllocation
//      → VERWERKT=YES → catchUpDeliveryRequests → Email 1 sent
//    Manual triggers (col F "Run", col R "Send", col U "Send") still work.
//
//  TRIGGERS (use menu "Install / Reset Triggers" or run setupTriggers):
//    1. onEdit / onEditInstallable — spreadsheet
//    2. checkFollowUps — time-based, every 1 hour (all days; emails/WA included)
//    3. runDailyJobs — daily 08:00 Amsterdam (export, DPD sweep, hide rows)
//    NOTE: runDeferredAllocations trigger from v2.2 is no longer used.
//          You can safely delete it if it still exists in your project.
//
//  SHEETS:
//    Orders sheet GID  : 573303195
//    Action sheet GID  : 955736256
//    Stofstaal sheet   : set STOFSTAAL_GID below
// ═══════════════════════════════════════════════════════════════════════════════


// ─── SHEET GIDs ───────────────────────────────────────────────────────────────
var ORDERS_GID    = 573303195;
var ACTION_GID    = 955736256;
var STOFSTAAL_GID = 16480578;

var ACTION_DATA_ROW = 3;  // first row with real product data in ACTION sheet


// ─── ORDERS SHEET — COLUMN MAP ────────────────────────────────────────────────
var OC = {
  ORDER_ID      : 1,   // A
  EMAIL         : 2,   // B
  QTY           : 3,   // C
  PRODUCT       : 4,   // D
  BILLING_NAME  : 5,   // E
  BILLING_PHONE : 6,   // F
  SHIP_NAME     : 7,   // G
  SHIP_PHONE    : 8,   // H  ← WhatsApp
  SHIP_STREET   : 9,   // I
  SHIP_ADDR1    : 10,  // J
  SHIP_CITY     : 11,  // K
  SHIP_ZIP      : 12,  // L
  SHIP_COUNTRY  : 13,  // M  ← country-code detection
  VERWERKT      : 14,  // N  "YES" when ALL line items fully allocated
  ALLOC_STATUS  : 15,  // O  "Rosalie: 4 ✅ | Jordan: 2 ⏳"
  ALLOC_DATA    : 16,  // P  JSON  {"Eetkamerstoel Rosalie":4}
  BATCH_DATE    : 17,  // Q
  EMAIL_TRIGGER : 18,  // R  "Send" → Email 1
  SENT_LOG      : 19,  // S
  PREF_DATE     : 20,  // T
  WA_TRIGGER    : 21,  // U  "Send" → WA1
};


// ─── ACTION SHEET — COLUMN MAP ────────────────────────────────────────────────
var AC = {
  PRODUCT   : 1,  // A
  STOCK     : 2,  // B
  ALLOCATED : 3,  // C  auto-computed
  AVAILABLE : 4,  // D  =MAX(0,B-C)
  IS_DPD    : 5,  // E  "DPD"
  TRIGGER   : 6,  // F  "Run"
  RESULT    : 7,  // G
  TIMESTAMP : 8,  // H
  BATCH     : 9,  // I
};


// ─── GLOBAL CONFIG ────────────────────────────────────────────────────────────
var CFG = {
  BASE_URL              : 'https://app.vansoestliving.nl',
  SENDER_NAME           : 'Van Soest Living',
  SUBJECT_EMAIL1        : 'Kies uw bezorgdatum \u2013 Bestelling #{{ORDER}}',
  SUBJECT_EMAIL2        : 'Herinnering: Kies uw bezorgdatum \u2013 Bestelling #{{ORDER}}',
  WA_WEBHOOK_URL        : 'https://n8n.vansoestliving.com/webhook/5724d4cb-4833-4799-b47a-15c90c28ca42',
  N8N_STOCK_SECRET      : 'vsl-stock-2025',
  FULFILLMENT_EMAIL     : 'logistics@micodo.nl',
  STOFSTAAL_EMAIL       : 'logistics@micodo.nl',
  HOURS_BEFORE_REMINDER : 24,
  HOURS_BEFORE_WA2      : 24,
  HOURS_BEFORE_CALL     : 24,
  /** If n8n sends more than this many line items in one POST, stock is still
   *  written but per-item auto-allocate is skipped (avoids 5–6 min HTTP timeout).
   *  Hourly scan + allocate picks up remaining work using sheet state. */
  MAX_STOCK_ITEMS_SYNC_ALLOC : 20,
};


// ═══════════════════════════════════════════════════════════════════════════════
//  SHEET HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getSheetByGid(ss, gid) {
  var sheets = (ss || SpreadsheetApp.getActiveSpreadsheet()).getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === gid) return sheets[i];
  }
  return null;
}

function getOrdersSheet(ss) { return getSheetByGid(ss, ORDERS_GID); }
function getActionSheet(ss)  { return getSheetByGid(ss, ACTION_GID); }

function getDataStartRow(sheet, col) {
  col = col || 1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var vals = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0] || '').trim() !== '') return i + 2;
  }
  return null;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function cleanOrderId(raw) {
  return raw ? String(raw).replace(/[^0-9]/g, '') : '';
}

/** Lowercase + trim; supports "Name <a@b.com>" from mail clients. */
function normalizeEmailForMatch(raw) {
  var s = String(raw || '').trim();
  if (!s) return '';
  var m = s.match(/<([^>]+@[^>]+)>/i);
  if (m) s = m[1];
  return s.toLowerCase().trim();
}

function nowStamp() {
  return Utilities.formatDate(new Date(), 'Europe/Amsterdam', 'dd-MM-yyyy HH:mm');
}


// ═══════════════════════════════════════════════════════════════════════════════
//  PARSERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Shopify / Excel often use en-dash (U+2013) or em-dash (U+2014) instead of hyphen. */
function normalizeProductSeparators(str) {
  return String(str || '')
    .replace(/\u2013|\u2014/g, '-')  // – —
    .trim();
}

function parseList(str) {
  str = normalizeProductSeparators(str);
  if (!str) return [];
  var parts;
  if (str.indexOf(',') !== -1) {
    parts = str.split(',');
  } else if (/ - /.test(str)) {
    parts = str.split(' - ');
  } else {
    return [str.trim()];
  }
  return parts.map(function(s) { return s.trim(); }).filter(Boolean);
}

function parseQuantities(str) {
  str = normalizeProductSeparators(str);
  if (!str) return [];
  var split;
  if (/[,;]/.test(str)) {
    split = str.split(/[,;]/);
  } else if (/\d\s*-\s*\d/.test(str)) {
    split = str.split(/\s*-\s*/);
  } else {
    var v = parseInt(str.replace(/\./g, ''), 10);
    return (!isNaN(v) && v > 0) ? [v] : [];
  }
  return split.map(function(q) { return parseInt(q.trim().replace(/\./g, ''), 10); })
              .filter(function(q) { return !isNaN(q) && q > 0; });
}

function parseAllocData(val) {
  var s = String(val || '').trim();
  if (!s) return {};
  try { return JSON.parse(s); } catch(e) { return {}; }
}

function buildAllocStatus(productList, qtyList, allocData) {
  // Build a lowercase-keyed copy for case-insensitive lookup
  var lcAlloc = {};
  var adKeys  = Object.keys(allocData);
  for (var k = 0; k < adKeys.length; k++) lcAlloc[adKeys[k].toLowerCase()] = allocData[adKeys[k]];

  return productList.map(function(p, i) {
    var needed = qtyList[i] || 0;
    var got    = lcAlloc[p.toLowerCase()] || 0;
    if (needed === 0) return p + ': n/a';
    if (got >= needed) return p + ': ' + got + ' \u2705';
    if (got > 0)       return p + ': ' + got + '/' + needed + ' \u26a0\ufe0f partial';
    return p + ': ' + needed + ' needed \u23f3 waiting';
  }).join(' | ');
}


// ═══════════════════════════════════════════════════════════════════════════════
//  DPD HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getDpdProducts() {
  var actionSheet = getActionSheet();
  if (!actionSheet) return {};
  var lastRow = actionSheet.getLastRow();
  if (lastRow < ACTION_DATA_ROW) return {};
  var dpd   = {};
  var nRows  = lastRow - ACTION_DATA_ROW + 1;
  var names  = actionSheet.getRange(ACTION_DATA_ROW, AC.PRODUCT, nRows, 1).getValues();
  var flags  = actionSheet.getRange(ACTION_DATA_ROW, AC.IS_DPD,  nRows, 1).getValues();
  for (var i = 0; i < names.length; i++) {
    var pName = String(names[i][0] || '').trim();
    var flag  = String(flags[i][0] || '').trim().toUpperCase();
    if (pName && flag === 'DPD') dpd[pName.toLowerCase()] = true;  // lowercase for case-insensitive lookup
  }
  return dpd;
}

function getNextWorkday() {
  var DUTCH_HOLIDAYS = ['01-01','04-18','04-21','04-26','05-05','05-29','06-08','06-09','12-25','12-26'];
  var d = new Date();
  d.setDate(d.getDate() + 1);
  for (var safety = 0; safety < 14; safety++) {
    var dow  = d.getDay();
    var mmdd = Utilities.formatDate(d, 'Europe/Amsterdam', 'MM-dd');
    if (dow !== 0 && dow !== 6 && DUTCH_HOLIDAYS.indexOf(mmdd) === -1) {
      return Utilities.formatDate(d, 'Europe/Amsterdam', 'dd-MM-yyyy');
    }
    d.setDate(d.getDate() + 1);
  }
  return Utilities.formatDate(d, 'Europe/Amsterdam', 'dd-MM-yyyy');
}

function isAllDpd(productList, dpdMap) {
  if (!productList.length) return false;
  for (var i = 0; i < productList.length; i++) {
    if (!dpdMap[productList[i].toLowerCase()]) return false;  // case-insensitive
  }
  return true;
}

function assignDpdDates() {
  var sheet = getOrdersSheet();
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var dpdMap   = getDpdProducts();
  var nextDay  = getNextWorkday();
  var startRow = getDataStartRow(sheet, OC.ORDER_ID);
  if (!startRow) return;
  var nRows    = lastRow - startRow + 1;

  var prodVals = sheet.getRange(startRow, OC.PRODUCT,   nRows, 1).getDisplayValues();
  var prefVals = sheet.getRange(startRow, OC.PREF_DATE, nRows, 1).getValues();
  var sentVals = sheet.getRange(startRow, OC.SENT_LOG,  nRows, 1).getValues();

  var updated = 0;
  for (var i = 0; i < nRows; i++) {
    var prodStr  = String(prodVals[i][0] || '').trim();
    var prefDate = String(prefVals[i][0] || '').trim();
    if (!prodStr || prefDate !== '') continue;

    var productList = parseList(prodStr);
    if (!isAllDpd(productList, dpdMap)) continue;

    sheet.getRange(i + startRow, OC.PREF_DATE).setValue(nextDay);
    var currentLog = String(sentVals[i][0] || '').trim();
    var logEntry   = 'DPD auto-date: ' + nextDay + ' (' + nowStamp() + ')';
    sheet.getRange(i + startRow, OC.SENT_LOG).setValue(currentLog ? currentLog + ' | ' + logEntry : logEntry);
    updated++;
  }

  if (updated > 0) SpreadsheetApp.flush();
  Logger.log('DPD auto-date: assigned next workday (' + nextDay + ') to ' + updated + ' orders.');
}

function isFullyAllocated(productList, qtyList, allocData) {
  if (!productList.length) return false;
  // Lowercase-keyed copy so product name casing between sheets never breaks the check
  var lcAlloc = {};
  var adKeys  = Object.keys(allocData);
  for (var k = 0; k < adKeys.length; k++) lcAlloc[adKeys[k].toLowerCase()] = allocData[adKeys[k]];
  for (var i = 0; i < productList.length; i++) {
    if ((lcAlloc[productList[i].toLowerCase()] || 0) < (qtyList[i] || 0)) return false;
  }
  return true;
}


// ═══════════════════════════════════════════════════════════════════════════════
//  PHONE FORMATTER
// ═══════════════════════════════════════════════════════════════════════════════

function formatPhone(rawPhone, rawCountry) {
  if (!rawPhone) return null;
  var digits  = String(rawPhone).replace(/[^0-9]/g, '');
  if (!digits) return null;
  var country = String(rawCountry || '').toUpperCase().trim();
  var cc = '31';
  if (country === 'BE' || country.indexOf('BELG') !== -1) cc = '32';
  if (digits.startsWith('31') || digits.startsWith('32')) return '+' + digits;
  if (digits.startsWith('00')) return '+' + digits.substring(2);
  if (digits.startsWith('0'))  return '+' + cc + digits.substring(1);
  return '+' + cc + digits;
}


// ═══════════════════════════════════════════════════════════════════════════════
//  TIMESTAMP HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function extractTimestamp(sentVal, label) {
  var idx = sentVal.indexOf(label);
  if (idx === -1) return null;
  var after = sentVal.substring(idx + label.length).trim();
  var m = after.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(m[3], m[2]-1, m[1], m[4], m[5]);
}

function laterDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}


// ═══════════════════════════════════════════════════════════════════════════════
//  onEdit — SIMPLE TRIGGER (intentional no-op)
// ═══════════════════════════════════════════════════════════════════════════════

function onEdit(e) {
  // Intentionally empty — all edit handling is in onEditInstallable.
}


// ═══════════════════════════════════════════════════════════════════════════════
//  onEditInstallable — INSTALLABLE TRIGGER
// ═══════════════════════════════════════════════════════════════════════════════

function onEditInstallable(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    var gid   = sheet.getSheetId();
    var col   = e.range.getColumn();
    var row   = e.range.getRow();
    var val   = String(e.value || '').trim().toLowerCase();
    if (row <= 1) return;

    if (gid === ACTION_GID && col === AC.TRIGGER && val === 'run') {
      handleAllocationTrigger(sheet, row, e.source);
      return;
    }

    if (gid !== ORDERS_GID) return;

    if (col === OC.EMAIL_TRIGGER && val === 'send') { handleEmailTrigger(sheet, row); return; }
    if (col === OC.WA_TRIGGER    && val === 'send') { handleWaTrigger(sheet, row);    return; }

    // Manual YES in col N → trigger delivery request (Email 1 or DPD auto-date)
    // This lets the team manually mark an order as complete and the email fires automatically.
    if (col === OC.VERWERKT && val === 'yes') {
      try { autoSendDeliveryRequest(sheet, row); } catch(er) { Logger.log('manual YES trigger: ' + er.message); }
      return;
    }
  } catch(err) {
    Logger.log('onEditInstallable error: ' + err.message);
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
//  AUTO DELIVERY ACTION  — called after allocation marks an order VERWERKT=YES
//
//  Decision tree (idempotent — safe to call multiple times):
//    1. Date already filled           → nothing to do, return.
//    2. ALL products in order are DPD → set PREF_DATE = next workday automatically.
//                                       No email sent — DPD ships without date choice.
//    3. Mixed or non-DPD products     → send Email 1 asking customer to pick a date.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send Email 1 or assign a DPD auto-date for a single order row.
 *
 * @param {Sheet}  ordersSheet
 * @param {number} orderRow    1-based row number in ordersSheet
 * @param {Object} [preRead]   Optional pre-fetched values (avoids redundant sheet reads when
 *                             called in a loop from catchUpDeliveryRequests):
 *                             { orderId, email, sentVal, dateVal, prodStr }
 * @returns {boolean}  true if an Email 1 was actually sent (not DPD, not already sent)
 */
function autoSendDeliveryRequest(ordersSheet, orderRow, preRead) {
  var orderId = preRead ? preRead.orderId : cleanOrderId(ordersSheet.getRange(orderRow, OC.ORDER_ID).getValue());
  var email   = preRead ? preRead.email   : String(ordersSheet.getRange(orderRow, OC.EMAIL).getValue()).trim();
  var sentVal = preRead ? preRead.sentVal : String(ordersSheet.getRange(orderRow, OC.SENT_LOG).getValue()).trim();
  var dateVal = preRead ? preRead.dateVal : String(ordersSheet.getRange(orderRow, OC.PREF_DATE).getValue()).trim();
  var prodStr = preRead ? preRead.prodStr
    : normalizeProductSeparators(String(ordersSheet.getRange(orderRow, OC.PRODUCT).getValue() || '').trim());

  if (!orderId || !email) return false;
  if (dateVal !== '')     return false;  // delivery date already set

  // ── DPD check ────────────────────────────────────────────────────────────────
  if (prodStr) {
    var productList = parseList(prodStr);
    var dpdMap      = getDpdProducts();
    if (productList.length > 0 && isAllDpd(productList, dpdMap)) {
      var nextDay = getNextWorkday();
      ordersSheet.getRange(orderRow, OC.PREF_DATE).setValue(nextDay);
      var dpdLog = (sentVal ? sentVal + ' | ' : '') + 'DPD auto-date: ' + nextDay + ' (' + nowStamp() + ')';
      ordersSheet.getRange(orderRow, OC.SENT_LOG).setValue(dpdLog);
      Logger.log('DPD auto-date set for order ' + orderId + ': ' + nextDay);
      return false;  // date set, no email sent
    }
  }

  // ── Non-DPD / mixed order: send Email 1 ──────────────────────────────────────
  if (sentVal.indexOf('Email 1 Sent') !== -1) return false;  // already sent

  try {
    var link = CFG.BASE_URL + '/bezorgdatum?order=' + orderId + '&email=' + encodeURIComponent(email);
    GmailApp.sendEmail(email, CFG.SUBJECT_EMAIL1.replace('{{ORDER}}', orderId), '', { htmlBody: buildEmailHtml(orderId, link, false), name: CFG.SENDER_NAME });
    Utilities.sleep(100);  // reduce burst rate when many orders complete in one run
    var newLog = (sentVal ? sentVal + ' | ' : '') + 'Email 1 Sent ' + nowStamp() + ' (auto)';
    ordersSheet.getRange(orderRow, OC.SENT_LOG).setValue(newLog);
    Logger.log('Auto Email 1 sent for order ' + orderId);
    return true;
  } catch(err) {
    Logger.log('autoSendDeliveryRequest error for order ' + orderId + ': ' + err.message);
    var errLog = (sentVal ? sentVal + ' | ' : '') + 'Email 1 Auto-Failed ' + nowStamp() + ': ' + err.message;
    ordersSheet.getRange(orderRow, OC.SENT_LOG).setValue(errLog);
    return false;
  }
}


/**
 * Some rows have N=YES but ALLOC_DATA does not actually cover what was ordered
 * (e.g. old script wrote YES incorrectly, or a race condition wrote YES to the
 * wrong row). These rows have no delivery date, so catchUpDeliveryRequests emails
 * them every hourly pass — especially dangerous after a sheet revert which clears
 * SENT_LOG.
 *
 * This function checks every YES row: if parseAllocData(P) does not satisfy
 * isFullyAllocated(products, qtys, allocData), N is cleared to '' and the row is
 * flagged so the allocation engine can re-evaluate it properly.
 *
 * @param {Array} verwerktArr  [[value], ...] — mutated in place
 * @param {Array} prodArr      [[value], ...] — column D (PRODUCT)
 * @param {Array} qtyArr       [[value], ...]  — column C (QTY)
 * @param {Array} allocDataArr [[value], ...] — column P (ALLOC_DATA)
 * @returns {number}  Count of rows cleared
 */
function healMismarkedYes(verwerktArr, prodArr, qtyArr, allocDataArr) {
  var cleared = 0;
  for (var i = 0; i < verwerktArr.length; i++) {
    if (String(verwerktArr[i][0] || '').trim().toUpperCase() !== 'YES') continue;
    var prodStr = normalizeProductSeparators(String(prodArr[i][0] || '').trim());
    if (!prodStr) continue;
    var productList = parseList(prodStr);
    var qtyList     = parseQuantities(String(qtyArr[i][0] || ''));
    if (!productList.length || productList.length !== qtyList.length) continue;
    var allocData = parseAllocData(allocDataArr[i][0]);

    // If ALLOC_DATA is completely empty this is likely a YES row whose column P
    // was corrupted by the old script. Do NOT clear it here —
    // already counts it from QTY+PRODUCT, and rebuildMissingAllocData will repair P.
    if (Object.keys(allocData).length === 0) continue;

    // Only clear YES when ALLOC_DATA is present but does not actually satisfy the order.
    // This catches race-condition writes of wrong product names into ALLOC_DATA.
    if (!isFullyAllocated(productList, qtyList, allocData)) {
      verwerktArr[i][0] = '';
      cleared++;
    }
  }
  return cleared;
}


/**
 * Batch notes belong in column Q (BATCH_DATE), not in N (VERWERKT). Mis-pastes or old
 * bugs sometimes leave "In batch …" in N; that confuses staff and can accompany bad O/P.
 * Mutates verwerktArr / batchArr in place; returns how many rows were fixed.
 */
function healVerwerktBatchMess(verwerktArr, batchArr) {
  var healed = 0;
  if (!verwerktArr || !batchArr || verwerktArr.length !== batchArr.length) return 0;
  for (var i = 0; i < verwerktArr.length; i++) {
    var v = String(verwerktArr[i][0] || '').trim();
    if (!v) continue;
    if (v.toUpperCase() === 'YES') continue;
    if (!/batch/i.test(v)) continue;
    var q = String(batchArr[i][0] || '').trim();
    if (q.indexOf(v) === -1) {
      batchArr[i][0] = q ? q + ', ' + v : v;
    }
    verwerktArr[i][0] = '';
    healed++;
  }
  return healed;
}


/**
 * One-off / manual: scan Orders and move any batch-like text from col N to col Q.
 */
function healOrdersSheetBatchMisplacement() {
  var sheet = getOrdersSheet();
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Orders sheet not found.');
    return;
  }
  var lastRow  = sheet.getLastRow();
  var startRow = getDataStartRow(sheet, OC.ORDER_ID);
  if (!startRow) {
    SpreadsheetApp.getUi().alert('No data rows found on Orders.');
    return;
  }
  var nRows       = lastRow - startRow + 1;
  var verwerktArr = sheet.getRange(startRow, OC.VERWERKT,   nRows, 1).getValues();
  var batchArr    = sheet.getRange(startRow, OC.BATCH_DATE, nRows, 1).getValues();
  var healed      = healVerwerktBatchMess(verwerktArr, batchArr);
  if (healed === 0) {
    SpreadsheetApp.getUi().alert('No misplaced batch text found in column N (Helemaal verwerkt?).');
    return;
  }
  sheet.getRange(startRow, OC.VERWERKT,   nRows, 1).setValues(verwerktArr);
  sheet.getRange(startRow, OC.BATCH_DATE, nRows, 1).setValues(batchArr);
  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert('Moved batch notes from column N to Q on ' + healed + ' row(s).');
}


// Maximum emails sent per catchUpDeliveryRequests() call. Remaining rows are
// picked up automatically on the next hourly pass. Prevents 6-minute timeouts
// when a large batch (e.g. 360 units) is allocated all at once.
var MAX_EMAILS_PER_CATCHUP = 40;

/**
 * Orders that are VERWERKT=YES and still have no delivery date (PREF_DATE empty)
 * need Email 1 or DPD auto-date. That normally happens inside runAllocation when
 * the row first becomes YES. If that step was missed (e.g. webhook timeout), this
 * catch-up runs on every scheduled pass so we are not blocked by an empty SENT_LOG
 * (checkFollowUps used to skip rows with no communications).
 *
 * Columns are batch-read once to avoid 5 individual sheet reads per row.
 * Capped at MAX_EMAILS_PER_CATCHUP to prevent 6-minute trigger timeouts when
 * a large allocation completes many orders at once.
 */
function catchUpDeliveryRequests() {
  var sheet = getOrdersSheet();
  if (!sheet) return;
  var lastRow  = sheet.getLastRow();
  var startRow = getDataStartRow(sheet, OC.ORDER_ID);
  if (!startRow) return;
  var nRows    = lastRow - startRow + 1;

  var verwerkt = sheet.getRange(startRow, OC.VERWERKT,   nRows, 1).getValues();
  var batchCol = sheet.getRange(startRow, OC.BATCH_DATE, nRows, 1).getValues();
  var healed   = healVerwerktBatchMess(verwerkt, batchCol);
  if (healed > 0) {
    sheet.getRange(startRow, OC.VERWERKT,   nRows, 1).setValues(verwerkt);
    sheet.getRange(startRow, OC.BATCH_DATE, nRows, 1).setValues(batchCol);
    SpreadsheetApp.flush();
    Logger.log('catchUpDeliveryRequests: healed ' + healed + ' misplaced batch cell(s) in col N.');
  }

  // Batch-read all columns needed — avoids 5 individual reads per row in the loop
  var orderIds   = sheet.getRange(startRow, OC.ORDER_ID,  nRows, 1).getValues();
  var emails     = sheet.getRange(startRow, OC.EMAIL,     nRows, 1).getValues();
  var products   = sheet.getRange(startRow, OC.PRODUCT,   nRows, 1).getValues();
  var qtys       = sheet.getRange(startRow, OC.QTY,       nRows, 1).getValues();
  var allocData  = sheet.getRange(startRow, OC.ALLOC_DATA,nRows, 1).getValues();
  var sentLogs   = sheet.getRange(startRow, OC.SENT_LOG,  nRows, 1).getValues();
  var prefDate   = sheet.getRange(startRow, OC.PREF_DATE, nRows, 1).getValues();

  // Heal rows where N=YES but allocation data does not actually cover what was ordered.
  // These are left over from old-script corruption or racing writes and would otherwise
  // receive repeated Email 1s every hourly pass (especially after a sheet revert).
  var misYes = healMismarkedYes(verwerkt, products, qtys, allocData);
  if (misYes > 0) {
    sheet.getRange(startRow, OC.VERWERKT, nRows, 1).setValues(verwerkt);
    SpreadsheetApp.flush();
    Logger.log('catchUpDeliveryRequests: cleared YES from ' + misYes + ' row(s) where allocation did not match ordered products.');
  }

  var emailsSentThisRun = 0;
  for (var i = 0; i < nRows; i++) {
    if (emailsSentThisRun >= MAX_EMAILS_PER_CATCHUP) {
      Logger.log('catchUpDeliveryRequests: per-run cap (' + MAX_EMAILS_PER_CATCHUP + ') reached — remaining rows picked up on next hourly pass.');
      break;
    }
    if (String(verwerkt[i][0] || '').trim().toUpperCase() !== 'YES') continue;
    if (String(prefDate[i][0] || '').trim() !== '') continue;
    var rowNum = i + startRow;
    try {
      if (sheet.isRowHiddenByUser(rowNum) || sheet.isRowHiddenByFilter(rowNum)) continue;
    } catch (ex) { /* ignore */ }
    try {
      var sent = autoSendDeliveryRequest(sheet, rowNum, {
        orderId : cleanOrderId(orderIds[i][0]),
        email   : String(emails[i][0]   || '').trim(),
        sentVal : String(sentLogs[i][0] || '').trim(),
        dateVal : String(prefDate[i][0] || '').trim(),
        prodStr : normalizeProductSeparators(String(products[i][0] || '').trim()),
      });
      if (sent) emailsSentThisRun++;
    } catch (err) {
      Logger.log('catchUpDeliveryRequests row ' + rowNum + ': ' + err.message);
    }
  }
  if (emailsSentThisRun > 0) {
    Logger.log('catchUpDeliveryRequests: sent ' + emailsSentThisRun + ' Email 1(s) this run.');
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
//  ALLOCATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Core allocation logic, used by:
 *   • handleAllocationTrigger()  — manual "Run" from ACTION sheet col F
 *   • scanAndAllocatePending()   — hourly sweep of all products where D = B − C > 0
 *
 * @param {Sheet}   actionSheet    The ACTION sheet object
 * @param {number}  actionRow      Row number in ACTION sheet for this product
 * @param {Object}  ss             SpreadsheetApp spreadsheet (optional)
 * @param {boolean} silent         If true, suppress spinner; result is always written
 * @param {number}  balanceOverride If > 0, use this as the allocation budget instead of
 *                                  computing (STOCK − prevAllocated). Pass the incoming
 *                                  qty from n8n so only truly new units are distributed.
 * @returns {number}               Count of orders that became fully allocated (YES) this run
 */
function runAllocation(actionSheet, actionRow, ss, silent, balanceOverride) {
  var triggerCell   = actionSheet.getRange(actionRow, AC.TRIGGER);
  var resultCell    = actionSheet.getRange(actionRow, AC.RESULT);
  var timestampCell = actionSheet.getRange(actionRow, AC.TIMESTAMP);

  if (!silent) {
    triggerCell.setValue('');
    resultCell.setValue('\u23f3 Running allocation \u2014 please wait\u2026');
  }
  // Always flush here — in doPost (web-app) context a sheet needs at least one
  // flush before subsequent writes to it are reliably committed.
  SpreadsheetApp.flush();

  var productName   = String(actionSheet.getRange(actionRow, AC.PRODUCT).getValue()).trim();
  var stockReceived = Number(actionSheet.getRange(actionRow, AC.STOCK).getValue()) || 0;
  var batchRaw      = actionSheet.getRange(actionRow, AC.BATCH).getValue();
  var batchLabel    = '';
  if (batchRaw instanceof Date) {
    batchLabel = Utilities.formatDate(batchRaw, 'Europe/Amsterdam', 'dd-MM-yyyy');
  } else if (batchRaw) {
    batchLabel = String(batchRaw).trim();
  }

  if (!productName) {
    if (!silent) resultCell.setValue('\u274c Product name missing in col A.');
    return 0;
  }
  if (stockReceived <= 0) {
    if (!silent) resultCell.setValue('\u274c Stock Received (col B) is 0 or empty.');
    return 0;
  }

  var ordersSheet = getOrdersSheet(ss);
  if (!ordersSheet) {
    if (!silent) resultCell.setValue('\u274c Orders sheet not found (GID ' + ORDERS_GID + ').');
    return 0;
  }

  var lastRow  = ordersSheet.getLastRow();
  var startRow = getDataStartRow(ordersSheet, OC.ORDER_ID);
  if (!startRow) {
    if (!silent) { resultCell.setValue('No orders found.'); timestampCell.setValue(new Date()); }
    return 0;
  }

  var nRows = lastRow - startRow + 1;

  var qtyVals      = ordersSheet.getRange(startRow, OC.QTY,          nRows, 1).getDisplayValues();
  var prodVals     = ordersSheet.getRange(startRow, OC.PRODUCT,       nRows, 1).getDisplayValues();
  var allocDataArr = ordersSheet.getRange(startRow, OC.ALLOC_DATA,    nRows, 1).getValues();
  var allocStatArr = ordersSheet.getRange(startRow, OC.ALLOC_STATUS,  nRows, 1).getValues();
  var verwerktArr  = ordersSheet.getRange(startRow, OC.VERWERKT,      nRows, 1).getValues();
  var batchArr     = ordersSheet.getRange(startRow, OC.BATCH_DATE,    nRows, 1).getValues();

  var healedN = healVerwerktBatchMess(verwerktArr, batchArr);
  if (healedN > 0) {
    ordersSheet.getRange(startRow, OC.VERWERKT,   nRows, 1).setValues(verwerktArr);
    ordersSheet.getRange(startRow, OC.BATCH_DATE, nRows, 1).setValues(batchArr);
    SpreadsheetApp.flush();
    Logger.log('runAllocation: healed ' + healedN + ' row(s) where batch text was in col N (VERWERKT).');
  }

  var productNameLower = productName.toLowerCase();

  // currentC = the authoritative AC.ALLOCATED value as maintained by this engine.
  // It accumulates every time units are allocated and is NEVER reset by exports or
  // C is never reset in the automatic path — only the n8n incoming qty and the
  // allocation logic here control it.
  var currentC = Number(actionSheet.getRange(actionRow, AC.ALLOCATED).getValue()) || 0;

  // prevAllocated (sum of live ALLOC_DATA) is kept for logging only — it must NOT
  // be written back to AC.ALLOCATED, because exported rows lower it, which would
  // make D = B − C incorrectly positive (phantom available stock).
  var prevAllocated = 0;
  for (var i = 0; i < nRows; i++) {
    var _ad = parseAllocData(allocDataArr[i][0]);
    var _adKeys = Object.keys(_ad);
    for (var _k = 0; _k < _adKeys.length; _k++) {
      if (_adKeys[_k].toLowerCase() === productNameLower) {
        prevAllocated += (_ad[_adKeys[_k]] || 0);
        break;
      }
    }
  }

  // balanceOverride (incoming qty from n8n) is always used when supplied.
  // Fallback (scanAndAllocatePending, manual Run): use B − currentC so that
  // the remaining budget is the true unallocated portion of received stock.
  var balance = (typeof balanceOverride === 'number' && balanceOverride > 0)
    ? balanceOverride
    : Math.max(0, stockReceived - currentC);

  if (balance <= 0) {
    // Do NOT write prevAllocated back to AC.ALLOCATED — that would reset it to the
    // live-orders ALLOC_DATA sum (which drops after exports) and create phantom D.
    var _hint = (!silent) ? ' (No remaining balance in B \u2212 C.)' : '';
    resultCell.setValue((silent ? '[Auto] ' : '') + '\u2705 All ' + currentC + '/' + stockReceived + ' already allocated. No remaining balance.' + _hint);
    timestampCell.setValue(new Date());
    SpreadsheetApp.flush();
    return 0;
  }

  var newlyAllocated  = 0;
  var ordersUpdated   = 0;
  var skippedInsuff   = 0;
  var hiddenSkipped   = 0;
  var changed         = false;
  var newlyFullRows   = [];  // ← track rows that just became VERWERKT=YES (NEW v2.2)
  var batchDirty      = {};  // row index → true when Q (BATCH_DATE) was updated this run

  for (var i = 0; i < nRows; i++) {
    if (balance <= 0) break;

    var qtyStr  = qtyVals[i][0];
    var prodStr = prodVals[i][0];
    if (!qtyStr || !prodStr) continue;

    var productList = parseList(String(prodStr));
    var qtyList     = parseQuantities(String(qtyStr));

    if (!productList.length || productList.length !== qtyList.length) continue;

    var idx = -1;
    for (var pi = 0; pi < productList.length; pi++) {
      if (productList[pi].toLowerCase() === productNameLower) { idx = pi; break; }
    }
    if (idx === -1) continue;

    var needed = qtyList[idx];
    if (!needed || needed <= 0) continue;

    var ad     = parseAllocData(allocDataArr[i][0]);
    var adVal  = 0;
    var adKeys = Object.keys(ad);
    for (var ki = 0; ki < adKeys.length; ki++) {
      if (adKeys[ki].toLowerCase() === productNameLower) { adVal = ad[adKeys[ki]] || 0; break; }
    }
    if (adVal >= needed) continue;

    var rowNum = i + startRow;
    try {
      if (ordersSheet.isRowHiddenByUser(rowNum) || ordersSheet.isRowHiddenByFilter(rowNum)) {
        hiddenSkipped++; continue;
      }
    } catch(ex) { /* non-critical */ }

    if (balance < needed) { skippedInsuff++; continue; }

    // ── CHAIR-LINK RULE ───────────────────────────────────────────────────────
    // If the product being allocated is a turn/swivel function ("draaifunctie"),
    // only allocate it to orders where an "eetkamerstoel" is already allocated
    // in ALLOC_DATA. This prevents stand-alone turn-function allocations when
    // the matching chair has not yet arrived.
    if (/draaifunctie/i.test(productName)) {
      var hasChair = false;
      for (var ci = 0; ci < adKeys.length; ci++) {
        if (/eetkamerstoel/i.test(adKeys[ci]) && (ad[adKeys[ci]] || 0) > 0) {
          hasChair = true; break;
        }
      }
      if (!hasChair) { skippedInsuff++; continue; }
    }

    // ── ALLOCATE ──────────────────────────────────────────────────────────────
    ad[productName]    = needed;
    allocDataArr[i][0] = JSON.stringify(ad);
    allocStatArr[i][0] = buildAllocStatus(productList, qtyList, ad);

    var wasYes    = String(verwerktArr[i][0] || '').trim().toUpperCase() === 'YES';
    var nowFull   = isFullyAllocated(productList, qtyList, ad);

    if (nowFull) {
      verwerktArr[i][0] = 'YES';
      if (!wasYes) {
        // This order JUST became fully allocated — queue for auto email (NEW v2.2)
        newlyFullRows.push(rowNum);
      }
    }

    if (batchLabel) {
      var existing = String(batchArr[i][0] || '').trim();
      // Only append if this batch date is not already mentioned in the cell
      if (existing.indexOf(batchLabel) === -1) {
        batchArr[i][0] = existing ? existing + ', batch ' + batchLabel : 'batch ' + batchLabel;
        batchDirty[i]  = true;
      }
    }

    balance        -= needed;
    newlyAllocated += needed;
    ordersUpdated++;
    changed = true;
  }

  if (changed) {
    ordersSheet.getRange(startRow, OC.ALLOC_DATA,   nRows, 1).setValues(allocDataArr);
    ordersSheet.getRange(startRow, OC.ALLOC_STATUS, nRows, 1).setValues(allocStatArr);
    ordersSheet.getRange(startRow, OC.VERWERKT,     nRows, 1).setValues(verwerktArr);
    if (batchLabel) {
      for (var bj = 0; bj < nRows; bj++) {
        if (batchDirty[bj]) {
          ordersSheet.getRange(startRow + bj, OC.BATCH_DATE).setValue(batchArr[bj][0]);
        }
      }
    }
    SpreadsheetApp.flush();
  }

  // Only ever ADD newlyAllocated to the existing AC.ALLOCATED.
  // Never reset it from prevAllocated — see comment above balance calculation.
  var totalAllocated = currentC + newlyAllocated;
  actionSheet.getRange(actionRow, AC.ALLOCATED).setValue(totalAllocated);
  timestampCell.setValue(new Date());

  // Always write a result — silent mode just prefixes "[Auto]" instead of showing a spinner.
  var msg = '\u2705 ' + (silent ? '[Auto] ' : '') + newlyAllocated + ' units allocated to ' + ordersUpdated + ' orders.';
  if (prevAllocated > 0) msg += ' (' + prevAllocated + ' units already in live ALLOC_DATA before this run.)';
  if (batchLabel) msg += ' Batch: ' + batchLabel + '.';
  if (hiddenSkipped > 0) msg += ' ' + hiddenSkipped + ' hidden rows skipped.';
  if (skippedInsuff > 0) msg += ' ' + skippedInsuff + ' orders skipped (insufficient balance).';
  if (balance > 0) msg += ' Remaining balance: ' + balance + ' units.';
  else msg += ' Balance fully used.';
  if (newlyFullRows.length > 0) {
    msg += ' \ud83d\udce7 ' + newlyFullRows.length + ' order(s) newly completed \u2014 delivery date step runs after allocation (catch-up).';
  }
  resultCell.setValue(msg);
  SpreadsheetApp.flush();

  // Emails are sent from catchUpDeliveryRequests() (called by handleStockUpdate,
  // handleAllocationTrigger, scanAndAllocatePending) so large batches do not hit
  // Gmail rate limits or the 6-minute execution cap mid-loop.

  return newlyFullRows.length;
}


/**
 * handleAllocationTrigger — wraps runAllocation with debounce + LockService.
 * Called by onEditInstallable when col F = "Run".
 */
function handleAllocationTrigger(actionSheet, actionRow, ss) {
  var triggerCell   = actionSheet.getRange(actionRow, AC.TRIGGER);
  var resultCell    = actionSheet.getRange(actionRow, AC.RESULT);
  var timestampCell = actionSheet.getRange(actionRow, AC.TIMESTAMP);

  // Debounce — ignore double-fires within 3 seconds
  var lastRun = timestampCell.getValue();
  if (lastRun && (new Date() - new Date(lastRun)) / 1000 < 3) {
    triggerCell.setValue(''); return;
  }
  triggerCell.setValue('');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    resultCell.setValue('\u26a0\ufe0f Script locked \u2014 try again in a moment.');
    return;
  }
  try {
    var _n = runAllocation(actionSheet, actionRow, ss, false);
    if (_n > 0) {
      try { catchUpDeliveryRequests(); } catch(e2) { Logger.log('catchUp after manual Run: ' + e2.message); }
    }
  } finally {
    lock.releaseLock();
  }
}




// ═══════════════════════════════════════════════════════════════════════════════
//  PENDING STOCK SWEEP  — runs hourly + daily to catch any stock sitting idle
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Scans every row in the ACTION sheet.
 * For any product where STOCK − ALLOCATED > 0 (available units sitting unused),
 * runs allocation against the orders sheet and triggers Email 1 for any orders
 * that become fully allocated.
 *
 * Called automatically by checkFollowUps (hourly) and runDailyJobs (08:00).
 * Also safe to run manually from the custom menu.
 */
function scanAndAllocatePending() {
  var ss          = SpreadsheetApp.getActiveSpreadsheet();
  var actionSheet = getActionSheet(ss);
  if (!actionSheet) return;

  var lastRow = actionSheet.getLastRow();
  if (lastRow < ACTION_DATA_ROW) return;

  var nRows     = lastRow - ACTION_DATA_ROW + 1;
  var nameVals  = actionSheet.getRange(ACTION_DATA_ROW, AC.PRODUCT,   nRows, 1).getValues();
  var stockVals = actionSheet.getRange(ACTION_DATA_ROW, AC.STOCK,     nRows, 1).getValues();
  var allocVals = actionSheet.getRange(ACTION_DATA_ROW, AC.ALLOCATED, nRows, 1).getValues();

  var pending = [];
  for (var r = 0; r < nRows; r++) {
    var productName = String(nameVals[r][0] || '').trim();
    if (!productName) continue;
    var available = (Number(stockVals[r][0]) || 0) - (Number(allocVals[r][0]) || 0);
    if (available > 0) pending.push({ name: productName, available: available, row: r + ACTION_DATA_ROW });
  }

  if (!pending.length) {
    Logger.log('scanAndAllocatePending: no products with available stock.');
    return;
  }

  Logger.log('scanAndAllocatePending: ' + pending.length + ' product(s) with available stock: '
    + pending.map(function(p) { return p.name + '(' + p.available + ')'; }).join(', '));

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    Logger.log('scanAndAllocatePending: could not acquire lock — skipping this run.');
    return;
  }
  var totalNewlyFull = 0;
  try {
    for (var i = 0; i < pending.length; i++) {
      try {
        // Pass available as the balance override so runAllocation uses the exact
        // B − C value computed above — avoids a redundant re-read inside the function.
        totalNewlyFull += runAllocation(actionSheet, pending[i].row, ss, true, pending[i].available);
      } catch(err) {
        Logger.log('scanAndAllocatePending error for ' + pending[i].name + ': ' + err.message);
      }
    }
  } finally {
    lock.releaseLock();
  }

  if (totalNewlyFull > 0) {
    try { catchUpDeliveryRequests(); } catch(e3) { Logger.log('catchUp after scan: ' + e3.message); }
  }

  Logger.log('scanAndAllocatePending: done.');
}




// ═══════════════════════════════════════════════════════════════════════════════
//  EMAIL TRIGGER  (Orders col R → "Send")  — manual override
// ═══════════════════════════════════════════════════════════════════════════════

function handleEmailTrigger(sheet, row) {
  sheet.getRange(row, OC.EMAIL_TRIGGER).setValue('');
  SpreadsheetApp.flush();

  var orderId = cleanOrderId(sheet.getRange(row, OC.ORDER_ID).getValue());
  var email   = String(sheet.getRange(row, OC.EMAIL).getValue()).trim();
  var sentVal = String(sheet.getRange(row, OC.SENT_LOG).getValue()).trim();
  var dateVal = String(sheet.getRange(row, OC.PREF_DATE).getValue()).trim();

  if (!orderId || !email) {
    sheet.getRange(row, OC.SENT_LOG).setValue('Missing order ID or email');
    SpreadsheetApp.flush(); return;
  }
  if (sentVal.indexOf('Email 1 Sent') !== -1) return;  // already sent (auto or manual)
  if (dateVal !== '') return;                           // already has a date

  try {
    var link = CFG.BASE_URL + '/bezorgdatum?order=' + orderId + '&email=' + encodeURIComponent(email);
    GmailApp.sendEmail(email, CFG.SUBJECT_EMAIL1.replace('{{ORDER}}', orderId), '', { htmlBody: buildEmailHtml(orderId, link, false), name: CFG.SENDER_NAME });
    sheet.getRange(row, OC.SENT_LOG).setValue('Email 1 Sent ' + nowStamp());
  } catch(err) {
    sheet.getRange(row, OC.SENT_LOG).setValue('Failed: ' + err.message);
  }
  SpreadsheetApp.flush();
}


// ═══════════════════════════════════════════════════════════════════════════════
//  WHATSAPP TRIGGER  (Orders col U → "Send")
// ═══════════════════════════════════════════════════════════════════════════════

function handleWaTrigger(sheet, row) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) {
    sheet.getRange(row, OC.WA_TRIGGER).setValue(''); return;
  }
  try {
    sheet.getRange(row, OC.WA_TRIGGER).setValue('');
    SpreadsheetApp.flush();

    var orderId = cleanOrderId(sheet.getRange(row, OC.ORDER_ID).getValue());
    var phone   = formatPhone(
      sheet.getRange(row, OC.SHIP_PHONE).getValue(),
      sheet.getRange(row, OC.SHIP_COUNTRY).getValue()
    );
    var email   = String(sheet.getRange(row, OC.EMAIL).getValue()).trim();
    var dateVal = String(sheet.getRange(row, OC.PREF_DATE).getValue()).trim();
    var sentVal = String(sheet.getRange(row, OC.SENT_LOG).getValue()).trim();

    if (dateVal !== '') return;
    if (sentVal.indexOf('WA1 Sent') !== -1) return;

    if (!orderId || !phone) {
      sheet.getRange(row, OC.SENT_LOG).setValue(sentVal + ' | WA1 Failed: missing phone/order');
      SpreadsheetApp.flush(); return;
    }

    var success = postToWaWebhook(phone, orderId, 'whatsapp_1', email);
    var stamp   = nowStamp();
    var suffix  = success ? ' | WA1 Sent ' + stamp : ' | WA1 Failed ' + stamp;
    sheet.getRange(row, OC.SENT_LOG).setValue(sentVal + suffix);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function postToWaWebhook(phone, orderId, messageType, email) {
  try {
    var payload = {
      phone       : phone,
      orderId     : orderId,
      email       : email || '',
      messageType : messageType,
      link        : CFG.BASE_URL + '/bezorgdatum/' + orderId,
      '1'         : orderId,
      '2'         : orderId,
      timestamp   : nowStamp(),
    };
    var resp = UrlFetchApp.fetch(CFG.WA_WEBHOOK_URL, {
      method            : 'post',
      contentType       : 'application/json',
      payload           : JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    return resp.getResponseCode() >= 200 && resp.getResponseCode() < 300;
  } catch(err) {
    Logger.log('WA webhook error: ' + err.message);
    return false;
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
//  HOURLY FOLLOW-UP CHECK
// ═══════════════════════════════════════════════════════════════════════════════

function checkFollowUps() {
  // Runs every day (including weekends): allocation sweep, Email 1 catch-up, follow-ups.
  // Weekend guard removed — customer emails/WhatsApp should run Sat/Sun too.
  // Only the daily fulfillment Excel export stays off on weekends (see runDailyJobs).

  // Skip entirely if runDailyJobs is currently running (it deletes rows mid-execution,
  // which would cause row-number misalignment for any concurrent writes).
  // The daily jobs flag is cleared by runDailyJobs when it finishes.
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(DAILY_JOBS_FLAG)) {
    Logger.log('checkFollowUps skipped — runDailyJobs is active. Will resume on next hourly pass.');
    return;
  }

  // First sweep for any idle stock and allocate + send Email 1 where applicable
  try { scanAndAllocatePending(); } catch(e) { Logger.log('scanAndAllocatePending error: ' + e.message); }
  catchUpDeliveryRequests();

  var sheet = getOrdersSheet();
  if (!sheet) return;
  var lastRow   = sheet.getLastRow();
  var fStartRow = getDataStartRow(sheet, OC.ORDER_ID);
  if (!fStartRow) return;
  var nRows = lastRow - fStartRow + 1;
  var now   = new Date();

  // ── Batch-read all needed columns in ONE call each ───────────────────────────
  var orderIds  = sheet.getRange(fStartRow, OC.ORDER_ID,   nRows, 1).getValues();
  var emails    = sheet.getRange(fStartRow, OC.EMAIL,      nRows, 1).getValues();
  var shipPhone = sheet.getRange(fStartRow, OC.SHIP_PHONE, nRows, 1).getValues();
  var countries = sheet.getRange(fStartRow, OC.SHIP_COUNTRY,nRows,1).getValues();
  var sentLogs  = sheet.getRange(fStartRow, OC.SENT_LOG,   nRows, 1).getValues();
  var prefDates = sheet.getRange(fStartRow, OC.PREF_DATE,  nRows, 1).getValues();

  for (var i = 0; i < nRows; i++) {
    var sentVal = String(sentLogs[i][0]  || '').trim();
    var dateVal = String(prefDates[i][0] || '').trim();

    if (dateVal !== '') continue;   // delivery date already confirmed
    if (!sentVal)       continue;   // no communications yet
    if (sentVal.indexOf('Bellen') !== -1) continue;  // already at call stage

    var orderId = cleanOrderId(orderIds[i][0]);
    if (!orderId) continue;

    var email = String(emails[i][0]    || '').trim();
    var phone = formatPhone(shipPhone[i][0], countries[i][0]);

    var hasE1 = sentVal.indexOf('Email 1 Sent') !== -1;
    var hasE2 = sentVal.indexOf('Email 2 Sent') !== -1;
    var hasW1 = sentVal.indexOf('WA1 Sent')     !== -1;
    var hasW2 = sentVal.indexOf('WA2 Sent')     !== -1;

    var stage = null, lastTs = null;

    if (hasE1 && !hasE2 && !hasW1 && !hasW2) {
      stage  = 'email1';
      lastTs = extractTimestamp(sentVal, 'Email 1 Sent');
    } else if ((hasE2 || hasW1) && !hasW2) {
      stage  = 'email2_wa1';
      lastTs = laterDate(extractTimestamp(sentVal, 'Email 2 Sent'), extractTimestamp(sentVal, 'WA1 Sent'));
    } else if (hasW2) {
      stage  = 'wa2';
      lastTs = extractTimestamp(sentVal, 'WA2 Sent');
    }

    if (!stage || !lastTs) continue;
    var hoursSince = (now - lastTs) / 3600000;

    var newSent = sentVal;
    var stamp   = nowStamp();
    var row     = i + fStartRow;

    if (stage === 'email1' && hoursSince >= CFG.HOURS_BEFORE_REMINDER) {
      if (email) {
        try {
          var link = CFG.BASE_URL + '/bezorgdatum?order=' + orderId + '&email=' + encodeURIComponent(email);
          GmailApp.sendEmail(email, CFG.SUBJECT_EMAIL2.replace('{{ORDER}}', orderId), '', { htmlBody: buildEmailHtml(orderId, link, true), name: CFG.SENDER_NAME });
          newSent += ' | Email 2 Sent ' + stamp;
        } catch(err) {
          newSent += ' | Email 2 Failed ' + stamp;
        }
      }
      if (phone) {
        var ok = postToWaWebhook(phone, orderId, 'whatsapp_1', email);
        newSent += ok ? ' | WA1 Sent ' + stamp : ' | WA1 Failed ' + stamp;
      } else {
        newSent += ' | WA1 Skipped (no phone)';
      }
      sheet.getRange(row, OC.SENT_LOG).setValue(newSent);
      sentLogs[i][0] = newSent;  // keep in-memory copy in sync
      SpreadsheetApp.flush();

    } else if (stage === 'email2_wa1' && hoursSince >= CFG.HOURS_BEFORE_WA2) {
      if (phone) {
        var ok2 = postToWaWebhook(phone, orderId, 'whatsapp_2', email);
        newSent += ok2 ? ' | WA2 Sent ' + stamp : ' | WA2 Failed ' + stamp;
      } else {
        newSent += ' | WA2 Skipped (no phone)';
      }
      sheet.getRange(row, OC.SENT_LOG).setValue(newSent);
      sentLogs[i][0] = newSent;
      SpreadsheetApp.flush();

    } else if (stage === 'wa2' && hoursSince >= CFG.HOURS_BEFORE_CALL) {
      var logCell = sheet.getRange(row, OC.SENT_LOG);
      logCell.setValue('Bellen');
      logCell.setFontColor('#dc2626');
      sentLogs[i][0] = 'Bellen';
      SpreadsheetApp.flush();
    }
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
//  WEB APP  doGet / doPost
//  doGet  — returns a simple status JSON (no data written). Stops "Failed" log
//           entries caused by health-checks, browser tests, or mis-configured n8n nodes.
//  doPost — routes on data.type: "date" | "stock" | "return"
//  type "date" requires orderId + deliveryDate + email matching column B on that order.
// ═══════════════════════════════════════════════════════════════════════════════

function doGet(e) {
  return jsonResponse({ ok: true, service: 'Van Soest Living Orders API', method: 'GET', note: 'Use POST to submit data.' });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      Logger.log('doPost: missing payload');
      return jsonResponse({ success: false, error: 'Missing payload' });
    }
    var data = JSON.parse(e.postData.contents);
    var type = String(data.type || 'date').toLowerCase();

    // Log every incoming call so execution history is readable in Apps Script logs.
    // For stock/return: shows product names. For date: shows orderId.
    if (type === 'stock' || type === 'return') {
      var items = data.items || (data.product ? [{ product: data.product, quantity: data.quantity }] : []);
      Logger.log('doPost [' + type + '] items=' + JSON.stringify(items) + ' requestId=' + (data.requestId || 'none'));
    } else {
      Logger.log('doPost [date] orderId=' + (data.orderId || '?') + ' date=' + (data.formattedDate || data.deliveryDate || '?') + ' email=' + (data.email ? 'yes' : 'MISSING'));
    }

    if ((type === 'stock' || type === 'return') && data.secret !== CFG.N8N_STOCK_SECRET) {
      Logger.log('doPost: unauthorized stock/return request');
      return jsonResponse({ success: false, error: 'Unauthorized' });
    }

    if (type === 'stock' || type === 'return') return handleStockUpdate(data);
    return handleDeliveryDate(data);

  } catch(err) {
    Logger.log('doPost error: ' + err.message);
    return jsonResponse({ success: false, error: err.message });
  }
}


// ─── Stock / Return update from n8n ──────────────────────────────────────────
// v2.3: Runs allocation directly after the stock write (no deferred trigger).
//       Uses requestId deduplication so n8n retries cannot double-add stock.

function handleStockUpdate(data) {
  var items = data.items || [];

  if (typeof items === 'string') {
    try { items = JSON.parse(items); }
    catch(e) { return jsonResponse({ success: false, error: 'items could not be parsed: ' + items }); }
  }

  if (!Array.isArray(items)) items = [];

  if (data.product && data.quantity) {
    items = [{ product: data.product, quantity: Number(data.quantity) }];
  }

  if (!items.length) {
    return jsonResponse({ success: false, error: 'No items provided. Received: ' + JSON.stringify(data) });
  }

  // ── Request deduplication ─────────────────────────────────────────────────
  // Include a unique `requestId` field in the n8n payload (e.g. a UUID or
  // {{$now}}). If the same requestId arrives again (n8n retry), we return
  // success immediately without re-adding stock.
  var requestId = String(data.requestId || '').trim();
  var props     = PropertiesService.getScriptProperties();
  if (requestId) {
    var dupKey = 'REQ_' + requestId;
    if (props.getProperty(dupKey)) {
      Logger.log('Duplicate requestId rejected: ' + requestId);
      return jsonResponse({ success: true, skipped: true, reason: 'duplicate_request', requestId: requestId });
    }
  }

  var ss          = SpreadsheetApp.getActiveSpreadsheet();
  var actionSheet = getActionSheet(ss);
  if (!actionSheet) return jsonResponse({ success: false, error: 'Action sheet not found' });

  var lastRow = actionSheet.getLastRow();
  if (lastRow < ACTION_DATA_ROW) return jsonResponse({ success: false, error: 'ACTION sheet has no product rows' });

  var nRows     = lastRow - ACTION_DATA_ROW + 1;
  var nameVals  = actionSheet.getRange(ACTION_DATA_ROW, AC.PRODUCT, nRows, 1).getValues();
  var stockVals = actionSheet.getRange(ACTION_DATA_ROW, AC.STOCK,   nRows, 1).getValues();

  var productMap = {};
  for (var r = 0; r < nRows; r++) {
    var n = String(nameVals[r][0] || '').trim();
    if (n) productMap[n.toLowerCase()] = r;
  }

  var results         = [];
  var changed         = false;
  var updatedProducts = [];  // {name, qty} — qty is the exact incoming amount to allocate

  for (var j = 0; j < items.length; j++) {
    var pName = String(items[j].product || '').trim();
    var qty   = Number(items[j].quantity) || 0;

    if (!pName || qty <= 0) {
      results.push({ product: pName, status: 'skipped', reason: 'invalid name or qty' });
      continue;
    }

    var rowIdx = productMap[pName.toLowerCase()];
    if (rowIdx === undefined) {
      results.push({ product: pName, status: 'not_found' });
      continue;
    }

    var currentStock     = Number(stockVals[rowIdx][0]) || 0;
    var newStock         = currentStock + qty;
    stockVals[rowIdx][0] = newStock;
    changed              = true;

    // Store the canonical sheet name AND the incoming qty as the allocation budget
    updatedProducts.push({ name: String(nameVals[rowIdx][0]).trim(), qty: qty });
    results.push({ product: pName, status: 'updated', previousStock: currentStock, newStock: newStock, quantity: qty });
  }

  // ── Write stock (lock only this critical section) ─────────────────────────
  if (changed) {
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      return jsonResponse({ success: false, error: 'Script busy — retry in a few seconds.' });
    }
    try {
      actionSheet.getRange(ACTION_DATA_ROW, AC.STOCK, nRows, 1).setValues(stockVals);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
  }

  // Mark requestId only when stock actually changed — otherwise retries can fix typos / new rows
  if (requestId && changed) {
    props.setProperty('REQ_' + requestId, nowStamp());
  }

  Logger.log('Stock/Return update: ' + JSON.stringify(results));

  // Allocation is intentionally NOT triggered here.
  // B is now updated; the hourly scanAndAllocatePending() will pick up the
  // new available (B − C) on its next run and allocate to pending orders.
  // Single allocation path = no overlap, no double-allocation risk.

  return jsonResponse({
    success   : true,
    type      : data.type,
    updatedAt : nowStamp(),
    results   : results,
    note      : 'Stock saved. Allocation will run on the next hourly pass.',
  });
}



// ─── Delivery date from customer form ────────────────────────────────────────

function handleDeliveryDate(data) {
  var orderId      = cleanOrderId(data.orderId);
  var deliveryDate = data.formattedDate || data.deliveryDate;

  if (!orderId || !deliveryDate) {
    return jsonResponse({ success: false, error: 'Missing orderId or deliveryDate' });
  }

  // Require email so wrong order numbers cannot attach a date to another customer's row.
  var submitted = normalizeEmailForMatch(data.email);
  if (!submitted) {
    return jsonResponse({ success: false, error: 'email is required and must match the order email' });
  }

  var sheet = getOrdersSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Orders sheet not found' });

  var lastRow  = sheet.getLastRow();
  var startRow = getDataStartRow(sheet, OC.ORDER_ID);
  if (!startRow) return jsonResponse({ success: false, error: 'No order rows' });

  var orderCol  = sheet.getRange(startRow, OC.ORDER_ID, lastRow - startRow + 1, 1).getValues();
  var targetRow = -1;
  for (var i = 0; i < orderCol.length; i++) {
    if (cleanOrderId(orderCol[i][0]) === orderId) { targetRow = i + startRow; break; }
  }
  if (targetRow === -1) return jsonResponse({ success: false, error: 'Order not found: ' + orderId });

  var onSheet = normalizeEmailForMatch(sheet.getRange(targetRow, OC.EMAIL).getValue());
  if (submitted !== onSheet) {
    Logger.log('handleDeliveryDate: email mismatch orderId=' + orderId);
    return jsonResponse({ success: false, error: 'Email does not match this order' });
  }

  var existing = sheet.getRange(targetRow, OC.PREF_DATE).getValue();
  if (existing && String(existing).trim() !== '') {
    return jsonResponse({ success: false, error: 'Delivery date already filled' });
  }

  sheet.getRange(targetRow, OC.PREF_DATE).setValue(deliveryDate);
  SpreadsheetApp.flush();

  return jsonResponse({ success: true, message: 'Delivery date saved', orderId: orderId });
}


// ═══════════════════════════════════════════════════════════════════════════════
//  FULFILLMENT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

function manualExportFulfillment() { exportFulfillmentFile(true); }

function exportFulfillmentFile(manual) {
  var sheet = getOrdersSheet();
  if (!sheet) return;
  var lastRow  = sheet.getLastRow();
  var startRow = getDataStartRow(sheet, OC.ORDER_ID);
  if (!startRow) return;
  var nRows = lastRow - startRow + 1;

  // Fetch all needed columns in one pass
  var cols = {
    orderIds    : sheet.getRange(startRow, OC.ORDER_ID,      nRows, 1).getValues(),
    emails      : sheet.getRange(startRow, OC.EMAIL,         nRows, 1).getValues(),
    qtys        : sheet.getRange(startRow, OC.QTY,           nRows, 1).getValues(),
    products    : sheet.getRange(startRow, OC.PRODUCT,       nRows, 1).getValues(),
    billNames   : sheet.getRange(startRow, OC.BILLING_NAME,  nRows, 1).getValues(),
    billPhones  : sheet.getRange(startRow, OC.BILLING_PHONE, nRows, 1).getValues(),
    shipNames   : sheet.getRange(startRow, OC.SHIP_NAME,     nRows, 1).getValues(),
    shipPhones  : sheet.getRange(startRow, OC.SHIP_PHONE,    nRows, 1).getValues(),
    streets     : sheet.getRange(startRow, OC.SHIP_STREET,   nRows, 1).getValues(),
    addr1s      : sheet.getRange(startRow, OC.SHIP_ADDR1,    nRows, 1).getValues(),
    cities      : sheet.getRange(startRow, OC.SHIP_CITY,     nRows, 1).getValues(),
    zips        : sheet.getRange(startRow, OC.SHIP_ZIP,      nRows, 1).getValues(),
    countries   : sheet.getRange(startRow, OC.SHIP_COUNTRY,  nRows, 1).getValues(),
    verwerkt    : sheet.getRange(startRow, OC.VERWERKT,      nRows, 1).getValues(),
    prefDates   : sheet.getRange(startRow, OC.PREF_DATE,     nRows, 1).getValues(),
    allocData   : sheet.getRange(startRow, OC.ALLOC_DATA,    nRows, 1).getValues(),
  };

  // Header matches cols A–M of the orders sheet + col T (delivery date)
  var rows = [[
    'Order ID', 'Email', 'Lineitem quantity', 'Lineitem name',
    'Billing name', 'Billing phone',
    'Shipping name', 'Shipping phone',
    'Shipping Street', 'Shipping Address1',
    'Shipping City', 'Shipping Zip', 'Shipping Country',
    'Delivery Date',
  ]];

  // Track which sheet rows were exported so we can delete them after sending.
  var exportedSheetRows = [];

  for (var i = 0; i < nRows; i++) {
    // Only export orders that are fully allocated (YES) AND have a delivery date
    var done = String(cols.verwerkt[i][0]  || '').trim().toUpperCase() === 'YES';
    var pref = cols.prefDates[i][0];
    if (!done || !pref || String(pref).trim() === '') continue;

    var prefStr = pref instanceof Date
      ? Utilities.formatDate(pref, 'Europe/Amsterdam', 'dd-MM-yyyy')
      : String(pref).trim();

    rows.push([
      String(cols.orderIds[i][0]   || ''),
      String(cols.emails[i][0]     || ''),
      String(cols.qtys[i][0]       || ''),
      String(cols.products[i][0]   || ''),
      String(cols.billNames[i][0]  || ''),
      String(cols.billPhones[i][0] || ''),
      String(cols.shipNames[i][0]  || ''),
      String(cols.shipPhones[i][0] || ''),
      String(cols.streets[i][0]    || ''),
      String(cols.addr1s[i][0]     || ''),
      String(cols.cities[i][0]     || ''),
      String(cols.zips[i][0]       || ''),
      String(cols.countries[i][0]  || ''),
      prefStr,
    ]);
    exportedSheetRows.push(i + startRow);

  }

  if (rows.length <= 1) {
    if (manual) SpreadsheetApp.getUi().alert('No completed orders with a delivery date — nothing to export.');
    return;
  }

  var dateStr  = Utilities.formatDate(new Date(), 'Europe/Amsterdam', 'yyyy-MM-dd');
  var fileName = 'Fulfillment_' + dateStr + '.xlsx';
  var tempSS   = SpreadsheetApp.create('VSL_Fulfillment_' + dateStr);
  var tempSheet = tempSS.getActiveSheet();
  tempSheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  SpreadsheetApp.flush();
  Utilities.sleep(3000);  // allow Sheets to index the new file before export

  var exportUrl = 'https://docs.google.com/spreadsheets/d/' + tempSS.getId() + '/export?format=xlsx';
  var token     = ScriptApp.getOAuthToken();
  var resp      = UrlFetchApp.fetch(exportUrl, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  var blob      = resp.getBlob().setName(fileName);

  GmailApp.sendEmail(
    CFG.FULFILLMENT_EMAIL,
    'Fulfillment Orders ' + Utilities.formatDate(new Date(), 'Europe/Amsterdam', 'dd-MM-yyyy'),
    (rows.length - 1) + ' orders attached for delivery.',
    { attachments: [blob], name: CFG.SENDER_NAME }
  );

  DriveApp.getFileById(tempSS.getId()).setTrashed(true);

  // ── Delete exported rows from the orders sheet (bottom-up to keep row indices valid) ──
  for (var d = exportedSheetRows.length - 1; d >= 0; d--) {
    sheet.deleteRow(exportedSheetRows[d]);
  }

  // ACTION sheet (Allocation Received / Allocated) is intentionally NOT touched here.
  // B (Allocation Received) is managed only by n8n stock webhooks — it accumulates
  // the total stock received per batch and is never decremented by exports.
  // C (Allocated) is managed by the allocation engine — it grows as orders are
  // allocated and is never reset by exports, so D = B − C stays correct without
  // needing a refresh. C (Allocated) is maintained cumulatively by runAllocation
  // and must never be reset by an automatic post-export operation.

  Logger.log('Fulfillment export: ' + (rows.length - 1) + ' orders exported and deleted from sheet.');
  if (manual) SpreadsheetApp.getUi().alert('\u2705 Fulfillment file (' + (rows.length - 1) + ' orders) sent to ' + CFG.FULFILLMENT_EMAIL + '.\n\nThose orders have been removed from the sheet.');
}


// ═══════════════════════════════════════════════════════════════════════════════
//  STOFSTAAL EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

function manualExportStofstaal() { exportStofstaalFile(true); }

function exportStofstaalFile(manual) {
  if (!STOFSTAAL_GID) {
    if (manual) SpreadsheetApp.getUi().alert('STOFSTAAL_GID is not set.');
    return;
  }

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getSheetByGid(ss, STOFSTAAL_GID);
  if (!sheet) { if (manual) SpreadsheetApp.getUi().alert('Stofstaal sheet not found.'); return; }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { if (manual) SpreadsheetApp.getUi().alert('Stofstaal sheet appears empty.'); return; }

  // Always export exactly columns A–N (14 columns)
  var STOFSTAAL_COLS = 14;
  var allData = sheet.getRange(1, 1, lastRow, STOFSTAAL_COLS).getValues();

  // Row 0 = header; keep it always
  // Data rows: skip any row where col N (index 13) is "X" or "x"
  var exportRows = [allData[0]];  // header
  for (var r = 1; r < allData.length; r++) {
    var verzonden = String(allData[r][13] || '').trim();
    if (verzonden.toLowerCase() === 'x') continue;  // already sent — exclude
    // Also skip completely empty rows (no name in col A)
    if (!String(allData[r][0] || '').trim()) continue;
    exportRows.push(allData[r]);
  }

  if (exportRows.length <= 1) {
    Logger.log('Stofstaal export: no qualifying rows — skipping send.');
    if (manual) SpreadsheetApp.getUi().alert('No Stofstaal orders to export (all rows are marked X or empty).');
    return;
  }

  var orderCount = exportRows.length - 1;
  var dateStr    = Utilities.formatDate(new Date(), 'Europe/Amsterdam', 'yyyy-MM-dd');
  var fileName   = 'Stofstaal_Orders_' + dateStr + '.xlsx';
  var tempSS     = SpreadsheetApp.create('VSL_Stofstaal_' + dateStr);
  var tempSheet  = tempSS.getActiveSheet();
  tempSheet.getRange(1, 1, exportRows.length, STOFSTAAL_COLS).setValues(exportRows);
  SpreadsheetApp.flush();
  Utilities.sleep(3000);  // allow Sheets to index the new file before export

  var exportUrl = 'https://docs.google.com/spreadsheets/d/' + tempSS.getId() + '/export?format=xlsx';
  var token     = ScriptApp.getOAuthToken();
  var resp      = UrlFetchApp.fetch(exportUrl, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  var blob      = resp.getBlob().setName(fileName);

  GmailApp.sendEmail(
    CFG.STOFSTAAL_EMAIL,
    'Postnl brievenbuspakket orders ' + Utilities.formatDate(new Date(), 'Europe/Amsterdam', 'dd-MM-yyyy'),
    orderCount + ' Postnl brievenbuspakket orders bijgevoegd.',
    { attachments: [blob], name: CFG.SENDER_NAME }
  );

  DriveApp.getFileById(tempSS.getId()).setTrashed(true);
  Logger.log('Stofstaal export sent: ' + orderCount + ' orders.');
  if (manual) SpreadsheetApp.getUi().alert('\u2705 Stofstaal file (' + orderCount + ' orders) sent to ' + CFG.STOFSTAAL_EMAIL);
}


// ═══════════════════════════════════════════════════════════════════════════════
//  DAILY JOB RUNNER  — 08:00 every day
// ═══════════════════════════════════════════════════════════════════════════════

// Key used in PropertiesService to signal that runDailyJobs is actively running.
// checkFollowUps reads this flag and skips to prevent concurrent row-deleting exports
// from racing with allocation writes and catchUpDeliveryRequests.
var DAILY_JOBS_FLAG = 'DAILY_JOBS_RUNNING';

function runDailyJobs() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty(DAILY_JOBS_FLAG, '1');
  Logger.log('runDailyJobs started: ' + nowStamp());
  try {
    // Order matters: scanAndAllocatePending can use almost the full 6-minute Apps Script
    // budget. DPD + export run FIRST so fulfillment Excel always goes out even if scan
    // times out (hourly checkFollowUps will continue allocation after).
    try { assignDpdDates();         } catch(e) { Logger.log('assignDpdDates error: '         + e.message); }
    if (isWorkday()) {
      try { exportFulfillmentFile(false); } catch(e) { Logger.log('exportFulfillmentFile error: '  + e.message); }
    } else {
      Logger.log('runDailyJobs: weekend — fulfillment export skipped (emails still run via hourly checkFollowUps).');
    }
    try { scanAndAllocatePending();   } catch(e) { Logger.log('scanAndAllocatePending error: '  + e.message); }
  } finally {
    // Must always clear: if the run hits the 6-minute limit mid-scan, checkFollowUps
    // would otherwise stay blocked until someone clears the property manually.
    props.deleteProperty(DAILY_JOBS_FLAG);
  }
  Logger.log('runDailyJobs finished: ' + nowStamp());
}


/**
 * Weekdays 10:00 Amsterdam — second pass if 08:00 timed out before export, or if
 * YES + delivery date were completed only after 08:00. Idempotent: export sends
 * only rows still on the sheet; if nothing to export, no email.
 * Runs DPD + export before scan so the 6-minute limit cannot skip Excel again.
 */
function runMidMorningExportCatchup() {
  if (!isWorkday()) { Logger.log('runMidMorningExportCatchup skipped — weekend.'); return; }
  var props = PropertiesService.getScriptProperties();
  props.setProperty(DAILY_JOBS_FLAG, '1');
  Logger.log('runMidMorningExportCatchup started: ' + nowStamp());
  try {
    // Same as runDailyJobs: export before scan so a long scan does not time out before Excel.
    try { assignDpdDates();         } catch(e) { Logger.log('runMidMorning DPD: '  + e.message); }
    try { exportFulfillmentFile(false); } catch(e) { Logger.log('runMidMorning export: ' + e.message); }
    try { scanAndAllocatePending(); } catch(e) { Logger.log('runMidMorning scan: ' + e.message); }
  } finally {
    props.deleteProperty(DAILY_JOBS_FLAG);
  }
  Logger.log('runMidMorningExportCatchup finished: ' + nowStamp());
}


// ═══════════════════════════════════════════════════════════════════════════════
//  HIDE / SHOW COMPLETED ROWS
// ═══════════════════════════════════════════════════════════════════════════════

function hideCompletedRows() {
  var sheet = getOrdersSheet();
  if (!sheet) return 0;
  var lastRow  = sheet.getLastRow();
  var startRow = getDataStartRow(sheet, OC.ORDER_ID);
  if (!startRow) return 0;
  var nRows     = lastRow - startRow + 1;
  var verwerkt  = sheet.getRange(startRow, OC.VERWERKT,  nRows, 1).getValues();
  var prefDates = sheet.getRange(startRow, OC.PREF_DATE, nRows, 1).getValues();

  var hidden = 0;
  for (var i = 0; i < nRows; i++) {
    var isComplete = String(verwerkt[i][0]  || '').trim().toUpperCase() === 'YES';
    var hasDate    = String(prefDates[i][0] || '').trim() !== '';
    if (isComplete && hasDate) { sheet.hideRows(i + startRow); hidden++; }
  }
  Logger.log('hideCompletedRows: ' + hidden + ' rows hidden.');
  return hidden;
}

function manualHideCompletedRows() {
  var hidden = hideCompletedRows();
  SpreadsheetApp.getUi().alert('\u2705 ' + hidden + ' completed rows hidden.');
}

function showAllRows() {
  var sheet = getOrdersSheet();
  if (!sheet) return;
  sheet.showRows(2, sheet.getLastRow() - 1);
  SpreadsheetApp.getUi().alert('\u2705 All rows are now visible.');
}


// ═══════════════════════════════════════════════════════════════════════════════
//  EMAIL HTML BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function buildEmailHtml(orderId, link, isReminder) {
  var intro = isReminder
    ? '<p>Wij hebben u eerder een e-mail gestuurd over het kiezen van een bezorgdatum voor bestelling <strong>#'
        + orderId + '</strong>. We hebben nog geen reactie ontvangen.</p>'
        + '<p>Klik op onderstaande knop om alsnog uw gewenste bezorgdatum te kiezen:</p>'
    : '<p>Goed nieuws! Uw bestelling <strong>#' + orderId
        + '</strong> is bijna klaar voor levering.</p>'
        + '<p>Klik op onderstaande knop om uw gewenste bezorgdatum te kiezen:</p>';

  return '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">'
    + '<div style="text-align:center;padding:30px 0 20px"><h2 style="color:#C4885E;margin:0;font-size:22px">Van Soest Living</h2></div>'
    + '<div style="background:#faf9f7;border-radius:12px;padding:32px;border:1px solid #edeae5">'
    + '<p style="margin-top:0">Beste klant,</p>'
    + intro
    + '<div style="text-align:center;margin:30px 0">'
    + '<a href="' + link + '" style="background:linear-gradient(135deg,#FF914D,#ff7a2e);color:white;'
    + 'padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">'
    + 'Bezorgdatum Kiezen</a></div>'
    + '<p style="font-size:13px;color:#666">Houd rekening met een minimale termijn van 2 werkdagen. '
    + 'Wij leveren niet op weekenden of feestdagen.</p>'
    + '<p style="font-size:13px;color:#666">De chauffeur levert tussen 08:00 en 17:00 uur. '
    + 'De avond v\u00f3\u00f3r levering ontvangt u een track &amp; trace per e-mail.</p>'
    + '<hr style="border:none;border-top:1px solid #e0dbd5;margin:24px 0">'
    + '<p style="font-size:12px;color:#999;margin-bottom:0">Werkt de knop niet? '
    + 'Kopieer en plak deze link in uw browser:<br>'
    + '<a href="' + link + '" style="color:#C4885E;word-break:break-all">' + link + '</a></p>'
    + '</div>'
    + '<div style="text-align:center;padding:20px 0;font-size:12px;color:#999">'
    + '<p>Met vriendelijke groet,<br><strong>Van Soest Living</strong></p></div>'
    + '</div>';
}


// ═══════════════════════════════════════════════════════════════════════════════
//  WORKDAY GUARD
// ═══════════════════════════════════════════════════════════════════════════════

/** Returns true if today is Monday–Friday (Amsterdam time). */
function isWorkday() {
  var day = new Date().toLocaleDateString('en-US', { timeZone: 'Europe/Amsterdam', weekday: 'long' });
  return day !== 'Saturday' && day !== 'Sunday';
}


// ═══════════════════════════════════════════════════════════════════════════════
//  TRIGGER SETUP  (run once from Apps Script editor: Run → setupTriggers)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Installs time-based triggers:
 *   • runDailyJobs              — 08:00 Amsterdam (scan, DPD, export Mon–Fri)
 *   • runMidMorningExportCatchup — 10:00 Amsterdam Mon–Fri (backup if 08:00 times out or rows finish after 08:00)
 *   • checkFollowUps            — every hour (emails, WA, scan — all days)
 *
 * Run this function ONCE from the Apps Script editor after first deployment.
 */
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === 'runDailyJobs' || fn === 'checkFollowUps' || fn === 'runMidMorningExportCatchup') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('runDailyJobs')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .inTimezone('Europe/Amsterdam')
    .create();

  ScriptApp.newTrigger('runMidMorningExportCatchup')
    .timeBased()
    .everyDays(1)
    .atHour(10)
    .inTimezone('Europe/Amsterdam')
    .create();

  ScriptApp.newTrigger('checkFollowUps')
    .timeBased()
    .everyHours(1)
    .create();

  SpreadsheetApp.getUi().alert(
    '\u2705 Triggers installed!\n\n' +
    '\u2022 runDailyJobs  \u2192 08:00 every day (export Mon\u2013Fri)\n' +
    '\u2022 runMidMorningExportCatchup  \u2192 10:00 Mon\u2013Fri (if 08:00 hit time limit or orders completed after 08:00)\n' +
    '\u2022 checkFollowUps  \u2192 every hour (allocation + emails + WA)'
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
//  ADD PRODUCT TO ORDER  (safe manual operation)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Menu: "➕ Add Product to Order"
 *
 * Safely adds a product + qty to an existing order row and immediately
 * allocates it if stock is available — guaranteeing this specific order
 * gets the units (not the general queue).
 *
 * Use when: a customer adds an extra item (e.g. turn function) to an existing
 * order that is already (partially) allocated.
 */
function addProductToOrder() {
  var ui = SpreadsheetApp.getUi();

  var rowResp = ui.prompt(
    '➕ Product toevoegen aan bestelling',
    'Voer het RIJNUMMER in van de bestelling\n(het getal links in het spreadsheet):',
    ui.ButtonSet.OK_CANCEL
  );
  if (rowResp.getSelectedButton() !== ui.Button.OK) return;
  var rowNum = parseInt(rowResp.getResponseText().trim(), 10);
  if (isNaN(rowNum) || rowNum < 2) { ui.alert('❌ Ongeldig rijnummer.'); return; }

  var prodResp = ui.prompt(
    '➕ Product toevoegen aan bestelling',
    'Voer de EXACTE productnaam in om toe te voegen\n(bijv. 180 Graden Draaifunctie):',
    ui.ButtonSet.OK_CANCEL
  );
  if (prodResp.getSelectedButton() !== ui.Button.OK) return;
  var productToAdd = prodResp.getResponseText().trim();
  if (!productToAdd) { ui.alert('❌ Geen productnaam ingevoerd.'); return; }

  var qtyResp = ui.prompt(
    '➕ Product toevoegen aan bestelling',
    'Hoeveel stuks van "' + productToAdd + '"?',
    ui.ButtonSet.OK_CANCEL
  );
  if (qtyResp.getSelectedButton() !== ui.Button.OK) return;
  var addQty = parseInt(qtyResp.getResponseText().trim(), 10);
  if (isNaN(addQty) || addQty <= 0) { ui.alert('❌ Ongeldig aantal.'); return; }

  var ss          = SpreadsheetApp.getActiveSpreadsheet();
  var sheet       = getOrdersSheet(ss);
  var actionSheet = getActionSheet(ss);
  if (!sheet || !actionSheet) { ui.alert('❌ Sheet niet gevonden.'); return; }

  var prodStr  = normalizeProductSeparators(String(sheet.getRange(rowNum, OC.PRODUCT).getValue() || '').trim());
  var qtyStr   = normalizeProductSeparators(String(sheet.getRange(rowNum, OC.QTY).getValue() || '').trim());
  var allocRaw = sheet.getRange(rowNum, OC.ALLOC_DATA).getValue();
  var orderId  = cleanOrderId(sheet.getRange(rowNum, OC.ORDER_ID).getValue());

  var productList = parseList(prodStr);
  var qtyList     = parseQuantities(qtyStr);
  var allocData   = parseAllocData(allocRaw);

  // Check product not already in this order
  for (var i = 0; i < productList.length; i++) {
    if (productList[i].toLowerCase() === productToAdd.toLowerCase()) {
      ui.alert('⚠️ "' + productToAdd + '" zit al in deze bestelling.\nGebruik de normale allocatie als het nog niet is toegewezen.');
      return;
    }
  }

  // Check ACTION sheet has this product
  var aLast  = actionSheet.getLastRow();
  var aRows  = aLast - ACTION_DATA_ROW + 1;
  var aNames = actionSheet.getRange(ACTION_DATA_ROW, AC.PRODUCT, aRows, 1).getValues();
  var aStock = actionSheet.getRange(ACTION_DATA_ROW, AC.STOCK,   aRows, 1).getValues();
  var aAlloc = actionSheet.getRange(ACTION_DATA_ROW, AC.ALLOCATED, aRows, 1).getValues();
  var actionRow = -1;
  for (var ar = 0; ar < aRows; ar++) {
    if (String(aNames[ar][0] || '').trim().toLowerCase() === productToAdd.toLowerCase()) {
      actionRow = ar + ACTION_DATA_ROW; break;
    }
  }
  if (actionRow === -1) {
    ui.alert('❌ Product "' + productToAdd + '" niet gevonden in het ACTION-tabblad.\nControleer de exacte naam.');
    return;
  }

  var available = (Number(aStock[actionRow - ACTION_DATA_ROW][0]) || 0)
                - (Number(aAlloc[actionRow - ACTION_DATA_ROW][0]) || 0);

  // Add product to lists
  productList.push(productToAdd);
  qtyList.push(addQty);

  // Directly allocate if stock available — guarantees THIS order gets the units
  if (available >= addQty) {
    allocData[productToAdd] = addQty;
  }

  var newProdStr  = productList.join(' - ');
  var newQtyStr   = qtyList.join(' - ');
  var newAllocSt  = buildAllocStatus(productList, qtyList, allocData);
  var nowFull     = isFullyAllocated(productList, qtyList, allocData);
  var newVerwerkt = nowFull ? 'YES' : '';

  sheet.getRange(rowNum, OC.PRODUCT).setValue(newProdStr);
  sheet.getRange(rowNum, OC.QTY).setValue(newQtyStr);
  sheet.getRange(rowNum, OC.ALLOC_DATA).setValue(JSON.stringify(allocData));
  sheet.getRange(rowNum, OC.ALLOC_STATUS).setValue(newAllocSt);
  sheet.getRange(rowNum, OC.VERWERKT).setValue(newVerwerkt);
  SpreadsheetApp.flush();

  // If allocated, deduct from ACTION STOCK by updating ALLOCATED via refresh
  if (available >= addQty) {
    // Update ACTION ALLOCATED directly by adding to it
    var curAlloc = Number(aAlloc[actionRow - ACTION_DATA_ROW][0]) || 0;
    actionSheet.getRange(actionRow, AC.ALLOCATED).setValue(curAlloc + addQty);
    SpreadsheetApp.flush();
  }

  // If order just became fully allocated, trigger delivery request
  if (nowFull && newVerwerkt === 'YES') {
    try { autoSendDeliveryRequest(sheet, rowNum); } catch(e2) { Logger.log('addProduct delivery req: ' + e2.message); }
  }

  var allocMsg = available >= addQty
    ? '✅ Product direct toegewezen aan deze bestelling.'
    : '⚠️ Niet genoeg voorraad (' + available + ' beschikbaar, ' + addQty + ' nodig).\nHet product is wel toegevoegd aan de bestelling en wordt toegewezen zodra voorraad binnenkomt.';

  ui.alert(
    '✅ Klaar!\n\n' +
    '"' + productToAdd + '" (x' + addQty + ') toegevoegd aan bestelling ' + (orderId || 'rij ' + rowNum) + '.\n\n' +
    allocMsg +
    (nowFull ? '\n\nBestelling is nu volledig — bezorgdatumverzoek is verstuurd.' : '')
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
//  REMOVE PRODUCT FROM ORDER  (safe manual operation)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Menu: "✂️ Remove Product from Order"
 *
 * Use when a product needs to be removed from an already-allocated order
 * (e.g. no chairs available, so remove turn function from combined order to
 * free it up for a standalone turn-function-only order).
 *
 * Safely handles:
 *  - Removes product from col D (product list) and col C (qty list)
 *  - Removes product from col P (ALLOC_DATA JSON)
 *  - Recalculates col N (VERWERKT) based on remaining products
 *  - Decrements AC.ALLOCATED (C) by freed qty so D = B − C correctly increases
 */
function removeProductFromOrder() {
  var ui = SpreadsheetApp.getUi();

  var rowResp = ui.prompt(
    '✂️ Remove Product from Order',
    'Enter the ROW NUMBER of the order in the orders sheet\n(look at the row number on the left side of the sheet):',
    ui.ButtonSet.OK_CANCEL
  );
  if (rowResp.getSelectedButton() !== ui.Button.OK) return;
  var rowNum = parseInt(rowResp.getResponseText().trim(), 10);
  if (isNaN(rowNum) || rowNum < 2) { ui.alert('❌ Invalid row number.'); return; }

  var prodResp = ui.prompt(
    '✂️ Remove Product from Order',
    'Enter the EXACT product name to remove\n(e.g. 180 Graden Draaifunctie):',
    ui.ButtonSet.OK_CANCEL
  );
  if (prodResp.getSelectedButton() !== ui.Button.OK) return;
  var productToRemove = prodResp.getResponseText().trim();
  if (!productToRemove) { ui.alert('❌ No product name entered.'); return; }

  var ss          = SpreadsheetApp.getActiveSpreadsheet();
  var sheet       = getOrdersSheet(ss);
  var actionSheet = getActionSheet(ss);
  if (!sheet || !actionSheet) { ui.alert('❌ Could not find orders or action sheet.'); return; }

  // Read the row
  var prodStr  = normalizeProductSeparators(String(sheet.getRange(rowNum, OC.PRODUCT).getValue() || '').trim());
  var qtyStr   = normalizeProductSeparators(String(sheet.getRange(rowNum, OC.QTY).getValue() || '').trim());
  var allocRaw = sheet.getRange(rowNum, OC.ALLOC_DATA).getValue();
  var orderId  = cleanOrderId(sheet.getRange(rowNum, OC.ORDER_ID).getValue());

  var productList = parseList(prodStr);
  var qtyList     = parseQuantities(qtyStr);
  var allocData   = parseAllocData(allocRaw);

  // Find the product in the list (case-insensitive)
  var removeIdx = -1;
  for (var i = 0; i < productList.length; i++) {
    if (productList[i].toLowerCase() === productToRemove.toLowerCase()) { removeIdx = i; break; }
  }
  if (removeIdx === -1) {
    ui.alert('❌ Product "' + productToRemove + '" not found in order ' + (orderId || rowNum) + '.\nCheck the exact name and try again.');
    return;
  }

  var freedQty = qtyList[removeIdx] || 0;

  // Remove from product and qty lists
  var newProducts = productList.filter(function(_, idx) { return idx !== removeIdx; });
  var newQtys     = qtyList.filter(function(_, idx)     { return idx !== removeIdx; });

  // Remove from ALLOC_DATA
  var allocKeys = Object.keys(allocData);
  for (var k = 0; k < allocKeys.length; k++) {
    if (allocKeys[k].toLowerCase() === productToRemove.toLowerCase()) {
      delete allocData[allocKeys[k]]; break;
    }
  }

  // Rebuild col D and col C strings using ' - ' separator
  var newProdStr = newProducts.join(' - ');
  var newQtyStr  = newQtys.join(' - ');

  // Recalculate VERWERKT: is order still fully allocated with remaining products?
  var stillFull = newProducts.length > 0 && isFullyAllocated(newProducts, newQtys, allocData);
  var newVerwerkt = stillFull ? 'YES' : '';

  // Write back to orders sheet
  sheet.getRange(rowNum, OC.PRODUCT).setValue(newProdStr);
  sheet.getRange(rowNum, OC.QTY).setValue(newQtyStr);
  sheet.getRange(rowNum, OC.ALLOC_DATA).setValue(newProducts.length ? JSON.stringify(allocData) : '');
  sheet.getRange(rowNum, OC.ALLOC_STATUS).setValue(newProducts.length ? buildAllocStatus(newProducts, newQtys, allocData) : '');
  sheet.getRange(rowNum, OC.VERWERKT).setValue(newVerwerkt);
  SpreadsheetApp.flush();

  // Un-allocate: decrement AC.ALLOCATED (C) by freedQty so D = B − C increases
  // and the freed units become available for the next pending order.
  // B (Allocation Received) is intentionally NOT touched — it is owned by n8n only.
  if (freedQty > 0 && actionSheet) {
    var aLast  = actionSheet.getLastRow();
    var aRows  = aLast - ACTION_DATA_ROW + 1;
    var aNames = actionSheet.getRange(ACTION_DATA_ROW, AC.PRODUCT,   aRows, 1).getValues();
    for (var ar = 0; ar < aRows; ar++) {
      if (String(aNames[ar][0] || '').trim().toLowerCase() === productToRemove.toLowerCase()) {
        var curAlloc = Number(actionSheet.getRange(ACTION_DATA_ROW + ar, AC.ALLOCATED).getValue()) || 0;
        actionSheet.getRange(ACTION_DATA_ROW + ar, AC.ALLOCATED).setValue(Math.max(0, curAlloc - freedQty));
        SpreadsheetApp.flush();
        break;
      }
    }
  }

  ui.alert(
    '\u2705 Done!\n\n' +
    '"' + productToRemove + '" (' + freedQty + ' units) removed from order ' + (orderId || 'row ' + rowNum) + '.\n' +
    (freedQty > 0 ? 'Available balance updated — the hourly run will re-allocate these units to the next waiting order.' : '')
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
//  ADD STOCK TO ACTION (col B) — menu helper for full containers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Adds units to ACTION col B (Allocation received) without manual calculator.
 * Same effect as the n8n stock webhook: B = previous B + quantity you enter.
 * Col C (Allocated) is not changed; column D = B - C updates if it is a formula.
 */
function menuAddReceivedStockToAction() {
  var ui    = SpreadsheetApp.getUi();
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getActionSheet(ss);
  if (!sheet) { ui.alert('ACTION sheet not found.'); return; }

  var pResp = ui.prompt(
    'Add to Allocation received (col B)',
    'Enter the EXACT product name as in ACTION column A (e.g. Eetkamerstoel Elena):',
    ui.ButtonSet.OK_CANCEL
  );
  if (pResp.getSelectedButton() !== ui.Button.OK) return;
  var searchName = String(pResp.getResponseText() || '').trim();
  if (!searchName) { ui.alert('No product name.'); return; }

  var lastRow = sheet.getLastRow();
  if (lastRow < ACTION_DATA_ROW) { ui.alert('ACTION sheet has no data rows.'); return; }
  var nRows   = lastRow - ACTION_DATA_ROW + 1;
  var nameVals = sheet.getRange(ACTION_DATA_ROW, AC.PRODUCT, nRows, 1).getValues();

  var actionRow   = -1;
  var canonical   = searchName;
  for (var r = 0; r < nRows; r++) {
    if (String(nameVals[r][0] || '').trim().toLowerCase() === searchName.toLowerCase()) {
      actionRow = ACTION_DATA_ROW + r;
      canonical = String(nameVals[r][0] || '').trim();
      break;
    }
  }
  if (actionRow < 0) {
    ui.alert('Product not found: "' + searchName + '".\nCheck spelling (must match column A).');
    return;
  }

  var curB = Number(sheet.getRange(actionRow, AC.STOCK).getValue()) || 0;
  var curC = Number(sheet.getRange(actionRow, AC.ALLOCATED).getValue()) || 0;

  var qResp = ui.prompt(
    'How many units to ADD to B?',
    'Product: ' + canonical + '\n\n' +
    'Current Allocation received (B): ' + curB + '\n' +
    'Current Allocated (C):         ' + curC + '\n\n' +
    'Enter the number of new units in this container/shipment.\n' +
    'B will become: ' + curB + ' + (this number).',
    ui.ButtonSet.OK_CANCEL
  );
  if (qResp.getSelectedButton() !== ui.Button.OK) return;
  var addStr = String(qResp.getResponseText() || '').replace(/\s/g, '').replace(/,/g, '.');
  var add    = parseFloat(addStr);
  if (isNaN(add) || add <= 0) { ui.alert('Please enter a positive number.'); return; }

  // Wait up to 40s — another run may hold the lock (hourly checkFollowUps, Scan & Allocate, n8n webhook).
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(40000)) {
    ui.alert(
      'Could not get a lock after 40 seconds.\n\n' +
      'Another script is probably still running (hourly allocation, follow-up check, or a stock webhook). ' +
      'Wait one minute and try again, or run this when the execution log is idle.'
    );
    return;
  }
  try {
    curB = Number(sheet.getRange(actionRow, AC.STOCK).getValue()) || 0;
    var newB = curB + add;
    sheet.getRange(actionRow, AC.STOCK).setValue(newB);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  var curC2 = Number(sheet.getRange(actionRow, AC.ALLOCATED).getValue()) || 0;
  var avail = newB - curC2;

  ui.alert(
    '\u2705 Updated: ' + canonical + '\n\n' +
    'Allocation received (B): ' + curB + ' + ' + add + ' = ' + newB + '\n' +
    'Allocated (C) unchanged:  ' + curC2 + '\n' +
    'Available (B \u2212 C) now:  ' + avail + '\n\n' +
    'Use \u201cScan & Allocate Pending Stock Now\u201d, or wait for the next hourly run.'
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CUSTOM MENU
// ═══════════════════════════════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('\ud83c\udfe0 Van Soest Living')
    .addItem('\u23f0  Add received stock to ACTION (B+)',  'menuAddReceivedStockToAction')
    .addItem('\u26a1  Scan & Allocate Pending Stock Now',   'scanAndAllocatePending')
    .addItem('\ud83d\udce7  Run Follow-up Check Now',         'checkFollowUps')
    .addItem('\ud83e\ude79  Repair: batch text N \u2192 Q',    'healOrdersSheetBatchMisplacement')
    .addSeparator()
    .addItem('\ud83d\udcca  Manual Export: Fulfillment File', 'manualExportFulfillment')
    .addItem('\ud83d\udce6  Manual Export: Stofstaal Orders', 'manualExportStofstaal')
    .addSeparator()
    .addItem('\ud83d\ude9a  Assign DPD Dates Now',            'assignDpdDates')
    .addSeparator()
    .addItem('\ud83d\udc41\ufe0f\u200d\ud83d\udde8\ufe0f  Hide Completed Rows Now', 'manualHideCompletedRows')
    .addItem('\ud83d\udc41\ufe0f  Show All Hidden Rows',      'showAllRows')
    .addSeparator()
    .addItem('\u23f0  Install / Reset Triggers (run once)',   'setupTriggers')
    .addSeparator()
    .addItem('\u2702\ufe0f  Remove Product from Order',          'removeProductFromOrder')
    .addItem('\u2795  Add Product to Order',                   'addProductToOrder')
    .addItem('\ud83d\uddd1\ufe0f  Delete Completed Order Row',   'deleteCompletedOrderRow')
    .addItem('\ud83d\udd27  Rebuild Missing ALLOC_DATA (P)',   'rebuildMissingAllocData')
    .addToUi();
}


/**
 * For every YES row where column P (ALLOC_DATA) is empty or not valid JSON,
 * reconstructs ALLOC_DATA and ALLOC_STATUS from the QTY + PRODUCT columns.
 * This fixes the phantom-AVAILABLE bug caused by the old script leaving P empty.
 * Run this once if old-script data left bare numbers or empty cells in column P.
 */
function rebuildMissingAllocData() {
  var sheet = getOrdersSheet();
  if (!sheet) { SpreadsheetApp.getUi().alert('Orders sheet not found.'); return; }

  var lastRow  = sheet.getLastRow();
  var startRow = getDataStartRow(sheet, OC.ORDER_ID);
  if (!startRow) { SpreadsheetApp.getUi().alert('No data rows found.'); return; }

  var nRows       = lastRow - startRow + 1;
  var verwerktArr = sheet.getRange(startRow, OC.VERWERKT,     nRows, 1).getValues();
  var prodArr     = sheet.getRange(startRow, OC.PRODUCT,      nRows, 1).getDisplayValues();
  var qtyArr      = sheet.getRange(startRow, OC.QTY,          nRows, 1).getDisplayValues();
  var allocDArr   = sheet.getRange(startRow, OC.ALLOC_DATA,   nRows, 1).getValues();
  var allocSArr   = sheet.getRange(startRow, OC.ALLOC_STATUS, nRows, 1).getValues();

  var rebuilt       = 0;
  var rebuiltBareNr = 0;  // rows that had old bare-number format in P
  for (var i = 0; i < nRows; i++) {
    var existing = parseAllocData(allocDArr[i][0]);
    if (Object.keys(existing).length > 0) continue;  // already has valid JSON object — skip

    // Rebuild if: P is empty, OR P has a bare number (old-script format like "4" or "6"),
    // regardless of VERWERKT status, as long as the row has product + qty data.
    var rawP         = String(allocDArr[i][0] || '').trim();
    var isBareNumber = rawP !== '' && /^\d+(\.\d+)?$/.test(rawP);

    var prodStr = normalizeProductSeparators(String(prodArr[i][0] || '').trim());
    var qtyStr  = String(qtyArr[i][0] || '').trim();
    if (!prodStr || !qtyStr) continue;

    var productList = parseList(prodStr);
    var qtyList     = parseQuantities(qtyStr);
    if (!productList.length || productList.length !== qtyList.length) continue;

    var ad = {};
    for (var pi = 0; pi < productList.length; pi++) ad[productList[pi]] = qtyList[pi];
    allocDArr[i][0] = JSON.stringify(ad);
    allocSArr[i][0] = buildAllocStatus(productList, qtyList, ad);
    rebuilt++;
    if (isBareNumber) rebuiltBareNr++;
  }

  if (rebuilt === 0) {
    SpreadsheetApp.getUi().alert('No rows with missing or bare-number ALLOC_DATA found — nothing to rebuild.');
    return;
  }

  sheet.getRange(startRow, OC.ALLOC_DATA,   nRows, 1).setValues(allocDArr);
  sheet.getRange(startRow, OC.ALLOC_STATUS, nRows, 1).setValues(allocSArr);
  SpreadsheetApp.flush();

  SpreadsheetApp.getUi().alert('\u2705 Rebuilt ALLOC_DATA + ALLOC_STATUS for ' + rebuilt + ' row(s)'
    + (rebuiltBareNr > 0 ? ' (' + rebuiltBareNr + ' had old bare-number format)' : '') + '.\n'
    + 'Column P (orders sheet) is now fixed. ACTION sheet C (Allocated) is unchanged — the engine keeps it correct automatically.');
}


/**
 * Safely delete a completed order row from the menu.
 * ACTION sheet columns are not touched — see exportFulfillmentFile for the rationale.
 */
function deleteCompletedOrderRow() {
  var ui = SpreadsheetApp.getUi();

  var rowResp = ui.prompt(
    '\ud83d\uddd1\ufe0f Delete Completed Order Row',
    'Enter the ROW NUMBER of the completed order to delete\n(number shown on the left side of the sheet):',
    ui.ButtonSet.OK_CANCEL
  );
  if (rowResp.getSelectedButton() !== ui.Button.OK) return;
  var rowNum = parseInt(rowResp.getResponseText().trim(), 10);
  if (isNaN(rowNum) || rowNum < 2) { ui.alert('\u274c Invalid row number.'); return; }

  var ss          = SpreadsheetApp.getActiveSpreadsheet();
  var sheet       = getOrdersSheet(ss);
  var actionSheet = getActionSheet(ss);
  if (!sheet || !actionSheet) { ui.alert('\u274c Could not find orders or action sheet.'); return; }

  var orderId  = cleanOrderId(sheet.getRange(rowNum, OC.ORDER_ID).getValue());
  var verwerkt = String(sheet.getRange(rowNum, OC.VERWERKT).getValue() || '').trim().toUpperCase();
  var allocRaw = sheet.getRange(rowNum, OC.ALLOC_DATA).getValue();
  var allocData = parseAllocData(allocRaw);

  if (verwerkt !== 'YES') {
    var proceed = ui.alert(
      '\u26a0\ufe0f Warning',
      'Order ' + (orderId || 'row ' + rowNum) + ' does not have VERWERKT=YES.\n\nDelete anyway?',
      ui.ButtonSet.YES_NO
    );
    if (proceed !== ui.Button.YES) return;
  }

  sheet.deleteRow(rowNum);
  SpreadsheetApp.flush();

  // ACTION sheet columns (Allocation Received / Allocated) are intentionally not
  // touched here. B is owned by n8n; C is maintained by the allocation engine.
  // ACTION sheet C is maintained cumulatively by the engine — do not reset it here.

  ui.alert('\u2705 Order ' + (orderId || 'row ' + rowNum) + ' deleted.');
}