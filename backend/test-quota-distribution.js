import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testQuotaDistribution() {
  console.log('🎯 TESTING QUOTA DISTRIBUTION FUNCTIONALITY');
  console.log('='.repeat(50));
  
  try {
    // Test 1: Current Active Targets
    console.log('\n📋 TEST 1: Current Active Targets');
    console.log('-'.repeat(30));
    
    const activeTargets = await prisma.targets.findMany({
      where: { is_active: true },
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });
    
    console.log('Current Active Targets:');
    activeTargets.forEach(target => {
      console.log(`  ${target.user.first_name} ${target.user.last_name}: £${Number(target.quota_amount).toLocaleString()} (${target.period_type})`);
    });
    
    // Test 2: Even Distribution Analysis
    console.log('\n📋 TEST 2: Even Distribution Analysis');
    console.log('-'.repeat(30));
    
    const quotaAmounts = activeTargets.map(t => Number(t.quota_amount));
    const avgQuota = quotaAmounts.reduce((sum, amt) => sum + amt, 0) / quotaAmounts.length;
    const minQuota = Math.min(...quotaAmounts);
    const maxQuota = Math.max(...quotaAmounts);
    const quotaRange = maxQuota - minQuota;
    
    console.log(`Average Quota: £${avgQuota.toLocaleString()}`);
    console.log(`Min Quota: £${minQuota.toLocaleString()}`);
    console.log(`Max Quota: £${maxQuota.toLocaleString()}`);
    console.log(`Range: £${quotaRange.toLocaleString()}`);
    
    // Check if quotas are evenly distributed (within 5% variance)
    const variance = quotaRange / avgQuota;
    const isEvenlyDistributed = variance <= 0.05;
    
    console.log(`Variance: ${(variance * 100).toFixed(2)}%`);
    console.log(`Even Distribution: ${isEvenlyDistributed ? '✅ YES' : '❌ NO'}`);
    
    // Test 3: Commission Calculation Consistency
    console.log('\n📋 TEST 3: Commission Calculation Consistency');
    console.log('-'.repeat(30));
    
    const commissions = await prisma.commissions.findMany({
      where: {
        period_start: new Date('2025-07-01')
      },
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true
          }
        },
        target: {
          select: {
            quota_amount: true,
            commission_rate: true,
            period_type: true,
            commission_payment_schedule: true
          }
        }
      }
    });
    
    console.log('Commission-Target Consistency:');
    let consistencyIssues = 0;
    
    commissions.forEach(commission => {
      const target = commission.target;
      let expectedQuota = Number(target.quota_amount);
      
      // Calculate expected prorated quota
      if (target.period_type === 'annual' && target.commission_payment_schedule === 'monthly') {
        expectedQuota = Number(target.quota_amount) / 12;
      } else if (target.period_type === 'quarterly' && target.commission_payment_schedule === 'monthly') {
        expectedQuota = Number(target.quota_amount) / 3;
      }
      
      const actualQuota = Number(commission.quota_amount);
      const quotaDiff = Math.abs(actualQuota - expectedQuota);
      
      if (quotaDiff > 1) {
        console.log(`  ❌ ${commission.user.first_name} ${commission.user.last_name}: Expected £${expectedQuota}, Got £${actualQuota}`);
        consistencyIssues++;
      } else {
        console.log(`  ✅ ${commission.user.first_name} ${commission.user.last_name}: £${actualQuota} (${(actualQuota/expectedQuota*100).toFixed(1)}% of expected)`);
      }
    });
    
    if (consistencyIssues === 0) {
      console.log('✅ All commission quotas are consistent with targets');
    } else {
      console.log(`❌ Found ${consistencyIssues} quota consistency issues`);
    }
    
    // Test 4: Team Performance Metrics
    console.log('\n📋 TEST 4: Team Performance Metrics');
    console.log('-'.repeat(30));
    
    const teamMetrics = {
      totalQuota: commissions.reduce((sum, c) => sum + Number(c.quota_amount), 0),
      totalActual: commissions.reduce((sum, c) => sum + Number(c.actual_amount), 0),
      totalCommission: commissions.reduce((sum, c) => sum + Number(c.commission_earned), 0),
      memberCount: commissions.length
    };
    
    teamMetrics.avgQuotaPerMember = teamMetrics.totalQuota / teamMetrics.memberCount;
    teamMetrics.avgActualPerMember = teamMetrics.totalActual / teamMetrics.memberCount;
    teamMetrics.teamAttainment = (teamMetrics.totalActual / teamMetrics.totalQuota) * 100;
    
    console.log(`Team Size: ${teamMetrics.memberCount} members`);
    console.log(`Total Team Quota: £${teamMetrics.totalQuota.toLocaleString()}`);
    console.log(`Total Team Actual: £${teamMetrics.totalActual.toLocaleString()}`);
    console.log(`Total Team Commission: £${teamMetrics.totalCommission.toLocaleString()}`);
    console.log(`Avg Quota per Member: £${teamMetrics.avgQuotaPerMember.toLocaleString()}`);
    console.log(`Avg Actual per Member: £${teamMetrics.avgActualPerMember.toLocaleString()}`);
    console.log(`Team Attainment: ${teamMetrics.teamAttainment.toFixed(2)}%`);
    
    // Test 5: Data Integrity Summary
    console.log('\n📋 TEST 5: Data Integrity Summary');
    console.log('-'.repeat(30));
    
    const integrityChecks = {
      uniqueActiveTargets: activeTargets.length === new Set(activeTargets.map(t => t.user_id)).size,
      consistentCommissions: consistencyIssues === 0,
      completeCommissionData: commissions.every(c => c.commission_earned !== null && c.quota_amount !== null),
      validAttainmentCalcs: commissions.every(c => !isNaN(Number(c.attainment_pct)))
    };
    
    Object.entries(integrityChecks).forEach(([check, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${check}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
    
    const allPassed = Object.values(integrityChecks).every(check => check);
    
    console.log('\n🎯 OVERALL RESULT:');
    if (allPassed) {
      console.log('✅ ALL QUOTA DISTRIBUTION TESTS PASSED!');
      console.log('📊 System is consistent and reliable for quota management');
    } else {
      console.log('❌ SOME TESTS FAILED - Review required');
    }
    
  } catch (error) {
    console.error('❌ Error during quota distribution testing:', error);
  }
  
  await prisma.$disconnect();
}

testQuotaDistribution().catch(console.error);