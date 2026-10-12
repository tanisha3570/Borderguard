// server/db.js
// SQLite database layer using native node:sqlite DatabaseSync
// Persists cases, verifications, cryptographic ledger, and system logs across restarts.

const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { calculateBlockHash, GENESIS_PREVIOUS_HASH } = require('./services/auditLedger');

const DB_PATH = path.join(__dirname, 'borderguard.db');
const db = new DatabaseSync(DB_PATH);

// Enable WAL journal mode for high concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');

// Create tables with indexes
db.exec(`
  CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    label TEXT NOT NULL CHECK (label IN ('genuine', 'fake')),
    notes TEXT DEFAULT '',
    image_filename TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ledger (
    idx INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    previous_hash TEXT NOT NULL,
    current_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    case_id INTEGER,
    data_json TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id TEXT UNIQUE NOT NULL,
    time TEXT NOT NULL,
    doc_type TEXT,
    country TEXT,
    name TEXT,
    dob TEXT,
    gender TEXT,
    care_of TEXT,
    doc_number TEXT,
    vid_number TEXT,
    address TEXT,
    nationality TEXT,
    expiry TEXT,
    mrz TEXT,
    risk_score INTEGER DEFAULT 0,
    risk_level TEXT DEFAULT 'LOW',
    status TEXT DEFAULT 'Cleared',
    doc_integrity INTEGER DEFAULT 95,
    face_match INTEGER DEFAULT 90,
    identity_consistency INTEGER DEFAULT 95,
    reasons_json TEXT DEFAULT '[]',
    full_record_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_verifications_case_id ON verifications(case_id);
  CREATE INDEX IF NOT EXISTS idx_verifications_risk_level ON verifications(risk_level);
  CREATE INDEX IF NOT EXISTS idx_verifications_created_at ON verifications(created_at);
  CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at);
`);

// ------------------------------------------------------------------
// CASES (Sample Reference Database)
// ------------------------------------------------------------------
const insertCaseStmt = db.prepare(`
  INSERT INTO cases (name, label, notes, image_filename)
  VALUES (?, ?, ?, ?)
`);

function createCase({ name, label, notes, imageFilename }) {
  const info = insertCaseStmt.run(name, label, notes || '', imageFilename);
  const rowId = Number(info.lastInsertRowid);
  return getCaseById(rowId);
}

function getCaseById(id) {
  return db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
}

function listCases() {
  return db.prepare('SELECT * FROM cases ORDER BY created_at DESC').all();
}

function deleteCase(id) {
  const row = getCaseById(id);
  if (row) {
    db.prepare('DELETE FROM cases WHERE id = ?').run(id);
  }
  return row;
}

// ------------------------------------------------------------------
// VERIFICATIONS (History & Audit Log)
// ------------------------------------------------------------------
function saveVerification(rec) {
  if (!rec || !rec.caseId) return null;
  const reasonsJson = JSON.stringify(rec.reasons || []);
  const fullJson = JSON.stringify(rec);
  
  db.prepare(`
    INSERT INTO verifications (
      case_id, time, doc_type, country, name, dob, gender, care_of,
      doc_number, vid_number, address, nationality, expiry, mrz,
      risk_score, risk_level, status, doc_integrity, face_match,
      identity_consistency, reasons_json, full_record_json
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?
    )
    ON CONFLICT(case_id) DO UPDATE SET
      time = excluded.time,
      name = excluded.name,
      doc_type = excluded.doc_type,
      status = excluded.status,
      risk_level = excluded.risk_level,
      risk_score = excluded.risk_score,
      doc_integrity = excluded.doc_integrity,
      face_match = excluded.face_match,
      identity_consistency = excluded.identity_consistency,
      reasons_json = excluded.reasons_json,
      full_record_json = excluded.full_record_json
  `).run(
    rec.caseId,
    rec.time || new Date().toLocaleTimeString(),
    rec.docType || null,
    rec.country || null,
    rec.name || null,
    rec.dob || null,
    rec.gender || null,
    rec.careOf || null,
    rec.docNumber || null,
    rec.vidNumber || null,
    rec.address || null,
    rec.nationality || null,
    rec.expiry || null,
    rec.mrz || null,
    rec.riskScore !== undefined ? rec.riskScore : 0,
    rec.riskLevel || 'LOW',
    rec.status || 'Cleared',
    rec.docIntegrity !== undefined ? rec.docIntegrity : 0,
    rec.faceMatch !== undefined ? rec.faceMatch : 0,
    rec.identityConsistency !== undefined ? rec.identityConsistency : 0,
    reasonsJson,
    fullJson
  );

  return rec;
}

function listVerifications({ query = '', riskLevel = '', limit = 100 } = {}) {
  let sql = 'SELECT * FROM verifications';
  const params = [];
  const clauses = [];

  if (query) {
    clauses.push('(name LIKE ? OR doc_number LIKE ? OR case_id LIKE ?)');
    const q = `%${query}%`;
    params.push(q, q, q);
  }

  if (riskLevel) {
    clauses.push('risk_level = ?');
    params.push(riskLevel.toUpperCase());
  }

  if (clauses.length > 0) {
    sql += ' WHERE ' + clauses.join(' AND ');
  }

  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(Number(limit) || 100);

  const rows = db.prepare(sql).all(...params);
  return rows.map((r) => {
    if (r.full_record_json) {
      try {
        return JSON.parse(r.full_record_json);
      } catch (e) {}
    }
    return {
      caseId: r.case_id,
      time: r.time,
      docType: r.doc_type,
      country: r.country,
      name: r.name,
      dob: r.dob,
      gender: r.gender,
      careOf: r.care_of,
      docNumber: r.doc_number,
      vidNumber: r.vid_number,
      address: r.address,
      nationality: r.nationality,
      expiry: r.expiry,
      mrz: r.mrz,
      riskScore: r.risk_score,
      riskLevel: r.risk_level,
      status: r.status,
      docIntegrity: r.doc_integrity,
      faceMatch: r.face_match,
      identityConsistency: r.identity_consistency,
      reasons: JSON.parse(r.reasons_json || '[]'),
      createdAt: r.created_at,
    };
  });
}

function clearVerifications() {
  db.prepare('DELETE FROM verifications').run();
  return true;
}

// ------------------------------------------------------------------
// CRYPTOGRAPHIC SHA-256 AUDIT LEDGER
// ------------------------------------------------------------------
function getLastLedgerEntry() {
  return db.prepare('SELECT * FROM ledger ORDER BY idx DESC LIMIT 1').get();
}

function appendLedgerEntry({ timestamp, previousHash, status, caseId, data }) {
  const sampleCaseFk = typeof caseId === 'number' ? caseId : null;
  const mergedData = { ...(data || {}) };
  if (sampleCaseFk !== null && !mergedData.caseId) {
    mergedData.caseId = sampleCaseFk;
  }
  
  const last = getLastLedgerEntry();
  const prevHash = previousHash || (last ? last.current_hash : GENESIS_PREVIOUS_HASH);
  const ts = timestamp || new Date().toISOString();

  const info = db.prepare(`
    INSERT INTO ledger (timestamp, previous_hash, current_hash, status, case_id, data_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    ts,
    prevHash,
    'PENDING_HASH',
    status,
    sampleCaseFk,
    JSON.stringify(mergedData)
  );
  
  const rowId = Number(info.lastInsertRowid);
  const finalHash = calculateBlockHash(rowId, ts, prevHash, mergedData, status);
  db.prepare('UPDATE ledger SET current_hash = ? WHERE idx = ?').run(finalHash, rowId);

  return getLedgerEntryByIdx(rowId);
}

function listLedger() {
  return db.prepare(`
    SELECT ledger.*, cases.name AS case_name, cases.label AS case_label
    FROM ledger
    LEFT JOIN cases ON cases.id = ledger.case_id
    ORDER BY idx ASC
  `).all();
}

function getLedgerEntryByIdx(idx) {
  return db.prepare(`
    SELECT ledger.*, cases.name AS case_name, cases.label AS case_label
    FROM ledger
    LEFT JOIN cases ON cases.id = ledger.case_id
    WHERE ledger.idx = ?
  `).get(idx);
}

// ------------------------------------------------------------------
// ANALYTICS & SYSTEM METRICS
// ------------------------------------------------------------------
function getAnalytics() {
  const totalVerifications = db.prepare('SELECT COUNT(*) as count FROM verifications').get()?.count || 0;
  const clearedCount = db.prepare("SELECT COUNT(*) as count FROM verifications WHERE risk_level = 'LOW'").get()?.count || 0;
  const flaggedCount = db.prepare("SELECT COUNT(*) as count FROM verifications WHERE risk_level != 'LOW'").get()?.count || 0;
  const highRiskCount = db.prepare("SELECT COUNT(*) as count FROM verifications WHERE risk_level = 'HIGH'").get()?.count || 0;
  const totalLedgerBlocks = db.prepare('SELECT COUNT(*) as count FROM ledger').get()?.count || 0;
  const totalSampleCases = db.prepare('SELECT COUNT(*) as count FROM cases').get()?.count || 0;

  // Breakdown by document type
  const docTypeRows = db.prepare(`
    SELECT COALESCE(doc_type, 'Unknown') as type, COUNT(*) as count
    FROM verifications
    GROUP BY doc_type
  `).all();

  // Average risk score
  const avgRiskRow = db.prepare('SELECT AVG(risk_score) as avgRisk FROM verifications').get();
  const avgRiskScore = avgRiskRow && avgRiskRow.avgRisk !== null ? Math.round(avgRiskRow.avgRisk) : 0;

  return {
    totalVerifications,
    clearedCount,
    flaggedCount,
    highRiskCount,
    clearanceRate: totalVerifications > 0 ? Math.round((clearedCount / totalVerifications) * 100) : 100,
    totalLedgerBlocks,
    totalSampleCases,
    avgRiskScore,
    documentTypeBreakdown: docTypeRows,
  };
}

function clearLedger() {
  db.prepare('DELETE FROM ledger').run();
  try {
    db.prepare("DELETE FROM sqlite_sequence WHERE name = 'ledger'").run();
  } catch (e) {}
  return true;
}

module.exports = {
  createCase,
  getCaseById,
  listCases,
  deleteCase,
  saveVerification,
  listVerifications,
  clearVerifications,
  getLastLedgerEntry,
  appendLedgerEntry,
  listLedger,
  getLedgerEntryByIdx,
  clearLedger,
  getAnalytics,
};
