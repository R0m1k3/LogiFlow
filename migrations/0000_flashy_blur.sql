-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer,
	"supplier_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	"delivered_date" timestamp,
	"quantity" integer NOT NULL,
	"unit" varchar NOT NULL,
	"status" varchar DEFAULT 'planned' NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"bl_number" varchar,
	"bl_amount" numeric(10, 2),
	"invoice_reference" varchar,
	"invoice_amount" numeric(10, 2),
	"reconciled" boolean DEFAULT false,
	"scheduled_date" date NOT NULL,
	"notes" text,
	"validated_at" timestamp,
	CONSTRAINT "deliveries_status_check_fixed" CHECK ((status)::text = ANY ((ARRAY['planned'::character varying, 'delivered'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	"planned_date" date NOT NULL,
	"quantity" integer,
	"unit" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"notes" text,
	CONSTRAINT "orders_status_check" CHECK ((status)::text = ANY ((ARRAY['pending'::character varying, 'planned'::character varying, 'delivered'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"color" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"nocodb_config_id" integer,
	"nocodb_table_id" varchar,
	"nocodb_table_name" varchar,
	"invoice_column_name" varchar DEFAULT 'Ref Facture'
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"contact" varchar,
	"phone" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"has_dlc" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "user_groups" (
	"user_id" varchar NOT NULL,
	"group_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "publicities" (
	"id" serial PRIMARY KEY NOT NULL,
	"pub_number" varchar(255) NOT NULL,
	"designation" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"year" integer NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" varchar DEFAULT 'employee' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"password" varchar,
	"username" varchar,
	"password_changed" boolean DEFAULT false,
	"name" varchar(255),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_key" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"description" text,
	"color" varchar(20) DEFAULT '#6b7280',
	"is_system" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "roles_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"action" varchar(50) NOT NULL,
	"resource" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"is_system" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "permissions_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "nocodb_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"base_url" varchar NOT NULL,
	"api_token" varchar NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"project_id" varchar
);
--> statement-breakpoint
CREATE TABLE "customer_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_taker" varchar NOT NULL,
	"customer_name" varchar NOT NULL,
	"customer_phone" varchar NOT NULL,
	"product_designation" text NOT NULL,
	"product_reference" varchar,
	"gencode" varchar,
	"status" varchar DEFAULT 'En attente de Commande' NOT NULL,
	"deposit" numeric(10, 2) DEFAULT '0.00',
	"is_promotional_price" boolean DEFAULT false,
	"customer_notified" boolean DEFAULT false,
	"group_id" integer NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"supplier_id" integer,
	"quantity" integer DEFAULT 1 NOT NULL,
	"customer_email" varchar(255),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "dlc_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"expiry_date" date NOT NULL,
	"date_type" varchar(10) NOT NULL,
	"quantity" integer NOT NULL,
	"unit" varchar(50) NOT NULL,
	"supplier_id" integer NOT NULL,
	"location" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'en_cours' NOT NULL,
	"notes" text,
	"alert_threshold" integer DEFAULT 3 NOT NULL,
	"validated_at" timestamp,
	"validated_by" varchar(255),
	"group_id" integer NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"gencode" varchar,
	"name" varchar(255),
	"dlc_date" date,
	"product_code" varchar(255),
	"description" text,
	CONSTRAINT "dlc_products_date_type_check" CHECK ((date_type)::text = ANY ((ARRAY['dlc'::character varying, 'ddm'::character varying, 'dluo'::character varying])::text[])),
	CONSTRAINT "dlc_products_status_check" CHECK ((status)::text = ANY ((ARRAY['en_cours'::character varying, 'expires_soon'::character varying, 'expires'::character varying, 'valides'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"due_date" timestamp,
	"group_id" integer NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"completed_at" timestamp,
	"assigned_to" text DEFAULT '' NOT NULL,
	"completed_by" varchar(255),
	CONSTRAINT "tasks_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])),
	CONSTRAINT "tasks_priority_check" CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))
);
--> statement-breakpoint
CREATE TABLE "publicity_participations" (
	"publicity_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "publicity_participations_pkey" PRIMARY KEY("publicity_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "role_permissions_pkey" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" varchar(255) NOT NULL,
	"role_id" integer NOT NULL,
	"assigned_by" varchar(255) NOT NULL,
	"assigned_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "user_roles_pkey" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "dlc_products" ADD CONSTRAINT "dlc_products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dlc_products" ADD CONSTRAINT "dlc_products_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dlc_products" ADD CONSTRAINT "dlc_products_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dlc_products" ADD CONSTRAINT "dlc_products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicity_participations" ADD CONSTRAINT "publicity_participations_publicity_id_fkey" FOREIGN KEY ("publicity_id") REFERENCES "public"."publicities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicity_participations" ADD CONSTRAINT "publicity_participations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_deliveries_bl_number" ON "deliveries" USING btree ("bl_number" text_ops);--> statement-breakpoint
CREATE INDEX "idx_deliveries_group_id" ON "deliveries" USING btree ("group_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_deliveries_invoice_ref" ON "deliveries" USING btree ("invoice_reference" text_ops);--> statement-breakpoint
CREATE INDEX "idx_deliveries_status" ON "deliveries" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_orders_group_id" ON "orders" USING btree ("group_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_orders_status" ON "orders" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_publicities_start_date" ON "publicities" USING btree ("start_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_publicities_year" ON "publicities" USING btree ("year" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_dlc_products_expiry_date" ON "dlc_products" USING btree ("expiry_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_dlc_products_group_id" ON "dlc_products" USING btree ("group_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_dlc_products_status" ON "dlc_products" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_dlc_products_supplier_id" ON "dlc_products" USING btree ("supplier_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_role_permissions_permission_id" ON "role_permissions" USING btree ("permission_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_role_permissions_role_id" ON "role_permissions" USING btree ("role_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_user_roles_assigned_by" ON "user_roles" USING btree ("assigned_by" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_roles_role_id" ON "user_roles" USING btree ("role_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_user_roles_user_id" ON "user_roles" USING btree ("user_id" text_ops);
*/