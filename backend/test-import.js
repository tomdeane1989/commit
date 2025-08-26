// Test script to check if commission-approvals can be imported
console.log('Starting import test...');

try {
  console.log('Attempting to import commission-approvals.js...');
  await import('./routes/commission-approvals.js');
  console.log('SUCCESS: commission-approvals.js imported successfully!');
} catch (error) {
  console.log('FAILED: commission-approvals.js import error:');
  console.log('Error message:', error.message);
  console.log('Error stack:', error.stack);
}

console.log('Import test complete.');
process.exit(0);