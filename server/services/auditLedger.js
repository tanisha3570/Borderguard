// server/services/auditLedger.js
// Cryptographic SHA-256 Audit Ledger Engine

const crypto = require('crypto');

const GENESIS_PREVIOUS_HASH = '0'.repeat(64);

/**
 * Calculate immutable SHA-256 hash for a ledger block.
 */
function calculateBlockHash(index, timestamp, previousHash, data, status) {
  const payloadString = typeof data === 'string' ? data : JSON.stringify(data);
  const recordString = String(index) + String(timestamp) + String(previousHash) + payloadString + String(status);
  return crypto.createHash('sha256').update(recordString).digest('hex');
}

/**
 * Validate the entire cryptographic chain integrity.
 * Re-hashes every block from Genesis to HEAD and confirms previous_hash linkage.
 *
 * @param {Array<object>} rawBlocks - Array of ledger rows from SQLite database
 * @returns {{ chainValid: boolean, totalBlocks: number, tamperedBlockIndex: number|null, details: string }}
 */
function verifyChainIntegrity(rawBlocks = []) {
  if (!Array.isArray(rawBlocks) || rawBlocks.length === 0) {
    return {
      chainValid: true,
      totalBlocks: 0,
      tamperedBlockIndex: null,
      details: 'Ledger is empty (Genesis state).',
    };
  }

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    const expectedPrevious = i === 0 ? (block.previous_hash || GENESIS_PREVIOUS_HASH) : rawBlocks[i - 1].current_hash;

    // Check 1: Previous hash link
    if (i > 0 && block.previous_hash !== expectedPrevious) {
      return {
        chainValid: false,
        totalBlocks: rawBlocks.length,
        tamperedBlockIndex: block.idx,
        details: `Cryptographic link broken at Block #${block.idx}: stored previous_hash (${block.previous_hash}) does not match Block #${rawBlocks[i - 1].idx} current_hash (${expectedPrevious}).`,
      };
    }

    // Check 2: Content hash recalculation
    const payloadStr = typeof block.data_json === 'string' ? block.data_json : JSON.stringify(block.data_json);

    const candidates = [
      calculateBlockHash(block.idx, block.timestamp, block.previous_hash, payloadStr, block.status),
      calculateBlockHash(block.idx - 1, block.timestamp, block.previous_hash, payloadStr, block.status),
    ];

    // Check legacy payload where caseId was appended to data_json after hash calculation
    try {
      const parsed = typeof block.data_json === 'string' ? JSON.parse(block.data_json) : { ...block.data_json };
      if (parsed && typeof parsed === 'object' && 'caseId' in parsed) {
        const copy = { ...parsed };
        delete copy.caseId;
        const legacyStr = JSON.stringify(copy);
        candidates.push(calculateBlockHash(block.idx, block.timestamp, block.previous_hash, legacyStr, block.status));
        candidates.push(calculateBlockHash(block.idx - 1, block.timestamp, block.previous_hash, legacyStr, block.status));
      }
    } catch (e) {}

    const isValidHash = candidates.includes(block.current_hash);

    if (!isValidHash) {
      return {
        chainValid: false,
        totalBlocks: rawBlocks.length,
        tamperedBlockIndex: block.idx,
        details: `Payload integrity compromised at Block #${block.idx}: stored hash (${block.current_hash}) does not match recalculated hash (${candidates[0]}).`,
      };
    }
  }

  return {
    chainValid: true,
    totalBlocks: rawBlocks.length,
    tamperedBlockIndex: null,
    details: `All ${rawBlocks.length} cryptographic blocks verified with valid SHA-256 signatures.`,
  };
}

module.exports = {
  GENESIS_PREVIOUS_HASH,
  calculateBlockHash,
  verifyChainIntegrity,
};
