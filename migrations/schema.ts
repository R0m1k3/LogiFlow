import { pgTable, index, check, serial, integer, timestamp, varchar, numeric, boolean, date, text, jsonb, json, unique, foreignKey, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const deliveries = pgTable("deliveries", {
	id: serial().primaryKey().notNull(),
	orderId: integer("order_id"),
	supplierId: integer("supplier_id").notNull(),
	groupId: integer("group_id").notNull(),
	deliveredDate: timestamp("delivered_date", { mode: 'string' }),
	quantity: integer().notNull(),
	unit: varchar().notNull(),
	status: varchar().default('planned').notNull(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	blNumber: varchar("bl_number"),
	blAmount: numeric("bl_amount", { precision: 10, scale:  2 }),
	invoiceReference: varchar("invoice_reference"),
	invoiceAmount: numeric("invoice_amount", { precision: 10, scale:  2 }),
	reconciled: boolean().default(false),
	scheduledDate: date("scheduled_date").notNull(),
	notes: text(),
	validatedAt: timestamp("validated_at", { mode: 'string' }),
}, (table) => [
	index("idx_deliveries_bl_number").using("btree", table.blNumber.asc().nullsLast().op("text_ops")),
	index("idx_deliveries_group_id").using("btree", table.groupId.asc().nullsLast().op("int4_ops")),
	index("idx_deliveries_invoice_ref").using("btree", table.invoiceReference.asc().nullsLast().op("text_ops")),
	index("idx_deliveries_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	check("deliveries_status_check_fixed", sql`(status)::text = ANY ((ARRAY['planned'::character varying, 'delivered'::character varying])::text[])`),
]);

export const orders = pgTable("orders", {
	id: serial().primaryKey().notNull(),
	supplierId: integer("supplier_id").notNull(),
	groupId: integer("group_id").notNull(),
	plannedDate: date("planned_date").notNull(),
	quantity: integer(),
	unit: varchar(),
	status: varchar().default('pending').notNull(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	notes: text(),
}, (table) => [
	index("idx_orders_group_id").using("btree", table.groupId.asc().nullsLast().op("int4_ops")),
	index("idx_orders_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	check("orders_status_check", sql`(status)::text = ANY ((ARRAY['pending'::character varying, 'planned'::character varying, 'delivered'::character varying])::text[])`),
]);

export const groups = pgTable("groups", {
	id: serial().primaryKey().notNull(),
	name: varchar().notNull(),
	color: varchar().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	nocodbConfigId: integer("nocodb_config_id"),
	nocodbTableId: varchar("nocodb_table_id"),
	nocodbTableName: varchar("nocodb_table_name"),
	invoiceColumnName: varchar("invoice_column_name").default('Ref Facture'),
});

export const sessions = pgTable("sessions", {
	sid: varchar().primaryKey().notNull(),
	sess: jsonb().notNull(),
	expire: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const suppliers = pgTable("suppliers", {
	id: serial().primaryKey().notNull(),
	name: varchar().notNull(),
	contact: varchar(),
	phone: varchar(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	hasDlc: boolean("has_dlc").default(false),
});

export const userGroups = pgTable("user_groups", {
	userId: varchar("user_id").notNull(),
	groupId: integer("group_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const publicities = pgTable("publicities", {
	id: serial().primaryKey().notNull(),
	pubNumber: varchar("pub_number", { length: 255 }).notNull(),
	designation: text().notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	year: integer().notNull(),
	createdBy: varchar("created_by", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_publicities_start_date").using("btree", table.startDate.asc().nullsLast().op("date_ops")),
	index("idx_publicities_year").using("btree", table.year.asc().nullsLast().op("int4_ops")),
]);

export const session = pgTable("session", {
	sid: varchar().primaryKey().notNull(),
	sess: json().notNull(),
	expire: timestamp({ precision: 6, mode: 'string' }).notNull(),
});

export const users = pgTable("users", {
	id: varchar().primaryKey().notNull(),
	email: varchar(),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	profileImageUrl: varchar("profile_image_url"),
	role: varchar().default('employee').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	password: varchar(),
	username: varchar(),
	passwordChanged: boolean("password_changed").default(false),
	name: varchar({ length: 255 }),
}, (table) => [
	unique("users_email_unique").on(table.email),
	unique("users_username_key").on(table.username),
]);

export const roles = pgTable("roles", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	displayName: varchar("display_name", { length: 200 }).notNull(),
	description: text(),
	color: varchar({ length: 20 }).default('#6b7280'),
	isSystem: boolean("is_system").default(false),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("roles_name_key").on(table.name),
]);

export const permissions = pgTable("permissions", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	displayName: varchar("display_name", { length: 200 }).notNull(),
	description: text(),
	category: varchar({ length: 50 }).notNull(),
	action: varchar({ length: 50 }).notNull(),
	resource: varchar({ length: 50 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	isSystem: boolean("is_system").default(false),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("permissions_name_key").on(table.name),
]);

export const nocodbConfig = pgTable("nocodb_config", {
	id: serial().primaryKey().notNull(),
	name: varchar().notNull(),
	baseUrl: varchar("base_url").notNull(),
	apiToken: varchar("api_token").notNull(),
	description: text(),
	isActive: boolean("is_active").default(true),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	projectId: varchar("project_id"),
});

export const customerOrders = pgTable("customer_orders", {
	id: serial().primaryKey().notNull(),
	orderTaker: varchar("order_taker").notNull(),
	customerName: varchar("customer_name").notNull(),
	customerPhone: varchar("customer_phone").notNull(),
	productDesignation: text("product_designation").notNull(),
	productReference: varchar("product_reference"),
	gencode: varchar(),
	status: varchar().default('En attente de Commande').notNull(),
	deposit: numeric({ precision: 10, scale:  2 }).default('0.00'),
	isPromotionalPrice: boolean("is_promotional_price").default(false),
	customerNotified: boolean("customer_notified").default(false),
	groupId: integer("group_id").notNull(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	supplierId: integer("supplier_id"),
	quantity: integer().default(1).notNull(),
	customerEmail: varchar("customer_email", { length: 255 }),
	notes: text(),
});

export const dlcProducts = pgTable("dlc_products", {
	id: serial().primaryKey().notNull(),
	productName: varchar("product_name", { length: 255 }).notNull(),
	expiryDate: date("expiry_date").notNull(),
	dateType: varchar("date_type", { length: 10 }).notNull(),
	quantity: integer().notNull(),
	unit: varchar({ length: 50 }).notNull(),
	supplierId: integer("supplier_id").notNull(),
	location: varchar({ length: 255 }).notNull(),
	status: varchar({ length: 20 }).default('en_cours').notNull(),
	notes: text(),
	alertThreshold: integer("alert_threshold").default(3).notNull(),
	validatedAt: timestamp("validated_at", { mode: 'string' }),
	validatedBy: varchar("validated_by", { length: 255 }),
	groupId: integer("group_id").notNull(),
	createdBy: varchar("created_by", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	gencode: varchar(),
	name: varchar({ length: 255 }),
	dlcDate: date("dlc_date"),
	productCode: varchar("product_code", { length: 255 }),
	description: text(),
}, (table) => [
	index("idx_dlc_products_expiry_date").using("btree", table.expiryDate.asc().nullsLast().op("date_ops")),
	index("idx_dlc_products_group_id").using("btree", table.groupId.asc().nullsLast().op("int4_ops")),
	index("idx_dlc_products_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_dlc_products_supplier_id").using("btree", table.supplierId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: "dlc_products_supplier_id_fkey"
		}),
	foreignKey({
			columns: [table.validatedBy],
			foreignColumns: [users.id],
			name: "dlc_products_validated_by_fkey"
		}),
	foreignKey({
			columns: [table.groupId],
			foreignColumns: [groups.id],
			name: "dlc_products_group_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "dlc_products_created_by_fkey"
		}),
	check("dlc_products_date_type_check", sql`(date_type)::text = ANY ((ARRAY['dlc'::character varying, 'ddm'::character varying, 'dluo'::character varying])::text[])`),
	check("dlc_products_status_check", sql`(status)::text = ANY ((ARRAY['en_cours'::character varying, 'expires_soon'::character varying, 'expires'::character varying, 'valides'::character varying])::text[])`),
]);

export const tasks = pgTable("tasks", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	status: text().default('pending').notNull(),
	priority: text().default('medium').notNull(),
	dueDate: timestamp("due_date", { mode: 'string' }),
	groupId: integer("group_id").notNull(),
	createdBy: text("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	assignedTo: text("assigned_to").default(').notNull(),
	completedBy: varchar("completed_by", { length: 255 }),
}, (table) => [
	foreignKey({
			columns: [table.completedBy],
			foreignColumns: [users.id],
			name: "tasks_completed_by_fkey"
		}),
	foreignKey({
			columns: [table.groupId],
			foreignColumns: [groups.id],
			name: "tasks_group_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "tasks_created_by_fkey"
		}),
	check("tasks_status_check", sql`status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])`),
	check("tasks_priority_check", sql`priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])`),
]);

export const publicityParticipations = pgTable("publicity_participations", {
	publicityId: integer("publicity_id").notNull(),
	groupId: integer("group_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.publicityId],
			foreignColumns: [publicities.id],
			name: "publicity_participations_publicity_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.groupId],
			foreignColumns: [groups.id],
			name: "publicity_participations_group_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.publicityId, table.groupId], name: "publicity_participations_pkey"}),
]);

export const rolePermissions = pgTable("role_permissions", {
	roleId: integer("role_id").notNull(),
	permissionId: integer("permission_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_role_permissions_permission_id").using("btree", table.permissionId.asc().nullsLast().op("int4_ops")),
	index("idx_role_permissions_role_id").using("btree", table.roleId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "role_permissions_role_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.permissionId],
			foreignColumns: [permissions.id],
			name: "role_permissions_permission_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.roleId, table.permissionId], name: "role_permissions_pkey"}),
]);

export const userRoles = pgTable("user_roles", {
	userId: varchar("user_id", { length: 255 }).notNull(),
	roleId: integer("role_id").notNull(),
	assignedBy: varchar("assigned_by", { length: 255 }).notNull(),
	assignedAt: timestamp("assigned_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_user_roles_assigned_by").using("btree", table.assignedBy.asc().nullsLast().op("text_ops")),
	index("idx_user_roles_role_id").using("btree", table.roleId.asc().nullsLast().op("int4_ops")),
	index("idx_user_roles_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_roles_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "user_roles_role_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.userId, table.roleId], name: "user_roles_pkey"}),
]);
