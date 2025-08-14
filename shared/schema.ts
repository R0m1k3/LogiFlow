import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
  date,
  decimal,
  primaryKey,
  bigint,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - mandatory for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - supports both Replit Auth and local auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  username: varchar("username").unique().notNull(), // For simple login
  email: varchar("email").unique(),
  name: varchar("name"), // Single name field for compatibility
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  password: varchar("password"), // For local auth only
  role: varchar("role").notNull().default("employee"), // Legacy role field for compatibility
  passwordChanged: boolean("password_changed").default(false), // Track if default password was changed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Store/Group management
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  color: varchar("color").default("#1976D2"), // hex color code
  // Configuration NocoDB pour vérification automatique des factures
  nocodbConfigId: integer("nocodb_config_id"), // Référence vers la configuration NocoDB globale
  nocodbTableName: varchar("nocodb_table_name"), // Nom de la table spécifique au magasin
  nocodbTableId: varchar("nocodb_table_id"), // ID réel de la table dans NocoDB (ex: mrr733dfb8wtt9b)
  // Mapping des colonnes par magasin dans leur table NocoDB
  invoiceColumnName: varchar("invoice_column_name"), // Nom de la colonne facture dans leur table
  nocodbBlColumnName: varchar("nocodb_bl_column_name"), // Nom de la colonne BL dans leur table
  nocodbAmountColumnName: varchar("nocodb_amount_column_name"), // Nom de la colonne montant dans leur table
  nocodbSupplierColumnName: varchar("nocodb_supplier_column_name"), // Nom de la colonne fournisseur dans leur table
  webhookUrl: varchar("webhook_url", { length: 500 }), // URL de webhook pour notifications par magasin
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User-Group assignments (many-to-many)
export const userGroups = pgTable("user_groups", {
  userId: varchar("user_id").notNull(),
  groupId: integer("group_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Suppliers - Schema exact correspondant à la production
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  contact: varchar("contact"),
  phone: varchar("phone"),
  hasDlc: boolean("has_dlc").default(false), // Coche DLC pour la gestion DLC
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  automaticReconciliation: boolean("automatic_reconciliation").default(false), // Rapprochement automatique BL/Factures
});

// Orders
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull(),
  groupId: integer("group_id").notNull(),
  plannedDate: date("planned_date").notNull(),
  quantity: integer("quantity"), // Optional - will be set when delivery is linked
  unit: varchar("unit"), // Optional - 'palettes' or 'colis'
  status: varchar("status").notNull().default("pending"), // pending, planned, delivered
  notes: text("notes"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Deliveries
export const deliveries = pgTable("deliveries", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id"), // optional link to order
  supplierId: integer("supplier_id").notNull(),
  groupId: integer("group_id").notNull(),
  scheduledDate: date("scheduled_date").notNull(),
  deliveredDate: timestamp("delivered_date"),
  quantity: integer("quantity").notNull(),
  unit: varchar("unit").notNull(), // 'palettes' or 'colis'
  status: varchar("status").notNull().default("planned"), // planned, delivered
  notes: text("notes"),
  // Champs pour le rapprochement BL/Factures
  blNumber: varchar("bl_number"), // Numéro de Bon de Livraison
  blAmount: decimal("bl_amount", { precision: 10, scale: 2 }), // Montant BL
  invoiceReference: varchar("invoice_reference"), // Référence facture
  invoiceAmount: decimal("invoice_amount", { precision: 10, scale: 2 }), // Montant facture
  reconciled: boolean("reconciled").default(false), // Rapprochement effectué
  validatedAt: timestamp("validated_at"), // Date de validation de la livraison
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Publicities
export const publicities = pgTable("publicities", {
  id: serial("id").primaryKey(),
  pubNumber: varchar("pub_number").notNull().unique(),
  designation: text("designation").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  year: integer("year").notNull(),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Publicity Participations
export const publicityParticipations = pgTable("publicity_participations", {
  publicityId: integer("publicity_id").notNull(),
  groupId: integer("group_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.publicityId, table.groupId] })
}));

// Configuration NocoDB globale pour la vérification des factures
export const nocodbConfig = pgTable("nocodb_config", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  baseUrl: varchar("base_url").notNull(),
  projectId: varchar("project_id").notNull(),
  apiToken: varchar("api_token").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Cache de vérification des factures
export const invoiceVerificationCache = pgTable("invoice_verification_cache", {
  id: serial("id").primaryKey(),
  cacheKey: varchar("cache_key", { length: 255 }).notNull(),
  groupId: integer("group_id").notNull(),
  invoiceReference: varchar("invoice_reference", { length: 255 }).notNull(),
  supplierName: varchar("supplier_name", { length: 255 }),
  exists: boolean("exists").notNull(),
  matchType: varchar("match_type", { length: 50 }).notNull(),
  errorMessage: text("error_message"),
  cacheHit: boolean("cache_hit").default(false),
  apiCallTime: integer("api_call_time"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});





// Customer Orders (Commandes Client)
export const customerOrders = pgTable("customer_orders", {
  id: serial("id").primaryKey(),
  // Information de commande
  orderTaker: varchar("order_taker").notNull(), // Qui a pris la commande
  customerName: varchar("customer_name").notNull(), // Nom du client
  customerPhone: varchar("customer_phone").notNull(), // N° de téléphone
  customerEmail: varchar("customer_email"), // Email du client (optionnel)
  
  // Information produit
  productDesignation: text("product_designation").notNull(), // Désignation du produit
  productReference: varchar("product_reference"), // Référence
  gencode: varchar("gencode").notNull(), // Code à barres (obligatoire)
  quantity: integer("quantity").notNull().default(1), // Quantité commandée
  supplierId: integer("supplier_id").notNull(), // Fournisseur
  
  // Statuts
  status: varchar("status").notNull().default("En attente de Commande"), // Statut du produit
  
  // Options financières
  deposit: decimal("deposit", { precision: 10, scale: 2 }).default("0.00"), // Acompte
  isPromotionalPrice: boolean("is_promotional_price").default(false), // Prix publicité
  
  // Communication client
  customerNotified: boolean("customer_notified").default(false), // Client appelé
  
  // Notes additionnelles
  notes: text("notes"), // Notes sur la commande
  
  // Métadonnées
  groupId: integer("group_id").notNull(), // Magasin
  createdBy: varchar("created_by").notNull(), // Créateur
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});



// DLC Products (Date Limite de Consommation)
export const dlcProducts = pgTable("dlc_products", {
  id: serial("id").primaryKey(),
  productName: varchar("product_name").notNull(), // Nom du produit
  gencode: varchar("gencode"), // Code-barres/gencode EAN13 (optionnel)
  supplierId: integer("supplier_id").notNull(), // ID du fournisseur
  groupId: integer("group_id").notNull(), // ID du magasin/groupe
  expiryDate: date("expiry_date").notNull(), // Date limite de consommation
  dateType: varchar("date_type").notNull().default("dlc"), // Type: dlc, ddm, dluo
  quantity: integer("quantity").notNull().default(1), // Quantité
  unit: varchar("unit").notNull().default("unité"), // Unité (fixe par défaut)
  location: varchar("location").notNull().default("Magasin"), // Emplacement (fixe par défaut)
  alertThreshold: integer("alert_threshold").notNull().default(15), // Seuil d'alerte fixe à 15 jours
  status: varchar("status").notNull().default("en_cours"), // Statut: en_cours, expires_soon, expires, valides
  notes: text("notes"), // Notes (optionnel)
  createdBy: varchar("created_by").notNull(), // Créateur
  validatedBy: varchar("validated_by"), // Validé par (optionnel)
  validatedAt: timestamp("validated_at"), // Date de validation (optionnel)
  createdAt: timestamp("created_at").defaultNow(), // Date de création
  updatedAt: timestamp("updated_at").defaultNow(), // Date de mise à jour
});

// Tasks table
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(), // Titre de la tâche (requis)
  description: text("description"), // Description de la tâche (optionnel)
  dueDate: timestamp("due_date"), // Date d'échéance (optionnel)
  priority: varchar("priority").notNull().default("medium"), // low, medium, high
  status: varchar("status").notNull().default("pending"), // pending, completed
  assignedTo: text("assigned_to").notNull(), // Utilisateur responsable (champ libre)
  createdBy: varchar("created_by").notNull(), // Utilisateur créateur
  groupId: integer("group_id").notNull(), // Magasin/groupe associé
  completedAt: timestamp("completed_at"), // Date de completion
  completedBy: varchar("completed_by"), // Utilisateur qui a complété la tâche
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  userGroups: many(userGroups),
  createdOrders: many(orders),
  createdDeliveries: many(deliveries),
  createdPublicities: many(publicities),
  createdCustomerOrders: many(customerOrders),
  createdDlcProducts: many(dlcProducts),
  createdTasks: many(tasks),
  assignedTasks: many(tasks),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  userGroups: many(userGroups),
  orders: many(orders),
  deliveries: many(deliveries),
  publicityParticipations: many(publicityParticipations),
  customerOrders: many(customerOrders),
  dlcProducts: many(dlcProducts),
  tasks: many(tasks),

}));

export const userGroupsRelations = relations(userGroups, ({ one }) => ({
  user: one(users, {
    fields: [userGroups.userId],
    references: [users.id],
  }),
  group: one(groups, {
    fields: [userGroups.groupId],
    references: [groups.id],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  orders: many(orders),
  deliveries: many(deliveries),
  dlcProducts: many(dlcProducts),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [orders.supplierId],
    references: [suppliers.id],
  }),
  group: one(groups, {
    fields: [orders.groupId],
    references: [groups.id],
  }),
  creator: one(users, {
    fields: [orders.createdBy],
    references: [users.id],
  }),
  deliveries: many(deliveries),
}));

export const deliveriesRelations = relations(deliveries, ({ one }) => ({
  order: one(orders, {
    fields: [deliveries.orderId],
    references: [orders.id],
  }),
  supplier: one(suppliers, {
    fields: [deliveries.supplierId],
    references: [suppliers.id],
  }),
  group: one(groups, {
    fields: [deliveries.groupId],
    references: [groups.id],
  }),
  creator: one(users, {
    fields: [deliveries.createdBy],
    references: [users.id],
  }),
}));

export const publicitiesRelations = relations(publicities, ({ one, many }) => ({
  creator: one(users, {
    fields: [publicities.createdBy],
    references: [users.id],
  }),
  participations: many(publicityParticipations),
}));

export const publicityParticipationsRelations = relations(publicityParticipations, ({ one }) => ({
  publicity: one(publicities, {
    fields: [publicityParticipations.publicityId],
    references: [publicities.id],
  }),
  group: one(groups, {
    fields: [publicityParticipations.groupId],
    references: [groups.id],
  }),
}));



export const customerOrdersRelations = relations(customerOrders, ({ one }) => ({
  group: one(groups, {
    fields: [customerOrders.groupId],
    references: [groups.id],
  }),
  creator: one(users, {
    fields: [customerOrders.createdBy],
    references: [users.id],
  }),
  supplier: one(suppliers, {
    fields: [customerOrders.supplierId],
    references: [suppliers.id],
  }),
}));

export const dlcProductsRelations = relations(dlcProducts, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [dlcProducts.supplierId],
    references: [suppliers.id],
  }),
  group: one(groups, {
    fields: [dlcProducts.groupId],
    references: [groups.id],
  }),
  creator: one(users, {
    fields: [dlcProducts.createdBy],
    references: [users.id],
  }),
  validator: one(users, {
    fields: [dlcProducts.validatedBy],
    references: [users.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
  }),
  group: one(groups, {
    fields: [tasks.groupId],
    references: [groups.id],
  }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users).pick({
  id: true,
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  name: true,
  profileImageUrl: true,
  password: true,
  role: true,
  passwordChanged: true,
}).extend({
  email: z.union([z.string().email(), z.literal("")]).optional(),
});

export const insertGroupSchema = createInsertSchema(groups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDeliverySchema = createInsertSchema(deliveries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserGroupSchema = createInsertSchema(userGroups).omit({
  createdAt: true,
});

export const insertPublicitySchema = createInsertSchema(publicities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPublicityParticipationSchema = createInsertSchema(publicityParticipations).omit({
  createdAt: true,
});





export const insertCustomerOrderSchema = createInsertSchema(customerOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Frontend-compatible schema with different field names
export const insertCustomerOrderFrontendSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  contactNumber: z.string().min(1, "Contact number is required"), // Maps to customerPhone
  productName: z.string().min(1, "Product name is required"), // Maps to productDesignation
  productDescription: z.string().optional(), // Optional description
  quantity: z.coerce.number().int().positive().default(1),
  groupId: z.coerce.number().int().positive(),
  isPickup: z.boolean().default(false),
  notes: z.string().optional(),
  // Optional fields with defaults
  orderTaker: z.string().optional(), // Will be set to creator name if not provided
  gencode: z.string().optional().default(""), // Will be empty if not provided
  supplierId: z.coerce.number().int().positive().optional().default(1), // Default supplier ID
  deposit: z.coerce.number().optional().default(0),
  isPromotionalPrice: z.boolean().default(false),
  customerEmail: z.string().email().optional().or(z.literal("")),
  productReference: z.string().optional(),
});

export const insertDlcProductSchema = createInsertSchema(dlcProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Frontend-compatible schema with dlcDate instead of expiryDate
export const insertDlcProductFrontendSchema = insertDlcProductSchema
  .omit({ expiryDate: true })
  .extend({ dlcDate: z.coerce.date() });

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  completedBy: true,
}).extend({
  dueDate: z.coerce.date().optional().nullable(), // Convertit automatiquement les chaînes en Date
});

export const insertNocodbConfigSchema = createInsertSchema(nocodbConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceVerificationCacheSchema = createInsertSchema(invoiceVerificationCache).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const databaseBackups = pgTable("database_backups", {
  id: varchar("id", { length: 255 }).primaryKey(),
  filename: varchar("filename", { length: 255 }).notNull(),
  description: text("description"),
  size: bigint("size", { mode: "number" }).default(0),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  tablesCount: integer("tables_count").default(0),
  status: varchar("status", { length: 50 }).default("creating"),
  backupType: varchar("backup_type", { length: 10 }).default("manual"),
});

export const insertDatabaseBackupSchema = createInsertSchema(databaseBackups);

export type InsertNocodbConfig = z.infer<typeof insertNocodbConfigSchema>;
export type InsertInvoiceVerificationCache = z.infer<typeof insertInvoiceVerificationCacheSchema>;
export type DatabaseBackup = typeof databaseBackups.$inferSelect;
export type InsertDatabaseBackup = z.infer<typeof insertDatabaseBackupSchema>;

// Types
export type User = typeof users.$inferSelect;
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type Group = typeof groups.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Delivery = typeof deliveries.$inferSelect;
export type InsertDelivery = z.infer<typeof insertDeliverySchema>;
export type UserGroup = typeof userGroups.$inferSelect;
export type InsertUserGroup = z.infer<typeof insertUserGroupSchema>;
export type Publicity = typeof publicities.$inferSelect;
export type InsertPublicity = z.infer<typeof insertPublicitySchema>;
export type PublicityParticipation = typeof publicityParticipations.$inferSelect;
export type InsertPublicityParticipation = z.infer<typeof insertPublicityParticipationSchema>;
export type CustomerOrder = typeof customerOrders.$inferSelect;
export type InsertCustomerOrder = z.infer<typeof insertCustomerOrderSchema>;
export type DlcProduct = typeof dlcProducts.$inferSelect;
export type InsertDlcProduct = z.infer<typeof insertDlcProductSchema>;
export type DlcProductFrontend = Omit<DlcProduct, 'expiryDate'> & { dlcDate: Date };
export type InsertDlcProductFrontend = z.infer<typeof insertDlcProductFrontendSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

// Complex types with relations

export type OrderWithRelations = Order & {
  supplier: Supplier;
  group: Group;
  creator: User;
  deliveries?: DeliveryWithRelations[];
};

export type DeliveryWithRelations = Delivery & {
  supplier: Supplier;
  group: Group;
  creator: User;
  order?: OrderWithRelations;
};

export type PublicityWithRelations = Publicity & {
  creator: User;
  participations: (PublicityParticipation & { group: Group })[];
};

export type CustomerOrderWithRelations = CustomerOrder & {
  supplier: Supplier;
  group: Group;
  creator: User;
};

export type DlcProductWithRelations = DlcProduct & {
  supplier: Supplier;
  group: Group;
  creator: User;
  validator?: User;
};

export type UserWithGroups = User & {
  userGroups: (UserGroup & { group: Group })[];
};

export type NocodbConfig = typeof nocodbConfig.$inferSelect;
export type InvoiceVerificationCache = typeof invoiceVerificationCache.$inferSelect;

// Task with relations type
export type TaskWithRelations = Task & {
  creator: User;
  group: Group;
};

// SAV (Service Après-Vente) Tables
export const savTickets = pgTable("sav_tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: varchar("ticket_number", { length: 50 }).notNull(),
  supplierId: integer("supplier_id").notNull(),
  groupId: integer("group_id").notNull(),
  productGencode: varchar("product_gencode", { length: 255 }).notNull(),
  productReference: varchar("product_reference", { length: 255 }),
  productDesignation: varchar("product_designation", { length: 500 }).notNull(),
  problemType: varchar("problem_type", { length: 100 }).notNull(),
  problemDescription: text("problem_description").notNull(),
  resolutionDescription: text("resolution_description"),
  status: varchar("status", { length: 50 }).notNull().default("nouveau"),
  priority: varchar("priority", { length: 50 }).notNull().default("normale"), // normale, haute, critique
  clientName: varchar("client_name", { length: 255 }),
  clientPhone: varchar("client_phone", { length: 255 }),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
});

export const savTicketHistory = pgTable("sav_ticket_history", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  action: varchar("action", { length: 100 }).notNull(), // status_change, comment, resolution, etc.
  description: text("description"),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// SAV Relations
export const savTicketRelations = relations(savTickets, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [savTickets.supplierId],
    references: [suppliers.id],
  }),
  group: one(groups, {
    fields: [savTickets.groupId],
    references: [groups.id],
  }),
  creator: one(users, {
    fields: [savTickets.createdBy],
    references: [users.id],
  }),
  history: many(savTicketHistory),
}));

export const savTicketHistoryRelations = relations(savTicketHistory, ({ one }) => ({
  ticket: one(savTickets, {
    fields: [savTicketHistory.ticketId],
    references: [savTickets.id],
  }),
  creator: one(users, {
    fields: [savTicketHistory.createdBy],
    references: [users.id],
  }),
}));

// SAV Zod Schemas
export const insertSavTicketSchema = createInsertSchema(savTickets).omit({
  id: true,
  ticketNumber: true, // Auto-generated server-side
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  closedAt: true,
}).extend({
  priority: z.enum(["faible", "normale", "haute", "critique"]).default("normale"),
  status: z.enum(["nouveau", "en_cours", "attente_pieces", "attente_echange", "resolu", "ferme"]).default("nouveau"),
  problemType: z.enum(["defectueux", "pieces_manquantes", "non_conforme", "autre"]).default("defectueux"),
});

export const insertSavTicketHistorySchema = createInsertSchema(savTicketHistory).omit({
  id: true,
  createdAt: true,
});

// SAV Types
export type SavTicket = typeof savTickets.$inferSelect;
export type InsertSavTicket = z.infer<typeof insertSavTicketSchema>;
export type SavTicketHistory = typeof savTicketHistory.$inferSelect;
export type InsertSavTicketHistory = z.infer<typeof insertSavTicketHistorySchema>;

export type SavTicketWithRelations = SavTicket & {
  supplier: Supplier;
  group: Group;
  creator: User;
  history: (SavTicketHistory & { creator: User })[];
};

export type SavTicketHistoryWithCreator = SavTicketHistory & {
  creator: User;
};
