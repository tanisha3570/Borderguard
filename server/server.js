// server/server.js
// Production-Grade BorderGuard AI Secure Backend & Verification Server

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const multer = require('multer');

const db = require('./db');
const { processDocumentImage } = require('./services/ocrEngine');
const { extractDocumentData, parseMRZ, extractNonMrzFields } = require('./services/mrzParser');
const { assessTravelerRisk } = require('./services/riskEngine');
const { evaluateStrictMatch } = require('./services/strictMatcher');
const { screenTraveler, getWatchlist } = require('./services/watchlistEngine');
const { verifyChainIntegrity, calculateBlockHash, GENESIS_PREVIOUS_HASH } = require('./services/auditLedger');

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_START_TIME = Date.now();

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

// Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  },
});

// JSON formatting helpers
function caseToJSON(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    label: row.label,
    notes: row.notes,
    createdAt: row.created_at,
    imageUrl: `/uploads/${row.image_filename}`,
  };
}

function ledgerRowToJSON(row) {
  let parsedData = {};
  try {
    parsedData = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json;
  } catch (e) {
    parsedData = { raw: row.data_json };
  }

  return {
    index: row.idx,
    timestamp: row.timestamp,
    previousHash: row.previous_hash,
    currentHash: row.current_hash,
    status: row.status,
    caseId: row.case_id || null,
    caseName: row.case_name || null,
    caseLabel: row.case_label || null,
    data: parsedData,
  };
}

// ==================================================================
// 1. OCR & DOCUMENT INTELLIGENCE ENDPOINTS
// ==================================================================

/**
 * POST /api/ocr/extract
 * Upload document image (file upload or JSON base64) for server-side OCR & entity extraction
 */
app.post('/api/ocr/extract', upload.single('image'), async (req, res) => {
  try {
    let imageInput = null;

    if (req.file) {
      imageInput = path.join(UPLOAD_DIR, req.file.filename);
    } else if (req.body && req.body.imageBase64) {
      imageInput = req.body.imageBase64;
    } else if (req.body && req.body.imageUrl) {
      // Local uploads URL resolution
      if (req.body.imageUrl.startsWith('/uploads/')) {
        imageInput = path.join(UPLOAD_DIR, path.basename(req.body.imageUrl));
      } else {
        imageInput = req.body.imageUrl;
      }
    }

    if (!imageInput) {
      return res.status(400).json({ error: 'Please provide an image file or imageBase64 data URL.' });
    }

    const ocrResult = await processDocumentImage(imageInput);

    res.json({
      success: true,
      confidence: ocrResult.confidence,
      processingTimeMs: ocrResult.processingTimeMs,
      rawText: ocrResult.rawText,
      document: ocrResult.parsed,
    });
  } catch (err) {
    console.error('OCR processing error:', err);
    res.status(500).json({ error: 'Server OCR extraction failed', details: err.message });
  }
});

/**
 * POST /api/ocr/parse-text
 * Parse raw text directly using the strict parser
 */
app.post('/api/ocr/parse-text', (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text string is required in request body.' });
    }

    const parsed = extractDocumentData(text);
    res.json({
      success: true,
      document: parsed,
    });
  } catch (err) {
    console.error('Text parse error:', err);
    res.status(500).json({ error: 'Failed to parse text', details: err.message });
  }
});

// ==================================================================
// 2. UNIFIED VERIFICATION & RISK DECISION PIPELINE
// ==================================================================

/**
 * POST /api/verify
 * Comprehensive multi-vector border control verification
 */
app.post('/api/verify', async (req, res) => {
  try {
    const {
      extractedDoc,
      rawText,
      faceMatchScore = 90,
      caseId,
      officerId = 'OFF-7421',
      referenceData = null,
    } = req.body;

    let docData = extractedDoc;
    if (!docData && rawText) {
      docData = extractDocumentData(rawText);
    }

    if (!docData) {
      return res.status(400).json({ error: 'Either extractedDoc or rawText is required.' });
    }

    // Evaluate Risk across all 6 vectors
    const riskAssessment = assessTravelerRisk({
      parsedDoc: docData,
      faceMatchScore: Number(faceMatchScore),
      rawOcrText: rawText || '',
      referenceData,
    });

    const activeCaseId = caseId || `BG-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    const fullRecord = {
      caseId: activeCaseId,
      time: new Date().toLocaleTimeString(),
      docType: docData.docType || 'Identity Document',
      country: docData.country || 'Unknown',
      name: docData.fullName || docData.name || 'Not Detected',
      dob: docData.dob || docData.dateOfBirth?.formatted || 'Not Detected',
      gender: docData.gender || docData.sex || 'Unspecified',
      careOf: docData.careOf || null,
      docNumber: docData.documentNumber || docData.docNumber || 'Not Detected',
      vidNumber: docData.vidNumber || null,
      address: docData.address || null,
      nationality: docData.nationality || 'Unknown',
      expiry: docData.expiry || docData.expirationDate?.formatted || 'N/A',
      mrz: docData.isMrz ? (docData.allChecksValid ? 'VALID' : 'CHECKSUM_FAILED') : 'NON_MRZ',
      riskScore: riskAssessment.riskScore,
      riskLevel: riskAssessment.riskLevel,
      status: riskAssessment.status,
      docIntegrity: riskAssessment.docIntegrity,
      faceMatch: riskAssessment.faceMatch,
      identityConsistency: riskAssessment.identityConsistency,
      summary: riskAssessment.summary,
      reasons: riskAssessment.reasons,
      checks: riskAssessment.checks,
      tampering: riskAssessment.tampering,
      watchlistHit: riskAssessment.watchlistHit,
      officer: officerId,
      createdAt: new Date().toISOString(),
      ocrRawText: rawText || '',
    };

    // Save to SQLite verifications history
    db.saveVerification(fullRecord);

    // Commit to SHA-256 Ledger
    const lastBlock = db.getLastLedgerEntry();
    const nextIdx = lastBlock ? Number(lastBlock.idx) + 1 : 1;
    const prevHash = lastBlock ? lastBlock.current_hash : GENESIS_PREVIOUS_HASH;
    const timestamp = new Date().toISOString();

    const auditData = {
      caseId: activeCaseId,
      docType: fullRecord.docType,
      travelerName: fullRecord.name,
      documentNumber: fullRecord.docNumber,
      mrzDetected: Boolean(docData.isMrz),
      mrzValid: Boolean(docData.allChecksValid),
      biometricMatchScore: fullRecord.faceMatch,
      riskScore: fullRecord.riskScore,
      riskLevel: fullRecord.riskLevel,
      officer: officerId,
    };

    const currentHash = calculateBlockHash(nextIdx, timestamp, prevHash, auditData, fullRecord.status);

    const committedBlock = db.appendLedgerEntry({
      timestamp,
      previousHash: prevHash,
      currentHash,
      status: fullRecord.status,
      caseId: typeof caseId === 'number' ? caseId : null,
      data: auditData,
    });

    res.json({
      success: true,
      caseId: activeCaseId,
      verificationRecord: fullRecord,
      riskAssessment,
      ledgerBlock: ledgerRowToJSON(committedBlock),
    });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Verification failed', details: err.message });
  }
});

/**
 * POST /api/verify-document (Backward compatibility endpoint)
 */
app.post('/api/verify-document', (req, res) => {
  try {
    const { extractedText, matchScore, caseId, verificationRecord } = req.body;

    if (verificationRecord) {
      try {
        db.saveVerification(verificationRecord);
      } catch (e) {
        console.error('Error saving record in verify-document:', e);
      }
    }

    const mrzRegex = /[A-Z0-9<]{2}[A-Z0-9<]{5,}/;
    const mrzMatch = extractedText ? mrzRegex.test(extractedText.replace(/\s+/g, '')) : false;
    const score = Number.isFinite(matchScore) ? matchScore : 0;
    const status = mrzMatch && score > 50 ? 'VERIFIED' : 'FLAGGED';

    const last = db.getLastLedgerEntry();
    const index = last ? Number(last.idx) + 1 : 1;
    const previousHash = last ? last.current_hash : GENESIS_PREVIOUS_HASH;
    const timestamp = new Date().toISOString();

    const auditData = {
      mrzDetected: mrzMatch,
      biometricMatchScore: score,
      extractedTextPreview: (extractedText || '').slice(0, 120),
    };

    const currentHash = calculateBlockHash(index, timestamp, previousHash, auditData, status);

    const entry = db.appendLedgerEntry({
      timestamp,
      previousHash,
      currentHash,
      status,
      caseId: typeof caseId === 'number' ? caseId : null,
      data: auditData,
    });

    res.json({
      status,
      message: 'Verification completed and logged to cryptographic chain.',
      ledgerEntry: ledgerRowToJSON(entry),
    });
  } catch (err) {
    console.error('Verify document error:', err);
    res.status(500).json({ error: 'Failed to record document verification', details: err.message });
  }
});

// ==================================================================
// 3. SAMPLE CASES (DEMO DATABASE)
// ==================================================================

app.post('/api/cases', upload.single('image'), (req, res) => {
  try {
    const { name, label, notes } = req.body;
    if (!req.file) return res.status(400).json({ error: 'An image file is required.' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'A name/label for the sample is required.' });
    if (label !== 'genuine' && label !== 'fake') {
      return res.status(400).json({ error: "label must be exactly 'genuine' or 'fake'." });
    }

    const created = db.createCase({
      name: name.trim(),
      label,
      notes: (notes || '').trim(),
      imageFilename: req.file.filename,
    });
    res.status(201).json(caseToJSON(created));
  } catch (err) {
    console.error('Error creating sample case:', err);
    res.status(500).json({ error: 'Failed to save sample case.' });
  }
});

app.get('/api/cases', (req, res) => {
  try {
    const rows = db.listCases();
    res.json(rows.map(caseToJSON));
  } catch (err) {
    console.error('Error listing cases:', err);
    res.status(500).json({ error: 'Failed to retrieve cases' });
  }
});

app.delete('/api/cases/:id', (req, res) => {
  try {
    const row = db.deleteCase(Number(req.params.id));
    if (row) {
      const filePath = path.join(UPLOAD_DIR, row.image_filename);
      fs.unlink(filePath, () => {});
    }
    res.json({ deleted: !!row });
  } catch (err) {
    console.error('Error deleting case:', err);
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

// ==================================================================
// 4. VERIFICATIONS HISTORY
// ==================================================================

app.get('/api/verifications', (req, res) => {
  try {
    const { query, riskLevel, limit } = req.query;
    const list = db.listVerifications({ query, riskLevel, limit });
    res.json(list);
  } catch (err) {
    console.error('Failed to list verifications:', err);
    res.status(500).json({ error: 'Failed to retrieve verifications' });
  }
});

app.post('/api/verifications', (req, res) => {
  try {
    const saved = db.saveVerification(req.body);
    res.status(201).json(saved);
  } catch (err) {
    console.error('Failed to save verification:', err);
    res.status(500).json({ error: 'Failed to save verification' });
  }
});

app.delete('/api/verifications', (req, res) => {
  try {
    db.clearVerifications();
    res.json({ success: true, message: 'All verification history cleared' });
  } catch (err) {
    console.error('Failed to clear verifications:', err);
    res.status(500).json({ error: 'Failed to clear verifications' });
  }
});

// ==================================================================
// 5. CRYPTOGRAPHIC AUDIT TRAIL & TAMPER VERIFICATION
// ==================================================================

app.get('/api/audit-trail', (req, res) => {
  try {
    const rows = db.listLedger();
    const verification = verifyChainIntegrity(rows);

    res.json({
      chainValid: verification.chainValid,
      totalRecords: rows.length,
      tamperedBlockIndex: verification.tamperedBlockIndex,
      integrityDetails: verification.details,
      ledger: rows.map(ledgerRowToJSON),
    });
  } catch (err) {
    console.error('Failed to list audit trail:', err);
    res.status(500).json({ error: 'Failed to retrieve audit trail' });
  }
});

app.delete('/api/audit-trail', (req, res) => {
  try {
    db.clearLedger();
    res.json({ success: true, message: 'Cryptographic ledger reset to Genesis state' });
  } catch (err) {
    console.error('Failed to clear ledger:', err);
    res.status(500).json({ error: 'Failed to reset audit ledger' });
  }
});

app.post('/api/audit-trail/verify', (req, res) => {
  try {
    const rows = db.listLedger();
    const result = verifyChainIntegrity(rows);
    res.json(result);
  } catch (err) {
    console.error('Chain verification error:', err);
    res.status(500).json({ error: 'Failed to verify chain' });
  }
});

// ==================================================================
// 6. WATCHLIST & SANCTIONS SCREENING
// ==================================================================

app.get('/api/watchlist', (req, res) => {
  try {
    res.json(getWatchlist());
  } catch (err) {
    res.status(500).json({ error: 'Failed to get watchlist' });
  }
});

app.post('/api/watchlist/check', (req, res) => {
  try {
    const { name, docNumber, nationality } = req.body;
    const result = screenTraveler({ name, docNumber, nationality });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to screen traveler' });
  }
});

// ==================================================================
// 7. ANALYTICS & METRICS
// ==================================================================

app.get('/api/analytics/stats', (req, res) => {
  try {
    const stats = db.getAnalytics();
    res.json(stats);
  } catch (err) {
    console.error('Failed to get analytics:', err);
    res.status(500).json({ error: 'Failed to retrieve analytics' });
  }
});

// ==================================================================
// 8. SYSTEM HEALTH & DIAGNOSTICS
// ==================================================================

app.get('/api/system/health', (req, res) => {
  try {
    const uptimeSec = Math.round((Date.now() - SERVER_START_TIME) / 1000);
    const dbStats = db.getAnalytics();
    const dbSize = fs.existsSync(path.join(__dirname, 'borderguard.db'))
      ? fs.statSync(path.join(__dirname, 'borderguard.db')).size
      : 0;

    res.json({
      status: 'HEALTHY',
      service: 'BorderGuard AI Verification & Risk Engine',
      version: '2.5.0',
      uptimeSeconds: uptimeSec,
      database: {
        engine: 'SQLite3 (node:sqlite native WAL)',
        sizeBytes: dbSize,
        verificationsCount: dbStats.totalVerifications,
        ledgerBlocksCount: dbStats.totalLedgerBlocks,
        sampleCasesCount: dbStats.totalSampleCases,
      },
      engines: {
        ocr: 'Tesseract.js OCR v7 + ICAO Doc 9303 Parser',
        biometrics: '1:1 Vector Distance Comparator',
        riskEngine: 'Multi-Vector Border Control Risk Classifier',
        cryptography: 'SHA-256 Merkle Ledger',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', error: err.message });
  }
});

// Static frontend serving if built
const DIST_DIR = path.join(__dirname, '../dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('BorderGuard AI Enterprise Security Backend active and running.');
  });
}

// Server start
const server = app.listen(PORT, () => {
  console.log(`[BorderGuard AI Backend] Secure audit server active on port ${PORT}`);
  console.log(`[Database] SQLite file: ${path.join(__dirname, 'borderguard.db')}`);
  console.log(`[Uploads] Storage folder: ${UPLOAD_DIR}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use by a background instance.`);
  } else {
    console.error('Server error:', err);
  }
});
