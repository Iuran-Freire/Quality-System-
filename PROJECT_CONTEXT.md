# PROJECT CONTEXT — OQC / IQC Quality Inspection System

## 1. Overview

This project is a web-based inspection system developed using:

- Vue 3 (Composition API)
- Pinia (state management)
- Dexie.js (IndexedDB local database)
- jsPDF + autoTable (inspection reports)
- Vite build environment

The system digitalizes IQC and OQC inspection processes used in production quality control.

Main objectives:

- Replace Excel inspection sheets
- Standardize inspection execution
- Apply statistical validation (CPK)
- Apply sampling standards (NBR 5426)
- Ensure traceability per lot and inspector
- Generate professional inspection reports (PDF)

---

## 2. Inspection Types

The system supports:

### OQC — Outgoing Quality Control
Finished product inspection.

### IQC — Incoming Quality Control
Supplier material inspection.

Both types may use:

- Fixed sampling
- NBR 5426 sampling
- Customer-specific sampling

---

## 3. Architecture


src/
│
├── db/
│ └── oqcDb.js → IndexedDB schema (Dexie)
│
├── stores/
│ ├── plans.js → Inspection plan management
│ └── inspections.js → Inspection execution data
│
├── components/
│ ├── PlanModal.vue → Create/Edit inspection plans
│ └── InspModal.vue → Execute inspection
│
├── utils/
│ ├── pdf.js → PDF generation
│ └── sampling/
│ └── nbr5426.js → NBR 5426 sampling logic
│
└── views/
└── Inspections.vue → Inspection list & export


---

## 4. Data Model

### PLAN

Inspection definition template.

Fields:

- name
- model
- client
- supplier
- pn
- type (IQC/OQC)
- n (default samples)
- boxQty (visual box quantity)
- sampling configuration
- characteristics list

Characteristic types:

| Type | Description |
|------|-------------|
| variavel | Numeric measurement with CPK |
| visual_produto | OK/NG per sample |
| visual_caixa | OK/NG per box |

---

### INSPECTION

Snapshot created from a plan.

Stores:

- frozen characteristics
- frozen sampling values
- samples filled by inspector
- result (PASS/FAIL)
- timestamps

Important rule:

> Inspection data NEVER changes even if plan changes later.

---

## 5. Sampling System

Each plan defines sampling mode:

### Fixed Sampling
Uses plan.n directly.

### NBR 5426 Sampling
Calculated dynamically using:

- Lot Size
- Inspection Level
- AQL

System calculates:

- Code Letter
- Sample Size (n)
- Acceptance (Ac)
- Rejection (Re)

Sampling is frozen when inspection is created.

---

## 6. Result Logic

### Variable characteristics
- All samples required
- Values checked against LSL/USL
- CPK calculated live

### Visual characteristics
- OK / NG required for all samples
- Any NG → FAIL

### Final Result

| Condition | Result |
|-----------|--------|
| Any NG | FAIL |
| All OK | PASS |
| Missing data | BLOCK FINALIZATION |

---

## 7. PDF Report

Generated only for finalized inspections.

Contains:

- Neutral Quality System branding
- Inspection metadata
- Grouped tables:
  - Dimensional
  - Functional
  - Visual
- Statistics (Mean, StdDev, Cp, Cpk)
- Sample results

---

## 8. Current System Status (IMPLEMENTED)

✅ Plan creation  
✅ Inspection execution  
✅ Variable measurements + CPK  
✅ Visual OK/NG inspection  
✅ Visual box sampling  
✅ PDF professional report  
✅ CSV export  
✅ IndexedDB persistence  
✅ NBR 5426 dynamic sampling  
✅ Sampling snapshot freeze  

---

## 9. Next Planned Features (Roadmap)

### Phase 1 — User System
- Inspector login
- IQC/OQC permission separation
- Inspection ownership

### Phase 2 — Quality Intelligence
- Yield dashboard
- Supplier performance
- PPM tracking
- Trend analysis

### Phase 3 — Enterprise Features
- Cloud sync API
- Multi-device usage
- Audit trail
- Digital signatures

---

## 10. Design Principles

- Offline-first operation
- Immutable inspection records
- Plan version independence
- Quality-first validation
- Minimal inspector interaction
- Production-floor usability

---

## 11. Author Context

Developed as a reusable digital quality-management solution for manufacturing inspection processes.

Focus areas:

- Quality Engineering
- Process Digitalization
- Statistical Control
- Inspection Automation
- Manufacturing Traceability

---
