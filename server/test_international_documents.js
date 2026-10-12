// server/test_international_documents.js
const assert = require('assert');
const { extractDocumentData } = require('./services/mrzParser');

console.log('====================================================');
console.log('  INTERNATIONAL DOCUMENT & MULTI-COUNTRY EXTRACTION ');
console.log('====================================================');

// Test 1: California USA Driver License
const caDl = `
CALIFORNIA USA
DRIVER LICENSE
DL NO: D1234567
EXP: 08/14/2029
LN: HENDRICKS
FN: ALEXANDER
DOB: 08/14/1992
RSTR: NONE
CLASS: C
SEX: M
HAIR: BRN
EYES: BLU
HGT: 5-11
WGT: 175 lb
ADDRESS: 742 EVERGREEN TERRACE, LOS ANGELES, CA 90001
ISS: 08/14/2021
`;
const r1 = extractDocumentData(caDl);
console.log('--- Test 1: California Driver License ---');
console.log('Extracted:', {
  docType: r1.docType,
  country: r1.country,
  nationality: r1.nationality,
  name: r1.name,
  docNumber: r1.docNumber,
  dob: r1.dob,
  gender: r1.gender,
  expiry: r1.expiry,
  issueDate: r1.issueDate,
});
assert.strictEqual(r1.docType, 'Driving License');
assert.strictEqual(r1.country, 'United States');
assert.strictEqual(r1.nationality, 'American');
assert.strictEqual(r1.docNumber, 'D1234567');
assert.strictEqual(r1.name, 'ALEXANDER HENDRICKS');
assert.strictEqual(r1.dob, '14/08/1992');
assert.strictEqual(r1.gender, 'Male');
assert.strictEqual(r1.issueDate, '14/08/2021');
assert.strictEqual(r1.expiry, '14/08/2029');
console.log('✓ US California DL test passed!');

// Test 2: United Kingdom Driving Licence
const ukDl = `
DRIVING LICENCE
GREAT BRITAIN
1. SMITH
2. EMMA CLAIRE
3. 24.11.1988
4a. 01.03.2020
4b. 28.02.2030
5. SMITH811248EC99
8. 10 DOWNING STREET, LONDON, SW1A 2AA
`;
const r2 = extractDocumentData(ukDl);
console.log('--- Test 2: UK Driving Licence ---');
console.log('Extracted:', {
  docType: r2.docType,
  country: r2.country,
  nationality: r2.nationality,
  name: r2.name,
  docNumber: r2.docNumber,
  dob: r2.dob,
  expiry: r2.expiry,
  issueDate: r2.issueDate,
});
assert.strictEqual(r2.docType, 'Driving License');
assert.strictEqual(r2.country, 'United Kingdom');
assert.strictEqual(r2.nationality, 'British');
assert.strictEqual(r2.dob, '24/11/1988');
assert.strictEqual(r2.issueDate, '01/03/2020');
assert.strictEqual(r2.expiry, '28/02/2030');
console.log('✓ UK Driving Licence test passed!');

// Test 3: German Identity Card (Personalausweis)
const gerId = `
BUNDESREPUBLIK DEUTSCHLAND
IDENTITY CARD
Name: MUELLER
Given Names: LUKAS
Geburtsdatum: 12.05.1994
Geschlecht / Sex: M
Staatsangehorigkeit: DEUTSCH
Card No: L8921458
Expiry: 11.05.2034
`;
const r3 = extractDocumentData(gerId);
console.log('--- Test 3: German Identity Card ---');
console.log('Extracted:', {
  country: r3.country,
  nationality: r3.nationality,
  name: r3.name,
  gender: r3.gender,
  dob: r3.dob,
  expiry: r3.expiry,
});
assert.strictEqual(r3.country, 'Germany');
assert.strictEqual(r3.nationality, 'German');
assert.strictEqual(r3.gender, 'Male');
assert.strictEqual(r3.dob, '12/05/1994');
assert.strictEqual(r3.expiry, '11/05/2034');
console.log('✓ German ID test passed!');

console.log('====================================================');
console.log('  ALL INTERNATIONAL TESTS PASSED! (3/3)             ');
console.log('====================================================');
