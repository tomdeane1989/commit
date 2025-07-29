--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Debian 16.9-1.pgdg120+1)
-- Dumped by pg_dump version 16.9 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: commit_db_qidw_user
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO commit_db_qidw_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: commit_db_qidw_user
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO commit_db_qidw_user;

--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: commit_db_qidw_user
--

CREATE TABLE public.activity_log (
    id text NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    before_state jsonb,
    after_state jsonb,
    context jsonb,
    response_time_ms integer,
    success boolean DEFAULT true NOT NULL,
    error_message text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id text NOT NULL,
    company_id text NOT NULL
);


ALTER TABLE public.activity_log OWNER TO commit_db_qidw_user;

--
-- Name: commission_details; Type: TABLE; Schema: public; Owner: commit_db_qidw_user
--

CREATE TABLE public.commission_details (
    id text NOT NULL,
    commission_amount numeric(12,2) NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    commission_id text NOT NULL,
    deal_id text NOT NULL
);


ALTER TABLE public.commission_details OWNER TO commit_db_qidw_user;

--
-- Name: commissions; Type: TABLE; Schema: public; Owner: commit_db_qidw_user
--

CREATE TABLE public.commissions (
    id text NOT NULL,
    period_start timestamp(3) without time zone NOT NULL,
    period_end timestamp(3) without time zone NOT NULL,
    quota_amount numeric(12,2) NOT NULL,
    actual_amount numeric(12,2) NOT NULL,
    attainment_pct numeric(5,2) NOT NULL,
    commission_rate numeric(5,4) NOT NULL,
    commission_earned numeric(12,2) NOT NULL,
    base_commission numeric(12,2) NOT NULL,
    bonus_commission numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'calculated'::text NOT NULL,
    calculated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    approved_at timestamp(3) without time zone,
    approved_by text,
    paid_at timestamp(3) without time zone,
    ai_insights jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    user_id text NOT NULL,
    company_id text NOT NULL,
    target_id text NOT NULL
);


ALTER TABLE public.commissions OWNER TO commit_db_qidw_user;

--
-- Name: companies; Type: TABLE; Schema: public; Owner: commit_db_qidw_user
--

CREATE TABLE public.companies (
    id text NOT NULL,
    name text NOT NULL,
    domain text,
    subscription text DEFAULT 'trial'::text NOT NULL,
    fiscal_year_start integer DEFAULT 1 NOT NULL,
    default_commission_rate numeric(5,4) DEFAULT 0.0500 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    ai_insights jsonb,
    forecasting_model text
);


ALTER TABLE public.companies OWNER TO commit_db_qidw_user;

--
-- Name: crm_integrations; Type: TABLE; Schema: public; Owner: commit_db_qidw_user
--

CREATE TABLE public.crm_integrations (
    id text NOT NULL,
    crm_type text NOT NULL,
    access_token text,
    refresh_token text,
    instance_url text,
    is_active boolean DEFAULT true NOT NULL,
    last_sync timestamp(3) without time zone,
    sync_frequency text DEFAULT 'daily'::text NOT NULL,
    ai_enabled boolean DEFAULT false NOT NULL,
    ai_model_version text,
    total_deals_synced integer DEFAULT 0 NOT NULL,
    last_sync_deals_count integer DEFAULT 0 NOT NULL,
    sync_errors jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    company_id text NOT NULL,
    column_mapping jsonb,
    data_start_row integer DEFAULT 2 NOT NULL,
    header_row integer DEFAULT 1 NOT NULL,
    sheet_name text,
    spreadsheet_id text
);


ALTER TABLE public.crm_integrations OWNER TO commit_db_qidw_user;

--
-- Name: deal_categorizations; Type: TABLE; Schema: public; Owner: commit_db_qidw_user
--

CREATE TABLE public.deal_categorizations (
    id text NOT NULL,
    category text NOT NULL,
    confidence_note text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actual_outcome text,
    outcome_date timestamp(3) without time zone,
    deal_id text NOT NULL,
    user_id text NOT NULL
);


ALTER TABLE public.deal_categorizations OWNER TO commit_db_qidw_user;

--
-- Name: deals; Type: TABLE; Schema: public; Owner: commit_db_qidw_user
--

CREATE TABLE public.deals (
    id text NOT NULL,
    deal_name text NOT NULL,
    account_name text NOT NULL,
    amount numeric(12,2) NOT NULL,
    probability integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    stage text,
    close_date timestamp(3) without time zone NOT NULL,
    closed_date timestamp(3) without time zone,
    created_date timestamp(3) without time zone NOT NULL,
    crm_id text,
    crm_type text DEFAULT 'manual'::text NOT NULL,
    crm_url text,
    last_sync timestamp(3) without time zone,
    ai_probability integer,
    ai_close_date timestamp(3) without time zone,
    ai_insights jsonb,
    similar_deals jsonb,
    deal_age_days integer,
    stage_history jsonb,
    amount_changes jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    user_id text NOT NULL,
    company_id text NOT NULL
);


ALTER TABLE public.deals OWNER TO commit_db_qidw_user;

--
-- Name: forecasts; Type: TABLE; Schema: public; Owner: commit_db_qidw_user
--

CREATE TABLE public.forecasts (
    id text NOT NULL,
    forecast_date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    forecast_type text NOT NULL,
    pipeline_amount numeric(12,2) DEFAULT 0 NOT NULL,
    commit_amount numeric(12,2) DEFAULT 0 NOT NULL,
    best_case_amount numeric(12,2) DEFAULT 0 NOT NULL,
    closed_amount numeric(12,2) DEFAULT 0 NOT NULL,
    ai_predicted_close numeric(12,2) DEFAULT 0 NOT NULL,
    ai_confidence numeric(5,2) DEFAULT 0 NOT NULL,
    actual_closed numeric(12,2),
    forecast_accuracy numeric(5,2),
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id text NOT NULL,
    company_id text NOT NULL,
    target_id text NOT NULL
);


ALTER TABLE public.forecasts OWNER TO commit_db_qidw_user;

--
-- Name: targets; Type: TABLE; Schema: public; Owner: commit_db_qidw_user
--

CREATE TABLE public.targets (
    id text NOT NULL,
    period_type text NOT NULL,
    period_start timestamp(3) without time zone NOT NULL,
    period_end timestamp(3) without time zone NOT NULL,
    quota_amount numeric(12,2) NOT NULL,
    commission_rate numeric(5,4) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    ai_forecast_amount numeric(12,2),
    ai_confidence numeric(5,2),
    ai_updated_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    user_id text NOT NULL,
    company_id text NOT NULL,
    role text,
    commission_payment_schedule text DEFAULT 'monthly'::text NOT NULL,
    team_target boolean DEFAULT false,
    distribution_method text DEFAULT 'even'::text,
    distribution_config jsonb,
    parent_target_id text
);


ALTER TABLE public.targets OWNER TO commit_db_qidw_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: commit_db_qidw_user
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    role text DEFAULT 'sales_rep'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    hire_date timestamp(3) without time zone,
    territory text,
    manager_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    performance_profile jsonb,
    prediction_accuracy numeric(5,2),
    company_id text NOT NULL,
    is_admin boolean DEFAULT false NOT NULL
);


ALTER TABLE public.users OWNER TO commit_db_qidw_user;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: commit_db_qidw_user
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
07a5064a-d344-4834-a3b1-9e88718409b4	c9c364b3923d6c97cb9a0819db5e4f471a74164cac515325070672e02173c011	2025-07-23 12:43:51.433108+00	20250716093400_init	\N	\N	2025-07-23 12:43:50.860487+00	1
70d9016a-e671-4d8c-8885-8486d81375be	9500115353a4fe00b1b93e16fa8d0ba5a31d0d6659fe7dfea340f00e9c2dcdfd	2025-07-23 12:43:51.627359+00	20250718134804_add_role_field_to_targets	\N	\N	2025-07-23 12:43:51.486994+00	1
ced3da3c-376f-460d-aef6-dd351bdfb7ed	26b07294df6f27e33cca43265786cff240272988c16ad258ac46ef2abd71e1b6	2025-07-23 12:43:51.877104+00	20250721080555_add_performance_indexes	\N	\N	2025-07-23 12:43:51.681254+00	1
42b76c37-d222-4085-a3b6-0da01d7bd858	55b8b7f8c013bafb3f602e7defd828610f25a89bb42bd3cd7a988b3bb1a257b0	2025-07-23 12:43:52.070665+00	20250721132732_add_commission_payment_schedule	\N	\N	2025-07-23 12:43:51.935175+00	1
a975a0c8-a755-4906-8ee7-53c9083d0fc4	aad793ad4f4cb630acc1ca365811f6d650c530474515ceefaeac64d281ac6414	2025-07-23 12:43:52.26163+00	20250721142312_add_google_sheets_fields	\N	\N	2025-07-23 12:43:52.124386+00	1
54e05270-bdfe-4d5c-b3a6-21099fe71a0d	110e5c92278c143819b08de3fbe46561f21a3107c601521d06a0e83cfa959292	2025-07-23 12:43:52.452781+00	20250722075636_add_admin_permission	\N	\N	2025-07-23 12:43:52.315385+00	1
46828ec0-f85a-45e8-a671-6f663242e555	3422258eb52599b9a57450fc345335d2d26f6edaee856bf8c7186b301414119f	2025-07-23 12:43:52.646071+00	add_team_target_flag	\N	\N	2025-07-23 12:43:52.507017+00	1
6dc9f1ad-0f71-485c-9f75-78cfc25c029d	c9c14f57a481e61dde7efa2269547c3ff82d57d86b72d97f34555518b8cfac41	2025-07-28 21:44:45.238399+00	20250728000000_add_target_distribution_fields	\N	\N	2025-07-28 21:44:45.037064+00	1
\.


--
-- Data for Name: activity_log; Type: TABLE DATA; Schema: public; Owner: commit_db_qidw_user
--

COPY public.activity_log (id, action, entity_type, entity_id, before_state, after_state, context, response_time_ms, success, error_message, created_at, user_id, company_id) FROM stdin;
cmdg6hkel001jsfe4nzjyp2ep	team_member_invited	user	cmdg6hk7f001hsfe420rqy5hd	\N	\N	{"invited_by": "fredrik@test.com", "invited_role": "sales_rep", "invited_email": "gunnar@test.com"}	\N	t	\N	2025-07-23 16:28:56.589	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg6ikd1001nsfe4f6p9kah6	team_member_invited	user	cmdg6ik8y001lsfe44gppj557	\N	\N	{"invited_by": "fredrik@test.com", "invited_role": "sales_rep", "invited_email": "robin@test.com"}	\N	t	\N	2025-07-23 16:29:43.189	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg6juqh001rsfe4v0q6xjff	team_member_invited	user	cmdg6jumf001psfe4mgayi24w	\N	\N	{"invited_by": "fredrik@test.com", "invited_role": "sales_rep", "invited_email": "jonas@test.com"}	\N	t	\N	2025-07-23 16:30:43.29	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg6lb5s001vsfe45i0jnawr	target_created	target	cmdg6lb3y001tsfe4ecc0gars	\N	\N	{"period_end": "2025-12-31T00:00:00.000Z", "target_type": "role", "target_user": "Fredrik Gunnarson", "period_start": "2025-01-01T00:00:00.000Z", "quota_amount": 120000.0, "original_quota": 120000, "distribution_method": "even"}	\N	t	\N	2025-07-23 16:31:51.232	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg6lba9001zsfe4l7w80gc8	target_created	target	cmdg6lb9d001xsfe4awmv3u98	\N	\N	{"period_end": "2025-12-31T00:00:00.000Z", "target_type": "role", "target_user": "Robin Olofsson", "period_start": "2025-01-01T00:00:00.000Z", "quota_amount": 120000.0, "original_quota": 120000, "distribution_method": "even"}	\N	t	\N	2025-07-23 16:31:51.393	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg6lbdx0023sfe4ralne9bj	target_created	target	cmdg6lbd00021sfe4pn820c7r	\N	\N	{"period_end": "2025-12-31T00:00:00.000Z", "target_type": "role", "target_user": "Jonas Davidsson", "period_start": "2025-01-01T00:00:00.000Z", "quota_amount": 120000.0, "original_quota": 120000, "distribution_method": "even"}	\N	t	\N	2025-07-23 16:31:51.525	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7o5g9001j11zwuvoajig3	integration_created	integration	cmdg7o5et001h11zwprrgowi3	\N	\N	{"name": "sheets Integration", "crm_type": "sheets"}	\N	t	\N	2025-07-23 17:02:03.417	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ooc100fh11zwfk2op81h	integration_synced	integration	cmdg7o5et001h11zwprrgowi3	\N	\N	{"errors": 0, "created": 250, "updated": 0}	\N	t	\N	2025-07-23 17:02:27.889	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7wfyr00fl11zwwstdoweu	target_conflict_resolved	target	cmdg7wfx300fj11zwhza7pab0	\N	\N	{"action": "replace", "user_name": "Fredrik Gunnarson", "quota_amount": 240000.0, "original_quota": 240000, "replaced_target_id": "cmdg6lb3y001tsfe4ecc0gars"}	\N	t	\N	2025-07-23 17:08:30.292	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7wg3300fp11zw9v050v5z	target_conflict_resolved	target	cmdg7wg2600fn11zwe4knklu3	\N	\N	{"action": "replace", "user_name": "Robin Olofsson", "quota_amount": 240000.0, "original_quota": 240000, "replaced_target_id": "cmdg6lb9d001xsfe4awmv3u98"}	\N	t	\N	2025-07-23 17:08:30.448	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7wg6x00ft11zwl5yax4bo	target_conflict_resolved	target	cmdg7wg6200fr11zwfd67cep1	\N	\N	{"action": "replace", "user_name": "Jonas Davidsson", "quota_amount": 240000.0, "original_quota": 240000, "replaced_target_id": "cmdg6lbd00021sfe4pn820c7r"}	\N	t	\N	2025-07-23 17:08:30.586	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7x5es00fv11zwkwfsvtc1	team_aggregation_viewed	team_aggregation	cmdfyi58h001nk5siofwudj5j	\N	\N	{"manager_email": "fredrik@test.com", "targets_count": 3, "direct_reports_count": 3}	\N	t	\N	2025-07-23 17:09:03.268	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg88p9i001h48dfhtblyw7z	team_aggregation_viewed	team_aggregation	cmdfyi58h001nk5siofwudj5j	\N	\N	{"manager_email": "fredrik@test.com", "targets_count": 3, "direct_reports_count": 3}	\N	t	\N	2025-07-23 17:18:02.215	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdgb9bv1001mo5c3gz2z5dcn	team_member_invited	user	cmdgb9boa001ko5c366k13l6r	\N	\N	{"invited_by": "tom@test.com", "invited_role": "sales_rep", "invited_email": "alfie@test.com"}	\N	t	\N	2025-07-23 18:42:30.349	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbbgpx001qo5c32zhwg3i6	team_member_invited	user	cmdgbbglt001oo5c37dq8hssh	\N	\N	{"invited_by": "tom@test.com", "invited_role": "sales_rep", "invited_email": "tobias@test.com"}	\N	t	\N	2025-07-23 18:44:09.958	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbd637001uo5c34kbrml5i	team_member_invited	user	cmdgbd5y8001so5c3o4qjncwq	\N	\N	{"invited_by": "tom@test.com", "invited_role": "sales_rep", "invited_email": "rob@test.com"}	\N	t	\N	2025-07-23 18:45:29.492	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbe15o001yo5c3oc09cpte	team_member_invited	user	cmdgbe11m001wo5c3dgqss5c5	\N	\N	{"invited_by": "tom@test.com", "invited_role": "sales_rep", "invited_email": "joel@test.com"}	\N	t	\N	2025-07-23 18:46:09.756	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdg88quh001n48dfqfdnhzzh	team_target_created	target	cmdg88qme001l48dfdktht7df	\N	\N	{"period": {"period_end": "2025-12-31T00:00:00.000Z", "period_type": "annual", "period_start": "2025-01-01T00:00:00.000Z"}, "created_by": "fredrik@test.com", "total_quota": 720000, "manager_email": "fredrik@test.com", "avg_commission_rate": 0.05000000000000001}	\N	t	\N	2025-07-23 17:18:04.265	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg88rj2001p48dflz09ute5	team_aggregation_viewed	team_aggregation	cmdfyi58h001nk5siofwudj5j	\N	\N	{"manager_email": "fredrik@test.com", "targets_count": 3, "direct_reports_count": 3}	\N	t	\N	2025-07-23 17:18:05.15	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg8azzt001t48dfsl833bpf	deal_categorized	deal	cmdg7onyz00f311zwlkummof2	{"category": "pipeline"}	{"category": "commit"}	{"timestamp": "2025-07-23T17:19:48.914Z", "session_id": "session_1753290460811_ycrve9odj", "categorization_method": "drag_drop"}	\N	t	\N	2025-07-23 17:19:49.434	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg8b0o8001v48dfp7o9dgnv	categorization_logged	deal	cmdg7onyz00f311zwlkummof2	{"category": "pipeline"}	{"category": "commit"}	{"source": "frontend_analytics", "timestamp": "2025-07-23T17:19:49.606Z", "session_metadata": {"user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36", "viewport_size": "1369x819", "screen_resolution": "1920x1080"}}	\N	t	\N	2025-07-23 17:19:50.312	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg8b4cu001z48dfys8vuazf	deal_categorized	deal	cmdg7om4r00dd11zwy6vownlt	{"category": "pipeline"}	{"category": "best_case"}	{"timestamp": "2025-07-23T17:19:54.658Z", "session_id": "session_1753290460811_ycrve9odj", "categorization_method": "drag_drop"}	\N	t	\N	2025-07-23 17:19:55.086	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg8b4p2002148dfhard0j33	categorization_logged	deal	cmdg7om4r00dd11zwy6vownlt	{"category": "pipeline"}	{"category": "best_case"}	{"source": "frontend_analytics", "timestamp": "2025-07-23T17:19:55.208Z", "session_metadata": {"user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36", "viewport_size": "1369x819", "screen_resolution": "1920x1080"}}	\N	t	\N	2025-07-23 17:19:55.526	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg8d01v002348dfrg1qnk2t	team_aggregation_viewed	team_aggregation	cmdfyi58h001nk5siofwudj5j	\N	\N	{"manager_email": "fredrik@test.com", "targets_count": 3, "direct_reports_count": 3}	\N	t	\N	2025-07-23 17:21:22.819	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg8kh40001l5vqkeegx8u1x	commission_calculated	commission	cmdg8kgyt001h5vqkc9cyn3y7	\N	\N	{"period_end": "2025-06-30", "period_start": "2025-06-01", "total_commission_earned": 269.75, "quota_attainment_percentage": 8.991666666666667}	\N	t	\N	2025-07-23 17:27:11.52	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg8khhq001t5vqkkusn3dl9	commission_calculated	commission	cmdg8khe8001n5vqk71ne11em	\N	\N	{"period_end": "2025-05-31", "period_start": "2025-05-01", "total_commission_earned": 464.6, "quota_attainment_percentage": 15.48666666666667}	\N	t	\N	2025-07-23 17:27:12.014	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg8khya00215vqkqipr36gn	commission_calculated	commission	cmdg8khu8001v5vqkl591pt3p	\N	\N	{"period_end": "2025-04-30", "period_start": "2025-04-01", "total_commission_earned": 659.7, "quota_attainment_percentage": 21.99}	\N	t	\N	2025-07-23 17:27:12.611	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg8kiah00275vqkp8tb55sk	commission_calculated	commission	cmdg8ki8000235vqkz9rt9tgy	\N	\N	{"period_end": "2025-03-31", "period_start": "2025-03-01", "total_commission_earned": 165.4, "quota_attainment_percentage": 5.513333333333334}	\N	t	\N	2025-07-23 17:27:13.049	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg8kilz002b5vqkfx14qdnw	commission_calculated	commission	cmdg8kika00295vqkdaoxydu2	\N	\N	{"period_end": "2025-02-28", "period_start": "2025-02-01", "total_commission_earned": 0, "quota_attainment_percentage": 0}	\N	t	\N	2025-07-23 17:27:13.463	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg8kiy3002h5vqkba1x34tm	commission_calculated	commission	cmdg8kivk002d5vqkcpdldt8y	\N	\N	{"period_end": "2025-01-31", "period_start": "2025-01-01", "total_commission_earned": 328.45, "quota_attainment_percentage": 10.94833333333333}	\N	t	\N	2025-07-23 17:27:13.899	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdgbfa9c0022o5c3uca95mi1	target_created	target	cmdgbfa7n0020o5c32ksmeikg	\N	\N	{"period_end": "2025-12-31T00:00:00.000Z", "target_type": "role", "target_user": "Alfie Ferris", "period_start": "2025-01-01T00:00:00.000Z", "quota_amount": 480000.0, "original_quota": 480000, "distribution_method": "seasonal"}	\N	t	\N	2025-07-23 18:47:08.208	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbfado0026o5c3k7m5ay0p	target_created	target	cmdgbfacs0024o5c3egsww96w	\N	\N	{"period_end": "2025-12-31T00:00:00.000Z", "target_type": "role", "target_user": "Tobias Zellweger", "period_start": "2025-01-01T00:00:00.000Z", "quota_amount": 480000.0, "original_quota": 480000, "distribution_method": "seasonal"}	\N	t	\N	2025-07-23 18:47:08.364	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbfagx002ao5c3phrrhmjr	target_created	target	cmdgbfag20028o5c3y8og2ftr	\N	\N	{"period_end": "2025-12-31T00:00:00.000Z", "target_type": "role", "target_user": "Rob Manson", "period_start": "2025-01-01T00:00:00.000Z", "quota_amount": 480000.0, "original_quota": 480000, "distribution_method": "seasonal"}	\N	t	\N	2025-07-23 18:47:08.481	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbfak9002eo5c3404392ie	target_created	target	cmdgbfajg002co5c3rpo94suo	\N	\N	{"period_end": "2025-12-31T00:00:00.000Z", "target_type": "role", "target_user": "Joel Savilahti", "period_start": "2025-01-01T00:00:00.000Z", "quota_amount": 480000.0, "original_quota": 480000, "distribution_method": "seasonal"}	\N	t	\N	2025-07-23 18:47:08.601	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbfnzm002go5c3ik7i7r7x	team_aggregation_viewed	team_aggregation	cmdgb8f6y001io5c3cyhr7lfw	\N	\N	{"manager_email": "tom@test.com", "targets_count": 4, "direct_reports_count": 4}	\N	t	\N	2025-07-23 18:47:26.003	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbfsrt002mo5c3tt6da0i4	team_target_created	target	cmdgbfslr002ko5c3cmmg9bta	\N	\N	{"period": {"period_end": "2025-12-31T00:00:00.000Z", "period_type": "annual", "period_start": "2025-01-01T00:00:00.000Z"}, "created_by": "tom@test.com", "total_quota": 1920000, "manager_email": "tom@test.com", "avg_commission_rate": 0.05}	\N	t	\N	2025-07-23 18:47:32.201	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbftbz002oo5c3q41cicdw	team_aggregation_viewed	team_aggregation	cmdgb8f6y001io5c3cyhr7lfw	\N	\N	{"manager_email": "tom@test.com", "targets_count": 4, "direct_reports_count": 4}	\N	t	\N	2025-07-23 18:47:32.927	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbimw5002so5c3w0nunch8	integration_created	integration	cmdgbimue002qo5c3ysmqbani	\N	\N	{"name": "sheets Integration", "crm_type": "sheets"}	\N	t	\N	2025-07-23 18:49:44.549	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj8v900gqo5c3w3iksqbj	integration_synced	integration	cmdgbimue002qo5c3ysmqbani	\N	\N	{"errors": 0, "created": 250, "updated": 0}	\N	t	\N	2025-07-23 18:50:13.029	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbk5y900guo5c3qsxyt66v	commission_calculated	commission	cmdgbk5un00gso5c3gognr3pz	\N	\N	{"period_end": "2025-06-30", "period_start": "2025-06-01", "total_commission_earned": 0, "quota_attainment_percentage": 0}	\N	t	\N	2025-07-23 18:50:55.905	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbk6cy00h0o5c318ptc43v	commission_calculated	commission	cmdgbk69c00gwo5c38swzkiz3	\N	\N	{"period_end": "2025-05-31", "period_start": "2025-05-01", "total_commission_earned": 329.15, "quota_attainment_percentage": 4.114375}	\N	t	\N	2025-07-23 18:50:56.434	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbk6pb00h6o5c32q7jfpfq	commission_calculated	commission	cmdgbk6mk00h2o5c3lh5gnnhe	\N	\N	{"period_end": "2025-04-30", "period_start": "2025-04-01", "total_commission_earned": 225.3, "quota_attainment_percentage": 2.81625}	\N	t	\N	2025-07-23 18:50:56.88	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbk73600heo5c3slkamwyt	commission_calculated	commission	cmdgbk6zk00h8o5c3edvqhb8m	\N	\N	{"period_end": "2025-03-31", "period_start": "2025-03-01", "total_commission_earned": 438.8, "quota_attainment_percentage": 5.485}	\N	t	\N	2025-07-23 18:50:57.379	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbk7lh00hmo5c3g7vwtbfr	commission_calculated	commission	cmdgbk7fv00hio5c36jh531x6	\N	\N	{"period_end": "2025-02-28", "period_start": "2025-02-01", "total_commission_earned": 0, "quota_attainment_percentage": 0}	\N	t	\N	2025-07-23 18:50:58.038	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbk7rt00huo5c3ycuglqr1	commission_calculated	commission	cmdgbk7e200hgo5c3ydvmkcpr	\N	\N	{"period_end": "2025-07-31", "period_start": "2025-07-01", "total_commission_earned": 1280.7, "quota_attainment_percentage": 16.00875}	\N	t	\N	2025-07-23 18:50:58.265	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbk82000i2o5c3kp3ify0t	commission_calculated	commission	cmdgbk7xl00hwo5c36gbr4ays	\N	\N	{"period_end": "2025-01-31", "period_start": "2025-01-01", "total_commission_earned": 687.75, "quota_attainment_percentage": 8.596874999999999}	\N	t	\N	2025-07-23 18:50:58.632	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbki8n00ico5c3n407kj4h	commission_calculated	commission	cmdgbk7e200hgo5c3ydvmkcpr	\N	\N	{"period_end": "2025-07-31", "period_start": "2025-07-01", "total_commission_earned": 1280.7, "quota_attainment_percentage": 16.00875}	\N	t	\N	2025-07-23 18:51:11.831	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbkozw00imo5c3cqzhr7gz	commission_calculated	commission	cmdgbk7e200hgo5c3ydvmkcpr	\N	\N	{"period_end": "2025-07-31", "period_start": "2025-07-01", "total_commission_earned": 1280.7, "quota_attainment_percentage": 16.00875}	\N	t	\N	2025-07-23 18:51:20.588	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbkvv300iwo5c3vl1tnhdu	commission_calculated	commission	cmdgbk7e200hgo5c3ydvmkcpr	\N	\N	{"period_end": "2025-07-31", "period_start": "2025-07-01", "total_commission_earned": 1280.7, "quota_attainment_percentage": 16.00875}	\N	t	\N	2025-07-23 18:51:29.487	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbl5x500j0o5c36vd20j2p	deal_categorized	deal	cmdgbj7l800f4o5c3jed9gom7	{"category": "pipeline"}	{"category": "commit"}	{"timestamp": "2025-07-23T18:51:41.864Z", "session_id": "session_1753186661032_985wwoib4", "categorization_method": "drag_drop"}	\N	t	\N	2025-07-23 18:51:42.522	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbl6g100j2o5c3ia9s44y2	categorization_logged	deal	cmdgbj7l800f4o5c3jed9gom7	{"category": "pipeline"}	{"category": "commit"}	{"source": "frontend_analytics", "timestamp": "2025-07-23T18:51:42.619Z", "session_metadata": {"user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36", "viewport_size": "1134x818", "screen_resolution": "1920x1080"}}	\N	t	\N	2025-07-23 18:51:42.992	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbl7ac00j6o5c3end2covg	deal_categorized	deal	cmdgbj75t00eko5c3fkhdl1l8	{"category": "pipeline"}	{"category": "commit"}	{"timestamp": "2025-07-23T18:51:43.826Z", "session_id": "session_1753186661032_985wwoib4", "categorization_method": "drag_drop"}	\N	t	\N	2025-07-23 18:51:44.293	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbl7hn00j8o5c3x4mj0134	categorization_logged	deal	cmdgbj75t00eko5c3fkhdl1l8	{"category": "pipeline"}	{"category": "commit"}	{"source": "frontend_analytics", "timestamp": "2025-07-23T18:51:44.368Z", "session_metadata": {"user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36", "viewport_size": "1134x818", "screen_resolution": "1920x1080"}}	\N	t	\N	2025-07-23 18:51:44.555	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbl91s00jeo5c3ptxx0ltl	categorization_logged	deal	cmdgbj0o9008eo5c3q8xo9wab	{"category": "pipeline"}	{"category": "commit"}	{"source": "frontend_analytics", "timestamp": "2025-07-23T18:51:46.394Z", "session_metadata": {"user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36", "viewport_size": "1134x818", "screen_resolution": "1920x1080"}}	\N	t	\N	2025-07-23 18:51:46.577	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgblb9r00jko5c36zwlgy1x	categorization_logged	deal	cmdgbixrj0054o5c3op8duf2l	{"category": "pipeline"}	{"category": "best_case"}	{"source": "frontend_analytics", "timestamp": "2025-07-23T18:51:49.071Z", "session_metadata": {"user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36", "viewport_size": "1134x818", "screen_resolution": "1920x1080"}}	\N	t	\N	2025-07-23 18:51:49.455	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgblcuu00jqo5c3rv6ssznx	categorization_logged	deal	cmdgbj10p008uo5c3kd5defg9	{"category": "pipeline"}	{"category": "best_case"}	{"source": "frontend_analytics", "timestamp": "2025-07-23T18:51:51.327Z", "session_metadata": {"user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36", "viewport_size": "1134x818", "screen_resolution": "1920x1080"}}	\N	t	\N	2025-07-23 18:51:51.511	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdkaiuba0017t8uqh6zv1ov5	deal_categorized	deal	cmdkaitr50001t8uqv709xys5	{"category": "pipeline"}	{"category": "commit"}	{"source": "seed_data", "user_agent": "Seed Script"}	\N	t	\N	2025-07-26 13:32:59.254	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaiucu0019t8uqsm2y7w37	deal_categorized	deal	cmdkaitsq0003t8uqtqwxfzre	{"category": "pipeline"}	{"category": "commit"}	{"source": "seed_data", "user_agent": "Seed Script"}	\N	t	\N	2025-07-26 13:32:59.31	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaiudl001bt8uqx0jfn4jk	deal_categorized	deal	cmdkaittj0005t8uqczu5hmd9	{"category": "pipeline"}	{"category": "commit"}	{"source": "seed_data", "user_agent": "Seed Script"}	\N	t	\N	2025-07-26 13:32:59.338	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaiued001dt8uq4thzjxkw	deal_categorized	deal	cmdkaitub0007t8uqo6nevtfm	{"category": "pipeline"}	{"category": "commit"}	{"source": "seed_data", "user_agent": "Seed Script"}	\N	t	\N	2025-07-26 13:32:59.365	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaiuf5001ft8uq0lxpw33i	deal_categorized	deal	cmdkaitv30009t8uqnuiml4o0	{"category": "pipeline"}	{"category": "commit"}	{"source": "seed_data", "user_agent": "Seed Script"}	\N	t	\N	2025-07-26 13:32:59.393	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdgbl8us00jco5c34vy3n8ti	deal_categorized	deal	cmdgbj0o9008eo5c3q8xo9wab	{"category": "pipeline"}	{"category": "commit"}	{"timestamp": "2025-07-23T18:51:45.836Z", "session_id": "session_1753186661032_985wwoib4", "categorization_method": "drag_drop"}	\N	t	\N	2025-07-23 18:51:46.324	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgblax900jio5c3agrrypx6	deal_categorized	deal	cmdgbixrj0054o5c3op8duf2l	{"category": "pipeline"}	{"category": "best_case"}	{"timestamp": "2025-07-23T18:51:48.521Z", "session_id": "session_1753186661032_985wwoib4", "categorization_method": "drag_drop"}	\N	t	\N	2025-07-23 18:51:49.006	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgblcnw00joo5c3xexq09cl	deal_categorized	deal	cmdgbj10p008uo5c3kd5defg9	{"category": "pipeline"}	{"category": "best_case"}	{"timestamp": "2025-07-23T18:51:50.778Z", "session_id": "session_1753186661032_985wwoib4", "categorization_method": "drag_drop"}	\N	t	\N	2025-07-23 18:51:51.26	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdghhxyt001horjrhxqyi5a5	commission_calculated	commission	cmdgbk5un00gso5c3gognr3pz	\N	\N	{"period_end": "2025-06-30", "period_start": "2025-06-01", "total_commission_earned": 0, "quota_attainment_percentage": 0}	\N	t	\N	2025-07-23 21:37:09.941	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdghhydb001lorjr9jc4gm3i	commission_calculated	commission	cmdgbk69c00gwo5c38swzkiz3	\N	\N	{"period_end": "2025-05-31", "period_start": "2025-05-01", "total_commission_earned": 329.15, "quota_attainment_percentage": 4.114375}	\N	t	\N	2025-07-23 21:37:10.464	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdghhypc001porjrlnvs12ww	commission_calculated	commission	cmdgbk6mk00h2o5c3lh5gnnhe	\N	\N	{"period_end": "2025-04-30", "period_start": "2025-04-01", "total_commission_earned": 225.3, "quota_attainment_percentage": 2.81625}	\N	t	\N	2025-07-23 21:37:10.896	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdghhz2q001vorjrpc8jjic4	commission_calculated	commission	cmdgbk6zk00h8o5c3edvqhb8m	\N	\N	{"period_end": "2025-03-31", "period_start": "2025-03-01", "total_commission_earned": 438.8, "quota_attainment_percentage": 5.485}	\N	t	\N	2025-07-23 21:37:11.378	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdghhzjw001xorjrq8iyw5s0	commission_calculated	commission	cmdgbk7fv00hio5c36jh531x6	\N	\N	{"period_end": "2025-02-28", "period_start": "2025-02-01", "total_commission_earned": 0, "quota_attainment_percentage": 0}	\N	t	\N	2025-07-23 21:37:11.997	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdghhzwf0023orjr44xdf4cs	commission_calculated	commission	cmdgbk7xl00hwo5c36gbr4ays	\N	\N	{"period_end": "2025-01-31", "period_start": "2025-01-01", "total_commission_earned": 687.75, "quota_attainment_percentage": 8.596874999999999}	\N	t	\N	2025-07-23 21:37:12.447	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdghi1j9002dorjrdbx92n5k	commission_calculated	commission	cmdgbk7e200hgo5c3ydvmkcpr	\N	\N	{"period_end": "2025-07-31", "period_start": "2025-07-01", "total_commission_earned": 1280.7, "quota_attainment_percentage": 16.00875}	\N	t	\N	2025-07-23 21:37:14.565	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdh0wi0j001jlr61vesjkehd	commission_calculated	commission	cmdh0whxa001hlr617s0u1vra	\N	\N	{"period_end": "2025-06-30", "period_start": "2025-06-01", "total_commission_earned": 0, "quota_attainment_percentage": 0}	\N	t	\N	2025-07-24 06:40:21.811	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdh0wifa001rlr61gubgg3no	commission_calculated	commission	cmdh0wic7001llr612d6fbb6s	\N	\N	{"period_end": "2025-05-31", "period_start": "2025-05-01", "total_commission_earned": 516.5, "quota_attainment_percentage": 25.825}	\N	t	\N	2025-07-24 06:40:22.343	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdh0wiui001xlr61m9n6p69a	commission_calculated	commission	cmdh0wis4001tlr61tgm4axi8	\N	\N	{"period_end": "2025-04-30", "period_start": "2025-04-01", "total_commission_earned": 434.4, "quota_attainment_percentage": 21.72}	\N	t	\N	2025-07-24 06:40:22.89	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdh0wj6g0023lr61buc54s4c	commission_calculated	commission	cmdh0wj3q001zlr61yeu5sj5o	\N	\N	{"period_end": "2025-03-31", "period_start": "2025-03-01", "total_commission_earned": 293.5, "quota_attainment_percentage": 14.675}	\N	t	\N	2025-07-24 06:40:23.321	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdh0wji80029lr612mpoztzm	commission_calculated	commission	cmdh0wjfu0025lr61ctzmr26g	\N	\N	{"period_end": "2025-02-28", "period_start": "2025-02-01", "total_commission_earned": 133.6, "quota_attainment_percentage": 6.68}	\N	t	\N	2025-07-24 06:40:23.744	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdh0wjt2002dlr61ztqgkh73	commission_calculated	commission	cmdh0wjrh002blr619tzjute9	\N	\N	{"period_end": "2025-01-31", "period_start": "2025-01-01", "total_commission_earned": 0, "quota_attainment_percentage": 0}	\N	t	\N	2025-07-24 06:40:24.134	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdh0wlvy002hlr618j8z2fvm	deal_categorized	deal	cmdgbj8kw00geo5c3xxjtrosg	{"category": "pipeline"}	{"category": "commit"}	{"timestamp": "2025-07-24T06:40:26.080Z", "session_id": "session_1753339222157_822uqsvhd", "categorization_method": "drag_drop"}	\N	t	\N	2025-07-24 06:40:26.83	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdh0wm8f002jlr61p931gd6q	categorization_logged	deal	cmdgbj8kw00geo5c3xxjtrosg	{"category": "pipeline"}	{"category": "commit"}	{"source": "frontend_analytics", "timestamp": "2025-07-24T06:40:26.924Z", "session_metadata": {"user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36", "viewport_size": "1607x910", "screen_resolution": "1920x1080"}}	\N	t	\N	2025-07-24 06:40:27.28	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdh0wnku002nlr61mesqj199	deal_categorized	deal	cmdgbj6a800dko5c35ak845rm	{"category": "pipeline"}	{"category": "commit"}	{"timestamp": "2025-07-24T06:40:28.565Z", "session_id": "session_1753339222157_822uqsvhd", "categorization_method": "drag_drop"}	\N	t	\N	2025-07-24 06:40:29.023	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdh0wnsj002plr61fkmiiefk	categorization_logged	deal	cmdgbj6a800dko5c35ak845rm	{"category": "pipeline"}	{"category": "commit"}	{"source": "frontend_analytics", "timestamp": "2025-07-24T06:40:29.092Z", "session_metadata": {"user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36", "viewport_size": "1607x910", "screen_resolution": "1920x1080"}}	\N	t	\N	2025-07-24 06:40:29.27	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdh0wuij002tlr61u9ilmqk4	deal_categorized	deal	cmdgbj4g000bko5c34fxsmhnf	{"category": "pipeline"}	{"category": "commit"}	{"timestamp": "2025-07-24T06:40:37.442Z", "session_id": "session_1753339222157_822uqsvhd", "categorization_method": "drag_drop"}	\N	t	\N	2025-07-24 06:40:38.011	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdh0wuuo002vlr61s4prdwxb	categorization_logged	deal	cmdgbj4g000bko5c34fxsmhnf	{"category": "pipeline"}	{"category": "commit"}	{"source": "frontend_analytics", "timestamp": "2025-07-24T06:40:38.087Z", "session_metadata": {"user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36", "viewport_size": "1607x910", "screen_resolution": "1920x1080"}}	\N	t	\N	2025-07-24 06:40:38.448	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdh0wwsr002zlr61j3nlvz6r	deal_categorized	deal	cmdgbj5g600cmo5c354o3f33z	{"category": "pipeline"}	{"category": "best_case"}	{"timestamp": "2025-07-24T06:40:40.508Z", "session_id": "session_1753339222157_822uqsvhd", "categorization_method": "drag_drop"}	\N	t	\N	2025-07-24 06:40:40.972	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdh0wwzh0031lr61vvfpt19c	categorization_logged	deal	cmdgbj5g600cmo5c354o3f33z	{"category": "pipeline"}	{"category": "best_case"}	{"source": "frontend_analytics", "timestamp": "2025-07-24T06:40:41.044Z", "session_metadata": {"user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36", "viewport_size": "1607x910", "screen_resolution": "1920x1080"}}	\N	t	\N	2025-07-24 06:40:41.213	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdh0xu5a0035lr61tarbfby9	deal_categorized	deal	cmdgbj6q500e2o5c3x3n0elot	{"category": "pipeline"}	{"category": "best_case"}	{"timestamp": "2025-07-24T06:41:23.321Z", "session_id": "session_1753339222157_822uqsvhd", "categorization_method": "drag_drop"}	\N	t	\N	2025-07-24 06:41:24.19	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdh0xuj50037lr61qq4zx8iv	categorization_logged	deal	cmdgbj6q500e2o5c3x3n0elot	{"category": "pipeline"}	{"category": "best_case"}	{"source": "frontend_analytics", "timestamp": "2025-07-24T06:41:24.252Z", "session_metadata": {"user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36", "viewport_size": "1607x910", "screen_resolution": "1920x1080"}}	\N	t	\N	2025-07-24 06:41:24.652	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
\.


--
-- Data for Name: commission_details; Type: TABLE DATA; Schema: public; Owner: commit_db_qidw_user
--

COPY public.commission_details (id, commission_amount, created_at, commission_id, deal_id) FROM stdin;
cmdg8kh2d001j5vqkemuq0cp5	269.75	2025-07-23 17:27:11.462	cmdg8kgyt001h5vqkc9cyn3y7	cmdg7ohjt007f11zw9axbfr7w
cmdg8khg2001p5vqkyzpiw6r5	292.20	2025-07-23 17:27:11.954	cmdg8khe8001n5vqk71ne11em	cmdg7oj08009f11zwoi0gg56o
cmdg8khg2001r5vqka41ghjwj	172.40	2025-07-23 17:27:11.954	cmdg8khe8001n5vqk71ne11em	cmdg7oe1z003911zwxnddt93w
cmdg8khxe001z5vqkn71wx5h4	225.30	2025-07-23 17:27:12.579	cmdg8khu8001v5vqkl591pt3p	cmdg7ok6p00az11zwusqphbdz
cmdg8khxe001x5vqkv3s6odfm	434.40	2025-07-23 17:27:12.578	cmdg8khu8001v5vqkl591pt3p	cmdg7on9000el11zwz9ugwqk3
cmdg8ki9n00255vqkjq58d398	165.40	2025-07-23 17:27:13.019	cmdg8ki8000235vqkz9rt9tgy	cmdg7ok0200ar11zwe139qlh2
cmdg8kix8002f5vqk1jveba8e	328.45	2025-07-23 17:27:13.868	cmdg8kivk002d5vqkcpdldt8y	cmdg7oj7j009p11zwsa3yn7g0
cmdghhyar001jorjr3bicvkgy	329.15	2025-07-23 21:37:10.371	cmdgbk69c00gwo5c38swzkiz3	cmdgbj6dp00doo5c33wh33r0a
cmdghhyoh001norjri1141rwp	225.30	2025-07-23 21:37:10.865	cmdgbk6mk00h2o5c3lh5gnnhe	cmdgbj53r00c8o5c384jsmnlv
cmdghhz0x001rorjr11ykhdry	165.40	2025-07-23 21:37:11.313	cmdgbk6zk00h8o5c3edvqhb8m	cmdgbj4wt00c0o5c395tbbq66
cmdghhz0x001torjrs06fc3m6	273.40	2025-07-23 21:37:11.314	cmdgbk6zk00h8o5c3edvqhb8m	cmdgbj50800c4o5c3buh4zfqb
cmdghhzvi0021orjr8dkn5fgk	359.30	2025-07-23 21:37:12.415	cmdgbk7xl00hwo5c36gbr4ays	cmdgbj48x00bco5c3k73b2nhc
cmdghhzvi001zorjreb2znlg7	328.45	2025-07-23 21:37:12.415	cmdgbk7xl00hwo5c36gbr4ays	cmdgbj3wr00ayo5c3ifkk6of7
cmdghi1ag0027orjrdsi9z56g	407.15	2025-07-23 21:37:14.249	cmdgbk7e200hgo5c3ydvmkcpr	cmdgbj7t100feo5c3o3tsllvn
cmdghi1ag0025orjrhfvquns0	113.10	2025-07-23 21:37:14.248	cmdgbk7e200hgo5c3ydvmkcpr	cmdgbj6oi00e0o5c3a3qf6ytt
cmdghi1g60029orjrhkhvzpzw	280.35	2025-07-23 21:37:14.249	cmdgbk7e200hgo5c3ydvmkcpr	cmdgbj8ny00gio5c3tsw3rpdo
cmdghi1h2002borjrsu6zujb8	480.10	2025-07-23 21:37:14.249	cmdgbk7e200hgo5c3ydvmkcpr	cmdgbj7af00eqo5c3w4julh8x
cmdh0wids001plr61npja706l	172.40	2025-07-24 06:40:22.288	cmdh0wic7001llr612d6fbb6s	cmdgbix9c004io5c35hd9upzk
cmdh0wids001nlr61ymn6405h	344.10	2025-07-24 06:40:22.288	cmdh0wic7001llr612d6fbb6s	cmdgbj5se00d0o5c3ngrfseka
cmdh0witp001vlr61fffoz5hd	434.40	2025-07-24 06:40:22.861	cmdh0wis4001tlr61tgm4axi8	cmdgbj85l00fuo5c3d8i8owad
cmdh0wj5h0021lr61lnph7hvo	293.50	2025-07-24 06:40:23.286	cmdh0wj3q001zlr61yeu5sj5o	cmdgbj37h00aeo5c3uarous3c
cmdh0wjhf0027lr6182foufba	133.60	2025-07-24 06:40:23.715	cmdh0wjfu0025lr61ctzmr26g	cmdgbiwe1003ko5c324seof20
\.


--
-- Data for Name: commissions; Type: TABLE DATA; Schema: public; Owner: commit_db_qidw_user
--

COPY public.commissions (id, period_start, period_end, quota_amount, actual_amount, attainment_pct, commission_rate, commission_earned, base_commission, bonus_commission, status, calculated_at, approved_at, approved_by, paid_at, ai_insights, created_at, updated_at, user_id, company_id, target_id) FROM stdin;
cmdg8kgyt001h5vqkc9cyn3y7	2025-06-01 00:00:00	2025-06-30 00:00:00	60000.00	5395.00	8.99	0.0500	269.75	269.75	0.00	calculated	2025-07-23 17:27:11.334	\N	\N	\N	\N	2025-07-23 17:27:11.334	2025-07-23 17:27:11.334	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv	cmdg88qme001l48dfdktht7df
cmdg8khe8001n5vqk71ne11em	2025-05-01 00:00:00	2025-05-31 00:00:00	60000.00	9292.00	15.49	0.0500	464.60	464.60	0.00	calculated	2025-07-23 17:27:11.889	\N	\N	\N	\N	2025-07-23 17:27:11.889	2025-07-23 17:27:11.889	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv	cmdg88qme001l48dfdktht7df
cmdg8khu8001v5vqkl591pt3p	2025-04-01 00:00:00	2025-04-30 00:00:00	60000.00	13194.00	21.99	0.0500	659.70	659.70	0.00	calculated	2025-07-23 17:27:12.465	\N	\N	\N	\N	2025-07-23 17:27:12.465	2025-07-23 17:27:12.465	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv	cmdg88qme001l48dfdktht7df
cmdg8ki8000235vqkz9rt9tgy	2025-03-01 00:00:00	2025-03-31 00:00:00	60000.00	3308.00	5.51	0.0500	165.40	165.40	0.00	calculated	2025-07-23 17:27:12.96	\N	\N	\N	\N	2025-07-23 17:27:12.96	2025-07-23 17:27:12.96	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv	cmdg88qme001l48dfdktht7df
cmdg8kika00295vqkdaoxydu2	2025-02-01 00:00:00	2025-02-28 00:00:00	60000.00	0.00	0.00	0.0500	0.00	0.00	0.00	calculated	2025-07-23 17:27:13.402	\N	\N	\N	\N	2025-07-23 17:27:13.402	2025-07-23 17:27:13.402	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv	cmdg88qme001l48dfdktht7df
cmdg8kivk002d5vqkcpdldt8y	2025-01-01 00:00:00	2025-01-31 00:00:00	60000.00	6569.00	10.95	0.0500	328.45	328.45	0.00	calculated	2025-07-23 17:27:13.808	\N	\N	\N	\N	2025-07-23 17:27:13.808	2025-07-23 17:27:13.808	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv	cmdg88qme001l48dfdktht7df
cmdgbk7fv00hio5c36jh531x6	2025-02-01 00:00:00	2025-02-28 00:00:00	160000.00	0.00	0.00	0.0500	0.00	0.00	0.00	calculated	2025-07-23 21:37:11.872	\N	\N	\N	\N	2025-07-23 18:50:57.836	2025-07-23 21:37:11.873	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui	cmdgbfslr002ko5c3cmmg9bta
cmdgbk7xl00hwo5c36gbr4ays	2025-01-01 00:00:00	2025-01-31 00:00:00	160000.00	13755.00	8.60	0.0500	687.75	687.75	0.00	calculated	2025-07-23 21:37:12.35	\N	\N	\N	\N	2025-07-23 18:50:58.474	2025-07-23 21:37:12.351	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui	cmdgbfslr002ko5c3cmmg9bta
cmdgbk5un00gso5c3gognr3pz	2025-06-01 00:00:00	2025-06-30 00:00:00	160000.00	0.00	0.00	0.0500	0.00	0.00	0.00	calculated	2025-07-23 21:37:09.828	\N	\N	\N	\N	2025-07-23 18:50:55.775	2025-07-23 21:37:09.829	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui	cmdgbfslr002ko5c3cmmg9bta
cmdgbk69c00gwo5c38swzkiz3	2025-05-01 00:00:00	2025-05-31 00:00:00	160000.00	6583.00	4.11	0.0500	329.15	329.15	0.00	calculated	2025-07-23 21:37:10.312	\N	\N	\N	\N	2025-07-23 18:50:56.304	2025-07-23 21:37:10.312	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui	cmdgbfslr002ko5c3cmmg9bta
cmdgbk6mk00h2o5c3lh5gnnhe	2025-04-01 00:00:00	2025-04-30 00:00:00	160000.00	4506.00	2.82	0.0500	225.30	225.30	0.00	calculated	2025-07-23 21:37:10.805	\N	\N	\N	\N	2025-07-23 18:50:56.781	2025-07-23 21:37:10.806	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui	cmdgbfslr002ko5c3cmmg9bta
cmdgbk6zk00h8o5c3edvqhb8m	2025-03-01 00:00:00	2025-03-31 00:00:00	160000.00	8776.00	5.49	0.0500	438.80	438.80	0.00	calculated	2025-07-23 21:37:11.255	\N	\N	\N	\N	2025-07-23 18:50:57.249	2025-07-23 21:37:11.256	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui	cmdgbfslr002ko5c3cmmg9bta
cmdgbk7e200hgo5c3ydvmkcpr	2025-07-01 00:00:00	2025-07-31 00:00:00	160000.00	25614.00	16.01	0.0500	1280.70	1280.70	0.00	calculated	2025-07-23 21:37:14.184	\N	\N	\N	\N	2025-07-23 18:50:57.77	2025-07-23 21:37:14.185	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui	cmdgbfslr002ko5c3cmmg9bta
cmdh0whxa001hlr617s0u1vra	2025-06-01 00:00:00	2025-06-30 00:00:00	40000.00	0.00	0.00	0.0500	0.00	0.00	0.00	calculated	2025-07-24 06:40:21.694	\N	\N	\N	\N	2025-07-24 06:40:21.694	2025-07-24 06:40:21.694	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui	cmdgbfacs0024o5c3egsww96w
cmdh0wic7001llr612d6fbb6s	2025-05-01 00:00:00	2025-05-31 00:00:00	40000.00	10330.00	25.83	0.0500	516.50	516.50	0.00	calculated	2025-07-24 06:40:22.231	\N	\N	\N	\N	2025-07-24 06:40:22.231	2025-07-24 06:40:22.231	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui	cmdgbfacs0024o5c3egsww96w
cmdh0wis4001tlr61tgm4axi8	2025-04-01 00:00:00	2025-04-30 00:00:00	40000.00	8688.00	21.72	0.0500	434.40	434.40	0.00	calculated	2025-07-24 06:40:22.805	\N	\N	\N	\N	2025-07-24 06:40:22.805	2025-07-24 06:40:22.805	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui	cmdgbfacs0024o5c3egsww96w
cmdh0wj3q001zlr61yeu5sj5o	2025-03-01 00:00:00	2025-03-31 00:00:00	40000.00	5870.00	14.68	0.0500	293.50	293.50	0.00	calculated	2025-07-24 06:40:23.223	\N	\N	\N	\N	2025-07-24 06:40:23.223	2025-07-24 06:40:23.223	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui	cmdgbfacs0024o5c3egsww96w
cmdh0wjfu0025lr61ctzmr26g	2025-02-01 00:00:00	2025-02-28 00:00:00	40000.00	2672.00	6.68	0.0500	133.60	133.60	0.00	calculated	2025-07-24 06:40:23.658	\N	\N	\N	\N	2025-07-24 06:40:23.658	2025-07-24 06:40:23.658	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui	cmdgbfacs0024o5c3egsww96w
cmdh0wjrh002blr619tzjute9	2025-01-01 00:00:00	2025-01-31 00:00:00	40000.00	0.00	0.00	0.0500	0.00	0.00	0.00	calculated	2025-07-24 06:40:24.077	\N	\N	\N	\N	2025-07-24 06:40:24.077	2025-07-24 06:40:24.077	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui	cmdgbfacs0024o5c3egsww96w
cmdkaiu9r0015t8uqyuj2lzos	2024-10-01 00:00:00	2024-12-31 00:00:00	200000.00	177000.00	88.50	0.0750	13275.00	13275.00	0.00	calculated	2025-07-26 13:32:59.199	\N	\N	\N	\N	2025-07-26 13:32:59.199	2025-07-26 13:32:59.199	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab	cmdfyggh70004k5siwpxpjs4c
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: commit_db_qidw_user
--

COPY public.companies (id, name, domain, subscription, fiscal_year_start, default_commission_rate, created_at, updated_at, ai_insights, forecasting_model) FROM stdin;
cmdfygg270000k5si08v9jwab	Test Company	testcompany.com	trial	1	0.0500	2025-07-23 12:44:07.376	2025-07-23 12:44:07.376	\N	\N
cmdfyi4zl001lk5sieje7k0nv	Upsales	\N	trial	1	0.0500	2025-07-23 12:45:26.337	2025-07-23 12:45:26.337	\N	\N
cmdg5wrgp001gskdy1s3ckung	Test Company 2	\N	trial	1	0.0500	2025-07-23 16:12:45.961	2025-07-23 16:12:45.961	\N	\N
cmdgb8eyy001go5c3tsw3vxui	Netigate	\N	trial	1	0.0500	2025-07-23 18:41:47.722	2025-07-23 18:41:47.722	\N	\N
cmdkaxw2v000016vwand76fll	TestOrg	\N	trial	1	0.0500	2025-07-26 13:44:41.383	2025-07-26 13:44:41.383	\N	\N
\.


--
-- Data for Name: crm_integrations; Type: TABLE DATA; Schema: public; Owner: commit_db_qidw_user
--

COPY public.crm_integrations (id, crm_type, access_token, refresh_token, instance_url, is_active, last_sync, sync_frequency, ai_enabled, ai_model_version, total_deals_synced, last_sync_deals_count, sync_errors, created_at, updated_at, company_id, column_mapping, data_start_row, header_row, sheet_name, spreadsheet_id) FROM stdin;
cmdg7o5et001h11zwprrgowi3	sheets	\N	\N	\N	t	2025-07-23 17:02:27.831	daily	f	\N	250	250	null	2025-07-23 17:02:03.339	2025-07-23 17:02:27.832	cmdfyi4zl001lk5sieje7k0nv	{"stage": "Stage", "amount": "Amount", "status": "Status", "deal_id": "Deal ID", "owned_by": "Owned by", "deal_name": "Deal Name", "close_date": "Close Date", "probability": "Probability", "account_name": "Account Name", "created_date": "Created Date"}	2	1	Sheet1	1bbyupvwwk2FnlQF1_fuZXdSjv7Uwf8A7-UuiTXWhX5E
cmdgbimue002qo5c3ysmqbani	sheets	\N	\N	\N	t	2025-07-23 18:50:12.969	daily	f	\N	250	250	null	2025-07-23 18:49:44.459	2025-07-23 18:50:12.97	cmdgb8eyy001go5c3tsw3vxui	{"stage": "Stage", "amount": "Amount", "status": "Status", "deal_id": "Deal ID", "owned_by": "Owned by", "deal_name": "Deal Name", "close_date": "Close Date", "probability": "Probability", "account_name": "Account Name", "created_date": "Created Date"}	2	1	Sheet1	15fwDsSE18i_jRq3wSbXiLqarFq0xVev1fLmRjj6PLJw
\.


--
-- Data for Name: deal_categorizations; Type: TABLE DATA; Schema: public; Owner: commit_db_qidw_user
--

COPY public.deal_categorizations (id, category, confidence_note, created_at, actual_outcome, outcome_date, deal_id, user_id) FROM stdin;
cmdkaiu6k000zt8uqe6hoh1kf	commit	High confidence - contract review stage with verbal commitment	2025-07-26 13:32:59.085	\N	\N	cmdkaitxf000dt8uq24x0g14o	cmdfyggcx0002k5sid4r9d92y
cmdkaiu860011t8uqnyklb35g	commit	High confidence - contract review stage with verbal commitment	2025-07-26 13:32:59.143	\N	\N	cmdkaiu3e000rt8uqmaczeyyj	cmdfyggcx0002k5sid4r9d92y
cmdkaiu8y0013t8uqd5tpdir0	best_case	Long-term opportunity - exploring partnership potential	2025-07-26 13:32:59.17	\N	\N	cmdkaiu50000vt8uq3qvdiop9	cmdfyggcx0002k5sid4r9d92y
cmdg8azy0001r48dfv4d7904j	commit	Categorized via drag_drop	2025-07-23 17:19:49.369	\N	\N	cmdg7onyz00f311zwlkummof2	cmdfyi58h001nk5siofwudj5j
cmdg8b4by001x48dfol3xkndk	best_case	Categorized via drag_drop	2025-07-23 17:19:55.054	\N	\N	cmdg7om4r00dd11zwy6vownlt	cmdfyi58h001nk5siofwudj5j
cmdgbl5v400iyo5c32z4kyfmz	commit	Categorized via drag_drop	2025-07-23 18:51:42.448	\N	\N	cmdgbj7l800f4o5c3jed9gom7	cmdgb8f6y001io5c3cyhr7lfw
cmdgbl79h00j4o5c3c7mb8sr8	commit	Categorized via drag_drop	2025-07-23 18:51:44.262	\N	\N	cmdgbj75t00eko5c3fkhdl1l8	cmdgb8f6y001io5c3cyhr7lfw
cmdgbl8tv00jao5c3lyttfj0f	commit	Categorized via drag_drop	2025-07-23 18:51:46.291	\N	\N	cmdgbj0o9008eo5c3q8xo9wab	cmdgb8f6y001io5c3cyhr7lfw
cmdgblawf00jgo5c3rj39s383	best_case	Categorized via drag_drop	2025-07-23 18:51:48.975	\N	\N	cmdgbixrj0054o5c3op8duf2l	cmdgb8f6y001io5c3cyhr7lfw
cmdgblcmr00jmo5c377ejjef3	best_case	Categorized via drag_drop	2025-07-23 18:51:51.22	\N	\N	cmdgbj10p008uo5c3kd5defg9	cmdgb8f6y001io5c3cyhr7lfw
cmdh0wlqb002flr615cr9quxl	commit	Categorized via drag_drop	2025-07-24 06:40:26.627	\N	\N	cmdgbj8kw00geo5c3xxjtrosg	cmdgbbglt001oo5c37dq8hssh
cmdh0wnjy002llr617c1jon11	commit	Categorized via drag_drop	2025-07-24 06:40:28.991	\N	\N	cmdgbj6a800dko5c35ak845rm	cmdgbbglt001oo5c37dq8hssh
cmdh0wuh7002rlr6195n3uavy	commit	Categorized via drag_drop	2025-07-24 06:40:37.964	\N	\N	cmdgbj4g000bko5c34fxsmhnf	cmdgbbglt001oo5c37dq8hssh
cmdh0wwrt002xlr61r5uetnv3	best_case	Categorized via drag_drop	2025-07-24 06:40:40.938	\N	\N	cmdgbj5g600cmo5c354o3f33z	cmdgbbglt001oo5c37dq8hssh
cmdh0xu4f0033lr61tdux242g	best_case	Categorized via drag_drop	2025-07-24 06:41:24.159	\N	\N	cmdgbj6q500e2o5c3x3n0elot	cmdgbbglt001oo5c37dq8hssh
\.


--
-- Data for Name: deals; Type: TABLE DATA; Schema: public; Owner: commit_db_qidw_user
--

COPY public.deals (id, deal_name, account_name, amount, probability, status, stage, close_date, closed_date, created_date, crm_id, crm_type, crm_url, last_sync, ai_probability, ai_close_date, ai_insights, similar_deals, deal_age_days, stage_history, amount_changes, created_at, updated_at, user_id, company_id) FROM stdin;
cmdg7oefs003r11zwlkzaqyh3	Web Redesign	Inverness Data	6262.00	100	closed_won	Closed Won	2023-12-04 00:00:00	\N	2023-08-18 00:00:00	10240	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:15.064	2025-07-23 17:02:15.064	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oehd003t11zwikbx6q4r	Cloud Backup	Penrith Systems	3906.00	50	closed_lost	Closed Lost	2024-06-01 00:00:00	\N	2024-03-22 00:00:00	10241	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:15.122	2025-07-23 17:02:15.122	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7oeiv003v11zwt8tajky9	Marketing Campaign	Jubilee Networks	3943.00	60	open	Proposal Submitted	2025-09-23 00:00:00	\N	2025-05-13 00:00:00	10242	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:15.176	2025-07-23 17:02:15.176	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7oekf003x11zw034rc9kx	Sales Training	Bramley Retail	4086.00	90	open	Contract Review	2025-07-27 00:00:00	\N	2025-07-04 00:00:00	10243	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:15.232	2025-07-23 17:02:15.232	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oem1003z11zw3rgzj3ah	E-Commerce Integration	Milton Solutions	4421.00	50	closed_lost	Closed Lost	2023-12-24 00:00:00	\N	2023-11-02 00:00:00	10244	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:15.289	2025-07-23 17:02:15.289	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oenh004111zw55ugbxe0	Compliance Audit	Harrow IT Services	4202.00	100	closed_won	Closed Won	2024-08-18 00:00:00	\N	2024-08-05 00:00:00	10245	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:15.342	2025-07-23 17:02:15.342	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7oeph004311zwtrel2r42	Marketing Campaign	Quayside Legal	4221.00	50	closed_lost	Closed Lost	2025-02-16 00:00:00	\N	2025-01-16 00:00:00	10246	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:15.413	2025-07-23 17:02:15.413	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7oer2004511zw6uqfs1o8	CRM Integration	Jubilee Networks	9040.00	50	closed_lost	Closed Lost	2023-12-26 00:00:00	\N	2023-10-31 00:00:00	10247	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:15.47	2025-07-23 17:02:15.47	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oesl004711zwbhlhq63v	Marketing Campaign	Quayside Legal	4262.00	100	closed_won	Closed Won	2023-12-28 00:00:00	\N	2023-11-13 00:00:00	10248	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:15.525	2025-07-23 17:02:15.525	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oeu1004911zwzzi7zrfq	E-Commerce Integration	Greenbridge Tech	4275.00	100	closed_won	Closed Won	2024-01-09 00:00:00	\N	2023-12-25 00:00:00	10249	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:15.577	2025-07-23 17:02:15.577	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oevm004b11zwhpeoy278	CRM Integration	Epsom Ventures	4291.00	50	closed_lost	Closed Lost	2023-10-22 00:00:00	\N	2023-08-03 00:00:00	10250	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:15.635	2025-07-23 17:02:15.635	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oex6004d11zwubr2klfa	SEO Optimization	Oakfield Agency	4293.00	20	open	Discovery Call	2025-08-09 00:00:00	\N	2025-05-08 00:00:00	10001	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:15.69	2025-07-23 17:02:15.69	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oeyl004f11zw6uf0dzm9	Compliance Audit	Farringdon Design	4318.00	50	closed_lost	Closed Lost	2024-01-03 00:00:00	\N	2023-10-05 00:00:00	10002	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:15.742	2025-07-23 17:02:15.742	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ogcg006311zwna0hv3r2	Infrastructure Review	Ashworth Consulting	4948.00	100	closed_won	Closed Won	2023-09-30 00:00:00	\N	2023-09-01 00:00:00	10032	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:17.536	2025-07-23 17:02:17.536	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ockn001l11zw5pyt38p1	Marketing Campaign	Greenbridge Tech	1000.00	50	closed_lost	Closed Lost	2025-06-05 00:00:00	\N	2025-04-21 00:00:00	10201	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:12.648	2025-07-23 17:02:12.648	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ocms001n11zwidlg0rka	Data Security Package	Cavendish Systems	1384.00	50	closed_lost	Closed Lost	2024-06-11 00:00:00	\N	2024-04-19 00:00:00	10202	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:12.724	2025-07-23 17:02:12.724	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oco9001p11zwlgszppi9	Helpdesk Setup	Epsom Ventures	1477.00	75	open	Technical Demo	2025-07-16 00:00:00	\N	2025-05-15 00:00:00	10203	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:12.778	2025-07-23 17:02:12.778	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ocpp001r11zwzjhystd9	Marketing Campaign	Ashworth Consulting	1601.00	60	open	Proposal Submitted	2025-10-04 00:00:00	\N	2025-06-27 00:00:00	10204	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:12.829	2025-07-23 17:02:12.829	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ocr4001t11zw1b4rzz4y	Helpdesk Setup	Lancaster Ltd	6588.00	100	closed_won	Closed Won	2023-11-29 00:00:00	\N	2023-11-11 00:00:00	10205	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:12.88	2025-07-23 17:02:12.88	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ocsk001v11zw8ngqihbi	Infrastructure Review	Oakfield Agency	1761.00	60	open	Proposal Submitted	2025-08-17 00:00:00	\N	2025-07-05 00:00:00	10206	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:12.933	2025-07-23 17:02:12.933	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ocu0001x11zwaup2cr0u	CRM Integration	Bramley Retail	1784.00	50	closed_lost	Closed Lost	2025-02-13 00:00:00	\N	2024-10-29 00:00:00	10207	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:12.984	2025-07-23 17:02:12.984	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ocvf001z11zwc7n0neu2	Web Redesign	Oakfield Agency	1974.00	35	open	Needs Analysis	2025-10-19 00:00:00	\N	2025-07-05 00:00:00	10208	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:13.035	2025-07-23 17:02:13.035	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ocwu002111zwel3ntyde	E-Commerce Integration	Southwick Logistics	6324.00	100	closed_won	Closed Won	2023-12-13 00:00:00	\N	2023-08-21 00:00:00	10209	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:13.087	2025-07-23 17:02:13.087	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ocy9002311zw3zj98d40	Subscription Renewal	Milton Solutions	2262.00	20	open	Discovery Call	2025-09-25 00:00:00	\N	2025-06-04 00:00:00	10210	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:13.138	2025-07-23 17:02:13.138	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oczp002511zwehsbji9z	E-Commerce Integration	Dunford Analytics	7707.00	100	closed_won	Closed Won	2024-01-24 00:00:00	\N	2023-11-02 00:00:00	10211	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:13.189	2025-07-23 17:02:13.189	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7od16002711zwkbf7wwhu	Marketing Campaign	Jubilee Networks	2263.00	20	open	Discovery Call	2025-08-04 00:00:00	\N	2025-07-08 00:00:00	10212	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:13.243	2025-07-23 17:02:13.243	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7od2n002911zw4vxp4e85	API Development	Cavendish Systems	2357.00	50	closed_lost	Closed Lost	2024-09-08 00:00:00	\N	2024-07-10 00:00:00	10213	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:13.295	2025-07-23 17:02:13.295	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7od43002b11zw5mmjwouh	Marketing Campaign	Norfolk Hosting	2672.00	100	closed_won	Closed Won	2025-02-03 00:00:00	\N	2024-10-28 00:00:00	10214	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:13.348	2025-07-23 17:02:13.348	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7od5k002d11zwj14spquj	CRM Integration	Milton Solutions	5379.00	50	closed_lost	Closed Lost	2023-09-14 00:00:00	\N	2023-08-27 00:00:00	10215	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:13.4	2025-07-23 17:02:13.4	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7od73002f11zwieyqr5jd	Infrastructure Review	Jubilee Networks	6716.00	100	closed_won	Closed Won	2023-09-28 00:00:00	\N	2023-09-02 00:00:00	10216	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:13.455	2025-07-23 17:02:13.455	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7od8k002h11zww5hjq9sy	Marketing Campaign	Bramley Retail	4460.00	100	closed_won	Closed Won	2024-01-26 00:00:00	\N	2024-01-14 00:00:00	10217	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:13.508	2025-07-23 17:02:13.508	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oda2002j11zwbevbrm52	Infrastructure Review	Southwick Logistics	2832.00	50	closed_lost	Closed Lost	2025-04-25 00:00:00	\N	2025-03-31 00:00:00	10218	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:13.562	2025-07-23 17:02:13.562	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7odbj002l11zwiievydxx	System Upgrade	Telford Metrics	2840.00	100	closed_won	Closed Won	2024-04-05 00:00:00	\N	2024-03-15 00:00:00	10219	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:13.614	2025-07-23 17:02:13.614	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7odd0002n11zwk7h2eut6	Network Overhaul	Ashworth Consulting	5062.00	100	closed_won	Closed Won	2023-10-24 00:00:00	\N	2023-08-28 00:00:00	10220	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:13.669	2025-07-23 17:02:13.669	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7odeg002p11zw5eca37td	Subscription Renewal	Quayside Legal	2886.00	50	closed_lost	Closed Lost	2024-02-04 00:00:00	\N	2023-11-06 00:00:00	10221	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:13.72	2025-07-23 17:02:13.72	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7odg2002r11zwrmwbkwis	Annual Maintenance	Jubilee Networks	2913.00	50	closed_lost	Closed Lost	2025-02-25 00:00:00	\N	2025-02-02 00:00:00	10222	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:13.778	2025-07-23 17:02:13.778	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7odxg003311zw76i6ooym	Consulting Services	Ashworth Consulting	3324.00	50	closed_lost	Closed Lost	2025-04-10 00:00:00	\N	2025-03-07 00:00:00	10228	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:14.404	2025-07-23 17:02:14.404	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7odyy003511zwrcwbqjgu	E-Commerce Integration	Ashworth Consulting	3354.00	100	closed_won	Closed Won	2025-07-20 00:00:00	\N	2025-06-08 00:00:00	10229	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:14.458	2025-07-23 17:02:14.458	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7oe0f003711zwq3a0d2l2	Web Redesign	Greenbridge Tech	3444.00	100	closed_won	Closed Won	2024-10-26 00:00:00	\N	2024-09-29 00:00:00	10230	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:14.511	2025-07-23 17:02:14.511	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7oe1z003911zwxnddt93w	Network Overhaul	Oakfield Agency	3448.00	100	closed_won	Closed Won	2025-05-29 00:00:00	\N	2025-02-25 00:00:00	10231	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:14.567	2025-07-23 17:02:14.567	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oe3q003b11zwzmup33ji	Marketing Campaign	Norfolk Hosting	4751.00	100	closed_won	Closed Won	2023-10-30 00:00:00	\N	2023-09-14 00:00:00	10232	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:14.631	2025-07-23 17:02:14.631	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oe59003d11zwdoiow622	API Development	Farringdon Design	3471.00	60	open	Proposal Submitted	2025-07-09 00:00:00	\N	2025-06-14 00:00:00	10233	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:14.685	2025-07-23 17:02:14.685	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7oe6s003f11zwnz6dqg27	Compliance Audit	Epsom Ventures	3480.00	20	open	Discovery Call	2025-09-29 00:00:00	\N	2025-07-10 00:00:00	10234	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:14.74	2025-07-23 17:02:14.74	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7oe89003h11zwv4zm4mvt	Consulting Services	Penrith Systems	3518.00	20	open	Discovery Call	2025-07-31 00:00:00	\N	2025-07-10 00:00:00	10235	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:14.794	2025-07-23 17:02:14.794	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oe9r003j11zwe8dmy9ax	Data Security Package	Farringdon Design	3622.00	100	closed_won	Closed Won	2025-01-18 00:00:00	\N	2024-11-06 00:00:00	10236	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:14.847	2025-07-23 17:02:14.847	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oeb9003l11zwgzm13air	Network Overhaul	Bramley Retail	3624.00	90	open	Contract Review	2025-09-02 00:00:00	\N	2025-07-02 00:00:00	10237	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:14.901	2025-07-23 17:02:14.901	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7oecq003n11zwobdzvc5c	Marketing Campaign	Norfolk Hosting	6116.00	50	closed_lost	Closed Lost	2023-12-03 00:00:00	\N	2023-10-02 00:00:00	10238	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:14.954	2025-07-23 17:02:14.954	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7oee9003p11zw91m7ewv9	User Onboarding Setup	Oakfield Agency	3794.00	100	closed_won	Closed Won	2024-02-07 00:00:00	\N	2023-12-13 00:00:00	10239	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:15.009	2025-07-23 17:02:15.009	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7odnu002t11zwb1ocysvw	Data Security Package	Milton Solutions	3101.00	20	open	Discovery Call	2025-07-24 00:00:00	\N	2025-04-30 00:00:00	10223	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:13.83	2025-07-23 17:02:13.83	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7odr2002v11zwevu1mxx8	Subscription Renewal	Dunford Analytics	3238.00	50	closed_lost	Closed Lost	2024-02-11 00:00:00	\N	2023-11-28 00:00:00	10224	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:14.174	2025-07-23 17:02:14.174	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7odsn002x11zwp3i2i6ne	SEO Optimization	Epsom Ventures	3259.00	50	closed_lost	Closed Lost	2024-06-12 00:00:00	\N	2024-03-04 00:00:00	10225	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:14.231	2025-07-23 17:02:14.231	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7odua002z11zwta1rtf1p	Annual Maintenance	Farringdon Design	3282.00	50	closed_lost	Closed Lost	2024-03-21 00:00:00	\N	2024-02-23 00:00:00	10226	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:14.29	2025-07-23 17:02:14.29	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7odvw003111zw6e35yzle	Marketing Campaign	Jubilee Networks	6115.00	100	closed_won	Closed Won	2024-02-16 00:00:00	\N	2023-12-29 00:00:00	10227	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:14.348	2025-07-23 17:02:14.348	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7of03004h11zwr1amkduj	Network Overhaul	Inverness Data	4321.00	100	closed_won	Closed Won	2023-11-07 00:00:00	\N	2023-08-02 00:00:00	10003	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:15.796	2025-07-23 17:02:15.796	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7of1u004j11zw57n74nv9	Subscription Renewal	Bramley Retail	4341.00	50	closed_lost	Closed Lost	2024-07-14 00:00:00	\N	2024-05-01 00:00:00	10004	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:15.858	2025-07-23 17:02:15.858	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7of3e004l11zwto3w3x8n	Cloud Backup	Bramley Retail	4395.00	50	closed_lost	Closed Lost	2023-10-19 00:00:00	\N	2023-08-28 00:00:00	10005	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:15.915	2025-07-23 17:02:15.915	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7of51004n11zwbh634zy3	Annual Maintenance	Penrith Systems	5708.00	100	closed_won	Closed Won	2024-01-17 00:00:00	\N	2023-11-28 00:00:00	10006	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:15.974	2025-07-23 17:02:15.974	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7of6l004p11zwnc41v1ws	Web Redesign	Oakfield Agency	6203.00	100	closed_won	Closed Won	2024-02-25 00:00:00	\N	2023-11-28 00:00:00	10007	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:16.029	2025-07-23 17:02:16.029	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7of86004r11zw1xfm823t	Subscription Renewal	Ashworth Consulting	4438.00	100	closed_won	Closed Won	2024-05-10 00:00:00	\N	2024-01-26 00:00:00	10008	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:16.086	2025-07-23 17:02:16.086	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7of9r004t11zwnz2hjscj	Sales Training	Harrow IT Services	4498.00	50	closed_lost	Closed Lost	2025-02-20 00:00:00	\N	2024-12-27 00:00:00	10009	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:16.143	2025-07-23 17:02:16.143	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ofbc004v11zwopjfpp94	Marketing Campaign	Inverness Data	4500.00	20	open	Discovery Call	2025-08-10 00:00:00	\N	2025-05-18 00:00:00	10010	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:16.201	2025-07-23 17:02:16.201	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ofd1004x11zwzxruc0f9	System Upgrade	Kingsway Group	1756.00	100	closed_won	Closed Won	2024-07-02 00:00:00	\N	2024-05-07 00:00:00	10011	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:16.261	2025-07-23 17:02:16.261	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ofep004z11zwvgavbkua	CRM Integration	Jubilee Networks	4512.00	100	closed_won	Closed Won	2025-07-12 00:00:00	\N	2025-06-15 00:00:00	10012	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:16.322	2025-07-23 17:02:16.322	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ofgc005111zwyn110s8t	Consulting Services	Southwick Logistics	4514.00	100	closed_won	Closed Won	2023-12-28 00:00:00	\N	2023-11-15 00:00:00	10013	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:16.381	2025-07-23 17:02:16.381	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ofi3005311zwhlanxvhv	Helpdesk Setup	Greenbridge Tech	4575.00	100	closed_won	Closed Won	2024-10-15 00:00:00	\N	2024-07-19 00:00:00	10014	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:16.443	2025-07-23 17:02:16.443	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ofjr005511zwrh47x5p1	SEO Optimization	Jubilee Networks	4586.00	50	closed_lost	Closed Lost	2023-12-17 00:00:00	\N	2023-09-12 00:00:00	10015	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:16.503	2025-07-23 17:02:16.503	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ofle005711zw5sczesli	Consulting Services	Telford Metrics	4595.00	50	closed_lost	Closed Lost	2025-06-20 00:00:00	\N	2025-03-25 00:00:00	10016	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:16.563	2025-07-23 17:02:16.563	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ofn0005911zwntqcya4x	Subscription Renewal	Dunford Analytics	7394.00	100	closed_won	Closed Won	2024-02-14 00:00:00	\N	2024-01-07 00:00:00	10017	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:16.62	2025-07-23 17:02:16.62	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ofol005b11zwf82romel	Network Overhaul	Milton Solutions	4636.00	100	closed_won	Closed Won	2023-11-02 00:00:00	\N	2023-09-30 00:00:00	10018	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:16.677	2025-07-23 17:02:16.677	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ofqj005d11zwhpgwmhnq	CRM Integration	Jubilee Networks	4637.00	90	open	Contract Review	2025-10-11 00:00:00	\N	2025-06-13 00:00:00	10019	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:16.747	2025-07-23 17:02:16.747	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ofsb005f11zwvia98dvn	Cloud Backup	Norfolk Hosting	4702.00	50	closed_lost	Closed Lost	2025-07-19 00:00:00	\N	2025-05-17 00:00:00	10020	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:16.812	2025-07-23 17:02:16.812	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oftz005h11zwttj5u80w	API Development	Jubilee Networks	4710.00	100	closed_won	Closed Won	2024-09-01 00:00:00	\N	2024-07-02 00:00:00	10021	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:16.871	2025-07-23 17:02:16.871	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ofvn005j11zwqf5mfzaz	SEO Optimization	Kingsway Group	4722.00	75	open	Technical Demo	2025-07-29 00:00:00	\N	2025-05-28 00:00:00	10022	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:16.931	2025-07-23 17:02:16.931	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ofxe005l11zw0engvbrl	Cloud Backup	Bramley Retail	5217.00	100	closed_won	Closed Won	2024-03-01 00:00:00	\N	2024-01-28 00:00:00	10023	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:16.994	2025-07-23 17:02:16.994	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ofyx005n11zw8z0g5lhc	System Upgrade	Jubilee Networks	4752.00	50	closed_lost	Closed Lost	2024-04-12 00:00:00	\N	2024-01-09 00:00:00	10024	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:17.05	2025-07-23 17:02:17.05	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7og0t005p11zwj7jrr5tb	Annual Maintenance	Oakfield Agency	6050.00	50	closed_lost	Closed Lost	2024-03-05 00:00:00	\N	2024-02-20 00:00:00	10025	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:17.117	2025-07-23 17:02:17.117	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7og2f005r11zwcturyni2	Consulting Services	Bramley Retail	4777.00	50	closed_lost	Closed Lost	2025-07-01 00:00:00	\N	2025-04-01 00:00:00	10026	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:17.175	2025-07-23 17:02:17.175	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7og40005t11zwcllybkk0	Marketing Campaign	Cavendish Systems	4791.00	50	closed_lost	Closed Lost	2025-05-18 00:00:00	\N	2025-03-06 00:00:00	10027	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:17.232	2025-07-23 17:02:17.232	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7og5o005v11zwp52kgdfc	SEO Optimization	Milton Solutions	4817.00	50	closed_lost	Closed Lost	2025-04-10 00:00:00	\N	2025-02-19 00:00:00	10028	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:17.293	2025-07-23 17:02:17.293	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7og7c005x11zwoewaufzo	API Development	Greenbridge Tech	5137.00	100	closed_won	Closed Won	2024-07-12 00:00:00	\N	2024-03-26 00:00:00	10029	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:17.352	2025-07-23 17:02:17.352	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7og92005z11zwwv5w5quv	SEO Optimization	Milton Solutions	4930.00	100	closed_won	Closed Won	2024-10-09 00:00:00	\N	2024-07-25 00:00:00	10030	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:17.415	2025-07-23 17:02:17.415	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ogax006111zweam7osqh	E-Commerce Integration	Kingsway Group	4601.00	100	closed_won	Closed Won	2024-03-26 00:00:00	\N	2024-02-08 00:00:00	10031	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:17.481	2025-07-23 17:02:17.481	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oge6006511zwio9p97zg	User Onboarding Setup	Kingsway Group	4995.00	100	closed_won	Closed Won	2023-12-16 00:00:00	\N	2023-12-08 00:00:00	10033	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:17.598	2025-07-23 17:02:17.598	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7oghz006711zwuhohgpcl	System Upgrade	Dunford Analytics	5000.00	50	closed_lost	Closed Lost	2024-11-17 00:00:00	\N	2024-11-03 00:00:00	10034	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:17.735	2025-07-23 17:02:17.735	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7oglo006911zwy97vhq0t	System Upgrade	Penrith Systems	6719.00	100	closed_won	Closed Won	2024-04-19 00:00:00	\N	2024-02-26 00:00:00	10035	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:17.868	2025-07-23 17:02:17.868	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ogne006b11zwiukl0vms	Annual Maintenance	Greenbridge Tech	3897.00	100	closed_won	Closed Won	2024-05-18 00:00:00	\N	2024-04-05 00:00:00	10036	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:17.93	2025-07-23 17:02:17.93	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ogp2006d11zw8jwmckyn	E-Commerce Integration	Quayside Legal	5067.00	100	closed_won	Closed Won	2025-06-14 00:00:00	\N	2025-05-07 00:00:00	10037	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:17.99	2025-07-23 17:02:17.99	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ogqn006f11zwtlop6xzc	Cloud Backup	Oakfield Agency	8840.00	50	closed_lost	Closed Lost	2024-06-18 00:00:00	\N	2024-04-24 00:00:00	10038	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:18.047	2025-07-23 17:02:18.047	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ogs7006h11zwm6qeyu1q	Consulting Services	Quayside Legal	5100.00	50	closed_lost	Closed Lost	2025-01-30 00:00:00	\N	2024-10-26 00:00:00	10039	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:18.103	2025-07-23 17:02:18.103	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ogtv006j11zw2atqwwfc	System Upgrade	Bramley Retail	5120.00	100	closed_won	Closed Won	2024-01-27 00:00:00	\N	2023-10-02 00:00:00	10040	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:18.163	2025-07-23 17:02:18.163	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ogvi006l11zwruebsj2n	CRM Integration	Lancaster Ltd	5124.00	50	closed_lost	Closed Lost	2024-06-19 00:00:00	\N	2024-03-19 00:00:00	10041	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:18.222	2025-07-23 17:02:18.222	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ogx3006n11zw6mhb8he5	Web Redesign	Greenbridge Tech	6367.00	100	closed_won	Closed Won	2024-07-06 00:00:00	\N	2024-05-09 00:00:00	10042	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:18.28	2025-07-23 17:02:18.28	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ogyp006p11zwsodteesk	Compliance Audit	Inverness Data	2076.00	100	closed_won	Closed Won	2024-08-11 00:00:00	\N	2024-04-17 00:00:00	10043	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:18.337	2025-07-23 17:02:18.337	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oh0f006r11zw5tvaqr9c	Subscription Renewal	Norfolk Hosting	5169.00	50	closed_lost	Closed Lost	2023-12-03 00:00:00	\N	2023-10-04 00:00:00	10044	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:18.399	2025-07-23 17:02:18.399	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oh21006t11zw3ggodhhx	System Upgrade	Ashworth Consulting	5745.00	100	closed_won	Closed Won	2024-07-10 00:00:00	\N	2024-05-22 00:00:00	10045	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:18.457	2025-07-23 17:02:18.457	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oh3n006v11zwr8p9kaac	Subscription Renewal	Bramley Retail	5205.00	50	closed_lost	Closed Lost	2025-07-06 00:00:00	\N	2025-06-15 00:00:00	10046	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:18.516	2025-07-23 17:02:18.516	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ojy700ap11zweo5maqq6	Data Warehousing	Telford Metrics	6569.00	50	closed_lost	Closed Lost	2025-03-10 00:00:00	\N	2025-02-16 00:00:00	10115	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:22.207	2025-07-23 17:02:22.207	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ok0200ar11zwe139qlh2	Cloud Backup	Ashworth Consulting	3308.00	100	closed_won	Closed Won	2025-03-01 00:00:00	\N	2025-02-10 00:00:00	10116	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:22.275	2025-07-23 17:02:22.275	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ok1n00at11zwlhkjs2ql	Network Overhaul	Epsom Ventures	5123.00	75	open	Technical Demo	2025-08-03 00:00:00	\N	2025-05-10 00:00:00	10117	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:22.331	2025-07-23 17:02:22.331	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ok3c00av11zwgaeozzlx	API Development	Cavendish Systems	5468.00	100	closed_won	Closed Won	2025-03-09 00:00:00	\N	2024-11-23 00:00:00	10118	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:22.393	2025-07-23 17:02:22.393	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ok5200ax11zw1i3xqnjj	Helpdesk Setup	Jubilee Networks	6587.00	90	open	Contract Review	2025-10-16 00:00:00	\N	2025-05-04 00:00:00	10119	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:22.455	2025-07-23 17:02:22.455	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ok6p00az11zwusqphbdz	Product Expansion	Lancaster Ltd	4506.00	100	closed_won	Closed Won	2025-04-11 00:00:00	\N	2025-03-28 00:00:00	10120	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:22.514	2025-07-23 17:02:22.514	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ok9100b111zwj8l1wwxe	Product Expansion	Oakfield Agency	6608.00	100	closed_won	Closed Won	2025-01-13 00:00:00	\N	2024-10-04 00:00:00	10121	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:22.598	2025-07-23 17:02:22.598	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7okb200b311zwwwcslaof	Marketing Campaign	Epsom Ventures	6608.00	50	closed_lost	Closed Lost	2024-11-14 00:00:00	\N	2024-10-08 00:00:00	10122	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:22.671	2025-07-23 17:02:22.671	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7okct00b511zwuymf6gvq	E-Commerce Integration	Bramley Retail	6671.00	50	closed_lost	Closed Lost	2024-08-09 00:00:00	\N	2024-05-01 00:00:00	10123	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:22.734	2025-07-23 17:02:22.734	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7oked00b711zwkab352mh	Consulting Services	Milton Solutions	5048.00	60	open	Proposal Submitted	2025-08-08 00:00:00	\N	2025-05-05 00:00:00	10124	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:22.79	2025-07-23 17:02:22.79	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7okfx00b911zwen9wuao6	Compliance Audit	Epsom Ventures	6718.00	60	open	Proposal Submitted	2025-09-26 00:00:00	\N	2025-05-08 00:00:00	10125	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:22.846	2025-07-23 17:02:22.846	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7okhh00bb11zwtyjo08t0	Subscription Renewal	Dunford Analytics	7275.00	75	open	Technical Demo	2025-08-08 00:00:00	\N	2025-07-06 00:00:00	10126	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:22.901	2025-07-23 17:02:22.901	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7okj100bd11zwu0yksb4c	User Onboarding Setup	Oakfield Agency	6721.00	35	open	Needs Analysis	2025-09-16 00:00:00	\N	2025-07-09 00:00:00	10127	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:22.958	2025-07-23 17:02:22.958	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7okkm00bf11zwr7npgit7	Marketing Campaign	Dunford Analytics	5517.00	60	open	Proposal Submitted	2025-08-23 00:00:00	\N	2025-06-29 00:00:00	10128	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:23.014	2025-07-23 17:02:23.014	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7okm600bh11zwl22njb4i	Compliance Audit	Telford Metrics	6738.00	100	closed_won	Closed Won	2024-06-03 00:00:00	\N	2024-02-10 00:00:00	10129	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:23.07	2025-07-23 17:02:23.07	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oknq00bj11zwz9jp7zr6	Annual Maintenance	Kingsway Group	6766.00	100	closed_won	Closed Won	2024-06-28 00:00:00	\N	2024-05-25 00:00:00	10130	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:23.126	2025-07-23 17:02:23.126	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7okpa00bl11zwm1njf738	System Upgrade	Quayside Legal	6816.00	50	closed_lost	Closed Lost	2024-03-01 00:00:00	\N	2023-11-10 00:00:00	10131	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:23.182	2025-07-23 17:02:23.182	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7okqx00bn11zwh2k12zzc	Compliance Audit	Oakfield Agency	6830.00	100	closed_won	Closed Won	2024-09-05 00:00:00	\N	2024-08-21 00:00:00	10132	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:23.241	2025-07-23 17:02:23.241	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oksh00bp11zwz7h4b5wk	Compliance Audit	Kingsway Group	6859.00	100	closed_won	Closed Won	2024-02-01 00:00:00	\N	2023-12-07 00:00:00	10133	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:23.297	2025-07-23 17:02:23.297	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oku100br11zwxspwh1f5	User Onboarding Setup	Dunford Analytics	6882.00	100	closed_won	Closed Won	2025-05-02 00:00:00	\N	2025-04-11 00:00:00	10134	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:23.353	2025-07-23 17:02:23.353	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7oh60006x11zweukpl07a	System Upgrade	Bramley Retail	5205.00	100	closed_won	Closed Won	2023-10-06 00:00:00	\N	2023-08-10 00:00:00	10047	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:18.601	2025-07-23 17:02:18.601	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7oh7k006z11zwrm5dlvxa	Network Overhaul	Greenbridge Tech	6735.00	50	closed_lost	Closed Lost	2024-08-01 00:00:00	\N	2024-04-16 00:00:00	10048	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:18.656	2025-07-23 17:02:18.656	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oh9o007111zwo2xjbqqc	System Upgrade	Richmond Software	5222.00	35	open	Needs Analysis	2025-08-07 00:00:00	\N	2025-07-07 00:00:00	10049	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:18.732	2025-07-23 17:02:18.732	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ohb4007311zwv4zila7s	Infrastructure Review	Dunford Analytics	5231.00	50	closed_lost	Closed Lost	2024-11-16 00:00:00	\N	2024-08-30 00:00:00	10050	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:18.784	2025-07-23 17:02:18.784	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ohcn007511zw8f24gj6p	Compliance Audit	Southwick Logistics	5256.00	20	open	Discovery Call	2025-08-18 00:00:00	\N	2025-06-09 00:00:00	10051	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:18.839	2025-07-23 17:02:18.839	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ohe2007711zwrhdm700t	Cloud Backup	Greenbridge Tech	5280.00	50	closed_lost	Closed Lost	2024-10-30 00:00:00	\N	2024-09-23 00:00:00	10052	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:18.89	2025-07-23 17:02:18.89	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ohfh007911zwrjfa3yq0	E-Commerce Integration	Quayside Legal	5355.00	50	closed_lost	Closed Lost	2025-06-18 00:00:00	\N	2025-03-24 00:00:00	10053	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:18.941	2025-07-23 17:02:18.941	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ohgx007b11zwhx4yy84q	CRM Integration	Milton Solutions	5357.00	35	open	Needs Analysis	2025-09-13 00:00:00	\N	2025-05-08 00:00:00	10054	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:18.994	2025-07-23 17:02:18.994	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ohid007d11zwjyacx0g4	Network Overhaul	Cavendish Systems	4101.00	50	closed_lost	Closed Lost	2024-10-07 00:00:00	\N	2024-08-10 00:00:00	10055	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.045	2025-07-23 17:02:19.045	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ohjt007f11zw9axbfr7w	Infrastructure Review	Epsom Ventures	5395.00	100	closed_won	Closed Won	2025-06-15 00:00:00	\N	2025-05-23 00:00:00	10056	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.098	2025-07-23 17:02:19.098	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ohlb007h11zwbmfz4k4a	E-Commerce Integration	Southwick Logistics	4855.00	100	closed_won	Closed Won	2024-09-16 00:00:00	\N	2024-08-30 00:00:00	10057	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.152	2025-07-23 17:02:19.152	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ohmr007j11zwskcoyjod	Product Expansion	Dunford Analytics	5477.00	75	open	Technical Demo	2025-09-19 00:00:00	\N	2025-07-12 00:00:00	10058	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.203	2025-07-23 17:02:19.203	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7oho7007l11zwquq0zjy4	CRM Integration	Inverness Data	5489.00	20	open	Discovery Call	2025-08-07 00:00:00	\N	2025-05-13 00:00:00	10059	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.256	2025-07-23 17:02:19.256	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ohpn007n11zwenr78pgv	Cloud Backup	Lancaster Ltd	6268.00	100	closed_won	Closed Won	2024-10-17 00:00:00	\N	2024-08-17 00:00:00	10060	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.307	2025-07-23 17:02:19.307	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ohr3007p11zw8jiw1f21	Product Expansion	Milton Solutions	5518.00	100	closed_won	Closed Won	2025-07-16 00:00:00	\N	2025-06-15 00:00:00	10061	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.359	2025-07-23 17:02:19.359	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ohsi007r11zwnncjvtfd	Helpdesk Setup	Dunford Analytics	5526.00	100	closed_won	Closed Won	2024-12-10 00:00:00	\N	2024-09-19 00:00:00	10062	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.411	2025-07-23 17:02:19.411	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ohty007t11zwv3gv9o60	Data Warehousing	Farringdon Design	6132.00	100	closed_won	Closed Won	2024-11-03 00:00:00	\N	2024-10-15 00:00:00	10063	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.463	2025-07-23 17:02:19.463	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ohvg007v11zwrlfgee7p	Compliance Audit	Milton Solutions	2868.00	50	closed_lost	Closed Lost	2024-11-14 00:00:00	\N	2024-08-03 00:00:00	10064	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.516	2025-07-23 17:02:19.516	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ohww007x11zwpck2nczj	Consulting Services	Southwick Logistics	5554.00	50	closed_lost	Closed Lost	2024-12-06 00:00:00	\N	2024-09-17 00:00:00	10065	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.568	2025-07-23 17:02:19.568	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ohyb007z11zwztyjzr0w	Helpdesk Setup	Lancaster Ltd	7077.00	100	closed_won	Closed Won	2024-11-15 00:00:00	\N	2024-08-09 00:00:00	10066	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.619	2025-07-23 17:02:19.619	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ohzr008111zwqxz08lup	Helpdesk Setup	Ashworth Consulting	5578.00	50	closed_lost	Closed Lost	2025-01-24 00:00:00	\N	2025-01-01 00:00:00	10067	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.671	2025-07-23 17:02:19.671	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7oi17008311zw2lmneswe	Cloud Backup	Lancaster Ltd	5583.00	100	closed_won	Closed Won	2025-07-09 00:00:00	\N	2025-05-09 00:00:00	10068	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.723	2025-07-23 17:02:19.723	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oi2n008511zw52r4e4af	Consulting Services	Jubilee Networks	5604.00	50	closed_lost	Closed Lost	2024-10-30 00:00:00	\N	2024-07-21 00:00:00	10069	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.775	2025-07-23 17:02:19.775	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oi45008711zw8tq05wsj	Data Security Package	Telford Metrics	2753.00	100	closed_won	Closed Won	2024-10-09 00:00:00	\N	2024-09-06 00:00:00	10070	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.829	2025-07-23 17:02:19.829	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oi5l008911zwu0k0km9x	Marketing Campaign	Southwick Logistics	5608.00	100	closed_won	Closed Won	2024-11-25 00:00:00	\N	2024-08-08 00:00:00	10071	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.881	2025-07-23 17:02:19.881	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oi74008b11zw0yrgm2bn	Product Expansion	Jubilee Networks	5611.00	100	closed_won	Closed Won	2024-09-10 00:00:00	\N	2024-05-24 00:00:00	10072	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.936	2025-07-23 17:02:19.936	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7oi8k008d11zwhw5f8puu	CRM Integration	Dunford Analytics	5638.00	50	closed_lost	Closed Lost	2024-10-27 00:00:00	\N	2024-10-05 00:00:00	10073	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:19.988	2025-07-23 17:02:19.988	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7oi9z008f11zwr3phnblk	Network Overhaul	Quayside Legal	5665.00	100	closed_won	Closed Won	2024-08-17 00:00:00	\N	2024-06-01 00:00:00	10074	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.039	2025-07-23 17:02:20.039	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oibe008h11zw7x9dh30f	Web Redesign	Farringdon Design	5080.00	100	closed_won	Closed Won	2024-11-17 00:00:00	\N	2024-10-25 00:00:00	10075	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.09	2025-07-23 17:02:20.09	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oict008j11zwtq5ib49k	API Development	Farringdon Design	5699.00	20	open	Discovery Call	2025-08-01 00:00:00	\N	2025-05-14 00:00:00	10076	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.141	2025-07-23 17:02:20.141	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7oie8008l11zwim0tf29c	Cloud Backup	Lancaster Ltd	5706.00	100	closed_won	Closed Won	2025-07-17 00:00:00	\N	2025-03-24 00:00:00	10077	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.192	2025-07-23 17:02:20.192	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7oifm008n11zwlecfi4q3	CRM Integration	Bramley Retail	5575.00	50	closed_lost	Closed Lost	2025-01-11 00:00:00	\N	2024-10-09 00:00:00	10078	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.243	2025-07-23 17:02:20.243	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oih1008p11zw94u1lcmr	Data Security Package	Jubilee Networks	5673.00	50	closed_lost	Closed Lost	2025-01-15 00:00:00	\N	2024-09-25 00:00:00	10079	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.293	2025-07-23 17:02:20.293	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oiir008r11zwq1erb5xv	Consulting Services	Southwick Logistics	5749.00	35	open	Needs Analysis	2025-09-25 00:00:00	\N	2025-06-11 00:00:00	10080	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.355	2025-07-23 17:02:20.355	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7oik9008t11zw1fp2o17v	API Development	Cavendish Systems	5757.00	100	closed_won	Closed Won	2024-07-12 00:00:00	\N	2024-05-02 00:00:00	10081	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.409	2025-07-23 17:02:20.409	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7oilp008v11zwc3ui58mp	Consulting Services	Farringdon Design	5776.00	75	open	Technical Demo	2025-08-20 00:00:00	\N	2025-06-04 00:00:00	10082	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.461	2025-07-23 17:02:20.461	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oin9008x11zwdj025wiv	Sales Training	Telford Metrics	5778.00	50	closed_lost	Closed Lost	2024-04-05 00:00:00	\N	2023-12-29 00:00:00	10083	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.517	2025-07-23 17:02:20.517	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oioq008z11zw8d26xfe6	Helpdesk Setup	Dunford Analytics	5807.00	50	closed_lost	Closed Lost	2023-12-14 00:00:00	\N	2023-08-20 00:00:00	10084	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.571	2025-07-23 17:02:20.571	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7oiq8009111zwdciy6pvd	User Onboarding Setup	Bramley Retail	5944.00	50	closed_lost	Closed Lost	2025-03-19 00:00:00	\N	2025-02-28 00:00:00	10085	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.624	2025-07-23 17:02:20.624	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7oirn009311zw45vq11i1	Data Security Package	Cavendish Systems	5869.00	50	closed_lost	Closed Lost	2024-11-25 00:00:00	\N	2024-09-19 00:00:00	10086	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.675	2025-07-23 17:02:20.675	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oit3009511zwgn8zm7zw	Web Redesign	Harrow IT Services	5870.00	100	closed_won	Closed Won	2025-03-14 00:00:00	\N	2025-01-05 00:00:00	10087	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.727	2025-07-23 17:02:20.727	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oiuh009711zwesmlray5	API Development	Quayside Legal	6569.00	100	closed_won	Closed Won	2025-04-02 00:00:00	\N	2025-01-20 00:00:00	10088	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.778	2025-07-23 17:02:20.778	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7oivy009911zwnm2yfnpe	Network Overhaul	Harrow IT Services	4773.00	100	closed_won	Closed Won	2025-04-17 00:00:00	\N	2025-04-02 00:00:00	10089	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.831	2025-07-23 17:02:20.831	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7oixd009b11zwgp1pligo	Product Expansion	Greenbridge Tech	6077.00	100	closed_won	Closed Won	2023-11-28 00:00:00	\N	2023-10-12 00:00:00	10090	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.881	2025-07-23 17:02:20.881	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oiys009d11zw1ek15nth	Data Security Package	Inverness Data	7295.00	100	closed_won	Closed Won	2024-12-15 00:00:00	\N	2024-10-16 00:00:00	10091	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.933	2025-07-23 17:02:20.933	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oj08009f11zwoi0gg56o	Consulting Services	Oakfield Agency	5844.00	100	closed_won	Closed Won	2025-05-02 00:00:00	\N	2025-01-07 00:00:00	10092	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:20.984	2025-07-23 17:02:20.984	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oj1n009h11zwmdw2bmye	Infrastructure Review	Jubilee Networks	6127.00	35	open	Needs Analysis	2025-10-09 00:00:00	\N	2025-05-04 00:00:00	10093	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.035	2025-07-23 17:02:21.035	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oj32009j11zwpreq8d9h	Network Overhaul	Kingsway Group	2681.00	100	closed_won	Closed Won	2025-05-19 00:00:00	\N	2025-02-11 00:00:00	10094	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.086	2025-07-23 17:02:21.086	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oj4m009l11zwd7erg3pz	User Onboarding Setup	Lancaster Ltd	6172.00	100	closed_won	Closed Won	2024-12-20 00:00:00	\N	2024-10-16 00:00:00	10095	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.142	2025-07-23 17:02:21.142	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7oj64009n11zw51hv9o5l	Helpdesk Setup	Bramley Retail	6187.00	100	closed_won	Closed Won	2024-12-21 00:00:00	\N	2024-11-21 00:00:00	10096	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.196	2025-07-23 17:02:21.196	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7oj7j009p11zwsa3yn7g0	Marketing Campaign	Farringdon Design	6569.00	100	closed_won	Closed Won	2025-01-09 00:00:00	\N	2024-09-28 00:00:00	10097	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.248	2025-07-23 17:02:21.248	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oj8z009r11zw9emmobjn	Compliance Audit	Telford Metrics	6228.00	50	closed_lost	Closed Lost	2025-04-10 00:00:00	\N	2025-03-30 00:00:00	10098	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.299	2025-07-23 17:02:21.299	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ojai009t11zw4h36cvx3	Network Overhaul	Oakfield Agency	6255.00	100	closed_won	Closed Won	2025-01-04 00:00:00	\N	2024-09-26 00:00:00	10099	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.354	2025-07-23 17:02:21.354	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ojbx009v11zwwotpqq3b	Annual Maintenance	Jubilee Networks	6258.00	100	closed_won	Closed Won	2024-01-19 00:00:00	\N	2023-11-28 00:00:00	10100	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.406	2025-07-23 17:02:21.406	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ojdd009x11zw3v8p0b2x	SEO Optimization	Ashworth Consulting	4939.00	50	closed_lost	Closed Lost	2025-05-26 00:00:00	\N	2025-02-01 00:00:00	10101	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.458	2025-07-23 17:02:21.458	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ojes009z11zwemzkcpwy	Annual Maintenance	Epsom Ventures	4232.00	50	closed_lost	Closed Lost	2025-06-13 00:00:00	\N	2025-03-29 00:00:00	10102	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.509	2025-07-23 17:02:21.509	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ojg700a111zwg6fhawgh	Consulting Services	Quayside Legal	6320.00	100	closed_won	Closed Won	2025-06-23 00:00:00	\N	2025-04-03 00:00:00	10103	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.559	2025-07-23 17:02:21.559	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ojhn00a311zwz8fgajsi	CRM Integration	Jubilee Networks	7186.00	100	closed_won	Closed Won	2025-01-20 00:00:00	\N	2024-11-24 00:00:00	10104	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.611	2025-07-23 17:02:21.611	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ojj200a511zwq930y6k4	Data Warehousing	Epsom Ventures	6335.00	50	closed_lost	Closed Lost	2024-02-25 00:00:00	\N	2023-12-19 00:00:00	10105	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.663	2025-07-23 17:02:21.663	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ojki00a711zwsapy125b	E-Commerce Integration	Southwick Logistics	3454.00	50	closed_lost	Closed Lost	2025-06-24 00:00:00	\N	2025-04-30 00:00:00	10106	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.714	2025-07-23 17:02:21.714	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ojlz00a911zwa87r51sn	Consulting Services	Farringdon Design	2700.00	50	closed_lost	Closed Lost	2025-07-10 00:00:00	\N	2025-06-09 00:00:00	10107	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.767	2025-07-23 17:02:21.767	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ojno00ab11zwo9co9joy	Network Overhaul	Inverness Data	6413.00	90	open	Contract Review	2025-09-14 00:00:00	\N	2025-06-03 00:00:00	10108	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.829	2025-07-23 17:02:21.829	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ojp900ad11zwdg3h6r8n	System Upgrade	Inverness Data	6451.00	50	closed_lost	Closed Lost	2025-03-07 00:00:00	\N	2024-12-19 00:00:00	10109	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.885	2025-07-23 17:02:21.885	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ojqr00af11zwaeaih6g7	Infrastructure Review	Quayside Legal	6453.00	35	open	Needs Analysis	2025-07-22 00:00:00	\N	2025-05-18 00:00:00	10110	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.939	2025-07-23 17:02:21.939	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ojsb00ah11zwol21nvye	SEO Optimization	Greenbridge Tech	6472.00	50	closed_lost	Closed Lost	2025-10-11 00:00:00	\N	2025-07-08 00:00:00	10111	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:21.996	2025-07-23 17:02:21.996	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ojtt00aj11zwaf0wub6i	Cloud Backup	Penrith Systems	6558.00	20	open	Discovery Call	2025-07-15 00:00:00	\N	2025-06-13 00:00:00	10112	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:22.049	2025-07-23 17:02:22.049	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ojv800al11zwavu8a8jl	Data Security Package	Greenbridge Tech	6568.00	100	closed_won	Closed Won	2025-07-05 00:00:00	\N	2025-07-16 00:00:00	10113	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:22.101	2025-07-23 17:02:22.101	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ojwo00an11zwby6esfui	Data Warehousing	Cavendish Systems	6582.00	50	closed_lost	Closed Lost	2025-07-13 00:00:00	\N	2025-07-20 00:00:00	10114	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:22.153	2025-07-23 17:02:22.153	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7okvl00bt11zww01nlgmz	Helpdesk Setup	Norfolk Hosting	6887.00	100	closed_won	Closed Won	2024-07-31 00:00:00	\N	2024-06-20 00:00:00	10135	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:23.41	2025-07-23 17:02:23.41	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7okx600bv11zw7qwobuxx	E-Commerce Integration	Lancaster Ltd	6940.00	50	closed_lost	Closed Lost	2024-06-25 00:00:00	\N	2024-05-13 00:00:00	10136	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:23.466	2025-07-23 17:02:23.466	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7okyt00bx11zwlm89v2hl	Product Expansion	Norfolk Hosting	6941.00	90	open	Contract Review	2025-08-23 00:00:00	\N	2025-05-21 00:00:00	10137	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:23.526	2025-07-23 17:02:23.526	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ol0g00bz11zws3bnaz0m	E-Commerce Integration	Norfolk Hosting	6966.00	50	closed_lost	Closed Lost	2024-12-01 00:00:00	\N	2024-11-11 00:00:00	10138	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:23.585	2025-07-23 17:02:23.585	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ol2200c111zwdiyn1dcs	Product Expansion	Epsom Ventures	6972.00	50	closed_lost	Closed Lost	2023-12-31 00:00:00	\N	2023-09-14 00:00:00	10139	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:23.642	2025-07-23 17:02:23.642	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ol3n00c311zw9nbj5gbv	Web Redesign	Inverness Data	6975.00	100	closed_won	Closed Won	2023-11-18 00:00:00	\N	2023-08-07 00:00:00	10140	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:23.699	2025-07-23 17:02:23.699	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ol5800c511zw0e1klx7r	Infrastructure Review	Southwick Logistics	7018.00	100	closed_won	Closed Won	2023-12-30 00:00:00	\N	2023-09-18 00:00:00	10141	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:23.756	2025-07-23 17:02:23.756	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ol6s00c711zwkib53r8e	Consulting Services	Telford Metrics	7058.00	100	closed_won	Closed Won	2025-05-19 00:00:00	\N	2025-04-21 00:00:00	10142	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:23.813	2025-07-23 17:02:23.813	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7ol8c00c911zw73ulob3t	Sales Training	Epsom Ventures	6336.00	90	open	Contract Review	2025-08-23 00:00:00	\N	2025-07-19 00:00:00	10143	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:23.868	2025-07-23 17:02:23.868	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7ol9w00cb11zw3t1affdv	Data Security Package	Inverness Data	7156.00	60	open	Proposal Submitted	2025-08-10 00:00:00	\N	2025-06-21 00:00:00	10144	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:23.925	2025-07-23 17:02:23.925	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7olbf00cd11zw62qc1k7w	User Onboarding Setup	Harrow IT Services	7169.00	100	closed_won	Closed Won	2023-11-10 00:00:00	\N	2023-09-16 00:00:00	10145	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:23.98	2025-07-23 17:02:23.98	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7old100cf11zwog1w8kmk	Infrastructure Review	Inverness Data	6583.00	100	closed_won	Closed Won	2025-05-26 00:00:00	\N	2025-04-29 00:00:00	10146	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:24.037	2025-07-23 17:02:24.037	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oleq00ch11zwey2cmglm	Annual Maintenance	Jubilee Networks	7217.00	50	closed_lost	Closed Lost	2024-09-11 00:00:00	\N	2024-05-29 00:00:00	10147	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:24.099	2025-07-23 17:02:24.099	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7olgf00cj11zwfhztskty	Product Expansion	Bramley Retail	7233.00	50	closed_lost	Closed Lost	2024-05-03 00:00:00	\N	2024-02-19 00:00:00	10148	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:24.159	2025-07-23 17:02:24.159	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7oli000cl11zwdzroshpc	Network Overhaul	Bramley Retail	3767.00	90	open	Contract Review	2025-08-26 00:00:00	\N	2025-06-25 00:00:00	10149	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:24.216	2025-07-23 17:02:24.216	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oluo00d111zwivslcx7x	SEO Optimization	Lancaster Ltd	8350.00	90	open	Contract Review	2025-08-26 00:00:00	\N	2025-06-07 00:00:00	10157	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:24.672	2025-07-23 17:02:24.672	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7olwa00d311zwd6enc3zu	Cloud Backup	Oakfield Agency	7411.00	100	closed_won	Closed Won	2024-09-29 00:00:00	\N	2024-06-22 00:00:00	10158	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:24.73	2025-07-23 17:02:24.73	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oly200d511zwrnz8voc1	Subscription Renewal	Quayside Legal	7450.00	50	closed_lost	Closed Lost	2025-04-09 00:00:00	\N	2025-02-19 00:00:00	10159	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:24.795	2025-07-23 17:02:24.795	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7olzs00d711zwvljqpudi	Sales Training	Bramley Retail	7522.00	100	closed_won	Closed Won	2024-06-01 00:00:00	\N	2024-03-06 00:00:00	10160	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:24.857	2025-07-23 17:02:24.857	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7om1f00d911zwu16mwty2	Data Security Package	Inverness Data	7541.00	100	closed_won	Closed Won	2024-04-23 00:00:00	\N	2024-01-07 00:00:00	10161	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:24.916	2025-07-23 17:02:24.916	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7om3100db11zwloyvpt9y	Sales Training	Telford Metrics	7610.00	35	open	Needs Analysis	2025-09-11 00:00:00	\N	2025-06-08 00:00:00	10162	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:24.973	2025-07-23 17:02:24.973	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7om4r00dd11zwy6vownlt	API Development	Ashworth Consulting	7662.00	35	open	Needs Analysis	2025-09-19 00:00:00	\N	2025-05-07 00:00:00	10163	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:25.035	2025-07-23 17:02:25.035	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7om6k00df11zw2gqyk8c6	Sales Training	Inverness Data	7666.00	100	closed_won	Closed Won	2025-07-16 00:00:00	\N	2025-07-02 00:00:00	10164	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:25.1	2025-07-23 17:02:25.1	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7om8b00dh11zwdnf4wer6	E-Commerce Integration	Bramley Retail	9602.00	100	closed_won	Closed Won	2025-07-18 00:00:00	\N	2025-07-16 00:00:00	10165	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:25.163	2025-07-23 17:02:25.163	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7oma400dj11zw8dewx27s	Data Security Package	Dunford Analytics	7709.00	50	closed_lost	Closed Lost	2024-05-20 00:00:00	\N	2024-04-10 00:00:00	10166	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:25.229	2025-07-23 17:02:25.229	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ombr00dl11zwo6ja9hck	System Upgrade	Dunford Analytics	7742.00	50	closed_lost	Closed Lost	2024-07-07 00:00:00	\N	2024-04-21 00:00:00	10167	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:25.287	2025-07-23 17:02:25.287	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7omdh00dn11zwa2snry49	Cloud Backup	Lancaster Ltd	7749.00	100	closed_won	Closed Won	2024-10-24 00:00:00	\N	2024-07-02 00:00:00	10168	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:25.35	2025-07-23 17:02:25.35	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7omfk00dp11zw54ixtn6l	System Upgrade	Harrow IT Services	7760.00	50	closed_lost	Closed Lost	2025-02-21 00:00:00	\N	2025-01-03 00:00:00	10169	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:25.424	2025-07-23 17:02:25.424	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7omhd00dr11zwm5qwbwnf	E-Commerce Integration	Telford Metrics	7775.00	100	closed_won	Closed Won	2025-07-20 00:00:00	\N	2025-05-14 00:00:00	10170	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:25.489	2025-07-23 17:02:25.489	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7omiw00dt11zwzihgq2l9	Annual Maintenance	Harrow IT Services	7959.00	50	closed_lost	Closed Lost	2024-04-10 00:00:00	\N	2024-01-22 00:00:00	10171	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:25.545	2025-07-23 17:02:25.545	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7omkk00dv11zwlejnj0vv	API Development	Lancaster Ltd	7974.00	20	open	Discovery Call	2025-08-18 00:00:00	\N	2025-06-13 00:00:00	10172	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:25.604	2025-07-23 17:02:25.604	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7omm400dx11zw0iten5rv	Subscription Renewal	Southwick Logistics	8057.00	50	closed_lost	Closed Lost	2025-05-07 00:00:00	\N	2025-01-14 00:00:00	10173	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:25.66	2025-07-23 17:02:25.66	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7omnp00dz11zwoy1fvpcc	Marketing Campaign	Inverness Data	8076.00	50	closed_lost	Closed Lost	2024-05-23 00:00:00	\N	2024-02-01 00:00:00	10174	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:25.717	2025-07-23 17:02:25.717	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7ompb00e111zw1irje8vd	System Upgrade	Quayside Legal	8084.00	50	closed_lost	Closed Lost	2025-07-13 00:00:00	\N	2025-06-21 00:00:00	10175	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:25.775	2025-07-23 17:02:25.775	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oljn00cn11zwc6z24j4i	Annual Maintenance	Epsom Ventures	7283.00	50	closed_lost	Closed Lost	2025-06-05 00:00:00	\N	2025-03-08 00:00:00	10150	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:24.276	2025-07-23 17:02:24.276	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7olld00cp11zws2b6sn6z	System Upgrade	Greenbridge Tech	7292.00	100	closed_won	Closed Won	2023-11-17 00:00:00	\N	2023-11-06 00:00:00	10151	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:24.337	2025-07-23 17:02:24.337	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7olmy00cr11zwp6flznvl	Consulting Services	Bramley Retail	2262.00	100	closed_won	Closed Won	2025-07-05 00:00:00	\N	2025-06-14 00:00:00	10152	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:24.395	2025-07-23 17:02:24.395	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7oloj00ct11zw0zttwtg7	User Onboarding Setup	Ashworth Consulting	7321.00	35	open	Needs Analysis	2025-08-17 00:00:00	\N	2025-07-07 00:00:00	10153	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:24.451	2025-07-23 17:02:24.451	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7olq100cv11zwfgts6x1c	Marketing Campaign	Cavendish Systems	7329.00	50	closed_lost	Closed Lost	2025-03-05 00:00:00	\N	2024-11-09 00:00:00	10154	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:24.505	2025-07-23 17:02:24.505	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7olrj00cx11zwyp71xn9e	Web Redesign	Dunford Analytics	7374.00	100	closed_won	Closed Won	2023-11-22 00:00:00	\N	2023-11-12 00:00:00	10155	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:24.56	2025-07-23 17:02:24.56	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7olt200cz11zwhmogcnfj	Sales Training	Dunford Analytics	7383.00	50	closed_lost	Closed Lost	2024-01-10 00:00:00	\N	2023-12-10 00:00:00	10156	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:24.614	2025-07-23 17:02:24.614	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7omvr00e911zwlx47oiw9	Data Warehousing	Quayside Legal	5550.00	35	open	Needs Analysis	2025-08-28 00:00:00	\N	2025-05-29 00:00:00	10179	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:26.007	2025-07-23 17:02:26.007	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7omx700eb11zwfa2f39y4	CRM Integration	Lancaster Ltd	8362.00	100	closed_won	Closed Won	2024-08-14 00:00:00	\N	2024-07-01 00:00:00	10180	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:26.059	2025-07-23 17:02:26.059	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7omyn00ed11zwkmjnuqv6	E-Commerce Integration	Greenbridge Tech	8510.00	100	closed_won	Closed Won	2025-06-18 00:00:00	\N	2025-03-21 00:00:00	10181	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:26.112	2025-07-23 17:02:26.112	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7on1y00ef11zwr4giu0eq	SEO Optimization	Epsom Ventures	8547.00	50	closed_lost	Closed Lost	2025-04-14 00:00:00	\N	2025-03-22 00:00:00	10182	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:26.231	2025-07-23 17:02:26.231	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7on4r00eh11zwuz3p8bur	Infrastructure Review	Milton Solutions	8644.00	50	closed_lost	Closed Lost	2024-04-24 00:00:00	\N	2024-01-22 00:00:00	10183	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:26.331	2025-07-23 17:02:26.331	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7on6800ej11zwog7ushtw	Consulting Services	Telford Metrics	8664.00	100	closed_won	Closed Won	2023-11-22 00:00:00	\N	2023-07-30 00:00:00	10184	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:26.385	2025-07-23 17:02:26.385	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7on9000el11zwz9ugwqk3	Network Overhaul	Jubilee Networks	8688.00	100	closed_won	Closed Won	2025-04-06 00:00:00	\N	2025-03-25 00:00:00	10185	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:26.484	2025-07-23 17:02:26.484	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7ond500en11zwv7hub2yu	Infrastructure Review	Oakfield Agency	8744.00	50	closed_lost	Closed Lost	2024-07-25 00:00:00	\N	2024-04-27 00:00:00	10186	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:26.633	2025-07-23 17:02:26.633	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7onim00ep11zw799yo6f7	Marketing Campaign	Jubilee Networks	8745.00	50	closed_lost	Closed Lost	2024-07-02 00:00:00	\N	2024-05-23 00:00:00	10187	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:26.831	2025-07-23 17:02:26.831	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7onm700er11zw0nqr8v8z	Subscription Renewal	Oakfield Agency	8797.00	100	closed_won	Closed Won	2025-03-01 00:00:00	\N	2025-02-02 00:00:00	10188	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:26.96	2025-07-23 17:02:26.96	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7onr000et11zwezxi4ryx	Cloud Backup	Harrow IT Services	5547.00	90	open	Contract Review	2025-09-17 00:00:00	\N	2025-07-06 00:00:00	10189	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:27.132	2025-07-23 17:02:27.132	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7onsh00ev11zwcgz1u5zm	API Development	Cavendish Systems	8944.00	50	closed_lost	Closed Lost	2023-10-20 00:00:00	\N	2023-08-10 00:00:00	10190	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:27.185	2025-07-23 17:02:27.185	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7onug00ex11zwc3egxgyh	System Upgrade	Kingsway Group	9036.00	50	closed_lost	Closed Lost	2024-08-19 00:00:00	\N	2024-08-08 00:00:00	10191	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:27.256	2025-07-23 17:02:27.256	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7onvx00ez11zwaqev9tmn	Infrastructure Review	Inverness Data	5194.00	60	open	Proposal Submitted	2025-10-09 00:00:00	\N	2025-06-26 00:00:00	10192	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:27.31	2025-07-23 17:02:27.31	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7onxj00f111zwh7kg8zxe	Helpdesk Setup	Harrow IT Services	9338.00	100	closed_won	Closed Won	2025-09-02 00:00:00	\N	2025-05-13 00:00:00	10193	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:27.368	2025-07-23 17:02:27.368	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7onyz00f311zwlkummof2	Infrastructure Review	Quayside Legal	9360.00	35	open	Needs Analysis	2025-08-06 00:00:00	\N	2025-06-29 00:00:00	10194	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:27.419	2025-07-23 17:02:27.419	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oo0e00f511zwtj8ko5nn	Subscription Renewal	Oakfield Agency	9496.00	20	open	Discovery Call	2025-08-30 00:00:00	\N	2025-04-28 00:00:00	10195	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:27.47	2025-07-23 17:02:27.47	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oo1y00f711zwo84sizfe	Infrastructure Review	Lancaster Ltd	9560.00	50	closed_lost	Closed Lost	2024-05-17 00:00:00	\N	2024-04-12 00:00:00	10196	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:27.526	2025-07-23 17:02:27.526	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7oo3e00f911zwlps395ah	Subscription Renewal	Oakfield Agency	5607.00	100	closed_won	Closed Won	2025-07-21 00:00:00	\N	2025-07-05 00:00:00	10197	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:27.579	2025-07-23 17:02:27.579	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdg7oo6c00fb11zw89e4m2w3	Web Redesign	Epsom Ventures	9727.00	100	closed_won	Closed Won	2024-12-03 00:00:00	\N	2024-09-13 00:00:00	10198	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:27.684	2025-07-23 17:02:27.684	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv
cmdg7oo7r00fd11zwpojew4k6	CRM Integration	Lancaster Ltd	10809.00	90	open	Contract Review	2025-09-11 00:00:00	\N	2025-06-08 00:00:00	10199	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:27.735	2025-07-23 17:02:27.735	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7oo9600ff11zwtdyscre3	System Upgrade	Ashworth Consulting	11952.00	50	closed_lost	Closed Lost	2025-03-04 00:00:00	\N	2024-11-06 00:00:00	10200	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:27.787	2025-07-23 17:02:27.787	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7omqy00e311zw4g8q1b88	CRM Integration	Southwick Logistics	8115.00	50	closed_lost	Closed Lost	2025-04-07 00:00:00	\N	2024-12-12 00:00:00	10176	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:25.834	2025-07-23 17:02:25.834	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv
cmdg7omsi00e511zw2h5241ye	System Upgrade	Epsom Ventures	8143.00	100	closed_won	Closed Won	2025-07-21 00:00:00	\N	2025-03-28 00:00:00	10177	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:25.891	2025-07-23 17:02:25.891	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv
cmdg7omu200e711zwcbxev24e	Annual Maintenance	Farringdon Design	8294.00	50	closed_lost	Closed Lost	2023-12-11 00:00:00	\N	2023-09-19 00:00:00	10178	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 17:02:25.946	2025-07-23 17:02:25.946	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv
cmdgbiwwc0046o5c3x7i8mc8n	SEO Optimization	Epsom Ventures	3259.00	50	closed_lost	Closed Lost	2024-06-12 00:00:00	\N	2024-03-04 00:00:00	10225	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:57.517	2025-07-23 18:49:57.517	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbiwy00048o5c3wv6wsm2r	Annual Maintenance	Farringdon Design	3282.00	50	closed_lost	Closed Lost	2024-03-21 00:00:00	\N	2024-02-23 00:00:00	10226	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:57.577	2025-07-23 18:49:57.577	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbiwzn004ao5c3x6zn3suv	Marketing Campaign	Jubilee Networks	6115.00	100	closed_won	Closed Won	2024-02-16 00:00:00	\N	2023-12-29 00:00:00	10227	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:57.636	2025-07-23 18:49:57.636	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbix1z004co5c33ug1ht9t	Consulting Services	Ashworth Consulting	3324.00	50	closed_lost	Closed Lost	2025-04-10 00:00:00	\N	2025-03-07 00:00:00	10228	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:57.72	2025-07-23 18:49:57.72	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbix62004eo5c3sq4hx75n	E-Commerce Integration	Ashworth Consulting	3354.00	100	closed_won	Closed Won	2025-07-20 00:00:00	\N	2025-06-08 00:00:00	10229	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:57.866	2025-07-23 18:49:57.866	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbix7q004go5c37bi3ydd7	Web Redesign	Greenbridge Tech	3444.00	100	closed_won	Closed Won	2024-10-26 00:00:00	\N	2024-09-29 00:00:00	10230	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:57.926	2025-07-23 18:49:57.926	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbix9c004io5c35hd9upzk	Network Overhaul	Oakfield Agency	3448.00	100	closed_won	Closed Won	2025-05-29 00:00:00	\N	2025-02-25 00:00:00	10231	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:57.984	2025-07-23 18:49:57.984	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbixaz004ko5c3bchr0nil	Marketing Campaign	Norfolk Hosting	4751.00	100	closed_won	Closed Won	2023-10-30 00:00:00	\N	2023-09-14 00:00:00	10232	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:58.043	2025-07-23 18:49:58.043	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbixcm004mo5c3vss9l4ra	API Development	Farringdon Design	3471.00	60	open	Proposal Submitted	2025-07-09 00:00:00	\N	2025-06-14 00:00:00	10233	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:58.103	2025-07-23 18:49:58.103	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbixeb004oo5c3k8miodt7	Compliance Audit	Epsom Ventures	3480.00	20	open	Discovery Call	2025-09-29 00:00:00	\N	2025-07-10 00:00:00	10234	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:58.164	2025-07-23 18:49:58.164	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbivrs002uo5c355120jtx	Marketing Campaign	Greenbridge Tech	1000.00	50	closed_lost	Closed Lost	2025-06-05 00:00:00	\N	2025-04-21 00:00:00	10201	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:56.056	2025-07-23 18:49:56.056	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbivua002wo5c3ty34hb5h	Data Security Package	Cavendish Systems	1384.00	50	closed_lost	Closed Lost	2024-06-11 00:00:00	\N	2024-04-19 00:00:00	10202	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:56.147	2025-07-23 18:49:56.147	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbivvx002yo5c3uk611pr3	Helpdesk Setup	Epsom Ventures	1477.00	75	open	Technical Demo	2025-07-16 00:00:00	\N	2025-05-15 00:00:00	10203	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:56.205	2025-07-23 18:49:56.205	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbivxk0030o5c33te9ud2a	Marketing Campaign	Ashworth Consulting	1601.00	60	open	Proposal Submitted	2025-10-04 00:00:00	\N	2025-06-27 00:00:00	10204	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:56.264	2025-07-23 18:49:56.264	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbivz70032o5c3e2s85gsu	Helpdesk Setup	Lancaster Ltd	6588.00	100	closed_won	Closed Won	2023-11-29 00:00:00	\N	2023-11-11 00:00:00	10205	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:56.323	2025-07-23 18:49:56.323	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbiw0w0034o5c3vzmqkhb8	Infrastructure Review	Oakfield Agency	1761.00	60	open	Proposal Submitted	2025-08-17 00:00:00	\N	2025-07-05 00:00:00	10206	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:56.384	2025-07-23 18:49:56.384	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbiw2j0036o5c3832rpwbf	CRM Integration	Bramley Retail	1784.00	50	closed_lost	Closed Lost	2025-02-13 00:00:00	\N	2024-10-29 00:00:00	10207	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:56.443	2025-07-23 18:49:56.443	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbiw450038o5c3yxaus4p7	Web Redesign	Oakfield Agency	1974.00	35	open	Needs Analysis	2025-10-19 00:00:00	\N	2025-07-05 00:00:00	10208	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:56.502	2025-07-23 18:49:56.502	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbiw5u003ao5c3qk4bj9c2	E-Commerce Integration	Southwick Logistics	6324.00	100	closed_won	Closed Won	2023-12-13 00:00:00	\N	2023-08-21 00:00:00	10209	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:56.562	2025-07-23 18:49:56.562	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbiw7h003co5c3n2hz1t18	Subscription Renewal	Milton Solutions	2262.00	20	open	Discovery Call	2025-09-25 00:00:00	\N	2025-06-04 00:00:00	10210	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:56.621	2025-07-23 18:49:56.621	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbiw95003eo5c3jljri8ig	E-Commerce Integration	Dunford Analytics	7707.00	100	closed_won	Closed Won	2024-01-24 00:00:00	\N	2023-11-02 00:00:00	10211	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:56.681	2025-07-23 18:49:56.681	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbiwar003go5c3lja4cfn5	Marketing Campaign	Jubilee Networks	2263.00	20	open	Discovery Call	2025-08-04 00:00:00	\N	2025-07-08 00:00:00	10212	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:56.74	2025-07-23 18:49:56.74	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbiwcf003io5c3tt53p2bc	API Development	Cavendish Systems	2357.00	50	closed_lost	Closed Lost	2024-09-08 00:00:00	\N	2024-07-10 00:00:00	10213	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:56.799	2025-07-23 18:49:56.799	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbiwe1003ko5c324seof20	Marketing Campaign	Norfolk Hosting	2672.00	100	closed_won	Closed Won	2025-02-03 00:00:00	\N	2024-10-28 00:00:00	10214	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:56.858	2025-07-23 18:49:56.858	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbiwfo003mo5c3jrjq5h80	CRM Integration	Milton Solutions	5379.00	50	closed_lost	Closed Lost	2023-09-14 00:00:00	\N	2023-08-27 00:00:00	10215	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:56.916	2025-07-23 18:49:56.916	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbiwhb003oo5c3j326si1m	Infrastructure Review	Jubilee Networks	6716.00	100	closed_won	Closed Won	2023-09-28 00:00:00	\N	2023-09-02 00:00:00	10216	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:56.975	2025-07-23 18:49:56.975	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbiwix003qo5c3qbrn4um5	Marketing Campaign	Bramley Retail	4460.00	100	closed_won	Closed Won	2024-01-26 00:00:00	\N	2024-01-14 00:00:00	10217	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:57.033	2025-07-23 18:49:57.033	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbiwkp003so5c3z1456avx	Infrastructure Review	Southwick Logistics	2832.00	50	closed_lost	Closed Lost	2025-04-25 00:00:00	\N	2025-03-31 00:00:00	10218	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:57.098	2025-07-23 18:49:57.098	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbiwmd003uo5c353huib7z	System Upgrade	Telford Metrics	2840.00	100	closed_won	Closed Won	2024-04-05 00:00:00	\N	2024-03-15 00:00:00	10219	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:57.158	2025-07-23 18:49:57.158	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbiwo0003wo5c3x1fxuaf7	Network Overhaul	Ashworth Consulting	5062.00	100	closed_won	Closed Won	2023-10-24 00:00:00	\N	2023-08-28 00:00:00	10220	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:57.217	2025-07-23 18:49:57.217	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbiwpo003yo5c3vj3tpjv3	Subscription Renewal	Quayside Legal	2886.00	50	closed_lost	Closed Lost	2024-02-04 00:00:00	\N	2023-11-06 00:00:00	10221	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:57.276	2025-07-23 18:49:57.276	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbiwrb0040o5c3s5qchcp7	Annual Maintenance	Jubilee Networks	2913.00	50	closed_lost	Closed Lost	2025-02-25 00:00:00	\N	2025-02-02 00:00:00	10222	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:57.336	2025-07-23 18:49:57.336	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbiwsy0042o5c3bab3b4ak	Data Security Package	Milton Solutions	3101.00	20	open	Discovery Call	2025-07-24 00:00:00	\N	2025-04-30 00:00:00	10223	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:57.394	2025-07-23 18:49:57.394	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbiwuq0044o5c3mm6mf98j	Subscription Renewal	Dunford Analytics	3238.00	50	closed_lost	Closed Lost	2024-02-11 00:00:00	\N	2023-11-28 00:00:00	10224	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:57.459	2025-07-23 18:49:57.459	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbixg1004qo5c30zq2dx60	Consulting Services	Penrith Systems	3518.00	20	open	Discovery Call	2025-07-31 00:00:00	\N	2025-07-10 00:00:00	10235	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:58.225	2025-07-23 18:49:58.225	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbixhn004so5c356mfzn14	Data Security Package	Farringdon Design	3622.00	100	closed_won	Closed Won	2025-01-18 00:00:00	\N	2024-11-06 00:00:00	10236	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:58.283	2025-07-23 18:49:58.283	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbixja004uo5c336o4umvx	Network Overhaul	Bramley Retail	3624.00	90	open	Contract Review	2025-09-02 00:00:00	\N	2025-07-02 00:00:00	10237	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:58.342	2025-07-23 18:49:58.342	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbixkx004wo5c3qs5rnmpm	Marketing Campaign	Norfolk Hosting	6116.00	50	closed_lost	Closed Lost	2023-12-03 00:00:00	\N	2023-10-02 00:00:00	10238	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:58.401	2025-07-23 18:49:58.401	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbixmj004yo5c3qnyl0xff	User Onboarding Setup	Oakfield Agency	3794.00	100	closed_won	Closed Won	2024-02-07 00:00:00	\N	2023-12-13 00:00:00	10239	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:58.459	2025-07-23 18:49:58.459	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbixo60050o5c38cwdueny	Web Redesign	Inverness Data	6262.00	100	closed_won	Closed Won	2023-12-04 00:00:00	\N	2023-08-18 00:00:00	10240	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:58.519	2025-07-23 18:49:58.519	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbixpw0052o5c3y29q64kq	Cloud Backup	Penrith Systems	3906.00	50	closed_lost	Closed Lost	2024-06-01 00:00:00	\N	2024-03-22 00:00:00	10241	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:58.58	2025-07-23 18:49:58.58	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbixrj0054o5c3op8duf2l	Marketing Campaign	Jubilee Networks	3943.00	60	open	Proposal Submitted	2025-09-23 00:00:00	\N	2025-05-13 00:00:00	10242	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:58.639	2025-07-23 18:49:58.639	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbixt60056o5c3sfw55xij	Sales Training	Bramley Retail	4086.00	90	open	Contract Review	2025-07-27 00:00:00	\N	2025-07-04 00:00:00	10243	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:58.698	2025-07-23 18:49:58.698	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbixuu0058o5c3yu6e4nku	E-Commerce Integration	Milton Solutions	4421.00	50	closed_lost	Closed Lost	2023-12-24 00:00:00	\N	2023-11-02 00:00:00	10244	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:58.758	2025-07-23 18:49:58.758	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbixwi005ao5c35lmlsn6a	Compliance Audit	Harrow IT Services	4202.00	100	closed_won	Closed Won	2024-08-18 00:00:00	\N	2024-08-05 00:00:00	10245	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:58.818	2025-07-23 18:49:58.818	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbixy6005co5c3yytx5fo0	Marketing Campaign	Quayside Legal	4221.00	50	closed_lost	Closed Lost	2025-02-16 00:00:00	\N	2025-01-16 00:00:00	10246	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:58.878	2025-07-23 18:49:58.878	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbixzs005eo5c3iyx74d1g	CRM Integration	Jubilee Networks	9040.00	50	closed_lost	Closed Lost	2023-12-26 00:00:00	\N	2023-10-31 00:00:00	10247	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:58.936	2025-07-23 18:49:58.936	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbiy1f005go5c3svl70qbj	Marketing Campaign	Quayside Legal	4262.00	100	closed_won	Closed Won	2023-12-28 00:00:00	\N	2023-11-13 00:00:00	10248	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:58.995	2025-07-23 18:49:58.995	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbiy31005io5c3560ef26b	E-Commerce Integration	Greenbridge Tech	4275.00	100	closed_won	Closed Won	2024-01-09 00:00:00	\N	2023-12-25 00:00:00	10249	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:59.053	2025-07-23 18:49:59.053	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbiy4n005ko5c3lb3fjj3y	CRM Integration	Epsom Ventures	4291.00	50	closed_lost	Closed Lost	2023-10-22 00:00:00	\N	2023-08-03 00:00:00	10250	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:59.112	2025-07-23 18:49:59.112	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbiy6c005mo5c3gr6cnq7b	SEO Optimization	Oakfield Agency	4293.00	20	open	Discovery Call	2025-08-09 00:00:00	\N	2025-05-08 00:00:00	10001	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:59.172	2025-07-23 18:49:59.172	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbiy83005oo5c3cznhanis	Compliance Audit	Farringdon Design	4318.00	50	closed_lost	Closed Lost	2024-01-03 00:00:00	\N	2023-10-05 00:00:00	10002	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:59.235	2025-07-23 18:49:59.235	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbiy9q005qo5c38z5w3yvl	Network Overhaul	Inverness Data	4321.00	100	closed_won	Closed Won	2023-11-07 00:00:00	\N	2023-08-02 00:00:00	10003	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:59.295	2025-07-23 18:49:59.295	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbiybg005so5c33cduvrbp	Subscription Renewal	Bramley Retail	4341.00	50	closed_lost	Closed Lost	2024-07-14 00:00:00	\N	2024-05-01 00:00:00	10004	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:59.357	2025-07-23 18:49:59.357	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbiyd3005uo5c39cnj8wi1	Cloud Backup	Bramley Retail	4395.00	50	closed_lost	Closed Lost	2023-10-19 00:00:00	\N	2023-08-28 00:00:00	10005	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:59.415	2025-07-23 18:49:59.415	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbiyeq005wo5c3catnw6se	Annual Maintenance	Penrith Systems	5708.00	100	closed_won	Closed Won	2024-01-17 00:00:00	\N	2023-11-28 00:00:00	10006	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:59.474	2025-07-23 18:49:59.474	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbiyh4005yo5c39895b395	Web Redesign	Oakfield Agency	6203.00	100	closed_won	Closed Won	2024-02-25 00:00:00	\N	2023-11-28 00:00:00	10007	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:59.56	2025-07-23 18:49:59.56	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbiyiq0060o5c3awj7u2pg	Subscription Renewal	Ashworth Consulting	4438.00	100	closed_won	Closed Won	2024-05-10 00:00:00	\N	2024-01-26 00:00:00	10008	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:59.619	2025-07-23 18:49:59.619	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbiykd0062o5c3pkmr90kx	Sales Training	Harrow IT Services	4498.00	50	closed_lost	Closed Lost	2025-02-20 00:00:00	\N	2024-12-27 00:00:00	10009	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:59.677	2025-07-23 18:49:59.677	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbiylz0064o5c3kfgkjbo3	Marketing Campaign	Inverness Data	4500.00	20	open	Discovery Call	2025-08-10 00:00:00	\N	2025-05-18 00:00:00	10010	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:59.735	2025-07-23 18:49:59.735	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbiynl0066o5c3ht17vquo	System Upgrade	Kingsway Group	1756.00	100	closed_won	Closed Won	2024-07-02 00:00:00	\N	2024-05-07 00:00:00	10011	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:59.793	2025-07-23 18:49:59.793	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbiyp80068o5c3n1v1bfni	CRM Integration	Jubilee Networks	4512.00	100	closed_won	Closed Won	2025-07-12 00:00:00	\N	2025-06-15 00:00:00	10012	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:59.853	2025-07-23 18:49:59.853	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbiyqu006ao5c3mtyofqxf	Consulting Services	Southwick Logistics	4514.00	100	closed_won	Closed Won	2023-12-28 00:00:00	\N	2023-11-15 00:00:00	10013	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:59.911	2025-07-23 18:49:59.911	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbiysn006co5c37vc4kyzr	Helpdesk Setup	Greenbridge Tech	4575.00	100	closed_won	Closed Won	2024-10-15 00:00:00	\N	2024-07-19 00:00:00	10014	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:49:59.976	2025-07-23 18:49:59.976	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbiyug006eo5c3n2vthzg4	SEO Optimization	Jubilee Networks	4586.00	50	closed_lost	Closed Lost	2023-12-17 00:00:00	\N	2023-09-12 00:00:00	10015	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:00.04	2025-07-23 18:50:00.04	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbiz2h006go5c3fookbx1j	Consulting Services	Telford Metrics	4595.00	50	closed_lost	Closed Lost	2025-06-20 00:00:00	\N	2025-03-25 00:00:00	10016	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:00.102	2025-07-23 18:50:00.102	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbiz5n006io5c3u7jkrjr0	Subscription Renewal	Dunford Analytics	7394.00	100	closed_won	Closed Won	2024-02-14 00:00:00	\N	2024-01-07 00:00:00	10017	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:00.444	2025-07-23 18:50:00.444	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbiz79006ko5c3uwtnyg67	Network Overhaul	Milton Solutions	4636.00	100	closed_won	Closed Won	2023-11-02 00:00:00	\N	2023-09-30 00:00:00	10018	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:00.502	2025-07-23 18:50:00.502	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbiz8v006mo5c3q2bu2uzg	CRM Integration	Jubilee Networks	4637.00	90	open	Contract Review	2025-10-11 00:00:00	\N	2025-06-13 00:00:00	10019	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:00.559	2025-07-23 18:50:00.559	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbizag006oo5c3ulihs17n	Cloud Backup	Norfolk Hosting	4702.00	50	closed_lost	Closed Lost	2025-07-19 00:00:00	\N	2025-05-17 00:00:00	10020	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:00.617	2025-07-23 18:50:00.617	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbizc1006qo5c3q6px1d7t	API Development	Jubilee Networks	4710.00	100	closed_won	Closed Won	2024-09-01 00:00:00	\N	2024-07-02 00:00:00	10021	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:00.673	2025-07-23 18:50:00.673	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbizdm006so5c3ede4mcaw	SEO Optimization	Kingsway Group	4722.00	75	open	Technical Demo	2025-07-29 00:00:00	\N	2025-05-28 00:00:00	10022	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:00.73	2025-07-23 18:50:00.73	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbizf8006uo5c3xs3mw34v	Cloud Backup	Bramley Retail	5217.00	100	closed_won	Closed Won	2024-03-01 00:00:00	\N	2024-01-28 00:00:00	10023	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:00.788	2025-07-23 18:50:00.788	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbizgs006wo5c3ukv77igh	System Upgrade	Jubilee Networks	4752.00	50	closed_lost	Closed Lost	2024-04-12 00:00:00	\N	2024-01-09 00:00:00	10024	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:00.844	2025-07-23 18:50:00.844	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbizib006yo5c3p7nv7bcr	Annual Maintenance	Oakfield Agency	6050.00	50	closed_lost	Closed Lost	2024-03-05 00:00:00	\N	2024-02-20 00:00:00	10025	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:00.9	2025-07-23 18:50:00.9	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbizjx0070o5c3v8ahwuty	Consulting Services	Bramley Retail	4777.00	50	closed_lost	Closed Lost	2025-07-01 00:00:00	\N	2025-04-01 00:00:00	10026	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:00.958	2025-07-23 18:50:00.958	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbizlh0072o5c3fsh4a7lv	Marketing Campaign	Cavendish Systems	4791.00	50	closed_lost	Closed Lost	2025-05-18 00:00:00	\N	2025-03-06 00:00:00	10027	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:01.013	2025-07-23 18:50:01.013	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbizn60074o5c3owrd5jl6	SEO Optimization	Milton Solutions	4817.00	50	closed_lost	Closed Lost	2025-04-10 00:00:00	\N	2025-02-19 00:00:00	10028	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:01.074	2025-07-23 18:50:01.074	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbizor0076o5c3nkg0420r	API Development	Greenbridge Tech	5137.00	100	closed_won	Closed Won	2024-07-12 00:00:00	\N	2024-03-26 00:00:00	10029	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:01.131	2025-07-23 18:50:01.131	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbizqe0078o5c39923nu4k	SEO Optimization	Milton Solutions	4930.00	100	closed_won	Closed Won	2024-10-09 00:00:00	\N	2024-07-25 00:00:00	10030	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:01.19	2025-07-23 18:50:01.19	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbizrz007ao5c329qh03s3	E-Commerce Integration	Kingsway Group	4601.00	100	closed_won	Closed Won	2024-03-26 00:00:00	\N	2024-02-08 00:00:00	10031	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:01.247	2025-07-23 18:50:01.247	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbiztj007co5c3h53hmqjj	Infrastructure Review	Ashworth Consulting	4948.00	100	closed_won	Closed Won	2023-09-30 00:00:00	\N	2023-09-01 00:00:00	10032	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:01.303	2025-07-23 18:50:01.303	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbizv3007eo5c3vly11adl	User Onboarding Setup	Kingsway Group	4995.00	100	closed_won	Closed Won	2023-12-16 00:00:00	\N	2023-12-08 00:00:00	10033	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:01.359	2025-07-23 18:50:01.359	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbizwm007go5c333zlnzg4	System Upgrade	Dunford Analytics	5000.00	50	closed_lost	Closed Lost	2024-11-17 00:00:00	\N	2024-11-03 00:00:00	10034	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:01.414	2025-07-23 18:50:01.414	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbizy6007io5c3qa2qjkuw	System Upgrade	Penrith Systems	6719.00	100	closed_won	Closed Won	2024-04-19 00:00:00	\N	2024-02-26 00:00:00	10035	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:01.471	2025-07-23 18:50:01.471	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbizzs007ko5c300lr79oo	Annual Maintenance	Greenbridge Tech	3897.00	100	closed_won	Closed Won	2024-05-18 00:00:00	\N	2024-04-05 00:00:00	10036	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:01.529	2025-07-23 18:50:01.529	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj01i007mo5c34t8i6ano	E-Commerce Integration	Quayside Legal	5067.00	100	closed_won	Closed Won	2025-06-14 00:00:00	\N	2025-05-07 00:00:00	10037	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:01.59	2025-07-23 18:50:01.59	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj036007oo5c317cgkynd	Cloud Backup	Oakfield Agency	8840.00	50	closed_lost	Closed Lost	2024-06-18 00:00:00	\N	2024-04-24 00:00:00	10038	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:01.651	2025-07-23 18:50:01.651	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj04p007qo5c38fvtmvsf	Consulting Services	Quayside Legal	5100.00	50	closed_lost	Closed Lost	2025-01-30 00:00:00	\N	2024-10-26 00:00:00	10039	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:01.706	2025-07-23 18:50:01.706	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj069007so5c3txwt88ss	System Upgrade	Bramley Retail	5120.00	100	closed_won	Closed Won	2024-01-27 00:00:00	\N	2023-10-02 00:00:00	10040	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:01.761	2025-07-23 18:50:01.761	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj081007uo5c34aqde4qr	CRM Integration	Lancaster Ltd	5124.00	50	closed_lost	Closed Lost	2024-06-19 00:00:00	\N	2024-03-19 00:00:00	10041	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:01.825	2025-07-23 18:50:01.825	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj09k007wo5c3ot4eb4g4	Web Redesign	Greenbridge Tech	6367.00	100	closed_won	Closed Won	2024-07-06 00:00:00	\N	2024-05-09 00:00:00	10042	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:01.881	2025-07-23 18:50:01.881	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj0b5007yo5c3f3jcxh6e	Compliance Audit	Inverness Data	2076.00	100	closed_won	Closed Won	2024-08-11 00:00:00	\N	2024-04-17 00:00:00	10043	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:01.937	2025-07-23 18:50:01.937	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj0co0080o5c3jvocz4xf	Subscription Renewal	Norfolk Hosting	5169.00	50	closed_lost	Closed Lost	2023-12-03 00:00:00	\N	2023-10-04 00:00:00	10044	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:01.993	2025-07-23 18:50:01.993	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj0e90082o5c3035mqwpk	System Upgrade	Ashworth Consulting	5745.00	100	closed_won	Closed Won	2024-07-10 00:00:00	\N	2024-05-22 00:00:00	10045	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:02.049	2025-07-23 18:50:02.049	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj0fy0084o5c3nf5ov69f	Subscription Renewal	Bramley Retail	5205.00	50	closed_lost	Closed Lost	2025-07-06 00:00:00	\N	2025-06-15 00:00:00	10046	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:02.11	2025-07-23 18:50:02.11	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj0hh0086o5c32kqbo0a1	System Upgrade	Bramley Retail	5205.00	100	closed_won	Closed Won	2023-10-06 00:00:00	\N	2023-08-10 00:00:00	10047	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:02.166	2025-07-23 18:50:02.166	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj0je0088o5c3drnh2ysw	Network Overhaul	Greenbridge Tech	6735.00	50	closed_lost	Closed Lost	2024-08-01 00:00:00	\N	2024-04-16 00:00:00	10048	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:02.235	2025-07-23 18:50:02.235	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj0l5008ao5c33ehcx5i5	System Upgrade	Richmond Software	5222.00	35	open	Needs Analysis	2025-08-07 00:00:00	\N	2025-07-07 00:00:00	10049	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:02.297	2025-07-23 18:50:02.297	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj0mp008co5c39ktspxxn	Infrastructure Review	Dunford Analytics	5231.00	50	closed_lost	Closed Lost	2024-11-16 00:00:00	\N	2024-08-30 00:00:00	10050	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:02.353	2025-07-23 18:50:02.353	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj0o9008eo5c3q8xo9wab	Compliance Audit	Southwick Logistics	5256.00	20	open	Discovery Call	2025-08-18 00:00:00	\N	2025-06-09 00:00:00	10051	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:02.409	2025-07-23 18:50:02.409	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj0pt008go5c3x0g5540f	Cloud Backup	Greenbridge Tech	5280.00	50	closed_lost	Closed Lost	2024-10-30 00:00:00	\N	2024-09-23 00:00:00	10052	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:02.465	2025-07-23 18:50:02.465	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj0rd008io5c32n73idaw	E-Commerce Integration	Quayside Legal	5355.00	50	closed_lost	Closed Lost	2025-06-18 00:00:00	\N	2025-03-24 00:00:00	10053	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:02.521	2025-07-23 18:50:02.521	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj0sx008ko5c39kjmje3n	CRM Integration	Milton Solutions	5357.00	35	open	Needs Analysis	2025-09-13 00:00:00	\N	2025-05-08 00:00:00	10054	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:02.577	2025-07-23 18:50:02.577	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj0ug008mo5c3emp8oc8z	Network Overhaul	Cavendish Systems	4101.00	50	closed_lost	Closed Lost	2024-10-07 00:00:00	\N	2024-08-10 00:00:00	10055	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:02.632	2025-07-23 18:50:02.632	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj0w2008oo5c3ofuuynwj	Infrastructure Review	Epsom Ventures	5395.00	100	closed_won	Closed Won	2025-06-15 00:00:00	\N	2025-05-23 00:00:00	10056	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:02.69	2025-07-23 18:50:02.69	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj0xn008qo5c34p4fsjgj	E-Commerce Integration	Southwick Logistics	4855.00	100	closed_won	Closed Won	2024-09-16 00:00:00	\N	2024-08-30 00:00:00	10057	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:02.747	2025-07-23 18:50:02.747	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj0z6008so5c3c1t8ajk0	Product Expansion	Dunford Analytics	5477.00	75	open	Technical Demo	2025-09-19 00:00:00	\N	2025-07-12 00:00:00	10058	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:02.802	2025-07-23 18:50:02.802	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj10p008uo5c3kd5defg9	CRM Integration	Inverness Data	5489.00	20	open	Discovery Call	2025-08-07 00:00:00	\N	2025-05-13 00:00:00	10059	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:02.858	2025-07-23 18:50:02.858	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj129008wo5c3013ziqtp	Cloud Backup	Lancaster Ltd	6268.00	100	closed_won	Closed Won	2024-10-17 00:00:00	\N	2024-08-17 00:00:00	10060	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:02.914	2025-07-23 18:50:02.914	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj13s008yo5c3ul6uatpd	Product Expansion	Milton Solutions	5518.00	100	closed_won	Closed Won	2025-07-16 00:00:00	\N	2025-06-15 00:00:00	10061	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:02.968	2025-07-23 18:50:02.968	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj15d0090o5c3yqscsft2	Helpdesk Setup	Dunford Analytics	5526.00	100	closed_won	Closed Won	2024-12-10 00:00:00	\N	2024-09-19 00:00:00	10062	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:03.026	2025-07-23 18:50:03.026	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj6q500e2o5c3x3n0elot	User Onboarding Setup	Ashworth Consulting	7321.00	35	open	Needs Analysis	2025-08-17 00:00:00	\N	2025-07-07 00:00:00	10153	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:10.254	2025-07-23 18:50:10.254	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj6rp00e4o5c3v61r4e3l	Marketing Campaign	Cavendish Systems	7329.00	50	closed_lost	Closed Lost	2025-03-05 00:00:00	\N	2024-11-09 00:00:00	10154	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:10.309	2025-07-23 18:50:10.309	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj6ta00e6o5c3xmttx82x	Web Redesign	Dunford Analytics	7374.00	100	closed_won	Closed Won	2023-11-22 00:00:00	\N	2023-11-12 00:00:00	10155	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:10.366	2025-07-23 18:50:10.366	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj6uv00e8o5c3o19ywg38	Sales Training	Dunford Analytics	7383.00	50	closed_lost	Closed Lost	2024-01-10 00:00:00	\N	2023-12-10 00:00:00	10156	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:10.423	2025-07-23 18:50:10.423	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj6xw00eao5c3xrgexnz7	SEO Optimization	Lancaster Ltd	8350.00	90	open	Contract Review	2025-08-26 00:00:00	\N	2025-06-07 00:00:00	10157	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:10.532	2025-07-23 18:50:10.532	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj6zm00eco5c3wel3i3eb	Cloud Backup	Oakfield Agency	7411.00	100	closed_won	Closed Won	2024-09-29 00:00:00	\N	2024-06-22 00:00:00	10158	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:10.594	2025-07-23 18:50:10.594	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj71500eeo5c3vq476cep	Subscription Renewal	Quayside Legal	7450.00	50	closed_lost	Closed Lost	2025-04-09 00:00:00	\N	2025-02-19 00:00:00	10159	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:10.649	2025-07-23 18:50:10.649	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj72o00ego5c3ot7xf6lk	Sales Training	Bramley Retail	7522.00	100	closed_won	Closed Won	2024-06-01 00:00:00	\N	2024-03-06 00:00:00	10160	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:10.704	2025-07-23 18:50:10.704	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj74900eio5c3p1op2wt2	Data Security Package	Inverness Data	7541.00	100	closed_won	Closed Won	2024-04-23 00:00:00	\N	2024-01-07 00:00:00	10161	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:10.761	2025-07-23 18:50:10.761	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj75t00eko5c3fkhdl1l8	Sales Training	Telford Metrics	7610.00	35	open	Needs Analysis	2025-09-11 00:00:00	\N	2025-06-08 00:00:00	10162	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:10.817	2025-07-23 18:50:10.817	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj77c00emo5c35kutnevm	API Development	Ashworth Consulting	7662.00	35	open	Needs Analysis	2025-09-19 00:00:00	\N	2025-05-07 00:00:00	10163	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:10.872	2025-07-23 18:50:10.872	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj78x00eoo5c3dv7ckg08	Sales Training	Inverness Data	7666.00	100	closed_won	Closed Won	2025-07-16 00:00:00	\N	2025-07-02 00:00:00	10164	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:10.929	2025-07-23 18:50:10.929	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj7af00eqo5c3w4julh8x	E-Commerce Integration	Bramley Retail	9602.00	100	closed_won	Closed Won	2025-07-18 00:00:00	\N	2025-07-16 00:00:00	10165	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:10.983	2025-07-23 18:50:10.983	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj7c000eso5c3n4fegjwj	Data Security Package	Dunford Analytics	7709.00	50	closed_lost	Closed Lost	2024-05-20 00:00:00	\N	2024-04-10 00:00:00	10166	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:11.04	2025-07-23 18:50:11.04	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj7dj00euo5c3ellmfhtr	System Upgrade	Dunford Analytics	7742.00	50	closed_lost	Closed Lost	2024-07-07 00:00:00	\N	2024-04-21 00:00:00	10167	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:11.095	2025-07-23 18:50:11.095	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj7f200ewo5c3wu51qqmu	Cloud Backup	Lancaster Ltd	7749.00	100	closed_won	Closed Won	2024-10-24 00:00:00	\N	2024-07-02 00:00:00	10168	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:11.151	2025-07-23 18:50:11.151	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj7go00eyo5c3fbgndy8u	System Upgrade	Harrow IT Services	7760.00	50	closed_lost	Closed Lost	2025-02-21 00:00:00	\N	2025-01-03 00:00:00	10169	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:11.208	2025-07-23 18:50:11.208	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj7i600f0o5c39vqqrirq	E-Commerce Integration	Telford Metrics	7775.00	100	closed_won	Closed Won	2025-07-20 00:00:00	\N	2025-05-14 00:00:00	10170	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:11.263	2025-07-23 18:50:11.263	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj7jp00f2o5c3man1lkpw	Annual Maintenance	Harrow IT Services	7959.00	50	closed_lost	Closed Lost	2024-04-10 00:00:00	\N	2024-01-22 00:00:00	10171	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:11.317	2025-07-23 18:50:11.317	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj7l800f4o5c3jed9gom7	API Development	Lancaster Ltd	7974.00	20	open	Discovery Call	2025-08-18 00:00:00	\N	2025-06-13 00:00:00	10172	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:11.373	2025-07-23 18:50:11.373	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj7mr00f6o5c3xgtfwt00	Subscription Renewal	Southwick Logistics	8057.00	50	closed_lost	Closed Lost	2025-05-07 00:00:00	\N	2025-01-14 00:00:00	10173	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:11.428	2025-07-23 18:50:11.428	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj7oc00f8o5c3si1ydn57	Marketing Campaign	Inverness Data	8076.00	50	closed_lost	Closed Lost	2024-05-23 00:00:00	\N	2024-02-01 00:00:00	10174	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:11.484	2025-07-23 18:50:11.484	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj7pw00fao5c34e3z47o0	System Upgrade	Quayside Legal	8084.00	50	closed_lost	Closed Lost	2025-07-13 00:00:00	\N	2025-06-21 00:00:00	10175	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:11.54	2025-07-23 18:50:11.54	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj7rf00fco5c3kdlijqiu	CRM Integration	Southwick Logistics	8115.00	50	closed_lost	Closed Lost	2025-04-07 00:00:00	\N	2024-12-12 00:00:00	10176	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:11.596	2025-07-23 18:50:11.596	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj16y0092o5c364kffaj3	Data Warehousing	Farringdon Design	6132.00	100	closed_won	Closed Won	2024-11-03 00:00:00	\N	2024-10-15 00:00:00	10063	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:03.083	2025-07-23 18:50:03.083	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj18m0094o5c3itq65usj	Compliance Audit	Milton Solutions	2868.00	50	closed_lost	Closed Lost	2024-11-14 00:00:00	\N	2024-08-03 00:00:00	10064	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:03.142	2025-07-23 18:50:03.142	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj1a90096o5c3xgkwlfdf	Consulting Services	Southwick Logistics	5554.00	50	closed_lost	Closed Lost	2024-12-06 00:00:00	\N	2024-09-17 00:00:00	10065	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:03.202	2025-07-23 18:50:03.202	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj1c20098o5c3g1rm1trd	Helpdesk Setup	Lancaster Ltd	7077.00	100	closed_won	Closed Won	2024-11-15 00:00:00	\N	2024-08-09 00:00:00	10066	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:03.266	2025-07-23 18:50:03.266	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj1e1009ao5c3l9cijxw4	Helpdesk Setup	Ashworth Consulting	5578.00	50	closed_lost	Closed Lost	2025-01-24 00:00:00	\N	2025-01-01 00:00:00	10067	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:03.337	2025-07-23 18:50:03.337	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj1fn009co5c39xml1jq6	Cloud Backup	Lancaster Ltd	5583.00	100	closed_won	Closed Won	2025-07-09 00:00:00	\N	2025-05-09 00:00:00	10068	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:03.396	2025-07-23 18:50:03.396	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj1he009eo5c35sw98w0n	Consulting Services	Jubilee Networks	5604.00	50	closed_lost	Closed Lost	2024-10-30 00:00:00	\N	2024-07-21 00:00:00	10069	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:03.458	2025-07-23 18:50:03.458	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj1j0009go5c3vr2c3cux	Data Security Package	Telford Metrics	2753.00	100	closed_won	Closed Won	2024-10-09 00:00:00	\N	2024-09-06 00:00:00	10070	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:03.516	2025-07-23 18:50:03.516	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj1m3009io5c3cbyn4amp	Marketing Campaign	Southwick Logistics	5608.00	100	closed_won	Closed Won	2024-11-25 00:00:00	\N	2024-08-08 00:00:00	10071	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:03.627	2025-07-23 18:50:03.627	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj1oh009ko5c33w82v3vs	Product Expansion	Jubilee Networks	5611.00	100	closed_won	Closed Won	2024-09-10 00:00:00	\N	2024-05-24 00:00:00	10072	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:03.714	2025-07-23 18:50:03.714	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj1tv009mo5c3v49put5n	CRM Integration	Dunford Analytics	5638.00	50	closed_lost	Closed Lost	2024-10-27 00:00:00	\N	2024-10-05 00:00:00	10073	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:03.907	2025-07-23 18:50:03.907	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj23j009oo5c35vjpjsz7	Network Overhaul	Quayside Legal	5665.00	100	closed_won	Closed Won	2024-08-17 00:00:00	\N	2024-06-01 00:00:00	10074	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:04.255	2025-07-23 18:50:04.255	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj26u009qo5c3mvxtbzod	Web Redesign	Farringdon Design	5080.00	100	closed_won	Closed Won	2024-11-17 00:00:00	\N	2024-10-25 00:00:00	10075	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:04.375	2025-07-23 18:50:04.375	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj2hf009so5c35c7n85k8	API Development	Farringdon Design	5699.00	20	open	Discovery Call	2025-08-01 00:00:00	\N	2025-05-14 00:00:00	10076	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:04.755	2025-07-23 18:50:04.755	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj2nm009uo5c3kqu64ndh	Cloud Backup	Lancaster Ltd	5706.00	100	closed_won	Closed Won	2025-07-17 00:00:00	\N	2025-03-24 00:00:00	10077	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:04.979	2025-07-23 18:50:04.979	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj2qc009wo5c3ywjb74qc	CRM Integration	Bramley Retail	5575.00	50	closed_lost	Closed Lost	2025-01-11 00:00:00	\N	2024-10-09 00:00:00	10078	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:05.076	2025-07-23 18:50:05.076	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj2s1009yo5c320dxmspv	Data Security Package	Jubilee Networks	5673.00	50	closed_lost	Closed Lost	2025-01-15 00:00:00	\N	2024-09-25 00:00:00	10079	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:05.138	2025-07-23 18:50:05.138	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj2ts00a0o5c35iafm8x8	Consulting Services	Southwick Logistics	5749.00	35	open	Needs Analysis	2025-09-25 00:00:00	\N	2025-06-11 00:00:00	10080	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:05.2	2025-07-23 18:50:05.2	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj2vn00a2o5c324bq28rn	API Development	Cavendish Systems	5757.00	100	closed_won	Closed Won	2024-07-12 00:00:00	\N	2024-05-02 00:00:00	10081	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:05.267	2025-07-23 18:50:05.267	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj2xf00a4o5c3qzawuzsn	Consulting Services	Farringdon Design	5776.00	75	open	Technical Demo	2025-08-20 00:00:00	\N	2025-06-04 00:00:00	10082	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:05.331	2025-07-23 18:50:05.331	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj2z600a6o5c3kt6kgpdz	Sales Training	Telford Metrics	5778.00	50	closed_lost	Closed Lost	2024-04-05 00:00:00	\N	2023-12-29 00:00:00	10083	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:05.395	2025-07-23 18:50:05.395	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj30x00a8o5c3zxfpdj5k	Helpdesk Setup	Dunford Analytics	5807.00	50	closed_lost	Closed Lost	2023-12-14 00:00:00	\N	2023-08-20 00:00:00	10084	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:05.457	2025-07-23 18:50:05.457	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj32n00aao5c3dba7w5p3	User Onboarding Setup	Bramley Retail	5944.00	50	closed_lost	Closed Lost	2025-03-19 00:00:00	\N	2025-02-28 00:00:00	10085	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:05.52	2025-07-23 18:50:05.52	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj35000aco5c3r2emcxxe	Data Security Package	Cavendish Systems	5869.00	50	closed_lost	Closed Lost	2024-11-25 00:00:00	\N	2024-09-19 00:00:00	10086	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:05.604	2025-07-23 18:50:05.604	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj37h00aeo5c3uarous3c	Web Redesign	Harrow IT Services	5870.00	100	closed_won	Closed Won	2025-03-14 00:00:00	\N	2025-01-05 00:00:00	10087	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:05.694	2025-07-23 18:50:05.694	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj3a900ago5c36t2f6pga	API Development	Quayside Legal	6569.00	100	closed_won	Closed Won	2025-04-02 00:00:00	\N	2025-01-20 00:00:00	10088	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:05.793	2025-07-23 18:50:05.793	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj3cu00aio5c3yxrs8wyu	Network Overhaul	Harrow IT Services	4773.00	100	closed_won	Closed Won	2025-04-17 00:00:00	\N	2025-04-02 00:00:00	10089	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:05.887	2025-07-23 18:50:05.887	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj3gr00ako5c3dhf0gdf2	Product Expansion	Greenbridge Tech	6077.00	100	closed_won	Closed Won	2023-11-28 00:00:00	\N	2023-10-12 00:00:00	10090	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:06.028	2025-07-23 18:50:06.028	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj3jc00amo5c30actetr6	Data Security Package	Inverness Data	7295.00	100	closed_won	Closed Won	2024-12-15 00:00:00	\N	2024-10-16 00:00:00	10091	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:06.121	2025-07-23 18:50:06.121	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj3mn00aoo5c3rxoeklbv	Consulting Services	Oakfield Agency	5844.00	100	closed_won	Closed Won	2025-05-02 00:00:00	\N	2025-01-07 00:00:00	10092	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:06.24	2025-07-23 18:50:06.24	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj3p700aqo5c3b1he70q8	Infrastructure Review	Jubilee Networks	6127.00	35	open	Needs Analysis	2025-10-09 00:00:00	\N	2025-05-04 00:00:00	10093	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:06.331	2025-07-23 18:50:06.331	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj3rh00aso5c3dz9v9f7z	Network Overhaul	Kingsway Group	2681.00	100	closed_won	Closed Won	2025-05-19 00:00:00	\N	2025-02-11 00:00:00	10094	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:06.413	2025-07-23 18:50:06.413	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj3t700auo5c3u4nu7shn	User Onboarding Setup	Lancaster Ltd	6172.00	100	closed_won	Closed Won	2024-12-20 00:00:00	\N	2024-10-16 00:00:00	10095	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:06.476	2025-07-23 18:50:06.476	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj3uy00awo5c3slbkjwps	Helpdesk Setup	Bramley Retail	6187.00	100	closed_won	Closed Won	2024-12-21 00:00:00	\N	2024-11-21 00:00:00	10096	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:06.538	2025-07-23 18:50:06.538	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj3wr00ayo5c3ifkk6of7	Marketing Campaign	Farringdon Design	6569.00	100	closed_won	Closed Won	2025-01-09 00:00:00	\N	2024-09-28 00:00:00	10097	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:06.603	2025-07-23 18:50:06.603	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj3yh00b0o5c3mittxwgb	Compliance Audit	Telford Metrics	6228.00	50	closed_lost	Closed Lost	2025-04-10 00:00:00	\N	2025-03-30 00:00:00	10098	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:06.665	2025-07-23 18:50:06.665	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj40700b2o5c3jll3xky2	Network Overhaul	Oakfield Agency	6255.00	100	closed_won	Closed Won	2025-01-04 00:00:00	\N	2024-09-26 00:00:00	10099	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:06.728	2025-07-23 18:50:06.728	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj41y00b4o5c3awnu45f3	Annual Maintenance	Jubilee Networks	6258.00	100	closed_won	Closed Won	2024-01-19 00:00:00	\N	2023-11-28 00:00:00	10100	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:06.79	2025-07-23 18:50:06.79	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj43o00b6o5c31q7r79jt	SEO Optimization	Ashworth Consulting	4939.00	50	closed_lost	Closed Lost	2025-05-26 00:00:00	\N	2025-02-01 00:00:00	10101	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:06.853	2025-07-23 18:50:06.853	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj45e00b8o5c3opjfx12l	Annual Maintenance	Epsom Ventures	4232.00	50	closed_lost	Closed Lost	2025-06-13 00:00:00	\N	2025-03-29 00:00:00	10102	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:06.915	2025-07-23 18:50:06.915	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj47800bao5c3i1de9ivy	Consulting Services	Quayside Legal	6320.00	100	closed_won	Closed Won	2025-06-23 00:00:00	\N	2025-04-03 00:00:00	10103	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:06.98	2025-07-23 18:50:06.98	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj48x00bco5c3k73b2nhc	CRM Integration	Jubilee Networks	7186.00	100	closed_won	Closed Won	2025-01-20 00:00:00	\N	2024-11-24 00:00:00	10104	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:07.041	2025-07-23 18:50:07.041	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj4am00beo5c3iahrxg80	Data Warehousing	Epsom Ventures	6335.00	50	closed_lost	Closed Lost	2024-02-25 00:00:00	\N	2023-12-19 00:00:00	10105	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:07.103	2025-07-23 18:50:07.103	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj4cj00bgo5c3h2rfzgb8	E-Commerce Integration	Southwick Logistics	3454.00	50	closed_lost	Closed Lost	2025-06-24 00:00:00	\N	2025-04-30 00:00:00	10106	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:07.171	2025-07-23 18:50:07.171	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj4ea00bio5c3fhel2kyt	Consulting Services	Farringdon Design	2700.00	50	closed_lost	Closed Lost	2025-07-10 00:00:00	\N	2025-06-09 00:00:00	10107	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:07.234	2025-07-23 18:50:07.234	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj4g000bko5c34fxsmhnf	Network Overhaul	Inverness Data	6413.00	90	open	Contract Review	2025-09-14 00:00:00	\N	2025-06-03 00:00:00	10108	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:07.296	2025-07-23 18:50:07.296	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj4hp00bmo5c3xpe3vfkl	System Upgrade	Inverness Data	6451.00	50	closed_lost	Closed Lost	2025-03-07 00:00:00	\N	2024-12-19 00:00:00	10109	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:07.358	2025-07-23 18:50:07.358	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj4jf00boo5c3ybnwih16	Infrastructure Review	Quayside Legal	6453.00	35	open	Needs Analysis	2025-07-22 00:00:00	\N	2025-05-18 00:00:00	10110	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:07.42	2025-07-23 18:50:07.42	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj4l800bqo5c3m6tex3qd	SEO Optimization	Greenbridge Tech	6472.00	50	closed_lost	Closed Lost	2025-10-11 00:00:00	\N	2025-07-08 00:00:00	10111	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:07.484	2025-07-23 18:50:07.484	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj4n000bso5c3fnfsquyx	Cloud Backup	Penrith Systems	6558.00	20	open	Discovery Call	2025-07-15 00:00:00	\N	2025-06-13 00:00:00	10112	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:07.548	2025-07-23 18:50:07.548	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj4ou00buo5c38yhnknxt	Data Security Package	Greenbridge Tech	6568.00	100	closed_won	Closed Won	2025-07-05 00:00:00	\N	2025-07-16 00:00:00	10113	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:07.614	2025-07-23 18:50:07.614	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj4qk00bwo5c39uh8ppqu	Data Warehousing	Cavendish Systems	6582.00	50	closed_lost	Closed Lost	2025-07-13 00:00:00	\N	2025-07-20 00:00:00	10114	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:07.677	2025-07-23 18:50:07.677	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj4uz00byo5c343n6c6wo	Data Warehousing	Telford Metrics	6569.00	50	closed_lost	Closed Lost	2025-03-10 00:00:00	\N	2025-02-16 00:00:00	10115	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:07.836	2025-07-23 18:50:07.836	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj4wt00c0o5c395tbbq66	Cloud Backup	Ashworth Consulting	3308.00	100	closed_won	Closed Won	2025-03-01 00:00:00	\N	2025-02-10 00:00:00	10116	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:07.901	2025-07-23 18:50:07.901	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj4yj00c2o5c3ewq0p1ke	Network Overhaul	Epsom Ventures	5123.00	75	open	Technical Demo	2025-08-03 00:00:00	\N	2025-05-10 00:00:00	10117	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:07.963	2025-07-23 18:50:07.963	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj50800c4o5c3buh4zfqb	API Development	Cavendish Systems	5468.00	100	closed_won	Closed Won	2025-03-09 00:00:00	\N	2024-11-23 00:00:00	10118	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:08.025	2025-07-23 18:50:08.025	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj51z00c6o5c3fdkr64pw	Helpdesk Setup	Jubilee Networks	6587.00	90	open	Contract Review	2025-10-16 00:00:00	\N	2025-05-04 00:00:00	10119	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:08.087	2025-07-23 18:50:08.087	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj53r00c8o5c384jsmnlv	Product Expansion	Lancaster Ltd	4506.00	100	closed_won	Closed Won	2025-04-11 00:00:00	\N	2025-03-28 00:00:00	10120	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:08.151	2025-07-23 18:50:08.151	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj55h00cao5c3biavc2pu	Product Expansion	Oakfield Agency	6608.00	100	closed_won	Closed Won	2025-01-13 00:00:00	\N	2024-10-04 00:00:00	10121	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:08.214	2025-07-23 18:50:08.214	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj57800cco5c3thmsouy7	Marketing Campaign	Epsom Ventures	6608.00	50	closed_lost	Closed Lost	2024-11-14 00:00:00	\N	2024-10-08 00:00:00	10122	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:08.276	2025-07-23 18:50:08.276	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj59000ceo5c3itf75y4n	E-Commerce Integration	Bramley Retail	6671.00	50	closed_lost	Closed Lost	2024-08-09 00:00:00	\N	2024-05-01 00:00:00	10123	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:08.34	2025-07-23 18:50:08.34	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj5ar00cgo5c3s41wax11	Consulting Services	Milton Solutions	5048.00	60	open	Proposal Submitted	2025-08-08 00:00:00	\N	2025-05-05 00:00:00	10124	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:08.404	2025-07-23 18:50:08.404	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj5cp00cio5c34oxm4zl9	Compliance Audit	Epsom Ventures	6718.00	60	open	Proposal Submitted	2025-09-26 00:00:00	\N	2025-05-08 00:00:00	10125	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:08.473	2025-07-23 18:50:08.473	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj5eg00cko5c3ne2q3son	Subscription Renewal	Dunford Analytics	7275.00	75	open	Technical Demo	2025-08-08 00:00:00	\N	2025-07-06 00:00:00	10126	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:08.536	2025-07-23 18:50:08.536	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj5g600cmo5c354o3f33z	User Onboarding Setup	Oakfield Agency	6721.00	35	open	Needs Analysis	2025-09-16 00:00:00	\N	2025-07-09 00:00:00	10127	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:08.598	2025-07-23 18:50:08.598	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj5hw00coo5c38xzvg45z	Marketing Campaign	Dunford Analytics	5517.00	60	open	Proposal Submitted	2025-08-23 00:00:00	\N	2025-06-29 00:00:00	10128	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:08.661	2025-07-23 18:50:08.661	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj5jn00cqo5c3a71tvd20	Compliance Audit	Telford Metrics	6738.00	100	closed_won	Closed Won	2024-06-03 00:00:00	\N	2024-02-10 00:00:00	10129	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:08.724	2025-07-23 18:50:08.724	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj5ld00cso5c31439p5w6	Annual Maintenance	Kingsway Group	6766.00	100	closed_won	Closed Won	2024-06-28 00:00:00	\N	2024-05-25 00:00:00	10130	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:08.786	2025-07-23 18:50:08.786	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj5n700cuo5c3zctoyi0r	System Upgrade	Quayside Legal	6816.00	50	closed_lost	Closed Lost	2024-03-01 00:00:00	\N	2023-11-10 00:00:00	10131	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:08.852	2025-07-23 18:50:08.852	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj5ox00cwo5c39tipo881	Compliance Audit	Oakfield Agency	6830.00	100	closed_won	Closed Won	2024-09-05 00:00:00	\N	2024-08-21 00:00:00	10132	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:08.914	2025-07-23 18:50:08.914	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj5qn00cyo5c3yaemu0rj	Compliance Audit	Kingsway Group	6859.00	100	closed_won	Closed Won	2024-02-01 00:00:00	\N	2023-12-07 00:00:00	10133	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:08.975	2025-07-23 18:50:08.975	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj5se00d0o5c3ngrfseka	User Onboarding Setup	Dunford Analytics	6882.00	100	closed_won	Closed Won	2025-05-02 00:00:00	\N	2025-04-11 00:00:00	10134	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:09.039	2025-07-23 18:50:09.039	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj5u500d2o5c35kkni29z	Helpdesk Setup	Norfolk Hosting	6887.00	100	closed_won	Closed Won	2024-07-31 00:00:00	\N	2024-06-20 00:00:00	10135	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:09.101	2025-07-23 18:50:09.101	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj5vz00d4o5c3sv4m209c	E-Commerce Integration	Lancaster Ltd	6940.00	50	closed_lost	Closed Lost	2024-06-25 00:00:00	\N	2024-05-13 00:00:00	10136	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:09.167	2025-07-23 18:50:09.167	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj5xp00d6o5c3ecidpqdn	Product Expansion	Norfolk Hosting	6941.00	90	open	Contract Review	2025-08-23 00:00:00	\N	2025-05-21 00:00:00	10137	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:09.229	2025-07-23 18:50:09.229	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj5zg00d8o5c3rmeoe9cn	E-Commerce Integration	Norfolk Hosting	6966.00	50	closed_lost	Closed Lost	2024-12-01 00:00:00	\N	2024-11-11 00:00:00	10138	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:09.292	2025-07-23 18:50:09.292	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj61700dao5c3gcl5i8tg	Product Expansion	Epsom Ventures	6972.00	50	closed_lost	Closed Lost	2023-12-31 00:00:00	\N	2023-09-14 00:00:00	10139	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:09.356	2025-07-23 18:50:09.356	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj63b00dco5c39q3vv9lv	Web Redesign	Inverness Data	6975.00	100	closed_won	Closed Won	2023-11-18 00:00:00	\N	2023-08-07 00:00:00	10140	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:09.431	2025-07-23 18:50:09.431	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj65200deo5c3hfj5j5bh	Infrastructure Review	Southwick Logistics	7018.00	100	closed_won	Closed Won	2023-12-30 00:00:00	\N	2023-09-18 00:00:00	10141	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:09.494	2025-07-23 18:50:09.494	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj66t00dgo5c39cmfkj66	Consulting Services	Telford Metrics	7058.00	100	closed_won	Closed Won	2025-05-19 00:00:00	\N	2025-04-21 00:00:00	10142	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:09.558	2025-07-23 18:50:09.558	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj68j00dio5c3ulgqbkz6	Sales Training	Epsom Ventures	6336.00	90	open	Contract Review	2025-08-23 00:00:00	\N	2025-07-19 00:00:00	10143	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:09.619	2025-07-23 18:50:09.619	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj6a800dko5c35ak845rm	Data Security Package	Inverness Data	7156.00	60	open	Proposal Submitted	2025-08-10 00:00:00	\N	2025-06-21 00:00:00	10144	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:09.681	2025-07-23 18:50:09.681	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj6bz00dmo5c39mzsfvsb	User Onboarding Setup	Harrow IT Services	7169.00	100	closed_won	Closed Won	2023-11-10 00:00:00	\N	2023-09-16 00:00:00	10145	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:09.743	2025-07-23 18:50:09.743	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj6dp00doo5c33wh33r0a	Infrastructure Review	Inverness Data	6583.00	100	closed_won	Closed Won	2025-05-26 00:00:00	\N	2025-04-29 00:00:00	10146	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:09.806	2025-07-23 18:50:09.806	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj6ff00dqo5c31p8ewhso	Annual Maintenance	Jubilee Networks	7217.00	50	closed_lost	Closed Lost	2024-09-11 00:00:00	\N	2024-05-29 00:00:00	10147	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:09.867	2025-07-23 18:50:09.867	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj6hi00dso5c3tqdjhszt	Product Expansion	Bramley Retail	7233.00	50	closed_lost	Closed Lost	2024-05-03 00:00:00	\N	2024-02-19 00:00:00	10148	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:09.942	2025-07-23 18:50:09.942	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj6j900duo5c3g7n0uh71	Network Overhaul	Bramley Retail	3767.00	90	open	Contract Review	2025-08-26 00:00:00	\N	2025-06-25 00:00:00	10149	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:10.006	2025-07-23 18:50:10.006	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj6kz00dwo5c3n41iqi7f	Annual Maintenance	Epsom Ventures	7283.00	50	closed_lost	Closed Lost	2025-06-05 00:00:00	\N	2025-03-08 00:00:00	10150	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:10.067	2025-07-23 18:50:10.067	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj6ms00dyo5c3347tn43j	System Upgrade	Greenbridge Tech	7292.00	100	closed_won	Closed Won	2023-11-17 00:00:00	\N	2023-11-06 00:00:00	10151	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:10.133	2025-07-23 18:50:10.133	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj6oi00e0o5c3a3qf6ytt	Consulting Services	Bramley Retail	2262.00	100	closed_won	Closed Won	2025-07-05 00:00:00	\N	2025-06-14 00:00:00	10152	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:10.195	2025-07-23 18:50:10.195	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdkaitr50001t8uqv709xys5	Enterprise Software License - TechCorp	TechCorp Industries	45000.00	100	closed_won	Closed Won	2024-12-15 00:00:00	2024-12-15 00:00:00	2024-10-01 00:00:00	SF001	salesforce	\N	\N	95	\N	{"confidence": "high", "risk_factors": [], "similar_deals_count": 3}	\N	298	\N	\N	2025-07-26 13:32:58.529	2025-07-26 13:32:58.529	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaitsq0003t8uqtqwxfzre	Annual Support Contract - DataFlow	DataFlow Solutions	28000.00	100	closed_won	Closed Won	2024-12-22 00:00:00	2024-12-22 00:00:00	2024-11-01 00:00:00	SF002	salesforce	\N	\N	98	\N	{"confidence": "high", "risk_factors": [], "similar_deals_count": 1}	\N	267	\N	\N	2025-07-26 13:32:58.587	2025-07-26 13:32:58.587	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaittj0005t8uqczu5hmd9	Cloud Migration Services - RetailPlus	RetailPlus Ltd	67000.00	100	closed_won	Closed Won	2024-11-30 00:00:00	2024-11-30 00:00:00	2024-09-15 00:00:00	HS001	hubspot	\N	\N	95	\N	{"confidence": "high", "risk_factors": [], "similar_deals_count": 1}	\N	314	\N	\N	2025-07-26 13:32:58.615	2025-07-26 13:32:58.615	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaitub0007t8uqo6nevtfm	Security Assessment - SecureBank	SecureBank Financial	22000.00	100	closed_won	Closed Won	2025-07-05 00:00:00	2025-07-05 00:00:00	2025-05-15 00:00:00	SF008	salesforce	\N	\N	104	\N	{"confidence": "high", "risk_factors": [], "similar_deals_count": 3}	\N	72	\N	\N	2025-07-26 13:32:58.643	2025-07-26 13:32:58.643	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaitv30009t8uqnuiml4o0	Quick Implementation - StartupXYZ	StartupXYZ Inc	15000.00	100	closed_won	Closed Won	2025-07-12 00:00:00	2025-07-12 00:00:00	2025-06-01 00:00:00	HS005	hubspot	\N	\N	98	\N	{"confidence": "high", "risk_factors": [], "similar_deals_count": 3}	\N	55	\N	\N	2025-07-26 13:32:58.671	2025-07-26 13:32:58.671	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaitvw000bt8uqgv0780ei	Digital Transformation - MegaCorp	MegaCorp International	120000.00	75	open	Proposal Submitted	2025-08-28 00:00:00	\N	2025-06-01 00:00:00	SF003	salesforce	\N	\N	79	\N	{"confidence": "high", "risk_factors": [], "similar_deals_count": 4}	\N	55	\N	\N	2025-07-26 13:32:58.7	2025-07-26 13:32:58.7	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaitxf000dt8uq24x0g14o	Overdue Implementation - TechLate	TechLate Solutions	35000.00	80	open	Final Approval	2025-07-10 00:00:00	\N	2025-05-20 00:00:00	SF009	salesforce	\N	\N	77	\N	{"confidence": "high", "risk_factors": [], "similar_deals_count": 1}	\N	67	\N	\N	2025-07-26 13:32:58.755	2025-07-26 13:32:58.755	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaityb000ft8uqgs5036ad	Delayed Migration - SlowCorp	SlowCorp Industries	48000.00	65	open	Contract Negotiation	2025-07-05 00:00:00	\N	2025-04-15 00:00:00	HS006	hubspot	\N	\N	66	\N	{"confidence": "medium", "risk_factors": [], "similar_deals_count": 5}	\N	102	\N	\N	2025-07-26 13:32:58.787	2025-07-26 13:32:58.787	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdgbj7t100feo5c3o3tsllvn	System Upgrade	Epsom Ventures	8143.00	100	closed_won	Closed Won	2025-07-21 00:00:00	\N	2025-03-28 00:00:00	10177	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:11.653	2025-07-23 18:50:11.653	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj7ul00fgo5c3vf1t8ut2	Annual Maintenance	Farringdon Design	8294.00	50	closed_lost	Closed Lost	2023-12-11 00:00:00	\N	2023-09-19 00:00:00	10178	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:11.71	2025-07-23 18:50:11.71	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj7w400fio5c33lj2spgn	Data Warehousing	Quayside Legal	5550.00	35	open	Needs Analysis	2025-08-28 00:00:00	\N	2025-05-29 00:00:00	10179	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:11.765	2025-07-23 18:50:11.765	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj7xr00fko5c33akyzcb0	CRM Integration	Lancaster Ltd	8362.00	100	closed_won	Closed Won	2024-08-14 00:00:00	\N	2024-07-01 00:00:00	10180	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:11.823	2025-07-23 18:50:11.823	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj7zd00fmo5c390ss60q5	E-Commerce Integration	Greenbridge Tech	8510.00	100	closed_won	Closed Won	2025-06-18 00:00:00	\N	2025-03-21 00:00:00	10181	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:11.882	2025-07-23 18:50:11.882	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj80w00foo5c3f5kpgnv2	SEO Optimization	Epsom Ventures	8547.00	50	closed_lost	Closed Lost	2025-04-14 00:00:00	\N	2025-03-22 00:00:00	10182	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:11.936	2025-07-23 18:50:11.936	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj82h00fqo5c3cm3wymvy	Infrastructure Review	Milton Solutions	8644.00	50	closed_lost	Closed Lost	2024-04-24 00:00:00	\N	2024-01-22 00:00:00	10183	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:11.993	2025-07-23 18:50:11.993	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj84200fso5c3yb6ol36z	Consulting Services	Telford Metrics	8664.00	100	closed_won	Closed Won	2023-11-22 00:00:00	\N	2023-07-30 00:00:00	10184	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:12.051	2025-07-23 18:50:12.051	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj85l00fuo5c3d8i8owad	Network Overhaul	Jubilee Networks	8688.00	100	closed_won	Closed Won	2025-04-06 00:00:00	\N	2025-03-25 00:00:00	10185	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:12.105	2025-07-23 18:50:12.105	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj87300fwo5c3pp79bdil	Infrastructure Review	Oakfield Agency	8744.00	50	closed_lost	Closed Lost	2024-07-25 00:00:00	\N	2024-04-27 00:00:00	10186	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:12.16	2025-07-23 18:50:12.16	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj88m00fyo5c3lmxhuph9	Marketing Campaign	Jubilee Networks	8745.00	50	closed_lost	Closed Lost	2024-07-02 00:00:00	\N	2024-05-23 00:00:00	10187	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:12.214	2025-07-23 18:50:12.214	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj8a400g0o5c33sukcpg5	Subscription Renewal	Oakfield Agency	8797.00	100	closed_won	Closed Won	2025-03-01 00:00:00	\N	2025-02-02 00:00:00	10188	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:12.269	2025-07-23 18:50:12.269	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj8bo00g2o5c3nnbcu53t	Cloud Backup	Harrow IT Services	5547.00	90	open	Contract Review	2025-09-17 00:00:00	\N	2025-07-06 00:00:00	10189	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:12.324	2025-07-23 18:50:12.324	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj8d700g4o5c34xfkj22l	API Development	Cavendish Systems	8944.00	50	closed_lost	Closed Lost	2023-10-20 00:00:00	\N	2023-08-10 00:00:00	10190	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:12.379	2025-07-23 18:50:12.379	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj8eq00g6o5c3jd8919le	System Upgrade	Kingsway Group	9036.00	50	closed_lost	Closed Lost	2024-08-19 00:00:00	\N	2024-08-08 00:00:00	10191	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:12.434	2025-07-23 18:50:12.434	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj8ga00g8o5c3gg0vybrx	Infrastructure Review	Inverness Data	5194.00	60	open	Proposal Submitted	2025-10-09 00:00:00	\N	2025-06-26 00:00:00	10192	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:12.49	2025-07-23 18:50:12.49	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui
cmdgbj8ht00gao5c3db30h9tl	Helpdesk Setup	Harrow IT Services	9338.00	100	closed_won	Closed Won	2025-09-02 00:00:00	\N	2025-05-13 00:00:00	10193	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:12.545	2025-07-23 18:50:12.545	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj8jd00gco5c3r6ac3jb0	Infrastructure Review	Quayside Legal	9360.00	35	open	Needs Analysis	2025-08-06 00:00:00	\N	2025-06-29 00:00:00	10194	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:12.601	2025-07-23 18:50:12.601	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui
cmdgbj8kw00geo5c3xxjtrosg	Subscription Renewal	Oakfield Agency	9496.00	20	open	Discovery Call	2025-08-30 00:00:00	\N	2025-04-28 00:00:00	10195	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:12.656	2025-07-23 18:50:12.656	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj8mf00ggo5c3fvmjz7cv	Infrastructure Review	Lancaster Ltd	9560.00	50	closed_lost	Closed Lost	2024-05-17 00:00:00	\N	2024-04-12 00:00:00	10196	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:12.711	2025-07-23 18:50:12.711	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui
cmdgbj8ny00gio5c3tsw3rpdo	Subscription Renewal	Oakfield Agency	5607.00	100	closed_won	Closed Won	2025-07-21 00:00:00	\N	2025-07-05 00:00:00	10197	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:12.766	2025-07-23 18:50:12.766	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj8pg00gko5c33eoovqzy	Web Redesign	Epsom Ventures	9727.00	100	closed_won	Closed Won	2024-12-03 00:00:00	\N	2024-09-13 00:00:00	10198	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:12.821	2025-07-23 18:50:12.821	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui
cmdgbj8r400gmo5c3tixnc7jb	CRM Integration	Lancaster Ltd	10809.00	90	open	Contract Review	2025-09-11 00:00:00	\N	2025-06-08 00:00:00	10199	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:12.881	2025-07-23 18:50:12.881	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdgbj8sq00goo5c34sgfeqwt	System Upgrade	Ashworth Consulting	11952.00	50	closed_lost	Closed Lost	2025-03-04 00:00:00	\N	2024-11-06 00:00:00	10200	sheets	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-07-23 18:50:12.939	2025-07-23 18:50:12.939	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui
cmdkaitz5000ht8uq0wvt7ygz	Security Audit & Implementation - FinanceFirst	FinanceFirst Bank	85000.00	60	open	Needs Analysis	2025-09-15 00:00:00	\N	2025-05-15 00:00:00	SF004	salesforce	\N	\N	61	\N	{"confidence": "medium", "risk_factors": [], "similar_deals_count": 5}	\N	72	\N	\N	2025-07-26 13:32:58.817	2025-07-26 13:32:58.817	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaiu00000jt8uqgytqy0n7	CRM Integration - StartupFast	StartupFast Technologies	32000.00	45	open	Initial Meeting	2025-08-15 00:00:00	\N	2025-07-05 00:00:00	HS002	hubspot	\N	\N	45	\N	{"confidence": "medium", "risk_factors": ["Timeline pressure", "Budget constraints"], "similar_deals_count": 5}	\N	21	\N	\N	2025-07-26 13:32:58.848	2025-07-26 13:32:58.848	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaiu0w000lt8uqc2yneo1b	Infrastructure Upgrade - ManufacturingCo	ManufacturingCo Ltd	95000.00	70	open	Technical Evaluation	2025-03-30 00:00:00	\N	2024-12-10 00:00:00	PD001	pipedrive	\N	\N	72	\N	{"confidence": "medium", "risk_factors": [], "similar_deals_count": 3}	\N	228	\N	\N	2025-07-26 13:32:58.88	2025-07-26 13:32:58.88	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaiu1o000nt8uqbabhgkbe	Analytics Platform - InsightsCorp	InsightsCorp	52000.00	55	open	Demo Scheduled	2025-02-20 00:00:00	\N	2025-01-02 00:00:00	SF005	salesforce	\N	\N	51	\N	{"confidence": "medium", "risk_factors": [], "similar_deals_count": 2}	\N	205	\N	\N	2025-07-26 13:32:58.909	2025-07-26 13:32:58.909	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaiu2m000pt8uqt4tbovgw	Training & Consulting - EduTech	EduTech Solutions	18500.00	40	open	Qualification	2025-01-31 00:00:00	\N	2024-12-20 00:00:00	HS003	hubspot	\N	\N	36	\N	{"confidence": "low", "risk_factors": ["Timeline pressure", "Budget constraints"], "similar_deals_count": 2}	\N	218	\N	\N	2025-07-26 13:32:58.942	2025-07-26 13:32:58.942	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaiu3e000rt8uqmaczeyyj	Enterprise License Renewal - GlobalTech	GlobalTech Systems	75000.00	85	open	Contract Review	2025-07-25 00:00:00	\N	2025-06-01 00:00:00	SF006	salesforce	\N	\N	89	\N	{"confidence": "high", "risk_factors": [], "similar_deals_count": 4}	\N	55	\N	\N	2025-07-26 13:32:58.97	2025-07-26 13:32:58.97	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaiu48000tt8uqqk3xoie5	Custom Development - InnovateLabs	InnovateLabs	42000.00	90	open	Verbal Commitment	2025-02-10 00:00:00	\N	2024-12-05 00:00:00	HS004	hubspot	\N	\N	86	\N	{"confidence": "high", "risk_factors": [], "similar_deals_count": 5}	\N	233	\N	\N	2025-07-26 13:32:59	2025-07-26 13:32:59	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaiu50000vt8uq3qvdiop9	Strategic Partnership - FutureCorp	FutureCorp Ventures	150000.00	35	open	Exploratory	2025-07-30 00:00:00	\N	2025-05-15 00:00:00	SF007	salesforce	\N	\N	38	\N	{"confidence": "low", "risk_factors": ["Timeline pressure", "Budget constraints"], "similar_deals_count": 4}	\N	72	\N	\N	2025-07-26 13:32:59.029	2025-07-26 13:32:59.029	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
cmdkaiu5s000xt8uqdqw7llkg	International Expansion - GlobalReach	GlobalReach International	200000.00	25	open	Research Phase	2025-06-30 00:00:00	\N	2024-11-20 00:00:00	PD002	pipedrive	\N	\N	25	\N	{"confidence": "low", "risk_factors": ["Timeline pressure", "Budget constraints"], "similar_deals_count": 1}	\N	248	\N	\N	2025-07-26 13:32:59.057	2025-07-26 13:32:59.057	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab
\.


--
-- Data for Name: forecasts; Type: TABLE DATA; Schema: public; Owner: commit_db_qidw_user
--

COPY public.forecasts (id, forecast_date, forecast_type, pipeline_amount, commit_amount, best_case_amount, closed_amount, ai_predicted_close, ai_confidence, actual_closed, forecast_accuracy, created_at, user_id, company_id, target_id) FROM stdin;
\.


--
-- Data for Name: targets; Type: TABLE DATA; Schema: public; Owner: commit_db_qidw_user
--

COPY public.targets (id, period_type, period_start, period_end, quota_amount, commission_rate, is_active, ai_forecast_amount, ai_confidence, ai_updated_at, created_at, updated_at, user_id, company_id, role, commission_payment_schedule, team_target, distribution_method, distribution_config, parent_target_id) FROM stdin;
cmdfyggh70004k5siwpxpjs4c	annual	2025-01-01 00:00:00	2025-12-31 00:00:00	250000.00	0.0750	t	\N	\N	\N	2025-07-23 12:44:07.915	2025-07-23 12:44:07.915	cmdfyggcx0002k5sid4r9d92y	cmdfygg270000k5si08v9jwab	\N	monthly	f	even	\N	\N
cmdg6lb3y001tsfe4ecc0gars	annual	2025-01-01 00:00:00	2025-12-31 00:00:00	120000.00	0.0500	f	\N	\N	\N	2025-07-23 16:31:51.166	2025-07-23 17:08:30.114	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv	sales_rep	monthly	f	even	\N	\N
cmdg7wfx300fj11zwhza7pab0	annual	2025-01-01 00:00:00	2025-12-31 00:00:00	240000.00	0.0500	t	\N	\N	\N	2025-07-23 17:08:30.231	2025-07-23 17:08:30.231	cmdg6hk7f001hsfe420rqy5hd	cmdfyi4zl001lk5sieje7k0nv	sales_rep	monthly	f	even	\N	\N
cmdg6lb9d001xsfe4awmv3u98	annual	2025-01-01 00:00:00	2025-12-31 00:00:00	120000.00	0.0500	f	\N	\N	\N	2025-07-23 16:31:51.361	2025-07-23 17:08:30.355	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv	sales_rep	monthly	f	even	\N	\N
cmdg7wg2600fn11zwe4knklu3	annual	2025-01-01 00:00:00	2025-12-31 00:00:00	240000.00	0.0500	t	\N	\N	\N	2025-07-23 17:08:30.415	2025-07-23 17:08:30.415	cmdg6ik8y001lsfe44gppj557	cmdfyi4zl001lk5sieje7k0nv	sales_rep	monthly	f	even	\N	\N
cmdg6lbd00021sfe4pn820c7r	annual	2025-01-01 00:00:00	2025-12-31 00:00:00	120000.00	0.0500	f	\N	\N	\N	2025-07-23 16:31:51.492	2025-07-23 17:08:30.484	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv	sales_rep	monthly	f	even	\N	\N
cmdg7wg6200fr11zwfd67cep1	annual	2025-01-01 00:00:00	2025-12-31 00:00:00	240000.00	0.0500	t	\N	\N	\N	2025-07-23 17:08:30.555	2025-07-23 17:08:30.555	cmdg6jumf001psfe4mgayi24w	cmdfyi4zl001lk5sieje7k0nv	sales_rep	monthly	f	even	\N	\N
cmdg88qme001l48dfdktht7df	annual	2025-01-01 00:00:00	2025-12-31 00:00:00	720000.00	0.0500	t	\N	\N	\N	2025-07-23 17:18:03.974	2025-07-23 17:18:03.974	cmdfyi58h001nk5siofwudj5j	cmdfyi4zl001lk5sieje7k0nv	\N	monthly	f	even	\N	\N
cmdgbfa7n0020o5c32ksmeikg	annual	2025-01-01 00:00:00	2025-12-31 00:00:00	480000.00	0.0500	t	\N	\N	\N	2025-07-23 18:47:08.147	2025-07-23 18:47:08.147	cmdgb9boa001ko5c366k13l6r	cmdgb8eyy001go5c3tsw3vxui	sales_rep	monthly	f	even	\N	\N
cmdgbfacs0024o5c3egsww96w	annual	2025-01-01 00:00:00	2025-12-31 00:00:00	480000.00	0.0500	t	\N	\N	\N	2025-07-23 18:47:08.332	2025-07-23 18:47:08.332	cmdgbbglt001oo5c37dq8hssh	cmdgb8eyy001go5c3tsw3vxui	sales_rep	monthly	f	even	\N	\N
cmdgbfag20028o5c3y8og2ftr	annual	2025-01-01 00:00:00	2025-12-31 00:00:00	480000.00	0.0500	t	\N	\N	\N	2025-07-23 18:47:08.45	2025-07-23 18:47:08.45	cmdgbd5y8001so5c3o4qjncwq	cmdgb8eyy001go5c3tsw3vxui	sales_rep	monthly	f	even	\N	\N
cmdgbfajg002co5c3rpo94suo	annual	2025-01-01 00:00:00	2025-12-31 00:00:00	480000.00	0.0500	t	\N	\N	\N	2025-07-23 18:47:08.572	2025-07-23 18:47:08.572	cmdgbe11m001wo5c3dgqss5c5	cmdgb8eyy001go5c3tsw3vxui	sales_rep	monthly	f	even	\N	\N
cmdgbfslr002ko5c3cmmg9bta	annual	2025-01-01 00:00:00	2025-12-31 00:00:00	1920000.00	0.0500	t	\N	\N	\N	2025-07-23 18:47:31.984	2025-07-23 18:47:31.984	cmdgb8f6y001io5c3cyhr7lfw	cmdgb8eyy001go5c3tsw3vxui	\N	monthly	f	even	\N	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: commit_db_qidw_user
--

COPY public.users (id, email, password, first_name, last_name, role, is_active, hire_date, territory, manager_id, created_at, updated_at, performance_profile, prediction_accuracy, company_id, is_admin) FROM stdin;
cmdfyggcx0002k5sid4r9d92y	test@company.com	$2b$10$EBwK4eHmvZ/0yaWLkXsLTeerct7dNYs5H3AtvmPFCn.462.2cIWuy	Sarah	Mitchell	admin	t	2024-01-15 00:00:00	UK North	\N	2025-07-23 12:44:07.761	2025-07-23 12:44:07.761	\N	\N	cmdfygg270000k5si08v9jwab	f
cmdfyi58h001nk5siofwudj5j	fredrik@test.com	$2b$10$DpcPAs4dtj5pTqch4Eo8muTCQmXFEA0/AkShkV/QQJ4EBel6FLV/K	Fredrik	Hoglin	manager	t	\N	\N	\N	2025-07-23 12:45:26.658	2025-07-23 12:45:26.658	\N	\N	cmdfyi4zl001lk5sieje7k0nv	t
cmdg5wrpn001iskdyrxgmjf5q	newuser@test.com	$2b$10$vss2W122EnPK/S8Dm61e6.r8UXJIHtvLxuXTnwmmk78nr72NlQui2	New	User	manager	t	\N	\N	\N	2025-07-23 16:12:46.284	2025-07-23 16:12:46.284	\N	\N	cmdg5wrgp001gskdy1s3ckung	t
cmdg6hk7f001hsfe420rqy5hd	gunnar@test.com	$2b$10$bEgyq0J1bfq7pxRRSkV/y./eUWYBFaxVA5vC00mjt/th5rB3CNjAK	Fredrik	Gunnarson	sales_rep	t	\N	SE	cmdfyi58h001nk5siofwudj5j	2025-07-23 16:28:56.331	2025-07-23 16:28:56.331	\N	\N	cmdfyi4zl001lk5sieje7k0nv	f
cmdg6ik8y001lsfe44gppj557	robin@test.com	$2b$10$V/rIrD8RjsjFUjd5epsYb.AGHnChS2dOVQp5AS23xgnFK.Of/3hjK	Robin	Olofsson	sales_rep	t	\N	SE	cmdfyi58h001nk5siofwudj5j	2025-07-23 16:29:43.043	2025-07-23 16:29:43.043	\N	\N	cmdfyi4zl001lk5sieje7k0nv	f
cmdg6jumf001psfe4mgayi24w	jonas@test.com	$2b$10$8aJnVMeS9Wbtyq.4yGVnVuvPXt2EJnwPmFm.byJqd7u45gK5T7DBm	Jonas	Davidsson	sales_rep	t	\N	SE	cmdfyi58h001nk5siofwudj5j	2025-07-23 16:30:43.143	2025-07-23 16:30:43.143	\N	\N	cmdfyi4zl001lk5sieje7k0nv	f
cmdgb8f6y001io5c3cyhr7lfw	tom@test.com	$2b$10$/tIACbbWggosiJw9tDAMP.DgSaFwqH.KpwRosqJ4jhgS7tHJJ911O	Tom	Deane	manager	t	\N	\N	\N	2025-07-23 18:41:48.01	2025-07-23 18:41:48.01	\N	\N	cmdgb8eyy001go5c3tsw3vxui	t
cmdgb9boa001ko5c366k13l6r	alfie@test.com	$2b$10$7kf4FZsABPtH202Hn11.wed8Pt6Qpc.SXrFemgpaJYEYNbNbt4rfm	Alfie	Ferris	sales_rep	t	\N	UK	cmdgb8f6y001io5c3cyhr7lfw	2025-07-23 18:42:30.107	2025-07-23 18:42:30.107	\N	\N	cmdgb8eyy001go5c3tsw3vxui	f
cmdgbbglt001oo5c37dq8hssh	tobias@test.com	$2b$10$dBwMN/B4vkZ./ugdWZy2MOz7B92afbI7L1lFvKkqutgmsuN/yVXHS	Tobias	Zellweger	sales_rep	t	\N	CH	cmdgb8f6y001io5c3cyhr7lfw	2025-07-23 18:44:09.81	2025-07-23 18:44:09.81	\N	\N	cmdgb8eyy001go5c3tsw3vxui	f
cmdgbd5y8001so5c3o4qjncwq	rob@test.com	$2b$10$hvIenUyyQWtg2x6dUR2cZu7ZW8ASok3GOPRi.crbHJQfWUpH6lgPi	Rob	Manson	sales_rep	t	\N	UK	cmdgb8f6y001io5c3cyhr7lfw	2025-07-23 18:45:29.312	2025-07-23 18:45:29.312	\N	\N	cmdgb8eyy001go5c3tsw3vxui	f
cmdgbe11m001wo5c3dgqss5c5	joel@test.com	$2b$10$NqJF3uq7ndL3SiLM3yrBnOfrdpGra0KjUDqDfpNn/nGRggdT/T6YC	Joel	Savilahti	sales_rep	t	\N	SE	cmdgb8f6y001io5c3cyhr7lfw	2025-07-23 18:46:09.61	2025-07-23 18:46:09.61	\N	\N	cmdgb8eyy001go5c3tsw3vxui	f
cmdkaxwbs000216vwassx5dk7	tom1@test.com	$2b$10$39RJrtbbEvyN4qgqgNh5e.euJZspQitutVNBsP0988CkpW84iNMCO	Tom	Deane	manager	t	\N	\N	\N	2025-07-26 13:44:41.705	2025-07-26 13:44:41.705	\N	\N	cmdkaxw2v000016vwand76fll	t
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);


--
-- Name: commission_details commission_details_pkey; Type: CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.commission_details
    ADD CONSTRAINT commission_details_pkey PRIMARY KEY (id);


--
-- Name: commissions commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.commissions
    ADD CONSTRAINT commissions_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: crm_integrations crm_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.crm_integrations
    ADD CONSTRAINT crm_integrations_pkey PRIMARY KEY (id);


--
-- Name: deal_categorizations deal_categorizations_pkey; Type: CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.deal_categorizations
    ADD CONSTRAINT deal_categorizations_pkey PRIMARY KEY (id);


--
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);


--
-- Name: forecasts forecasts_pkey; Type: CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.forecasts
    ADD CONSTRAINT forecasts_pkey PRIMARY KEY (id);


--
-- Name: targets targets_pkey; Type: CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.targets
    ADD CONSTRAINT targets_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: activity_log_action_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX activity_log_action_idx ON public.activity_log USING btree (action);


--
-- Name: activity_log_company_id_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX activity_log_company_id_idx ON public.activity_log USING btree (company_id);


--
-- Name: activity_log_created_at_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX activity_log_created_at_idx ON public.activity_log USING btree (created_at);


--
-- Name: activity_log_entity_type_entity_id_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX activity_log_entity_type_entity_id_idx ON public.activity_log USING btree (entity_type, entity_id);


--
-- Name: activity_log_user_id_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX activity_log_user_id_idx ON public.activity_log USING btree (user_id);


--
-- Name: commission_details_commission_id_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX commission_details_commission_id_idx ON public.commission_details USING btree (commission_id);


--
-- Name: commission_details_deal_id_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX commission_details_deal_id_idx ON public.commission_details USING btree (deal_id);


--
-- Name: commissions_period_start_period_end_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX commissions_period_start_period_end_idx ON public.commissions USING btree (period_start, period_end);


--
-- Name: commissions_status_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX commissions_status_idx ON public.commissions USING btree (status);


--
-- Name: commissions_user_id_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX commissions_user_id_idx ON public.commissions USING btree (user_id);


--
-- Name: companies_domain_key; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE UNIQUE INDEX companies_domain_key ON public.companies USING btree (domain);


--
-- Name: crm_integrations_company_id_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX crm_integrations_company_id_idx ON public.crm_integrations USING btree (company_id);


--
-- Name: crm_integrations_crm_type_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX crm_integrations_crm_type_idx ON public.crm_integrations USING btree (crm_type);


--
-- Name: deal_categorizations_category_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX deal_categorizations_category_idx ON public.deal_categorizations USING btree (category);


--
-- Name: deal_categorizations_created_at_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX deal_categorizations_created_at_idx ON public.deal_categorizations USING btree (created_at);


--
-- Name: deal_categorizations_deal_id_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX deal_categorizations_deal_id_idx ON public.deal_categorizations USING btree (deal_id);


--
-- Name: deal_categorizations_user_id_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX deal_categorizations_user_id_idx ON public.deal_categorizations USING btree (user_id);


--
-- Name: deals_amount_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX deals_amount_idx ON public.deals USING btree (amount);


--
-- Name: deals_close_date_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX deals_close_date_idx ON public.deals USING btree (close_date);


--
-- Name: deals_company_id_created_at_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX deals_company_id_created_at_idx ON public.deals USING btree (company_id, created_at);


--
-- Name: deals_company_id_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX deals_company_id_idx ON public.deals USING btree (company_id);


--
-- Name: deals_crm_id_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX deals_crm_id_idx ON public.deals USING btree (crm_id);


--
-- Name: deals_probability_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX deals_probability_idx ON public.deals USING btree (probability);


--
-- Name: deals_status_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX deals_status_idx ON public.deals USING btree (status);


--
-- Name: deals_user_id_crm_type_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX deals_user_id_crm_type_idx ON public.deals USING btree (user_id, crm_type);


--
-- Name: deals_user_id_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX deals_user_id_idx ON public.deals USING btree (user_id);


--
-- Name: deals_user_id_status_close_date_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX deals_user_id_status_close_date_idx ON public.deals USING btree (user_id, status, close_date);


--
-- Name: forecasts_forecast_date_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX forecasts_forecast_date_idx ON public.forecasts USING btree (forecast_date);


--
-- Name: forecasts_forecast_type_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX forecasts_forecast_type_idx ON public.forecasts USING btree (forecast_type);


--
-- Name: forecasts_target_id_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX forecasts_target_id_idx ON public.forecasts USING btree (target_id);


--
-- Name: forecasts_user_id_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX forecasts_user_id_idx ON public.forecasts USING btree (user_id);


--
-- Name: targets_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX targets_company_id_is_active_idx ON public.targets USING btree (company_id, is_active);


--
-- Name: targets_distribution_method_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX targets_distribution_method_idx ON public.targets USING btree (distribution_method);


--
-- Name: targets_parent_target_id_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX targets_parent_target_id_idx ON public.targets USING btree (parent_target_id);


--
-- Name: targets_period_start_period_end_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX targets_period_start_period_end_idx ON public.targets USING btree (period_start, period_end);


--
-- Name: targets_period_type_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX targets_period_type_idx ON public.targets USING btree (period_type);


--
-- Name: targets_team_target_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX targets_team_target_idx ON public.targets USING btree (team_target);


--
-- Name: targets_user_id_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX targets_user_id_idx ON public.targets USING btree (user_id);


--
-- Name: targets_user_id_period_start_period_end_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX targets_user_id_period_start_period_end_idx ON public.targets USING btree (user_id, period_start, period_end);


--
-- Name: users_company_id_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX users_company_id_idx ON public.users USING btree (company_id);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_manager_id_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX users_manager_id_idx ON public.users USING btree (manager_id);


--
-- Name: users_role_idx; Type: INDEX; Schema: public; Owner: commit_db_qidw_user
--

CREATE INDEX users_role_idx ON public.users USING btree (role);


--
-- Name: activity_log activity_log_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: activity_log activity_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: commission_details commission_details_commission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.commission_details
    ADD CONSTRAINT commission_details_commission_id_fkey FOREIGN KEY (commission_id) REFERENCES public.commissions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: commission_details commission_details_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.commission_details
    ADD CONSTRAINT commission_details_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: commissions commissions_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.commissions
    ADD CONSTRAINT commissions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: commissions commissions_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.commissions
    ADD CONSTRAINT commissions_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.targets(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: commissions commissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.commissions
    ADD CONSTRAINT commissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: crm_integrations crm_integrations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.crm_integrations
    ADD CONSTRAINT crm_integrations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: deal_categorizations deal_categorizations_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.deal_categorizations
    ADD CONSTRAINT deal_categorizations_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: deal_categorizations deal_categorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.deal_categorizations
    ADD CONSTRAINT deal_categorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: deals deals_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: deals deals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: forecasts forecasts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.forecasts
    ADD CONSTRAINT forecasts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: forecasts forecasts_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.forecasts
    ADD CONSTRAINT forecasts_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.targets(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: forecasts forecasts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.forecasts
    ADD CONSTRAINT forecasts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: targets targets_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.targets
    ADD CONSTRAINT targets_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: targets targets_parent_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.targets
    ADD CONSTRAINT targets_parent_target_id_fkey FOREIGN KEY (parent_target_id) REFERENCES public.targets(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: targets targets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.targets
    ADD CONSTRAINT targets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: users users_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: users users_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: commit_db_qidw_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON SEQUENCES TO commit_db_qidw_user;


--
-- Name: DEFAULT PRIVILEGES FOR TYPES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TYPES TO commit_db_qidw_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON FUNCTIONS TO commit_db_qidw_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TABLES TO commit_db_qidw_user;


--
-- PostgreSQL database dump complete
--

