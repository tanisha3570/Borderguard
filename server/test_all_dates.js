// server/test_all_dates.js
const assert = require('assert');
const { extractDocumentData } = require('./services/mrzParser');

console.log('--- Testing Comprehensive Expiry Date Extraction ---');

// Case 1: Indian Passport with multiline Hindi/English labels
const passportText1 = `
REPUBLIC OF INDIA / भारत गणराज्य
PASSPORT / पासपोर्ट
Type: P  Country Code: IND  Passport No: P9027451
Surname: GHOSH
Given Name: ANUSHKA
Sex: F
Date of Birth: 18/03/2007
Date of Issue / जारी करने की तिथि: 22/06/2025
Date of Expiry / समाप्ति की तिथि: 21/06/2035
Address: 14/2 LAKE GARDENS, KOLKATA, WEST BENGAL 700045
`;
const res1 = extractDocumentData(passportText1);
console.log('Case 1 Expiry:', res1.expiry);
assert.strictEqual(res1.expiry, '21/06/2035');
assert.strictEqual(res1.name, 'ANUSHKA GHOSH');
assert.strictEqual(res1.gender, 'Female');

// Case 2: Multi-line where date is on next line
const passportText2 = `
PASSPORT
Surname
GHOSH
Given Names
ANUSHKA
Date of Birth
18/03/2007
Date of Issue
22/06/2025
Date of Expiry
21/06/2035
`;
const res2 = extractDocumentData(passportText2);
console.log('Case 2 Expiry:', res2.expiry);
assert.strictEqual(res2.expiry, '21/06/2035');

// Case 3: Date with word month (e.g. 21 JUN 2035)
const passportText3 = `
PASSPORT
Name: ANUSHKA GHOSH
DOB: 18 MAR 2007
Issued: 22 JUN 2025
Expires: 21 JUN 2035
`;
const res3 = extractDocumentData(passportText3);
console.log('Case 3 Expiry:', res3.expiry);
assert.strictEqual(res3.expiry, '21/06/2035');

// Case 4: Driving License with Valid Upto
const dlText = `
UNION OF INDIA DRIVING LICENCE
DL NO: DL-0420110023456
NAME: VIKRAM RAJPUT
DOB: 10/05/1985
VALID UPTO (NT): 09/05/2035
`;
const res4 = extractDocumentData(dlText);
console.log('Case 4 DL Expiry:', res4.expiry);
assert.strictEqual(res4.expiry, '09/05/2035');

// Case 5: Real Aadhaar Card with No Expiry -> Permanent / Lifetime
const aadhaarText = `
GOVERNMENT OF INDIA
UNIQUE IDENTIFICATION AUTHORITY OF INDIA
To: Priya Ramesh Sharma
DOB: 14/08/1995
Gender: FEMALE
5482 9104 3821
VID: 9182 7364 5512 3490
`;
const res5 = extractDocumentData(aadhaarText);
console.log('Case 5 Aadhaar Expiry:', res5.expiry);
assert.strictEqual(res5.expiry, 'Permanent / Lifetime');

console.log('✓ All Date test cases passed perfectly!');
