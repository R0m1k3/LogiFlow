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

#### Production Password Hashing Fix
- **Issue**: Admin password changes failed in production with ERR_MODULE_NOT_FOUND for localAuth.production
- **Root Cause**: Dynamic imports in production needed `.js` extension for compiled files
- **Solution**: Updated import paths to use `./localAuth.production.js` for production environment
- **Result**: Password hashing now works correctly in production for user updates

#### Email Constraint Fix for User Management
- **Issue**: Both user creation and editing failed with "duplicate key value violates unique constraint users_email_key" error
- **Root Cause**: PostgreSQL treats empty strings (`""`) as unique values, but multiple users with empty emails violated uniqueness constraint
- **Solution Implemented**:
  - Updated both POST `/api/users` (creation) and PUT `/api/users/:id` (editing) routes to convert empty emails to `NULL`
  - Enhanced validation schemas to accept `null` values for email fields
  - Created `fix-duplicate-empty-email.sql` script to clean existing database records
  - Improved error handling and logging for better production debugging
- **Result**: Users can now be created and edited with optional email fields without constraint violations

#### Calendar Order-Delivery Synchronization Fix
- **Issue**: Orders linked to delivered deliveries were not showing proper status and dates in calendar view
- **Root Cause**: Three interconnected problems:
  1. OrderDetailModal was displaying non-existent `plannedDate` instead of `scheduledDate`/`deliveredDate`
  2. Order status was not automatically updated when delivery status changed via updateDelivery method
  3. Delivered deliveries had missing `deliveredDate` field causing "Date non disponible" display
- **Solution Implemented**:
  - Enhanced OrderDetailModal to display correct dates: `deliveredDate` for delivered items, `scheduledDate` for planned ones
  - Added automatic order status synchronization in `updateDelivery` method when delivery marked as delivered
  - Created `fix-delivery-order-sync.sql` script to correct existing production data inconsistencies
  - Improved Calendar date initialization to show current month instead of hardcoded July 2025
- **Result**: Calendar now properly displays delivery dates and automatically synchronizes order statuses when deliveries are completed

### August 12, 2025 - Employee Permissions Restriction & Database Schema Download

#### Employee Role Permissions Update
- **Issue**: Employee role had excessive access to orders and deliveries modules, but needed restricted calendar access
- **Root Cause**: Permission system allowed employees full access to create orders/deliveries from calendar and sidebar navigation
- **Solution Implemented**:
  - Updated `shared/permissions.ts`: Removed all permissions for employees on 'orders' and 'deliveries' modules
  - Modified `client/src/components/Sidebar.tsx`: Removed orders and deliveries menu items for employee role
  - Enhanced `client/src/pages/Calendar.tsx`: Added permission checks to hide "Nouveau" button for employees
  - Updated `client/src/components/modals/QuickCreateMenu.tsx`: Added role-based filtering for order/delivery creation options
- **Employee Access Rules**:
  - **Calendar**: View-only access, cannot create orders or deliveries
  - **Sidebar**: No access to Orders and Deliveries menu items
  - **Customer Orders & DLC**: Maintains supplier list access for creating customer orders and DLC entries
- **Result**: Employees now have appropriate restricted access while maintaining necessary supplier information for their workflows

#### Database Schema Download Feature
- **Issue**: Database schema scan results were only available in server logs, needed downloadable reports
- **Solution Implemented**:
  - Created new API route `/api/debug/download-schema` for production schema downloads
  - Added comprehensive schema report generation with tables, columns, constraints, and record counts
  - Enhanced `client/src/pages/DatabaseDebug.tsx`: Added download button that appears after successful scans
  - Implemented proper file download headers with automatic filename generation
  - Added admin-only access restriction and production environment validation
- **Download Report Features**:
  - Complete database structure with column details and constraints
  - Record counts per table for data overview
  - Foreign key relationships mapping
  - Formatted text file with timestamps and user information
- **Result**: Administrators can now download comprehensive database schema reports for documentation and analysis

#### Employee Supplier Access Fix
- **Issue**: Employee role could not access supplier lists in Customer Orders and DLC modules on production server
- **Root Cause**: API route `/api/suppliers` was restricted to admin and manager roles only, excluding employees and directeurs
- **Solution Implemented**:
  - Updated `/api/suppliers` GET route: Added employee and directeur role access for read operations
  - Updated `/api/suppliers` POST route: Added directeur role access for creation operations  
  - Updated `/api/suppliers` PUT route: Added directeur role access for edit operations
  - Updated `/api/suppliers` DELETE route: Restricted to admin and directeur only (removed manager access)
  - Created test script `test-employee-supplier-access.js` for production verification
- **Access Matrix Updated**:
  - **GET /api/suppliers**: admin, directeur, manager, employee (all roles can read)
  - **POST /api/suppliers**: admin, directeur, manager (creation permissions)
  - **PUT /api/suppliers**: admin, directeur, manager (edit permissions)  
  - **DELETE /api/suppliers**: admin, directeur only (delete permissions)
- **Result**: Employees can now access supplier lists in Customer Orders and DLC modules while maintaining appropriate write restrictions