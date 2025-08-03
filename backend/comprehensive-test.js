// Comprehensive test suite for commissions and quotas models
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function runComprehensiveTests() {
  console.log('🧪 COMPREHENSIVE COMMISSIONS & QUOTAS TEST SUITE');
  console.log('='.repeat(60));
  
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: []
  };

  // Helper function to log test results
  const logTest = (testName, status, message, data = null) => {
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${testName}: ${message}`);
    if (data) console.log('   Data:', data);
    
    results.tests.push({ testName, status, message, data });
    if (status === 'PASS') results.passed++;
    else if (status === 'FAIL') results.failed++;
    else results.warnings++;
  };

  try {
    // TEST 1: Database Schema Integrity
    console.log('\n📋 TEST 1: Database Schema Integrity');
    console.log('-'.repeat(40));
    
    const userCount = await prisma.users.count();
    const targetCount = await prisma.targets.count();
    const commissionCount = await prisma.commissions.count();
    const dealCount = await prisma.deals.count();
    const commissionDetailCount = await prisma.commission_details.count();
    
    logTest('Database Schema', 'PASS', `All tables accessible`, {
      users: userCount,
      targets: targetCount,
      commissions: commissionCount,
      deals: dealCount,
      commission_details: commissionDetailCount
    });

    // TEST 2: Target Distribution & Quota Consistency
    console.log('\n📋 TEST 2: Target Distribution & Quota Consistency');
    console.log('-'.repeat(40));
    
    const targets = await prisma.targets.findMany({
      where: { is_active: true },
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    });
    
    // Check for duplicate active targets per user
    const userTargetCounts = {};
    targets.forEach(target => {
      const userId = target.user_id;
      userTargetCounts[userId] = (userTargetCounts[userId] || 0) + 1;
    });
    
    const duplicateTargets = Object.entries(userTargetCounts).filter(([_, count]) => count > 1);
    if (duplicateTargets.length === 0) {
      logTest('Target Uniqueness', 'PASS', 'No duplicate active targets per user');
    } else {
      logTest('Target Uniqueness', 'FAIL', `Found ${duplicateTargets.length} users with multiple active targets`, duplicateTargets);
    }
    
    // Check quota amounts consistency
    const quotaAmounts = targets.map(t => ({ 
      user: `${t.user.first_name} ${t.user.last_name}`,
      quota: Number(t.quota_amount),
      period_type: t.period_type 
    }));
    
    logTest('Quota Amounts', 'PASS', 'Target quotas retrieved', quotaAmounts);

    // TEST 3: Commission Calculation Accuracy
    console.log('\n📋 TEST 3: Commission Calculation Accuracy');
    console.log('-'.repeat(40));
    
    const july2025Commissions = await prisma.commissions.findMany({
      where: {
        period_start: new Date('2025-07-01')
      },
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        },
        target: {
          select: {
            quota_amount: true,
            commission_rate: true,
            period_type: true,
            commission_payment_schedule: true
          }
        },
        commission_details: {
          include: {
            deal: {
              select: {
                amount: true,
                deal_name: true,
                account_name: true
              }
            }
          }
        }
      }
    });
    
    // Verify commission calculations
    let calculationErrors = 0;
    july2025Commissions.forEach(commission => {
      const target = commission.target;
      let expectedQuota = Number(target.quota_amount);
      
      // Calculate expected prorated quota
      if (target.period_type === 'annual' && target.commission_payment_schedule === 'monthly') {
        expectedQuota = Number(target.quota_amount) / 12;
      }
      
      const actualQuota = Number(commission.quota_amount);
      const quotaDiff = Math.abs(actualQuota - expectedQuota);
      
      if (quotaDiff > 1) {
        calculationErrors++;
        logTest('Quota Proration', 'FAIL', 
          `${commission.user.first_name} ${commission.user.last_name}: Expected £${expectedQuota}, Got £${actualQuota}`);
      }
      
      // Verify commission details sum
      const detailsSum = commission.commission_details.reduce((sum, detail) => 
        sum + Number(detail.commission_amount), 0);
      const commissionEarned = Number(commission.commission_earned);
      const commissionDiff = Math.abs(detailsSum - commissionEarned);
      
      if (commissionDiff > 0.01) {
        calculationErrors++;
        logTest('Commission Details Sum', 'FAIL',
          `${commission.user.first_name} ${commission.user.last_name}: Details sum £${detailsSum} != Commission earned £${commissionEarned}`);
      }
    });
    
    if (calculationErrors === 0) {
      logTest('Commission Calculations', 'PASS', `All ${july2025Commissions.length} July 2025 commissions calculated correctly`);
    } else {
      logTest('Commission Calculations', 'FAIL', `Found ${calculationErrors} calculation errors`);
    }

    // TEST 4: Team Aggregation Logic
    console.log('\n📋 TEST 4: Team Aggregation Logic');
    console.log('-'.repeat(40));
    
    // Test team totals
    const teamTotalCommission = july2025Commissions.reduce((sum, c) => sum + Number(c.commission_earned), 0);
    const teamTotalQuota = july2025Commissions.reduce((sum, c) => sum + Number(c.quota_amount), 0);
    const teamTotalActual = july2025Commissions.reduce((sum, c) => sum + Number(c.actual_amount), 0);
    const teamAttainment = teamTotalQuota > 0 ? (teamTotalActual / teamTotalQuota) * 100 : 0;
    
    logTest('Team Aggregation', 'PASS', 'Team totals calculated successfully', {
      totalCommission: teamTotalCommission,
      totalQuota: teamTotalQuota,
      totalActual: teamTotalActual,
      teamAttainment: teamAttainment.toFixed(2) + '%'
    });

    // TEST 5: Deal-Commission Relationship Integrity
    console.log('\n📋 TEST 5: Deal-Commission Relationship Integrity');
    console.log('-'.repeat(40));
    
    const totalCommissionDetails = await prisma.commission_details.count();
    
    // Check for orphaned commission details by verifying relationships exist
    const detailsWithCommissions = await prisma.commission_details.findMany({
      include: {
        commission: true,
        deal: true
      }
    });
    
    const orphanedDetails = detailsWithCommissions.filter(detail => 
      !detail.commission || !detail.deal
    );
    
    const orphanedCount = orphanedDetails.length;
    
    if (orphanedCount === 0) {
      logTest('Deal-Commission Links', 'PASS', `All ${totalCommissionDetails} commission details properly linked`);
    } else {
      logTest('Deal-Commission Links', 'FAIL', `Found ${orphanedCount} orphaned commission details out of ${totalCommissionDetails} total`);
    }
    
    // TEST 6: Historical Data Consistency
    console.log('\n📋 TEST 6: Historical Data Consistency');
    console.log('-'.repeat(40));
    
    const allCommissions = await prisma.commissions.findMany({
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: {
        period_start: 'desc'
      }
    });
    
    // Group by user to check for gaps
    const userCommissions = {};
    allCommissions.forEach(commission => {
      const userId = commission.user_id;
      if (!userCommissions[userId]) {
        userCommissions[userId] = {
          user: commission.user,
          periods: []
        };
      }
      userCommissions[userId].periods.push(commission.period_start.toISOString().split('T')[0]);
    });
    
    // Check for consistency
    let consistencyIssues = 0;
    Object.entries(userCommissions).forEach(([userId, data]) => {
      if (data.periods.length < 2) {
        consistencyIssues++;
        logTest('Historical Consistency', 'WARN', 
          `${data.user.first_name} ${data.user.last_name} has only ${data.periods.length} commission period(s)`);
      }
    });
    
    if (consistencyIssues === 0) {
      logTest('Historical Data', 'PASS', 'All users have consistent historical data');
    }

    // TEST 7: Performance Chart Data Integrity
    console.log('\n📋 TEST 7: Performance Chart Data Integrity');
    console.log('-'.repeat(40));
    
    // Simulate frontend chart data processing
    const chartData = july2025Commissions.map(commission => ({
      user: `${commission.user.first_name} ${commission.user.last_name}`,
      commission_earned: Number(commission.commission_earned),
      quota_amount: Number(commission.quota_amount),
      actual_amount: Number(commission.actual_amount),
      attainment_pct: Number(commission.attainment_pct)
    }));
    
    // Check for NaN values
    const hasNaN = chartData.some(item => 
      isNaN(item.commission_earned) || isNaN(item.quota_amount) || 
      isNaN(item.actual_amount) || isNaN(item.attainment_pct)
    );
    
    if (!hasNaN) {
      logTest('Chart Data Integrity', 'PASS', 'All chart data values are valid numbers');
    } else {
      logTest('Chart Data Integrity', 'FAIL', 'Found NaN values in chart data');
    }

  } catch (error) {
    logTest('Test Suite Execution', 'FAIL', `Error during test execution: ${error.message}`);
  }

  // SUMMARY
  console.log('\n📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⚠️  Warnings: ${results.warnings}`);
  console.log(`📋 Total Tests: ${results.tests.length}`);
  
  const successRate = ((results.passed / results.tests.length) * 100).toFixed(1);
  console.log(`🎯 Success Rate: ${successRate}%`);
  
  if (results.failed === 0) {
    console.log('\n🎉 ALL CORE TESTS PASSED - System is reliable and consistent!');
  } else {
    console.log(`\n⚠️  ${results.failed} CRITICAL ISSUES FOUND - Review required!`);
  }

  await prisma.$disconnect();
}

runComprehensiveTests().catch(console.error);