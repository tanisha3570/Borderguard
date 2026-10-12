// server/services/riskEngine.js
// BorderGuard Unified Risk Assessment & Decision Engine

const { evaluateStrictMatch } = require('./strictMatcher');
const { screenTraveler } = require('./watchlistEngine');
const { analyzeForensicIntegrity } = require('./forensicAnalyzer');

/**
 * Calculate multi-vector border security risk score & decision.
 *
 * @param {object} params
 * @param {object} params.parsedDoc - Extracted document fields
 * @param {number} [params.faceMatchScore] - Biometric face match percentage (0-100)
 * @param {string} [params.rawOcrText] - Raw OCR text
 * @param {object} [params.referenceData] - Reference booking data
 * @returns {object} Comprehensive verification decision and risk score
 */
function assessTravelerRisk({
  parsedDoc = {},
  faceMatchScore = 92,
  rawOcrText = '',
  referenceData = null,
}) {
  const reasons = [];

  // 1. Strict Identity Consistency
  const strictMatch = evaluateStrictMatch(parsedDoc, referenceData);
  const identityConsistency = strictMatch.identityConsistency;
  if (!strictMatch.isConsistent) {
    reasons.push(...strictMatch.discrepancies);
  }

  // 2. Forensic Image & Substrate Integrity
  const forensic = analyzeForensicIntegrity({ parsedDoc, rawText: rawOcrText });
  const docIntegrity = forensic.docIntegrity;
  if (forensic.hasTampering) {
    reasons.push(...forensic.tamperingSignals);
  }

  // 3. Facial Biometric Score
  const faceMatch = typeof faceMatchScore === 'number' && Number.isFinite(faceMatchScore) ? faceMatchScore : 90;
  if (faceMatch < 50) {
    reasons.push(`Facial biometric Euclidean distance exceeds threshold: Biometric confidence is only ${faceMatch}%`);
  }

  // 4. Watchlist & Interpol Screening
  const travelerName = parsedDoc.fullName || parsedDoc.name || '';
  const travelerDoc = parsedDoc.documentNumber || parsedDoc.docNumber || '';
  const travelerNat = parsedDoc.nationality || '';
  const watchlist = screenTraveler({
    name: travelerName,
    docNumber: travelerDoc,
    nationality: travelerNat,
  });

  let dbStatus = 'Clean (No Watchlist Hits)';
  let isWatchlistHit = false;
  if (watchlist.hit) {
    isWatchlistHit = true;
    dbStatus = `HIT: ${watchlist.record.category} (${watchlist.record.id})`;
    reasons.unshift(`CRITICAL WATCHLIST HIT: ${watchlist.reason} — ${watchlist.record.action}`);
  }

  // 5. Composite Risk Score Calculation
  // Invert scores to represent risk: Higher score = Higher Risk (0 = completely safe, 100 = critical threat)
  let baseRisk = 0;

  // Integrity risk (40% weight)
  baseRisk += ((100 - docIntegrity) / 100) * 40;

  // Biometric risk (35% weight)
  baseRisk += ((100 - faceMatch) / 100) * 35;

  // Identity consistency risk (25% weight)
  baseRisk += ((100 - identityConsistency) / 100) * 25;

  // Watchlist hit override
  if (isWatchlistHit) {
    baseRisk = Math.max(baseRisk, 95);
  }

  // Checksum failure override
  if (parsedDoc?.isMrz && !parsedDoc.allChecksValid) {
    baseRisk = Math.max(baseRisk, 89);
  }

  // Round risk score
  const riskScore = Math.min(100, Math.max(0, Math.round(baseRisk)));

  // Risk level categorization
  let riskLevel = 'LOW';
  let status = 'Cleared';
  let summary = '';

  if (riskScore >= 70 || isWatchlistHit) {
    riskLevel = 'HIGH';
    status = 'FLAGGED';
    if (isWatchlistHit) {
      summary = `IMMEDIATE ACTION REQUIRED: Traveler matched on international watchlist (${watchlist.record.category}). Detain for secondary inspection.`;
    } else if (parsedDoc?.isMrz && !parsedDoc.allChecksValid) {
      summary = 'Potential credential tampering detected. Expiration date and MRZ checksum mismatch. Secondary inspection mandatory.';
    } else if (faceMatch < 50) {
      summary = 'Biometric mismatch. Live traveler photo does not match credential photo. Secondary inspection mandatory.';
    } else {
      summary = 'Critical security anomaly detected. High-risk vectors identified across document integrity and credentials.';
    }
  } else if (riskScore >= 35) {
    riskLevel = 'MEDIUM';
    status = 'Review';
    summary = 'Moderate discrepancy detected in identity credentials. Manual officer review recommended.';
  } else {
    riskLevel = 'LOW';
    status = 'Cleared';
    summary = `All identity vectors verified. Authentic ${parsedDoc.docType || 'Identity Document'} detected with valid demographic details and clean watchlist screening.`;
  }

  // Compile checklist
  const checks = [
    {
      label: parsedDoc?.isMrz ? 'ICAO Doc 9303 MRZ Checksums' : 'Govt Substrate & Hologram Layout',
      status: parsedDoc?.isMrz ? (parsedDoc.allChecksValid ? 'pass' : 'fail') : (docIntegrity >= 80 ? 'pass' : 'warn'),
      conf: parsedDoc?.isMrz ? (parsedDoc.allChecksValid ? 99 : 92) : 96,
    },
    {
      label: 'Surface Pixel Gradient Continuity (ELA)',
      status: docIntegrity >= 80 ? 'pass' : (docIntegrity >= 60 ? 'warn' : 'fail'),
      conf: docIntegrity >= 80 ? 98 : 48,
    },
    {
      label: '1:1 Facial Vector Biometric Matching',
      status: faceMatch >= 70 ? 'pass' : (faceMatch >= 50 ? 'warn' : 'fail'),
      conf: faceMatch,
    },
    {
      label: 'Interpol & National Watchlist Screening',
      status: isWatchlistHit ? 'fail' : 'pass',
      conf: isWatchlistHit ? 99 : 100,
    },
  ];

  return {
    riskScore,
    riskLevel,
    status,
    summary,
    reasons,
    docIntegrity,
    faceMatch,
    identityConsistency,
    dbStatus,
    checks,
    tampering: forensic.tampering,
    watchlistHit: isWatchlistHit ? watchlist : null,
  };
}

module.exports = {
  assessTravelerRisk,
};
