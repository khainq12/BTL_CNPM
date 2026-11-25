-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('DRAFT', 'PENDING_ACCEPT', 'RECEIVED', 'PRECHECK', 'WAITING_INFORMATION', 'DIAGNOSING', 'ELIGIBILITY_REVIEW', 'WAITING_APPROVAL', 'QUOTED', 'WO_CREATED', 'WAITING_PARTS', 'READY_TO_REPAIR', 'ASSIGNED', 'IN_REPAIR', 'TESTING', 'REWORK', 'MANAGER_REVIEW', 'READY_FOR_DELIVERY', 'COMPLETED', 'RETURN_PENDING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('WARRANTY_FREE', 'PAID_REPAIR', 'INSPECTION_ONLY');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('PENDING', 'WAITING_PARTS', 'READY', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'PENDING_MANAGER_APPROVAL', 'SENT_TO_CUSTOMER', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InventoryTransType" AS ENUM ('IMPORT', 'RESERVE', 'RELEASE_RESERVE', 'ISSUE', 'RETURN', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "role_id" SERIAL NOT NULL,
    "role_name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "customers" (
    "customer_id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "warranty_policies" (
    "policy_id" SERIAL NOT NULL,
    "policy_code" TEXT NOT NULL,
    "policy_name" TEXT NOT NULL,
    "duration_months" INTEGER NOT NULL DEFAULT 12,
    "covered_parts" JSONB,
    "void_conditions" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "warranty_policies_pkey" PRIMARY KEY ("policy_id")
);

-- CreateTable
CREATE TABLE "devices" (
    "device_id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "policy_id" INTEGER,
    "serial_number" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "device_type" TEXT NOT NULL,
    "warranty_expiry" TIMESTAMP(3),

    CONSTRAINT "devices_pkey" PRIMARY KEY ("device_id")
);

-- CreateTable
CREATE TABLE "warranty_cases" (
    "case_id" SERIAL NOT NULL,
    "case_code" TEXT NOT NULL,
    "device_id" INTEGER NOT NULL,
    "created_by" INTEGER NOT NULL,
    "issue_description" TEXT NOT NULL,
    "accessories" TEXT,
    "physical_state" TEXT,
    "attachments" JSONB,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "service_type" "ServiceType",
    "status" "CaseStatus" NOT NULL DEFAULT 'RECEIVED',
    "rework_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warranty_cases_pkey" PRIMARY KEY ("case_id")
);

-- CreateTable
CREATE TABLE "diagnoses" (
    "diagnosis_id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "diagnosis_result" TEXT NOT NULL,
    "root_cause" TEXT NOT NULL,
    "proposed_plan" TEXT,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("diagnosis_id")
);

-- CreateTable
CREATE TABLE "warranty_decisions" (
    "decision_id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "is_warranty" BOOLEAN,
    "decision_reason" TEXT NOT NULL,
    "decided_by" INTEGER NOT NULL,
    "approved_by" INTEGER,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warranty_decisions_pkey" PRIMARY KEY ("decision_id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "quotation_id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parts_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "labor_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "manager_note" TEXT,
    "customer_proof" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("quotation_id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "work_order_id" SERIAL NOT NULL,
    "wo_code" TEXT NOT NULL,
    "case_id" INTEGER NOT NULL,
    "assigned_to" INTEGER,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'PENDING',
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("work_order_id")
);

-- CreateTable
CREATE TABLE "work_tasks" (
    "task_id" SERIAL NOT NULL,
    "work_order_id" INTEGER NOT NULL,
    "task_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "estimated_time" INTEGER,

    CONSTRAINT "work_tasks_pkey" PRIMARY KEY ("task_id")
);

-- CreateTable
CREATE TABLE "task_assignments" (
    "assignment_id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "technician_id" INTEGER NOT NULL,
    "assign_reason" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "parts" (
    "part_id" SERIAL NOT NULL,
    "sku" TEXT NOT NULL,
    "part_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'Cái',
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "reserved_qty" INTEGER NOT NULL DEFAULT 0,
    "min_stock" INTEGER NOT NULL DEFAULT 5,
    "unit_price" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("part_id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "trans_id" SERIAL NOT NULL,
    "part_id" INTEGER NOT NULL,
    "work_order_id" INTEGER,
    "trans_type" "InventoryTransType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "trans_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("trans_id")
);

-- CreateTable
CREATE TABLE "work_order_parts" (
    "wop_id" SERIAL NOT NULL,
    "work_order_id" INTEGER NOT NULL,
    "part_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "returned_qty" INTEGER NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "work_order_parts_pkey" PRIMARY KEY ("wop_id")
);

-- CreateTable
CREATE TABLE "inspections" (
    "inspection_id" SERIAL NOT NULL,
    "work_order_id" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "note" TEXT,
    "inspected_by" INTEGER NOT NULL,
    "inspected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("inspection_id")
);

-- CreateTable
CREATE TABLE "inspection_items" (
    "item_id" SERIAL NOT NULL,
    "inspection_id" INTEGER NOT NULL,
    "check_item" TEXT NOT NULL,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "result" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "inspection_items_pkey" PRIMARY KEY ("item_id")
);

-- CreateTable
CREATE TABLE "handovers" (
    "handover_id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "handed_by" INTEGER NOT NULL,
    "receiver_name" TEXT NOT NULL,
    "receiver_phone" TEXT NOT NULL,
    "handover_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_rating" INTEGER,
    "feedback" TEXT,

    CONSTRAINT "handovers_pkey" PRIMARY KEY ("handover_id")
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "sla_policy_id" SERIAL NOT NULL,
    "service_type" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "time_limit" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'WORK_HOURS',

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("sla_policy_id")
);

-- CreateTable
CREATE TABLE "sla_instances" (
    "sla_id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "sla_policy_id" INTEGER NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "sla_instances_pkey" PRIMARY KEY ("sla_id")
);

-- CreateTable
CREATE TABLE "sla_pauses" (
    "pause_id" SERIAL NOT NULL,
    "sla_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "max_allowed_mins" INTEGER NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_time" TIMESTAMP(3),

    CONSTRAINT "sla_pauses_pkey" PRIMARY KEY ("pause_id")
);

-- CreateTable
CREATE TABLE "sla_events" (
    "event_id" SERIAL NOT NULL,
    "sla_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "sla_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "workflow_transitions" (
    "transition_id" SERIAL NOT NULL,
    "from_status" "CaseStatus" NOT NULL,
    "to_status" "CaseStatus" NOT NULL,
    "condition" TEXT,

    CONSTRAINT "workflow_transitions_pkey" PRIMARY KEY ("transition_id")
);

-- CreateTable
CREATE TABLE "transition_roles" (
    "transition_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,

    CONSTRAINT "transition_roles_pkey" PRIMARY KEY ("transition_id","role_id")
);

-- CreateTable
CREATE TABLE "case_status_history" (
    "history_id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "transition_id" INTEGER,
    "from_status" "CaseStatus" NOT NULL,
    "to_status" "CaseStatus" NOT NULL,
    "reason" TEXT,
    "changed_by" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_status_history_pkey" PRIMARY KEY ("history_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "log_id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "log_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_parameters" (
    "param_code" TEXT NOT NULL,
    "param_name" TEXT NOT NULL,
    "param_value" TEXT NOT NULL,
    "unit" TEXT,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_parameters_pkey" PRIMARY KEY ("param_code")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "roles_role_name_key" ON "roles"("role_name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_user_id_key" ON "customers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "warranty_policies_policy_code_key" ON "warranty_policies"("policy_code");

-- CreateIndex
CREATE UNIQUE INDEX "devices_serial_number_key" ON "devices"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "warranty_cases_case_code_key" ON "warranty_cases"("case_code");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_wo_code_key" ON "work_orders"("wo_code");

-- CreateIndex
CREATE UNIQUE INDEX "parts_sku_key" ON "parts"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "handovers_case_id_key" ON "handovers"("case_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_transitions_from_status_to_status_key" ON "workflow_transitions"("from_status", "to_status");

-- CreateIndex
CREATE INDEX "outbox_events_processed_created_at_idx" ON "outbox_events"("processed", "created_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "warranty_policies"("policy_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_cases" ADD CONSTRAINT "warranty_cases_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_cases" ADD CONSTRAINT "warranty_cases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "warranty_cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_decisions" ADD CONSTRAINT "warranty_decisions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "warranty_cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_decisions" ADD CONSTRAINT "warranty_decisions_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "warranty_cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "warranty_cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("work_order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "work_tasks"("task_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("part_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_parts" ADD CONSTRAINT "work_order_parts_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("work_order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_parts" ADD CONSTRAINT "work_order_parts_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("part_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("work_order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_inspected_by_fkey" FOREIGN KEY ("inspected_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_items" ADD CONSTRAINT "inspection_items_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("inspection_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "warranty_cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_handed_by_fkey" FOREIGN KEY ("handed_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_instances" ADD CONSTRAINT "sla_instances_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "warranty_cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_instances" ADD CONSTRAINT "sla_instances_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies"("sla_policy_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_pauses" ADD CONSTRAINT "sla_pauses_sla_id_fkey" FOREIGN KEY ("sla_id") REFERENCES "sla_instances"("sla_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_events" ADD CONSTRAINT "sla_events_sla_id_fkey" FOREIGN KEY ("sla_id") REFERENCES "sla_instances"("sla_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transition_roles" ADD CONSTRAINT "transition_roles_transition_id_fkey" FOREIGN KEY ("transition_id") REFERENCES "workflow_transitions"("transition_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transition_roles" ADD CONSTRAINT "transition_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "warranty_cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_transition_id_fkey" FOREIGN KEY ("transition_id") REFERENCES "workflow_transitions"("transition_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
