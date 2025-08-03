-- Enhanced User Management System Migration
-- Adds flexible role/sub-role system and team-based management

-- Step 1: Update users table structure
ALTER TABLE users 
  ALTER COLUMN role DROP DEFAULT,
  ADD COLUMN sub_role VARCHAR(100),
  ADD COLUMN reports_to_id VARCHAR(191),
  ADD FOREIGN KEY (reports_to_id) REFERENCES users(id);

-- Step 2: Create company roles table (customizable roles)
CREATE TABLE IF NOT EXISTS company_roles (
  id VARCHAR(191) PRIMARY KEY,
  company_id VARCHAR(191) NOT NULL,
  role_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_by_admin_id VARCHAR(191) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_admin_id) REFERENCES users(id),
  
  INDEX idx_company_roles_company (company_id),
  INDEX idx_company_roles_name (role_name),
  UNIQUE KEY unique_company_role (company_id, role_name)
);

-- Step 3: Create company sub-roles table (customizable sub-roles)
CREATE TABLE IF NOT EXISTS company_sub_roles (
  id VARCHAR(191) PRIMARY KEY,
  company_id VARCHAR(191) NOT NULL,
  sub_role_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_by_admin_id VARCHAR(191) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_admin_id) REFERENCES users(id),
  
  INDEX idx_company_sub_roles_company (company_id),
  INDEX idx_company_sub_roles_name (sub_role_name),
  UNIQUE KEY unique_company_sub_role (company_id, sub_role_name)
);

-- Step 4: Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(191) PRIMARY KEY,
  company_id VARCHAR(191) NOT NULL,
  team_name VARCHAR(150) NOT NULL,
  description TEXT,
  team_lead_id VARCHAR(191),
  default_role VARCHAR(100),
  default_sub_role VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_by_admin_id VARCHAR(191) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (team_lead_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_admin_id) REFERENCES users(id),
  
  INDEX idx_teams_company (company_id),
  INDEX idx_teams_lead (team_lead_id),
  INDEX idx_teams_active (is_active),
  UNIQUE KEY unique_company_team (company_id, team_name)
);

-- Step 5: Create team members table
CREATE TABLE IF NOT EXISTS team_members (
  id VARCHAR(191) PRIMARY KEY,
  team_id VARCHAR(191) NOT NULL,
  user_id VARCHAR(191) NOT NULL,
  role_override VARCHAR(100),
  sub_role_override VARCHAR(100),
  joined_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  added_by_admin_id VARCHAR(191) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by_admin_id) REFERENCES users(id),
  
  INDEX idx_team_members_team (team_id),
  INDEX idx_team_members_user (user_id),
  INDEX idx_team_members_active (is_active),
  UNIQUE KEY unique_user_team (user_id, team_id)
);

-- Step 6: Add indexes for performance on users table
CREATE INDEX IF NOT EXISTS idx_users_reports_to ON users(reports_to_id);
CREATE INDEX IF NOT EXISTS idx_users_role_subrole ON users(role, sub_role);
CREATE INDEX IF NOT EXISTS idx_users_admin ON users(is_admin);

-- Step 7: Insert default roles and sub-roles for new companies
-- Note: This will be handled by the application during company setup

-- Step 8: Create view for effective user roles (combines individual, team, and hierarchy)
CREATE OR REPLACE VIEW user_effective_roles AS
SELECT 
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  u.is_admin,
  u.is_active,
  u.company_id,
  u.reports_to_id,
  
  -- Effective role (individual override > team default > individual role)
  COALESCE(
    tm.role_override,
    t.default_role,
    u.role
  ) as effective_role,
  
  -- Effective sub-role (individual override > team default > individual sub_role)
  COALESCE(
    tm.sub_role_override,
    t.default_sub_role,
    u.sub_role
  ) as effective_sub_role,
  
  -- Team information
  t.id as team_id,
  t.team_name,
  t.team_lead_id,
  
  -- Manager information
  m.first_name as manager_first_name,
  m.last_name as manager_last_name,
  m.is_admin as manager_is_admin

FROM users u
LEFT JOIN team_members tm ON u.id = tm.user_id AND tm.is_active = TRUE
LEFT JOIN teams t ON tm.team_id = t.id AND t.is_active = TRUE
LEFT JOIN users m ON u.reports_to_id = m.id
WHERE u.is_active = TRUE;

-- Step 9: Create trigger to ensure team leads have admin privileges automatically
DELIMITER //

CREATE TRIGGER ensure_team_lead_permissions 
AFTER INSERT ON teams
FOR EACH ROW
BEGIN
  IF NEW.team_lead_id IS NOT NULL THEN
    UPDATE users 
    SET is_admin = TRUE 
    WHERE id = NEW.team_lead_id AND is_admin = FALSE;
  END IF;
END//

CREATE TRIGGER update_team_lead_permissions 
AFTER UPDATE ON teams
FOR EACH ROW
BEGIN
  -- If team lead changed, ensure new lead has admin privileges
  IF NEW.team_lead_id IS NOT NULL AND NEW.team_lead_id != OLD.team_lead_id THEN
    UPDATE users 
    SET is_admin = TRUE 
    WHERE id = NEW.team_lead_id AND is_admin = FALSE;
  END IF;
END//

DELIMITER ;

-- Step 10: Data migration notes
-- Existing users will keep their current roles
-- Companies can define custom roles/sub-roles through the UI
-- Default roles: "New Sales", "Account Management", "Sales Development", "Customer Success", "Team Lead"
-- Default sub-roles: "UK", "EU", "US East", "US West", "APAC", "Enterprise", "SMB", "Mid-market"