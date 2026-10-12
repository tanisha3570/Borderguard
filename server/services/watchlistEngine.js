// server/services/watchlistEngine.js
// Watchlist & Sanctions Screening Engine (Interpol, UN Sanctions, SLTD)

const { tokenSimilarity, stringSimilarity } = require('./strictMatcher');

const DEFAULT_WATCHLIST = [
  {
    id: 'WL-001',
    name: 'VIKTOR SOKOLOV',
    aliases: ['VICTOR SOKOLOFF', 'V. SOKOLOV'],
    docNumber: 'L9928114A',
    nationality: 'Russian',
    category: 'INTERPOL RED NOTICE',
    severity: 'CRITICAL',
    details: 'International arrest warrant for transnational cyber intrusion & financial fraud.',
    action: 'IMMEDIATE DETAINMENT & NOTIFY INTERPOL NCB',
  },
  {
    id: 'WL-002',
    name: 'MARCUS VANCE',
    aliases: ['MARK VANCE'],
    docNumber: 'P88371900',
    nationality: 'American',
    category: 'STOLEN / LOST PASSPORT (SLTD)',
    severity: 'HIGH',
    details: 'Credential reported stolen in Zurich, Switzerland on 2025-11-14.',
    action: 'CONFISCATE CREDENTIAL & SECONDARY SCREENING',
  },
  {
    id: 'WL-003',
    name: 'TARIQ AL-MANSOOR',
    aliases: ['TAREQ MANSOOR', 'T. AL MANSOOR'],
    docNumber: 'D44910238',
    nationality: 'Syrian',
    category: 'UN SECURITY COUNCIL SANCTIONS',
    severity: 'CRITICAL',
    details: 'Designated individual under UNSC Resolution 2253 travel ban.',
    action: 'DENY ENTRY & ESCORT TO BORDER POLICE',
  },
  {
    id: 'WL-004',
    name: 'ANNA MARIA ERIKSSON',
    aliases: ['ANNA ERIKSSON'],
    docNumber: 'L8988901C',
    nationality: 'Utopian',
    category: 'TAMPERED CREDENTIAL FLAG',
    severity: 'HIGH',
    details: 'Fraud alert: Known altered identity credential circulating with manipulated expiry.',
    action: 'SECONDARY INSPECTION MANDATORY',
  },
];

/**
 * Screen a traveler's identity against the watchlist database.
 *
 * @param {object} params
 * @param {string} params.name - Traveler full name
 * @param {string} params.docNumber - Document number
 * @param {string} [params.nationality] - Nationality
 * @returns {{ hit: boolean, matchLevel: 'NONE'|'LOW'|'MEDIUM'|'HIGH'|'EXACT', record: object|null, reason: string|null }}
 */
function screenTraveler({ name, docNumber, nationality }) {
  if (!name && !docNumber) {
    return { hit: false, matchLevel: 'NONE', record: null, reason: null };
  }

  const cleanDoc = String(docNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  for (const item of DEFAULT_WATCHLIST) {
    // 1. Exact document number hit
    const itemDoc = String(item.docNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanDoc && itemDoc && cleanDoc === itemDoc) {
      return {
        hit: true,
        matchLevel: 'EXACT',
        record: item,
        reason: `Direct document number match on ${item.category} (${item.docNumber})`,
      };
    }

    // 2. Name similarity matching
    if (name) {
      const mainSim = tokenSimilarity(name, item.name);
      if (mainSim >= 90) {
        return {
          hit: true,
          matchLevel: mainSim === 100 ? 'EXACT' : 'HIGH',
          record: item,
          reason: `High name match (${mainSim}%) against ${item.category} subject '${item.name}'`,
        };
      }

      // Check aliases
      if (Array.isArray(item.aliases)) {
        for (const alias of item.aliases) {
          const aliasSim = tokenSimilarity(name, alias);
          if (aliasSim >= 90) {
            return {
              hit: true,
              matchLevel: 'HIGH',
              record: item,
              reason: `Alias match (${aliasSim}%) against known pseudonym '${alias}' for '${item.name}'`,
            };
          }
        }
      }
    }
  }

  return {
    hit: false,
    matchLevel: 'NONE',
    record: null,
    reason: null,
  };
}

function getWatchlist() {
  return DEFAULT_WATCHLIST;
}

module.exports = {
  getWatchlist,
  screenTraveler,
};
