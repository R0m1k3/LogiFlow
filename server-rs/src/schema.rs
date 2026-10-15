// Généré par scripts/gen-rust-schema.ts à partir de shared/schema.ts : ne pas modifier à la main.
// Une structure par table (clés, ordre et formats JSON de Drizzle) et son schéma
// d'insertion drizzle-zod (createInsertSchema).
#![allow(dead_code)]

use chrono::{NaiveDate, NaiveDateTime};
use rust_decimal::Decimal;
use serde::Serialize;
use sqlx::FromRow;

use crate::db::{Col, Table};
use crate::zod::{Field, Object};

/// Table avoirs
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct AvoirsRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "supplierId")]
    pub supplier_id: i32,
    #[serde(rename = "groupId")]
    pub group_id: i32,
    #[serde(rename = "invoiceReference")]
    pub invoice_reference: Option<String>,
    #[serde(rename = "amount", serialize_with = "crate::json::numeric_opt::<2, _>")]
    pub amount: Option<Decimal>,
    #[serde(rename = "comment")]
    pub comment: Option<String>,
    #[serde(rename = "commercialProcessed")]
    pub commercial_processed: Option<bool>,
    #[serde(rename = "status")]
    pub status: String,
    #[serde(rename = "webhookSent")]
    pub webhook_sent: Option<bool>,
    #[serde(rename = "nocodbVerified")]
    pub nocodb_verified: Option<bool>,
    #[serde(rename = "nocodbVerifiedAt", serialize_with = "crate::json::ts_opt")]
    pub nocodb_verified_at: Option<NaiveDateTime>,
    #[serde(rename = "processedAt", serialize_with = "crate::json::ts_opt")]
    pub processed_at: Option<NaiveDateTime>,
    #[serde(rename = "createdBy")]
    pub created_by: String,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

impl Table for AvoirsRow {
    const TABLE: &'static str = "avoirs";
    const COLUMNS: &'static str = "\"id\", \"supplier_id\", \"group_id\", \"invoice_reference\", \"amount\", \"comment\", \"commercial_processed\", \"status\", \"webhook_sent\", \"nocodb_verified\", \"nocodb_verified_at\", \"processed_at\", \"created_by\", \"created_at\", \"updated_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "supplierId",
            column: "supplier_id",
            sql_type: "int4",
        },
        Col {
            key: "groupId",
            column: "group_id",
            sql_type: "int4",
        },
        Col {
            key: "invoiceReference",
            column: "invoice_reference",
            sql_type: "text",
        },
        Col {
            key: "amount",
            column: "amount",
            sql_type: "numeric",
        },
        Col {
            key: "comment",
            column: "comment",
            sql_type: "text",
        },
        Col {
            key: "commercialProcessed",
            column: "commercial_processed",
            sql_type: "bool",
        },
        Col {
            key: "status",
            column: "status",
            sql_type: "text",
        },
        Col {
            key: "webhookSent",
            column: "webhook_sent",
            sql_type: "bool",
        },
        Col {
            key: "nocodbVerified",
            column: "nocodb_verified",
            sql_type: "bool",
        },
        Col {
            key: "nocodbVerifiedAt",
            column: "nocodb_verified_at",
            sql_type: "timestamp",
        },
        Col {
            key: "processedAt",
            column: "processed_at",
            sql_type: "timestamp",
        },
        Col {
            key: "createdBy",
            column: "created_by",
            sql_type: "text",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
    ];
}

impl AvoirsRow {
    /// createInsertSchema(avoirs)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::int32("supplierId"),
            Field::int32("groupId"),
            Field::string("invoiceReference")
                .max_len(255)
                .nullable()
                .optional(),
            Field::string("amount").nullable().optional(),
            Field::string("comment").nullable().optional(),
            Field::boolean("commercialProcessed").nullable().optional(),
            Field::string("status").max_len(50).optional(),
            Field::boolean("webhookSent").nullable().optional(),
            Field::boolean("nocodbVerified").nullable().optional(),
            Field::date("nocodbVerifiedAt").nullable().optional(),
            Field::date("processedAt").nullable().optional(),
            Field::string("createdBy"),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
        ])
    }
}

/// Table contacts
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct ContactsRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "groupId")]
    pub group_id: i32,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "company")]
    pub company: Option<String>,
    #[serde(rename = "role")]
    pub role: Option<String>,
    #[serde(rename = "phone")]
    pub phone: Option<String>,
    #[serde(rename = "email")]
    pub email: Option<String>,
    #[serde(rename = "notes")]
    pub notes: Option<String>,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

impl Table for ContactsRow {
    const TABLE: &'static str = "contacts";
    const COLUMNS: &'static str = "\"id\", \"group_id\", \"name\", \"company\", \"role\", \"phone\", \"email\", \"notes\", \"created_at\", \"updated_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "groupId",
            column: "group_id",
            sql_type: "int4",
        },
        Col {
            key: "name",
            column: "name",
            sql_type: "text",
        },
        Col {
            key: "company",
            column: "company",
            sql_type: "text",
        },
        Col {
            key: "role",
            column: "role",
            sql_type: "text",
        },
        Col {
            key: "phone",
            column: "phone",
            sql_type: "text",
        },
        Col {
            key: "email",
            column: "email",
            sql_type: "text",
        },
        Col {
            key: "notes",
            column: "notes",
            sql_type: "text",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
    ];
}

impl ContactsRow {
    /// createInsertSchema(contacts)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::int32("groupId"),
            Field::string("name"),
            Field::string("company").nullable().optional(),
            Field::string("role").nullable().optional(),
            Field::string("phone").nullable().optional(),
            Field::string("email").nullable().optional(),
            Field::string("notes").nullable().optional(),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
        ])
    }
}

/// Table customer_orders
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct CustomerOrdersRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "orderTaker")]
    pub order_taker: String,
    #[serde(rename = "customerName")]
    pub customer_name: String,
    #[serde(rename = "customerPhone")]
    pub customer_phone: String,
    #[serde(rename = "customerEmail")]
    pub customer_email: Option<String>,
    #[serde(rename = "productDesignation")]
    pub product_designation: String,
    #[serde(rename = "productReference")]
    pub product_reference: Option<String>,
    #[serde(rename = "gencode")]
    pub gencode: String,
    #[serde(rename = "quantity")]
    pub quantity: i32,
    #[serde(rename = "supplierId")]
    pub supplier_id: i32,
    #[serde(rename = "status")]
    pub status: String,
    #[serde(rename = "deposit", serialize_with = "crate::json::numeric_opt::<2, _>")]
    pub deposit: Option<Decimal>,
    #[serde(rename = "isPromotionalPrice")]
    pub is_promotional_price: Option<bool>,
    #[serde(rename = "customerNotified")]
    pub customer_notified: Option<bool>,
    #[serde(rename = "notifiedAt", serialize_with = "crate::json::ts_opt")]
    pub notified_at: Option<NaiveDateTime>,
    #[serde(rename = "notifiedComment")]
    pub notified_comment: Option<String>,
    #[serde(rename = "notes")]
    pub notes: Option<String>,
    #[serde(rename = "groupId")]
    pub group_id: i32,
    #[serde(rename = "createdBy")]
    pub created_by: String,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

impl Table for CustomerOrdersRow {
    const TABLE: &'static str = "customer_orders";
    const COLUMNS: &'static str = "\"id\", \"order_taker\", \"customer_name\", \"customer_phone\", \"customer_email\", \"product_designation\", \"product_reference\", \"gencode\", \"quantity\", \"supplier_id\", \"status\", \"deposit\", \"is_promotional_price\", \"customer_notified\", \"notified_at\", \"notified_comment\", \"notes\", \"group_id\", \"created_by\", \"created_at\", \"updated_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "orderTaker",
            column: "order_taker",
            sql_type: "text",
        },
        Col {
            key: "customerName",
            column: "customer_name",
            sql_type: "text",
        },
        Col {
            key: "customerPhone",
            column: "customer_phone",
            sql_type: "text",
        },
        Col {
            key: "customerEmail",
            column: "customer_email",
            sql_type: "text",
        },
        Col {
            key: "productDesignation",
            column: "product_designation",
            sql_type: "text",
        },
        Col {
            key: "productReference",
            column: "product_reference",
            sql_type: "text",
        },
        Col {
            key: "gencode",
            column: "gencode",
            sql_type: "text",
        },
        Col {
            key: "quantity",
            column: "quantity",
            sql_type: "int4",
        },
        Col {
            key: "supplierId",
            column: "supplier_id",
            sql_type: "int4",
        },
        Col {
            key: "status",
            column: "status",
            sql_type: "text",
        },
        Col {
            key: "deposit",
            column: "deposit",
            sql_type: "numeric",
        },
        Col {
            key: "isPromotionalPrice",
            column: "is_promotional_price",
            sql_type: "bool",
        },
        Col {
            key: "customerNotified",
            column: "customer_notified",
            sql_type: "bool",
        },
        Col {
            key: "notifiedAt",
            column: "notified_at",
            sql_type: "timestamp",
        },
        Col {
            key: "notifiedComment",
            column: "notified_comment",
            sql_type: "text",
        },
        Col {
            key: "notes",
            column: "notes",
            sql_type: "text",
        },
        Col {
            key: "groupId",
            column: "group_id",
            sql_type: "int4",
        },
        Col {
            key: "createdBy",
            column: "created_by",
            sql_type: "text",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
    ];
}

impl CustomerOrdersRow {
    /// createInsertSchema(customer_orders)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::string("orderTaker"),
            Field::string("customerName"),
            Field::string("customerPhone"),
            Field::string("customerEmail").nullable().optional(),
            Field::string("productDesignation"),
            Field::string("productReference").nullable().optional(),
            Field::string("gencode"),
            Field::int32("quantity").optional(),
            Field::int32("supplierId"),
            Field::string("status").optional(),
            Field::string("deposit").nullable().optional(),
            Field::boolean("isPromotionalPrice").nullable().optional(),
            Field::boolean("customerNotified").nullable().optional(),
            Field::date("notifiedAt").nullable().optional(),
            Field::string("notifiedComment").nullable().optional(),
            Field::string("notes").nullable().optional(),
            Field::int32("groupId"),
            Field::string("createdBy"),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
        ])
    }
}

/// Table dashboard_messages
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct DashboardMessagesRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "title")]
    pub title: String,
    #[serde(rename = "content")]
    pub content: String,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(rename = "storeId")]
    pub store_id: Option<i32>,
    #[serde(rename = "createdBy")]
    pub created_by: String,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
}

impl Table for DashboardMessagesRow {
    const TABLE: &'static str = "dashboard_messages";
    const COLUMNS: &'static str =
        "\"id\", \"title\", \"content\", \"type\", \"store_id\", \"created_by\", \"created_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "title",
            column: "title",
            sql_type: "text",
        },
        Col {
            key: "content",
            column: "content",
            sql_type: "text",
        },
        Col {
            key: "type",
            column: "type",
            sql_type: "text",
        },
        Col {
            key: "storeId",
            column: "store_id",
            sql_type: "int4",
        },
        Col {
            key: "createdBy",
            column: "created_by",
            sql_type: "text",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
    ];
}

impl DashboardMessagesRow {
    /// createInsertSchema(dashboard_messages)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::string("title").max_len(255),
            Field::string("content"),
            Field::string("type").max_len(50).optional(),
            Field::int32("storeId").nullable().optional(),
            Field::string("createdBy").max_len(255),
            Field::date("createdAt").nullable().optional(),
        ])
    }
}

/// Table database_backups
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct DatabaseBackupsRow {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "filename")]
    pub filename: String,
    #[serde(rename = "description")]
    pub description: Option<String>,
    #[serde(rename = "size")]
    pub size: Option<i64>,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "createdBy")]
    pub created_by: String,
    #[serde(rename = "tablesCount")]
    pub tables_count: Option<i32>,
    #[serde(rename = "status")]
    pub status: Option<String>,
    #[serde(rename = "backupType")]
    pub backup_type: Option<String>,
}

impl Table for DatabaseBackupsRow {
    const TABLE: &'static str = "database_backups";
    const COLUMNS: &'static str = "\"id\", \"filename\", \"description\", \"size\", \"created_at\", \"created_by\", \"tables_count\", \"status\", \"backup_type\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "text",
        },
        Col {
            key: "filename",
            column: "filename",
            sql_type: "text",
        },
        Col {
            key: "description",
            column: "description",
            sql_type: "text",
        },
        Col {
            key: "size",
            column: "size",
            sql_type: "int8",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "createdBy",
            column: "created_by",
            sql_type: "text",
        },
        Col {
            key: "tablesCount",
            column: "tables_count",
            sql_type: "int4",
        },
        Col {
            key: "status",
            column: "status",
            sql_type: "text",
        },
        Col {
            key: "backupType",
            column: "backup_type",
            sql_type: "text",
        },
    ];
}

impl DatabaseBackupsRow {
    /// createInsertSchema(database_backups)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::string("id").max_len(255),
            Field::string("filename").max_len(255),
            Field::string("description").nullable().optional(),
            Field::safe_integer("size").nullable().optional(),
            Field::date("createdAt").nullable().optional(),
            Field::string("createdBy").max_len(255),
            Field::int32("tablesCount").nullable().optional(),
            Field::string("status").max_len(50).nullable().optional(),
            Field::string("backupType").max_len(10).nullable().optional(),
        ])
    }
}

/// Table deliveries
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct DeliveriesRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "orderId")]
    pub order_id: Option<i32>,
    #[serde(rename = "supplierId")]
    pub supplier_id: i32,
    #[serde(rename = "groupId")]
    pub group_id: i32,
    #[serde(rename = "scheduledDate")]
    pub scheduled_date: NaiveDate,
    #[serde(rename = "deliveredDate", serialize_with = "crate::json::ts_opt")]
    pub delivered_date: Option<NaiveDateTime>,
    #[serde(rename = "quantity")]
    pub quantity: i32,
    #[serde(rename = "unit")]
    pub unit: String,
    #[serde(rename = "status")]
    pub status: String,
    #[serde(rename = "notes")]
    pub notes: Option<String>,
    #[serde(rename = "blNumber")]
    pub bl_number: Option<String>,
    #[serde(rename = "blAmount", serialize_with = "crate::json::numeric_opt::<2, _>")]
    pub bl_amount: Option<Decimal>,
    #[serde(rename = "invoiceReference")]
    pub invoice_reference: Option<String>,
    #[serde(rename = "invoiceAmount", serialize_with = "crate::json::numeric_opt::<2, _>")]
    pub invoice_amount: Option<Decimal>,
    #[serde(
        rename = "invoiceAmountTTC",
        serialize_with = "crate::json::numeric_opt::<2, _>"
    )]
    pub invoice_amount_ttc: Option<Decimal>,
    #[serde(rename = "dueDate", serialize_with = "crate::json::ts_opt")]
    pub due_date: Option<NaiveDateTime>,
    #[serde(rename = "reconciled")]
    pub reconciled: Option<bool>,
    #[serde(rename = "validatedAt", serialize_with = "crate::json::ts_opt")]
    pub validated_at: Option<NaiveDateTime>,
    #[serde(rename = "controlValidated")]
    pub control_validated: Option<bool>,
    #[serde(rename = "controlValidatedBy")]
    pub control_validated_by: Option<String>,
    #[serde(rename = "controlValidatedAt", serialize_with = "crate::json::ts_opt")]
    pub control_validated_at: Option<NaiveDateTime>,
    #[serde(rename = "createdBy")]
    pub created_by: String,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

impl Table for DeliveriesRow {
    const TABLE: &'static str = "deliveries";
    const COLUMNS: &'static str = "\"id\", \"order_id\", \"supplier_id\", \"group_id\", \"scheduled_date\", \"delivered_date\", \"quantity\", \"unit\", \"status\", \"notes\", \"bl_number\", \"bl_amount\", \"invoice_reference\", \"invoice_amount\", \"invoice_amount_ttc\", \"due_date\", \"reconciled\", \"validated_at\", \"control_validated\", \"control_validated_by\", \"control_validated_at\", \"created_by\", \"created_at\", \"updated_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "orderId",
            column: "order_id",
            sql_type: "int4",
        },
        Col {
            key: "supplierId",
            column: "supplier_id",
            sql_type: "int4",
        },
        Col {
            key: "groupId",
            column: "group_id",
            sql_type: "int4",
        },
        Col {
            key: "scheduledDate",
            column: "scheduled_date",
            sql_type: "date",
        },
        Col {
            key: "deliveredDate",
            column: "delivered_date",
            sql_type: "timestamp",
        },
        Col {
            key: "quantity",
            column: "quantity",
            sql_type: "int4",
        },
        Col {
            key: "unit",
            column: "unit",
            sql_type: "text",
        },
        Col {
            key: "status",
            column: "status",
            sql_type: "text",
        },
        Col {
            key: "notes",
            column: "notes",
            sql_type: "text",
        },
        Col {
            key: "blNumber",
            column: "bl_number",
            sql_type: "text",
        },
        Col {
            key: "blAmount",
            column: "bl_amount",
            sql_type: "numeric",
        },
        Col {
            key: "invoiceReference",
            column: "invoice_reference",
            sql_type: "text",
        },
        Col {
            key: "invoiceAmount",
            column: "invoice_amount",
            sql_type: "numeric",
        },
        Col {
            key: "invoiceAmountTTC",
            column: "invoice_amount_ttc",
            sql_type: "numeric",
        },
        Col {
            key: "dueDate",
            column: "due_date",
            sql_type: "timestamp",
        },
        Col {
            key: "reconciled",
            column: "reconciled",
            sql_type: "bool",
        },
        Col {
            key: "validatedAt",
            column: "validated_at",
            sql_type: "timestamp",
        },
        Col {
            key: "controlValidated",
            column: "control_validated",
            sql_type: "bool",
        },
        Col {
            key: "controlValidatedBy",
            column: "control_validated_by",
            sql_type: "text",
        },
        Col {
            key: "controlValidatedAt",
            column: "control_validated_at",
            sql_type: "timestamp",
        },
        Col {
            key: "createdBy",
            column: "created_by",
            sql_type: "text",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
    ];
}

impl DeliveriesRow {
    /// createInsertSchema(deliveries)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::int32("orderId").nullable().optional(),
            Field::int32("supplierId"),
            Field::int32("groupId"),
            Field::string("scheduledDate"),
            Field::date("deliveredDate").nullable().optional(),
            Field::int32("quantity"),
            Field::string("unit"),
            Field::string("status").optional(),
            Field::string("notes").nullable().optional(),
            Field::string("blNumber").nullable().optional(),
            Field::string("blAmount").nullable().optional(),
            Field::string("invoiceReference").nullable().optional(),
            Field::string("invoiceAmount").nullable().optional(),
            Field::string("invoiceAmountTTC").nullable().optional(),
            Field::date("dueDate").nullable().optional(),
            Field::boolean("reconciled").nullable().optional(),
            Field::date("validatedAt").nullable().optional(),
            Field::boolean("controlValidated").nullable().optional(),
            Field::string("controlValidatedBy").nullable().optional(),
            Field::date("controlValidatedAt").nullable().optional(),
            Field::string("createdBy"),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
        ])
    }
}

/// Table dlc_products
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct DlcProductsRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "productName")]
    pub product_name: Option<String>,
    #[serde(rename = "gencode")]
    pub gencode: Option<String>,
    #[serde(rename = "supplierId")]
    pub supplier_id: i32,
    #[serde(rename = "groupId")]
    pub group_id: i32,
    #[serde(rename = "expiryDate")]
    pub expiry_date: NaiveDate,
    #[serde(rename = "dateType")]
    pub date_type: String,
    #[serde(rename = "quantity")]
    pub quantity: i32,
    #[serde(rename = "unit")]
    pub unit: String,
    #[serde(rename = "location")]
    pub location: String,
    #[serde(rename = "alertThreshold")]
    pub alert_threshold: i32,
    #[serde(rename = "status")]
    pub status: String,
    #[serde(rename = "stockEpuise")]
    pub stock_epuise: Option<bool>,
    #[serde(rename = "stockEpuiseBy")]
    pub stock_epuise_by: Option<String>,
    #[serde(rename = "stockEpuiseAt", serialize_with = "crate::json::ts_opt")]
    pub stock_epuise_at: Option<NaiveDateTime>,
    #[serde(rename = "processedAt", serialize_with = "crate::json::ts_opt")]
    pub processed_at: Option<NaiveDateTime>,
    #[serde(rename = "processedBy")]
    pub processed_by: Option<String>,
    #[serde(rename = "processedUntilExpiry")]
    pub processed_until_expiry: Option<bool>,
    #[serde(rename = "notes")]
    pub notes: Option<String>,
    #[serde(rename = "createdBy")]
    pub created_by: String,
    #[serde(rename = "validatedBy")]
    pub validated_by: Option<String>,
    #[serde(rename = "validatedAt", serialize_with = "crate::json::ts_opt")]
    pub validated_at: Option<NaiveDateTime>,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

impl Table for DlcProductsRow {
    const TABLE: &'static str = "dlc_products";
    const COLUMNS: &'static str = "\"id\", \"name\", \"product_name\", \"gencode\", \"supplier_id\", \"group_id\", \"expiry_date\", \"date_type\", \"quantity\", \"unit\", \"location\", \"alert_threshold\", \"status\", \"stock_epuise\", \"stock_epuise_by\", \"stock_epuise_at\", \"processed_at\", \"processed_by\", \"processed_until_expiry\", \"notes\", \"created_by\", \"validated_by\", \"validated_at\", \"created_at\", \"updated_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "name",
            column: "name",
            sql_type: "text",
        },
        Col {
            key: "productName",
            column: "product_name",
            sql_type: "text",
        },
        Col {
            key: "gencode",
            column: "gencode",
            sql_type: "text",
        },
        Col {
            key: "supplierId",
            column: "supplier_id",
            sql_type: "int4",
        },
        Col {
            key: "groupId",
            column: "group_id",
            sql_type: "int4",
        },
        Col {
            key: "expiryDate",
            column: "expiry_date",
            sql_type: "date",
        },
        Col {
            key: "dateType",
            column: "date_type",
            sql_type: "text",
        },
        Col {
            key: "quantity",
            column: "quantity",
            sql_type: "int4",
        },
        Col {
            key: "unit",
            column: "unit",
            sql_type: "text",
        },
        Col {
            key: "location",
            column: "location",
            sql_type: "text",
        },
        Col {
            key: "alertThreshold",
            column: "alert_threshold",
            sql_type: "int4",
        },
        Col {
            key: "status",
            column: "status",
            sql_type: "text",
        },
        Col {
            key: "stockEpuise",
            column: "stock_epuise",
            sql_type: "bool",
        },
        Col {
            key: "stockEpuiseBy",
            column: "stock_epuise_by",
            sql_type: "text",
        },
        Col {
            key: "stockEpuiseAt",
            column: "stock_epuise_at",
            sql_type: "timestamp",
        },
        Col {
            key: "processedAt",
            column: "processed_at",
            sql_type: "timestamp",
        },
        Col {
            key: "processedBy",
            column: "processed_by",
            sql_type: "text",
        },
        Col {
            key: "processedUntilExpiry",
            column: "processed_until_expiry",
            sql_type: "bool",
        },
        Col {
            key: "notes",
            column: "notes",
            sql_type: "text",
        },
        Col {
            key: "createdBy",
            column: "created_by",
            sql_type: "text",
        },
        Col {
            key: "validatedBy",
            column: "validated_by",
            sql_type: "text",
        },
        Col {
            key: "validatedAt",
            column: "validated_at",
            sql_type: "timestamp",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
    ];
}

impl DlcProductsRow {
    /// createInsertSchema(dlc_products)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::string("name"),
            Field::string("productName").nullable().optional(),
            Field::string("gencode").nullable().optional(),
            Field::int32("supplierId"),
            Field::int32("groupId"),
            Field::string("expiryDate"),
            Field::string("dateType").optional(),
            Field::int32("quantity").optional(),
            Field::string("unit").optional(),
            Field::string("location").optional(),
            Field::int32("alertThreshold").optional(),
            Field::string("status").optional(),
            Field::boolean("stockEpuise").nullable().optional(),
            Field::string("stockEpuiseBy").nullable().optional(),
            Field::date("stockEpuiseAt").nullable().optional(),
            Field::date("processedAt").nullable().optional(),
            Field::string("processedBy").nullable().optional(),
            Field::boolean("processedUntilExpiry").nullable().optional(),
            Field::string("notes").nullable().optional(),
            Field::string("createdBy"),
            Field::string("validatedBy").nullable().optional(),
            Field::date("validatedAt").nullable().optional(),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
        ])
    }
}

/// Table external_api_keys
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct ExternalApiKeysRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "keyPrefix")]
    pub key_prefix: String,
    #[serde(rename = "keyHash")]
    pub key_hash: String,
    #[serde(rename = "createdBy")]
    pub created_by: Option<String>,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "lastUsedAt", serialize_with = "crate::json::ts_opt")]
    pub last_used_at: Option<NaiveDateTime>,
    #[serde(rename = "revokedAt", serialize_with = "crate::json::ts_opt")]
    pub revoked_at: Option<NaiveDateTime>,
}

impl Table for ExternalApiKeysRow {
    const TABLE: &'static str = "external_api_keys";
    const COLUMNS: &'static str = "\"id\", \"name\", \"key_prefix\", \"key_hash\", \"created_by\", \"created_at\", \"last_used_at\", \"revoked_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "name",
            column: "name",
            sql_type: "text",
        },
        Col {
            key: "keyPrefix",
            column: "key_prefix",
            sql_type: "text",
        },
        Col {
            key: "keyHash",
            column: "key_hash",
            sql_type: "text",
        },
        Col {
            key: "createdBy",
            column: "created_by",
            sql_type: "text",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "lastUsedAt",
            column: "last_used_at",
            sql_type: "timestamp",
        },
        Col {
            key: "revokedAt",
            column: "revoked_at",
            sql_type: "timestamp",
        },
    ];
}

impl ExternalApiKeysRow {
    /// createInsertSchema(external_api_keys)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::string("name").max_len(100),
            Field::string("keyPrefix").max_len(16),
            Field::string("keyHash").max_len(64),
            Field::string("createdBy").nullable().optional(),
            Field::date("createdAt").nullable().optional(),
            Field::date("lastUsedAt").nullable().optional(),
            Field::date("revokedAt").nullable().optional(),
        ])
    }
}

/// Table groups
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct GroupsRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "color")]
    pub color: Option<String>,
    #[serde(rename = "nocodbConfigId")]
    pub nocodb_config_id: Option<i32>,
    #[serde(rename = "nocodbTableName")]
    pub nocodb_table_name: Option<String>,
    #[serde(rename = "nocodbTableId")]
    pub nocodb_table_id: Option<String>,
    #[serde(rename = "invoiceColumnName")]
    pub invoice_column_name: Option<String>,
    #[serde(rename = "nocodbBlColumnName")]
    pub nocodb_bl_column_name: Option<String>,
    #[serde(rename = "nocodbAmountColumnName")]
    pub nocodb_amount_column_name: Option<String>,
    #[serde(rename = "nocodbInvoiceAmountTTCColumnName")]
    pub nocodb_invoice_amount_ttc_column_name: Option<String>,
    #[serde(rename = "nocodbSupplierColumnName")]
    pub nocodb_supplier_column_name: Option<String>,
    #[serde(rename = "nocodbDueDateColumnName")]
    pub nocodb_due_date_column_name: Option<String>,
    #[serde(rename = "webhookUrl")]
    pub webhook_url: Option<String>,
    #[serde(rename = "address")]
    pub address: Option<String>,
    #[serde(rename = "phone")]
    pub phone: Option<String>,
    #[serde(rename = "logo")]
    pub logo: Option<String>,
    #[serde(rename = "smtpEnabled")]
    pub smtp_enabled: Option<bool>,
    #[serde(rename = "smtpHost")]
    pub smtp_host: Option<String>,
    #[serde(rename = "smtpPort")]
    pub smtp_port: Option<i32>,
    #[serde(rename = "smtpSecure")]
    pub smtp_secure: Option<bool>,
    #[serde(rename = "smtpUser")]
    pub smtp_user: Option<String>,
    #[serde(rename = "smtpPassword")]
    pub smtp_password: Option<String>,
    #[serde(rename = "smtpSenderEmail")]
    pub smtp_sender_email: Option<String>,
    #[serde(rename = "smtpSenderName")]
    pub smtp_sender_name: Option<String>,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

impl Table for GroupsRow {
    const TABLE: &'static str = "groups";
    const COLUMNS: &'static str = "\"id\", \"name\", \"color\", \"nocodb_config_id\", \"nocodb_table_name\", \"nocodb_table_id\", \"invoice_column_name\", \"nocodb_bl_column_name\", \"nocodb_amount_column_name\", \"nocodb_invoice_amount_ttc_column_name\", \"nocodb_supplier_column_name\", \"nocodb_due_date_column_name\", \"webhook_url\", \"address\", \"phone\", \"logo\", \"smtp_enabled\", \"smtp_host\", \"smtp_port\", \"smtp_secure\", \"smtp_user\", \"smtp_password\", \"smtp_sender_email\", \"smtp_sender_name\", \"created_at\", \"updated_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "name",
            column: "name",
            sql_type: "text",
        },
        Col {
            key: "color",
            column: "color",
            sql_type: "text",
        },
        Col {
            key: "nocodbConfigId",
            column: "nocodb_config_id",
            sql_type: "int4",
        },
        Col {
            key: "nocodbTableName",
            column: "nocodb_table_name",
            sql_type: "text",
        },
        Col {
            key: "nocodbTableId",
            column: "nocodb_table_id",
            sql_type: "text",
        },
        Col {
            key: "invoiceColumnName",
            column: "invoice_column_name",
            sql_type: "text",
        },
        Col {
            key: "nocodbBlColumnName",
            column: "nocodb_bl_column_name",
            sql_type: "text",
        },
        Col {
            key: "nocodbAmountColumnName",
            column: "nocodb_amount_column_name",
            sql_type: "text",
        },
        Col {
            key: "nocodbInvoiceAmountTTCColumnName",
            column: "nocodb_invoice_amount_ttc_column_name",
            sql_type: "text",
        },
        Col {
            key: "nocodbSupplierColumnName",
            column: "nocodb_supplier_column_name",
            sql_type: "text",
        },
        Col {
            key: "nocodbDueDateColumnName",
            column: "nocodb_due_date_column_name",
            sql_type: "text",
        },
        Col {
            key: "webhookUrl",
            column: "webhook_url",
            sql_type: "text",
        },
        Col {
            key: "address",
            column: "address",
            sql_type: "text",
        },
        Col {
            key: "phone",
            column: "phone",
            sql_type: "text",
        },
        Col {
            key: "logo",
            column: "logo",
            sql_type: "text",
        },
        Col {
            key: "smtpEnabled",
            column: "smtp_enabled",
            sql_type: "bool",
        },
        Col {
            key: "smtpHost",
            column: "smtp_host",
            sql_type: "text",
        },
        Col {
            key: "smtpPort",
            column: "smtp_port",
            sql_type: "int4",
        },
        Col {
            key: "smtpSecure",
            column: "smtp_secure",
            sql_type: "bool",
        },
        Col {
            key: "smtpUser",
            column: "smtp_user",
            sql_type: "text",
        },
        Col {
            key: "smtpPassword",
            column: "smtp_password",
            sql_type: "text",
        },
        Col {
            key: "smtpSenderEmail",
            column: "smtp_sender_email",
            sql_type: "text",
        },
        Col {
            key: "smtpSenderName",
            column: "smtp_sender_name",
            sql_type: "text",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
    ];
}

impl GroupsRow {
    /// createInsertSchema(groups)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::string("name"),
            Field::string("color").nullable().optional(),
            Field::int32("nocodbConfigId").nullable().optional(),
            Field::string("nocodbTableName").nullable().optional(),
            Field::string("nocodbTableId").nullable().optional(),
            Field::string("invoiceColumnName").nullable().optional(),
            Field::string("nocodbBlColumnName").nullable().optional(),
            Field::string("nocodbAmountColumnName").nullable().optional(),
            Field::string("nocodbInvoiceAmountTTCColumnName")
                .nullable()
                .optional(),
            Field::string("nocodbSupplierColumnName").nullable().optional(),
            Field::string("nocodbDueDateColumnName").nullable().optional(),
            Field::string("webhookUrl").max_len(500).nullable().optional(),
            Field::string("address").nullable().optional(),
            Field::string("phone").max_len(50).nullable().optional(),
            Field::string("logo").nullable().optional(),
            Field::boolean("smtpEnabled").nullable().optional(),
            Field::string("smtpHost").max_len(255).nullable().optional(),
            Field::int32("smtpPort").nullable().optional(),
            Field::boolean("smtpSecure").nullable().optional(),
            Field::string("smtpUser").max_len(255).nullable().optional(),
            Field::string("smtpPassword").max_len(255).nullable().optional(),
            Field::string("smtpSenderEmail")
                .max_len(255)
                .nullable()
                .optional(),
            Field::string("smtpSenderName").max_len(255).nullable().optional(),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
        ])
    }
}

/// Table invoice_verification_cache
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct InvoiceVerificationCacheRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "cacheKey")]
    pub cache_key: String,
    #[serde(rename = "groupId")]
    pub group_id: i32,
    #[serde(rename = "invoiceReference")]
    pub invoice_reference: String,
    #[serde(rename = "supplierName")]
    pub supplier_name: Option<String>,
    #[serde(rename = "invoiceAmount", serialize_with = "crate::json::numeric_opt::<2, _>")]
    pub invoice_amount: Option<Decimal>,
    #[serde(
        rename = "invoiceAmountTTC",
        serialize_with = "crate::json::numeric_opt::<2, _>"
    )]
    pub invoice_amount_ttc: Option<Decimal>,
    #[serde(rename = "dueDate", serialize_with = "crate::json::ts_opt")]
    pub due_date: Option<NaiveDateTime>,
    #[serde(rename = "exists")]
    pub exists: bool,
    #[serde(rename = "matchType")]
    pub match_type: String,
    #[serde(rename = "errorMessage")]
    pub error_message: Option<String>,
    #[serde(rename = "cacheHit")]
    pub cache_hit: Option<bool>,
    #[serde(rename = "apiCallTime")]
    pub api_call_time: Option<i32>,
    #[serde(rename = "isReconciled")]
    pub is_reconciled: Option<bool>,
    #[serde(rename = "expiresAt", serialize_with = "crate::json::ts")]
    pub expires_at: NaiveDateTime,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

impl Table for InvoiceVerificationCacheRow {
    const TABLE: &'static str = "invoice_verification_cache";
    const COLUMNS: &'static str = "\"id\", \"cache_key\", \"group_id\", \"invoice_reference\", \"supplier_name\", \"invoice_amount\", \"invoice_amount_ttc\", \"due_date\", \"exists\", \"match_type\", \"error_message\", \"cache_hit\", \"api_call_time\", \"is_reconciled\", \"expires_at\", \"created_at\", \"updated_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "cacheKey",
            column: "cache_key",
            sql_type: "text",
        },
        Col {
            key: "groupId",
            column: "group_id",
            sql_type: "int4",
        },
        Col {
            key: "invoiceReference",
            column: "invoice_reference",
            sql_type: "text",
        },
        Col {
            key: "supplierName",
            column: "supplier_name",
            sql_type: "text",
        },
        Col {
            key: "invoiceAmount",
            column: "invoice_amount",
            sql_type: "numeric",
        },
        Col {
            key: "invoiceAmountTTC",
            column: "invoice_amount_ttc",
            sql_type: "numeric",
        },
        Col {
            key: "dueDate",
            column: "due_date",
            sql_type: "timestamp",
        },
        Col {
            key: "exists",
            column: "exists",
            sql_type: "bool",
        },
        Col {
            key: "matchType",
            column: "match_type",
            sql_type: "text",
        },
        Col {
            key: "errorMessage",
            column: "error_message",
            sql_type: "text",
        },
        Col {
            key: "cacheHit",
            column: "cache_hit",
            sql_type: "bool",
        },
        Col {
            key: "apiCallTime",
            column: "api_call_time",
            sql_type: "int4",
        },
        Col {
            key: "isReconciled",
            column: "is_reconciled",
            sql_type: "bool",
        },
        Col {
            key: "expiresAt",
            column: "expires_at",
            sql_type: "timestamp",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
    ];
}

impl InvoiceVerificationCacheRow {
    /// createInsertSchema(invoice_verification_cache)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::string("cacheKey").max_len(255),
            Field::int32("groupId"),
            Field::string("invoiceReference").max_len(255),
            Field::string("supplierName").max_len(255).nullable().optional(),
            Field::string("invoiceAmount").nullable().optional(),
            Field::string("invoiceAmountTTC").nullable().optional(),
            Field::date("dueDate").nullable().optional(),
            Field::boolean("exists"),
            Field::string("matchType").max_len(50),
            Field::string("errorMessage").nullable().optional(),
            Field::boolean("cacheHit").nullable().optional(),
            Field::int32("apiCallTime").nullable().optional(),
            Field::boolean("isReconciled").nullable().optional(),
            Field::date("expiresAt"),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
        ])
    }
}

/// Table nocodb_config
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct NocodbConfigRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "apiToken")]
    pub api_token: String,
    #[serde(rename = "description")]
    pub description: Option<String>,
    #[serde(rename = "isActive")]
    pub is_active: Option<bool>,
    #[serde(rename = "createdBy")]
    pub created_by: Option<String>,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

impl Table for NocodbConfigRow {
    const TABLE: &'static str = "nocodb_config";
    const COLUMNS: &'static str = "\"id\", \"name\", \"base_url\", \"project_id\", \"api_token\", \"description\", \"is_active\", \"created_by\", \"created_at\", \"updated_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "name",
            column: "name",
            sql_type: "text",
        },
        Col {
            key: "baseUrl",
            column: "base_url",
            sql_type: "text",
        },
        Col {
            key: "projectId",
            column: "project_id",
            sql_type: "text",
        },
        Col {
            key: "apiToken",
            column: "api_token",
            sql_type: "text",
        },
        Col {
            key: "description",
            column: "description",
            sql_type: "text",
        },
        Col {
            key: "isActive",
            column: "is_active",
            sql_type: "bool",
        },
        Col {
            key: "createdBy",
            column: "created_by",
            sql_type: "text",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
    ];
}

impl NocodbConfigRow {
    /// createInsertSchema(nocodb_config)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::string("name"),
            Field::string("baseUrl"),
            Field::string("projectId"),
            Field::string("apiToken"),
            Field::string("description").nullable().optional(),
            Field::boolean("isActive").nullable().optional(),
            Field::string("createdBy").nullable().optional(),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
        ])
    }
}

/// Table orders
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct OrdersRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "supplierId")]
    pub supplier_id: i32,
    #[serde(rename = "groupId")]
    pub group_id: i32,
    #[serde(rename = "plannedDate")]
    pub planned_date: NaiveDate,
    #[serde(rename = "quantity")]
    pub quantity: Option<i32>,
    #[serde(rename = "unit")]
    pub unit: Option<String>,
    #[serde(rename = "status")]
    pub status: String,
    #[serde(rename = "notes")]
    pub notes: Option<String>,
    #[serde(rename = "createdBy")]
    pub created_by: String,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

impl Table for OrdersRow {
    const TABLE: &'static str = "orders";
    const COLUMNS: &'static str = "\"id\", \"supplier_id\", \"group_id\", \"planned_date\", \"quantity\", \"unit\", \"status\", \"notes\", \"created_by\", \"created_at\", \"updated_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "supplierId",
            column: "supplier_id",
            sql_type: "int4",
        },
        Col {
            key: "groupId",
            column: "group_id",
            sql_type: "int4",
        },
        Col {
            key: "plannedDate",
            column: "planned_date",
            sql_type: "date",
        },
        Col {
            key: "quantity",
            column: "quantity",
            sql_type: "int4",
        },
        Col {
            key: "unit",
            column: "unit",
            sql_type: "text",
        },
        Col {
            key: "status",
            column: "status",
            sql_type: "text",
        },
        Col {
            key: "notes",
            column: "notes",
            sql_type: "text",
        },
        Col {
            key: "createdBy",
            column: "created_by",
            sql_type: "text",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
    ];
}

impl OrdersRow {
    /// createInsertSchema(orders)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::int32("supplierId"),
            Field::int32("groupId"),
            Field::string("plannedDate"),
            Field::int32("quantity").nullable().optional(),
            Field::string("unit").nullable().optional(),
            Field::string("status").optional(),
            Field::string("notes").nullable().optional(),
            Field::string("createdBy"),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
        ])
    }
}

/// Table publicities
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct PublicitiesRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "pubNumber")]
    pub pub_number: String,
    #[serde(rename = "designation")]
    pub designation: String,
    #[serde(rename = "startDate")]
    pub start_date: NaiveDate,
    #[serde(rename = "endDate")]
    pub end_date: NaiveDate,
    #[serde(rename = "year")]
    pub year: i32,
    #[serde(rename = "createdBy")]
    pub created_by: String,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

impl Table for PublicitiesRow {
    const TABLE: &'static str = "publicities";
    const COLUMNS: &'static str = "\"id\", \"pub_number\", \"designation\", \"start_date\", \"end_date\", \"year\", \"created_by\", \"created_at\", \"updated_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "pubNumber",
            column: "pub_number",
            sql_type: "text",
        },
        Col {
            key: "designation",
            column: "designation",
            sql_type: "text",
        },
        Col {
            key: "startDate",
            column: "start_date",
            sql_type: "date",
        },
        Col {
            key: "endDate",
            column: "end_date",
            sql_type: "date",
        },
        Col {
            key: "year",
            column: "year",
            sql_type: "int4",
        },
        Col {
            key: "createdBy",
            column: "created_by",
            sql_type: "text",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
    ];
}

impl PublicitiesRow {
    /// createInsertSchema(publicities)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::string("pubNumber"),
            Field::string("designation"),
            Field::string("startDate"),
            Field::string("endDate"),
            Field::int32("year"),
            Field::string("createdBy"),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
        ])
    }
}

/// Table publicity_participations
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct PublicityParticipationsRow {
    #[serde(rename = "publicityId")]
    pub publicity_id: i32,
    #[serde(rename = "groupId")]
    pub group_id: i32,
}

impl Table for PublicityParticipationsRow {
    const TABLE: &'static str = "publicity_participations";
    const COLUMNS: &'static str = "\"publicity_id\", \"group_id\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "publicityId",
            column: "publicity_id",
            sql_type: "int4",
        },
        Col {
            key: "groupId",
            column: "group_id",
            sql_type: "int4",
        },
    ];
}

impl PublicityParticipationsRow {
    /// createInsertSchema(publicity_participations)
    pub fn insert_schema() -> Object {
        Object::new(vec![Field::int32("publicityId"), Field::int32("groupId")])
    }
}

/// Table reconciliation_comments
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct ReconciliationCommentsRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "deliveryId")]
    pub delivery_id: i32,
    #[serde(rename = "groupId")]
    pub group_id: i32,
    #[serde(rename = "content")]
    pub content: String,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(rename = "authorId")]
    pub author_id: String,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

impl Table for ReconciliationCommentsRow {
    const TABLE: &'static str = "reconciliation_comments";
    const COLUMNS: &'static str = "\"id\", \"delivery_id\", \"group_id\", \"content\", \"type\", \"author_id\", \"created_at\", \"updated_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "deliveryId",
            column: "delivery_id",
            sql_type: "int4",
        },
        Col {
            key: "groupId",
            column: "group_id",
            sql_type: "int4",
        },
        Col {
            key: "content",
            column: "content",
            sql_type: "text",
        },
        Col {
            key: "type",
            column: "type",
            sql_type: "text",
        },
        Col {
            key: "authorId",
            column: "author_id",
            sql_type: "text",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
    ];
}

impl ReconciliationCommentsRow {
    /// createInsertSchema(reconciliation_comments)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::int32("deliveryId"),
            Field::int32("groupId"),
            Field::string("content"),
            Field::string("type").optional(),
            Field::string("authorId"),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
        ])
    }
}

/// Table sav_tickets
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct SavTicketsRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "ticketNumber")]
    pub ticket_number: String,
    #[serde(rename = "supplierId")]
    pub supplier_id: i32,
    #[serde(rename = "groupId")]
    pub group_id: i32,
    #[serde(rename = "productGencode")]
    pub product_gencode: String,
    #[serde(rename = "productReference")]
    pub product_reference: Option<String>,
    #[serde(rename = "productDesignation")]
    pub product_designation: String,
    #[serde(rename = "problemType")]
    pub problem_type: String,
    #[serde(rename = "problemDescription")]
    pub problem_description: String,
    #[serde(rename = "resolutionDescription")]
    pub resolution_description: Option<String>,
    #[serde(rename = "status")]
    pub status: String,
    #[serde(rename = "priority")]
    pub priority: String,
    #[serde(rename = "clientName")]
    pub client_name: Option<String>,
    #[serde(rename = "clientPhone")]
    pub client_phone: Option<String>,
    #[serde(rename = "createdBy")]
    pub created_by: String,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
    #[serde(rename = "resolvedAt", serialize_with = "crate::json::ts_opt")]
    pub resolved_at: Option<NaiveDateTime>,
    #[serde(rename = "closedAt", serialize_with = "crate::json::ts_opt")]
    pub closed_at: Option<NaiveDateTime>,
}

impl Table for SavTicketsRow {
    const TABLE: &'static str = "sav_tickets";
    const COLUMNS: &'static str = "\"id\", \"ticket_number\", \"supplier_id\", \"group_id\", \"product_gencode\", \"product_reference\", \"product_designation\", \"problem_type\", \"problem_description\", \"resolution_description\", \"status\", \"priority\", \"client_name\", \"client_phone\", \"created_by\", \"created_at\", \"updated_at\", \"resolved_at\", \"closed_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "ticketNumber",
            column: "ticket_number",
            sql_type: "text",
        },
        Col {
            key: "supplierId",
            column: "supplier_id",
            sql_type: "int4",
        },
        Col {
            key: "groupId",
            column: "group_id",
            sql_type: "int4",
        },
        Col {
            key: "productGencode",
            column: "product_gencode",
            sql_type: "text",
        },
        Col {
            key: "productReference",
            column: "product_reference",
            sql_type: "text",
        },
        Col {
            key: "productDesignation",
            column: "product_designation",
            sql_type: "text",
        },
        Col {
            key: "problemType",
            column: "problem_type",
            sql_type: "text",
        },
        Col {
            key: "problemDescription",
            column: "problem_description",
            sql_type: "text",
        },
        Col {
            key: "resolutionDescription",
            column: "resolution_description",
            sql_type: "text",
        },
        Col {
            key: "status",
            column: "status",
            sql_type: "text",
        },
        Col {
            key: "priority",
            column: "priority",
            sql_type: "text",
        },
        Col {
            key: "clientName",
            column: "client_name",
            sql_type: "text",
        },
        Col {
            key: "clientPhone",
            column: "client_phone",
            sql_type: "text",
        },
        Col {
            key: "createdBy",
            column: "created_by",
            sql_type: "text",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
        Col {
            key: "resolvedAt",
            column: "resolved_at",
            sql_type: "timestamp",
        },
        Col {
            key: "closedAt",
            column: "closed_at",
            sql_type: "timestamp",
        },
    ];
}

impl SavTicketsRow {
    /// createInsertSchema(sav_tickets)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::string("ticketNumber").max_len(50),
            Field::int32("supplierId"),
            Field::int32("groupId"),
            Field::string("productGencode").max_len(255),
            Field::string("productReference")
                .max_len(255)
                .nullable()
                .optional(),
            Field::string("productDesignation").max_len(500),
            Field::string("problemType").max_len(100),
            Field::string("problemDescription"),
            Field::string("resolutionDescription").nullable().optional(),
            Field::string("status").max_len(50).optional(),
            Field::string("priority").max_len(50).optional(),
            Field::string("clientName").max_len(255).nullable().optional(),
            Field::string("clientPhone").max_len(255).nullable().optional(),
            Field::string("createdBy").max_len(255),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
            Field::date("resolvedAt").nullable().optional(),
            Field::date("closedAt").nullable().optional(),
        ])
    }
}

/// Table sessions
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct SessionsRow {
    #[serde(rename = "sid")]
    pub sid: String,
    #[serde(rename = "sess")]
    pub sess: serde_json::Value,
    #[serde(rename = "expire", serialize_with = "crate::json::ts")]
    pub expire: NaiveDateTime,
}

impl Table for SessionsRow {
    const TABLE: &'static str = "sessions";
    const COLUMNS: &'static str = "\"sid\", \"sess\", \"expire\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "sid",
            column: "sid",
            sql_type: "text",
        },
        Col {
            key: "sess",
            column: "sess",
            sql_type: "jsonb",
        },
        Col {
            key: "expire",
            column: "expire",
            sql_type: "timestamp",
        },
    ];
}

impl SessionsRow {
    /// createInsertSchema(sessions)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::string("sid"),
            Field::json("sess"),
            Field::date("expire"),
        ])
    }
}

/// Table supplier_mail_logs
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct SupplierMailLogsRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "deliveryId")]
    pub delivery_id: i32,
    #[serde(rename = "groupId")]
    pub group_id: i32,
    #[serde(rename = "supplierId")]
    pub supplier_id: Option<i32>,
    #[serde(rename = "supplierName")]
    pub supplier_name: Option<String>,
    #[serde(rename = "sentTo")]
    pub sent_to: String,
    #[serde(rename = "subject")]
    pub subject: Option<String>,
    #[serde(rename = "status")]
    pub status: String,
    #[serde(rename = "errorMessage")]
    pub error_message: Option<String>,
    #[serde(rename = "messageId")]
    pub message_id: Option<String>,
    #[serde(rename = "sentBy")]
    pub sent_by: String,
    #[serde(rename = "sentByName")]
    pub sent_by_name: Option<String>,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
}

impl Table for SupplierMailLogsRow {
    const TABLE: &'static str = "supplier_mail_logs";
    const COLUMNS: &'static str = "\"id\", \"delivery_id\", \"group_id\", \"supplier_id\", \"supplier_name\", \"sent_to\", \"subject\", \"status\", \"error_message\", \"message_id\", \"sent_by\", \"sent_by_name\", \"created_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "deliveryId",
            column: "delivery_id",
            sql_type: "int4",
        },
        Col {
            key: "groupId",
            column: "group_id",
            sql_type: "int4",
        },
        Col {
            key: "supplierId",
            column: "supplier_id",
            sql_type: "int4",
        },
        Col {
            key: "supplierName",
            column: "supplier_name",
            sql_type: "text",
        },
        Col {
            key: "sentTo",
            column: "sent_to",
            sql_type: "text",
        },
        Col {
            key: "subject",
            column: "subject",
            sql_type: "text",
        },
        Col {
            key: "status",
            column: "status",
            sql_type: "text",
        },
        Col {
            key: "errorMessage",
            column: "error_message",
            sql_type: "text",
        },
        Col {
            key: "messageId",
            column: "message_id",
            sql_type: "text",
        },
        Col {
            key: "sentBy",
            column: "sent_by",
            sql_type: "text",
        },
        Col {
            key: "sentByName",
            column: "sent_by_name",
            sql_type: "text",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
    ];
}

impl SupplierMailLogsRow {
    /// createInsertSchema(supplier_mail_logs)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::int32("deliveryId"),
            Field::int32("groupId"),
            Field::int32("supplierId").nullable().optional(),
            Field::string("supplierName").max_len(255).nullable().optional(),
            Field::string("sentTo").max_len(255),
            Field::string("subject").nullable().optional(),
            Field::string("status").max_len(20),
            Field::string("errorMessage").nullable().optional(),
            Field::string("messageId").max_len(255).nullable().optional(),
            Field::string("sentBy"),
            Field::string("sentByName").max_len(255).nullable().optional(),
            Field::date("createdAt").nullable().optional(),
        ])
    }
}

/// Table suppliers
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct SuppliersRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "contact")]
    pub contact: Option<String>,
    #[serde(rename = "phone")]
    pub phone: Option<String>,
    #[serde(rename = "codefou")]
    pub codefou: Option<String>,
    #[serde(rename = "email")]
    pub email: Option<String>,
    #[serde(rename = "hasDlc")]
    pub has_dlc: Option<bool>,
    #[serde(rename = "paymentMethod")]
    pub payment_method: Option<String>,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
    #[serde(rename = "automaticReconciliation")]
    pub automatic_reconciliation: Option<bool>,
    #[serde(rename = "requiresControl")]
    pub requires_control: Option<bool>,
}

impl Table for SuppliersRow {
    const TABLE: &'static str = "suppliers";
    const COLUMNS: &'static str = "\"id\", \"name\", \"contact\", \"phone\", \"codefou\", \"email\", \"has_dlc\", \"payment_method\", \"created_at\", \"updated_at\", \"automatic_reconciliation\", \"requires_control\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "name",
            column: "name",
            sql_type: "text",
        },
        Col {
            key: "contact",
            column: "contact",
            sql_type: "text",
        },
        Col {
            key: "phone",
            column: "phone",
            sql_type: "text",
        },
        Col {
            key: "codefou",
            column: "codefou",
            sql_type: "text",
        },
        Col {
            key: "email",
            column: "email",
            sql_type: "text",
        },
        Col {
            key: "hasDlc",
            column: "has_dlc",
            sql_type: "bool",
        },
        Col {
            key: "paymentMethod",
            column: "payment_method",
            sql_type: "text",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
        Col {
            key: "automaticReconciliation",
            column: "automatic_reconciliation",
            sql_type: "bool",
        },
        Col {
            key: "requiresControl",
            column: "requires_control",
            sql_type: "bool",
        },
    ];
}

impl SuppliersRow {
    /// createInsertSchema(suppliers)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::string("name"),
            Field::string("contact").nullable().optional(),
            Field::string("phone").nullable().optional(),
            Field::string("codefou").nullable().optional(),
            Field::string("email").nullable().optional(),
            Field::boolean("hasDlc").nullable().optional(),
            Field::string("paymentMethod").nullable().optional(),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
            Field::boolean("automaticReconciliation").nullable().optional(),
            Field::boolean("requiresControl").nullable().optional(),
        ])
    }
}

/// Table tasks
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct TasksRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "title")]
    pub title: String,
    #[serde(rename = "description")]
    pub description: Option<String>,
    #[serde(rename = "startDate", serialize_with = "crate::json::ts_opt")]
    pub start_date: Option<NaiveDateTime>,
    #[serde(rename = "dueDate")]
    pub due_date: Option<NaiveDate>,
    #[serde(rename = "priority")]
    pub priority: String,
    #[serde(rename = "status")]
    pub status: String,
    #[serde(rename = "assignedTo")]
    pub assigned_to: String,
    #[serde(rename = "createdBy")]
    pub created_by: String,
    #[serde(rename = "groupId")]
    pub group_id: i32,
    #[serde(rename = "completedAt", serialize_with = "crate::json::ts_opt")]
    pub completed_at: Option<NaiveDateTime>,
    #[serde(rename = "completedBy")]
    pub completed_by: Option<String>,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

impl Table for TasksRow {
    const TABLE: &'static str = "tasks";
    const COLUMNS: &'static str = "\"id\", \"title\", \"description\", \"start_date\", \"due_date\", \"priority\", \"status\", \"assigned_to\", \"created_by\", \"group_id\", \"completed_at\", \"completed_by\", \"created_at\", \"updated_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "title",
            column: "title",
            sql_type: "text",
        },
        Col {
            key: "description",
            column: "description",
            sql_type: "text",
        },
        Col {
            key: "startDate",
            column: "start_date",
            sql_type: "timestamp",
        },
        Col {
            key: "dueDate",
            column: "due_date",
            sql_type: "date",
        },
        Col {
            key: "priority",
            column: "priority",
            sql_type: "text",
        },
        Col {
            key: "status",
            column: "status",
            sql_type: "text",
        },
        Col {
            key: "assignedTo",
            column: "assigned_to",
            sql_type: "text",
        },
        Col {
            key: "createdBy",
            column: "created_by",
            sql_type: "text",
        },
        Col {
            key: "groupId",
            column: "group_id",
            sql_type: "int4",
        },
        Col {
            key: "completedAt",
            column: "completed_at",
            sql_type: "timestamp",
        },
        Col {
            key: "completedBy",
            column: "completed_by",
            sql_type: "text",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
    ];
}

impl TasksRow {
    /// createInsertSchema(tasks)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::string("title"),
            Field::string("description").nullable().optional(),
            Field::date("startDate").nullable().optional(),
            Field::string("dueDate").nullable().optional(),
            Field::string("priority").optional(),
            Field::string("status").optional(),
            Field::string("assignedTo"),
            Field::string("createdBy"),
            Field::int32("groupId"),
            Field::date("completedAt").nullable().optional(),
            Field::string("completedBy").nullable().optional(),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
        ])
    }
}

/// Table user_groups
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct UserGroupsRow {
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "groupId")]
    pub group_id: i32,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
}

impl Table for UserGroupsRow {
    const TABLE: &'static str = "user_groups";
    const COLUMNS: &'static str = "\"user_id\", \"group_id\", \"created_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "userId",
            column: "user_id",
            sql_type: "text",
        },
        Col {
            key: "groupId",
            column: "group_id",
            sql_type: "int4",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
    ];
}

impl UserGroupsRow {
    /// createInsertSchema(user_groups)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::string("userId"),
            Field::int32("groupId"),
            Field::date("createdAt").nullable().optional(),
        ])
    }
}

/// Table users
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct UsersRow {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "username")]
    pub username: String,
    #[serde(rename = "email")]
    pub email: Option<String>,
    #[serde(rename = "name")]
    pub name: Option<String>,
    #[serde(rename = "firstName")]
    pub first_name: Option<String>,
    #[serde(rename = "lastName")]
    pub last_name: Option<String>,
    #[serde(rename = "profileImageUrl")]
    pub profile_image_url: Option<String>,
    #[serde(rename = "password")]
    pub password: Option<String>,
    #[serde(rename = "role")]
    pub role: String,
    #[serde(rename = "passwordChanged")]
    pub password_changed: Option<bool>,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

impl Table for UsersRow {
    const TABLE: &'static str = "users";
    const COLUMNS: &'static str = "\"id\", \"username\", \"email\", \"name\", \"first_name\", \"last_name\", \"profile_image_url\", \"password\", \"role\", \"password_changed\", \"created_at\", \"updated_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "text",
        },
        Col {
            key: "username",
            column: "username",
            sql_type: "text",
        },
        Col {
            key: "email",
            column: "email",
            sql_type: "text",
        },
        Col {
            key: "name",
            column: "name",
            sql_type: "text",
        },
        Col {
            key: "firstName",
            column: "first_name",
            sql_type: "text",
        },
        Col {
            key: "lastName",
            column: "last_name",
            sql_type: "text",
        },
        Col {
            key: "profileImageUrl",
            column: "profile_image_url",
            sql_type: "text",
        },
        Col {
            key: "password",
            column: "password",
            sql_type: "text",
        },
        Col {
            key: "role",
            column: "role",
            sql_type: "text",
        },
        Col {
            key: "passwordChanged",
            column: "password_changed",
            sql_type: "bool",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
    ];
}

impl UsersRow {
    /// createInsertSchema(users)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::string("id"),
            Field::string("username"),
            Field::string("email").nullable().optional(),
            Field::string("name").nullable().optional(),
            Field::string("firstName").nullable().optional(),
            Field::string("lastName").nullable().optional(),
            Field::string("profileImageUrl").nullable().optional(),
            Field::string("password").nullable().optional(),
            Field::string("role").optional(),
            Field::boolean("passwordChanged").nullable().optional(),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
        ])
    }
}

/// Table utilities
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct UtilitiesRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "salesAnalysisUrl")]
    pub sales_analysis_url: Option<String>,
    #[serde(rename = "automaticBackupsEnabled")]
    pub automatic_backups_enabled: Option<bool>,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

impl Table for UtilitiesRow {
    const TABLE: &'static str = "utilities";
    const COLUMNS: &'static str =
        "\"id\", \"sales_analysis_url\", \"automatic_backups_enabled\", \"created_at\", \"updated_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "salesAnalysisUrl",
            column: "sales_analysis_url",
            sql_type: "text",
        },
        Col {
            key: "automaticBackupsEnabled",
            column: "automatic_backups_enabled",
            sql_type: "bool",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
    ];
}

impl UtilitiesRow {
    /// createInsertSchema(utilities)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::string("salesAnalysisUrl")
                .max_len(500)
                .nullable()
                .optional(),
            Field::boolean("automaticBackupsEnabled").nullable().optional(),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
        ])
    }
}

/// Table weather_data
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct WeatherDataRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "date")]
    pub date: NaiveDate,
    #[serde(rename = "location")]
    pub location: String,
    #[serde(rename = "tempMax")]
    pub temp_max: String,
    #[serde(rename = "tempMin")]
    pub temp_min: String,
    #[serde(rename = "icon")]
    pub icon: String,
    #[serde(rename = "conditions")]
    pub conditions: String,
    #[serde(rename = "isCurrentYear")]
    pub is_current_year: bool,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

impl Table for WeatherDataRow {
    const TABLE: &'static str = "weather_data";
    const COLUMNS: &'static str = "\"id\", \"date\", \"location\", \"temp_max\", \"temp_min\", \"icon\", \"conditions\", \"is_current_year\", \"created_at\", \"updated_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "date",
            column: "date",
            sql_type: "date",
        },
        Col {
            key: "location",
            column: "location",
            sql_type: "text",
        },
        Col {
            key: "tempMax",
            column: "temp_max",
            sql_type: "text",
        },
        Col {
            key: "tempMin",
            column: "temp_min",
            sql_type: "text",
        },
        Col {
            key: "icon",
            column: "icon",
            sql_type: "text",
        },
        Col {
            key: "conditions",
            column: "conditions",
            sql_type: "text",
        },
        Col {
            key: "isCurrentYear",
            column: "is_current_year",
            sql_type: "bool",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
    ];
}

impl WeatherDataRow {
    /// createInsertSchema(weather_data)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::string("date"),
            Field::string("location"),
            Field::string("tempMax"),
            Field::string("tempMin"),
            Field::string("icon"),
            Field::string("conditions"),
            Field::boolean("isCurrentYear").optional(),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
        ])
    }
}

/// Table weather_settings
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct WeatherSettingsRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "apiKey")]
    pub api_key: String,
    #[serde(rename = "location")]
    pub location: String,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

impl Table for WeatherSettingsRow {
    const TABLE: &'static str = "weather_settings";
    const COLUMNS: &'static str =
        "\"id\", \"api_key\", \"location\", \"is_active\", \"created_at\", \"updated_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "apiKey",
            column: "api_key",
            sql_type: "text",
        },
        Col {
            key: "location",
            column: "location",
            sql_type: "text",
        },
        Col {
            key: "isActive",
            column: "is_active",
            sql_type: "bool",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
    ];
}

impl WeatherSettingsRow {
    /// createInsertSchema(weather_settings)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::string("apiKey"),
            Field::string("location").optional(),
            Field::boolean("isActive").optional(),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
        ])
    }
}

/// Table webhook_bap_config
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct WebhookBapConfigRow {
    #[serde(rename = "id")]
    pub id: i32,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "webhookUrl")]
    pub webhook_url: String,
    #[serde(rename = "description")]
    pub description: Option<String>,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "createdAt", serialize_with = "crate::json::ts_opt")]
    pub created_at: Option<NaiveDateTime>,
    #[serde(rename = "updatedAt", serialize_with = "crate::json::ts_opt")]
    pub updated_at: Option<NaiveDateTime>,
}

impl Table for WebhookBapConfigRow {
    const TABLE: &'static str = "webhook_bap_config";
    const COLUMNS: &'static str =
        "\"id\", \"name\", \"webhook_url\", \"description\", \"is_active\", \"created_at\", \"updated_at\"";
    const FIELDS: &'static [Col] = &[
        Col {
            key: "id",
            column: "id",
            sql_type: "int4",
        },
        Col {
            key: "name",
            column: "name",
            sql_type: "text",
        },
        Col {
            key: "webhookUrl",
            column: "webhook_url",
            sql_type: "text",
        },
        Col {
            key: "description",
            column: "description",
            sql_type: "text",
        },
        Col {
            key: "isActive",
            column: "is_active",
            sql_type: "bool",
        },
        Col {
            key: "createdAt",
            column: "created_at",
            sql_type: "timestamp",
        },
        Col {
            key: "updatedAt",
            column: "updated_at",
            sql_type: "timestamp",
        },
    ];
}

impl WebhookBapConfigRow {
    /// createInsertSchema(webhook_bap_config)
    pub fn insert_schema() -> Object {
        Object::new(vec![
            Field::int32("id").optional(),
            Field::string("name").max_len(100).optional(),
            Field::string("webhookUrl"),
            Field::string("description").nullable().optional(),
            Field::boolean("isActive").optional(),
            Field::date("createdAt").nullable().optional(),
            Field::date("updatedAt").nullable().optional(),
        ])
    }
}
