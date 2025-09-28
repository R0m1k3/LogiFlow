--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (63f4182)
-- Dumped by pg_dump version 16.9

-- Started on 2025-09-28 06:02:00 UTC

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

DROP DATABASE IF EXISTS neondb;
--
-- TOC entry 3846 (class 1262 OID 16389)
-- Name: neondb; Type: DATABASE; Schema: -; Owner: neondb_owner
--

CREATE DATABASE neondb WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'C.UTF-8';


ALTER DATABASE neondb OWNER TO neondb_owner;

\connect neondb

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 272 (class 1259 OID 2359307)
-- Name: announcements; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.announcements (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    priority character varying(20) DEFAULT 'normal'::character varying NOT NULL,
    author_id character varying(255) NOT NULL,
    group_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT announcements_priority_check CHECK (((priority)::text = ANY ((ARRAY['normal'::character varying, 'important'::character varying, 'urgent'::character varying])::text[])))
);


ALTER TABLE public.announcements OWNER TO neondb_owner;

--
-- TOC entry 3848 (class 0 OID 0)
-- Dependencies: 272
-- Name: TABLE announcements; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public.announcements IS 'Admin-managed announcements/information system';


--
-- TOC entry 3849 (class 0 OID 0)
-- Dependencies: 272
-- Name: COLUMN announcements.priority; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public.announcements.priority IS 'Priority level: normal, important, urgent';


--
-- TOC entry 3850 (class 0 OID 0)
-- Dependencies: 272
-- Name: COLUMN announcements.group_id; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public.announcements.group_id IS 'NULL for global announcements, specific group_id for store-specific announcements';


--
-- TOC entry 271 (class 1259 OID 2359306)
-- Name: announcements_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.announcements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.announcements_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3851 (class 0 OID 0)
-- Dependencies: 271
-- Name: announcements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.announcements_id_seq OWNED BY public.announcements.id;


--
-- TOC entry 276 (class 1259 OID 2367489)
-- Name: avoirs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.avoirs (
    id integer NOT NULL,
    supplier_id integer NOT NULL,
    group_id integer NOT NULL,
    invoice_reference character varying(255),
    amount numeric(10,2),
    comment text,
    commercial_processed boolean DEFAULT false,
    status character varying(50) DEFAULT 'En attente de demande'::character varying NOT NULL,
    webhook_sent boolean DEFAULT false,
    nocodb_verified boolean DEFAULT false,
    nocodb_verified_at timestamp without time zone,
    processed_at timestamp without time zone,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.avoirs OWNER TO neondb_owner;

--
-- TOC entry 275 (class 1259 OID 2367488)
-- Name: avoirs_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.avoirs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.avoirs_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3852 (class 0 OID 0)
-- Dependencies: 275
-- Name: avoirs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.avoirs_id_seq OWNED BY public.avoirs.id;


--
-- TOC entry 216 (class 1259 OID 24577)
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.calendar_events (
    id integer NOT NULL,
    title text NOT NULL,
    description text,
    user_id integer NOT NULL,
    store_id integer NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    is_all_day boolean DEFAULT false,
    type text DEFAULT 'event'::text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.calendar_events OWNER TO neondb_owner;

--
-- TOC entry 215 (class 1259 OID 24576)
-- Name: calendar_events_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.calendar_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.calendar_events_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3853 (class 0 OID 0)
-- Dependencies: 215
-- Name: calendar_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.calendar_events_id_seq OWNED BY public.calendar_events.id;


--
-- TOC entry 218 (class 1259 OID 24590)
-- Name: client_orders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.client_orders (
    id integer NOT NULL,
    order_number text NOT NULL,
    customer_id integer NOT NULL,
    store_id integer NOT NULL,
    user_id integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    total_amount numeric(10,2),
    order_date timestamp without time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.client_orders OWNER TO neondb_owner;

--
-- TOC entry 217 (class 1259 OID 24589)
-- Name: client_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.client_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.client_orders_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3854 (class 0 OID 0)
-- Dependencies: 217
-- Name: client_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.client_orders_id_seq OWNED BY public.client_orders.id;


--
-- TOC entry 220 (class 1259 OID 24605)
-- Name: command_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.command_items (
    id integer NOT NULL,
    command_id integer NOT NULL,
    product_name text NOT NULL,
    product_code text,
    quantity integer NOT NULL,
    unit_price numeric(10,2),
    total_price numeric(10,2),
    expiry_date timestamp without time zone
);


ALTER TABLE public.command_items OWNER TO neondb_owner;

--
-- TOC entry 219 (class 1259 OID 24604)
-- Name: command_items_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.command_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.command_items_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3855 (class 0 OID 0)
-- Dependencies: 219
-- Name: command_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.command_items_id_seq OWNED BY public.command_items.id;


--
-- TOC entry 222 (class 1259 OID 24614)
-- Name: commands; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.commands (
    id integer NOT NULL,
    command_number text NOT NULL,
    supplier_id integer NOT NULL,
    store_id integer NOT NULL,
    user_id integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    total_amount numeric(10,2),
    notes text,
    order_date timestamp without time zone DEFAULT now() NOT NULL,
    expected_delivery_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.commands OWNER TO neondb_owner;

--
-- TOC entry 221 (class 1259 OID 24613)
-- Name: commands_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.commands_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.commands_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3856 (class 0 OID 0)
-- Dependencies: 221
-- Name: commands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.commands_id_seq OWNED BY public.commands.id;


--
-- TOC entry 247 (class 1259 OID 57526)
-- Name: customer_orders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customer_orders (
    id integer NOT NULL,
    order_taker character varying NOT NULL,
    customer_name character varying NOT NULL,
    customer_phone character varying NOT NULL,
    customer_email character varying,
    product_designation text NOT NULL,
    product_reference character varying,
    gencode character varying NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    supplier_id integer NOT NULL,
    status character varying DEFAULT 'En attente de Commande'::character varying NOT NULL,
    deposit numeric(10,2) DEFAULT 0.00,
    is_promotional_price boolean DEFAULT false,
    customer_notified boolean DEFAULT false,
    notes text,
    group_id integer NOT NULL,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.customer_orders OWNER TO neondb_owner;

--
-- TOC entry 246 (class 1259 OID 57525)
-- Name: customer_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.customer_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_orders_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3857 (class 0 OID 0)
-- Dependencies: 246
-- Name: customer_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.customer_orders_id_seq OWNED BY public.customer_orders.id;


--
-- TOC entry 224 (class 1259 OID 24629)
-- Name: customers; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    phone text,
    address text,
    store_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customers OWNER TO neondb_owner;

--
-- TOC entry 223 (class 1259 OID 24628)
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customers_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3858 (class 0 OID 0)
-- Dependencies: 223
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- TOC entry 268 (class 1259 OID 2342913)
-- Name: dashboard_messages; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.dashboard_messages (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    type character varying(50) DEFAULT 'info'::character varying NOT NULL,
    store_id integer,
    created_by character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.dashboard_messages OWNER TO neondb_owner;

--
-- TOC entry 267 (class 1259 OID 2342912)
-- Name: dashboard_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.dashboard_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dashboard_messages_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3859 (class 0 OID 0)
-- Dependencies: 267
-- Name: dashboard_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.dashboard_messages_id_seq OWNED BY public.dashboard_messages.id;


--
-- TOC entry 262 (class 1259 OID 819214)
-- Name: database_backups; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.database_backups (
    id character varying(255) NOT NULL,
    filename character varying(255) NOT NULL,
    description text,
    size bigint DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(255) NOT NULL,
    tables_count integer DEFAULT 0,
    status character varying(50) DEFAULT 'creating'::character varying,
    backup_type character varying(10) DEFAULT 'manual'::character varying
);


ALTER TABLE public.database_backups OWNER TO neondb_owner;

--
-- TOC entry 259 (class 1259 OID 73734)
-- Name: deliveries; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.deliveries (
    id integer NOT NULL,
    order_id integer,
    supplier_id integer NOT NULL,
    group_id integer NOT NULL,
    scheduled_date date NOT NULL,
    delivered_date timestamp without time zone,
    quantity integer NOT NULL,
    unit character varying NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    notes text,
    bl_number character varying,
    bl_amount numeric(10,2),
    invoice_reference character varying,
    invoice_amount numeric(10,2),
    reconciled boolean DEFAULT false,
    validated_at timestamp without time zone,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT deliveries_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'planned'::character varying, 'delivered'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.deliveries OWNER TO neondb_owner;

--
-- TOC entry 258 (class 1259 OID 73733)
-- Name: deliveries_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.deliveries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.deliveries_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3860 (class 0 OID 0)
-- Dependencies: 258
-- Name: deliveries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.deliveries_id_seq OWNED BY public.deliveries.id;


--
-- TOC entry 226 (class 1259 OID 24654)
-- Name: delivery_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.delivery_items (
    id integer NOT NULL,
    delivery_id integer NOT NULL,
    command_item_id integer,
    product_name text NOT NULL,
    quantity_ordered integer NOT NULL,
    quantity_delivered integer NOT NULL,
    quantity_damaged integer DEFAULT 0,
    notes text
);


ALTER TABLE public.delivery_items OWNER TO neondb_owner;

--
-- TOC entry 225 (class 1259 OID 24653)
-- Name: delivery_items_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.delivery_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.delivery_items_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3861 (class 0 OID 0)
-- Dependencies: 225
-- Name: delivery_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.delivery_items_id_seq OWNED BY public.delivery_items.id;


--
-- TOC entry 249 (class 1259 OID 57542)
-- Name: dlc_products; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.dlc_products (
    id integer NOT NULL,
    name character varying NOT NULL,
    gencode character varying,
    dlc_date date,
    quantity integer,
    store_id integer,
    created_at timestamp without time zone DEFAULT now(),
    group_id integer,
    created_by character varying,
    status character varying DEFAULT 'active'::character varying,
    validated_by character varying,
    expiry_date date,
    product_code character varying(255),
    description text,
    supplier_id integer,
    product_name character varying(255),
    date_type character varying(50) DEFAULT 'DLC'::character varying,
    unit character varying(50) DEFAULT 'unité'::character varying,
    location character varying(255) DEFAULT 'Magasin'::character varying,
    alert_threshold integer DEFAULT 15,
    notes text,
    updated_at timestamp without time zone DEFAULT now(),
    validated_at timestamp without time zone,
    stock_epuise boolean DEFAULT false NOT NULL,
    stock_epuise_by character varying(255),
    stock_epuise_at timestamp without time zone,
    processed_at timestamp without time zone,
    processed_by character varying,
    processed_until_expiry boolean DEFAULT false
);


ALTER TABLE public.dlc_products OWNER TO neondb_owner;

--
-- TOC entry 3862 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN dlc_products.stock_epuise; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public.dlc_products.stock_epuise IS 'Indique si le produit est marqué comme stock épuisé';


--
-- TOC entry 3863 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN dlc_products.stock_epuise_by; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public.dlc_products.stock_epuise_by IS 'ID de l''utilisateur qui a marqué le produit comme stock épuisé';


--
-- TOC entry 3864 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN dlc_products.stock_epuise_at; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public.dlc_products.stock_epuise_at IS 'Date et heure de marquage du stock épuisé';


--
-- TOC entry 248 (class 1259 OID 57541)
-- Name: dlc_products_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.dlc_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dlc_products_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3865 (class 0 OID 0)
-- Dependencies: 248
-- Name: dlc_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.dlc_products_id_seq OWNED BY public.dlc_products.id;


--
-- TOC entry 237 (class 1259 OID 57451)
-- Name: groups; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.groups (
    id integer NOT NULL,
    name character varying NOT NULL,
    color character varying DEFAULT '#3b82f6'::character varying,
    address text,
    phone character varying,
    email character varying,
    nocodb_config_id integer,
    nocodb_table_id character varying,
    nocodb_table_name character varying,
    invoice_column_name character varying DEFAULT 'Ref Facture'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    nocodb_bl_column_name character varying DEFAULT 'Numéro de BL'::character varying,
    nocodb_amount_column_name character varying DEFAULT 'Montant HT'::character varying,
    nocodb_supplier_column_name character varying DEFAULT 'Fournisseur'::character varying,
    webhook_url character varying DEFAULT ''::character varying
);


ALTER TABLE public.groups OWNER TO neondb_owner;

--
-- TOC entry 236 (class 1259 OID 57450)
-- Name: groups_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.groups_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3866 (class 0 OID 0)
-- Dependencies: 236
-- Name: groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.groups_id_seq OWNED BY public.groups.id;


--
-- TOC entry 266 (class 1259 OID 2310146)
-- Name: invoice_verification_cache; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.invoice_verification_cache (
    id integer NOT NULL,
    cache_key character varying(255) NOT NULL,
    group_id integer NOT NULL,
    invoice_reference character varying(100) NOT NULL,
    delivery_id integer,
    verification_result jsonb NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    supplier_name character varying(255),
    "exists" boolean DEFAULT false NOT NULL,
    match_type character varying(50) DEFAULT 'none'::character varying NOT NULL,
    error_message text,
    cache_hit boolean DEFAULT false,
    api_call_time integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_reconciled boolean DEFAULT false
);


ALTER TABLE public.invoice_verification_cache OWNER TO neondb_owner;

--
-- TOC entry 265 (class 1259 OID 2310145)
-- Name: invoice_verification_cache_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.invoice_verification_cache_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoice_verification_cache_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3867 (class 0 OID 0)
-- Dependencies: 265
-- Name: invoice_verification_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.invoice_verification_cache_id_seq OWNED BY public.invoice_verification_cache.id;


--
-- TOC entry 264 (class 1259 OID 2285569)
-- Name: invoice_verifications; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.invoice_verifications (
    id integer NOT NULL,
    delivery_id integer NOT NULL,
    group_id integer NOT NULL,
    invoice_reference character varying(255) NOT NULL,
    supplier_name character varying(255),
    "exists" boolean NOT NULL,
    match_type character varying(50),
    verified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_valid boolean DEFAULT true,
    last_checked_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.invoice_verifications OWNER TO neondb_owner;

--
-- TOC entry 263 (class 1259 OID 2285568)
-- Name: invoice_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.invoice_verifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoice_verifications_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3868 (class 0 OID 0)
-- Dependencies: 263
-- Name: invoice_verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.invoice_verifications_id_seq OWNED BY public.invoice_verifications.id;


--
-- TOC entry 228 (class 1259 OID 24677)
-- Name: invoices; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.invoices (
    id integer NOT NULL,
    invoice_number text NOT NULL,
    command_id integer,
    delivery_id integer,
    store_id integer NOT NULL,
    user_id integer NOT NULL,
    type text NOT NULL,
    total_amount numeric(10,2),
    status text DEFAULT 'draft'::text NOT NULL,
    issue_date timestamp without time zone DEFAULT now() NOT NULL,
    due_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.invoices OWNER TO neondb_owner;

--
-- TOC entry 227 (class 1259 OID 24676)
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoices_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3869 (class 0 OID 0)
-- Dependencies: 227
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;


--
-- TOC entry 270 (class 1259 OID 2359297)
-- Name: migrations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    filename character varying(255) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.migrations OWNER TO neondb_owner;

--
-- TOC entry 269 (class 1259 OID 2359296)
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migrations_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3870 (class 0 OID 0)
-- Dependencies: 269
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- TOC entry 239 (class 1259 OID 57464)
-- Name: nocodb_config; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.nocodb_config (
    id integer NOT NULL,
    name character varying NOT NULL,
    base_url character varying NOT NULL,
    project_id character varying NOT NULL,
    api_token character varying NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.nocodb_config OWNER TO neondb_owner;

--
-- TOC entry 238 (class 1259 OID 57463)
-- Name: nocodb_config_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.nocodb_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.nocodb_config_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3871 (class 0 OID 0)
-- Dependencies: 238
-- Name: nocodb_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.nocodb_config_id_seq OWNED BY public.nocodb_config.id;


--
-- TOC entry 243 (class 1259 OID 57488)
-- Name: orders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    supplier_id integer NOT NULL,
    group_id integer NOT NULL,
    planned_date date NOT NULL,
    quantity integer,
    unit character varying,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    notes text,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT orders_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'planned'::character varying, 'delivered'::character varying])::text[])))
);


ALTER TABLE public.orders OWNER TO neondb_owner;

--
-- TOC entry 242 (class 1259 OID 57487)
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3872 (class 0 OID 0)
-- Dependencies: 242
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- TOC entry 255 (class 1259 OID 57581)
-- Name: permissions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    name character varying NOT NULL,
    display_name character varying NOT NULL,
    description text,
    category character varying NOT NULL,
    action character varying NOT NULL,
    resource character varying NOT NULL,
    is_system boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.permissions OWNER TO neondb_owner;

--
-- TOC entry 254 (class 1259 OID 57580)
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permissions_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3873 (class 0 OID 0)
-- Dependencies: 254
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- TOC entry 245 (class 1259 OID 57513)
-- Name: publicities; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.publicities (
    id integer NOT NULL,
    pub_number character varying NOT NULL,
    designation text NOT NULL,
    title character varying,
    description text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    year integer NOT NULL,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.publicities OWNER TO neondb_owner;

--
-- TOC entry 244 (class 1259 OID 57512)
-- Name: publicities_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.publicities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.publicities_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3874 (class 0 OID 0)
-- Dependencies: 244
-- Name: publicities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.publicities_id_seq OWNED BY public.publicities.id;


--
-- TOC entry 257 (class 1259 OID 57615)
-- Name: publicity_participations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.publicity_participations (
    publicity_id integer NOT NULL,
    group_id integer NOT NULL
);


ALTER TABLE public.publicity_participations OWNER TO neondb_owner;

--
-- TOC entry 278 (class 1259 OID 2375681)
-- Name: reconciliation_comments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.reconciliation_comments (
    id integer NOT NULL,
    content text NOT NULL,
    type character varying(255) NOT NULL,
    delivery_id integer NOT NULL,
    author_id character varying(255) NOT NULL,
    group_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT reconciliation_comments_type_check CHECK (((type)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'error'::character varying, 'success'::character varying])::text[])))
);


ALTER TABLE public.reconciliation_comments OWNER TO neondb_owner;

--
-- TOC entry 277 (class 1259 OID 2375680)
-- Name: reconciliation_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.reconciliation_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reconciliation_comments_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3875 (class 0 OID 0)
-- Dependencies: 277
-- Name: reconciliation_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.reconciliation_comments_id_seq OWNED BY public.reconciliation_comments.id;


--
-- TOC entry 256 (class 1259 OID 57609)
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.role_permissions (
    role_id integer NOT NULL,
    permission_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.role_permissions OWNER TO neondb_owner;

--
-- TOC entry 253 (class 1259 OID 57565)
-- Name: roles; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying NOT NULL,
    display_name character varying NOT NULL,
    description text,
    color character varying DEFAULT '#6b7280'::character varying,
    is_system boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.roles OWNER TO neondb_owner;

--
-- TOC entry 252 (class 1259 OID 57564)
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3876 (class 0 OID 0)
-- Dependencies: 252
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- TOC entry 230 (class 1259 OID 24692)
-- Name: sav_tickets; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sav_tickets (
    id integer NOT NULL,
    ticket_number text NOT NULL,
    customer_id integer,
    store_id integer NOT NULL,
    user_id integer NOT NULL,
    assigned_user_id integer,
    title text NOT NULL,
    description text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    category text,
    resolution text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sav_tickets OWNER TO neondb_owner;

--
-- TOC entry 229 (class 1259 OID 24691)
-- Name: sav_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.sav_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sav_tickets_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3877 (class 0 OID 0)
-- Dependencies: 229
-- Name: sav_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.sav_tickets_id_seq OWNED BY public.sav_tickets.id;


--
-- TOC entry 233 (class 1259 OID 32770)
-- Name: session; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO neondb_owner;

--
-- TOC entry 234 (class 1259 OID 57427)
-- Name: sessions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO neondb_owner;

--
-- TOC entry 232 (class 1259 OID 24707)
-- Name: stores; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.stores (
    id integer NOT NULL,
    name text NOT NULL,
    address text,
    phone text,
    email text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.stores OWNER TO neondb_owner;

--
-- TOC entry 231 (class 1259 OID 24706)
-- Name: stores_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.stores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stores_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3878 (class 0 OID 0)
-- Dependencies: 231
-- Name: stores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.stores_id_seq OWNED BY public.stores.id;


--
-- TOC entry 241 (class 1259 OID 57476)
-- Name: suppliers; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.suppliers (
    id integer NOT NULL,
    name character varying NOT NULL,
    contact character varying,
    phone character varying,
    has_dlc boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    automatic_reconciliation boolean DEFAULT false
);


ALTER TABLE public.suppliers OWNER TO neondb_owner;

--
-- TOC entry 240 (class 1259 OID 57475)
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.suppliers_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3879 (class 0 OID 0)
-- Dependencies: 240
-- Name: suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;


--
-- TOC entry 251 (class 1259 OID 57552)
-- Name: tasks; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    title character varying NOT NULL,
    description text,
    assigned_to character varying,
    due_date date,
    priority character varying DEFAULT 'medium'::character varying,
    status character varying DEFAULT 'todo'::character varying,
    store_id integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying,
    group_id integer,
    start_date timestamp without time zone,
    completed_at timestamp without time zone,
    completed_by character varying(255)
);


ALTER TABLE public.tasks OWNER TO neondb_owner;

--
-- TOC entry 250 (class 1259 OID 57551)
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3880 (class 0 OID 0)
-- Dependencies: 250
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- TOC entry 261 (class 1259 OID 720923)
-- Name: user_groups; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_groups (
    user_id character varying(255) NOT NULL,
    group_id integer NOT NULL,
    assigned_by character varying(255),
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_groups OWNER TO neondb_owner;

--
-- TOC entry 260 (class 1259 OID 720910)
-- Name: user_roles; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_roles (
    user_id character varying(255) NOT NULL,
    role_id integer NOT NULL,
    assigned_by character varying(255),
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_roles OWNER TO neondb_owner;

--
-- TOC entry 235 (class 1259 OID 57435)
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id character varying NOT NULL,
    username character varying,
    email character varying,
    name character varying,
    first_name character varying,
    last_name character varying,
    profile_image_url character varying,
    password character varying,
    role character varying DEFAULT 'employee'::character varying NOT NULL,
    password_changed boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- TOC entry 280 (class 1259 OID 2383873)
-- Name: weather_settings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.weather_settings (
    id integer NOT NULL,
    api_key character varying(255),
    default_city character varying(255) DEFAULT 'Paris'::character varying NOT NULL,
    units character varying(10) DEFAULT 'metric'::character varying NOT NULL,
    update_interval integer DEFAULT 30 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    location character varying(255) DEFAULT 'Paris'::character varying
);


ALTER TABLE public.weather_settings OWNER TO neondb_owner;

--
-- TOC entry 279 (class 1259 OID 2383872)
-- Name: weather_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.weather_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.weather_settings_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3881 (class 0 OID 0)
-- Dependencies: 279
-- Name: weather_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.weather_settings_id_seq OWNED BY public.weather_settings.id;


--
-- TOC entry 274 (class 1259 OID 2359334)
-- Name: webhook_bap_config; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.webhook_bap_config (
    id integer NOT NULL,
    name character varying(100) DEFAULT 'Configuration BAP'::character varying NOT NULL,
    webhook_url text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.webhook_bap_config OWNER TO neondb_owner;

--
-- TOC entry 3882 (class 0 OID 0)
-- Dependencies: 274
-- Name: TABLE webhook_bap_config; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public.webhook_bap_config IS 'Configuration pour webhook BAP n8n';


--
-- TOC entry 273 (class 1259 OID 2359333)
-- Name: webhook_bap_config_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.webhook_bap_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.webhook_bap_config_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3883 (class 0 OID 0)
-- Dependencies: 273
-- Name: webhook_bap_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.webhook_bap_config_id_seq OWNED BY public.webhook_bap_config.id;


--
-- TOC entry 3477 (class 2604 OID 2359310)
-- Name: announcements id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);


--
-- TOC entry 3486 (class 2604 OID 2367492)
-- Name: avoirs id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.avoirs ALTER COLUMN id SET DEFAULT nextval('public.avoirs_id_seq'::regclass);


--
-- TOC entry 3352 (class 2604 OID 24580)
-- Name: calendar_events id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.calendar_events ALTER COLUMN id SET DEFAULT nextval('public.calendar_events_id_seq'::regclass);


--
-- TOC entry 3357 (class 2604 OID 24593)
-- Name: client_orders id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_orders ALTER COLUMN id SET DEFAULT nextval('public.client_orders_id_seq'::regclass);


--
-- TOC entry 3362 (class 2604 OID 24608)
-- Name: command_items id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.command_items ALTER COLUMN id SET DEFAULT nextval('public.command_items_id_seq'::regclass);


--
-- TOC entry 3363 (class 2604 OID 24617)
-- Name: commands id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.commands ALTER COLUMN id SET DEFAULT nextval('public.commands_id_seq'::regclass);


--
-- TOC entry 3416 (class 2604 OID 57529)
-- Name: customer_orders id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_orders ALTER COLUMN id SET DEFAULT nextval('public.customer_orders_id_seq'::regclass);


--
-- TOC entry 3368 (class 2604 OID 24632)
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- TOC entry 3472 (class 2604 OID 2342916)
-- Name: dashboard_messages id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.dashboard_messages ALTER COLUMN id SET DEFAULT nextval('public.dashboard_messages_id_seq'::regclass);


--
-- TOC entry 3449 (class 2604 OID 73737)
-- Name: deliveries id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.deliveries ALTER COLUMN id SET DEFAULT nextval('public.deliveries_id_seq'::regclass);


--
-- TOC entry 3371 (class 2604 OID 24657)
-- Name: delivery_items id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.delivery_items ALTER COLUMN id SET DEFAULT nextval('public.delivery_items_id_seq'::regclass);


--
-- TOC entry 3424 (class 2604 OID 57545)
-- Name: dlc_products id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.dlc_products ALTER COLUMN id SET DEFAULT nextval('public.dlc_products_id_seq'::regclass);


--
-- TOC entry 3391 (class 2604 OID 57454)
-- Name: groups id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.groups ALTER COLUMN id SET DEFAULT nextval('public.groups_id_seq'::regclass);


--
-- TOC entry 3465 (class 2604 OID 2310149)
-- Name: invoice_verification_cache id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoice_verification_cache ALTER COLUMN id SET DEFAULT nextval('public.invoice_verification_cache_id_seq'::regclass);


--
-- TOC entry 3461 (class 2604 OID 2285572)
-- Name: invoice_verifications id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoice_verifications ALTER COLUMN id SET DEFAULT nextval('public.invoice_verifications_id_seq'::regclass);


--
-- TOC entry 3373 (class 2604 OID 24680)
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);


--
-- TOC entry 3475 (class 2604 OID 2359300)
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- TOC entry 3400 (class 2604 OID 57467)
-- Name: nocodb_config id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.nocodb_config ALTER COLUMN id SET DEFAULT nextval('public.nocodb_config_id_seq'::regclass);


--
-- TOC entry 3409 (class 2604 OID 57491)
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- TOC entry 3445 (class 2604 OID 57584)
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- TOC entry 3413 (class 2604 OID 57516)
-- Name: publicities id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.publicities ALTER COLUMN id SET DEFAULT nextval('public.publicities_id_seq'::regclass);


--
-- TOC entry 3493 (class 2604 OID 2375684)
-- Name: reconciliation_comments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reconciliation_comments ALTER COLUMN id SET DEFAULT nextval('public.reconciliation_comments_id_seq'::regclass);


--
-- TOC entry 3439 (class 2604 OID 57568)
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- TOC entry 3378 (class 2604 OID 24695)
-- Name: sav_tickets id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sav_tickets ALTER COLUMN id SET DEFAULT nextval('public.sav_tickets_id_seq'::regclass);


--
-- TOC entry 3383 (class 2604 OID 24710)
-- Name: stores id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.stores ALTER COLUMN id SET DEFAULT nextval('public.stores_id_seq'::regclass);


--
-- TOC entry 3404 (class 2604 OID 57479)
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- TOC entry 3434 (class 2604 OID 57555)
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- TOC entry 3496 (class 2604 OID 2383876)
-- Name: weather_settings id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.weather_settings ALTER COLUMN id SET DEFAULT nextval('public.weather_settings_id_seq'::regclass);


--
-- TOC entry 3481 (class 2604 OID 2359337)
-- Name: webhook_bap_config id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.webhook_bap_config ALTER COLUMN id SET DEFAULT nextval('public.webhook_bap_config_id_seq'::regclass);


--
-- TOC entry 3832 (class 0 OID 2359307)
-- Dependencies: 272
-- Data for Name: announcements; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.announcements (id, title, content, priority, author_id, group_id, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3836 (class 0 OID 2367489)
-- Dependencies: 276
-- Data for Name: avoirs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.avoirs (id, supplier_id, group_id, invoice_reference, amount, comment, commercial_processed, status, webhook_sent, nocodb_verified, nocodb_verified_at, processed_at, created_by, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3776 (class 0 OID 24577)
-- Dependencies: 216
-- Data for Name: calendar_events; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.calendar_events (id, title, description, user_id, store_id, start_date, end_date, is_all_day, type, metadata, created_at, updated_at) FROM stdin;
1	Réunion équipe mensuelle	Point mensuel sur les objectifs et nouveautés	1	1	2025-01-15 09:00:00	2025-01-15 10:30:00	f	meeting	\N	2025-07-10 10:43:36.498061	2025-07-10 10:43:36.498061
2	Formation sécurité	Formation obligatoire sécurité incendie	1	1	2025-01-18 14:00:00	2025-01-18 17:00:00	f	event	\N	2025-07-10 10:43:36.498061	2025-07-10 10:43:36.498061
3	Livraison importante	Réception commande mobilier salon	2	1	2025-01-15 14:00:00	2025-01-15 16:00:00	f	delivery	\N	2025-07-10 10:43:36.498061	2025-07-10 10:43:36.498061
4	Inventaire annuel	Inventaire complet du magasin	3	2	2025-01-25 08:00:00	2025-01-25 18:00:00	t	event	\N	2025-07-10 10:43:36.498061	2025-07-10 10:43:36.498061
5	Visite inspection	Visite du responsable régional	5	3	2025-01-22 10:00:00	2025-01-22 12:00:00	f	meeting	\N	2025-07-10 10:43:36.498061	2025-07-10 10:43:36.498061
6	Soldes d'hiver	Début des soldes d'hiver	1	1	2025-01-08 08:00:00	2025-02-04 20:00:00	t	event	\N	2025-07-10 10:43:36.498061	2025-07-10 10:43:36.498061
\.


--
-- TOC entry 3778 (class 0 OID 24590)
-- Dependencies: 218
-- Data for Name: client_orders; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.client_orders (id, order_number, customer_id, store_id, user_id, status, total_amount, order_date, notes, created_at, updated_at) FROM stdin;
1	CLT-2025-001	1	1	2	processing	680.50	2025-01-08 14:30:00	Livraison prévue vendredi matin	2025-07-10 10:43:46.442279	2025-07-10 10:43:46.442279
2	CLT-2025-002	2	2	3	completed	1250.00	2025-01-05 10:15:00	Client satisfait de la livraison	2025-07-10 10:43:46.442279	2025-07-10 10:43:46.442279
3	CLT-2025-003	3	3	5	pending	890.75	2025-01-09 16:45:00	En attente de validation paiement	2025-07-10 10:43:46.442279	2025-07-10 10:43:46.442279
4	CLT-2025-004	4	1	2	cancelled	450.00	2025-01-07 11:20:00	Annulé par le client - remboursement effectué	2025-07-10 10:43:46.442279	2025-07-10 10:43:46.442279
5	CLT-2025-005	5	2	3	processing	1580.25	2025-01-09 09:30:00	Commande spéciale mobilier sur mesure	2025-07-10 10:43:46.442279	2025-07-10 10:43:46.442279
\.


--
-- TOC entry 3780 (class 0 OID 24605)
-- Dependencies: 220
-- Data for Name: command_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.command_items (id, command_id, product_name, product_code, quantity, unit_price, total_price, expiry_date) FROM stdin;
1	1	Canapé 3 places gris	MBL-CAP-001	2	450.00	900.00	\N
2	1	Table basse chêne	MBL-TBL-002	1	220.00	220.00	\N
3	1	Coussin décoratif	DEC-COU-003	6	21.67	130.00	\N
4	2	Vase céramique bleu	DEC-VAS-001	12	35.50	426.00	\N
5	2	Cadre photo 20x30	DEC-CAD-002	15	18.50	277.50	\N
6	2	Bougie parfumée	DEC-BOU-003	24	7.83	187.92	\N
7	3	Salon de jardin teck	JAR-SAL-001	1	1250.00	1250.00	\N
8	3	Parasol déporté 3m	JAR-PAR-002	2	285.50	571.00	\N
9	3	Coussins extérieur	JAR-COU-003	8	41.22	329.75	\N
10	4	Bureau informatique	BUR-INF-001	1	320.00	320.00	\N
11	4	Chaise ergonomique	BUR-CHA-002	2	123.90	247.80	\N
12	5	Tonnelle 3x4m	JAR-TON-001	1	890.00	890.00	\N
13	5	Plancha gaz	JAR-PLA-002	1	456.00	456.00	\N
14	5	Set outils jardinage	JAR-OUT-003	3	144.75	434.25	\N
\.


--
-- TOC entry 3782 (class 0 OID 24614)
-- Dependencies: 222
-- Data for Name: commands; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.commands (id, command_number, supplier_id, store_id, user_id, status, total_amount, notes, order_date, expected_delivery_date, created_at, updated_at) FROM stdin;
1	CMD-2025-001	1	1	1	pending	1250.50	Commande urgente pour réapprovisionnement	2025-07-10 10:29:05.575664	2025-07-17 10:29:05.575664	2025-07-10 10:29:05.575664	2025-07-10 10:29:05.575664
2	CMD-2025-002	2	1	1	validated	2100.75	Commande saisonnière hiver	2025-07-08 10:29:05.575664	2025-07-15 10:29:05.575664	2025-07-10 10:29:05.575664	2025-07-10 10:29:05.575664
3	CMD-2025-003	3	1	1	shipped	850.00	Mobilier jardin	2025-07-05 10:29:05.575664	2025-07-12 10:29:05.575664	2025-07-10 10:29:05.575664	2025-07-10 10:29:05.575664
7	CMD-2025-004	4	1	1	delivered	567.80	Mobilier bureau	2024-12-28 11:45:00	2025-01-03 10:00:00	2025-07-10 10:42:54.106019	2025-07-10 10:42:54.106019
8	CMD-2025-005	5	3	5	pending	1780.25	Collection jardin été	2025-01-09 16:10:00	2025-01-20 11:30:00	2025-07-10 10:42:54.106019	2025-07-10 10:42:54.106019
\.


--
-- TOC entry 3807 (class 0 OID 57526)
-- Dependencies: 247
-- Data for Name: customer_orders; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.customer_orders (id, order_taker, customer_name, customer_phone, customer_email, product_designation, product_reference, gencode, quantity, supplier_id, status, deposit, is_promotional_price, customer_notified, notes, group_id, created_by, created_at, updated_at) FROM stdin;
1	moi	schal	0623154654	\N	qsdfg	erf13213	3660092323745	1	1	En attente de Commande	10.00	f	f	\N	3	1	2025-07-19 19:03:44.739	2025-07-19 19:03:44.739
2	moi	schal	0623154654	\N	fgdsh	erf13213	366092323745	1	1	En attente de Commande	0.00	f	f	\N	5	_1753182518439	2025-07-22 13:19:27.447	2025-07-22 13:19:27.447
336583	admin	Test Client 336583	0123456789	\N	Test Product Designation	\N	GENCODE336583	1	1	pending	0.00	f	f	\N	1	admin	2025-09-11 10:57:11.071226	2025-09-11 10:57:11.071226
685430	admin	Test Client 685430	0123456789	\N	Test Product Designation	\N	GENCODE685430	1	1	pending	0.00	f	f	\N	1	admin	2025-09-11 10:57:46.938934	2025-09-11 10:57:46.938934
409686	admin	Test Client 409686	0123456789	\N	Test Product Designation	\N	GENCODE409686	1	1	pending	0.00	f	f	\N	1	admin	2025-09-11 10:58:00.328537	2025-09-11 10:58:00.328537
\.


--
-- TOC entry 3784 (class 0 OID 24629)
-- Dependencies: 224
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.customers (id, first_name, last_name, email, phone, address, store_id, created_at, updated_at) FROM stdin;
1	Sophie	Dubois	sophie.dubois@email.com	06 12 34 56 78	10 Rue de la Paix, Paris	1	2025-07-10 10:29:05.575664	2025-07-10 10:29:05.575664
2	Marc	Legrand	marc.legrand@email.com	06 23 45 67 89	45 Avenue Montaigne, Paris	1	2025-07-10 10:29:05.575664	2025-07-10 10:29:05.575664
3	Julie	Moreau	julie.moreau@email.com	06 34 56 78 90	32 Boulevard Saint-Germain, Paris	1	2025-07-10 10:29:05.575664	2025-07-10 10:29:05.575664
4	Claire	Dubois	claire.dubois@email.com	06.12.34.56.78	45 Rue des Lilas, 75013 Paris	1	2025-07-10 10:43:03.624218	2025-07-10 10:43:03.624218
5	Michel	Rousseau	michel.rousseau@email.com	06.87.65.43.21	12 Avenue Victor Hugo, 92100 Boulogne	2	2025-07-10 10:43:03.624218	2025-07-10 10:43:03.624218
6	Isabelle	Moreau	isabelle.moreau@email.com	06.23.45.67.89	78 Boulevard Gambetta, 59800 Lille	3	2025-07-10 10:43:03.624218	2025-07-10 10:43:03.624218
7	Thomas	Leroy	thomas.leroy@email.com	06.98.76.54.32	33 Place de la République, 75003 Paris	1	2025-07-10 10:43:03.624218	2025-07-10 10:43:03.624218
8	Sandrine	Garcia	sandrine.garcia@email.com	06.11.22.33.44	67 Rue de la Liberté, 92000 Nanterre	2	2025-07-10 10:43:03.624218	2025-07-10 10:43:03.624218
\.


--
-- TOC entry 3828 (class 0 OID 2342913)
-- Dependencies: 268
-- Data for Name: dashboard_messages; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.dashboard_messages (id, title, content, type, store_id, created_by, created_at) FROM stdin;
\.


--
-- TOC entry 3822 (class 0 OID 819214)
-- Dependencies: 262
-- Data for Name: database_backups; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.database_backups (id, filename, description, size, created_at, created_by, tables_count, status, backup_type) FROM stdin;
3BXbMdVkhtSryOk3HRGkp	backup_automatic_2025-09-17T21-56-37-345Z.sql	Automatique backup du 17/09/2025	131556	2025-09-17 21:56:37.375543	system	37	completed	automatic
FBwVzTaCwB4AS6GVU6SJ9	backup_automatic_2025-09-19T06-11-49-625Z.sql	Automatique backup du 19/09/2025	131556	2025-09-19 06:11:49.678533	system	37	completed	automatic
cICxm578x1hf1vPaQJROL	backup_automatic_2025-09-20T02-02-55-254Z.sql	Automatique backup du 20/09/2025	131556	2025-09-20 02:02:55.280114	system	37	completed	automatic
MDAobkh74ZgZZI9oS2XCI	backup_automatic_2025-09-21T06-22-14-480Z.sql	Automatique backup du 21/09/2025	131555	2025-09-21 06:22:14.50849	system	37	completed	automatic
V__NOBc-Hg8Kr9yiiGqna	backup_automatic_2025-09-22T05-28-11-122Z.sql	Automatique backup du 22/09/2025	131553	2025-09-22 05:28:11.1653	system	37	completed	automatic
NJ_zevppkB1fhTqNVpHVQ	backup_automatic_2025-09-23T08-42-36-690Z.sql	Automatique backup du 23/09/2025	131567	2025-09-23 08:42:36.721996	system	37	completed	automatic
T5omweVqNbmOb3c1fcDeC	backup_automatic_2025-09-24T06-04-17-915Z.sql	Automatique backup du 24/09/2025	131832	2025-09-24 06:04:17.944287	system	37	completed	automatic
DDcEQbW5fonM241HUWnmz	backup_automatic_2025-09-25T02-54-42-765Z.sql	Automatique backup du 25/09/2025	132377	2025-09-25 02:54:42.804109	system	37	completed	automatic
MkChSLBOwIZnScVZ5KcWd	backup_automatic_2025-09-26T02-58-35-800Z.sql	Automatique backup du 26/09/2025	133018	2025-09-26 02:58:35.841293	system	37	completed	automatic
fZa7gVGVHvaMl9kaLvJf8	backup_automatic_2025-09-27T09-13-38-191Z.sql	Automatique backup du 27/09/2025	133018	2025-09-27 09:13:38.216295	system	37	completed	automatic
RCy5qsra43fjigkO5fw0Z	backup_automatic_2025-09-28T06-02-00-545Z.sql	Automatique backup du 28/09/2025	0	2025-09-28 06:02:00.560751	system	0	creating	automatic
\.


--
-- TOC entry 3819 (class 0 OID 73734)
-- Dependencies: 259
-- Data for Name: deliveries; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.deliveries (id, order_id, supplier_id, group_id, scheduled_date, delivered_date, quantity, unit, status, notes, bl_number, bl_amount, invoice_reference, invoice_amount, reconciled, validated_at, created_by, created_at, updated_at) FROM stdin;
1	\N	1	1	2025-07-20	\N	10	palettes	pending	Test livraison	\N	\N	\N	\N	f	\N	1	2025-07-19 20:32:20.382559	2025-07-19 20:32:20.382559
3	\N	1	4	2025-07-25	\N	5	palettes	planned	Test statut planned	\N	\N	\N	\N	f	\N	admin_local	2025-07-19 20:34:11.951608	2025-07-19 20:34:11.951608
2	1	1	4	2025-07-17	2025-07-19 20:33:34.611	1	palettes	delivered	\N	BL12345678	1299.00	faC454566435F	1299.00	t	2025-07-19 20:33:34.611	1	2025-07-19 20:33:27.154225	2025-07-19 21:50:36.00099
101	2	1	4	2025-07-26	\N	3	palettes	planned	Test pour validation - liée à commande ID 2	\N	\N	\N	\N	f	\N	admin_local	2025-07-20 08:22:00.758253	2025-07-20 08:22:00.758253
102	4	3	5	2025-07-23	2025-07-22 13:16:16.924	1	palettes	delivered	\N	BL12345678	1200.00	FC25624812	1200.00	t	2025-07-22 13:16:16.924	_1753182518439	2025-07-22 13:07:50.937609	2025-07-22 13:16:35.824
104	\N	1	4	2025-07-23	2025-07-23 00:00:00	3	palettes	delivered	\N	BL205794	\N	\N	\N	f	\N	1	2025-07-24 13:23:51.878626	2025-07-24 13:23:51.878626
105	\N	2	4	2025-07-23	2025-07-23 00:00:00	2	palettes	delivered	\N	BL205795	\N	\N	\N	f	\N	1	2025-07-24 13:23:51.878626	2025-07-24 13:23:51.878626
106	\N	2	4	2025-07-16	2025-07-16 00:00:00	4	palettes	delivered	\N	BL1125071423	\N	\N	\N	f	\N	1	2025-07-24 13:23:51.878626	2025-07-24 13:23:51.878626
107	\N	1	4	2025-07-15	2025-07-15 00:00:00	6	palettes	delivered	\N	BL377797	\N	\N	\N	f	\N	1	2025-07-24 13:23:51.878626	2025-07-24 13:23:51.878626
108	\N	1	4	2025-07-25	\N	5	palettes	delivered	Test livraison 1 pour pagination	BL123456	1500.00	\N	\N	f	\N	admin_local	2025-07-25 11:51:33.774256	2025-07-25 11:51:33.774256
109	\N	2	4	2025-07-25	\N	3	palettes	delivered	Test livraison 2 pour pagination	BL123457	890.50	\N	\N	f	\N	admin_local	2025-07-25 11:51:33.774256	2025-07-25 11:51:33.774256
110	\N	1	4	2025-07-25	\N	7	palettes	delivered	Test livraison 3 pour pagination	BL123458	2100.00	\N	\N	f	\N	admin_local	2025-07-25 11:51:33.774256	2025-07-25 11:51:33.774256
111	\N	3	4	2025-07-26	\N	4	palettes	delivered	Test livraison 4 pour pagination	BL123459	1200.75	\N	\N	f	\N	admin_local	2025-07-25 11:51:33.774256	2025-07-25 11:51:33.774256
112	\N	1	4	2025-07-26	\N	6	palettes	delivered	Test livraison 5 pour pagination	BL123460	1800.25	\N	\N	f	\N	admin_local	2025-07-25 11:51:33.774256	2025-07-25 11:51:33.774256
113	\N	2	4	2025-07-26	\N	2	palettes	delivered	Test livraison 6 pour pagination	BL123461	650.00	\N	\N	f	\N	admin_local	2025-07-25 11:51:33.774256	2025-07-25 11:51:33.774256
114	\N	3	4	2025-07-27	\N	8	palettes	delivered	Test livraison 7 pour pagination	BL123462	2400.00	\N	\N	f	\N	admin_local	2025-07-25 11:51:33.774256	2025-07-25 11:51:33.774256
115	\N	1	4	2025-07-27	\N	5	palettes	delivered	Test livraison 8 pour pagination	BL123463	1500.00	\N	\N	f	\N	admin_local	2025-07-25 11:51:33.774256	2025-07-25 11:51:33.774256
116	\N	2	4	2025-07-27	\N	3	palettes	delivered	Test livraison 9 pour pagination	BL123464	900.00	\N	\N	f	\N	admin_local	2025-07-25 11:51:33.774256	2025-07-25 11:51:33.774256
117	\N	3	4	2025-07-28	\N	4	palettes	delivered	Test livraison 10 pour pagination	BL123465	1200.00	\N	\N	f	\N	admin_local	2025-07-25 11:51:33.774256	2025-07-25 11:51:33.774256
120	\N	4	1	2025-07-25	\N	1	palettes	planned	\N	\N	\N	\N	\N	f	\N	1	2025-07-25 18:34:31.897574	2025-07-25 18:34:31.897574
122	\N	4	1	2025-07-24	2025-07-27 16:09:31.86	1	palettes	delivered	\N	bllt015904	1200.00	25025575	1200.00	f	2025-07-27 16:09:31.86	1	2025-07-27 16:09:27.001141	2025-07-28 14:39:57.081
124	\N	5	5	2025-07-24	\N	1	palettes	delivered	\N	\N	\N	F5162713	5972.48	f	\N	_1753182518439	2025-07-30 12:59:12.824932	2025-07-30 12:59:12.824932
103	\N	1	4	2025-07-24	2025-07-24 00:00:00	5	palettes	delivered	\N	BL00130066	\N		\N	f	\N	1	2025-07-24 13:23:51.878626	2025-07-27 22:33:18.066
118	8	1	4	2025-08-08	2025-07-25 12:42:28.748	1	palettes	delivered	\N	BL2501644	1200.00		\N	f	2025-07-25 12:42:28.748	1	2025-07-25 12:42:19.117085	2025-07-27 22:34:05.073
119	\N	4	1	2025-07-25	2025-07-25 18:34:43.783	1	palettes	pending	\N	25025575	2468.48	25025575	2468.48	f	\N	1	2025-07-25 18:33:33.42942	2025-07-28 13:31:47.301
121	\N	4	1	2025-07-25	\N	2	palettes	delivered	\N	bllt015904	1200.00	25025575	1200.00	t	\N	1	2025-07-25 21:00:02.583105	2025-07-30 20:52:38.952429
126	\N	4	1	2025-07-24	\N	1	palettes	delivered	\N	\N	\N	\N	\N	f	\N	_1753182518439	2025-07-30 14:09:31.269975	2025-07-30 20:58:03.172497
128	\N	1	1	2025-08-20	\N	5	palettes	planned	Test cache PostgreSQL	\N	\N	FACT2025-001	1500.50	f	\N	1	2025-08-17 16:03:04.728264	2025-08-17 16:03:04.728264
129	\N	1	1	2025-08-21	\N	3	palettes	planned	Test même facture cache	\N	\N	FACT2025-001	1500.50	f	\N	1	2025-08-17 16:03:06.006233	2025-08-17 16:03:06.006233
130	\N	1	1	2025-08-20	\N	5	palettes	planned	Test cache MemStorage	\N	\N	FACT2025-001	1500.50	f	\N	1	2025-08-17 16:04:27.897356	2025-08-17 16:04:27.897356
131	\N	1	1	2025-08-21	\N	3	palettes	planned	Test même facture cache	\N	\N	FACT2025-001	1500.50	f	\N	1	2025-08-17 16:04:29.232538	2025-08-17 16:04:29.232538
132	\N	1	1	2025-08-20	\N	5	palettes	planned	Test final cache	\N	\N	FACT2025-002	2500.50	f	\N	1	2025-08-17 16:06:06.113457	2025-08-17 16:06:06.113457
133	\N	1	1	2025-08-21	\N	3	palettes	planned	Test même facture cache final	\N	\N	FACT2025-002	2500.50	f	\N	1	2025-08-17 16:06:07.49284	2025-08-17 16:06:07.49284
134	9	1	1	2025-09-30	\N	3	palettes	planned	\N	\N	\N	\N	\N	f	\N	admin_local	2025-09-23 09:40:01.331214	2025-09-23 09:40:01.331214
127	\N	5	5	2025-07-30	\N	1	palettes	delivered	\N	\N	\N	F5162713	5972.48	f	\N	admin_local	2025-07-30 14:54:27.805769	2025-09-27 09:18:29.596
\.


--
-- TOC entry 3786 (class 0 OID 24654)
-- Dependencies: 226
-- Data for Name: delivery_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.delivery_items (id, delivery_id, command_item_id, product_name, quantity_ordered, quantity_delivered, quantity_damaged, notes) FROM stdin;
\.


--
-- TOC entry 3809 (class 0 OID 57542)
-- Dependencies: 249
-- Data for Name: dlc_products; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.dlc_products (id, name, gencode, dlc_date, quantity, store_id, created_at, group_id, created_by, status, validated_by, expiry_date, product_code, description, supplier_id, product_name, date_type, unit, location, alert_threshold, notes, updated_at, validated_at, stock_epuise, stock_epuise_by, stock_epuise_at, processed_at, processed_by, processed_until_expiry) FROM stdin;
2	Produit Test DLC	1234567890123	2025-07-30	1	\N	2025-07-19 22:35:49.651214	4	admin_local	en_cours	\N	2025-07-30	1234567890123	\N	1	Produit Test DLC	DLC	unité	Magasin	15	Test stats	2025-07-19 22:35:49.651214	\N	f	\N	\N	\N	\N	f
3	Produit Expirant Bientôt	2345678901234	2025-07-22	2	\N	2025-07-19 22:35:49.651214	4	admin_local	en_cours	\N	2025-07-22	2345678901234	\N	1	Produit Expirant Bientôt	DLC	unité	Magasin	15	Expire dans 3 jours	2025-07-19 22:35:49.651214	\N	f	\N	\N	\N	\N	f
7	Produit Validé Test	VAL123	2025-08-15	1	\N	2025-07-19 23:54:00.380592	4	admin	valides	\N	\N	\N	\N	1	Produit Validé Test	DLC	unité	Magasin	15	Produit avec statut validé	2025-07-19 23:54:00.380592	\N	f	\N	\N	\N	\N	f
15	coca 	366092323745	\N	1	\N	2025-07-22 13:35:02.427	5	_1753182518439	en_cours	\N	2025-07-27	\N	\N	3	coca 	dlc	unité	Magasin	15		2025-07-22 13:35:02.427	\N	f	\N	\N	\N	\N	f
17	DLC Produit Test	zFGwX	\N	\N	\N	2025-09-11 11:11:28.243179	\N	\N	valides	\N	2026-01-01	\N	\N	\N	DLC Produit Test	DLC	unité	Magasin	15	\N	2025-09-11 11:11:28.243179	\N	f	\N	\N	\N	\N	f
24	Test DLC Fixé IRWcpS	1234567890123	\N	1	\N	2025-09-24 12:16:08.786084	1	admin_local	en_cours	\N	2025-12-25	\N	\N	1	Test DLC Fixé IRWcpS	dlc	unité	Magasin	15	Création automatique via test agent	2025-09-24 12:16:08.786084	\N	f	\N	\N	\N	\N	f
26	Test Product NIzB_	9999999999999	\N	1	\N	2025-09-25 06:52:51.837635	1	admin_local	en_cours	\N	2025-10-05	\N	\N	1	Test Product NIzB_	dlc	unité	Magasin	15		2025-09-25 06:58:05.022	\N	f	\N	\N	\N	\N	f
25	Test Product NgC8x	9999999999999	\N	1	\N	2025-09-25 06:45:45.9093	1	admin_local	en_cours	\N	2025-10-05	\N	\N	1	Test Product NgC8x	dlc	unité	Magasin	15		2025-09-27 11:38:59.385	\N	t	admin_local	2025-09-27 11:38:59.384	2025-09-27 11:38:49.482	admin_local	t
4	Produit Expiré	3456789012345	2025-07-15	1	\N	2025-07-19 22:35:49.651214	4	admin_local	valides	admin_local	2025-07-15	3456789012345	\N	1	Produit Expiré	DLC	unité	Magasin	15	Déjà expiré	2025-09-27 11:51:07.389	2025-09-27 11:51:07.389	f	\N	\N	\N	\N	f
\.


--
-- TOC entry 3797 (class 0 OID 57451)
-- Dependencies: 237
-- Data for Name: groups; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.groups (id, name, color, address, phone, email, nocodb_config_id, nocodb_table_id, nocodb_table_name, invoice_column_name, created_at, updated_at, nocodb_bl_column_name, nocodb_amount_column_name, nocodb_supplier_column_name, webhook_url) FROM stdin;
5	Houdemont	#455A64	\N	\N	\N	1	my7zunxprumahmm		RefFacture	2025-07-19 20:19:44.552373	2025-07-28 18:26:14.956	Numéro de BL	Montant HT	Fournisseurs	https://workflow.ffnancy.fr/webhook-test/9252adba-574b-44cb-a3d1-7c60f208b222
1	Frouard	#1976D2	\N	\N	\N	1	mrr733dfb8wtt9b	CommandeF	RefFacture	2025-07-19 20:19:38.471557	2025-07-30 14:09:25.328285	Numero_BL	Montant HT	Fournisseurs	https://test-webhook-1753648766995.example.com
2	Houdemont	#455A64	\N	\N	\N	1	my7zunxprumahmm	\N	Ref Facture	2025-07-30 14:09:25.328285	2025-07-30 14:09:25.328285	Numéro de BL	Montant HT	Fournisseurs	
\.


--
-- TOC entry 3826 (class 0 OID 2310146)
-- Dependencies: 266
-- Data for Name: invoice_verification_cache; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.invoice_verification_cache (id, cache_key, group_id, invoice_reference, delivery_id, verification_result, expires_at, created_at, supplier_name, "exists", match_type, error_message, cache_hit, api_call_time, updated_at, is_reconciled) FROM stdin;
\.


--
-- TOC entry 3824 (class 0 OID 2285569)
-- Dependencies: 264
-- Data for Name: invoice_verifications; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.invoice_verifications (id, delivery_id, group_id, invoice_reference, supplier_name, "exists", match_type, verified_at, is_valid, last_checked_at) FROM stdin;
4	102	5	FC25624812	Fournisseur DLC Test	f	NONE	2025-07-28 13:05:45.714	t	2025-07-28 13:05:45.714
8	121	1	25025575	Lidis	t	NONE	2025-07-28 13:51:45.431	t	2025-07-28 13:51:45.431
1	122	1	FC25624812	Lidis	f	NONE	2025-07-28 12:56:38.001	t	2025-07-28 14:39:37.862
14	127	5	F5162713	JJA Five	t	INVOICE_REF	2025-07-30 14:58:14.031205	t	2025-07-30 14:58:14.031205
15	124	5	F5162713	JJA Five	t	INVOICE_REF	2025-07-30 14:58:14.290283	t	2025-07-30 14:58:14.290283
\.


--
-- TOC entry 3788 (class 0 OID 24677)
-- Dependencies: 228
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.invoices (id, invoice_number, command_id, delivery_id, store_id, user_id, type, total_amount, status, issue_date, due_date, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3830 (class 0 OID 2359297)
-- Dependencies: 270
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.migrations (id, filename, executed_at) FROM stdin;
1	0000_flashy_blur.sql	2025-09-03 13:47:28.508044
2	002_add_dlc_stock_epuise.sql	2025-09-03 13:47:28.601169
3	20250816_create_announcements_table.sql	2025-09-03 13:47:28.767723
4	20250903141000_create_webhook_bap_config.sql	2025-09-03 13:47:28.881763
5	add_stock_epuise_fields.sql	2025-09-03 13:47:28.978362
\.


--
-- TOC entry 3799 (class 0 OID 57464)
-- Dependencies: 239
-- Data for Name: nocodb_config; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.nocodb_config (id, name, base_url, project_id, api_token, description, is_active, created_by, created_at, updated_at) FROM stdin;
1	Nocodb	https://nocodb.ffnancy.fr	pcg4uw79ukvycxc	z4BAwLo6dgoN_E7PKJSHN7PA7kdBePtKOYcsDlwQ		t	1	2025-07-25 16:26:27.006311	2025-07-25 23:08:37.769504
\.


--
-- TOC entry 3803 (class 0 OID 57488)
-- Dependencies: 243
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.orders (id, supplier_id, group_id, planned_date, quantity, unit, status, notes, created_by, created_at, updated_at) FROM stdin;
2	1	4	2025-07-09	\N	\N	pending	\N	1	2025-07-19 20:33:16.159959	2025-07-19 20:33:16.159959
1	1	3	2025-07-02	\N	\N	delivered	\N	1	2025-07-19 18:57:18.713694	2025-07-19 20:33:34.611
3	3	5	2025-07-11	\N	\N	pending	\N	_1753182518439	2025-07-22 12:54:21.143062	2025-07-22 12:54:21.143062
4	3	5	2025-07-09	\N	\N	delivered	\N	_1753182518439	2025-07-22 13:07:38.771467	2025-07-22 13:16:16.924
5	2	4	2025-07-09	\N	\N	pending	\N	1	2025-07-24 09:34:49.335611	2025-07-24 09:34:49.335611
6	3	4	2025-07-09	\N	\N	pending	\N	1	2025-07-24 09:34:55.314888	2025-07-24 09:34:55.314888
7	1	2	2025-07-25	5	palettes	pending	Test commande pour manager groupe 2	test_manager	2025-07-24 10:29:44.602606	2025-07-24 10:29:44.602606
8	1	4	2025-07-10	\N	\N	delivered	\N	1	2025-07-25 12:42:09.377059	2025-07-25 12:42:28.781778
9	1	1	2025-07-09	\N	\N	planned	\N	1	2025-07-27 16:09:15.10213	2025-09-23 09:40:01.371
\.


--
-- TOC entry 3815 (class 0 OID 57581)
-- Dependencies: 255
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.permissions (id, name, display_name, description, category, action, resource, is_system, created_at) FROM stdin;
55	dashboard_read	Voir tableau de bord	Accès en lecture au tableau de bord	tableau_de_bord	read	dashboard	t	2025-08-04 11:37:37.307
56	groups_read	Voir magasins	Accès en lecture aux magasins	magasins	read	groups	t	2025-08-04 11:37:37.333
57	groups_create	Créer magasins	Création de nouveaux magasins	magasins	create	groups	t	2025-08-04 11:37:37.356
58	groups_update	Modifier magasins	Modification des magasins existants	magasins	update	groups	t	2025-08-04 11:37:37.38
59	groups_delete	Supprimer magasins	Suppression de magasins	magasins	delete	groups	t	2025-08-04 11:37:37.403
60	suppliers_read	Voir fournisseurs	Accès en lecture aux fournisseurs	fournisseurs	read	suppliers	t	2025-08-04 11:37:37.427
61	suppliers_create	Créer fournisseurs	Création de nouveaux fournisseurs	fournisseurs	create	suppliers	t	2025-08-04 11:37:37.451
62	suppliers_update	Modifier fournisseurs	Modification des fournisseurs existants	fournisseurs	update	suppliers	t	2025-08-04 11:37:37.473
63	suppliers_delete	Supprimer fournisseurs	Suppression de fournisseurs	fournisseurs	delete	fournisseurs	t	2025-08-04 11:37:37.496
64	orders_read	Voir commandes	Accès en lecture aux commandes	commandes	read	orders	t	2025-08-04 11:37:37.519
65	orders_create	Créer commandes	Création de nouvelles commandes	commandes	create	orders	t	2025-08-04 11:37:37.542
66	orders_update	Modifier commandes	Modification des commandes existantes	commandes	update	orders	t	2025-08-04 11:37:37.565
67	orders_delete	Supprimer commandes	Suppression de commandes	commandes	delete	orders	t	2025-08-04 11:37:37.588
68	deliveries_read	Voir livraisons	Accès en lecture aux livraisons	livraisons	read	deliveries	t	2025-08-04 11:37:37.611
69	deliveries_create	Créer livraisons	Création de nouvelles livraisons	livraisons	create	deliveries	t	2025-08-04 11:37:37.634
70	deliveries_update	Modifier livraisons	Modification des livraisons existantes	livraisons	update	deliveries	t	2025-08-04 11:37:37.657
71	deliveries_delete	Supprimer livraisons	Suppression de livraisons	livraisons	delete	deliveries	t	2025-08-04 11:37:37.68
72	deliveries_validate	Valider livraisons	Validation des livraisons avec BL	livraisons	validate	deliveries	t	2025-08-04 11:37:37.703
73	calendar_read	Voir calendrier	Accès en lecture au calendrier	calendrier	read	calendar	t	2025-08-04 11:37:37.725
74	reconciliation_read	Voir rapprochement	Accès en lecture au rapprochement BL/Factures	rapprochement	read	reconciliation	t	2025-08-04 11:37:37.748
75	reconciliation_update	Modifier rapprochement	Modification des données de rapprochement	rapprochement	update	reconciliation	t	2025-08-04 11:37:37.771
76	publicities_read	Voir publicités	Accès en lecture aux publicités	publicites	read	publicities	t	2025-08-04 11:37:37.794
77	publicities_create	Créer publicités	Création de nouvelles publicités	publicites	create	publicities	t	2025-08-04 11:37:37.817
78	publicities_update	Modifier publicités	Modification des publicités existantes	publicites	update	publicities	t	2025-08-04 11:37:37.84
79	publicities_delete	Supprimer publicités	Suppression de publicités	publicites	delete	publicities	t	2025-08-04 11:37:37.862
80	customer_orders_read	Voir commandes clients	Accès en lecture aux commandes clients	commandes_clients	read	customer_orders	t	2025-08-04 11:37:37.885
81	customer_orders_create	Créer commandes clients	Création de nouvelles commandes clients	commandes_clients	create	customer_orders	t	2025-08-04 11:37:37.907
82	customer_orders_update	Modifier commandes clients	Modification des commandes clients existantes	commandes_clients	update	customer_orders	t	2025-08-04 11:37:37.931
83	customer_orders_delete	Supprimer commandes clients	Suppression de commandes clients	commandes_clients	delete	customer_orders	t	2025-08-04 11:37:37.954
84	customer_orders_print	Imprimer étiquettes	Impression d'étiquettes de commandes clients	commandes_clients	print	customer_orders	t	2025-08-04 11:37:37.975
85	customer_orders_notify	Notifier clients	Envoi de notifications aux clients	commandes_clients	notify	customer_orders	t	2025-08-04 11:37:37.999
86	dlc_read	Voir produits DLC	Accès en lecture aux produits avec date limite de consommation	gestion_dlc	read	dlc	t	2025-08-04 11:37:38.024
87	dlc_create	Créer produits DLC	Création de nouveaux produits DLC	gestion_dlc	create	dlc	t	2025-08-04 11:37:38.047
88	dlc_update	Modifier produits DLC	Modification des produits DLC existants	gestion_dlc	update	dlc	t	2025-08-04 11:37:38.07
89	dlc_delete	Supprimer produits DLC	Suppression de produits DLC	gestion_dlc	delete	dlc	t	2025-08-04 11:37:38.093
90	dlc_validate	Valider produits DLC	Validation et vérification des produits DLC	gestion_dlc	validate	dlc	t	2025-08-04 11:37:38.115
91	dlc_print	Imprimer étiquettes DLC	Impression d'étiquettes pour produits DLC	gestion_dlc	print	dlc	t	2025-08-04 11:37:38.139
92	dlc_stats	Voir statistiques DLC	Accès aux statistiques des produits DLC	gestion_dlc	stats	dlc	t	2025-08-04 11:37:38.16
93	tasks_read	Voir tâches	Accès en lecture aux tâches	gestion_taches	read	tasks	t	2025-08-04 11:37:38.183
94	tasks_create	Créer tâches	Création de nouvelles tâches	gestion_taches	create	tasks	t	2025-08-04 11:37:38.206
95	tasks_update	Modifier tâches	Modification des tâches existantes	gestion_taches	update	tasks	t	2025-08-04 11:37:38.229
96	tasks_delete	Supprimer tâches	Suppression de tâches	gestion_taches	delete	tasks	t	2025-08-04 11:37:38.252
97	tasks_assign	Assigner tâches	Attribution de tâches aux utilisateurs	gestion_taches	assign	tasks	t	2025-08-04 11:37:38.274
98	users_read	Voir utilisateurs	Accès en lecture aux utilisateurs	utilisateurs	read	users	t	2025-08-04 11:37:38.297
99	users_create	Créer utilisateurs	Création de nouveaux utilisateurs	utilisateurs	create	users	t	2025-08-04 11:37:38.32
100	users_update	Modifier utilisateurs	Modification des utilisateurs existants	utilisateurs	update	users	t	2025-08-04 11:37:38.343
101	users_delete	Supprimer utilisateurs	Suppression d'utilisateurs	utilisateurs	delete	users	t	2025-08-04 11:37:38.366
102	roles_read	Voir rôles	Accès en lecture aux rôles	gestion_roles	read	roles	t	2025-08-04 11:37:38.388
103	roles_create	Créer rôles	Création de nouveaux rôles	gestion_roles	create	roles	t	2025-08-04 11:37:38.411
104	roles_update	Modifier rôles	Modification des rôles existants	gestion_roles	update	roles	t	2025-08-04 11:37:38.434
105	roles_delete	Supprimer rôles	Suppression de rôles	gestion_roles	delete	roles	t	2025-08-04 11:37:38.457
106	roles_assign	Assigner rôles	Attribution de rôles aux utilisateurs	gestion_roles	assign	roles	t	2025-08-04 11:37:38.481
107	system_admin	Administration système	Accès complet à l'administration du système	administration	admin	system	t	2025-08-04 11:37:38.503
108	nocodb_config	Configuration NocoDB	Gestion de la configuration NocoDB	administration	config	nocodb	t	2025-08-04 11:37:38.528
\.


--
-- TOC entry 3805 (class 0 OID 57513)
-- Dependencies: 245
-- Data for Name: publicities; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.publicities (id, pub_number, designation, title, description, start_date, end_date, year, created_by, created_at, updated_at) FROM stdin;
3	TEST-PROD	Test Production	\N	\N	2025-07-22	2025-07-28	2025	1	2025-07-19 22:38:52.143069	2025-07-19 22:38:52.143069
4	TEST-FORCE-PROD	Test Force Production	\N	\N	2025-07-23	2025-07-29	2025	1	2025-07-19 22:39:13.937601	2025-07-19 22:39:13.937601
5	TEST-ERROR	Test Error	\N	\N	2025-07-24	2025-07-30	2025	1	2025-07-19 22:54:05.573607	2025-07-19 22:54:05.573607
6	2501	wxcvwxc	\N	\N	2025-07-01	2025-07-06	2025	1	2025-07-19 22:55:06.907432	2025-07-19 22:55:06.907432
9	FINAL-TEST	Test Final Production	\N	\N	2025-07-27	2025-08-02	2025	1	2025-07-19 23:03:21.499342	2025-07-19 23:03:21.499342
8	DIAG-PROD	Diagnostic Production	\N	\N	2025-07-26	2025-08-01	2025	1	2025-07-19 22:58:31.680917	2025-07-20 09:09:26.486
2	TEST123	Test	\N	\N	2025-07-20	2025-07-25	2025	1	2025-07-19 22:38:10.039397	2025-07-20 09:13:42.375
10	2508	qsd	\N	\N	2025-07-28	2025-08-03	2025	1	2025-07-22 15:37:06.687956	2025-07-22 15:37:06.687956
\.


--
-- TOC entry 3817 (class 0 OID 57615)
-- Dependencies: 257
-- Data for Name: publicity_participations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.publicity_participations (publicity_id, group_id) FROM stdin;
1	5
3	4
4	4
5	4
6	5
9	5
2	4
2	5
10	5
\.


--
-- TOC entry 3838 (class 0 OID 2375681)
-- Dependencies: 278
-- Data for Name: reconciliation_comments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.reconciliation_comments (id, content, type, delivery_id, author_id, group_id, created_at, updated_at) FROM stdin;
1	Test commentaire pour vérifier la mise à jour de l'icône	info	126	admin_local	1	2025-09-23 13:53:06.976071	2025-09-23 13:53:06.976071
\.


--
-- TOC entry 3816 (class 0 OID 57609)
-- Dependencies: 256
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.role_permissions (role_id, permission_id, created_at) FROM stdin;
8	55	2025-08-04 11:37:38.575
8	56	2025-08-04 11:37:38.575
8	57	2025-08-04 11:37:38.575
8	58	2025-08-04 11:37:38.575
8	59	2025-08-04 11:37:38.575
8	60	2025-08-04 11:37:38.575
8	61	2025-08-04 11:37:38.575
8	62	2025-08-04 11:37:38.575
8	63	2025-08-04 11:37:38.575
8	64	2025-08-04 11:37:38.575
8	65	2025-08-04 11:37:38.575
8	66	2025-08-04 11:37:38.575
8	67	2025-08-04 11:37:38.575
8	68	2025-08-04 11:37:38.575
8	69	2025-08-04 11:37:38.575
8	70	2025-08-04 11:37:38.575
8	71	2025-08-04 11:37:38.575
8	72	2025-08-04 11:37:38.575
8	73	2025-08-04 11:37:38.575
8	74	2025-08-04 11:37:38.575
8	75	2025-08-04 11:37:38.575
8	76	2025-08-04 11:37:38.575
8	77	2025-08-04 11:37:38.575
8	78	2025-08-04 11:37:38.575
8	79	2025-08-04 11:37:38.575
8	80	2025-08-04 11:37:38.575
8	81	2025-08-04 11:37:38.575
8	82	2025-08-04 11:37:38.575
8	83	2025-08-04 11:37:38.575
8	84	2025-08-04 11:37:38.575
8	85	2025-08-04 11:37:38.575
8	86	2025-08-04 11:37:38.575
8	87	2025-08-04 11:37:38.575
8	88	2025-08-04 11:37:38.575
8	89	2025-08-04 11:37:38.575
8	90	2025-08-04 11:37:38.575
8	91	2025-08-04 11:37:38.575
8	92	2025-08-04 11:37:38.575
8	93	2025-08-04 11:37:38.575
8	94	2025-08-04 11:37:38.575
8	95	2025-08-04 11:37:38.575
8	96	2025-08-04 11:37:38.575
8	97	2025-08-04 11:37:38.575
8	98	2025-08-04 11:37:38.575
8	99	2025-08-04 11:37:38.575
8	100	2025-08-04 11:37:38.575
8	101	2025-08-04 11:37:38.575
8	102	2025-08-04 11:37:38.575
8	103	2025-08-04 11:37:38.575
8	104	2025-08-04 11:37:38.575
8	105	2025-08-04 11:37:38.575
8	106	2025-08-04 11:37:38.575
8	107	2025-08-04 11:37:38.575
8	108	2025-08-04 11:37:38.575
9	55	2025-08-04 11:37:38.624
9	56	2025-08-04 11:37:38.624
9	57	2025-08-04 11:37:38.624
9	58	2025-08-04 11:37:38.624
9	59	2025-08-04 11:37:38.624
9	60	2025-08-04 11:37:38.624
9	61	2025-08-04 11:37:38.624
9	62	2025-08-04 11:37:38.624
9	63	2025-08-04 11:37:38.624
9	64	2025-08-04 11:37:38.624
9	65	2025-08-04 11:37:38.624
9	66	2025-08-04 11:37:38.624
9	67	2025-08-04 11:37:38.624
9	68	2025-08-04 11:37:38.624
9	69	2025-08-04 11:37:38.624
9	70	2025-08-04 11:37:38.624
9	71	2025-08-04 11:37:38.624
9	72	2025-08-04 11:37:38.624
9	73	2025-08-04 11:37:38.624
9	74	2025-08-04 11:37:38.624
9	75	2025-08-04 11:37:38.624
9	76	2025-08-04 11:37:38.624
9	77	2025-08-04 11:37:38.624
9	78	2025-08-04 11:37:38.624
9	79	2025-08-04 11:37:38.624
9	80	2025-08-04 11:37:38.624
9	81	2025-08-04 11:37:38.624
9	82	2025-08-04 11:37:38.624
9	83	2025-08-04 11:37:38.624
9	84	2025-08-04 11:37:38.624
9	85	2025-08-04 11:37:38.624
9	86	2025-08-04 11:37:38.624
9	87	2025-08-04 11:37:38.624
9	88	2025-08-04 11:37:38.624
9	89	2025-08-04 11:37:38.624
9	90	2025-08-04 11:37:38.624
9	91	2025-08-04 11:37:38.624
9	92	2025-08-04 11:37:38.624
9	93	2025-08-04 11:37:38.624
9	94	2025-08-04 11:37:38.624
9	95	2025-08-04 11:37:38.624
9	96	2025-08-04 11:37:38.624
9	97	2025-08-04 11:37:38.624
9	98	2025-08-04 11:37:38.624
9	99	2025-08-04 11:37:38.624
9	100	2025-08-04 11:37:38.624
9	108	2025-08-04 11:37:38.624
10	55	2025-08-04 11:37:38.671
10	56	2025-08-04 11:37:38.671
10	60	2025-08-04 11:37:38.671
10	64	2025-08-04 11:37:38.671
10	68	2025-08-04 11:37:38.671
10	69	2025-08-04 11:37:38.671
10	70	2025-08-04 11:37:38.671
10	73	2025-08-04 11:37:38.671
10	74	2025-08-04 11:37:38.671
10	76	2025-08-04 11:37:38.671
10	80	2025-08-04 11:37:38.671
10	81	2025-08-04 11:37:38.671
10	82	2025-08-04 11:37:38.671
10	83	2025-08-04 11:37:38.671
10	84	2025-08-04 11:37:38.671
10	85	2025-08-04 11:37:38.671
10	86	2025-08-04 11:37:38.671
10	87	2025-08-04 11:37:38.671
10	88	2025-08-04 11:37:38.671
10	93	2025-08-04 11:37:38.671
10	98	2025-08-04 11:37:38.671
10	102	2025-08-04 11:37:38.671
11	55	2025-08-04 11:37:38.717
11	56	2025-08-04 11:37:38.717
11	57	2025-08-04 11:37:38.717
11	58	2025-08-04 11:37:38.717
11	59	2025-08-04 11:37:38.717
11	60	2025-08-04 11:37:38.717
11	61	2025-08-04 11:37:38.717
11	62	2025-08-04 11:37:38.717
11	63	2025-08-04 11:37:38.717
11	64	2025-08-04 11:37:38.717
11	65	2025-08-04 11:37:38.717
11	66	2025-08-04 11:37:38.717
11	67	2025-08-04 11:37:38.717
11	68	2025-08-04 11:37:38.717
11	69	2025-08-04 11:37:38.717
11	70	2025-08-04 11:37:38.717
11	71	2025-08-04 11:37:38.717
11	72	2025-08-04 11:37:38.717
11	73	2025-08-04 11:37:38.717
11	74	2025-08-04 11:37:38.717
11	75	2025-08-04 11:37:38.717
11	76	2025-08-04 11:37:38.717
11	77	2025-08-04 11:37:38.717
11	78	2025-08-04 11:37:38.717
11	79	2025-08-04 11:37:38.717
11	80	2025-08-04 11:37:38.717
11	81	2025-08-04 11:37:38.717
11	82	2025-08-04 11:37:38.717
11	83	2025-08-04 11:37:38.717
11	84	2025-08-04 11:37:38.717
11	85	2025-08-04 11:37:38.717
11	86	2025-08-04 11:37:38.717
11	87	2025-08-04 11:37:38.717
11	88	2025-08-04 11:37:38.717
11	89	2025-08-04 11:37:38.717
11	90	2025-08-04 11:37:38.717
11	91	2025-08-04 11:37:38.717
11	92	2025-08-04 11:37:38.717
11	93	2025-08-04 11:37:38.717
11	94	2025-08-04 11:37:38.717
11	95	2025-08-04 11:37:38.717
11	96	2025-08-04 11:37:38.717
11	97	2025-08-04 11:37:38.717
11	107	2025-08-04 11:37:38.717
11	108	2025-08-04 11:37:38.717
\.


--
-- TOC entry 3813 (class 0 OID 57565)
-- Dependencies: 253
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.roles (id, name, display_name, description, color, is_system, is_active, created_at, updated_at) FROM stdin;
8	admin	Administrateur	Accès complet à toutes les fonctionnalités du système	#dc2626	t	t	2025-08-04 11:37:37.199	2025-08-04 11:37:37.199
9	manager	Manager	Accès à la gestion des commandes, livraisons et fournisseurs	#2563eb	t	t	2025-08-04 11:37:37.23	2025-08-04 11:37:37.23
10	employee	Employé	Accès en lecture aux données et publicités	#16a34a	t	t	2025-08-04 11:37:37.253	2025-08-04 11:37:37.253
11	directeur	Directeur	Supervision générale et gestion stratégique	#7c3aed	t	t	2025-08-04 11:37:37.276	2025-08-04 11:37:37.276
\.


--
-- TOC entry 3790 (class 0 OID 24692)
-- Dependencies: 230
-- Data for Name: sav_tickets; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.sav_tickets (id, ticket_number, customer_id, store_id, user_id, assigned_user_id, title, description, status, priority, category, resolution, created_at, updated_at) FROM stdin;
1	SAV-2025-001	1	1	1	\N	Produit défaillant	Le client signale un défaut sur son achat de la semaine dernière	open	high	warranty	\N	2025-07-10 10:29:11.446002	2025-07-10 10:29:11.446002
2	SAV-2025-002	2	1	1	\N	Demande d'échange	Le client souhaite échanger un article contre un autre modèle	in_progress	normal	exchange	\N	2025-07-10 10:29:11.446002	2025-07-10 10:29:11.446002
3	SAV-2025-003	3	1	1	\N	Retour produit	Retour sous garantie pour remboursement	open	normal	return	\N	2025-07-10 10:29:11.446002	2025-07-10 10:29:11.446002
7	SAV-2025-004	4	1	1	2	Garantie parasol	Mécanisme d'ouverture cassé après 3 mois. Sous garantie.	resolved	normal	warranty	\N	2025-07-10 10:43:42.222233	2025-07-10 10:43:42.222233
8	SAV-2025-005	5	2	3	3	Pièce manquante	Vis de fixation manquantes dans le colis mobilier bureau.	open	low	complaint	\N	2025-07-10 10:43:42.222233	2025-07-10 10:43:42.222233
\.


--
-- TOC entry 3793 (class 0 OID 32770)
-- Dependencies: 233
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.session (sid, sess, expire) FROM stdin;
0k6-w_422nQogy421QfoxBvyDXIgMWm4	{"cookie":{"originalMaxAge":86400000,"expires":"2025-08-06T12:49:02.236Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"1"}}	2025-08-07 08:20:55
\.


--
-- TOC entry 3794 (class 0 OID 57427)
-- Dependencies: 234
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.sessions (sid, sess, expire) FROM stdin;
\.


--
-- TOC entry 3792 (class 0 OID 24707)
-- Dependencies: 232
-- Data for Name: stores; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.stores (id, name, address, phone, email, is_active, created_at, updated_at) FROM stdin;
1	La Foir'Fouille Paris	123 Avenue des Champs-Élysées, Paris	01 42 12 34 56	paris@lafoirfouille.com	t	2025-07-10 10:28:59.788159	2025-07-10 10:28:59.788159
2	La Foir'Fouille Centre-Ville	123 Rue de la Paix, 75001 Paris	01.23.45.67.89	centre-ville@lafoir.com	t	2025-07-10 10:42:33.03728	2025-07-10 10:42:33.03728
3	La Foir'Fouille Banlieue	456 Avenue des Champs, 92000 Nanterre	01.98.76.54.32	banlieue@lafoir.com	t	2025-07-10 10:42:33.03728	2025-07-10 10:42:33.03728
4	La Foir'Fouille Nord	789 Boulevard du Nord, 59000 Lille	01.11.22.33.44	nord@lafoir.com	t	2025-07-10 10:42:33.03728	2025-07-10 10:42:33.03728
5	Frouard				t	2025-07-10 11:47:14.665546	2025-07-10 11:47:14.665546
\.


--
-- TOC entry 3801 (class 0 OID 57476)
-- Dependencies: 241
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.suppliers (id, name, contact, phone, has_dlc, created_at, updated_at, automatic_reconciliation) FROM stdin;
2	Fournisseur Test 2	Marie Martin	01 98 76 54 32	f	2025-07-19 18:54:37.690583	2025-07-19 18:54:37.690583	f
1	Fournisseur Test 1	Jean Dupont	01 23 45 67 89	t	2025-07-19 18:54:37.690583	2025-07-19 22:12:13.102179	f
4	Lidis			f	2025-07-25 18:33:20.170431	2025-07-25 18:33:20.170431	f
5	JJA Five	Contact JJA Five	01 23 45 67 89	f	2025-07-30 12:59:08.997043	2025-07-30 12:59:08.997043	f
3	Tendance	Pierre Dubois	06 12 34 56 78	t	2025-07-20 10:26:02.261353	2025-07-30 16:15:02.260442	f
\.


--
-- TOC entry 3811 (class 0 OID 57552)
-- Dependencies: 251
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.tasks (id, title, description, assigned_to, due_date, priority, status, store_id, created_at, updated_at, created_by, group_id, start_date, completed_at, completed_by) FROM stdin;
12	qsdf	dsfq	qsdf	2025-07-19	medium	completed	\N	2025-07-19 23:35:06.345706	2025-07-23 11:59:19.105207	1	4	\N	\N	\N
11	qsdqsd	qsdqsd		2025-07-19	medium	completed	\N	2025-07-19 23:25:13.912904	2025-07-23 11:59:20.485895	1	4	\N	\N	\N
10	qsdqsd	qsdqsd		2025-07-19	medium	completed	\N	2025-07-19 23:25:09.829013	2025-07-23 11:59:21.02293	1	4	\N	\N	\N
9	qsdqsd	qsdq		2025-07-19	medium	completed	\N	2025-07-19 23:25:05.921267	2025-07-23 11:59:21.755752	1	4	\N	\N	\N
14	qdfqs	dfqsdf		2025-07-19	medium	completed	\N	2025-07-19 23:35:15.309994	2025-07-23 11:59:14.912705	1	4	\N	\N	\N
23	dghjf	sghff	dfgh	\N	medium	completed	\N	2025-07-23 11:53:51.842772	2025-07-23 11:59:15.15445	1	4	\N	\N	\N
6	qqsdq	sqd	qsdqs	2025-07-19	medium	completed	\N	2025-07-19 23:24:38.618689	2025-07-23 11:59:22.369856	1	4	\N	\N	\N
5	qsdqs	sqdqsd	qsd	2025-07-19	medium	completed	\N	2025-07-19 23:24:32.108861	2025-07-23 11:59:22.963454	1	4	\N	\N	\N
13	qsdfsq	dsqdf	qsdfq	2025-07-19	medium	completed	\N	2025-07-19 23:35:10.818222	2025-07-23 11:59:16.505726	1	4	\N	\N	\N
3	wdsfvs	dffdsf	sdf	2025-07-19	medium	completed	\N	2025-07-19 22:54:05.102086	2025-07-23 11:59:26.761255	1	4	\N	\N	\N
24	sdqf	qsdf	qsdf	\N	medium	pending	\N	2025-07-23 11:59:35.323732	2025-07-23 11:59:35.323732	1	4	2025-07-25 00:00:00	\N	\N
25	aezrhgsq	qsdf	azerze	2025-07-24	medium	pending	\N	2025-07-23 12:00:20.040255	2025-07-23 12:00:29.95404	1	4	2025-07-23 00:00:00	\N	\N
26	erfggf	qsdf	qsdf	2025-07-31	medium	pending	\N	2025-07-23 12:03:22.50558	2025-07-23 12:03:22.50558	1	4	2025-07-27 00:00:00	\N	\N
27	DB Task 0		\N	\N	medium	pending	\N	2025-09-11 09:49:27.040745	2025-09-11 09:49:27.040745	admin	1	\N	\N	\N
28	DB Task 1		\N	\N	medium	pending	\N	2025-09-11 09:49:27.040745	2025-09-11 09:49:27.040745	admin	1	\N	\N	\N
29	DB Task 2		\N	\N	medium	pending	\N	2025-09-11 09:49:27.040745	2025-09-11 09:49:27.040745	admin	1	\N	\N	\N
30	DB Task 3		\N	\N	medium	pending	\N	2025-09-11 09:49:27.040745	2025-09-11 09:49:27.040745	admin	1	\N	\N	\N
31	DB Task 4		\N	\N	medium	pending	\N	2025-09-11 09:49:27.040745	2025-09-11 09:49:27.040745	admin	1	\N	\N	\N
32	DB Task 5		\N	\N	medium	pending	\N	2025-09-11 09:49:27.040745	2025-09-11 09:49:27.040745	admin	1	\N	\N	\N
33	DB Task 6		\N	\N	medium	pending	\N	2025-09-11 09:49:27.040745	2025-09-11 09:49:27.040745	admin	1	\N	\N	\N
34	DB Task 7		\N	\N	medium	pending	\N	2025-09-11 09:49:27.040745	2025-09-11 09:49:27.040745	admin	1	\N	\N	\N
35	DB Task 8		\N	\N	medium	pending	\N	2025-09-11 09:49:27.040745	2025-09-11 09:49:27.040745	admin	1	\N	\N	\N
36	DB Task 9		\N	\N	medium	pending	\N	2025-09-11 09:49:27.040745	2025-09-11 09:49:27.040745	admin	1	\N	\N	\N
37	DB Task 0		\N	\N	medium	pending	\N	2025-09-11 09:50:18.16913	2025-09-11 09:50:18.16913	admin	1	\N	\N	\N
38	DB Task 1		\N	\N	medium	pending	\N	2025-09-11 09:50:18.16913	2025-09-11 09:50:18.16913	admin	1	\N	\N	\N
39	DB Task 2		\N	\N	medium	pending	\N	2025-09-11 09:50:18.16913	2025-09-11 09:50:18.16913	admin	1	\N	\N	\N
40	DB Task 3		\N	\N	medium	pending	\N	2025-09-11 09:50:18.16913	2025-09-11 09:50:18.16913	admin	1	\N	\N	\N
41	DB Task 4		\N	\N	medium	pending	\N	2025-09-11 09:50:18.16913	2025-09-11 09:50:18.16913	admin	1	\N	\N	\N
42	DB Task 5		\N	\N	medium	pending	\N	2025-09-11 09:50:18.16913	2025-09-11 09:50:18.16913	admin	1	\N	\N	\N
43	DB Task 6		\N	\N	medium	pending	\N	2025-09-11 09:50:18.16913	2025-09-11 09:50:18.16913	admin	1	\N	\N	\N
44	DB Task 7		\N	\N	medium	pending	\N	2025-09-11 09:50:18.16913	2025-09-11 09:50:18.16913	admin	1	\N	\N	\N
45	DB Task 8		\N	\N	medium	pending	\N	2025-09-11 09:50:18.16913	2025-09-11 09:50:18.16913	admin	1	\N	\N	\N
46	DB Task 9		\N	\N	medium	pending	\N	2025-09-11 09:50:18.16913	2025-09-11 09:50:18.16913	admin	1	\N	\N	\N
47	DB Task 10		\N	\N	medium	pending	\N	2025-09-11 09:50:18.16913	2025-09-11 09:50:18.16913	admin	1	\N	\N	\N
48	DB Task 11		\N	\N	medium	pending	\N	2025-09-11 09:50:18.16913	2025-09-11 09:50:18.16913	admin	1	\N	\N	\N
49	DB Task 12		\N	\N	medium	pending	\N	2025-09-11 09:50:18.16913	2025-09-11 09:50:18.16913	admin	1	\N	\N	\N
50	DB Task 13		\N	\N	medium	pending	\N	2025-09-11 09:50:18.16913	2025-09-11 09:50:18.16913	admin	1	\N	\N	\N
51	DB Task 14		\N	\N	medium	pending	\N	2025-09-11 09:50:18.16913	2025-09-11 09:50:18.16913	admin	1	\N	\N	\N
52	DB Task 0		\N	\N	medium	pending	\N	2025-09-11 09:52:12.380896	2025-09-11 09:52:12.380896	admin	1	\N	\N	\N
53	DB Task 1		\N	\N	medium	pending	\N	2025-09-11 09:52:12.380896	2025-09-11 09:52:12.380896	admin	1	\N	\N	\N
54	DB Task 2		\N	\N	medium	pending	\N	2025-09-11 09:52:12.380896	2025-09-11 09:52:12.380896	admin	1	\N	\N	\N
55	DB Task 3		\N	\N	medium	pending	\N	2025-09-11 09:52:12.380896	2025-09-11 09:52:12.380896	admin	1	\N	\N	\N
56	DB Task 4		\N	\N	medium	pending	\N	2025-09-11 09:52:12.380896	2025-09-11 09:52:12.380896	admin	1	\N	\N	\N
57	DB Task 5		\N	\N	medium	pending	\N	2025-09-11 09:52:12.380896	2025-09-11 09:52:12.380896	admin	1	\N	\N	\N
58	DB Task 6		\N	\N	medium	pending	\N	2025-09-11 09:52:12.380896	2025-09-11 09:52:12.380896	admin	1	\N	\N	\N
59	DB Task 7		\N	\N	medium	pending	\N	2025-09-11 09:52:12.380896	2025-09-11 09:52:12.380896	admin	1	\N	\N	\N
60	DB Task 8		\N	\N	medium	pending	\N	2025-09-11 09:52:12.380896	2025-09-11 09:52:12.380896	admin	1	\N	\N	\N
61	DB Task 9		\N	\N	medium	pending	\N	2025-09-11 09:52:12.380896	2025-09-11 09:52:12.380896	admin	1	\N	\N	\N
62	DB Task 10		\N	\N	medium	pending	\N	2025-09-11 09:52:12.380896	2025-09-11 09:52:12.380896	admin	1	\N	\N	\N
63	DB Task 11		\N	\N	medium	pending	\N	2025-09-11 09:52:12.380896	2025-09-11 09:52:12.380896	admin	1	\N	\N	\N
64	DB Task 12		\N	\N	medium	pending	\N	2025-09-11 09:52:12.380896	2025-09-11 09:52:12.380896	admin	1	\N	\N	\N
65	DB Task 13		\N	\N	medium	pending	\N	2025-09-11 09:52:12.380896	2025-09-11 09:52:12.380896	admin	1	\N	\N	\N
66	DB Task 14		\N	\N	medium	pending	\N	2025-09-11 09:52:12.380896	2025-09-11 09:52:12.380896	admin	1	\N	\N	\N
67	DB Task 0		\N	\N	medium	pending	\N	2025-09-11 09:53:15.657202	2025-09-11 09:53:15.657202	admin	1	\N	\N	\N
68	DB Task 1		\N	\N	medium	pending	\N	2025-09-11 09:53:15.657202	2025-09-11 09:53:15.657202	admin	1	\N	\N	\N
69	DB Task 2		\N	\N	medium	pending	\N	2025-09-11 09:53:15.657202	2025-09-11 09:53:15.657202	admin	1	\N	\N	\N
70	DB Task 3		\N	\N	medium	pending	\N	2025-09-11 09:53:15.657202	2025-09-11 09:53:15.657202	admin	1	\N	\N	\N
71	DB Task 4		\N	\N	medium	pending	\N	2025-09-11 09:53:15.657202	2025-09-11 09:53:15.657202	admin	1	\N	\N	\N
72	DB Task 5		\N	\N	medium	pending	\N	2025-09-11 09:53:15.657202	2025-09-11 09:53:15.657202	admin	1	\N	\N	\N
73	DB Task 6		\N	\N	medium	pending	\N	2025-09-11 09:53:15.657202	2025-09-11 09:53:15.657202	admin	1	\N	\N	\N
74	DB Task 7		\N	\N	medium	pending	\N	2025-09-11 09:53:15.657202	2025-09-11 09:53:15.657202	admin	1	\N	\N	\N
75	DB Task 8		\N	\N	medium	pending	\N	2025-09-11 09:53:15.657202	2025-09-11 09:53:15.657202	admin	1	\N	\N	\N
76	DB Task 9		\N	\N	medium	pending	\N	2025-09-11 09:53:15.657202	2025-09-11 09:53:15.657202	admin	1	\N	\N	\N
77	DB Task 10		\N	\N	medium	pending	\N	2025-09-11 09:53:15.657202	2025-09-11 09:53:15.657202	admin	1	\N	\N	\N
78	DB Task 11		\N	\N	medium	pending	\N	2025-09-11 09:53:15.657202	2025-09-11 09:53:15.657202	admin	1	\N	\N	\N
79	DB Task 12		\N	\N	medium	pending	\N	2025-09-11 09:53:15.657202	2025-09-11 09:53:15.657202	admin	1	\N	\N	\N
80	DB Task 13		\N	\N	medium	pending	\N	2025-09-11 09:53:15.657202	2025-09-11 09:53:15.657202	admin	1	\N	\N	\N
81	DB Task 14		\N	\N	medium	pending	\N	2025-09-11 09:53:15.657202	2025-09-11 09:53:15.657202	admin	1	\N	\N	\N
82	DB Task 0		\N	\N	medium	pending	\N	2025-09-11 10:00:06.295601	2025-09-11 10:00:06.295601	admin	1	\N	\N	\N
83	DB Task 1		\N	\N	medium	pending	\N	2025-09-11 10:00:06.295601	2025-09-11 10:00:06.295601	admin	1	\N	\N	\N
84	DB Task 2		\N	\N	medium	pending	\N	2025-09-11 10:00:06.295601	2025-09-11 10:00:06.295601	admin	1	\N	\N	\N
85	DB Task 3		\N	\N	medium	pending	\N	2025-09-11 10:00:06.295601	2025-09-11 10:00:06.295601	admin	1	\N	\N	\N
86	DB Task 4		\N	\N	medium	pending	\N	2025-09-11 10:00:06.295601	2025-09-11 10:00:06.295601	admin	1	\N	\N	\N
87	DB Task 5		\N	\N	medium	pending	\N	2025-09-11 10:00:06.295601	2025-09-11 10:00:06.295601	admin	1	\N	\N	\N
88	DB Task 6		\N	\N	medium	pending	\N	2025-09-11 10:00:06.295601	2025-09-11 10:00:06.295601	admin	1	\N	\N	\N
89	DB Task 7		\N	\N	medium	pending	\N	2025-09-11 10:00:06.295601	2025-09-11 10:00:06.295601	admin	1	\N	\N	\N
90	DB Task 8		\N	\N	medium	pending	\N	2025-09-11 10:00:06.295601	2025-09-11 10:00:06.295601	admin	1	\N	\N	\N
91	DB Task 9		\N	\N	medium	pending	\N	2025-09-11 10:00:06.295601	2025-09-11 10:00:06.295601	admin	1	\N	\N	\N
92	DB Task 10		\N	\N	medium	pending	\N	2025-09-11 10:00:06.295601	2025-09-11 10:00:06.295601	admin	1	\N	\N	\N
93	DB Task 11		\N	\N	medium	pending	\N	2025-09-11 10:00:06.295601	2025-09-11 10:00:06.295601	admin	1	\N	\N	\N
94	DB Task 12		\N	\N	medium	pending	\N	2025-09-11 10:00:06.295601	2025-09-11 10:00:06.295601	admin	1	\N	\N	\N
95	DB Task 13		\N	\N	medium	pending	\N	2025-09-11 10:00:06.295601	2025-09-11 10:00:06.295601	admin	1	\N	\N	\N
96	DB Task 14		\N	\N	medium	pending	\N	2025-09-11 10:00:06.295601	2025-09-11 10:00:06.295601	admin	1	\N	\N	\N
\.


--
-- TOC entry 3821 (class 0 OID 720923)
-- Dependencies: 261
-- Data for Name: user_groups; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.user_groups (user_id, group_id, assigned_by, assigned_at) FROM stdin;
directeur_demo	5	admin	2025-07-22 10:38:26.071783
_1753182518439	5	admin	2025-07-22 11:48:05.588735
ff292_employee	1	\N	2025-07-22 10:04:06.926158
manager_demo	1	admin	2025-07-22 10:38:26.071783
directeur_demo	1	admin	2025-07-22 10:38:26.071783
_1753185587842	1	\N	2025-07-22 11:59:52.30638
\.


--
-- TOC entry 3820 (class 0 OID 720910)
-- Dependencies: 260
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.user_roles (user_id, role_id, assigned_by, assigned_at) FROM stdin;
\.


--
-- TOC entry 3795 (class 0 OID 57435)
-- Dependencies: 235
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, username, email, name, first_name, last_name, profile_image_url, password, role, password_changed, created_at, updated_at) FROM stdin;
_1753185587842	707		 			\N	b0729bf3b2fb29e4506a46838d550d59ba3a65b0b7cd59c8e4a4fc61bfe645553494d142e82cebf7a517d3831e610e411a870b357b99f1acb6618465072ae5a3.51fe85612561e5b6e43fb2293758e686	directeur	f	2025-07-22 11:59:50.778	2025-07-22 11:59:50.778
system	system	system@logiflow.com	Utilisateur Système	Système		\N	\N	admin	t	2025-07-25 19:27:13.379808	2025-07-25 19:27:13.379808
manager_demo	manager	manager@logiflow.fr	Jean Manager	Jean	Manager	\N	$2b$10$K1BL9HqNqFp2/Xb1QgXzDe8XQBOKcNKJ8vDbKcBbCJpWlGsQp3X3W	manager	f	2025-07-22 10:38:26.043656	2025-07-22 10:38:26.043656
ff292_employee	ff292	ff292@logiflow.com	Employee Frouard	Employee	Frouard	\N	$2b$10$K1BL9HqNqFp2/Xb1QgXzDe8XQBOKcNKJ8vDbKcBbCJpWlGsQp3X3W	employee	t	2025-07-22 09:18:48.919512	2025-07-22 09:30:26.116
_1753182518439	Nicolas	nicolas@logiflow.fr	Nicolas Directeur	Nicolas	Directeur	\N	$2b$10$K1BL9HqNqFp2/Xb1QgXzDe8XQBOKcNKJ8vDbKcBbCJpWlGsQp3X3W	directeur	t	2025-07-22 11:49:44.596384	2025-07-22 12:07:05.346
directeur_demo	directeur	directeur@logiflow.fr	Pierre Directeur	Pierre	Directeur	\N	710984331d05d1edeede5de8117f72ee74dcf0450a97ec5f945323a65268849807d0d4e4256192ac8da3f101fb1f54fd7780c91639d946ac1ff4071c0b6592ab.138cf15d1b1d88f6148f180864cb2f51	directeur	t	2025-07-22 10:38:26.043656	2025-07-22 12:06:07.324
admin_local	admin	admin@logiflow.com	\N	Administrateur	Système	\N	724b51c8c2cfe888c9881bd7b70eb6467c6f719ac0ef698493718095c21db94ac737773e1fd830ead26bcb12e33f613d08feefc7dd7e5f7b82e5d74f51f0e057.c139b9fafa8a156f5049a06b53c4e4ee	admin	f	2025-09-22 14:57:03.467386	2025-09-22 14:57:03.467386
testuser_BIMceo_1758715619295	testuser_BIMceo	testuser_BIMceo@example.com	\N			\N	3c5ba6fd077c95cacf98fd059d34d77abed6c0cbc88d532846c008dfc5ec8993051d789bd5520e0859b7cd07552c3eaee7382debce807a53cd2b81094ec84427.bc228a30740a383fa1fedb6ab327323d	employee	f	2025-09-24 12:06:59.64231	2025-09-24 12:06:59.64231
\.


--
-- TOC entry 3840 (class 0 OID 2383873)
-- Dependencies: 280
-- Data for Name: weather_settings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.weather_settings (id, api_key, default_city, units, update_interval, is_active, created_at, updated_at, location) FROM stdin;
1	6PSHYLBJB9EEYNZ7NDQ5BPGBZ	Paris	metric	30	t	2025-09-15 08:40:40.083931	2025-09-15 08:40:40.083931	Nancy, France
\.


--
-- TOC entry 3834 (class 0 OID 2359334)
-- Dependencies: 274
-- Data for Name: webhook_bap_config; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.webhook_bap_config (id, name, webhook_url, description, is_active, created_at, updated_at) FROM stdin;
1	Configuration BAP	https://workflow.ffnancy.fr/webhook-test/a3d03176-b72f-412d-8fb9-f920b9fbab4d	Configuration par défaut pour l'envoi des fichiers BAP vers n8n	t	2025-09-03 13:47:28.881763	2025-09-03 13:47:28.881763
\.


--
-- TOC entry 3884 (class 0 OID 0)
-- Dependencies: 271
-- Name: announcements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.announcements_id_seq', 1, false);


--
-- TOC entry 3885 (class 0 OID 0)
-- Dependencies: 275
-- Name: avoirs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.avoirs_id_seq', 1, false);


--
-- TOC entry 3886 (class 0 OID 0)
-- Dependencies: 215
-- Name: calendar_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.calendar_events_id_seq', 6, true);


--
-- TOC entry 3887 (class 0 OID 0)
-- Dependencies: 217
-- Name: client_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.client_orders_id_seq', 5, true);


--
-- TOC entry 3888 (class 0 OID 0)
-- Dependencies: 219
-- Name: command_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.command_items_id_seq', 14, true);


--
-- TOC entry 3889 (class 0 OID 0)
-- Dependencies: 221
-- Name: commands_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.commands_id_seq', 8, true);


--
-- TOC entry 3890 (class 0 OID 0)
-- Dependencies: 246
-- Name: customer_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.customer_orders_id_seq', 2, true);


--
-- TOC entry 3891 (class 0 OID 0)
-- Dependencies: 223
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.customers_id_seq', 8, true);


--
-- TOC entry 3892 (class 0 OID 0)
-- Dependencies: 267
-- Name: dashboard_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.dashboard_messages_id_seq', 2, true);


--
-- TOC entry 3893 (class 0 OID 0)
-- Dependencies: 258
-- Name: deliveries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.deliveries_id_seq', 134, true);


--
-- TOC entry 3894 (class 0 OID 0)
-- Dependencies: 225
-- Name: delivery_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.delivery_items_id_seq', 1, false);


--
-- TOC entry 3895 (class 0 OID 0)
-- Dependencies: 248
-- Name: dlc_products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.dlc_products_id_seq', 26, true);


--
-- TOC entry 3896 (class 0 OID 0)
-- Dependencies: 236
-- Name: groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.groups_id_seq', 5, true);


--
-- TOC entry 3897 (class 0 OID 0)
-- Dependencies: 265
-- Name: invoice_verification_cache_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.invoice_verification_cache_id_seq', 29, true);


--
-- TOC entry 3898 (class 0 OID 0)
-- Dependencies: 263
-- Name: invoice_verifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.invoice_verifications_id_seq', 15, true);


--
-- TOC entry 3899 (class 0 OID 0)
-- Dependencies: 227
-- Name: invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.invoices_id_seq', 1, false);


--
-- TOC entry 3900 (class 0 OID 0)
-- Dependencies: 269
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.migrations_id_seq', 5, true);


--
-- TOC entry 3901 (class 0 OID 0)
-- Dependencies: 238
-- Name: nocodb_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.nocodb_config_id_seq', 1, true);


--
-- TOC entry 3902 (class 0 OID 0)
-- Dependencies: 242
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.orders_id_seq', 9, true);


--
-- TOC entry 3903 (class 0 OID 0)
-- Dependencies: 254
-- Name: permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.permissions_id_seq', 108, true);


--
-- TOC entry 3904 (class 0 OID 0)
-- Dependencies: 244
-- Name: publicities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.publicities_id_seq', 10, true);


--
-- TOC entry 3905 (class 0 OID 0)
-- Dependencies: 277
-- Name: reconciliation_comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.reconciliation_comments_id_seq', 1, true);


--
-- TOC entry 3906 (class 0 OID 0)
-- Dependencies: 252
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.roles_id_seq', 11, true);


--
-- TOC entry 3907 (class 0 OID 0)
-- Dependencies: 229
-- Name: sav_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.sav_tickets_id_seq', 8, true);


--
-- TOC entry 3908 (class 0 OID 0)
-- Dependencies: 231
-- Name: stores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.stores_id_seq', 5, true);


--
-- TOC entry 3909 (class 0 OID 0)
-- Dependencies: 240
-- Name: suppliers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.suppliers_id_seq', 5, true);


--
-- TOC entry 3910 (class 0 OID 0)
-- Dependencies: 250
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.tasks_id_seq', 96, true);


--
-- TOC entry 3911 (class 0 OID 0)
-- Dependencies: 279
-- Name: weather_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.weather_settings_id_seq', 1, true);


--
-- TOC entry 3912 (class 0 OID 0)
-- Dependencies: 273
-- Name: webhook_bap_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.webhook_bap_config_id_seq', 1, true);


--
-- TOC entry 3609 (class 2606 OID 2359318)
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- TOC entry 3617 (class 2606 OID 2367502)
-- Name: avoirs avoirs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.avoirs
    ADD CONSTRAINT avoirs_pkey PRIMARY KEY (id);


--
-- TOC entry 3509 (class 2606 OID 24588)
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- TOC entry 3511 (class 2606 OID 24603)
-- Name: client_orders client_orders_order_number_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_orders
    ADD CONSTRAINT client_orders_order_number_unique UNIQUE (order_number);


--
-- TOC entry 3513 (class 2606 OID 24601)
-- Name: client_orders client_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_orders
    ADD CONSTRAINT client_orders_pkey PRIMARY KEY (id);


--
-- TOC entry 3515 (class 2606 OID 24612)
-- Name: command_items command_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.command_items
    ADD CONSTRAINT command_items_pkey PRIMARY KEY (id);


--
-- TOC entry 3517 (class 2606 OID 24627)
-- Name: commands commands_command_number_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.commands
    ADD CONSTRAINT commands_command_number_unique UNIQUE (command_number);


--
-- TOC entry 3519 (class 2606 OID 24625)
-- Name: commands commands_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.commands
    ADD CONSTRAINT commands_pkey PRIMARY KEY (id);


--
-- TOC entry 3558 (class 2606 OID 57540)
-- Name: customer_orders customer_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_orders
    ADD CONSTRAINT customer_orders_pkey PRIMARY KEY (id);


--
-- TOC entry 3521 (class 2606 OID 24638)
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- TOC entry 3600 (class 2606 OID 2342922)
-- Name: dashboard_messages dashboard_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.dashboard_messages
    ADD CONSTRAINT dashboard_messages_pkey PRIMARY KEY (id);


--
-- TOC entry 3586 (class 2606 OID 819224)
-- Name: database_backups database_backups_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.database_backups
    ADD CONSTRAINT database_backups_pkey PRIMARY KEY (id);


--
-- TOC entry 3577 (class 2606 OID 73746)
-- Name: deliveries deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_pkey PRIMARY KEY (id);


--
-- TOC entry 3523 (class 2606 OID 24662)
-- Name: delivery_items delivery_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.delivery_items
    ADD CONSTRAINT delivery_items_pkey PRIMARY KEY (id);


--
-- TOC entry 3560 (class 2606 OID 57550)
-- Name: dlc_products dlc_products_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.dlc_products
    ADD CONSTRAINT dlc_products_pkey PRIMARY KEY (id);


--
-- TOC entry 3546 (class 2606 OID 57462)
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- TOC entry 3596 (class 2606 OID 2310156)
-- Name: invoice_verification_cache invoice_verification_cache_cache_key_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoice_verification_cache
    ADD CONSTRAINT invoice_verification_cache_cache_key_key UNIQUE (cache_key);


--
-- TOC entry 3598 (class 2606 OID 2310154)
-- Name: invoice_verification_cache invoice_verification_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoice_verification_cache
    ADD CONSTRAINT invoice_verification_cache_pkey PRIMARY KEY (id);


--
-- TOC entry 3590 (class 2606 OID 2285579)
-- Name: invoice_verifications invoice_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoice_verifications
    ADD CONSTRAINT invoice_verifications_pkey PRIMARY KEY (id);


--
-- TOC entry 3525 (class 2606 OID 24690)
-- Name: invoices invoices_invoice_number_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number);


--
-- TOC entry 3527 (class 2606 OID 24688)
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- TOC entry 3605 (class 2606 OID 2359305)
-- Name: migrations migrations_filename_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_filename_key UNIQUE (filename);


--
-- TOC entry 3607 (class 2606 OID 2359303)
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 3548 (class 2606 OID 57474)
-- Name: nocodb_config nocodb_config_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.nocodb_config
    ADD CONSTRAINT nocodb_config_pkey PRIMARY KEY (id);


--
-- TOC entry 3552 (class 2606 OID 57498)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- TOC entry 3569 (class 2606 OID 57592)
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- TOC entry 3571 (class 2606 OID 57590)
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- TOC entry 3554 (class 2606 OID 57522)
-- Name: publicities publicities_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.publicities
    ADD CONSTRAINT publicities_pkey PRIMARY KEY (id);


--
-- TOC entry 3556 (class 2606 OID 57524)
-- Name: publicities publicities_pub_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.publicities
    ADD CONSTRAINT publicities_pub_number_key UNIQUE (pub_number);


--
-- TOC entry 3575 (class 2606 OID 57620)
-- Name: publicity_participations publicity_participations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.publicity_participations
    ADD CONSTRAINT publicity_participations_pkey PRIMARY KEY (publicity_id, group_id);


--
-- TOC entry 3619 (class 2606 OID 2375691)
-- Name: reconciliation_comments reconciliation_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reconciliation_comments
    ADD CONSTRAINT reconciliation_comments_pkey PRIMARY KEY (id);


--
-- TOC entry 3573 (class 2606 OID 57614)
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- TOC entry 3565 (class 2606 OID 57579)
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- TOC entry 3567 (class 2606 OID 57577)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- TOC entry 3529 (class 2606 OID 24703)
-- Name: sav_tickets sav_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sav_tickets
    ADD CONSTRAINT sav_tickets_pkey PRIMARY KEY (id);


--
-- TOC entry 3531 (class 2606 OID 24705)
-- Name: sav_tickets sav_tickets_ticket_number_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sav_tickets
    ADD CONSTRAINT sav_tickets_ticket_number_unique UNIQUE (ticket_number);


--
-- TOC entry 3536 (class 2606 OID 32776)
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- TOC entry 3539 (class 2606 OID 57433)
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- TOC entry 3533 (class 2606 OID 24717)
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- TOC entry 3550 (class 2606 OID 57486)
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- TOC entry 3563 (class 2606 OID 57563)
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- TOC entry 3584 (class 2606 OID 720930)
-- Name: user_groups user_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_pkey PRIMARY KEY (user_id, group_id);


--
-- TOC entry 3582 (class 2606 OID 720917)
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- TOC entry 3542 (class 2606 OID 57445)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3544 (class 2606 OID 57447)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 3621 (class 2606 OID 2383886)
-- Name: weather_settings weather_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.weather_settings
    ADD CONSTRAINT weather_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 3615 (class 2606 OID 2359345)
-- Name: webhook_bap_config webhook_bap_config_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.webhook_bap_config
    ADD CONSTRAINT webhook_bap_config_pkey PRIMARY KEY (id);


--
-- TOC entry 3534 (class 1259 OID 32777)
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- TOC entry 3610 (class 1259 OID 2359331)
-- Name: idx_announcements_author_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_announcements_author_id ON public.announcements USING btree (author_id);


--
-- TOC entry 3611 (class 1259 OID 2359330)
-- Name: idx_announcements_created_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_announcements_created_at ON public.announcements USING btree (created_at DESC);


--
-- TOC entry 3612 (class 1259 OID 2359332)
-- Name: idx_announcements_group_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_announcements_group_id ON public.announcements USING btree (group_id);


--
-- TOC entry 3613 (class 1259 OID 2359329)
-- Name: idx_announcements_priority; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_announcements_priority ON public.announcements USING btree (priority);


--
-- TOC entry 3591 (class 1259 OID 2310157)
-- Name: idx_cache_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_cache_key ON public.invoice_verification_cache USING btree (cache_key);


--
-- TOC entry 3601 (class 1259 OID 2342923)
-- Name: idx_dashboard_messages_created_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_dashboard_messages_created_at ON public.dashboard_messages USING btree (created_at DESC);


--
-- TOC entry 3602 (class 1259 OID 2342925)
-- Name: idx_dashboard_messages_created_by; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_dashboard_messages_created_by ON public.dashboard_messages USING btree (created_by);


--
-- TOC entry 3603 (class 1259 OID 2342924)
-- Name: idx_dashboard_messages_store_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_dashboard_messages_store_id ON public.dashboard_messages USING btree (store_id);


--
-- TOC entry 3592 (class 1259 OID 2310160)
-- Name: idx_delivery_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_delivery_id ON public.invoice_verification_cache USING btree (delivery_id);


--
-- TOC entry 3561 (class 1259 OID 2334721)
-- Name: idx_dlc_products_stock_epuise; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_dlc_products_stock_epuise ON public.dlc_products USING btree (stock_epuise);


--
-- TOC entry 3593 (class 1259 OID 2310159)
-- Name: idx_expires_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_expires_at ON public.invoice_verification_cache USING btree (expires_at);


--
-- TOC entry 3594 (class 1259 OID 2310158)
-- Name: idx_group_invoice; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_group_invoice ON public.invoice_verification_cache USING btree (group_id, invoice_reference);


--
-- TOC entry 3537 (class 1259 OID 57434)
-- Name: idx_session_expire; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_session_expire ON public.sessions USING btree (expire);


--
-- TOC entry 3578 (class 1259 OID 720946)
-- Name: idx_user_roles_assigned_by; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_user_roles_assigned_by ON public.user_roles USING btree (assigned_by);


--
-- TOC entry 3579 (class 1259 OID 720945)
-- Name: idx_user_roles_role_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_user_roles_role_id ON public.user_roles USING btree (role_id);


--
-- TOC entry 3580 (class 1259 OID 720944)
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- TOC entry 3587 (class 1259 OID 2285590)
-- Name: invoice_verifications_delivery_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX invoice_verifications_delivery_idx ON public.invoice_verifications USING btree (delivery_id);


--
-- TOC entry 3588 (class 1259 OID 2285591)
-- Name: invoice_verifications_invoice_ref_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX invoice_verifications_invoice_ref_idx ON public.invoice_verifications USING btree (invoice_reference, group_id);


--
-- TOC entry 3540 (class 1259 OID 319488)
-- Name: users_email_unique; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX users_email_unique ON public.users USING btree (email) WHERE (email IS NOT NULL);


--
-- TOC entry 3627 (class 2606 OID 2359319)
-- Name: announcements announcements_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3628 (class 2606 OID 2359324)
-- Name: announcements announcements_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- TOC entry 3625 (class 2606 OID 2285580)
-- Name: invoice_verifications invoice_verifications_delivery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoice_verifications
    ADD CONSTRAINT invoice_verifications_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id) ON DELETE CASCADE;


--
-- TOC entry 3626 (class 2606 OID 2285585)
-- Name: invoice_verifications invoice_verifications_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoice_verifications
    ADD CONSTRAINT invoice_verifications_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- TOC entry 3629 (class 2606 OID 2375697)
-- Name: reconciliation_comments reconciliation_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reconciliation_comments
    ADD CONSTRAINT reconciliation_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3630 (class 2606 OID 2375692)
-- Name: reconciliation_comments reconciliation_comments_delivery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reconciliation_comments
    ADD CONSTRAINT reconciliation_comments_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id) ON DELETE CASCADE;


--
-- TOC entry 3631 (class 2606 OID 2375702)
-- Name: reconciliation_comments reconciliation_comments_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reconciliation_comments
    ADD CONSTRAINT reconciliation_comments_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- TOC entry 3622 (class 2606 OID 2269185)
-- Name: tasks tasks_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3624 (class 2606 OID 720931)
-- Name: user_groups user_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- TOC entry 3623 (class 2606 OID 720918)
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- TOC entry 3847 (class 0 OID 0)
-- Dependencies: 3846
-- Name: DATABASE neondb; Type: ACL; Schema: -; Owner: neondb_owner
--

GRANT ALL ON DATABASE neondb TO neon_superuser;


--
-- TOC entry 2211 (class 826 OID 16392)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- TOC entry 2210 (class 826 OID 16391)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


-- Completed on 2025-09-28 06:02:06 UTC

--
-- PostgreSQL database dump complete
--

