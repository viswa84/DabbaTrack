# DabbaTrack

Backend GraphQL API starter for an Indian dabba (tiffin) service. It now captures daily skip/pause flows, cutoff checks, dashboard snapshots, and monthly usage with a roadmap for a full Postgres/Prisma stack.

## Tech stack
- **Runtime:** Node.js (Express 4) with Apollo Server (GraphQL)
- **Auth:** JWT (seeded users for quick testing)
- **Data layer:** In-memory store for rapid prototyping (swap with PostgreSQL + Prisma in production)
- **Dev tooling:** Nodemon for local hot-reload

## Quick start
1. Install dependencies (already done in this repo):
   ```bash
   npm install
   ```
2. Run the API:
   ```bash
   npm run dev
   # or: npm start
   ```
3. Open the GraphQL Playground at `http://localhost:4000/graphql`.

### Seeded accounts
- Admin: `boss@dabbatrack.in` / `admin123`
- Dispatch runner: `runner@dabbatrack.in` / `runfast`

## Complete feature list
**MVP**
- Customer records with plan + contact + dietary notes
- JWT login for admin/runner; customer self-serve can be added via OTP later
- Daily attendance capture (present/absent), opt-out for a specific slot, and pause windows
- Same-day skip cutoff (10:00 AM) enforced on `setOptOut`
- Dashboard for a given date: total customers, scheduled vs skipped vs paused, delivered, unpaid alerts, opt-out list
- Monthly usage per customer (boxes taken, skipped, paused slots) for billing sanity
- Manual payment marking per customer/plan

**Future**
- OTP login for customers, refresh tokens, and device binding
- Route/area tagging for runners; offline queue in mobile app
- Auto-pro-rating of invoices for skipped/paused slots; PDF/UPI links
- Feedback/rating per meal, allergy calendar, weekday menu variations
- Multi-mess marketplace view so customers can browse other vendors nearby
- Web push/WhatsApp reminders before cutoff; SLA alerts for late deliveries (optional)

## Database schema (PostgreSQL + Prisma target)
- **User**: id (uuid), name, email (unique), phone, role (ADMIN/DISPATCH/CUSTOMER), passwordHash, createdAt
- **Customer**: id, userId (nullable for customer login), name, phone, email, address, dietaryNotes, status (ACTIVE/PAUSED/STOPPED), createdAt
- **TiffinPlan**: id, customerId, startDate, billingCycle (MONTHLY/QUARTERLY), monthlyRate, mealsPerDay (1/2), status, lastPaymentStatus, lastPaymentAt
- **Attendance**: id, customerId, date, slot (LUNCH/DINNER), status (PRESENT/ABSENT/SKIPPED), note, recordedBy
- **PauseWindow**: id, customerId, startDate, endDate, reason, createdBy
- **Invoice**: id, customerId, month, amount, status (DUE/PAID/PARTIAL), issuedAt, paidAt, adjustments

## GraphQL schema (current prototype)
Types: `User`, `Customer`, `Attendance`, `TiffinPlan`, `PauseWindow`, `DashboardSummary`, `BillingSummary`, `CustomerUsage`

Queries:
- `me`
- `customers(status)`
- `customer(id)`
- `attendance(date, slot, customerId)`
- `optOuts(date, slot)`
- `dashboard(date)`
- `billingSummary`
- `monthlyUsage(month)`

Mutations:
- `login(email, password)`
- `createCustomer(input)`
- `recordAttendance(input)`
- `setOptOut(input)` — enforces 10:00 AM same-day cutoff
- `setPauseWindow(input)`
- `upsertPlan(input)`
- `markPayment(input)`

## Backend folder structure
```
src/
├── auth.js        # JWT helpers (createToken + middleware context helper)
├── data/
│   └── store.js   # In-memory users/customers/plans/attendance/pause data + helper functions
├── schema.js      # GraphQL schema + resolvers + dashboard/monthly usage calculators
└── server.js      # Express bootstrap + Apollo Server wiring
```

## Frontend (React Native Expo + Apollo) screen & navigation map
- **Auth stack**: Login (email+password or OTP), Forgot/OTP verify
- **Owner/Runner tabs**: Dashboard, Customers list & detail, Attendance (today), Billing, Settings
- **Customer tabs**: Home (today’s status + Skip Today CTA), Calendar (pause date range), Billing (monthly summary, pay button), Profile
- Navigation: Root stack → Tab navigator (role-based) → Detail stacks (Customer detail, Invoice detail)

## Roadmap (MVP → production)
1. **MVP**: Solidify schema, hook Prisma to Postgres, implement auth, attendance, opt-out, pause, billing mark-paid; ship RN app with cutoff-aware Skip Today.
2. **Beta hardening**: Add pagination + filtering, add invoice generation, integrate OTP auth, add background sync/offline queue in mobile, add CI tests.
3. **Growth**: Multi-mess marketplace, referral + coupon system, per-area routing, analytics dashboards, observability + rate limits.
4. **Production**: Docker/K8s deploy, backups, alerting, logging, Sentry, load tests.

## Admin dashboard layout
- **Top cards**: Scheduled vs Skipped vs Paused vs Delivered (today), unpaid customers, alerts
- **Skip list**: Table of customers who opted out or are paused (reason, slot, timestamp, recordedBy)
- **Runner prep**: Count of boxes/rotis/veg per slot, grouped by route
- **Billing**: Unpaid list with lastPaymentAt and monthlyRate; CTA to mark paid
- **Usage panel**: Monthly boxes taken per customer; download CSV for billing

## Edge cases to cover
- Same-day skip after cutoff → block and surface contact CTA
- Overlapping pause windows → merge/validate when moving to DB
- Plan types (1 vs 2 meals/day) → adjust counts and pricing per slot
- Month boundary (pause spanning months) → pro-rate boxes and invoices
- Manual overrides: admin can mark attendance absent/present even if paused (with audit log later)

## Testing & deployment checklist
- Unit: resolver logic for cutoff, pause merge, monthly usage math
- Integration: auth guard + role checks, dashboard counts
- E2E (API): Skip Today, Pause Range, markPaid flows
- Security: JWT expiry/refresh, password hashing, rate limits
- Deployment: env vars for DB + JWT secret, migrations (Prisma), PM2/Node service or Docker, health checks, backups, monitoring

## Suggested app/brand names
- **DabbaTrack** (default in this repo)
- **TiffinTrail**
- **LunchLoop**
- **PunePeti**
- **MessMeter**

## Revenue ideas
- Monthly SaaS for mess owners (per active customer or per kitchen)
- Add-on fees for invoicing/UPI collection tooling
- Featured placement for partner messes when marketplace launches
- Analytics upsell (cohort churn, skip patterns) for larger kitchens

## Sample operations
Login and reuse the JWT in the `Authorization: Bearer <token>` header.

```graphql
mutation Login {
  login(email: "boss@dabbatrack.in", password: "admin123") {
    token
    user { id name role }
  }
}
```

Create a customer (admin only):
```graphql
mutation CreateCustomer {
  createCustomer(input: {
    name: "Shreya Iyer"
    phone: "+91-98765-00000"
    address: "Andheri East"
    dietaryNotes: "Less oil"
  }) {
    id
    name
    status
  }
}
```

Customer or staff opts out for a day/slot (blocks after cutoff if same-day):
```graphql
mutation SkipTiffin {
  setOptOut(input: {
    customerId: "cust-200"
    date: "2025-01-20"
    slot: DINNER
    reason: "Out of town"
  }) {
    id
    date
    slot
    status
    note
  }
}
```

Pause for a range of dates:
```graphql
mutation PauseRange {
  setPauseWindow(input: {
    customerId: "cust-300"
    startDate: "2025-02-01"
    endDate: "2025-02-05"
    reason: "Vacation"
  }) {
    id
    startDate
    endDate
    reason
  }
}
```

Vendor dashboard snapshot for a date:
```graphql
query Dashboard {
  dashboard(date: "2025-01-20") {
    date
    totalCustomers
    scheduledCount
    skippedCount
    pausedCount
    deliveredCount
    unpaidCount
    alerts
    optOuts { customerId note }
  }
}
```

Monthly usage for billing sanity:
```graphql
query Usage {
  monthlyUsage(month: "2025-01") {
    customer { id name }
    boxesTaken
    skipped
    paused
  }
}
```

## Next steps (when you swap the store for a real DB)
1. Add Prisma + Postgres models and migrations for all tables above.
2. Replace in-memory resolvers with Prisma queries; add pagination for customer lists.
3. Add testing (Jest) and CI.
4. Containerize with Docker for deployment.
