// Simulate the frontend aggregation logic
const testData = [
  { user: 'Alfie', actual: 0, quota: 20000, attainment: 0 },
  { user: 'Joel', actual: 15628, quota: 20000, attainment: 78.14 },
  { user: 'Rob', actual: 18876, quota: 20000, attainment: 94.38 },
  { user: 'Tobias', actual: 12178, quota: 20000, attainment: 60.89 },
  { user: 'Tom', actual: 25614, quota: 16667, attainment: 153.68 }
];

console.log('🔍 Testing July 2025 team aggregation:');
console.log();

// Individual data
testData.forEach(member => {
  console.log(`${member.user}: £${member.actual.toLocaleString()} / £${member.quota.toLocaleString()} = ${member.attainment.toFixed(1)}%`);
});

console.log();

// Team totals (how frontend aggregates)
const teamActual = testData.reduce((sum, m) => sum + m.actual, 0);
const teamQuota = testData.reduce((sum, m) => sum + m.quota, 0);
const teamAttainment = teamQuota > 0 ? (teamActual / teamQuota) * 100 : 0;

console.log(`📊 Team Totals:`);
console.log(`   Total Actual: £${teamActual.toLocaleString()}`);
console.log(`   Total Quota: £${teamQuota.toLocaleString()}`);
console.log(`   Team Attainment: ${teamAttainment.toFixed(1)}%`);

console.log();

// Expected monthly team quota (5 people × £20k average)
const expectedMonthlyTeamQuota = 5 * 20000; // Simplified
const expectedAttainment = (teamActual / expectedMonthlyTeamQuota) * 100;

console.log(`🎯 Expected vs Actual:`);
console.log(`   Expected monthly team quota: £${expectedMonthlyTeamQuota.toLocaleString()}`);
console.log(`   Expected team attainment: ${expectedAttainment.toFixed(1)}%`);
console.log(`   Actual aggregated quota: £${teamQuota.toLocaleString()}`);
console.log(`   Difference: £${(teamQuota - expectedMonthlyTeamQuota).toLocaleString()}`);

// Check if the issue is Tom's different quota
console.log();
console.log(`💡 Analysis:`);
console.log(`   Tom's quota is £${(20000 - 16667).toLocaleString()} less than others`);
console.log(`   This reduces team quota from £100k to £${teamQuota.toLocaleString()}`);
console.log(`   Making team attainment appear ${(teamAttainment - expectedAttainment).toFixed(1)}% higher`);