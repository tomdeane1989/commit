-- Add commission columns to deals table
ALTER TABLE deals 
ADD COLUMN commission_amount DECIMAL(12,2) DEFAULT NULL,
ADD COLUMN commission_rate DECIMAL(5,4) DEFAULT NULL,
ADD COLUMN commission_calculated_at TIMESTAMP DEFAULT NULL;

-- Create index for commission queries
CREATE INDEX idx_deals_commission ON deals(stage, close_date, commission_amount);
CREATE INDEX idx_deals_commission_calc ON deals(stage, commission_calculated_at);