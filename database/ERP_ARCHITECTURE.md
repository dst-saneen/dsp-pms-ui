# ERP Architecture Principles

**Project:** Group ERP
**Version:** 1.0
**Status:** Living Architecture Document

---

# Vision

The goal of this ERP is to build a modern, scalable and reusable enterprise platform that can be deployed for different companies without changing the core architecture.

The ERP must follow modular design, reusable components, generic business services, and a consistent user experience throughout the application.

---

# Core Design Principles

## 1. Master Data vs Business Events

Every module must be separated into:

* Master Data
* Business Events

Master Data describes **what something is**.

Business Events describe **what happened to it**.

This principle applies to every module.

### Employee

**Master**

* Employee
* Company
* Department
* Designation

**Business Events**

* Joining
* Promotion
* Transfer
* Salary Revision
* Leave
* Attendance
* Training
* Termination

---

### Asset

**Master**

* Asset
* Category
* Type
* Brand
* Model

**Business Events**

* Purchase
* Assignment
* Return
* Movement
* Maintenance
* Warranty Claim
* Disposal
* Inspection

---

### Project

**Master**

* Project

**Business Events**

* Kickoff
* Resource Assignment
* Milestone
* Variation
* Invoice
* Closure

---

## 2. Master Data Never Stores History

Master tables always contain the current state.

History is never overwritten.

Historical information must be stored inside Business Event tables.

Example:

Incorrect

Employee

* Current Salary
* Previous Salary
* Previous Department

Correct

Employee

* Current Department

Employee Promotion History

Employee Salary History

Employee Transfer History

---

## 3. Timeline is Generated

Timeline is not maintained manually.

Timeline is generated automatically from Business Events.

Example

Employee Timeline

* Joined Company
* Promoted
* Salary Revised
* Leave Approved

Asset Timeline

* Purchased
* Assigned
* Returned
* Warranty Claim
* Disposed

---

## 4. Audit Log vs Business Events

Audit Logs and Business Events are different.

### Audit Log

Purpose

Technical tracking.

Examples

* Field changed
* Old Value
* New Value
* User
* Timestamp

### Business Event

Purpose

Business process tracking.

Examples

* Laptop Assigned
* Employee Promoted
* Leave Approved

Both must exist independently.

---

# Module Architecture

Every module follows the same structure.

Backend

```
module/

controller

service

dto

entities
```

Frontend

```
feature/

components

hooks

services

types
```

This structure is mandatory for all modules.

---

# Workspace Pattern

Every master module uses the same user experience.

```
List Page

↓

Workspace

↓

Business Features
```

Examples

Employee

```
Employee List

↓

Employee Workspace
```

Asset

```
Asset List

↓

Asset Workspace
```

Project

```
Project List

↓

Project Workspace
```

---

# Workspace Structure

Every workspace should follow a consistent layout.

```
Overview

Business Events

Documents

Timeline
```

Additional tabs can be added based on the module.

Examples

Employee

* Overview
* Assets
* Leave
* Payroll
* Documents
* Timeline

Asset

* Overview
* Assignments
* Maintenance
* Warranty
* Documents
* Timeline

Project

* Overview
* Resources
* Timesheets
* Documents
* Timeline

---

# Shared Services

Shared services must never belong to a specific module.

Shared services include

* Document Management
* Notification Engine
* Timeline Engine
* Audit Engine
* File Storage
* Report Engine
* Dashboard Engine
* Workflow Engine

Modules consume these services instead of implementing their own versions.

---

# Generic Components

Reusable UI components belong in the common component library.

Examples

* DataTable
* StatCard
* InfoCard
* InfoRow
* EmptyState
* LookupSelect
* FormSection
* StatusBadge

Feature-specific components remain inside their respective modules.

---

# Lookup Data

Lookup values must never be hardcoded.

Examples

* Company
* Branch
* Department
* Designation
* Asset Category
* Asset Type
* Leave Type

All lookup values are maintained through Administration.

---

# Business Relationships

Relationships should always reference master records.

Example

```
Employee

↓

Assigned Assets

↓

Asset
```

instead of

```
Asset

Employee Name
```

Relationships must use IDs instead of duplicated values.

---

# Module Development Blueprint

Every new module follows the same implementation order.

Backend

1. Prisma Model
2. Migration
3. DTOs
4. Service
5. Controller
6. Swagger
7. Audit Logging

Frontend

1. Types
2. API Service
3. React Query Hooks
4. Workspace
5. Data Table
6. Create/Edit Dialog
7. KPIs
8. Search & Filters

No module should skip this sequence.

---

# Current Roadmap

## Administration

* Company
* Branch
* Department
* Designation

## HR

* Employee

## Asset Management

* Asset

## Project Management

* Project

## CRM

* Client

## Procurement

* Supplier

Once these master modules are complete, shared platform services will be introduced.

---

# Phase 2

Shared Platform

* Document Management
* Workflow Engine
* Notification Engine
* Timeline Engine
* Dashboard Builder
* Report Builder
* Custom Fields

These services are built only after the core ERP modules are completed.

---

# Design Philosophy

Before implementing any new feature, always ask:

1. Is this Master Data or a Business Event?
2. Can another module reuse this functionality?
3. Does this belong in a shared service?
4. Will this value change over time?
5. Should history be preserved?
6. Can this support multiple companies?

If the answer indicates reuse or historical tracking, design the feature accordingly.

---

# Long-Term Goal

The ERP should evolve into a platform where business modules consume shared services instead of duplicating functionality.

The architecture should prioritize:

* Reusability
* Scalability
* Maintainability
* Consistency
* Multi-company support
* Extensibility

This document serves as the architectural guideline for all future development within the ERP.
