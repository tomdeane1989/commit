// Test if service files can be imported directly
console.log('Testing service file imports...\n');

// Test 1: Import CommissionEngine
console.log('Test 1: Importing CommissionEngine.js...');
try {
  const CommissionEngine = await import('./services/CommissionEngine.js');
  console.log('SUCCESS: CommissionEngine imported!');
  console.log('Exported:', Object.keys(CommissionEngine));
} catch (error) {
  console.log('FAILED:', error.message);
  if (error.stack.includes('Unexpected token')) {
    console.log('Module syntax error in CommissionEngine or its dependencies');
  }
}

// Test 2: Import enhancedCommissionCalculator
console.log('\nTest 2: Importing enhancedCommissionCalculator.js...');
try {
  const calculator = await import('./services/enhancedCommissionCalculator.js');
  console.log('SUCCESS: enhancedCommissionCalculator imported!');
  console.log('Exported:', Object.keys(calculator));
} catch (error) {
  console.log('FAILED:', error.message);
  if (error.stack.includes('Unexpected token')) {
    console.log('Module syntax error in enhancedCommissionCalculator or its dependencies');
  }
}

// Test 3: Import targetNaming utility (used by CommissionEngine)
console.log('\nTest 3: Importing utils/targetNaming.js...');
try {
  const naming = await import('./utils/targetNaming.js');
  console.log('SUCCESS: targetNaming imported!');
  console.log('Exported:', Object.keys(naming));
} catch (error) {
  console.log('FAILED:', error.message);
  if (error.stack.includes('Unexpected token')) {
    console.log('Module syntax error in targetNaming');
  }
}

// Test 4: Import json-rules-engine (used by CommissionEngine)
console.log('\nTest 4: Importing json-rules-engine...');
try {
  const { Engine } = await import('json-rules-engine');
  console.log('SUCCESS: json-rules-engine imported!');
  console.log('Engine constructor exists:', typeof Engine === 'function');
} catch (error) {
  console.log('FAILED:', error.message);
}

console.log('\nService import tests complete.');
process.exit(0);