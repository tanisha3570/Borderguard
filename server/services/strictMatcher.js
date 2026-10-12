// server/services/strictMatcher.js
// Strict Cross-Field & Identity Matching Engine
// Compares Visual Inspection Zone (VIZ) with Machine Readable Zone (MRZ) and Reference DB

/** Levenshtein distance between two strings */
function levenshteinDistance(s1 = '', s2 = '') {
  const a = String(s1).toUpperCase().trim();
  const b = String(s2).toUpperCase().trim();
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/** Normalized string similarity score (0 - 100%) */
function stringSimilarity(s1 = '', s2 = '') {
  const a = String(s1).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const b = String(s2).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!a && !b) return 100;
  if (!a || !b) return 0;
  if (a === b) return 100;

  const maxLen = Math.max(a.length, b.length);
  const dist = levenshteinDistance(a, b);
  return Math.max(0, Math.round(((maxLen - dist) / maxLen) * 100));
}

/** Token set similarity (handles reversed given name / surname order) */
function tokenSimilarity(s1 = '', s2 = '') {
  const tokens1 = String(s1).toUpperCase().split(/\s+/).filter(Boolean).sort().join(' ');
  const tokens2 = String(s2).toUpperCase().split(/\s+/).filter(Boolean).sort().join(' ');
  return stringSimilarity(tokens1, tokens2);
}

/** Normalize date string to YYYY-MM-DD for strict comparison */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }
  return str;
}

/**
 * Perform strict multi-vector consistency match between parsed document data
 * and expected / reference values.
 *
 * @param {object} docData - Extracted document fields
 * @param {object} [referenceData] - Optional reference database / ticket / booking data
 * @returns {object} Detailed strict match evaluation
 */
function evaluateStrictMatch(docData = {}, referenceData = null) {
  const discrepancies = [];
  const fieldMatches = {};
  let totalWeight = 0;
  let accumulatedScore = 0;

  // 1. Name consistency (if MRZ available vs visual or reference)
  const visualName = docData.name || docData.fullName || '';
  const mrzName = docData.isMrz ? (docData.fullName || '') : '';
  const refName = referenceData ? (referenceData.name || '') : '';

  if (mrzName && visualName && mrzName !== visualName) {
    const sim = tokenSimilarity(mrzName, visualName);
    fieldMatches.name = { visual: visualName, mrz: mrzName, similarity: sim, match: sim >= 85 };
    totalWeight += 30;
    accumulatedScore += (sim / 100) * 30;
    if (sim < 85) {
      discrepancies.push(`Name discrepancy: Visual (${visualName}) vs MRZ (${mrzName}) similarity ${sim}%`);
    }
  } else if (refName && visualName) {
    const sim = tokenSimilarity(refName, visualName);
    fieldMatches.name = { visual: visualName, reference: refName, similarity: sim, match: sim >= 85 };
    totalWeight += 30;
    accumulatedScore += (sim / 100) * 30;
    if (sim < 85) {
      discrepancies.push(`Name mismatch against reference reservation: ${visualName} vs ${refName}`);
    }
  } else {
    fieldMatches.name = { visual: visualName, match: Boolean(visualName), similarity: visualName ? 100 : 0 };
    totalWeight += 25;
    accumulatedScore += visualName ? 25 : 0;
  }

  // 2. Document Number consistency
  const docNum = String(docData.documentNumber || docData.docNumber || '').replace(/[^A-Z0-9]/gi, '');
  const refDocNum = referenceData ? String(referenceData.documentNumber || referenceData.docNumber || '').replace(/[^A-Z0-9]/gi, '') : '';

  if (refDocNum && docNum) {
    const match = docNum.toUpperCase() === refDocNum.toUpperCase();
    fieldMatches.docNumber = { extracted: docNum, reference: refDocNum, match };
    totalWeight += 25;
    accumulatedScore += match ? 25 : 0;
    if (!match) discrepancies.push(`Document number mismatch: Scanned ${docNum} != Reference ${refDocNum}`);
  } else {
    const valid = Boolean(docData.documentNumberValid || docNum.length >= 5);
    fieldMatches.docNumber = { extracted: docNum, match: valid };
    totalWeight += 25;
    accumulatedScore += valid ? 25 : 0;
  }

  // 3. Date of Birth consistency
  const dob = normalizeDate(docData.dob || docData.dateOfBirth?.iso || docData.dateOfBirth?.raw);
  const refDob = referenceData ? normalizeDate(referenceData.dob) : null;

  if (refDob && dob) {
    const match = dob === refDob;
    fieldMatches.dob = { extracted: dob, reference: refDob, match };
    totalWeight += 20;
    accumulatedScore += match ? 20 : 0;
    if (!match) discrepancies.push(`Date of Birth mismatch: Scanned ${dob} != Reference ${refDob}`);
  } else {
    const valid = Boolean(dob);
    fieldMatches.dob = { extracted: dob, match: valid };
    totalWeight += 20;
    accumulatedScore += valid ? 20 : 0;
  }

  // 4. Expiration date & validity check
  const expiry = normalizeDate(docData.expiry || docData.expirationDate?.iso || docData.expirationDate?.raw);
  let isExpired = false;
  if (expiry && /^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
    const expDate = new Date(expiry);
    isExpired = expDate.getTime() < Date.now();
    if (isExpired) {
      discrepancies.push(`Document is EXPIRED (Expiry Date: ${expiry})`);
    }
  }
  fieldMatches.expiry = { extracted: expiry, isExpired, match: !isExpired };
  totalWeight += 25;
  accumulatedScore += isExpired ? 0 : 25;

  // Final identity consistency score
  const identityConsistency = totalWeight > 0 ? Math.round((accumulatedScore / totalWeight) * 100) : 100;

  return {
    identityConsistency,
    isConsistent: discrepancies.length === 0,
    discrepancies,
    fieldMatches,
  };
}

module.exports = {
  levenshteinDistance,
  stringSimilarity,
  tokenSimilarity,
  normalizeDate,
  evaluateStrictMatch,
};
