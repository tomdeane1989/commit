// Google Sheets Integration Service
import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.initializeAuth();
  }

  /**
   * Initialize Google Sheets API with service account
   * For now, we'll use API key for public sheets (simpler setup)
   * Later can be upgraded to OAuth2 for private sheets
   */
  async initializeAuth() {
    try {
      // For development: Use API key for public sheets
      this.sheets = google.sheets({ 
        version: 'v4',
        auth: process.env.GOOGLE_SHEETS_API_KEY || 'demo-mode'
      });
      
      console.log('✅ Google Sheets API initialized');
    } catch (error) {
      console.error('❌ Google Sheets API initialization failed:', error.message);
      // Continue in demo mode for development
      this.sheets = null;
    }
  }

  /**
   * Extract spreadsheet ID from various Google Sheets URL formats
   */
  extractSpreadsheetId(url) {
    const patterns = [
      // Published HTML format: /d/e/2PACX-SPREADSHEET_ID/pubhtml (check this first)
      /\/d\/e\/([a-zA-Z0-9-_]+)\/pubhtml/,
      // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit  
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)(?:\/|$)/,
      // Direct ID (if user just pastes the ID)
      /^[a-zA-Z0-9-_]{44}$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        console.log(`Extracted spreadsheet ID: ${match[1] || match[0]} from URL: ${url}`);
        return match[1] || match[0];
      }
    }

    throw new Error('Invalid Google Sheets URL. Please provide a valid spreadsheet URL or ID.');
  }

  /**
   * Test connection to a Google Sheet
   */
  async testConnection(spreadsheetUrl) {
    try {
      const spreadsheetId = this.extractSpreadsheetId(spreadsheetUrl);
      
      // For demo mode, return mock success
      if (process.env.GOOGLE_SHEETS_API_KEY === 'demo-mode') {
        return {
          success: true,
          spreadsheetId,
          title: 'Demo Sales Pipeline',
          sheets: ['Deals', 'Closed Won'],
          message: 'Demo mode: Connection simulated successfully'
        };
      }
      
      // If no API key, try to test public sheet access
      if (!process.env.GOOGLE_SHEETS_API_KEY || !this.sheets) {
        try {
          await this.readPublicSheetData(spreadsheetId, 'Sheet1');
          return {
            success: true,
            spreadsheetId,
            title: 'Public Google Sheet',
            sheets: ['Sheet1'],
            message: 'Public sheet access confirmed'
          };
        } catch (error) {
          throw new Error(`Cannot access public sheet: ${error.message}`);
        }
      }

      // Get spreadsheet metadata
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId
      });

      const spreadsheet = response.data;
      
      return {
        success: true,
        spreadsheetId,
        title: spreadsheet.properties.title,
        sheets: spreadsheet.sheets.map(sheet => sheet.properties.title),
        message: 'Connection successful'
      };
      
    } catch (error) {
      console.error('Sheet connection test failed:', error);
      
      if (error.code === 404) {
        throw new Error('Spreadsheet not found. Make sure the sheet is public or shared with the service account.');
      } else if (error.code === 403) {
        throw new Error('Permission denied. Make sure the sheet is public or properly shared.');
      } else {
        throw new Error(`Connection failed: ${error.message}`);
      }
    }
  }

  /**
   * Read data from a Google Sheet
   */
  async readSheetData(spreadsheetId, sheetName = 'Sheet1', headerRow = 1, dataStartRow = 2) {
    try {
      // For demo mode, return sample data only if specifically set to demo
      if (process.env.GOOGLE_SHEETS_API_KEY === 'demo-mode') {
        return this.getDemoData();
      }
      
      // If no API key, try to read public sheet via CSV export
      if (!process.env.GOOGLE_SHEETS_API_KEY || !this.sheets) {
        return await this.readPublicSheetData(spreadsheetId, sheetName);
      }

      // Determine the range to read
      const range = `${sheetName}!A${headerRow}:Z1000`; // Read headers and up to 1000 rows
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING'
      });

      const values = response.data.values;
      
      if (!values || values.length === 0) {
        throw new Error('No data found in the specified sheet range.');
      }

      // Extract headers
      const headers = values[0];
      
      // Extract data rows
      const dataRows = values.slice(dataStartRow - headerRow);
      
      // Convert to objects
      const data = dataRows.map((row, index) => {
        const obj = { _rowNumber: index + dataStartRow };
        headers.forEach((header, colIndex) => {
          obj[header] = row[colIndex] || '';
        });
        return obj;
      });

      return {
        success: true,
        headers,
        data,
        totalRows: dataRows.length,
        message: `Successfully read ${dataRows.length} rows`
      };

    } catch (error) {
      console.error('Failed to read sheet data:', error);
      throw new Error(`Failed to read sheet data: ${error.message}`);
    }
  }

  /**
   * Validate sheet structure for deal import
   */
  validateSheetStructure(headers, columnMapping) {
    // Check if this appears to be a sheet with Deal ID as first column (new format)
    const hasNewDealIdColumn = headers[0] === 'Deal ID';
    const hasDealIdMapping = columnMapping.deal_id;

    // For new format sheets, Deal ID is required
    // Note: first_name and last_name are optional (for auto-create users feature)
    const requiredFields = hasNewDealIdColumn
      ? ['deal_id', 'deal_name', 'account_name', 'amount', 'close_date', 'owned_by']
      : ['deal_name', 'account_name', 'amount', 'close_date', 'owned_by']; // Legacy format

    const missingFields = [];

    // Check if we can map all required fields
    for (const field of requiredFields) {
      const mappedColumn = columnMapping[field];
      if (!mappedColumn || !headers.includes(mappedColumn)) {
        missingFields.push(field);
      }
    }

    // Special case: If sheet has Deal ID but mapping doesn't, suggest migration
    if (hasNewDealIdColumn && !hasDealIdMapping) {
      return {
        isValid: false,
        missingFields: ['deal_id'],
        availableColumns: headers,
        message: 'Sheet has Deal ID column but integration mapping needs updating. This will be handled automatically during sync.',
        requiresMigration: true
      };
    }

    // Special validation for Deal ID - must be first column by convention
    if (columnMapping.deal_id && headers[0] !== columnMapping.deal_id) {
      return {
        isValid: false,
        missingFields: [],
        availableColumns: headers,
        message: 'Deal ID must be the first column for proper deduplication. Please move the Deal ID column to position A.'
      };
    }

    return {
      isValid: missingFields.length === 0,
      missingFields,
      availableColumns: headers,
      message: missingFields.length === 0
        ? 'Sheet structure is valid for deal import'
        : `Missing required fields: ${missingFields.join(', ')}`
    };
  }

  /**
   * Transform sheet row to deal object (legacy method - row-based matching)
   * Used for backward compatibility with existing integrations
   */
  async transformRowToDealLegacy(row, columnMapping, companyId, defaultUserId) {
    try {
      const deal = {
        company_id: companyId,
        user_id: defaultUserId, // Default fallback
        crm_type: 'sheets',
        crm_id: `sheet_row_${row._rowNumber}` // Legacy row-based ID
      };

      // Map basic fields (excluding deal_id)
      Object.entries(columnMapping).forEach(([dealField, sheetColumn]) => {
        if (dealField === 'deal_id') return; // Skip deal_id in legacy mode
        
        const value = row[sheetColumn];
        this.mapFieldValue(deal, dealField, value);
      });

      this.setDealDefaults(deal);
      return deal;
    } catch (error) {
      throw new Error(`Failed to transform legacy row ${row._rowNumber}: ${error.message}`);
    }
  }

  /**
   * Transform sheet row to deal object (new method - Deal ID based matching)
   */
  async transformRowToDeal(row, columnMapping, companyId, defaultUserId) {
    try {
      const deal = {
        company_id: companyId,
        user_id: defaultUserId, // Default fallback
        crm_type: 'sheets'
      };

      // Map basic fields
      Object.entries(columnMapping).forEach(([dealField, sheetColumn]) => {
        const value = row[sheetColumn];
        
        if (dealField === 'deal_id') {
          // Use Deal ID from sheet as the unique identifier (primary deduplication key)
          const dealId = String(value || '').trim();
          if (!dealId) {
            throw new Error(`Deal ID is required but empty in row ${row._rowNumber}`);
          }
          deal.crm_id = dealId;
        } else {
          this.mapFieldValue(deal, dealField, value);
        }
      });

      // Ensure Deal ID was provided and mapped
      if (!deal.crm_id) {
        throw new Error(`Deal ID is required for deduplication but was not found in row ${row._rowNumber}. Make sure Deal ID column is mapped and contains values.`);
      }

      this.setDealDefaults(deal);
      return deal;
    } catch (error) {
      throw new Error(`Failed to transform row ${row._rowNumber}: ${error.message}`);
    }
  }

  /**
   * Map a field value to the deal object
   */
  mapFieldValue(deal, dealField, value) {
    switch (dealField) {
      case 'deal_name':
        deal.deal_name = String(value || '').trim();
        break;
      case 'account_name':
        deal.account_name = String(value || '').trim();
        break;
      case 'amount':
        deal.amount = this.parseAmount(value);
        break;
      case 'probability':
        deal.probability = this.parseProbability(value);
        break;
      case 'status':
        deal.status = this.parseStatus(value);
        break;
      case 'stage':
        deal.stage = String(value || '').trim() || 'New';
        break;
      case 'close_date':
        deal.close_date = this.parseDate(value);
        break;
      case 'created_date':
        deal.created_date = this.parseDate(value) || new Date();
        break;
      case 'owned_by':
        // Store the owner email for later user lookup
        deal._owner_email = String(value || '').trim();
        break;
      case 'first_name':
        // Store first name for user auto-creation
        deal._owner_first_name = String(value || '').trim();
        break;
      case 'last_name':
        // Store last name for user auto-creation
        deal._owner_last_name = String(value || '').trim();
        break;
    }
  }

  /**
   * Set default values for deal fields
   */
  setDealDefaults(deal) {
    deal.deal_name = deal.deal_name || 'Untitled Deal';
    deal.account_name = deal.account_name || 'Unknown Account';
    deal.amount = deal.amount || 0;
    deal.probability = deal.probability || 50;
    deal.status = deal.status || 'open';
    deal.close_date = deal.close_date || new Date();
    deal.created_date = deal.created_date || new Date();
  }

  /**
   * Parse amount from various formats
   */
  parseAmount(value) {
    if (!value) return 0;
    
    // Remove currency symbols and commas
    const cleanValue = String(value).replace(/[£$,\s]/g, '');
    const parsed = parseFloat(cleanValue);
    
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
  }

  /**
   * Parse probability percentage
   */
  parseProbability(value) {
    if (!value) return 50;
    
    const cleanValue = String(value).replace(/[%\s]/g, '');
    const parsed = parseInt(cleanValue);
    
    return isNaN(parsed) ? 50 : Math.min(100, Math.max(0, parsed));
  }

  /**
   * Parse status from various formats
   */
  parseStatus(value) {
    if (!value) return 'open';
    
    const status = String(value).toLowerCase().trim();
    
    if (status.includes('won') || status.includes('closed won')) return 'closed_won';
    if (status.includes('lost') || status.includes('closed lost')) return 'closed_lost';
    
    return 'open';
  }

  /**
   * Parse date from various formats
   */
  parseDate(value) {
    if (!value) return null;
    
    try {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * Read public Google Sheets via CSV export URL
   */
  async readPublicSheetData(spreadsheetId, sheetName = 'Sheet1') {
    try {
      // For published sheets (2PACX format), use a different URL format
      let csvUrl;
      if (spreadsheetId.startsWith('2PACX-')) {
        // Published sheet format
        csvUrl = `https://docs.google.com/spreadsheets/d/e/${spreadsheetId}/pub?output=csv&gid=0`;
      } else {
        // Regular sheet format
        csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
      }
      
      console.log(`Trying to fetch CSV from: ${csvUrl}`);
      
      // Fetch the CSV data (follow redirects)
      const response = await fetch(csvUrl, {
        redirect: 'follow'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to access public sheet: ${response.status} ${response.statusText}. Make sure the sheet is public or shared with "Anyone with the link can view".`);
      }
      
      const csvText = await response.text();
      
      // Parse CSV data
      const lines = csvText.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        throw new Error('The sheet appears to be empty.');
      }
      
      // Parse CSV (simple implementation - handles quoted fields)
      const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current);
        return result;
      };
      
      // Parse headers
      const headers = parseCSVLine(lines[0]);
      
      // Parse data rows
      const data = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const rowObj = { _rowNumber: i + 1 };
        
        headers.forEach((header, index) => {
          rowObj[header] = values[index] || '';
        });
        
        data.push(rowObj);
      }
      
      return {
        success: true,
        headers,
        data,
        totalRows: data.length,
        message: `Successfully read ${data.length} rows from public sheet`
      };
      
    } catch (error) {
      console.error('Failed to read public sheet:', error);
      throw new Error(`Cannot read public sheet: ${error.message}`);
    }
  }

  /**
   * Get demo data for development/testing
   */
  getDemoData() {
    return {
      success: true,
      headers: [
        'Deal ID', 'Deal Name', 'Account Name', 'Amount', 'Probability',
        'Status', 'Stage', 'Close Date', 'Created Date', 'Owned By', 'First Name', 'Last Name'
      ],
      data: [
        {
          _rowNumber: 2,
          'Deal ID': 'DEAL-2025-001',
          'Deal Name': 'Enterprise Software License',
          'Account Name': 'TechCorp Industries',
          'Amount': '45000',
          'Probability': '75',
          'Status': 'Open',
          'Stage': 'Proposal Submitted',
          'Close Date': '2025-08-15',
          'Created Date': '2025-06-01',
          'Owned By': 'john.smith@company.com',
          'First Name': 'John',
          'Last Name': 'Smith'
        },
        {
          _rowNumber: 3,
          'Deal ID': 'DEAL-2025-002',
          'Deal Name': 'Annual Support Contract',
          'Account Name': 'DataFlow Solutions',
          'Amount': '28000',
          'Probability': '90',
          'Status': 'Open',
          'Stage': 'Contract Review',
          'Close Date': '2025-07-30',
          'Created Date': '2025-05-15',
          'Owned By': 'sarah.jones@company.com',
          'First Name': 'Sarah',
          'Last Name': 'Jones'
        },
        {
          _rowNumber: 4,
          'Deal ID': 'DEAL-2025-003',
          'Deal Name': 'Cloud Migration Services',
          'Account Name': 'RetailPlus Ltd',
          'Amount': '67000',
          'Probability': '100',
          'Status': 'Closed Won',
          'Stage': 'Closed Won',
          'Close Date': '2025-07-12',
          'Created Date': '2025-04-20',
          'Owned By': 'test@company.com',
          'First Name': 'Test',
          'Last Name': 'User'
        }
      ],
      totalRows: 3,
      message: 'Demo data loaded successfully'
    };
  }
}

export default GoogleSheetsService;