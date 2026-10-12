// server/test_passport_visual_zone.js
// Verification for Passport visual zone extraction
const assert = require('assert');
const { extractDocumentData } = require('./services/mrzParser');

const passportText = `
PASSPORT / पासपोर्ट
REPUBLIC OF INDIA / भारत गणराज्य
Type / Type: P  Country Code / कोड: IND  Passport No / पासपोर्ट क्र.: P9027451
Surname / उपनाम
GHOSH
Given Name(s) / दिया गया नाम
ANUSHKA
Nationality / राष्ट्रीयता
INDIAN
Sex / लिंग
F
Date of Birth / जन्म तिथि
18/03/2007
Place of Birth / जन्म स्थान
KOLKATA, WEST BENGAL
Name of Father / Legal Guardian / पिता / कानूनी अभिभावक का नाम
SUBRATA GHOSH
Name of Mother / माता का नाम
MAMATA GHOSH
Address / पता
14/2 LAKE GARDENS, KOLKATA, WEST BENGAL 700045
Date of Issue / जारी करने की तिथि: 22/06/2025
Date of Expiry / समाप्ति की तिथि: 21/06/2035
Place of Issue / जारी करने का स्थान: KOLKATA
`;

const result = extractDocumentData(passportText);
console.log('Passport Extracted Results:', {
  docType: result.docType,
  country: result.country,
  docNumber: result.docNumber,
  name: result.name,
  gender: result.gender,
  dob: result.dob,
  careOf: result.careOf,
  address: result.address,
  issueDate: result.issueDate,
  expiry: result.expiry,
});

assert.strictEqual(result.docType, 'Passport');
assert.strictEqual(result.country, 'India');
assert.strictEqual(result.docNumber, 'P9027451');
assert.strictEqual(result.name, 'ANUSHKA GHOSH');
assert.strictEqual(result.gender, 'Female');
assert.strictEqual(result.dob, '18/03/2007');
assert.strictEqual(result.careOf, 'SUBRATA GHOSH');
assert.strictEqual(result.address, '14/2 LAKE GARDENS, KOLKATA, WEST BENGAL 700045');
assert.strictEqual(result.issueDate, '22/06/2025');
assert.strictEqual(result.expiry, '21/06/2035');

console.log('✓ All Passport visual zone assertions passed with 100% accuracy!');
