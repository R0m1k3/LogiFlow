# Enterprise Weather Management Platform

## Overview
This platform is an enterprise weather management system with advanced multi-tenant logistics tracking and comprehensive order management capabilities. It provides robust delivery workflow management with enhanced reconciliation features, focusing on operational efficiency through detailed financial tracking, granular access controls, and sophisticated permission management.

The platform aims to streamline logistics and order fulfillment processes for businesses, improving efficiency and providing critical weather insights for operational planning. Its multi-tenant architecture makes it scalable for various enterprise sizes, offering a competitive edge in logistics management.

## User Preferences
- Langue préférée : Français
- Communication : Langue simple et accessible, éviter les détails techniques
- Nettoyage : Préfère un projet optimisé sans fichiers inutiles

## System Architecture
The platform is built with a clear separation of concerns, utilizing a modern full-stack JavaScript architecture.

**UI/UX Decisions:**
- Frontend uses React.js with custom UI components from `shadcn/ui` and styled with Tailwind CSS for a consistent and modern aesthetic.
- The design emphasizes clean interfaces, responsive layouts, and intuitive navigation.
- Color schemes prioritize readability and user comfort, with an elegant gradient and shadow design.
- Calendar design is modern, with clean lines, clear separations, color-coded days, and a modal system for daily events.

**Technical Implementations & Design Patterns:**
- **Frontend:** React.js for interactive user interfaces, with React Query for data fetching and state management.
- **Backend:** Node.js Express (ESM) provides a robust API layer. Data validation is performed using Zod schemas.
- **Database:** PostgreSQL as the primary data store, with Drizzle ORM facilitating interaction and database migrations ensuring schema consistency.
- **Authentication:** Secure role-based access control (RBAC) for granular permissions.
- **Multi-tenancy:** Supports multi-tenant operations with group and permission management, ensuring data isolation between stores/groups.
- **Backup System:** Integrated PostgreSQL backup manager for manual and scheduled backups.
- **Error Handling:** Robust error management for graceful degradation and informative logging.
- **Data Synchronization:** Logic ensures data consistency between development (in-memory storage) and production (PostgreSQL) environments.
- **Caching:** Robust caching system for invoice verification results with automatic expiration, conflict resolution, and in-memory/database storage.

**Feature Specifications:**
- **Weather Integration:** A comprehensive weather interface displaying detailed conditions from the Visual Crossing API, with French language support, intelligent date comparison, and automatic geolocation detection.
- **Order and Delivery Management:** Full CRUD operations for orders and deliveries, including linking orders to deliveries and managing their statuses.
- **Reconciliation:** Functionality for reconciling Bills of Lading (BL) and invoices with immediate UI updates.
- **Task Management:** A comprehensive task management system with advanced temporal features, intelligent sorting (pending > priority > date), due dates with calendar selector, visual indicators for overdue/urgent tasks, filters by due date, Kanban and list views, and colored badges for temporal status. Includes start dates with role-based visibility. **CRITICAL GROUP FILTERING FIX (August 2025)**: Fixed group selection persistence issues - all pages (Tasks, Orders, Deliveries, Calendar) now properly apply selectedStoreId filtering for ALL user roles, not just admin. Prevents mixed data display after page reload.
- **Information System (Announcements):** A complete announcement system with priority levels (normal, important, urgent), role-based access control (admin: full CRUD; others: read-only), intelligent sorting by priority and date, and store-based filtering for administrators. Includes an automatic dashboard modal for recent announcements.
- **DLC Module:** Permissions allow admin, director, and manager roles to validate DLC products. Includes explanatory tooltips for UX enhancement.
- **Reporting:** Statistical reporting, including monthly summaries of deliveries.
- **UI Harmonization:** All detail modals across modules (orders, deliveries, calendar) use a unified component for consistent information display.

## External Dependencies
- **API Météo:** Visual Crossing API
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **UI Components:** `shadcn/ui`
- **Styling:** Tailwind CSS