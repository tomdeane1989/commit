import express from 'express';

const app = express();
const routeFiles = [
  'auth.js',
  'users.js', 
  'deals.js',
  'targets.js',
  'commissions.js',
  'crm.js',
  'dashboard.js'
];

console.log('Testing route files...');

for (const file of routeFiles) {
  try {
    console.log(`Testing ${file}...`);
    const route = await import(`./routes/${file}`);
    console.log(`✓ ${file} loaded successfully`);
  } catch (error) {
    console.error(`✗ Error in ${file}:`, error.message);
  }
}