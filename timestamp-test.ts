import { parseTimestamp } from './lib/transcript';

const testCases = [
  '0.01',
  '0.05',
  '1.30',
  '0.010',
  '0:01',
  '1:30',
  '90.5',
  '120',
];

console.log("Running timestamp parser tests...");
console.log("=================================");

testCases.forEach(testCase => {
  const result = parseTimestamp(testCase);
  console.log(`Input: "${testCase}" -> Output: ${result}`);
});

console.log("=================================");
console.log("Testing specific bug cases:");
const bugCase1 = '0.01';
const result1 = parseTimestamp(bugCase1);
console.log(`Input: "${bugCase1}" -> Expected: 1, Actual: ${result1} -> ${result1 === 1 ? 'PASS' : 'FAIL'}`);

const bugCase2 = '1.30';
const result2 = parseTimestamp(bugCase2);
console.log(`Input: "${bugCase2}" -> Expected: 90, Actual: ${result2} -> ${result2 === 90 ? 'PASS' : 'FAIL'}`);

const bugCase3 = '0.010';
const result3 = parseTimestamp(bugCase3);
console.log(`Input: "${bugCase3}" -> Expected: 10, Actual: ${result3} -> ${result3 === 10 ? 'PASS' : 'FAIL'}`);

const bugCase4 = '0.05';
const result4 = parseTimestamp(bugCase4);
console.log(`Input: "${bugCase4}" -> Expected: 5, Actual: ${result4} -> ${result4 === 5 ? 'PASS' : 'FAIL'}`);

