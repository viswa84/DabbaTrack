const { query } = require('../../db/client');

// Summarises counts for a given date to feed the dashboard cards.
// language=SQL
const DASHBOARD_COUNTS = `
  WITH todays_attendance AS (
    SELECT customer_id, status
    FROM attendance
    WHERE date = $1
  ),
  paused AS (
    SELECT customer_id
    FROM pause_windows
    WHERE $1::date BETWEEN start_date AND end_date
  )
  SELECT
    (SELECT COUNT(*) FROM customers WHERE status = 'ACTIVE') AS total_customers,
    (SELECT COUNT(*) FROM tiffin_plans WHERE status = 'ACTIVE') AS active_plans,
    (SELECT COUNT(*) FROM todays_attendance WHERE status IN ('PRESENT','ABSENT')) AS delivered_count,
    (SELECT COUNT(*) FROM todays_attendance WHERE status = 'SKIPPED') AS skipped_count,
    (SELECT COUNT(*) FROM paused) AS paused_count,
    (SELECT COUNT(*) FROM tiffin_plans WHERE last_payment_status != 'PAID' OR last_payment_status IS NULL) AS unpaid_count
`;

// Pulls opt-outs for the day to show the list under dashboard.
// language=SQL
const OPT_OUTS_FOR_DAY = `
  SELECT id, customer_id AS "customerId", date, slot, status, note, recorded_by AS "recordedBy"
  FROM attendance
  WHERE date = $1 AND status = 'SKIPPED'
  ORDER BY slot ASC, customer_id
`;

// Bills view: active plans with payment state for admin reconciliation.
// language=SQL
const BILLING_SUMMARY = `
  SELECT c.id AS "customerId", c.name AS "customerName",
         p.id AS "planId", p.billing_cycle AS "billingCycle", p.monthly_rate AS "monthlyRate",
         p.last_payment_status AS "lastPaymentStatus", p.last_payment_at AS "lastPaymentAt", p.start_date AS "startDate"
  FROM customers c
  JOIN tiffin_plans p ON p.customer_id = c.id AND p.status = 'ACTIVE'
  ORDER BY c.name
`;

// Monthly usage rollup to show boxes taken and skipped per subscriber.
// language=SQL
const MONTHLY_USAGE = `
  SELECT c.id AS "customerId", c.name AS "customerName",
         TO_CHAR($1::date, 'YYYY-MM') AS month,
         COALESCE(SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END), 0) AS boxes_taken,
         COALESCE(SUM(CASE WHEN a.status = 'SKIPPED' THEN 1 ELSE 0 END), 0) AS skipped,
         COALESCE(SUM(CASE WHEN pw.customer_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS paused
  FROM customers c
  LEFT JOIN attendance a ON a.customer_id = c.id AND DATE_TRUNC('month', a.date) = DATE_TRUNC('month', $1::date)
  LEFT JOIN pause_windows pw ON pw.customer_id = c.id AND $1::date BETWEEN pw.start_date AND pw.end_date
  GROUP BY c.id, c.name
  ORDER BY c.name
`;

// Monthly ledger for each customer with lunch/dinner counts and revenue math.
// language=SQL
const MONTHLY_CUSTOMER_LEDGER = `
  SELECT
    c.id AS "customerId",
    c.name AS "customerName",
    TO_CHAR(DATE_TRUNC('month', $1::date), 'YYYY-MM') AS month,
    COALESCE(SUM(CASE WHEN a.slot = 'LUNCH' AND a.status = 'PRESENT' THEN 1 ELSE 0 END), 0) AS lunch_count,
    COALESCE(SUM(CASE WHEN a.slot = 'DINNER' AND a.status = 'PRESENT' THEN 1 ELSE 0 END), 0) AS dinner_count,
    COALESCE(SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END), 0) AS total_taken,
    p.monthly_rate AS rate_per_tiffin
  FROM customers c
  LEFT JOIN attendance a
    ON a.customer_id = c.id
   AND DATE_TRUNC('month', a.date) = DATE_TRUNC('month', $1::date)
  LEFT JOIN tiffin_plans p
    ON p.customer_id = c.id
   AND p.status = 'ACTIVE'
  WHERE ($2::uuid IS NULL OR c.vendor_user_id = $2)
  GROUP BY c.id, c.name, p.monthly_rate
  ORDER BY c.name
`;

async function dashboardSummary(date) {
  const [counts, optOutsResult] = await Promise.all([
    query(DASHBOARD_COUNTS, [date]),
    query(OPT_OUTS_FOR_DAY, [date]),
  ]);

  const {
    total_customers: totalCustomers,
    active_plans: activePlans,
    delivered_count: deliveredCount,
    skipped_count: skippedCount,
    paused_count: pausedCount,
    unpaid_count: unpaidCount,
  } = counts.rows[0];

  const scheduledCount = deliveredCount + skippedCount;
  const alerts = [];
  if (unpaidCount > 0) {
    alerts.push(`${unpaidCount} customers have unpaid invoices.`);
  }
  if (pausedCount > 0) {
    alerts.push(`${pausedCount} customers are paused today.`);
  }

  return {
    date,
    totalCustomers: Number(totalCustomers) || 0,
    activePlans: Number(activePlans) || 0,
    scheduledCount: Number(scheduledCount) || 0,
    skippedCount: Number(skippedCount) || 0,
    deliveredCount: Number(deliveredCount) || 0,
    unpaidCount: Number(unpaidCount) || 0,
    pausedCount: Number(pausedCount) || 0,
    optOuts: optOutsResult.rows,
    alerts,
  };
}

async function billingSummary() {
  const { rows } = await query(BILLING_SUMMARY);
  return rows.map((row) => ({
    customer: {
      id: row.customerId,
      name: row.customerName,
    },
    plan: {
      id: row.planId,
      customerId: row.customerId,
      billingCycle: row.billingCycle,
      monthlyRate: row.monthlyRate,
      startDate: row.startDate,
      status: 'ACTIVE',
      lastPaymentStatus: row.lastPaymentStatus,
      lastPaymentAt: row.lastPaymentAt,
    },
    balanceDue: null,
    nextBillingDate: null,
  }));
}

async function monthlyUsage(month) {
  const { rows } = await query(MONTHLY_USAGE, [month]);
  return rows.map((row) => ({
    customer: { id: row.customerId, name: row.customerName },
    month: row.month,
    boxesTaken: Number(row.boxes_taken) || 0,
    skipped: Number(row.skipped) || 0,
    paused: Number(row.paused) || 0,
  }));
}

async function monthlyCustomerLedger({ month, vendorUserId }) {
  const { rows } = await query(MONTHLY_CUSTOMER_LEDGER, [month, vendorUserId || null]);
  return rows.map((row) => {
    const rate = Number(row.rate_per_tiffin) || 0;
    const totalTaken = Number(row.total_taken) || 0;
    return {
      customer: { id: row.customerId, name: row.customerName },
      month: row.month,
      lunchCount: Number(row.lunch_count) || 0,
      dinnerCount: Number(row.dinner_count) || 0,
      totalTaken,
      ratePerTiffin: rate,
      totalAmount: totalTaken * rate,
    };
  });
}

module.exports = { dashboardSummary, billingSummary, monthlyUsage, monthlyCustomerLedger };
