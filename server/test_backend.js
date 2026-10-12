// server/test_backend.js
// Comprehensive Verification & Extraction Test Suite

const { extractDocumentData, parseMRZ, extractNonMrzFields, validateVerhoeff, computeCheckDigit } = require('./services/mrzParser');
const { assessTravelerRisk } = require('./services/riskEngine');
const { evaluateStrictMatch, stringSimilarity, tokenSimilarity } = require('./services/strictMatcher');
const { screenTraveler } = require('./services/watchlistEngine');
const { calculateBlockHash, verifyChainIntegrity } = require('./services/auditLedger');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, extraInfo = '') {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName} ${extraInfo ? '(' + extraInfo + ')' : ''}`);
  }
}

console.log('====================================================');
console.log('  BORDERGUARD AI BACKEND & EXTRACTION TEST SUITE');
console.log('====================================================\n');

// ----------------------------------------------------
// TEST GROUP 1: ICAO Doc 9303 TD3 Passport MRZ Parsing
// ----------------------------------------------------
console.log('--- Test Group 1: TD3 Passport MRZ Parsing ---');
const genuinePassportMRZ = `
P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<
L8988901C4UTO7408122F1204159ZE184226B<<<<<14
`;

const parsedTD3 = extractDocumentData(genuinePassportMRZ);
assert(parsedTD3 !== null, 'TD3 Passport detected and parsed');
assert(parsedTD3.docType === 'Passport', 'DocType identified as Passport');
assert(parsedTD3.name === 'ANNA MARIA ERIKSSON', `Name extracted properly: ${parsedTD3.name}`);
assert(parsedTD3.documentNumber === 'L8988901C', `Passport number extracted: ${parsedTD3.documentNumber}`);
assert(parsedTD3.nationality === 'Utopian', `Nationality mapped: ${parsedTD3.nationality}`);
assert(parsedTD3.dob === '12/08/1974', `DOB formatted: ${parsedTD3.dob}`);
assert(parsedTD3.expiry === '15/04/2012', `Expiry formatted: ${parsedTD3.expiry}`);
assert(parsedTD3.gender === 'Female', `Gender identified: ${parsedTD3.gender}`);
assert(parsedTD3.allChecksValid === true, 'All ICAO 7-3-1 check digits validated');

// Tampered MRZ (Altered Expiration without matching checksum)
const tamperedPassportMRZ = `
P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<
L8988901C4UTO7408122F3004159ZE184226B<<<<<14
`;
const parsedTamperedTD3 = extractDocumentData(tamperedPassportMRZ);
assert(parsedTamperedTD3.allChecksValid === false, 'Tampered MRZ checksum correctly failed');

// Generate valid clean passport MRZ with correct check digits:
// Doc: P12345678 -> Check digit = computeCheckDigit('P12345678')
const docNum = 'P12345678';
const docCheck = computeCheckDigit(docNum);
const dobVal = '900101';
const dobCheck = computeCheckDigit(dobVal);
const expVal = '300101';
const expCheck = computeCheckDigit(expVal);
const persVal = '<<<<<<<<<<<<<<';
const persCheck = computeCheckDigit(persVal);
const compStr = docNum + docCheck + dobVal + dobCheck + expVal + expCheck + persVal + persCheck;
const compCheck = computeCheckDigit(compStr);

const cleanPassportMRZ = `
P<INDSHARMA<<ROHIT<<<<<<<<<<<<<<<<<<<<<<<<<<
${docNum}${docCheck}IND${dobVal}${dobCheck}M${expVal}${expCheck}${persVal}${persCheck}${compCheck}
`;
const parsedCleanTD3 = extractDocumentData(cleanPassportMRZ);
assert(parsedCleanTD3 !== null, 'Clean Passport parsed');
assert(parsedCleanTD3.allChecksValid === true, 'Clean Passport check digits valid');

// ----------------------------------------------------
// TEST GROUP 2: ICAO Doc 9303 TD1 ID Card MRZ Parsing
// ----------------------------------------------------
console.log('\n--- Test Group 2: TD1 ID Card MRZ Parsing ---');
const td1MRZ = `
I<UTOD231458907<<<<<<<<<<<<<<<
7408122F1204159UTO<<<<<<<<<<<6
ERIKSSON<<ANNA<MARIA<<<<<<<<<<
`;
const parsedTD1 = extractDocumentData(td1MRZ);
assert(parsedTD1 !== null, 'TD1 ID Card detected and parsed');
assert(parsedTD1.format === 'TD1', 'Format is TD1');
assert(parsedTD1.name === 'ANNA MARIA ERIKSSON', `TD1 Name extracted: ${parsedTD1.name}`);
assert(parsedTD1.documentNumber === 'D23145890', `TD1 Doc number extracted: ${parsedTD1.documentNumber}`);
assert(parsedTD1.allChecksValid === true, 'TD1 Check digits valid');

// ----------------------------------------------------
// TEST GROUP 3: Indian Aadhaar Card Non-MRZ Extraction
// ----------------------------------------------------
console.log('\n--- Test Group 3: Indian Aadhaar Card Extraction ---');
const aadhaarText = `
GOVERNMENT OF INDIA
UNIQUE IDENTIFICATION AUTHORITY OF INDIA
MERA AADHAAR, MERI PEHCHAN

To:
Rohit Kumar Sharma
S/O: Mohan Lal Sharma
House No 42, Sector 15, Vasant Kunj,
New Delhi, Delhi - 110070

DOB: 15/08/1988
Gender: Male
VID: 9182 7364 5512 3490
8472 9102 3847

Help Line: 1947 | www.uidai.gov.in
Download Date: 12/01/2026
`;

const parsedAadhaar = extractDocumentData(aadhaarText);
assert(parsedAadhaar !== null, 'Aadhaar document parsed');
assert(parsedAadhaar.docType === 'Aadhaar Card', `DocType is Aadhaar Card: ${parsedAadhaar.docType}`);
assert(parsedAadhaar.name === 'ROHIT KUMAR SHARMA', `Name extracted strictly: ${parsedAadhaar.name}`);
assert(parsedAadhaar.careOf === 'MOHAN LAL SHARMA', `Care-Of extracted properly: ${parsedAadhaar.careOf}`);
assert(parsedAadhaar.documentNumber === '8472 9102 3847', `12-digit UID extracted: ${parsedAadhaar.documentNumber}`);
assert(parsedAadhaar.vidNumber === '9182 7364 5512 3490', `16-digit VID extracted: ${parsedAadhaar.vidNumber}`);
assert(parsedAadhaar.dob === '15/08/1988', `DOB extracted: ${parsedAadhaar.dob}`);
assert(parsedAadhaar.gender === 'Male', `Gender extracted: ${parsedAadhaar.gender}`);
assert(parsedAadhaar.address && parsedAadhaar.address.includes('110070'), `Clean address with PIN extracted: ${parsedAadhaar.address}`);
assert(!parsedAadhaar.address.includes('1947'), 'Helpline 1947 cleanly excluded from address');

// ----------------------------------------------------
// TEST GROUP 4: Indian PAN Card Extraction
// ----------------------------------------------------
console.log('\n--- Test Group 4: Indian PAN Card Extraction ---');
const panText = `
INCOME TAX DEPARTMENT
GOVT OF INDIA
Permanent Account Number Card
ABCDE1234F
Name: PRIYA VERMA
Father's Name: SURESH VERMA
Date of Birth: 24/11/1992
Signature
`;
const parsedPAN = extractDocumentData(panText);
assert(parsedPAN !== null, 'PAN Card parsed');
assert(parsedPAN.docType === 'PAN Card', `DocType is PAN Card: ${parsedPAN.docType}`);
assert(parsedPAN.documentNumber === 'ABCDE1234F', `PAN number strictly matched: ${parsedPAN.documentNumber}`);
assert(parsedPAN.name === 'PRIYA VERMA', `PAN Name strictly matched: ${parsedPAN.name}`);
assert(parsedPAN.careOf === 'SURESH VERMA', `Father Name strictly matched: ${parsedPAN.careOf}`);
assert(parsedPAN.dob === '24/11/1992', `DOB strictly matched: ${parsedPAN.dob}`);

// ----------------------------------------------------
// TEST GROUP 5: Indian Driving License Extraction
// ----------------------------------------------------
console.log('\n--- Test Group 5: Driving License Extraction ---');
const dlText = `
UNION OF INDIA
DRIVING LICENCE
DL NO: DL-0420110023456
Name: VIKRAM RAJPUT
DOB: 10/05/1985
Validity / Expiry: 09/05/2035
Issue Date: 10/05/2011
Non-Transport
`;
const parsedDL = extractDocumentData(dlText);
assert(parsedDL !== null, 'Driving License parsed');
assert(parsedDL.docType === 'Driving License', `DocType is Driving License: ${parsedDL.docType}`);
assert(parsedDL.documentNumber === 'DL-0420110023456', `DL number extracted: ${parsedDL.documentNumber}`);
assert(parsedDL.name === 'VIKRAM RAJPUT', `DL Name extracted: ${parsedDL.name}`);
assert(parsedDL.dob === '10/05/1985', `DL DOB extracted: ${parsedDL.dob}`);
assert(parsedDL.expiry === '09/05/2035', `DL Expiry extracted: ${parsedDL.expiry}`);

// ----------------------------------------------------
// TEST GROUP 6: Strict Cross-Matching & Discrepancies
// ----------------------------------------------------
console.log('\n--- Test Group 6: Strict Cross-Matching Engine ---');
const cleanMatch = evaluateStrictMatch({
  name: 'ROHIT SHARMA',
  documentNumber: 'P1234567',
  dob: '01/01/1990',
  expiry: '01/01/2030',
  isMrz: true,
  fullName: 'ROHIT SHARMA',
});
assert(cleanMatch.isConsistent === true, 'Matching identity is 100% consistent');
assert(cleanMatch.identityConsistency === 100, `Consistency score is ${cleanMatch.identityConsistency}%`);

const tamperedMatch = evaluateStrictMatch({
  name: 'ROHIT SHARMA',
  documentNumber: 'P1234567',
  dob: '01/01/1990',
  expiry: '01/01/2010', // Expired!
  isMrz: true,
  fullName: 'RAHUL SHARMA', // Name mismatch!
});
assert(tamperedMatch.isConsistent === false, 'Discrepancy detected properly');
assert(tamperedMatch.discrepancies.length >= 2, `Discrepancies found: ${tamperedMatch.discrepancies.join(', ')}`);

// ----------------------------------------------------
// TEST GROUP 7: Watchlist & Sanctions Screening
// ----------------------------------------------------
console.log('\n--- Test Group 7: Watchlist & Interpol Screening ---');
const cleanTraveler = screenTraveler({ name: 'Rohit Sharma', docNumber: 'P1234567' });
assert(cleanTraveler.hit === false, 'Clean traveler passes watchlist screening');

const wantedTraveler = screenTraveler({ name: 'Viktor Sokolov', docNumber: 'L9928114A' });
assert(wantedTraveler.hit === true, 'Wanted subject detected on Watchlist');
assert(wantedTraveler.record.category === 'INTERPOL RED NOTICE', `Category: ${wantedTraveler.record.category}`);

// ----------------------------------------------------
// TEST GROUP 8: Unified Risk Assessment Engine
// ----------------------------------------------------
console.log('\n--- Test Group 8: Unified Risk Assessment Engine ---');
const lowRiskResult = assessTravelerRisk({
  parsedDoc: parsedCleanTD3,
  faceMatchScore: 95,
  rawOcrText: cleanPassportMRZ,
});
assert(lowRiskResult.riskLevel === 'LOW', `Low risk assessment: ${lowRiskResult.riskLevel} (Score: ${lowRiskResult.riskScore})`);
assert(lowRiskResult.status === 'Cleared', `Decision status: ${lowRiskResult.status}`);

const highRiskResult = assessTravelerRisk({
  parsedDoc: parsedTamperedTD3,
  faceMatchScore: 40,
  rawOcrText: tamperedPassportMRZ,
});
assert(highRiskResult.riskLevel === 'HIGH', `High risk assessment: ${highRiskResult.riskLevel} (Score: ${highRiskResult.riskScore})`);
assert(highRiskResult.status === 'FLAGGED', `Decision status: ${highRiskResult.status}`);
assert(highRiskResult.reasons.length > 0, `Reason codes generated: ${highRiskResult.reasons.length}`);

// ----------------------------------------------------
// TEST GROUP 9: Cryptographic SHA-256 Ledger
// ----------------------------------------------------
console.log('\n--- Test Group 9: Cryptographic SHA-256 Ledger ---');
const block0 = {
  idx: 1,
  timestamp: '2026-09-27T00:00:00.000Z',
  previous_hash: '0'.repeat(64),
  data_json: JSON.stringify({ traveler: 'ROHIT SHARMA', status: 'VERIFIED' }),
  status: 'VERIFIED',
};
block0.current_hash = calculateBlockHash(block0.idx, block0.timestamp, block0.previous_hash, JSON.parse(block0.data_json), block0.status);

const block1 = {
  idx: 2,
  timestamp: '2026-09-27T00:01:00.000Z',
  previous_hash: block0.current_hash,
  data_json: JSON.stringify({ traveler: 'PRIYA VERMA', status: 'CLEARED' }),
  status: 'CLEARED',
};
block1.current_hash = calculateBlockHash(block1.idx, block1.timestamp, block1.previous_hash, JSON.parse(block1.data_json), block1.status);

const chainCheckValid = verifyChainIntegrity([block0, block1]);
assert(chainCheckValid.chainValid === true, 'Valid blockchain passed integrity check');

// Simulate tampering in Block 0
const tamperedBlock0 = { ...block0, status: 'FLAGGED' };
const chainCheckTampered = verifyChainIntegrity([tamperedBlock0, block1]);
assert(chainCheckTampered.chainValid === false, 'Tampered block detected and flagged');

console.log('\n====================================================');
console.log(`  TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
console.log('====================================================\n');
