// server/test_gender_parsing.js
const assert = require('assert');
const { extractDocumentData } = require('./services/mrzParser');

console.log('--- Testing Strict Multilingual Gender/Sex Extraction ---');

// Case 1: Sex: F on the same line
const text1 = `
PASSPORT
Sex: F
Given Name(s): ALICE
Surname: SMITH
DOB: 18/03/2007
`;
const res1 = extractDocumentData(text1);
console.log('Case 1 (Sex: F):', res1.gender);
assert.strictEqual(res1.gender, 'Female');

// Case 2: Sex / लिंग on line 1, F on line 2
const text2 = `
PASSPORT
Sex / लिंग
F
Given Name(s): ELENA
Surname: ROVINA
DOB: 18/03/2007
`;
const res2 = extractDocumentData(text2);
console.log('Case 2 (Sex / लिंग \\n F):', res2.gender);
assert.strictEqual(res2.gender, 'Female');

// Case 3: Sex: M
const text3 = `
NATIONAL ID
Sex: M
Full Name: MARCUS AURELIUS
DOB: 01/01/1990
`;
const res3 = extractDocumentData(text3);
console.log('Case 3 (Sex: M):', res3.gender);
assert.strictEqual(res3.gender, 'Male');

// Case 4: Sex / Sexe : MALE / M
const text4 = `
PASSPORT
Sex / Sexe : M
Full Name: JEAN VALJEAN
DOB: 15/05/1988
`;
const res4 = extractDocumentData(text4);
console.log('Case 4 (Sex / Sexe : M):', res4.gender);
assert.strictEqual(res4.gender, 'Male');

// Case 5: Hindi label लिंग: महिला
const text5 = `
AADHAAR
लिंग / Gender: महिला / Female
Full Name: SUNITA DEVI
DOB: 14/08/1995
`;
const res5 = extractDocumentData(text5);
console.log('Case 5 (लिंग / Gender: महिला / Female):', res5.gender);
assert.strictEqual(res5.gender, 'Female');

// Case 6: Sex between Nationality and DOB with extra spacing
const text6 = `
PASSPORT
Nationality / राष्ट्रीयता
INDIAN
Sex / लिंग

F
Date of Birth / जन्म तिथि
18/03/2007
`;
const res6 = extractDocumentData(text6);
console.log('Case 6 (Multi-blank line Sex):', res6.gender);
assert.strictEqual(res6.gender, 'Female');

// Case 7: Unspecified when no Sex field in document
const text7 = `
IDENTITY CARD
Full Name: ALEX TAYLOR
DOB: 18/03/2007
`;
const res7 = extractDocumentData(text7);
console.log('Case 7 (No Sex field => Unspecified):', res7.gender);
assert.strictEqual(res7.gender, 'Unspecified');

console.log('✓ All Strict Gender/Sex test cases passed!');
