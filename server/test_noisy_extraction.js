// server/test_noisy_extraction.js
// Verification for the exact noisy OCR conditions and Biometric match scoring

const assert = require('assert');
const { extractDocumentData, extractNonMrzFields } = require('./services/mrzParser');

console.log('--- Testing Noisy Extraction Edge Cases ---');

// 1. The exact noisy text pattern from the user's issue
const noisyAadhaarText = `
GOVERNMENT OF INDIA
UNIQUE IDENTIFICATION AUTHORITY OF INDIA
To:
WW
Priya Ramesh Sharma
D/O: Ramesh Sharma ER RD
27, Board Colony, Patna, BihagsB00001
DOB: 05/07/2007
Gender: Female
5563 8827 4410
VID: 9188 3345 6620 7741
1947 www.uidai.gov.in
`;

const result = extractDocumentData(noisyAadhaarText);
console.log('Extracted Data:', {
  name: result.name,
  careOf: result.careOf,
  docNumber: result.docNumber,
  dob: result.dob,
  gender: result.gender,
  vidNumber: result.vidNumber,
  address: result.address,
  expiry: result.expiry,
});

assert.strictEqual(result.name, 'PRIYA RAMESH SHARMA', 'Name should be PRIYA RAMESH SHARMA and not WW');
assert.strictEqual(result.careOf, 'RAMESH SHARMA', 'Care of should be RAMESH SHARMA and not ER RD');
assert.strictEqual(result.docNumber, '5563 8827 4410');
assert.strictEqual(result.vidNumber, '9188 3345 6620 7741');
assert.strictEqual(result.dob, '05/07/2007');
assert.strictEqual(result.gender, 'Female');
assert.ok(result.address.includes('Bihar - 800001'), 'Address should repair BihagsB00001 to Bihar - 800001');
assert.strictEqual(result.expiry, 'Permanent / Lifetime');

console.log('✓ All noisy extraction edge case assertions passed!');

// 2. Testing Expiry on Driving License and ID documents
const dlText = `
UNION OF INDIA DRIVING LICENCE
DL NO: DL-0420110023456
Name: VIKRAM RAJPUT
Father: SURESH RAJPUT
DOB: 10/05/1985
VALID TILL: 09/05/2035
Address: 14 Civil Lines, Jaipur 302001
`;

const dlResult = extractDocumentData(dlText);
console.log('DL Data:', {
  name: dlResult.name,
  careOf: dlResult.careOf,
  expiry: dlResult.expiry,
});

assert.strictEqual(dlResult.name, 'VIKRAM RAJPUT');
assert.strictEqual(dlResult.careOf, 'SURESH RAJPUT');
assert.strictEqual(dlResult.expiry, '09/05/2035');

console.log('✓ Expiry date extraction test passed!');
