# MoranERP Implementation Checklist (Revised)

## Progress Tracking

**Start Date:** _____________  
**Target Completion:** 16 weeks from start  
**Current Phase:** _____________

---

## Phase 1: UI/UX Foundation & Design System (Weeks 1-2)

### Week 1: Design System Creation

#### Day 1-2: Design Tokens
- [ ] Create `design-tokens.css`
- [ ] Define color palette (light/dark)
- [ ] Define spacing scale (4px base)
- [ ] Define typography scale
- [ ] Define shadow system
- [ ] Define border radius tokens
- [ ] Define animation tokens
- [ ] Update Tailwind config

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 3-4: Core Component Library
- [ ] Create `stat-card.tsx`
- [ ] Create `empty-state.tsx`
- [ ] Create `page-header.tsx`
- [ ] Create `data-card.tsx`
- [ ] Create `responsive-table.tsx`
- [ ] Create `notification-item.tsx`
- [ ] Create `activity-feed.tsx`
- [ ] Update Button variants
- [ ] Document components

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 5: Layout System
- [ ] Create `page-layout.tsx`
- [ ] Create `content-area.tsx`
- [ ] Create `responsive-sidebar.tsx`
- [ ] Create `sticky-header.tsx`
- [ ] Create `mobile-sheet.tsx`

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

### Week 2: Mobile-First Responsive

#### Day 1-2: Navigation Overhaul
- [ ] Redesign mobile bottom navigation
- [ ] Create slide-out mobile menu
- [ ] Add swipe navigation gestures
- [ ] Implement breadcrumb navigation
- [ ] Add FAB for primary actions
- [ ] Create context-aware navigation

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 3-4: Touch-Optimized Data Display
- [ ] Create mobile card view for tables
- [ ] Implement list virtualization
- [ ] Add horizontal scroll indicators
- [ ] Create responsive data grids
- [ ] Add pull-to-refresh
- [ ] Add swipe actions on list items

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 5: Touch Optimization
- [ ] Increase touch targets to 44x44px
- [ ] Add touch feedback animations
- [ ] Implement haptic feedback hooks
- [ ] Add gesture hints
- [ ] Test on real devices

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

---

## Phase 2: Core Functionality, Routes & Tenant Context (Weeks 3-5)

### Week 3: Route & Tenant Context

#### Day 1-2: Backend Route Fixes
- [ ] Create route mapping document
- [ ] Fix `/api/accounting/journal-entries` route
- [ ] Fix `/api/hr/leave-applications` route
- [ ] Fix `/api/projects/templates` route
- [ ] Standardize tenant-scoped routes
- [ ] Create route constants

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 3-4: Frontend Tenant Context
- [ ] Create `useTenantContext` hook
- [ ] Update all API calls with tenant context
- [ ] Update all navigation links
- [ ] Add tenant context validation
- [ ] Create tenant context provider
- [ ] Update all page components

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 5: Backend Tenant Middleware
- [ ] Create tenant context middleware
- [ ] Add tenant validation to all routes
- [ ] Add tenant ID logging for audit
- [ ] Create tenant context decorator

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

### Week 4: POS & Purchase Fixes

#### Day 1-2: POS Product Visibility
- [ ] Remove hardcoded zero-stock filter
- [ ] Add `show_zero_stock_in_pos` setting
- [ ] Add `disabled=0` filter to backend
- [ ] Add POS Profile item group filtering
- [ ] Create stock indicator component
- [ ] Add "Out of Stock" badge

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 3-4: Purchase Receipt Flow
- [ ] Add `submit_purchase_receipt` to base
- [ ] Implement in ERPNextPurchaseService
- [ ] Create submit endpoint
- [ ] Fix `purchase_order_id` mapping
- [ ] Create receipt submission UI
- [ ] Test full purchase flow

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 5: Paint Module Fix
- [ ] Add Stock Entry in `/paint/sell`
- [ ] Deduct base paint on sale
- [ ] Deduct tint components
- [ ] Add stock validation
- [ ] Add DELETE endpoints
- [ ] Add PUT formula endpoint

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

### Week 5: Code Deduplication

#### Day 1-2: Backend CRUD Factory
- [ ] Create generic CRUD router factory
- [ ] Implement for module routers
- [ ] Extract permission utilities
- [ ] Extract tenant utilities

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 3-5: Frontend Generic Module
- [ ] Create `ModulePage` component
- [ ] Create `use-module-crud` hook
- [ ] Create generic CRUD API client
- [ ] Refactor CRM page
- [ ] Refactor HR page
- [ ] Refactor Projects page
- [ ] Refactor Manufacturing page
- [ ] Refactor remaining pages

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

---

## Phase 3: Pricing Engine, Cash Management & Tax (Weeks 6-8)

### Week 6: Pricing Engine

#### Day 1-2: Pricing Data Models
- [ ] Create `PricingTier` model
- [ ] Create `ItemPrice` model
- [ ] Create `BatchPricing` model
- [ ] Create `PricingSettings` model
- [ ] Run migrations

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 3-4: Pricing Service
- [ ] Create `PricingService` class
- [ ] Implement buying price tracking
- [ ] Implement batch-aware pricing
- [ ] Implement selling price calculation
- [ ] Implement percentile pricing (90th)
- [ ] Implement margin calculations

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 5: Pricing UI
- [ ] Create pricing endpoints
- [ ] Create price setting UI
- [ ] Create price suggestion display
- [ ] Add bulk price update
- [ ] Test pricing flows

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

### Week 7: Cash Management

#### Day 1-2: Cash Tracking Models
- [ ] Create `POSSession` model (extended)
- [ ] Create `CashMovement` model
- [ ] Create `CashDiscrepancy` model
- [ ] Create `DenominationCount` model
- [ ] Run migrations

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 3-4: Cash Service
- [ ] Create `CashManagementService`
- [ ] Implement session opening
- [ ] Implement cash movement tracking
- [ ] Implement session closing
- [ ] Implement discrepancy logging
- [ ] Create manager notifications

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 5: Cash Management UI
- [ ] Create session opening dialog
- [ ] Create denomination count input
- [ ] Create cash drawer status
- [ ] Create cash in/out recording
- [ ] Create session closing wizard
- [ ] Create discrepancy acknowledgment
- [ ] Create manager review dashboard

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

### Week 8: Tax Compliance

#### Day 1-2: Tax Models
- [ ] Create `TaxType` model
- [ ] Create `TaxTemplate` model
- [ ] Create `TaxTemplateItem` model
- [ ] Create `TaxTransaction` model
- [ ] Run migrations

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 3-4: Tax Service
- [ ] Create `TaxService` class
- [ ] Implement tax calculation (sales)
- [ ] Implement tax calculation (purchases)
- [ ] Implement corporate tax
- [ ] Implement withholding tax
- [ ] Create CoA linkage

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 5: Tax UI & Reports
- [ ] Create tax configuration UI
- [ ] Create tax template management
- [ ] Add tax selection to invoices
- [ ] Create VAT report
- [ ] Create tax liability report
- [ ] Create tax filing helper

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

---

## Phase 4: Dashboard & UI Modernization (Weeks 9-11)

### Week 9: Global Dashboard (Social Feed)

#### Day 1-2: Feed Architecture
- [ ] Create `GlobalFeed.tsx`
- [ ] Create `FeedItem.tsx`
- [ ] Create `SaleFeedItem.tsx`
- [ ] Create `AlertFeedItem.tsx`
- [ ] Create `SummaryFeedItem.tsx`
- [ ] Create `TenantQuickAccess.tsx`

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 3-4: Notification System
- [ ] Create notification model
- [ ] Create notification service
- [ ] Implement real-time notifications
- [ ] Create notification preferences
- [ ] Create notification center UI

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 5: Global Dashboard Polish
- [ ] Add infinite scroll
- [ ] Add real-time updates
- [ ] Add quick actions from feed
- [ ] Add feed filtering
- [ ] Add tenant quick-switch

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

### Week 10: Tenant Dashboard

#### Day 1-2: Dashboard Layout
- [ ] Create desktop layout
- [ ] Create mobile layout
- [ ] Create responsive grid

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 3-4: Dashboard Components
- [ ] Create `TenantDashboard.tsx`
- [ ] Create `MetricCard.tsx` with trends
- [ ] Create `QuickActions.tsx`
- [ ] Create `RecentSales.tsx`
- [ ] Create `PendingTasks.tsx`
- [ ] Create `LowStockAlert.tsx`
- [ ] Create `SalesTrendChart.tsx`

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 5: Dashboard Data
- [ ] Create dashboard API endpoint
- [ ] Implement data aggregation
- [ ] Add caching
- [ ] Add real-time updates
- [ ] Add date range selector

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

### Week 11: POS & Page Redesign

#### Day 1-3: POS Interface
- [ ] Create mobile-first POS layout
- [ ] Implement product grid virtualization
- [ ] Create bottom sheet cart
- [ ] Add category quick filters
- [ ] Implement barcode scanner
- [ ] Create payment method selection
- [ ] Add customer quick-add
- [ ] Create receipt generation

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 4-5: Forms & Settings
- [ ] Create form wizard component
- [ ] Create multi-step forms
- [ ] Create tabbed settings
- [ ] Add visual toggles
- [ ] Create preview for changes

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

---

## Phase 5: Offline Sync, Testing & Performance (Weeks 12-14)

### Week 12: Offline Sync System

#### Day 1-2: Offline Models
- [ ] Create `OfflineTransaction` model
- [ ] Create `SyncConflict` model
- [ ] Create `SyncException` model
- [ ] Run migrations

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 3-4: Sync Service
- [ ] Create `OfflineSyncService`
- [ ] Implement conflict detection
- [ ] Implement reconciliation
- [ ] Create exception handling
- [ ] Add integrity verification

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 5: Offline UI
- [ ] Create sync status dashboard
- [ ] Create conflict resolution UI
- [ ] Create exception list view
- [ ] Add exception assignment
- [ ] Create reconciliation report

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

### Week 13: Testing Infrastructure

#### Day 1-2: Frontend Testing
- [ ] Configure Jest + RTL
- [ ] Create test utilities
- [ ] Write component tests
- [ ] Write hook tests
- [ ] Set up snapshots

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 3-4: Backend Testing
- [ ] Add pricing service tests
- [ ] Add cash management tests
- [ ] Add tax service tests
- [ ] Add offline sync tests
- [ ] Add integration tests

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 5: CI/CD Pipeline
- [ ] Create GitHub Actions workflow
- [ ] Add test automation
- [ ] Add lint checks
- [ ] Add build verification
- [ ] Add deployment automation

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

### Week 14: Performance Optimization

#### Day 1-2: Database
- [ ] Add connection pooling
- [ ] Add missing indexes
- [ ] Optimize N+1 queries
- [ ] Add query caching

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 3-4: Frontend
- [ ] Implement virtualization everywhere
- [ ] Add code splitting
- [ ] Optimize bundle size
- [ ] Add image optimization
- [ ] Implement lazy loading

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 5: API
- [ ] Add response caching
- [ ] Implement pagination
- [ ] Add request batching
- [ ] Optimize payloads

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

---

## Phase 6: Security, i18n & Final Polish (Weeks 15-16)

### Week 15: Security Hardening

#### Day 1-2: Authentication
- [ ] Remove hardcoded SECRET_KEY
- [ ] Remove hardcoded passwords
- [ ] Add env validation
- [ ] Move JWT to HttpOnly cookies
- [ ] Add secure cookie flags
- [ ] Implement token refresh

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 3-4: Rate Limiting & Validation
- [ ] Install slowapi
- [ ] Configure rate limits
- [ ] Fix SQL injection
- [ ] Add MIME validation
- [ ] Sanitize HTML

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 5: Error Handling & Audit
- [ ] Create error sanitization
- [ ] Remove stack traces
- [ ] Implement structured errors
- [ ] Add audit logging

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

### Week 16: i18n & Final Polish

#### Day 1-2: i18n Setup
- [ ] Install next-intl
- [ ] Create translation structure
- [ ] Set up language detection
- [ ] Create language switcher
- [ ] Extract hardcoded strings

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 3-4: Monitoring
- [ ] Configure Prometheus
- [ ] Create Grafana dashboards
- [ ] Set up alerting
- [ ] Add Sentry integration

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

#### Day 5: Final Polish & Launch
- [ ] Animation polish
- [ ] Loading state consistency
- [ ] Error message review
- [ ] Final responsive testing
- [ ] Performance audit
- [ ] Security audit
- [ ] Documentation review
- [ ] Deployment checklist
- [ ] Final sign-off

**Assigned to:** _____________ **Status:** ⬜ Not Started / 🟡 In Progress / ✅ Done

---

## Summary Statistics

| Phase | Total Tasks | Completed | In Progress | Not Started |
|-------|-------------|-----------|-------------|-------------|
| Phase 1: UI Foundation | 30 | 0 | 0 | 30 |
| Phase 2: Core & Routes | 40 | 0 | 0 | 40 |
| Phase 3: Pricing & Cash | 45 | 0 | 0 | 45 |
| Phase 4: Dashboards | 40 | 0 | 0 | 40 |
| Phase 5: Offline & Testing | 35 | 0 | 0 | 35 |
| Phase 6: Security & Polish | 30 | 0 | 0 | 30 |
| **Total** | **220** | **0** | **0** | **220** |

---

## Key Deliverables Checklist

### Phase 1 Deliverables
- [ ] Design system CSS file complete
- [ ] 10+ new UI components
- [ ] Mobile navigation redesigned
- [ ] Touch optimization complete

### Phase 2 Deliverables
- [ ] All routes consistent
- [ ] Tenant context enforced everywhere
- [ ] POS products visible correctly
- [ ] Purchase→Inventory flow working

### Phase 3 Deliverables
- [ ] Batch pricing implemented
- [ ] Selling price with percentile
- [ ] Cash reconciliation working
- [ ] Discrepancy logging active
- [ ] Multi-tax support live

### Phase 4 Deliverables
- [ ] Social feed dashboard live
- [ ] Tenant dashboard functional
- [ ] POS redesigned (mobile-first)
- [ ] Forms modernized

### Phase 5 Deliverables
- [ ] Offline sync with reconciliation
- [ ] Exception table for manual review
- [ ] Test coverage >80%
- [ ] CI/CD pipeline active

### Phase 6 Deliverables
- [ ] Security vulnerabilities fixed
- [ ] i18n framework active
- [ ] Monitoring dashboards live
- [ ] Production ready

---

## Weekly Status Updates

### Week 1 - UI Foundation Start
**Date:** _____________  
**Completed:** _____________  
**In Progress:** _____________  
**Blockers:** _____________  
**Next Steps:** _____________

### Week 2 - Mobile Responsive
**Date:** _____________  
**Completed:** _____________  
**In Progress:** _____________  
**Blockers:** _____________  
**Next Steps:** _____________

*(Continue for all 16 weeks...)*

---

## Risk Log

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|------------|--------|------------|--------|
| R1 | Scope creep | Medium | High | Strict phase boundaries | Open |
| R2 | Resource availability | Medium | High | Cross-training | Open |
| R3 | Breaking changes | Low | High | Feature flags | Open |
| R4 | Offline data conflicts | Medium | Medium | Exception table | Open |
| R5 | Performance regression | Low | Medium | CI performance tests | Open |

---

## Sign-Off

### Phase Completion Sign-Off

| Phase | Completed By | Date | Approved By | Date |
|-------|--------------|------|-------------|------|
| Phase 1 | | | | |
| Phase 2 | | | | |
| Phase 3 | | | | |
| Phase 4 | | | | |
| Phase 5 | | | | |
| Phase 6 | | | | |

### Final Sign-Off

**Project Completed:** _____________  
**Final Review Date:** _____________  
**Approved By:** _____________

---

*Last Updated: _____________*
