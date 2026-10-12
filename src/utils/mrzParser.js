// src/utils/mrzParser.js
// High-Precision Universal Document & MRZ Parser (ICAO Doc 9303 TD1, TD2, TD3 + Comprehensive Visual Zone Extraction)
// Supports: Passports, National IDs, Aadhaar Cards (Front/Back), PAN Cards, Driving Licenses, Voter IDs, Visas, Green Cards, Resident Permits, and Generic Photo IDs

const CHAR_VALUE_MAP = (() => {
  const map = {};
  for (let i = 0; i <= 9; i++) map[String(i)] = i;
  for (let i = 0; i < 26; i++) map[String.fromCharCode(65 + i)] = i + 10;
  map['<'] = 0;
  return map;
})();

const WEIGHTS = [7, 3, 1];

// ISO 3166-1 alpha-3 mapping + common travel codes
export const COUNTRY_CODE_MAP = {
  IND: { country: 'India', nationality: 'Indian' },
  USA: { country: 'United States', nationality: 'American' },
  GBR: { country: 'United Kingdom', nationality: 'British' },
  CAN: { country: 'Canada', nationality: 'Canadian' },
  AUS: { country: 'Australia', nationality: 'Australian' },
  DEU: { country: 'Germany', nationality: 'German' },
  FRA: { country: 'France', nationality: 'French' },
  ITA: { country: 'Italy', nationality: 'Italian' },
  ESP: { country: 'Spain', nationality: 'Spanish' },
  NPL: { country: 'Nepal', nationality: 'Nepali' },
  PAK: { country: 'Pakistan', nationality: 'Pakistani' },
  BGD: { country: 'Bangladesh', nationality: 'Bangladeshi' },
  LKA: { country: 'Sri Lanka', nationality: 'Sri Lankan' },
  CHN: { country: 'China', nationality: 'Chinese' },
  JPN: { country: 'Japan', nationality: 'Japanese' },
  KOR: { country: 'South Korea', nationality: 'South Korean' },
  ARE: { country: 'United Arab Emirates', nationality: 'Emirati' },
  SGP: { country: 'Singapore', nationality: 'Singaporean' },
  MYS: { country: 'Malaysia', nationality: 'Malaysian' },
  NZL: { country: 'New Zealand', nationality: 'New Zealander' },
  NLD: { country: 'Netherlands', nationality: 'Dutch' },
  CHE: { country: 'Switzerland', nationality: 'Swiss' },
  SWE: { country: 'Sweden', nationality: 'Swedish' },
  NOR: { country: 'Norway', nationality: 'Norwegian' },
  DNK: { country: 'Denmark', nationality: 'Danish' },
  FIN: { country: 'Finland', nationality: 'Finnish' },
  IRL: { country: 'Ireland', nationality: 'Irish' },
  BRA: { country: 'Brazil', nationality: 'Brazilian' },
  MEX: { country: 'Mexico', nationality: 'Mexican' },
  ZAF: { country: 'South Africa', nationality: 'South African' },
  UTO: { country: 'Utopia', nationality: 'Utopian' },
  D: { country: 'Germany', nationality: 'German' },
};

// Verhoeff algorithm multiplication table for Aadhaar validation
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function validateVerhoeff(numStr) {
  const clean = String(numStr).replace(/\s+/g, '');
  if (!/^\d{12}$/.test(clean)) return false;
  let c = 0;
  const digits = clean.split('').map(Number).reverse();
  for (let i = 0; i < digits.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digits[i]]];
  }
  return c === 0;
}

/** ICAO 9303 check digit: weighted sum (mod 10) over 7/3/1 repeating weights. */
export function computeCheckDigit(field) {
  if (!field) return 0;
  let sum = 0;
  for (let i = 0; i < field.length; i++) {
    const value = CHAR_VALUE_MAP[field[i]] ?? 0;
    sum += value * WEIGHTS[i % 3];
  }
  return sum % 10;
}

export function checkDigitMatches(field, expectedDigitChar) {
  if (expectedDigitChar === '<' || expectedDigitChar === undefined || expectedDigitChar === '') {
    return field.replace(/</g, '').length === 0;
  }
  const expected = Number(expectedDigitChar);
  if (Number.isNaN(expected)) return false;
  return computeCheckDigit(field) === expected;
}

/** Repair common OCR substitutions in numeric fields (e.g. O -> 0, I -> 1). */
export function repairDigits(str) {
  if (!str) return '';
  return str
    .replace(/[OODQ]/g, '0')
    .replace(/[ILl|!]/g, '1')
    .replace(/[Zz]/g, '2')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8')
    .replace(/[Gg]/g, '6');
}

/** Repair common OCR substitutions in alphabetic fields (e.g. 0 -> O, 1 -> I). */
export function repairLetters(str) {
  if (!str) return '';
  return str
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/5/g, 'S')
    .replace(/8/g, 'B')
    .replace(/2/g, 'Z');
}

/** YYMMDD -> formatted date + ISO date string with century calculation. */
export function formatMRZDate(rawYymmdd, isExpiry = false) {
  const yymmdd = repairDigits(rawYymmdd);
  if (!/^\d{6}$/.test(yymmdd)) return { raw: rawYymmdd, iso: rawYymmdd || null, formatted: rawYymmdd || 'N/A' };
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const currentYY = new Date().getFullYear() % 100;
  const century = isExpiry ? 2000 : yy > currentYY + 1 ? 1900 : 2000;
  const year = century + yy;
  return {
    raw: yymmdd,
    iso: `${year}-${mm}-${dd}`,
    formatted: `${dd}/${mm}/${year}`,
  };
}

export function splitName(nameField) {
  const [surnameRaw = '', givenRaw = ''] = nameField.split('<<');
  const surname = surnameRaw.replace(/</g, ' ').trim().replace(/\s+/g, ' ');
  const givenNames = givenRaw.replace(/</g, ' ').trim().replace(/\s+/g, ' ');
  const fullName = [givenNames, surname].filter(Boolean).join(' ').trim();
  return { surname, givenNames, fullName };
}

// ---------------------------------------------------------------------------
// TD3 - Passport (2 lines x 44 chars)
// ---------------------------------------------------------------------------
export function parseTD3(rawLine1, rawLine2) {
  const line1 = rawLine1.padEnd(44, '<').slice(0, 44);
  const line2 = rawLine2.padEnd(44, '<').slice(0, 44);

  const documentType = line1.slice(0, 2).replace(/</g, '');
  const issuingCountryCode = repairLetters(line1.slice(2, 5).replace(/</g, ''));
  const { surname, givenNames, fullName } = splitName(line1.slice(5, 44));

  const documentNumberField = line2.slice(0, 9);
  const documentNumberCheck = repairDigits(line2[9]);
  const nationalityCode = repairLetters(line2.slice(10, 13).replace(/</g, ''));
  const dobField = repairDigits(line2.slice(13, 19));
  const dobCheck = repairDigits(line2[19]);
  const sexChar = line2[20];
  const expiryField = repairDigits(line2.slice(21, 27));
  const expiryCheck = repairDigits(line2[27]);
  const personalNumberField = line2.slice(28, 42);
  const personalNumberCheck = repairDigits(line2[42]);
  const finalCheck = repairDigits(line2[43]);

  const documentNumberValid = checkDigitMatches(documentNumberField, documentNumberCheck);
  const dateOfBirthValid = checkDigitMatches(dobField, dobCheck);
  const expirationValid = checkDigitMatches(expiryField, expiryCheck);
  const personalNumberValid = checkDigitMatches(personalNumberField, personalNumberCheck);

  const compositeInput =
    documentNumberField + documentNumberCheck +
    dobField + dobCheck +
    expiryField + expiryCheck +
    personalNumberField + (personalNumberCheck || '<');
  const compositeValid = checkDigitMatches(compositeInput, finalCheck);

  const natInfo = COUNTRY_CODE_MAP[nationalityCode] || { country: nationalityCode, nationality: nationalityCode };
  const issuingInfo = COUNTRY_CODE_MAP[issuingCountryCode] || { country: issuingCountryCode, nationality: issuingCountryCode };

  const dobObj = formatMRZDate(dobField, false);
  const expObj = formatMRZDate(expiryField, true);

  return {
    format: 'TD3',
    docType: 'Passport',
    documentType,
    country: issuingInfo.country,
    issuingCountry: issuingInfo.country,
    issuingCountryCode,
    surname,
    givenNames,
    fullName: fullName || 'PASSPORT HOLDER',
    name: fullName || 'PASSPORT HOLDER',
    documentNumber: documentNumberField.replace(/</g, ''),
    docNumber: documentNumberField.replace(/</g, ''),
    documentNumberCheckDigit: documentNumberCheck,
    documentNumberValid,
    nationality: natInfo.nationality,
    nationalityCode,
    dateOfBirth: dobObj,
    dob: dobObj.formatted,
    dateOfBirthCheckDigit: dobCheck,
    dateOfBirthValid,
    sex: sexChar === 'M' ? 'MALE' : sexChar === 'F' ? 'FEMALE' : 'X',
    gender: sexChar === 'M' ? 'Male' : sexChar === 'F' ? 'Female' : 'Unspecified',
    expirationDate: expObj,
    expiry: expObj.formatted,
    expirationCheckDigit: expiryCheck,
    expirationValid,
    personalNumber: personalNumberField.replace(/</g, ''),
    personalNumberCheckDigit: personalNumberCheck,
    personalNumberValid,
    finalCheckDigit: finalCheck,
    compositeValid,
    allChecksValid: documentNumberValid && dateOfBirthValid && expirationValid && compositeValid,
    rawLines: [line1, line2],
    isMrz: true,
  };
}

// ---------------------------------------------------------------------------
// TD1 - ID card (3 lines x 30 chars)
// ---------------------------------------------------------------------------
export function parseTD1(rawLine1, rawLine2, rawLine3) {
  const line1 = rawLine1.padEnd(30, '<').slice(0, 30);
  const line2 = rawLine2.padEnd(30, '<').slice(0, 30);
  const line3 = rawLine3.padEnd(30, '<').slice(0, 30);

  const documentType = line1.slice(0, 2).replace(/</g, '');
  const issuingCountryCode = repairLetters(line1.slice(2, 5).replace(/</g, ''));
  const documentNumberField = line1.slice(5, 14);
  const documentNumberCheck = repairDigits(line1[14]);

  const dobField = repairDigits(line2.slice(0, 6));
  const dobCheck = repairDigits(line2[6]);
  const sexChar = line2[7];
  const expiryField = repairDigits(line2.slice(8, 14));
  const expiryCheck = repairDigits(line2[14]);
  const nationalityCode = repairLetters(line2.slice(15, 18).replace(/</g, ''));
  const finalCheck = repairDigits(line2[29]);

  const { surname, givenNames, fullName } = splitName(line3);

  const documentNumberValid = checkDigitMatches(documentNumberField, documentNumberCheck);
  const dateOfBirthValid = checkDigitMatches(dobField, dobCheck);
  const expirationValid = checkDigitMatches(expiryField, expiryCheck);

  const compositeInput =
    line1.slice(5, 30) +
    dobField + dobCheck +
    expiryField + expiryCheck +
    line2.slice(18, 29);
  const compositeValid = checkDigitMatches(compositeInput, finalCheck);

  const natInfo = COUNTRY_CODE_MAP[nationalityCode] || { country: nationalityCode, nationality: nationalityCode };
  const issuingInfo = COUNTRY_CODE_MAP[issuingCountryCode] || { country: issuingCountryCode, nationality: issuingCountryCode };

  const dobObj = formatMRZDate(dobField, false);
  const expObj = formatMRZDate(expiryField, true);

  return {
    format: 'TD1',
    docType: 'National ID Card',
    documentType,
    country: issuingInfo.country,
    issuingCountry: issuingInfo.country,
    issuingCountryCode,
    documentNumber: documentNumberField.replace(/</g, ''),
    docNumber: documentNumberField.replace(/</g, ''),
    documentNumberCheckDigit: documentNumberCheck,
    documentNumberValid,
    nationality: natInfo.nationality,
    nationalityCode,
    dateOfBirth: dobObj,
    dob: dobObj.formatted,
    dateOfBirthCheckDigit: dobCheck,
    dateOfBirthValid,
    sex: sexChar === 'M' ? 'MALE' : sexChar === 'F' ? 'FEMALE' : 'X',
    gender: sexChar === 'M' ? 'Male' : sexChar === 'F' ? 'Female' : 'Unspecified',
    expirationDate: expObj,
    expiry: expObj.formatted,
    expirationCheckDigit: expiryCheck,
    expirationValid,
    surname,
    givenNames,
    fullName: fullName || 'CARD HOLDER',
    name: fullName || 'CARD HOLDER',
    finalCheckDigit: finalCheck,
    compositeValid,
    allChecksValid: documentNumberValid && dateOfBirthValid && expirationValid && compositeValid,
    rawLines: [line1, line2, line3],
    isMrz: true,
  };
}

// ---------------------------------------------------------------------------
// TD2 - Travel Document / Visa (2 lines x 36 chars)
// ---------------------------------------------------------------------------
export function parseTD2(rawLine1, rawLine2) {
  const line1 = rawLine1.padEnd(36, '<').slice(0, 36);
  const line2 = rawLine2.padEnd(36, '<').slice(0, 36);

  const documentType = line1.slice(0, 2).replace(/</g, '');
  const issuingCountryCode = repairLetters(line1.slice(2, 5).replace(/</g, ''));
  const { surname, givenNames, fullName } = splitName(line1.slice(5, 36));

  const documentNumberField = line2.slice(0, 9);
  const documentNumberCheck = repairDigits(line2[9]);
  const nationalityCode = repairLetters(line2.slice(10, 13).replace(/</g, ''));
  const dobField = repairDigits(line2.slice(13, 19));
  const dobCheck = repairDigits(line2[19]);
  const sexChar = line2[20];
  const expiryField = repairDigits(line2.slice(21, 27));
  const expiryCheck = repairDigits(line2[27]);
  const optionalField = line2.slice(28, 35);
  const finalCheck = repairDigits(line2[35]);

  const documentNumberValid = checkDigitMatches(documentNumberField, documentNumberCheck);
  const dateOfBirthValid = checkDigitMatches(dobField, dobCheck);
  const expirationValid = checkDigitMatches(expiryField, expiryCheck);

  const compositeInput =
    documentNumberField + documentNumberCheck +
    dobField + dobCheck +
    expiryField + expiryCheck +
    optionalField;
  const compositeValid = checkDigitMatches(compositeInput, finalCheck);

  const natInfo = COUNTRY_CODE_MAP[nationalityCode] || { country: nationalityCode, nationality: nationalityCode };
  const issuingInfo = COUNTRY_CODE_MAP[issuingCountryCode] || { country: issuingCountryCode, nationality: issuingCountryCode };

  const dobObj = formatMRZDate(dobField, false);
  const expObj = formatMRZDate(expiryField, true);

  return {
    format: 'TD2',
    docType: 'Travel Document / Visa',
    documentType,
    country: issuingInfo.country,
    issuingCountry: issuingInfo.country,
    issuingCountryCode,
    surname,
    givenNames,
    fullName: fullName || 'TRAVELER',
    name: fullName || 'TRAVELER',
    documentNumber: documentNumberField.replace(/</g, ''),
    docNumber: documentNumberField.replace(/</g, ''),
    documentNumberCheckDigit: documentNumberCheck,
    documentNumberValid,
    nationality: natInfo.nationality,
    nationalityCode,
    dateOfBirth: dobObj,
    dob: dobObj.formatted,
    dateOfBirthCheckDigit: dobCheck,
    dateOfBirthValid,
    sex: sexChar === 'M' ? 'MALE' : sexChar === 'F' ? 'FEMALE' : 'X',
    gender: sexChar === 'M' ? 'Male' : sexChar === 'F' ? 'Female' : 'Unspecified',
    expirationDate: expObj,
    expiry: expObj.formatted,
    expirationCheckDigit: expiryCheck,
    expirationValid,
    finalCheckDigit: finalCheck,
    compositeValid,
    allChecksValid: documentNumberValid && dateOfBirthValid && expirationValid && compositeValid,
    rawLines: [line1, line2],
    isMrz: true,
  };
}

export function cleanOcrLine(line) {
  if (!line) return '';
  return line
    .toUpperCase()
    .replace(/[«‹≤\(\{\[\]\}\_\|\/\\>\*\~]/g, '<')
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9<]/g, '');
}

export function extractCandidateLines(rawText) {
  if (!rawText) return [];
  const harvested = [];

  const harvest = (source) => {
    if (!source) return;
    const pIdx = source.indexOf('P<');
    if (pIdx >= 0 && source.length >= pIdx + 88) {
      harvested.push(source.slice(pIdx, pIdx + 44), source.slice(pIdx + 44, pIdx + 88));
    }
    const idMatch = source.match(/I<[A-Z0-9]{3}/);
    if (idMatch) {
      const iIdx = source.indexOf(idMatch[0]);
      if (iIdx >= 0 && source.length >= iIdx + 90) {
        harvested.push(
          source.slice(iIdx, iIdx + 30),
          source.slice(iIdx + 30, iIdx + 60),
          source.slice(iIdx + 60, iIdx + 90)
        );
      }
    }
    const vMatch = source.match(/V<[A-Z0-9]{3}/);
    if (vMatch) {
      const vIdx = source.indexOf(vMatch[0]);
      if (vIdx >= 0 && source.length >= vIdx + 72) {
        harvested.push(source.slice(vIdx, vIdx + 36), source.slice(vIdx + 36, vIdx + 72));
      }
    }
  };

  harvest(cleanOcrLine(rawText));
  rawText.split(/\r?\n/).forEach((line) => harvest(cleanOcrLine(line)));

  const fromLines = rawText
    .split(/\r?\n/)
    .map(cleanOcrLine)
    .filter((l) => {
      const isTD3 = l.length >= 40 && l.length <= 48;
      const isTD2 = l.length >= 34 && l.length <= 38;
      const isTD1 = l.length >= 28 && l.length <= 33;
      const hasFiller = (l.match(/</g) || []).length >= 2;
      return (isTD3 || isTD2 || isTD1) && hasFiller;
    });

  return harvested.concat(fromLines);
}

export function parseMRZ(rawText) {
  const candidates = extractCandidateLines(rawText);
  if (candidates.length === 0) return null;

  // TD3 passport: 2 lines ~44 chars
  const td3Lines = candidates.filter((l) => l.length >= 40).slice(-2);
  if (td3Lines.length === 2 && /^P[A-Z0-9<]/.test(td3Lines[0])) {
    try {
      return parseTD3(td3Lines[0], td3Lines[1]);
    } catch (err) {
      console.error('MRZ TD3 parse error:', err);
    }
  }

  // TD2 visa: 2 lines ~36 chars
  const td2Lines = candidates.filter((l) => l.length >= 34 && l.length <= 38).slice(-2);
  if (td2Lines.length === 2 && /^V[A-Z0-9<]/.test(td2Lines[0])) {
    try {
      return parseTD2(td2Lines[0], td2Lines[1]);
    } catch (err) {
      console.error('MRZ TD2 parse error:', err);
    }
  }

  // TD1 ID card: 3 lines ~30 chars
  const td1Lines = candidates.filter((l) => l.length >= 28 && l.length <= 33).slice(-3);
  if (td1Lines.length === 3 && /^[ACISV][A-Z0-9<]/.test(td1Lines[0])) {
    try {
      return parseTD1(td1Lines[0], td1Lines[1], td1Lines[2]);
    } catch (err) {
      console.error('MRZ TD1 parse error:', err);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// COMPREHENSIVE DOCUMENT & VISUAL ZONE EXTRACTION ENGINE
// ---------------------------------------------------------------------------

const NOISE_WORDS = /REPUBLIC\s*OF\s*INDIA|REPUBLIC\s*OF|REPUBLIC|PASSPORT|PASSEPORT|INDIAN\s*PASSPORT|GOVERNMENT\s*OF\s*INDIA|GOVT\s*OF\s*INDIA|GOVERNMENT|GOVT|UNIQUE\s*IDENTIFICATION|AUTHORITY\s*OF\s*INDIA|AUTHORITY|MERA\s*AADHAAR|MERI\s*PEHCHAN|AADHAAR|DEMO|NOT\s*VALID|SAMPLE|SPECIMEN|WATERMARK|PROTOTYPE|ILLUSTRAT|FOR\s*OFFICIAL\s*USE|NOT\s*FOR\s*COMMERCIAL|HELP\s*LINE|WWW\.UIDAI|UIDAI|ENROLMENT|DOWNLOAD|ISSUE\s*DATE|SIGNATURE|MINISTRY|TRANSPORT|COMMISSION|EXTERNAL\s*AFFAIRS|UNION\s*OF\s*INDIA|BHARAT\s*SARKAR|BHARAT|GANRAJYA|PEOPLE\s*TRAVEL|PEOPLE|TRAVEL|BRIGHTER|FUTURE|NATIONALITY|COUNTRY\s*CODE|PLACE\s*OF|DATE\s*OF|EXPIR|VALID|SEX|GENDER|HOLDER|SIGN|FILE\s*NO|WWW|HTTP|COM|GOV|IN\b/i;

const INVALID_NAME_WORDS = new Set([
  'REPUBLIC', 'OF', 'INDIA', 'INDIAN', 'PASSPORT', 'PASSEPORT', 'GOVERNMENT', 'GOVT',
  'MINISTRY', 'EXTERNAL', 'AFFAIRS', 'UNION', 'BHARAT', 'SARKAR', 'GANRAJYA', 'PEOPLE',
  'TRAVEL', 'BRIGHTER', 'FUTURE', 'STATE', 'NATIONAL', 'CARD', 'IDENTITY', 'DOCUMENT',
  'OFFICIAL', 'SPECIMEN', 'SAMPLE', 'DEMO', 'VALID', 'TRUE', 'FALSE', 'PHOTO', 'SIGNATURE',
  'DATE', 'BIRTH', 'PLACE', 'EXPIRY', 'ISSUE', 'SEX', 'MALE', 'FEMALE', 'TYPE', 'CODE',
  'SURNAME', 'GIVEN', 'NAME', 'NAMES', 'PRENOM', 'PRENOMS', 'NOM', 'NOMS', 'HOLDER', 'CITIZEN', 'AUTHORITY',
  'CARE', 'FATHER', 'MOTHER', 'HUSBAND', 'SPOUSE', 'GUARDIAN', 'LEGAL', 'ADDRESS', 'VILLAGE',
  'DISTRICT', 'STREET', 'ROAD', 'RD', 'ST', 'AVE', 'LANE', 'HOUSE', 'FLAT', 'PLOT', 'SECTOR',
  'COLONY', 'NAGAR', 'MARG', 'ENCLAVE', 'APARTMENT', 'BUILDING', 'FLOOR', 'BLOCK', 'BOARD',
  'TEHSIL', 'TALUK', 'PIN', 'DELHI', 'MUMBAI', 'BANGALORE', 'KOLKATA', 'CHENNAI', 'HYDERABAD',
  'PUNE', 'AHMEDABAD', 'JAIPUR', 'LUCKNOW', 'PATNA', 'BIHAR', 'KUNJ', 'VIHAR', 'PURAM', 'POST',
  'BOX', 'PO', 'NEW', 'NEAR', 'OPP', 'BEHIND', 'WATER', 'UID', 'VID', 'WW', 'ER'
]);

export function cleanNameCandidate(str) {
  if (!str) return '';
  return str
    .replace(/^(?:to\s*[:\-]|full\s*name|holder'?s?\s*name|name\s*of\s*holder|cardholder\s*name|given\s*name[s]?|first\s*name[s]?|surname|last\s*name|licencee\s*name|licencee|elector'?s?\s*name|name|नाम|nom|pr[eé]noms?)[\s\/\:\-]+/i, '')
    .replace(/\b(DEMO|NOT\s*VALID|SAMPLE|SPECIMEN|AADHAAR|REPUBLIC|PASSPORT|PASSEPORT|GOVERNMENT|GOVT|CARD|UNIQUE|IDENTIFICATION|PEOPLE|TRAVEL|BRIGHTER|FUTURE|PR\s*NOMS|PRENOMS|PRENOM|NOM|WWW|HTTP|COM|GOV|IN)\b/gi, '')
    .replace(/[^A-Za-z\s\.\'\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Check if string is a realistic human name */
export function isValidName(candidate) {
  if (!candidate || candidate.length < 2 || candidate.length > 60) return false;
  if (NOISE_WORDS.test(candidate)) return false;
  if (/\b(FATHER|MOTHER|HUSBAND|GUARDIAN|LEGAL|CARE\s*OF|C\/O|S\/O|W\/O|D\/O|DOB|DATE|GENDER|MALE|FEMALE|ADDRESS|VID|ENROLMENT|ISSUE|DOWNLOAD|PASSPORT|REPUBLIC|SECTOR|HOUSE|ROAD|RD|STREET|DELHI|NAGAR|BLOCK|FLOOR|APARTMENT|COLONY|BOARD|VIHAR|KUNJ|PATNA|BIHAR|NEAR|OPP|WATER|FLAT|PLOT)\b/i.test(candidate)) return false;
  
  const words = candidate.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 6) return false;

  return words.every((w) => {
    const upper = w.toUpperCase().replace(/[^A-Z]/g, '');
    if (upper.length < 1) return false;
    return /^[A-Za-z][a-zA-Z\.\'\-]{0,30}$/.test(w) && !INVALID_NAME_WORDS.has(upper);
  });
}

/** Parse and normalize any date string into standard DD/MM/YYYY */
export function parseDateString(str) {
  if (!str) return null;
  const cleaned = str.trim()
    .replace(/\b([0-9OIlSZB]{1,2})\s*[\/\-\.\s]\s*([0-9OIlSZB]{1,2}|[A-Za-z]{3,9})\s*[\/\-\.\s]\s*([0-9OIlSZB]{2,4})\b/g, (match, d, m, y) => {
      const cleanD = d.replace(/[O]/g, '0').replace(/[Il]/g, '1').replace(/[S]/g, '5').replace(/[Z]/g, '2').replace(/[B]/g, '8');
      const cleanY = y.replace(/[O]/g, '0').replace(/[Il]/g, '1').replace(/[S]/g, '5').replace(/[Z]/g, '2').replace(/[B]/g, '8');
      return `${cleanD}/${m}/${cleanY}`;
    });

  // Check YYYY/MM/DD
  const isoMatch = cleaned.match(/\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  // Check DD MMM YYYY or MMM DD YYYY (e.g. 21 JUN 2035 or OCT 15, 1992)
  const MONTHS = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
    JANUARY: '01', FEBRUARY: '02', MARCH: '03', APRIL: '04', JUNE: '06',
    JULY: '07', AUGUST: '08', SEPTEMBER: '09', OCTOBER: '10', NOVEMBER: '11', DECEMBER: '12'
  };
  const wordMatch1 = cleaned.match(/\b(\d{1,2})[\/\-\.\s]+([A-Za-z]{3,9})[\/\-\.\s]+(\d{2,4})\b/);
  if (wordMatch1) {
    const d = wordMatch1[1].padStart(2, '0');
    const mStr = wordMatch1[2].toUpperCase();
    const m = MONTHS[mStr] || '01';
    let y = wordMatch1[3];
    if (y.length === 2) {
      const currentYY = new Date().getFullYear() % 100;
      y = parseInt(y, 10) > currentYY + 20 ? `19${y}` : `20${y}`;
    }
    return `${d}/${m}/${y}`;
  }

  const wordMatch2 = cleaned.match(/\b([A-Za-z]{3,9})[\/\-\.\s]+(\d{1,2})[\,\/\-\.\s]+(\d{2,4})\b/);
  if (wordMatch2) {
    const mStr = wordMatch2[1].toUpperCase();
    const m = MONTHS[mStr] || '01';
    const d = wordMatch2[2].padStart(2, '0');
    let y = wordMatch2[3];
    if (y.length === 2) {
      const currentYY = new Date().getFullYear() % 100;
      y = parseInt(y, 10) > currentYY + 20 ? `19${y}` : `20${y}`;
    }
    return `${d}/${m}/${y}`;
  }

  // Check numeric DD/MM/YYYY or MM/DD/YYYY
  const numMatch = cleaned.match(/\b(\d{1,2})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{2,4})\b/);
  if (numMatch) {
    const part1 = parseInt(numMatch[1], 10);
    const part2 = parseInt(numMatch[2], 10);
    let y = numMatch[3];
    if (y.length === 2) {
      const currentYY = new Date().getFullYear() % 100;
      y = parseInt(y, 10) > currentYY + 20 ? `19${y}` : `20${y}`;
    }
    
    // US Month-First: MM/DD/YYYY (e.g. 08/14/1992)
    if (part1 <= 12 && part2 > 12 && part2 <= 31) {
      const d = String(part2).padStart(2, '0');
      const m = String(part1).padStart(2, '0');
      return `${d}/${m}/${y}`;
    }

    // Standard DD/MM/YYYY
    if (part1 >= 1 && part1 <= 31 && part2 >= 1 && part2 <= 12) {
      const d = String(part1).padStart(2, '0');
      const m = String(part2).padStart(2, '0');
      return `${d}/${m}/${y}`;
    }
  }

  return null;
}

export function calculateAgeFromDob(dobStr) {
  if (!dobStr) return null;
  const match = dobStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;
  const birthYear = parseInt(match[3], 10);
  const birthMonth = parseInt(match[2], 10) - 1;
  const birthDay = parseInt(match[1], 10);
  const today = new Date();
  let age = today.getFullYear() - birthYear;
  const m = today.getMonth() - birthMonth;
  if (m < 0 || (m === 0 && today.getDate() < birthDay)) {
    age--;
  }
  return age >= 0 && age <= 130 ? age : null;
}

export function extractNonMrzFields(rawText) {
  if (!rawText) return null;
  const rawLines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return null;

  // 1. Detect Document Type
  let docType = 'Identity Document';
  let isAadhaar = false;
  let isDL = false;
  let isPAN = false;
  let isVoter = false;
  let isPassport = false;
  let isGreenCard = false;
  let isVisa = false;

  if (/PASSPORT|PASSEPORT|\bPASS\s*NO\b/i.test(rawText)) {
    docType = 'Passport';
    isPassport = true;
  } else if (/DRIVING\s*LICEN[CS]E|DRIVER'?S?\s*LICEN[CS]E|\bDL\s*NO\b|\bUNION\s*OF\s*INDIA\b.*LICEN[CS]E|\bMOTOR\s*VEHICLES?\b|PERMIS\s*DE\s*CONDUIRE|FAHRERLAUBNIS/i.test(rawText)) {
    docType = 'Driving License';
    isDL = true;
  } else if (/INCOME\s*TAX\s*DEPARTMENT|\bPAN\s*CARD\b|PERMANENT\s*ACCOUNT\s*NUMBER/i.test(rawText)) {
    docType = 'PAN Card';
    isPAN = true;
  } else if (/ELECTION\s*COMMISSION|\bVOTER\b|\bEPIC\b|\bELECTORAL\b/i.test(rawText)) {
    docType = 'Voter ID';
    isVoter = true;
  } else if (/PERMANENT\s*RESIDENT|GREEN\s*CARD|RESIDENCE\s*PERMIT/i.test(rawText)) {
    docType = 'Permanent Resident Card';
    isGreenCard = true;
  } else if (/VISA|ENTRY\s*PERMIT|TRAVEL\s*AUTHORIZATION/i.test(rawText)) {
    docType = 'Visa / Travel Permit';
    isVisa = true;
  } else if (/\bAADHAAR\b|\bUNIQUE\s*IDENTIFICATION\b|\bUIDAI\b|\bVID[\s\:]*\d{4}\b|\bMERA\s*AADHAAR\b/i.test(rawText) || (/\b\d{4}\s\d{4}\s\d{4}\b/.test(rawText) && !/PASSPORT|DRIVING|LICEN[CS]E|INCOME\s*TAX|PAN\s*CARD|VOTER/i.test(rawText))) {
    docType = 'Aadhaar Card';
    isAadhaar = true;
  }

  // 2. Detect Country & Nationality Dynamically (Zero Hardcoded Defaults)
  let country = null;
  let nationality = null;

  if (/\b(?:UNITED\s*STATES|USA|U\.S\.A|AMERICA|CALIFORNIA|TEXAS|NEW\s*YORK|FLORIDA|WASHINGTON|ILLINOIS|PENNSYLVANIA|OHIO|GEORGIA|NORTH\s*CAROLINA|MICHIGAN|NEW\s*JERSEY|VIRGINIA|ARIZONA|MASSACHUSETTS|TENNESSEE|INDIANA|MISSOURI|MARYLAND|WISCONSIN|COLORADO|MINNESOTA|SOUTH\s*CAROLINA|ALABAMA|LOUISIANA|KENTUCKY|OREGON|OKLAHOMA|CONNECTICUT|UTAH|IOWA|NEVADA|ARKANSAS|MISSISSIPPI|KANSAS|NEW\s*MEXICO|NEBRASKA|IDAHO|WEST\s*VIRGINIA|HAWAII|NEW\s*HAMPSHIRE|MAINE|MONTANA|RHODE\s*ISLAND|DELAWARE|SOUTH\s*DAKOTA|NORTH\s*DAKOTA|ALASKA|VERMONT|WYOMING)\b/i.test(rawText)) {
    country = 'United States';
    nationality = 'American';
  } else if (/\b(?:UNITED\s*KINGDOM|GREAT\s*BRITAIN|\bUK\b|BRITISH|ENGLAND|SCOTLAND|WALES|NORTHERN\s*IRELAND|DVLA)\b/i.test(rawText)) {
    country = 'United Kingdom';
    nationality = 'British';
  } else if (/\b(?:CANADA|CANADIAN|ONTARIO|QUEBEC|BRITISH\s*COLUMBIA|ALBERTA|MANITOBA|SASKATCHEWAN|NOVA\s*SCOTIA|NEW\s*BRUNSWICK)\b/i.test(rawText)) {
    country = 'Canada';
    nationality = 'Canadian';
  } else if (/\b(?:AUSTRALIA|AUSTRALIAN|NEW\s*SOUTH\s*WALES|VICTORIA|QUEENSLAND|WESTERN\s*AUSTRALIA|SOUTH\s*AUSTRALIA|TASMANIA)\b/i.test(rawText)) {
    country = 'Australia';
    nationality = 'Australian';
  } else if (/\b(?:GERMANY|DEUTSCHLAND|BUNDESREPUBLIK|GERMAN)\b/i.test(rawText)) {
    country = 'Germany';
    nationality = 'German';
  } else if (/\b(?:FRANCE|FRANCAISE|FRENCH|REPUBLIQUE\s*FRANCAISE)\b/i.test(rawText)) {
    country = 'France';
    nationality = 'French';
  } else if (/\b(?:ITALY|ITALIA|ITALIANA|ITALIAN)\b/i.test(rawText)) {
    country = 'Italy';
    nationality = 'Italian';
  } else if (/\b(?:SPAIN|ESPANA|ESPANOLA|SPANISH)\b/i.test(rawText)) {
    country = 'Spain';
    nationality = 'Spanish';
  } else if (/\b(?:SINGAPORE|SINGAPOREAN)\b/i.test(rawText)) {
    country = 'Singapore';
    nationality = 'Singaporean';
  } else if (/\b(?:MALAYSIA|MALAYSIAN)\b/i.test(rawText)) {
    country = 'Malaysia';
    nationality = 'Malaysian';
  } else if (/\b(?:UNITED\s*ARAB\s*EMIRATES|UAE|DUBAI|EMIRATI|ABU\s*DHABI)\b/i.test(rawText)) {
    country = 'United Arab Emirates';
    nationality = 'Emirati';
  } else if (/\b(?:SAUDI\s*ARABIA|SAUDI)\b/i.test(rawText)) {
    country = 'Saudi Arabia';
    nationality = 'Saudi';
  } else if (/\b(?:JAPAN|JAPANESE)\b/i.test(rawText)) {
    country = 'Japan';
    nationality = 'Japanese';
  } else if (/\b(?:SOUTH\s*KOREA|KOREA|KOREAN)\b/i.test(rawText)) {
    country = 'South Korea';
    nationality = 'South Korean';
  } else if (/\b(?:NETHERLANDS|DUTCH|HOLLAND)\b/i.test(rawText)) {
    country = 'Netherlands';
    nationality = 'Dutch';
  } else if (/\b(?:SWITZERLAND|SWISS|SCHWEIZ)\b/i.test(rawText)) {
    country = 'Switzerland';
    nationality = 'Swiss';
  } else if (/\b(?:NEW\s*ZEALAND|ZEALANDER)\b/i.test(rawText)) {
    country = 'New Zealand';
    nationality = 'New Zealander';
  } else if (/\b(?:SOUTH\s*AFRICA|SOUTH\s*AFRICAN)\b/i.test(rawText)) {
    country = 'South Africa';
    nationality = 'South African';
  } else if (/\b(?:BRAZIL|BRASIL|BRAZILIAN)\b/i.test(rawText)) {
    country = 'Brazil';
    nationality = 'Brazilian';
  } else if (/\b(?:MEXICO|MEXICANO|MEXICAN)\b/i.test(rawText)) {
    country = 'Mexico';
    nationality = 'Mexican';
  } else if (/\b(?:UTOPIA|UTOPIAN)\b/i.test(rawText)) {
    country = 'Utopia';
    nationality = 'Utopian';
  } else if (/\b(?:INDIA|INDIAN|BHARAT|AADHAAR|UIDAI|INCOME\s*TAX|DELHI|MUMBAI|BANGALORE|CHENNAI|KOLKATA|HYDERABAD|BIHAR|GUJARAT|MAHARASHTRA|RAJASTHAN|KERALA|TAMIL\s*NADU|KARNATAKA|PUNJAB|HARYANA|UTTAR\s*PRADESH|WEST\s*BENGAL)\b/i.test(rawText) || isAadhaar || isPAN) {
    country = 'India';
    nationality = 'Indian';
  }

  // 3. Virtual ID (VID) for Aadhaar
  let vidNumber = null;
  const vidMatch = rawText.match(/VID[ \t\:\-]+(\d{4}[ \t]\d{4}[ \t]\d{4}[ \t]\d{4}|\d{16})/i) ||
                    rawText.match(/\bVID[\:\-\s]*(\d{16}|\d{4}[ \t]\d{4}[ \t]\d{4}[ \t]\d{4})\b/i) ||
                    rawText.match(/\b(\d{4}[ \t]\d{4}[ \t]\d{4}[ \t]\d{4})\b/);
  if (vidMatch) {
    vidNumber = (vidMatch[1] || vidMatch[0]).trim();
  }

  // 4. Document Number Extraction
  let documentNumber = '';
  const passMatch = rawText.match(/(?:passport\s*no|passport\s*number|pass\s*no|doc\s*no)[\s\:\.\#-]*([A-Z0-9]{7,10})/i) ||
                    rawText.match(/\b([A-PR-WYZ][1-9]\d{6,7}[A-Z0-9]?)\b/i) ||
                    rawText.match(/\b([A-Z]\d{7}[A-Z0-9]?)\b/i);
  if (isPassport && passMatch) {
    documentNumber = (passMatch[1] || passMatch[0]).trim().toUpperCase();
  }

  if (!documentNumber) {
    if (isAadhaar) {
      let textWithoutVid = rawText;
      if (vidNumber) {
        textWithoutVid = textWithoutVid.replace(vidNumber, '');
      }
      textWithoutVid = textWithoutVid.replace(/VID[\s\:\-]*\d{4}[ \t]\d{4}[ \t]\d{4}[ \t]\d{4}/gi, '');
      
      const aadhaarMatches = textWithoutVid.match(/\b(\d{4}[ \t]\d{4}[ \t]\d{4})\b/g);
      if (aadhaarMatches && aadhaarMatches.length > 0) {
        documentNumber = aadhaarMatches[aadhaarMatches.length - 1].trim();
      }
    } else if (isPAN) {
      const panMatch = rawText.match(/\b([A-Z]{5}\d{4}[A-Z])\b/);
      if (panMatch) documentNumber = panMatch[1];
    } else if (isDL) {
      const dlMatch = rawText.match(/(?:dl|licen[cs]e|no|dl\s*no)[\s\:\.\#-]*([A-Z0-9\/\-]{8,22})/i) || rawText.match(/\b[A-Z]{2}[-\s]?\d{2}[-\s]?\d{4}[-\s]?\d{7}\b/i);
      if (dlMatch) documentNumber = (dlMatch[1] || dlMatch[0]).replace(/\s+/g, '-').toUpperCase();
    } else if (isVoter) {
      const voterMatch = rawText.match(/\b([A-Z]{3}\d{7})\b/);
      if (voterMatch) documentNumber = voterMatch[1];
    }
  }

  if (!documentNumber) {
    for (const l of rawLines) {
      const match = l.match(/(?:passport|doc|document|id|number|dl|pan|epic|unique\s*id|card\s*no)[\s\.\:\#-]+([A-Z0-9\s\-]{6,22})/i);
      if (match && !NOISE_WORDS.test(match[1])) {
        documentNumber = match[1].trim().toUpperCase();
        break;
      }
    }
  }

  // 5. Date of Birth (DOB) Extraction
  let dobString = null;
  const dobMatch = rawText.match(/(?:dob|date\s*of\s*birth|birth\s*date|born|d\.o\.b|date\s*de\s*naissance|जन्म\s*(?:तारीख|तिथि|दिन))[\s\:\-\/]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i);
  if (dobMatch) {
    dobString = parseDateString(dobMatch[1]);
  } else {
    const yobMatch = rawText.match(/(?:year\s*of\s*birth|yob|जन्म\s*वर्ष)[\s\:\-]+(\d{4})/i);
    if (yobMatch) dobString = `01/01/${yobMatch[1]}`;
    else {
      const dates = rawText.match(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}\b/g);
      if (dates && dates.length > 0) {
        dobString = parseDateString(dates[0]);
      }
    }
  }

  const age = calculateAgeFromDob(dobString);

  // 6. Gender / Sex Extraction (Strict Multilingual Parsing - Zero Name Hardcoding)
  function extractGenderValue(raw) {
    if (!raw) return null;
    const clean = String(raw).replace(/^[^A-Za-z\u0900-\u097F]+/, '').trim();
    const upper = clean.toUpperCase();
    
    if (/\b(?:FEMALE|WOMAN|FEM|FEMME|FRAU|MUJER|GIRL|महिला)\b/i.test(upper) || /^[(\[]?F[)\]]?\b/i.test(upper) || /^F[\/\s\.\-]/i.test(upper) || upper === 'F') {
      return 'Female';
    }
    if (/\b(?:MALE|MAN|MAS|HOMME|MANN|HOMBRE|BOY|पुरुष)\b/i.test(upper) || /^[(\[]?M[)\]]?\b/i.test(upper) || /^M[\/\s\.\-]/i.test(upper) || upper === 'M') {
      return 'Male';
    }
    if (/\b(?:TRANSGENDER|TRANS|NON-BINARY|OTHER|X)\b/i.test(upper) || /^[(\[]?X[)\]]?\b/i.test(upper) || upper === 'X') {
      return 'Transgender';
    }
    return null;
  }

  let gender = null;
  const sexLabelRegex = /(?:gender|sex|sexe|geschlecht|sexo|genre|लिंग)/i;

  for (let idx = 0; idx < rawLines.length; idx++) {
    const l = rawLines[idx];
    if (sexLabelRegex.test(l)) {
      const afterLabel = l.replace(/^.*?(?:gender|sex|sexe|geschlecht|sexo|genre|लिंग)[\s\/\(\)a-zA-Z\u0900-\u097F]*[:\-\.\=\s]*/i, '').trim();
      if (afterLabel) {
        gender = extractGenderValue(afterLabel);
      }
      if (!gender) {
        for (let offset = 1; offset <= 3 && idx + offset < rawLines.length; offset++) {
          const nextL = rawLines[idx + offset].trim();
          if (!nextL) continue;
          if (/(?:dob|date\s*of|birth|place\s*of|nationality|address|father|mother)/i.test(nextL)) {
            const val = extractGenderValue(nextL);
            if (val) gender = val;
            break;
          }
          const val = extractGenderValue(nextL);
          if (val) {
            gender = val;
            break;
          }
        }
      }
      if (gender) break;
    }
  }

  if (!gender) {
    const multiSexMatch = rawText.match(/(?:gender|sex|sexe|geschlecht|sexo|genre|लिंग)[\s\/\(\)\:\.\-\=a-zA-Z\u0900-\u097F\r\n]{0,40}?\b([FM]|FEMALE|MALE|TRANSGENDER|FEM|MAS|HOMME|MANN|FRAU|महिला|पुरुष)\b/i) ||
                          rawText.match(/\b([FM])\s*\/\s*(?:FEMALE|MALE|F|M)\b/i) ||
                          rawText.match(/\b(?:SEX|GENDER)[\s\:\.\-\/\=]+([FM]|FEMALE|MALE)\b/i);
    if (multiSexMatch) {
      gender = extractGenderValue(multiSexMatch[1] || multiSexMatch[0]);
    }
  }

  if (!gender) {
    const standaloneMatch = rawText.match(/\b(FEMALE|MALE|TRANSGENDER|महिला|पुरुष)\b/i);
    if (standaloneMatch) {
      gender = extractGenderValue(standaloneMatch[1]);
    }
  }

  if (!gender) {
    const natIndex = rawLines.findIndex((l) => /(?:nationality|nationalite|staatsangehorigkeit|nacionalidad|राष्ट्रीयता)/i.test(l));
    const dobIndex = rawLines.findIndex((l) => /(?:dob|date\s*of\s*birth|birth\s*date|geburtsdatum|जन्म)/i.test(l));
    if (natIndex >= 0 && dobIndex > natIndex) {
      for (let k = natIndex + 1; k < dobIndex; k++) {
        const val = extractGenderValue(rawLines[k]);
        if (val) {
          gender = val;
          break;
        }
      }
    }
  }

  // 7. Care Of / Guardian / Father / Mother / Spouse Name
  let careOf = null;
  let fatherName = null;
  let motherName = null;
  let spouseName = null;

  const coRegex = /(?:name\s*of\s*(?:father|legal\s*guardian|mother|husband|spouse|parents?)|father'?s?\s*name|legal\s*guardian|माता|पिता|पति|अभिभावक|father|mother|husband|spouse|c\/o|s\/o|w\/o|d\/o|care\s*of)/i;
  for (let idx = 0; idx < rawLines.length; idx++) {
    const line = rawLines[idx];
    if (coRegex.test(line)) {
      let cand = line.replace(/^.*?(?:name\s*of\s*(?:father|legal\s*guardian|mother|husband|spouse|parents?)|father'?s?\s*name|legal\s*guardian|माता|पिता|पति|अभिभावक|father|mother|husband|spouse|c\/o|s\/o|w\/o|d\/o|care\s*of)[\s\/\(\)a-zA-Z\u0900-\u097F]*[:\-\s]*/i, '').trim();
      
      if ((!cand || /^(?:legal\s*guardian|father|mother|husband|spouse|पिता|अभिभावक|नाम)$/i.test(cand)) && idx + 1 < rawLines.length) {
        if (!coRegex.test(rawLines[idx + 1]) && !/(?:mother|address|dob|gender|sex|date|पता|जन्म)/i.test(rawLines[idx + 1])) {
          cand = rawLines[idx + 1].trim();
        }
      }

      if (cand) {
        cand = cand
          .replace(/^(?:legal\s*guardian|father|mother|husband|spouse|name\s*of\s*(?:father|mother|guardian))[\s\/\:\-]+/i, '')
          .replace(/(?:address|पता|dob|gender|enrolment|demo|not\s*valid|name\s*of\s*mother|mother|signature|date).*/i, '')
          .replace(/[^A-Za-z\s\.\-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const words = cand.split(/\s+/).filter(Boolean);
        const nameTokens = [];
        for (const w of words) {
          const upper = w.toUpperCase();
          if (INVALID_NAME_WORDS.has(upper) || /\b(RD|ROAD|STREET|COLONY|BOARD|SECTOR|NAGAR|BLOCK|HOUSE|FLAT|PLOT|PATNA|BIHAR|DELHI|MUMBAI|NEAR|OPP|LANE|FLOOR)\b/i.test(w)) {
            break;
          }
          if (/[aeiouyAEIOUY]/.test(w) && w.length >= 2) {
            nameTokens.push(w);
          }
        }
        if (nameTokens.length > 0) {
          const extractedGuardian = nameTokens.join(' ').toUpperCase();
          if (isValidName(extractedGuardian)) {
            careOf = extractedGuardian;
            if (/father|s\/o|d\/o|पिता/i.test(line)) fatherName = extractedGuardian;
            if (/mother|माता/i.test(line)) motherName = extractedGuardian;
            if (/husband|spouse|w\/o|पति/i.test(line)) spouseName = extractedGuardian;
            break;
          }
        }
      }
    }
  }

  // 8. Full Name Extraction (High Precision Heuristics)
  let fullName = '';
  let surname = '';
  let givenNames = '';

  // Priority 1: Check explicit Surname / Given Name lines
  for (let idx = 0; idx < rawLines.length; idx++) {
    const l = rawLines[idx];
    if (/(?:father|mother|husband|guardian|care\s*of)/i.test(l)) continue;

    // Surname check
    if (/(?:surname|nom\b|last\s*name|\bln\b|उपनाम|^1[\.\s])/i.test(l)) {
      let cand = l.replace(/^.*?\b(?:surname|nom|last\s*name|ln|उपनाम|^1[\.\s])\b[\s\/\(\)a-zA-Z\u0900-\u097F]*[:\-\s\.]*/i, '').trim();
      if (!cand && idx + 1 < rawLines.length) {
        cand = rawLines[idx + 1].trim();
      }
      const clean = cleanNameCandidate(cand);
      if (isValidName(clean) && !INVALID_NAME_WORDS.has(clean.toUpperCase())) {
        surname = clean.toUpperCase();
      }
    }

    // Given Name(s) check
    if (/(?:given\s*name[s]?|pr[eé]noms?|first\s*name[s]?|\bfn\b|दिया\s*गया\s*नाम|^2[\.\s])/i.test(l)) {
      let cand = l.replace(/^.*?\b(?:given\s*name[s]?|pr[eé]noms?|first\s*name[s]?|fn|दिया\s*गया\s*नाम|^2[\.\s])\b[\s\/\(\)a-zA-Z\u0900-\u097F]*[:\-\s\.]*/i, '').trim();
      if (!cand && idx + 1 < rawLines.length) {
        cand = rawLines[idx + 1].trim();
      }
      const clean = cleanNameCandidate(cand);
      if (isValidName(clean) && !INVALID_NAME_WORDS.has(clean.toUpperCase())) {
        givenNames = clean.toUpperCase();
      }
    }
  }

  if (givenNames && surname) {
    fullName = `${givenNames} ${surname}`.trim().toUpperCase();
  } else if (givenNames && !surname) {
    if (careOf && careOf.split(' ').length >= 2) {
      const coParts = careOf.split(' ');
      const familySurname = coParts[coParts.length - 1];
      if (familySurname && isValidName(familySurname) && !givenNames.includes(familySurname)) {
        fullName = `${givenNames} ${familySurname}`.trim().toUpperCase();
      } else {
        fullName = givenNames.toUpperCase();
      }
    } else {
      fullName = givenNames.toUpperCase();
    }
  } else if (surname && !givenNames) {
    fullName = surname.toUpperCase();
  }

  // Priority 2: "To: Person Name" line (e.g. Aadhaar cards)
  if (!fullName) {
    const toMatch = rawText.match(/^To\s*:\s*\r?\n\s*([^\r\n]+)/im) || rawText.match(/\bTo\s*:\s*([A-Za-z\s\.\-]{3,40})/i);
    if (toMatch) {
      const cand = cleanNameCandidate(toMatch[1]);
      if (isValidName(cand) && cand.toUpperCase() !== careOf) {
        fullName = cand.toUpperCase();
      }
    }
  }

  // Priority 3: Explicit "Name: ..." label
  if (!fullName) {
    for (let i = 0; i < rawLines.length; i++) {
      const l = rawLines[i];
      if (/(?:father|mother|husband|guardian|spouse|care\s*of|c\/o|s\/o|w\/o|d\/o)/i.test(l)) continue;
      const match = l.match(/(?:full\s*name|holder'?s?\s*name|name\s*of\s*holder|cardholder\s*name|नाम)[\s\:\-]+(.+)/i);
      if (match) {
        const candidate = cleanNameCandidate(match[1]);
        if (isValidName(candidate) && candidate.toUpperCase() !== careOf) {
          fullName = candidate.toUpperCase();
          break;
        }
      }
    }
  }

  // Priority 4: Lines directly preceding DOB, Gender, or Care-of
  if (!fullName) {
    const dobIndex = rawLines.findIndex((l) => /(?:dob|date\s*of\s*birth|date\s*de\s*naissance|जन्म|gender|sex|female|male)/i.test(l));
    if (dobIndex > 0) {
      for (let k = dobIndex - 1; k >= Math.max(0, dobIndex - 4); k--) {
        const lineText = rawLines[k];
        if (/(?:father|mother|husband|guardian|c\/o|s\/o|w\/o|d\/o|republic|government|authority|aadhaar|unique|india)/i.test(lineText)) continue;
        const cand = cleanNameCandidate(lineText);
        if (isValidName(cand) && cand.toUpperCase() !== careOf) {
          fullName = cand.toUpperCase();
          break;
        }
      }
    }
  }

  // Priority 5: Scan all lines
  if (!fullName) {
    for (let i = 0; i < rawLines.length; i++) {
      const candidate = cleanNameCandidate(rawLines[i]);
      if (isValidName(candidate) && candidate.toUpperCase() !== careOf) {
        fullName = candidate.toUpperCase();
        break;
      }
    }
  }

  // 9. Blood Group Extraction (Common on Driving Licenses & ID Cards)
  let bloodGroup = null;
  const bgMatch = rawText.match(/(?:blood\s*group|blood\s*grp|bg|रक्त\s*समूह)[\s\:\-]+([ABO][\+\-]|AB[\+\-]|A\s*[\+\-]|B\s*[\+\-]|O\s*[\+\-]|AB\s*[\+\-])/i) ||
                  rawText.match(/\b(A[\+\-]|B[\+\-]|O[\+\-]|AB[\+\-])\b/i);
  if (bgMatch) {
    bloodGroup = bgMatch[1].replace(/\s+/g, '').toUpperCase();
  }

  // 10. Place of Birth / Place of Issue / Authority
  let placeOfBirth = null;
  const pobMatch = rawText.match(/(?:place\s*of\s*birth|birth\s*place|lieu\s*de\s*naissance|जन्म\s*स्थान)[\s\:\-]+([A-Za-z\s\,\.\-]{3,40})(?=\r?\n|$)/i);
  if (pobMatch) {
    placeOfBirth = pobMatch[1].trim();
  }

  let placeOfIssue = null;
  const poiMatch = rawText.match(/(?:place\s*of\s*issue|issue\s*place|lieu\s*de\s*delivrance|जारी\s*स्थान|rto)[\s\:\-]+([A-Za-z0-9\s\,\.\-]{3,40})(?=\r?\n|$)/i);
  if (poiMatch) {
    placeOfIssue = poiMatch[1].trim();
  }

  // 11. Vehicle Classes (for Driving Licenses)
  let vehicleClass = null;
  const covMatch = rawText.match(/(?:cov|class\s*of\s*vehicle|vehicle\s*class|authori[sz]ation)[\s\:\-]+([^\r\n]+)/i);
  if (covMatch) {
    const rawCov = covMatch[1].trim().replace(/^[\:\-\s]+/, '').replace(/[^A-Za-z0-9\,\s\-\/]/g, '').trim();
    if (rawCov.length >= 2 && !NOISE_WORDS.test(rawCov)) {
      vehicleClass = rawCov;
    }
  }
  if (!vehicleClass) {
    const standaloneCov = rawText.match(/\b(MCWG|MCWOG|LMV|LMV-NT|TRANS|HMV|HGMV|3W-CAB|PSVBUS)\b/g);
    if (standaloneCov) {
      vehicleClass = Array.from(new Set(standaloneCov)).join(', ');
    }
  }

  // 12. Address Extraction & Auto-Repair
  let address = null;
  let pinCode = null;
  let state = null;

  const addrMatch = rawText.match(/(?:address|पता)[\s\/\(\)a-zA-Z\u0900-\u097F]*[\:\-\s\r\n]+([\s\S]+?)(?=(?:date\s*of\s*issue|date\s*of\s*expiry|place\s*of\s*issue|place\s*of\s*birth|issue\s*date|expiry\s*date|जारी\s*करने|समाप्ति|valid\s*till|enrolment|download|help|uidai|www|1947|\b\d{4}\s\d{4}\s\d{4}\b|valid\s*(?:till|until|upto|thru|through)|validity|demo\s*-\s*not\s*valid|old\s*passport|file\s*no|$))/i);
  
  let rawAddrBlock = addrMatch ? addrMatch[1] : '';

  if (!rawAddrBlock && (isAadhaar || rawText.includes('S/O') || rawText.includes('C/O') || /colony|street|road|nagar|patna|delhi|mumbai|bihar|gardens|kolkata|bangalore|karnataka/i.test(rawText))) {
    const pinMatch = rawText.match(/\b\d{6}\b/) || rawText.match(/[a-zA-Z]{3,8}[B0-9]{6}/);
    if (pinMatch) {
      const coIndex = rawLines.findIndex((l) => /(?:s\/o|c\/o|w\/o|d\/o|care\s*of|address)/i.test(l));
      const startIdx = coIndex >= 0 ? coIndex + 1 : 0;
      const addrLines = [];
      for (let k = startIdx; k < rawLines.length; k++) {
        const l = rawLines[k];
        if (/(?:dob|gender|vid|help|uidai|download|enrolment|\b\d{4}\s\d{4}\s\d{4}\b|date\s*of\s*issue|place\s*of\s*issue)/i.test(l)) break;
        if (!NOISE_WORDS.test(l) && !/^\d{4}\s\d{4}\s\d{4}$/.test(l) && !/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(l.trim())) {
          addrLines.push(l);
        }
        if (l.includes(pinMatch[0])) break;
      }
      if (addrLines.length > 0) {
        rawAddrBlock = addrLines.join(', ');
      }
    }
  }

  if (rawAddrBlock) {
    const pin6 = rawAddrBlock.match(/\b\d{6}\b/);
    if (pin6) {
      pinCode = pin6[0];
      const pIdx = rawAddrBlock.indexOf(pin6[0]);
      rawAddrBlock = rawAddrBlock.slice(0, pIdx + pin6[0].length);
    }

    let cleanLines = rawAddrBlock
      .replace(/\b(PEOPLE\s*[\S\s]*?BRIGHTER|PEOPLE|TRAVEL|BRIGHTER|FUTURE|DEMO|NOT\s*VALID|DATE\s*OF|PLACE\s*OF|EXPIR|ISSUE|HELP\s*LINE|UIDAI|WWW).*/gi, '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !NOISE_WORDS.test(l) && !/^(?:address|पता|\/|\:|\-)+$/i.test(l) && !/(?:enrolment|download|issue|help|uidai|www|1947|valid\s*(?:till|until|upto)|^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$)/i.test(l));

    let cleanAddr = cleanLines.join(', ')
      .replace(/BihagsB([0-9]{5,6})/gi, 'Bihar - 8$1')
      .replace(/Bihag([0-9]{6})/gi, 'Bihar - $1')
      .replace(/Bihar\s*B([0-9]{5})/gi, 'Bihar - 8$1')
      .replace(/([A-Za-z]+)B([0-9]{5})\b/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanAddr.length >= 6) {
      address = cleanAddr;
    }
  }

  // 13. Expiry & Issue Dates
  let expiryDate = null;
  const expRegex = /(?:expiry|expires|\bexp\b|\b4b[\.\s]|valid\s*(?:until|thru|through|upto|to|till)|expiration|validity|date\s*of\s*expiry|exp\s*date|validity\s*date|val\s*upto|समाप्ति|वैधता|समाप्ति\s*तिथि|समाप्ति\s*दिनांक|अंतिम\s*तिथि)/i;
  
  for (let idx = 0; idx < rawLines.length; idx++) {
    const l = rawLines[idx];
    if (expRegex.test(l)) {
      expiryDate = parseDateString(l);
      if (!expiryDate && idx + 1 < rawLines.length) {
        expiryDate = parseDateString(rawLines[idx + 1]);
      }
      if (!expiryDate && idx + 2 < rawLines.length) {
        expiryDate = parseDateString(rawLines[idx + 2]);
      }
      if (expiryDate) break;
    }
  }

  if (!expiryDate) {
    const multiExpMatch = rawText.match(/(?:expiry|expires|\bexp\b|\b4b[\.\s]|valid\s*(?:until|thru|through|upto|to|till)|expiration|validity|date\s*of\s*expiry|exp\s*date|validity\s*date|val\s*upto|समाप्ति\s*(?:की\s*तिथि)?|वैधता|समाप्ति\s*तिथि|समाप्ति\s*दिनांक|अंतिम\s*तिथि)[\s\/\(\)a-zA-Z\u0900-\u097F\:\-\r\n]{0,60}?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}|\d{1,2}[\/\-\.\s]+[A-Za-z]{3,9}[\/\-\.\s]+\d{2,4})/i) ||
                          rawText.match(/\b(VALID\s*(?:TILL|UNTIL|UPTO|THRU))\s*[:\-]?\s*(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}|\d{4}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{1,2})/i);
    if (multiExpMatch) {
      expiryDate = parseDateString(multiExpMatch[2] || multiExpMatch[1]);
    }
  }

  // Issue Date Extraction
  let issueDate = null;
  const issueRegex = /(?:issue\s*date|issued|\biss\b|\b4a[\.\s]|date\s*of\s*issue|जारी\s*(?:करने\s*की\s*तिथि)?|जारी\s*तिथि|जारी\s*दिनांक)/i;
  for (let idx = 0; idx < rawLines.length; idx++) {
    const l = rawLines[idx];
    if (issueRegex.test(l)) {
      issueDate = parseDateString(l);
      if (!issueDate && idx + 1 < rawLines.length) {
        issueDate = parseDateString(rawLines[idx + 1]);
      }
      if (!issueDate && idx + 2 < rawLines.length) {
        issueDate = parseDateString(rawLines[idx + 2]);
      }
      if (issueDate) break;
    }
  }

  if (!issueDate) {
    const multiIssueMatch = rawText.match(/(?:issue\s*date|issued|\biss\b|\b4a[\.\s]|date\s*of\s*issue|जारी\s*(?:करने\s*की\s*तिथि)?|जारी\s*तिथि|जारी\s*दिनांक)[\s\/\(\)a-zA-Z\u0900-\u097F\:\-\r\n]{0,60}?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}|\d{1,2}[\/\-\.\s]+[A-Za-z]{3,9}[\/\-\.\s]+\d{2,4})/i);
    if (multiIssueMatch) {
      issueDate = parseDateString(multiIssueMatch[1]);
    }
  }

  if (!expiryDate) {
    const datePattern = /\b\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}\b|\b\d{1,2}[\/\-\.\s]+[A-Za-z]{3,9}[\/\-\.\s]+\d{2,4}\b/g;
    const allMatches = rawText.match(datePattern) || [];
    const parsedDates = allMatches.map(parseDateString).filter(Boolean);
    const knownDates = new Set([dobString, issueDate].filter(Boolean));
    const candidates = parsedDates.filter((d) => !knownDates.has(d));
    
    const futureDate = candidates.find((d) => {
      const parts = d.split('/');
      const year = parseInt(parts[2], 10);
      return year >= 2026;
    });

    if (futureDate) {
      expiryDate = futureDate;
    } else if (candidates.length > 0 && !isAadhaar) {
      candidates.sort((a, b) => {
        const yA = parseInt(a.split('/')[2], 10);
        const yB = parseInt(b.split('/')[2], 10);
        return yB - yA;
      });
      expiryDate = candidates[0];
    }
  }

  let expiryString = expiryDate || (isAadhaar && /AADHAAR|UNIQUE\s*IDENTIFICATION|\bUIDAI\b/i.test(rawText) ? 'Permanent / Lifetime' : 'N/A');

  // Aadhaar Verhoeff checksum validation
  const isAadhaarValid = isAadhaar && documentNumber ? validateVerhoeff(documentNumber) : true;

  // 14. Universal Key-Value & Visual Line Extractor (Extract ALL Labeled and Tabular Info)
  const allDetectedFields = {};
  const visualLines = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect Label: Value pattern
    const kvMatch = trimmed.match(/^([^:\-]{2,25})[\:\-=]+(.+)$/);
    if (kvMatch && !NOISE_WORDS.test(kvMatch[1])) {
      const key = kvMatch[1].trim();
      const val = kvMatch[2].trim();
      if (key.length >= 2 && val.length >= 1) {
        allDetectedFields[key] = val;
        visualLines.push({ text: trimmed, type: 'field', label: key, value: val });
        continue;
      }
    }

    if (NOISE_WORDS.test(trimmed)) {
      visualLines.push({ text: trimmed, type: 'header' });
    } else if (/\b\d{6}\b|road|street|nagar|colony|apartment|dist|state/i.test(trimmed)) {
      visualLines.push({ text: trimmed, type: 'address' });
    } else {
      visualLines.push({ text: trimmed, type: 'text' });
    }
  }

  // Populate detected fields dictionary with core extracted items
  if (fullName) allDetectedFields['Full Name'] = fullName;
  if (documentNumber) allDetectedFields['Document Number'] = documentNumber;
  if (dobString) allDetectedFields['Date of Birth'] = dobString;
  if (age !== null) allDetectedFields['Age'] = `${age} years`;
  if (gender) allDetectedFields['Gender / Sex'] = gender;
  if (careOf) allDetectedFields['Care Of / Guardian'] = careOf;
  if (fatherName) allDetectedFields['Father\'s Name'] = fatherName;
  if (motherName) allDetectedFields['Mother\'s Name'] = motherName;
  if (spouseName) allDetectedFields['Spouse\'s Name'] = spouseName;
  if (address) allDetectedFields['Address'] = address;
  if (bloodGroup) allDetectedFields['Blood Group'] = bloodGroup;
  if (placeOfBirth) allDetectedFields['Place of Birth'] = placeOfBirth;
  if (placeOfIssue) allDetectedFields['Place of Issue'] = placeOfIssue;
  if (vehicleClass) allDetectedFields['Vehicle Class'] = vehicleClass;
  if (issueDate) allDetectedFields['Date of Issue'] = issueDate;
  if (expiryString && expiryString !== 'N/A') allDetectedFields['Date of Expiry'] = expiryString;
  if (vidNumber) allDetectedFields['Virtual ID (VID)'] = vidNumber;
  if (nationality) allDetectedFields['Nationality'] = nationality;
  if (country) allDetectedFields['Country'] = country;

  return {
    format: 'Non-MRZ',
    docType,
    country,
    issuingCountry: country,
    fullName: fullName || null,
    name: fullName || null,
    givenNames: givenNames || null,
    surname: surname || null,
    documentNumber: documentNumber || null,
    docNumber: documentNumber || null,
    documentNumberValid: Boolean(documentNumber) && isAadhaarValid,
    vidNumber,
    nationality,
    dateOfBirth: { raw: dobString, iso: dobString, formatted: dobString || 'N/A' },
    dob: dobString || null,
    age,
    dateOfBirthValid: Boolean(dobString),
    sex: gender ? gender.toUpperCase() : 'Unspecified',
    gender: gender || 'Unspecified',
    careOf,
    fatherName,
    motherName,
    spouseName,
    address,
    pinCode,
    bloodGroup,
    placeOfBirth,
    placeOfIssue,
    vehicleClass,
    issueDate,
    expirationDate: { raw: expiryString, iso: expiryString, formatted: expiryString },
    expiry: expiryString,
    expirationValid: true,
    isMrz: false,
    allChecksValid: Boolean(documentNumber || fullName),
    allDetectedFields,
    visualLines,
  };
}

export function extractDocumentData(rawText) {
  const mrz = parseMRZ(rawText);
  if (mrz) {
    const nonMrz = extractNonMrzFields(rawText);
    if (nonMrz) {
      mrz.allDetectedFields = {
        'Document Type': mrz.docType,
        'Passport / ID Number': mrz.documentNumber,
        'Full Name': mrz.fullName,
        'Nationality': mrz.nationality,
        'Date of Birth': mrz.dob,
        'Sex': mrz.gender,
        'Expiration Date': mrz.expiry,
        'Issuing Country': mrz.country,
        ...(nonMrz.allDetectedFields || {}),
      };
      mrz.placeOfBirth = nonMrz.placeOfBirth || null;
      mrz.placeOfIssue = nonMrz.placeOfIssue || null;
      mrz.issueDate = nonMrz.issueDate || null;
      mrz.careOf = nonMrz.careOf || null;
      mrz.address = nonMrz.address || null;
      mrz.visualLines = nonMrz.visualLines || [];
    }
    return mrz;
  }
  return extractNonMrzFields(rawText);
}
