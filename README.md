# DabbaTrack

Backend GraphQL API starter for an Indian dabba (tiffin) service. It supports vendor/staff logins, customer attendance tracking, daily opt-outs, billing snapshots, and a roadmap for expanding into web/mobile apps.

## Tech stack
- **Runtime:** Node.js (Express 4) with Apollo Server (GraphQL)
- **Auth:** JWT (seeded users for quick testing)
- **Data layer:** In-memory store for rapid prototyping (swap with Postgres + Prisma or MongoDB later)
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

## GraphQL schema highlights
- **Queries**: `me`, `customers`, `customer`, `attendance`, `optOuts`, `dashboard(date)`, `billingSummary`
- **Mutations**: `login`, `createCustomer`, `recordAttendance`, `setOptOut`, `upsertPlan`, `markPayment`
- **Core entities**: `Customer`, `Attendance`, `TiffinPlan`, `DashboardSummary`

### Sample operations
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

Customer or staff opts out for a day/slot:
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

Vendor dashboard snapshot for a date:
```graphql
query Dashboard {
  dashboard(date: "2025-01-20") {
    date
    totalCustomers
    scheduledCount
    skippedCount
    deliveredCount
    unpaidCount
    alerts
    optOuts { customerId note }
  }
}
```

## Data model (in-memory)
- **Users**: seeded admin + dispatch; carries role for auth.
- **Customers**: name, contact, dietary notes, status (`ACTIVE`/`PAUSED`).
- **Attendance**: date + slot (LUNCH/DINNER) + status (`PRESENT`, `ABSENT`, `SKIPPED` for opt-outs).
- **TiffinPlan**: monthly rate, billing cycle, last payment status/at.

## Product roadmap & features
- **Day-to-day ops**: daily opt-out list, runner checklist per route, SMS/WhatsApp nudges, inventory (rotis/gravies count) derived from scheduledCount.
- **Customer self-service**: pause/resume window, one-click "no tiffin today" cutoff time, allergy/diet tags per weekday.
- **Billing**: monthly invoice PDF/email, pro-rated credits for skipped meals, UPI QR for one-time monthly payments.
- **Analytics**: churn flags (paused > 7 days), meal quality feedback, late delivery tracker (optional).
- **Hardening**: replace in-memory store with SQL + Prisma migrations, add refresh tokens, rate limiting, and observability (OpenTelemetry).

## Suggested app/brand names
- **DabbaTrack** (default in this repo)
- **TiffinTrail**
- **LunchLoop**

## Frontend & mobile structure (suggested)
- **Web**: Next.js or Remix with Apollo Client; role-based dashboard (owner vs. runner vs. customer).
- **Mobile**: React Native + Expo; offline queue for attendance and opt-outs when network drops.
- **UI primitives**: reusable cards for customer summary, attendance timeline, and a "Skip today" CTA for customers.

## Figma prompt to accelerate UI ideation
Copy/paste this into ChatGPT or Figma AI to generate wireframes:

> Design a responsive web & mobile dashboard for an Indian dabba/tiffin service called "DabbaTrack". Screens needed: (1) Owner dashboard with daily scheduled vs. skipped counts, opt-out list, unpaid accounts, and route checklist; (2) Customer self-service page to pause a day/slot and see monthly bill; (3) Runner view to mark delivered/absent per stop. Use a warm Indian lunchbox theme, highlight CTA "Skip today" and "Mark delivered", and include clear status chips for ACTIVE/PAUSED/DUE.

## Next steps (when you swap the store for a real DB)
1. Add Prisma + Postgres, model `User`, `Customer`, `Attendance`, `TiffinPlan`, and `Invoice`.
2. Replace in-memory resolvers with Prisma queries; add pagination for customer lists.
3. Add testing (Jest) and CI.
4. Containerize with Docker for deployment.

