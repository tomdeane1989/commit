import { PrismaClient } from '@prisma/client';
import { Parser } from 'json2csv';

const prisma = new PrismaClient();

/**
 * Xero Export Service
 * Generates CSV exports compatible with Xero UK payroll and bills
 */
class XeroExportService {
  /**
   * Export approved commissions as Xero Bills CSV
   * Format: For importing as supplier bills (accounts payable)
   */
  async exportAsBills(commissionIds, options = {}) {
    const { 
      taxRate = 0, // UK VAT if applicable (usually 0 for employee commissions)
      accountCode = '6000', // Default wages/salaries account
      dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    } = options;

    // Fetch commissions with related data - allow all statuses for export
    const commissions = await prisma.commissions.findMany({
      where: {
        id: { in: commissionIds }
      },
      include: {
        user: true,
        deal: true,
        target: true
      }
    });

    if (commissions.length === 0) {
      throw new Error('No commissions found');
    }

    // Group by user for consolidated bills
    const billsByUser = {};
    for (const commission of commissions) {
      const userId = commission.user_id;
      if (!billsByUser[userId]) {
        billsByUser[userId] = {
          user: commission.user,
          commissions: [],
          total: 0
        };
      }
      billsByUser[userId].commissions.push(commission);
      billsByUser[userId].total += Number(commission.commission_amount);
    }

    // Create bill rows for Xero
    const billRows = [];
    const invoiceDate = new Date().toISOString().split('T')[0];
    const dueDateStr = dueDate.toISOString().split('T')[0];

    for (const [userId, data] of Object.entries(billsByUser)) {
      const { user, commissions, total } = data;
      const contactName = `${user.first_name} ${user.last_name}`;
      const invoiceNumber = `COMM-${new Date().getFullYear()}-${userId.slice(-6).toUpperCase()}`;
      
      // Create a bill row with line items
      billRows.push({
        '*ContactName': contactName,
        'EmailAddress': user.email,
        'POAddressLine1': '', // Optional
        'POAddressLine2': '',
        'POAddressLine3': '',
        'POAddressLine4': '',
        'POCity': '',
        'PORegion': '',
        'POPostalCode': '',
        'POCountry': 'United Kingdom',
        '*InvoiceNumber': invoiceNumber,
        '*InvoiceDate': invoiceDate,
        '*DueDate': dueDateStr,
        'Total': total.toFixed(2),
        'TaxTotal': (total * taxRate).toFixed(2),
        'InvoiceAmountPaid': '0.00',
        'InvoiceAmountDue': total.toFixed(2),
        'InventoryItemCode': '',
        '*Description': `Sales Commission - ${commissions[0].target_name || 'Period'}`,
        '*Quantity': '1',
        '*UnitAmount': total.toFixed(2),
        '*AccountCode': accountCode,
        '*TaxType': taxRate > 0 ? 'OUTPUT2' : 'NONE', // UK VAT codes
        'TrackingName1': '',
        'TrackingOption1': '',
        'TrackingName2': '',
        'TrackingOption2': '',
        'Currency': 'GBP',
        'BrandingTheme': ''
      });

      // Add additional line items for detail if multiple commissions
      if (commissions.length > 1) {
        for (const commission of commissions) {
          billRows.push({
            '*ContactName': '',
            'EmailAddress': '',
            'POAddressLine1': '',
            'POAddressLine2': '',
            'POAddressLine3': '',
            'POAddressLine4': '',
            'POCity': '',
            'PORegion': '',
            'POPostalCode': '',
            'POCountry': '',
            '*InvoiceNumber': '',
            '*InvoiceDate': '',
            '*DueDate': '',
            'Total': '',
            'TaxTotal': '',
            'InvoiceAmountPaid': '',
            'InvoiceAmountDue': '',
            'InventoryItemCode': '',
            '*Description': `  - ${commission.deal.deal_name} (£${Number(commission.deal_amount).toLocaleString()})`,
            '*Quantity': '',
            '*UnitAmount': '',
            '*AccountCode': '',
            '*TaxType': '',
            'TrackingName1': '',
            'TrackingOption1': '',
            'TrackingName2': '',
            'TrackingOption2': '',
            'Currency': '',
            'BrandingTheme': ''
          });
        }
      }
    }

    // Convert to CSV
    const fields = Object.keys(billRows[0]);
    const parser = new Parser({ fields });
    const csv = parser.parse(billRows);

    return {
      csv,
      summary: {
        users: Object.keys(billsByUser).length,
        commissions: commissions.length,
        total: Object.values(billsByUser).reduce((sum, data) => sum + data.total, 0)
      }
    };
  }

  /**
   * Export approved commissions as Xero Payroll CSV
   * Format: For importing as payroll earnings/additional pay
   */
  async exportAsPayroll(commissionIds, options = {}) {
    const { 
      payPeriodEnd = new Date(),
      earningsType = 'Commission' 
    } = options;

    // Fetch commissions with related data - allow all statuses for export
    const commissions = await prisma.commissions.findMany({
      where: {
        id: { in: commissionIds }
      },
      include: {
        user: true,
        deal: true,
        target: true
      }
    });

    if (commissions.length === 0) {
      throw new Error('No commissions found');
    }

    // Group by user for payroll
    const payrollByUser = {};
    for (const commission of commissions) {
      const userId = commission.user_id;
      if (!payrollByUser[userId]) {
        payrollByUser[userId] = {
          user: commission.user,
          commissions: [],
          total: 0
        };
      }
      payrollByUser[userId].commissions.push(commission);
      payrollByUser[userId].total += Number(commission.commission_amount);
    }

    // Create payroll rows for Xero UK format
    const payrollRows = [];
    const payPeriodEndStr = payPeriodEnd.toISOString().split('T')[0];

    for (const [userId, data] of Object.entries(payrollByUser)) {
      const { user, commissions, total } = data;
      
      payrollRows.push({
        'Employee Number': user.employee_id || userId.slice(-6).toUpperCase(),
        'Employee Name': `${user.first_name} ${user.last_name}`,
        'Email': user.email,
        'Pay Period End Date': payPeriodEndStr,
        'Earnings Type': earningsType,
        'Units/Hours': '', // Not applicable for commission
        'Rate': '', // Not applicable for commission  
        'Amount': total.toFixed(2),
        'Tax Code': user.tax_code || '1257L', // Default UK tax code
        'NI Category': user.ni_category || 'A', // Default NI category
        'Notes': `Commission for ${commissions.length} deal(s) - ${commissions[0].target_name || 'Period'}`,
        'Department': user.department || 'Sales',
        'Cost Centre': ''
      });
    }

    // Convert to CSV
    const fields = Object.keys(payrollRows[0]);
    const parser = new Parser({ fields });
    const csv = parser.parse(payrollRows);

    return {
      csv,
      summary: {
        employees: payrollRows.length,
        commissions: commissions.length,
        total: Object.values(payrollByUser).reduce((sum, data) => sum + data.total, 0),
        payPeriodEnd: payPeriodEndStr
      }
    };
  }

  /**
   * Export detailed commission report
   * Format: Detailed breakdown for internal records
   */
  async exportDetailedReport(commissionIds) {
    const commissions = await prisma.commissions.findMany({
      where: {
        id: { in: commissionIds }
      },
      include: {
        user: true,
        deal: true,
        target: true,
        approvals: {
          orderBy: { performed_at: 'desc' },
          take: 1
        }
      }
    });

    const reportRows = commissions.map(commission => ({
      'Commission ID': commission.id,
      'Employee': `${commission.user.first_name} ${commission.user.last_name}`,
      'Employee Email': commission.user.email,
      'Deal Name': commission.deal.deal_name,
      'Deal Amount': Number(commission.deal_amount).toFixed(2),
      'Commission Rate': `${(Number(commission.commission_rate) * 100).toFixed(1)}%`,
      'Commission Amount': Number(commission.commission_amount).toFixed(2),
      'Target/Period': commission.target_name || 'No Target',
      'Deal Close Date': commission.deal.close_date.toISOString().split('T')[0],
      'Calculated Date': commission.calculated_at.toISOString().split('T')[0],
      'Approved Date': commission.approved_at ? commission.approved_at.toISOString().split('T')[0] : '',
      'Approved By': commission.approved_by || '',
      'Status': commission.status,
      'Payment Reference': commission.payment_reference || '',
      'Notes': commission.notes || ''
    }));

    const fields = Object.keys(reportRows[0] || {});
    const parser = new Parser({ fields });
    const csv = parser.parse(reportRows);

    return {
      csv,
      summary: {
        records: reportRows.length,
        total: reportRows.reduce((sum, row) => sum + parseFloat(row['Commission Amount']), 0)
      }
    };
  }

  /**
   * Mark commissions as exported
   */
  async markAsExported(commissionIds, exportType, reference, userId = null) {
    // Store export info in notes field since we don't have dedicated export fields
    const exportNote = `Exported: ${exportType} - Ref: ${reference} - Date: ${new Date().toISOString()}`;
    
    const updateData = {
      notes: exportNote
    };

    // If exporting for payment, update status
    if (exportType === 'payroll' || exportType === 'bills') {
      updateData.status = 'pending_payment';
    }

    await prisma.commissions.updateMany({
      where: {
        id: { in: commissionIds }
      },
      data: updateData
    });

    // Create audit records if we have a user ID
    if (userId) {
      for (const commissionId of commissionIds) {
        await prisma.commission_approvals.create({
          data: {
            commission_id: commissionId,
            action: 'exported',
            performed_by: userId,
            notes: `Exported as ${exportType} - Reference: ${reference}`,
            previous_status: 'approved',
            new_status: 'pending_payment'
          }
        });
      }
    }
  }
}

export default new XeroExportService();