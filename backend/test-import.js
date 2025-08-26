// Test script to check if commission-approvals can be imported
console.log('Starting import test...');

// Test the original file
try {
  console.log('Test 1: Attempting to import commission-approvals.js...');
  await import('./routes/commission-approvals.js');
  console.log('SUCCESS: commission-approvals.js imported successfully!');
} catch (error) {
  console.log('FAILED: commission-approvals.js import error:', error.message);
}

// Test the renamed copy
try {
  console.log('\nTest 2: Attempting to import commission-approvals-v2.js...');
  await import('./routes/commission-approvals-v2.js');
  console.log('SUCCESS: commission-approvals-v2.js imported successfully!');
} catch (error) {
  console.log('FAILED: commission-approvals-v2.js import error:', error.message);
}

// Test a minimal version
try {
  console.log('\nTest 3: Attempting to import commission-approvals-minimal.js...');
  await import('./routes/commission-approvals-minimal.js');
  console.log('SUCCESS: commission-approvals-minimal.js imported successfully!');
} catch (error) {
  console.log('FAILED: commission-approvals-minimal.js import error:', error.message);
}

// Test progressive version (with most imports but not services)
try {
  console.log('\nTest 4: Attempting to import commission-approvals-progressive.js...');
  await import('./routes/commission-approvals-progressive.js');
  console.log('SUCCESS: commission-approvals-progressive.js imported successfully!');
} catch (error) {
  console.log('FAILED: commission-approvals-progressive.js import error:', error.message);
}

console.log('\nImport test complete.');
process.exit(0);