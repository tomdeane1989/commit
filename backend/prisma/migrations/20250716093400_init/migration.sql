-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "subscription" TEXT NOT NULL DEFAULT 'trial',
    "fiscal_year_start" INTEGER NOT NULL DEFAULT 1,
    "default_commission_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.0500,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ai_insights" JSONB,
    "forecasting_model" TEXT,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'rep',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "hire_date" TIMESTAMP(3),
    "territory" TEXT,
    "manager_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "performance_profile" JSONB,
    "prediction_accuracy" DECIMAL(5,2),
    "company_id" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "deal_name" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "stage" TEXT,
    "close_date" TIMESTAMP(3) NOT NULL,
    "closed_date" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL,
    "crm_id" TEXT,
    "crm_type" TEXT NOT NULL DEFAULT 'manual',
    "crm_url" TEXT,
    "last_sync" TIMESTAMP(3),
    "ai_probability" INTEGER,
    "ai_close_date" TIMESTAMP(3),
    "ai_insights" JSONB,
    "similar_deals" JSONB,
    "deal_age_days" INTEGER,
    "stage_history" JSONB,
    "amount_changes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_categorizations" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "confidence_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actual_outcome" TEXT,
    "outcome_date" TIMESTAMP(3),
    "deal_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "deal_categorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "targets" (
    "id" TEXT NOT NULL,
    "period_type" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "quota_amount" DECIMAL(12,2) NOT NULL,
    "commission_rate" DECIMAL(5,4) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "ai_forecast_amount" DECIMAL(12,2),
    "ai_confidence" DECIMAL(5,2),
    "ai_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,

    CONSTRAINT "targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "quota_amount" DECIMAL(12,2) NOT NULL,
    "actual_amount" DECIMAL(12,2) NOT NULL,
    "attainment_pct" DECIMAL(5,2) NOT NULL,
    "commission_rate" DECIMAL(5,4) NOT NULL,
    "commission_earned" DECIMAL(12,2) NOT NULL,
    "base_commission" DECIMAL(12,2) NOT NULL,
    "bonus_commission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'calculated',
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "paid_at" TIMESTAMP(3),
    "ai_insights" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_details" (
    "id" TEXT NOT NULL,
    "commission_amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commission_id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,

    CONSTRAINT "commission_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecasts" (
    "id" TEXT NOT NULL,
    "forecast_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forecast_type" TEXT NOT NULL,
    "pipeline_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "best_case_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "closed_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ai_predicted_close" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ai_confidence" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "actual_closed" DECIMAL(12,2),
    "forecast_accuracy" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,

    CONSTRAINT "forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_integrations" (
    "id" TEXT NOT NULL,
    "crm_type" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "instance_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sync" TIMESTAMP(3),
    "sync_frequency" TEXT NOT NULL DEFAULT 'daily',
    "ai_enabled" BOOLEAN NOT NULL DEFAULT false,
    "ai_model_version" TEXT,
    "total_deals_synced" INTEGER NOT NULL DEFAULT 0,
    "last_sync_deals_count" INTEGER NOT NULL DEFAULT 0,
    "sync_errors" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "company_id" TEXT NOT NULL,

    CONSTRAINT "crm_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "context" JSONB,
    "response_time_ms" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_domain_key" ON "companies"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- CreateIndex
CREATE INDEX "users_manager_id_idx" ON "users"("manager_id");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "deals_user_id_idx" ON "deals"("user_id");

-- CreateIndex
CREATE INDEX "deals_company_id_idx" ON "deals"("company_id");

-- CreateIndex
CREATE INDEX "deals_status_idx" ON "deals"("status");

-- CreateIndex
CREATE INDEX "deals_close_date_idx" ON "deals"("close_date");

-- CreateIndex
CREATE INDEX "deals_crm_id_idx" ON "deals"("crm_id");

-- CreateIndex
CREATE INDEX "deals_amount_idx" ON "deals"("amount");

-- CreateIndex
CREATE INDEX "deals_probability_idx" ON "deals"("probability");

-- CreateIndex
CREATE INDEX "deal_categorizations_deal_id_idx" ON "deal_categorizations"("deal_id");

-- CreateIndex
CREATE INDEX "deal_categorizations_user_id_idx" ON "deal_categorizations"("user_id");

-- CreateIndex
CREATE INDEX "deal_categorizations_category_idx" ON "deal_categorizations"("category");

-- CreateIndex
CREATE INDEX "deal_categorizations_created_at_idx" ON "deal_categorizations"("created_at");

-- CreateIndex
CREATE INDEX "targets_user_id_idx" ON "targets"("user_id");

-- CreateIndex
CREATE INDEX "targets_period_start_period_end_idx" ON "targets"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "targets_period_type_idx" ON "targets"("period_type");

-- CreateIndex
CREATE INDEX "commissions_user_id_idx" ON "commissions"("user_id");

-- CreateIndex
CREATE INDEX "commissions_period_start_period_end_idx" ON "commissions"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "commissions_status_idx" ON "commissions"("status");

-- CreateIndex
CREATE INDEX "commission_details_commission_id_idx" ON "commission_details"("commission_id");

-- CreateIndex
CREATE INDEX "commission_details_deal_id_idx" ON "commission_details"("deal_id");

-- CreateIndex
CREATE INDEX "forecasts_user_id_idx" ON "forecasts"("user_id");

-- CreateIndex
CREATE INDEX "forecasts_forecast_date_idx" ON "forecasts"("forecast_date");

-- CreateIndex
CREATE INDEX "forecasts_forecast_type_idx" ON "forecasts"("forecast_type");

-- CreateIndex
CREATE INDEX "forecasts_target_id_idx" ON "forecasts"("target_id");

-- CreateIndex
CREATE INDEX "crm_integrations_company_id_idx" ON "crm_integrations"("company_id");

-- CreateIndex
CREATE INDEX "crm_integrations_crm_type_idx" ON "crm_integrations"("crm_type");

-- CreateIndex
CREATE INDEX "activity_log_user_id_idx" ON "activity_log"("user_id");

-- CreateIndex
CREATE INDEX "activity_log_company_id_idx" ON "activity_log"("company_id");

-- CreateIndex
CREATE INDEX "activity_log_created_at_idx" ON "activity_log"("created_at");

-- CreateIndex
CREATE INDEX "activity_log_action_idx" ON "activity_log"("action");

-- CreateIndex
CREATE INDEX "activity_log_entity_type_entity_id_idx" ON "activity_log"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_categorizations" ADD CONSTRAINT "deal_categorizations_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_categorizations" ADD CONSTRAINT "deal_categorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "targets" ADD CONSTRAINT "targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "targets" ADD CONSTRAINT "targets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "targets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_details" ADD CONSTRAINT "commission_details_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_details" ADD CONSTRAINT "commission_details_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "targets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_integrations" ADD CONSTRAINT "crm_integrations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
