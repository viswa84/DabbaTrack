const { query } = require('../../db/client');

// Inserts or updates an active tiffin plan for a customer.
// language=SQL
const UPSERT_PLAN = `
  INSERT INTO tiffin_plans (customer_id, start_date, billing_cycle, monthly_rate, status)
  VALUES ($1, $2, $3, $4, 'ACTIVE')
  ON CONFLICT (customer_id)
  DO UPDATE SET billing_cycle = EXCLUDED.billing_cycle, monthly_rate = EXCLUDED.monthly_rate, start_date = EXCLUDED.start_date, status = 'ACTIVE'
  RETURNING id, customer_id AS "customerId", start_date AS "startDate", billing_cycle AS "billingCycle",
            monthly_rate AS "monthlyRate", status, last_payment_status AS "lastPaymentStatus", last_payment_at AS "lastPaymentAt"
`;

// Marks a manual payment for a customer's active plan.
// language=SQL
const MARK_PAYMENT = `
  UPDATE tiffin_plans
  SET last_payment_status = $2, last_payment_at = COALESCE($3, NOW())
  WHERE customer_id = $1 AND status = 'ACTIVE'
  RETURNING id, customer_id AS "customerId", start_date AS "startDate", billing_cycle AS "billingCycle",
            monthly_rate AS "monthlyRate", status, last_payment_status AS "lastPaymentStatus", last_payment_at AS "lastPaymentAt"
`;

// Pulls all active plans for billing and dashboard math.
// language=SQL
const LIST_ACTIVE_PLANS = `
  SELECT id, customer_id AS "customerId", start_date AS "startDate", billing_cycle AS "billingCycle",
         monthly_rate AS "monthlyRate", status, last_payment_status AS "lastPaymentStatus", last_payment_at AS "lastPaymentAt"
  FROM tiffin_plans
  WHERE status = 'ACTIVE'
`;

// Fetches a plan for a given customer id.
// language=SQL
const GET_PLAN_FOR_CUSTOMER = `
  SELECT id, customer_id AS "customerId", start_date AS "startDate", billing_cycle AS "billingCycle",
         monthly_rate AS "monthlyRate", status, last_payment_status AS "lastPaymentStatus", last_payment_at AS "lastPaymentAt"
  FROM tiffin_plans
  WHERE customer_id = $1 AND status = 'ACTIVE'
`;

async function upsertPlan({ customerId, monthlyRate, billingCycle, startDate }) {
  const { rows } = await query(UPSERT_PLAN, [customerId, startDate, billingCycle, monthlyRate]);
  return rows[0];
}

async function markPayment({ customerId, status, paidAt }) {
  const { rows } = await query(MARK_PAYMENT, [customerId, status, paidAt || null]);
  return rows[0];
}

async function listActivePlans() {
  const { rows } = await query(LIST_ACTIVE_PLANS);
  return rows;
}

async function getPlanForCustomer(customerId) {
  const { rows } = await query(GET_PLAN_FOR_CUSTOMER, [customerId]);
  return rows[0];
}

module.exports = {
  upsertPlan,
  markPayment,
  listActivePlans,
  getPlanForCustomer,
};
