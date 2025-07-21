-- CreateIndex
CREATE INDEX "deals_user_id_status_close_date_idx" ON "deals"("user_id", "status", "close_date");

-- CreateIndex
CREATE INDEX "deals_company_id_created_at_idx" ON "deals"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "deals_user_id_crm_type_idx" ON "deals"("user_id", "crm_type");

-- CreateIndex
CREATE INDEX "targets_user_id_period_start_period_end_idx" ON "targets"("user_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "targets_company_id_is_active_idx" ON "targets"("company_id", "is_active");
