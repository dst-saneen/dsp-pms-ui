# WO-0013 – ERP Platform Framework

## Status

Completed

---

# Objective

Build a reusable enterprise platform framework for the Group ERP.

The framework eliminates duplicated CRUD logic while keeping business rules inside feature services.

This platform is the foundation for all future ERP modules.

---

# Architecture

Controller

↓

Service

↓

Repository

↓

BaseRepository

↓

Prisma

↓

PostgreSQL

---

# Repository Pattern

Every module owns its own repository.

Example

EmployeeRepository

DepartmentRepository

ProjectRepository

AssetRepository

Repositories inherit from BaseRepository.

Repositories never contain business logic.

Repositories only access the database.

---

# Service Pattern

Services contain business rules.

Examples

Validation

Duplicate checking

Workflow

Approval

Notifications

Audit

Services inherit from BaseCrudService whenever possible.

---

# BaseRepository

Provides

findUnique()

findUniqueOrThrow()

findFirst()

findMany()

create()

update()

delete()

count()

exists()

Repositories accept Prisma argument objects.

This preserves

include

select

orderBy

relations

while hiding Prisma delegates.

---

# BaseCrudService

Provides

CRUD operations

Lifecycle hooks

beforeCreate()

afterCreate()

beforeUpdate()

afterUpdate()

beforeDelete()

afterDelete()

Feature services override hooks only when required.

---

# DependencyValidator

Provides reusable dependency checking.

Example

Department

↓

Employees

↓

Assets

↓

Projects

Instead of duplicating count() logic.

---

# SummaryHelper

Provides reusable dashboard summaries.

Supports

Total

Active

Inactive

Custom counters

---

# Exception Handling

All APIs return a standard error format.

{
  success,
  statusCode,
  error,
  message,
  timestamp,
  path,
  method
}

---

# Repository Rules

Repositories

✓ Database only

✓ No validation

✓ No workflow

✓ No business rules

---

# Service Rules

Services

✓ Business rules

✓ Validation

✓ Workflow

✓ Audit

✓ Notifications

✗ Direct database access (eventually)

---

# Controller Rules

Controllers

Thin

No business logic

Only

Validation

Routing

HTTP

---

# Migration Strategy

Phase 1

Platform Framework

Completed

Phase 2

Reference Module

Employee Document Category

Completed

Phase 3

New Modules

Every new module must use

Repository

BaseCrudService

SummaryHelper

DependencyValidator

Phase 4

Legacy Modules

Migrated gradually.

---

# Future Platform Work

WO-0014

Master Data Framework

WO-0015

Lookup Framework

WO-0016

Notification Framework

WO-0017

Event Framework

WO-0018

Caching Framework

---

# Coding Standards

No duplicated CRUD.

No duplicated summary logic.

No duplicated dependency validation.

No business logic inside repositories.

Keep controllers thin.

Feature services own business rules.

---

# WO-0013 Deliverables

✓ BaseRepository

✓ BaseCrudService

✓ Shared DTOs

✓ Shared Constants

✓ Shared Enums

✓ Shared Exceptions

✓ DependencyValidator

✓ SummaryHelper

✓ Standard Exception Filter

✓ Repository Pattern

✓ Reference Implementation

Framework Ready