# LogiFlow - Replit Development Guide

## Overview
LogiFlow is a comprehensive logistics management platform for La Foir'Fouille retail stores. It centralizes order, delivery, customer order, inventory, and user administration across multiple store locations. Its business vision is to streamline logistics operations, enhance inventory accuracy, and improve overall operational efficiency for retail chains.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, Vite
- **UI Framework**: Shadcn/ui (built on Radix UI), Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod validation
- **UI/UX Decisions**: Clean, intuitive interface using Shadcn/ui components for consistency and accessibility. Color schemes managed via Tailwind CSS custom variables for easy theming.

### Backend
- **Framework**: Express.js with TypeScript, Node.js (ES modules)
- **Database ORM**: Drizzle ORM
- **Authentication**: Dual system (local for production, Replit Auth for development)
- **Session Management**: Express sessions with PostgreSQL storage
- **Security**: Comprehensive middleware (rate limiting, input sanitization, security headers)

### Database
- **Primary Database**: PostgreSQL with Drizzle ORM (Neon serverless for development, Docker for production)
- **Schema**: Centralized definition in `shared/schema.ts`
- **Migrations**: Drizzle Kit

### Core Business Entities
- **Management**: Orders, Deliveries, Customer Orders, Suppliers, Publicities, DLC Products (limited shelf life), Tasks.

### Data Flow
- **Request Flow**: Client requests via React Query, processed by Express middleware for authentication/security, then by route handlers using Drizzle ORM for database operations.
- **Authentication Flow**: Replit Auth for dev, secure username/password for production with PostgreSQL-backed sessions and role-based authorization.
- **Data Synchronization**: Real-time updates via React Query with optimistic updates and intelligent cache invalidation. Global store context filters data.

### Key Features
- **Authentication System**: Secure dual authentication with password hashing and session management.
- **Multi-Store Management**: Global store context, role-based access control (admin, manager, employee, directeur), and data isolation.
- **Universal Pagination**: Reusable client-side pagination component across all main tabular data pages.
- **Reconciliation Module**: For balancing and tracking financial discrepancies.
- **Permission System**: Granular, hardcoded permissions (54 permissions across 12 categories, assigned to 4 roles) for improved performance and maintenance.
- **User Management**: Comprehensive features including user deletion with ownership transfer, consistent name and email field handling, and robust password hashing.
- **Calendar Synchronization**: Proper display of delivery dates and automatic synchronization of order statuses.
- **Database Schema Download**: Admin-only feature to download comprehensive database structure reports.

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