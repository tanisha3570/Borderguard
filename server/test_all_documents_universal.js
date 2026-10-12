// server/test_all_documents_universal.js
// Verification for Universal Document Extraction across diverse global and Indian identity documents

const assert = require('assert');
const { extractDocumentData } = require('./services/mrzParser');

console.log('====================================================');
console.log('  UNIVERSAL DOCUMENT & FIELD EXTRACTION TEST SUITE  ');
console.log('====================================================\n');

// 1. Driving License with Blood Group, COV, Issue Date, Validity
const dlText = `
UNION OF INDIA DRIVING LICENCE
GOVERNMENT OF MAHARASHTRA
DL NO: MH-0220180098765
NAME: RAJESH ARUN PATIL
S/O: ARUN PATIL
DOB: 24/09/1991
BLOOD GROUP: B+
ISSUE DATE: 12/03/2018
VALID TILL: 23/09/2041
COV: LMV, MCWG
ADDRESS: Flat 402, Shivam Apts, Andheri West, Mumbai, Maharashtra 400058
`;

const dlRes = extractDocumentData(dlText);
console.log('--- Test 1: Driving License with Rich Metadata ---');
console.log('Extracted:', {
  docType: dlRes.docType,
  name: dlRes.name,
  careOf: dlRes.careOf,
  bloodGroup: dlRes.bloodGroup,
  vehicleClass: dlRes.vehicleClass,
  issueDate: dlRes.issueDate,
  expiry: dlRes.expiry,
  age: dlRes.age,
  allFieldsCount: Object.keys(dlRes.allDetectedFields).length,
});

assert.strictEqual(dlRes.docType, 'Driving License');
assert.strictEqual(dlRes.name, 'RAJESH ARUN PATIL');
assert.strictEqual(dlRes.careOf, 'ARUN PATIL');
assert.strictEqual(dlRes.bloodGroup, 'B+');
assert.strictEqual(dlRes.vehicleClass, 'LMV, MCWG');
assert.strictEqual(dlRes.issueDate, '12/03/2018');
assert.strictEqual(dlRes.expiry, '23/09/2041');
assert.strictEqual(typeof dlRes.age, 'number');
assert.ok(Object.keys(dlRes.allDetectedFields).length >= 8);
console.log('✓ Driving License rich extraction test passed!\n');

// 2. Voter ID (EPIC) Card
const voterText = `
ELECTION COMMISSION OF INDIA
ELECTOR PHOTO IDENTITY CARD
EPIC NO: WBF1234567
Name: SNEHA CHATTERJEE
Father's Name: AMIT CHATTERJEE
Gender: Female
DOB: 18/11/1996
Address: 12 Lake Gardens, South 24 Parganas, Kolkata 700045
`;

const voterRes = extractDocumentData(voterText);
console.log('--- Test 2: Voter ID (EPIC) Card ---');
console.log('Extracted:', {
  docType: voterRes.docType,
  name: voterRes.name,
  docNumber: voterRes.docNumber,
  careOf: voterRes.careOf,
  gender: voterRes.gender,
  dob: voterRes.dob,
  address: voterRes.address,
});

assert.strictEqual(voterRes.docType, 'Voter ID');
assert.strictEqual(voterRes.name, 'SNEHA CHATTERJEE');
assert.strictEqual(voterRes.docNumber, 'WBF1234567');
assert.strictEqual(voterRes.careOf, 'AMIT CHATTERJEE');
assert.strictEqual(voterRes.gender, 'Female');
assert.strictEqual(voterRes.dob, '18/11/1996');
console.log('✓ Voter ID extraction test passed!\n');

// 3. Indian Passport Visual Info Page
const passVisualText = `
PASSPORT
REPUBLIC OF INDIA
Type: P  Country Code: IND  Passport No: Z9182734
Surname: MALHOTRA
Given Name(s): VIKRAMADITYA
Nationality: INDIAN
Sex: M
Date of Birth: 05/12/1988
Place of Birth: JAIPUR, RAJASTHAN
Place of Issue: JAIPUR
Date of Issue: 14/06/2021
Date of Expiry: 13/06/2031
Name of Father: SURENDRA MALHOTRA
Name of Mother: USHA MALHOTRA
`;

const passVisualRes = extractDocumentData(passVisualText);
console.log('--- Test 3: Passport Visual Zone Fields ---');
console.log('Extracted:', {
  docType: passVisualRes.docType,
  name: passVisualRes.name,
  docNumber: passVisualRes.docNumber,
  dob: passVisualRes.dob,
  placeOfBirth: passVisualRes.placeOfBirth,
  placeOfIssue: passVisualRes.placeOfIssue,
  issueDate: passVisualRes.issueDate,
  expiry: passVisualRes.expiry,
  allFields: passVisualRes.allDetectedFields,
});

assert.strictEqual(passVisualRes.docType, 'Passport');
assert.strictEqual(passVisualRes.name, 'VIKRAMADITYA MALHOTRA');
assert.strictEqual(passVisualRes.docNumber, 'Z9182734');
assert.strictEqual(passVisualRes.gender, 'Male');
assert.strictEqual(passVisualRes.dob, '05/12/1988');
assert.strictEqual(passVisualRes.placeOfBirth, 'JAIPUR, RAJASTHAN');
assert.strictEqual(passVisualRes.placeOfIssue, 'JAIPUR');
assert.strictEqual(passVisualRes.issueDate, '14/06/2021');
assert.strictEqual(passVisualRes.expiry, '13/06/2031');
console.log('✓ Passport Visual Zone extraction test passed!\n');

// 4. Aadhaar Card (Back page with address & Care of)
const aadhaarBackText = `
UNIQUE IDENTIFICATION AUTHORITY OF INDIA
Address:
C/O: Ramesh Kumar Gupta
House No 54, Sector 21, Gandhinagar, Gujarat - 382021
8921 4412 9012
1947 help@uidai.gov.in www.uidai.gov.in
`;

const aadhaarBackRes = extractDocumentData(aadhaarBackText);
console.log('--- Test 4: Aadhaar Back Side ---');
console.log('Extracted:', {
  docType: aadhaarBackRes.docType,
  careOf: aadhaarBackRes.careOf,
  docNumber: aadhaarBackRes.docNumber,
  address: aadhaarBackRes.address,
});

assert.strictEqual(aadhaarBackRes.docType, 'Aadhaar Card');
assert.strictEqual(aadhaarBackRes.careOf, 'RAMESH KUMAR GUPTA');
assert.strictEqual(aadhaarBackRes.docNumber, '8921 4412 9012');
assert.ok(aadhaarBackRes.address.includes('Gandhinagar, Gujarat - 382021'));
console.log('✓ Aadhaar Back extraction test passed!\n');

console.log('====================================================');
console.log('  ALL UNIVERSAL EXTRACTION TESTS PASSED! (4/4)      ');
console.log('====================================================');
