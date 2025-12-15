const { query } = require('../../db/client');

// Lists pause windows for a customer to display and enforce delivery skips.
// language=SQL
const LIST_BY_CUSTOMER = `
  SELECT id, customer_id AS "customerId", start_date AS "startDate", end_date AS "endDate", reason, created_by AS "createdBy"
  FROM pause_windows
  WHERE customer_id = $1
  ORDER BY start_date DESC
`;

// Inserts a new pause window.
// language=SQL
const INSERT_PAUSE = `
  INSERT INTO pause_windows (customer_id, start_date, end_date, reason, created_by)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING id, customer_id AS "customerId", start_date AS "startDate", end_date AS "endDate", reason, created_by AS "createdBy"
`;

// Checks whether a date is inside an approved pause window for a customer.
// language=SQL
const IS_PAUSED = `
  SELECT EXISTS (
    SELECT 1
    FROM pause_windows
    WHERE customer_id = $1 AND $2::date BETWEEN start_date AND end_date
  ) AS paused
`;

async function listByCustomer(customerId) {
  const { rows } = await query(LIST_BY_CUSTOMER, [customerId]);
  return rows;
}

async function createPauseWindow({ customerId, startDate, endDate, reason, createdBy }) {
  const { rows } = await query(INSERT_PAUSE, [customerId, startDate, endDate, reason, createdBy]);
  return rows[0];
}

async function isPausedOnDate({ customerId, date }) {
  const { rows } = await query(IS_PAUSED, [customerId, date]);
  return Boolean(rows[0]?.paused);
}

module.exports = {
  listByCustomer,
  createPauseWindow,
  isPausedOnDate,
};
