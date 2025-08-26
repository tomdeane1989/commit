#!/usr/bin/env node
// Diagnostic script to check file properties
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'routes', 'commission-approvals.js');

console.log('=== File Diagnostic for commission-approvals.js ===');
console.log('File path:', filePath);
console.log('File exists:', fs.existsSync(filePath));

if (fs.existsSync(filePath)) {
  const stats = fs.statSync(filePath);
  console.log('File size:', stats.size, 'bytes');
  console.log('File modified:', stats.mtime);
  
  // Read file content
  const content = fs.readFileSync(filePath, 'utf8');
  console.log('File length:', content.length, 'characters');
  console.log('Line count:', content.split('\n').length);
  
  // Check first few lines
  const lines = content.split('\n');
  console.log('\nFirst 5 lines:');
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    console.log(`${i + 1}: ${lines[i].substring(0, 80)}${lines[i].length > 80 ? '...' : ''}`);
  }
  
  // Check last few lines
  console.log('\nLast 5 lines:');
  const startLine = Math.max(0, lines.length - 5);
  for (let i = startLine; i < lines.length; i++) {
    console.log(`${i + 1}: ${lines[i].substring(0, 80)}${lines[i].length > 80 ? '...' : ''}`);
  }
  
  // Check for BOM or unusual characters at start
  const firstBytes = Buffer.from(content.substring(0, 10));
  console.log('\nFirst 10 bytes (hex):', firstBytes.toString('hex'));
  
  // Check for unusual line endings
  const crlfCount = (content.match(/\r\n/g) || []).length;
  const lfCount = (content.match(/\n/g) || []).length;
  console.log('\nLine endings: CRLF:', crlfCount, 'LF:', lfCount);
  
  // Check if file ends with newline
  console.log('Ends with newline:', content.endsWith('\n'));
  
  // Look for the export statement
  const exportMatch = content.match(/export\s+default\s+router/);
  if (exportMatch) {
    const exportIndex = content.indexOf(exportMatch[0]);
    console.log('\nExport statement found at character:', exportIndex);
    console.log('Characters after export:', content.length - exportIndex - exportMatch[0].length);
  }
}

console.log('\n=== End Diagnostic ===');