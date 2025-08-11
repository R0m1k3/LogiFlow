# LogiFlow - Replit Development Guide

## Overview
LogiFlow is a comprehensive logistics management platform for La Foir'Fouille retail stores. It centralizes order, delivery, customer order, inventory, and user administration across multiple store locations. Its business vision is to streamline logistics operations, enhance inventory accuracy, and improve overall operational efficiency for retail chains.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Framework**: Shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS with custom CSS variables
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod validation
- **UI/UX Decisions**: Focus on a clean, intuitive interface using Shadcn/ui components for consistency and accessibility. Color schemes are managed via Tailwind CSS custom variables for easy theming.

### Backend
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ES modules
- **Database ORM**: Drizzle ORM
- **Authentication**: Dual system (local for production, Replit Auth for development)
- **Session Management**: Express sessions with PostgreSQL storage
- **Security**: Comprehensive middleware (rate limiting, input sanitization, security headers)

### Database
- **Primary Database**: PostgreSQL with Drizzle ORM
- **Development**: Neon serverless PostgreSQL
- **Production**: Standard PostgreSQL in Docker containers
- **Schema**: Centralized definition in `shared/schema.ts`
- **Migrations**: Drizzle Kit

### Core Business Entities
- **Orders**: Purchase orders, supplier relationships, delivery tracking.
- **Deliveries**: Delivery tracking and status.
- **Customer Orders**: Point-of-sale management with barcode generation.
- **Suppliers**: Vendor management and order history.
- **Publicities**: Marketing campaign management and store participation.
- **DLC Products**: Management of products with limited shelf life, including status tracking and alerts.
- **Tasks**: Streamlined task management with simplified assignment and completion tracking.

### Data Flow
- **Request Flow**: Client requests via React Query, processed by Express middleware for authentication/security, then by route handlers using Drizzle ORM for database operations.
- **Authentication Flow**: Replit Auth for dev, secure username/password for production with PostgreSQL-backed sessions and role-based authorization.
- **Data Synchronization**: Real-time updates via React Query with optimistic updates and intelligent cache invalidation. Global store context filters data.

### Key Features
- **Authentication System**: Secure dual authentication system with robust password hashing and session management.
- **Multi-Store Management**: Global store context, role-based access control (admin, manager, employee, directeur), and data isolation.
- **Universal Pagination**: Reusable client-side pagination component applied across all main tabular data pages (Orders, Deliveries, Customer Orders, DlcPage, BLReconciliation, Tasks) with configurable limits per module.
- **Reconciliation Module**: For balancing and tracking financial discrepancies.
- **Permission System**: Granular permission management with 54 permissions across 12 categories, assigned to 4 roles.

## External Dependencies

### Frontend Dependencies
- **UI Components**: Radix UI
- **Form Management**: React Hook Form, Zod
- **Date Handling**: date-fns
- **Query Management**: TanStack Query
- **Barcode Generation**: JsBarcode

### Backend Dependencies
- **Database**: PostgreSQL (pg driver), Drizzle ORM
- **Authentication**: Passport.js (local strategy), connect-pg-simple
- **Security**: express-rate-limit, helmet equivalent
- **Validation**: Zod

### Development Dependencies
- **Build Tools**: Vite (React plugin, TypeScript support)
- **Code Quality**: ESLint, TypeScript compiler
- **Development Server**: Vite dev server

### Other Integrations
- **NocoDB Integration**: Configurable for invoice verification and data synchronization.

## Recent Changes

### August 11, 2025 - Permissions System Overhaul & User Management Improvements

#### Hardcoded Permissions System Implementation
- **Migration from Database to Code**: Replaced flexible database-driven permissions with hardcoded permission system for better performance and control
- **New Architecture**: 
  - Created `client/src/lib/permissions.ts` and `shared/permissions.ts` with role-based module permissions
  - Implemented server-side middleware `server/permissions.ts` for route protection
  - Removed database tables: `roles`, `permissions`, `rolePermissions`, `userRoles`
  - Cleaned up storage interface and routes from old permission system
- **Permission Matrix by Module**:
  - **Dashboard**: All roles can view
  - **Calendar/Orders/Deliveries**: Admin/Directeur full access, Manager all except delete, Employee view only
  - **Reconciliation**: Admin full access, Directeur all except delete, Manager/Employee no access
  - **Publicity**: Admin full access, others view only
  - **Customer Orders**: Admin/Directeur full access, Manager all except delete, Employee view + create
  - **DLC**: Admin/Directeur full access, Manager all except delete, Employee create + view
  - **Tasks**: Admin/Directeur full access, Manager view + validate, Employee view only
- **Benefits**: Improved performance, simplified maintenance, no database queries for permission checks

### August 11, 2025 - User Management Improvements

#### User Deletion Fix
- **Issue**: Foreign key constraint errors when deleting users who created customer orders or other records
- **Root Cause**: User records were referenced by multiple tables (customer_orders, deliveries, DLC products, etc.)
- **Solution Implemented**:
  - Enhanced deleteUser method with database transaction for atomicity
  - Prioritized lookup for `admin_local` (default admin) with fallback to any admin user
  - Ownership transfer of all user-created records to existing admin before deletion
  - Comprehensive handling of all foreign key relationships including role assignments
  - Graceful error handling when no admin user exists
- **Tables Handled**: customer_orders, orders, deliveries, publicities, dlcProducts, tasks, nocodbConfig, userGroups, userRoles (both userId and assignedBy), database_backups
- **Result**: Safe user deletion while preserving business data integrity

#### User Name Fields Optional in Production
- **Issue**: Inconsistent validation between user creation and editing forms for name fields
- **Root Cause**: Edit form required firstName/lastName while creation form had them as optional
- **Solution Implemented**:
  - Removed required validation from edit form firstName/lastName fields
  - Updated placeholders to indicate "(optionnel)" for consistency
  - Maintained database schema where name fields are already optional
- **Result**: Name fields now consistently optional across all user management interfaces

#### User Edit Form Initialization Fix
- **Issue**: Prénom/nom fields in edit form were not editable because they were initialized from wrong data source
- **Root Cause**: handleEditUser was only using the `name` field instead of `firstName`/`lastName` fields from database
- **Solution Implemented**:
  - Modified handleEditUser to prioritize `firstName`/`lastName` fields from database
  - Added fallback to split `name` field if firstName/lastName are empty  
  - Fixed edit form initialization to use actual database values
- **Result**: Edit form now properly loads existing firstName/lastName values and allows editing

#### Email Field Consistency in Edit Form
- **Issue**: Email field was marked as required in edit form but optional in create form
- **Solution**: Removed `required` attribute and asterisk from email field in edit form
- **Result**: Email field now consistently optional in both create and edit forms