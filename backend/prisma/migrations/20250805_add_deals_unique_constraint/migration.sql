-- Add unique constraint for CRM deals per company
-- This prevents duplicate imports from CRM systems
ALTER TABLE "deals" 
ADD CONSTRAINT "unique_crm_deal_per_company" 
UNIQUE ("crm_id", "company_id");