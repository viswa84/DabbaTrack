const { query } = require('../../db/client');

// Returns attendance filtered by optional date, slot, and customer.
// language=SQL
const LIST_ATTENDANCE = `
  SELECT a.id, a.customer_id AS "customerId", a.date, a.slot, a.status, a.note, a.recorded_by AS "recordedBy"
  FROM attendance a
  WHERE ($1::date IS NULL OR a.date = $1)
    AND ($2::text IS NULL OR a.slot = $2)
    AND ($3::uuid IS NULL OR a.customer_id = $3)
  ORDER BY a.date DESC, a.slot ASC
`;

// Creates or replaces an attendance record for a customer/date/slot.
// language=SQL
const UPSERT_ATTENDANCE = `
  INSERT INTO attendance (customer_id, date, slot, status, note, recorded_by)
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (customer_id, date, slot)
  DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, recorded_by = EXCLUDED.recorded_by
  RETURNING id, customer_id AS "customerId", date, slot, status, note, recorded_by AS "recordedBy"
`;

// Returns the most recent attendance entries for a customer.
// language=SQL
const LATEST_ATTENDANCE_FOR_CUSTOMER = `
  SELECT id, customer_id AS "customerId", date, slot, status, note, recorded_by AS "recordedBy"
  FROM attendance
  WHERE customer_id = $1
  ORDER BY date DESC, slot DESC
  LIMIT 10
`;

async function listAttendance({ date, slot, customerId }) {
  const { rows } = await query(LIST_ATTENDANCE, [date || null, slot || null, customerId || null]);
  return rows;
}

async function upsertAttendance({ customerId, date, slot, status, note, recordedBy }) {
  const { rows } = await query(UPSERT_ATTENDANCE, [customerId, date, slot, status, note, recordedBy || null]);
  return rows[0];
}

async function latestForCustomer(customerId) {
  const { rows } = await query(LATEST_ATTENDANCE_FOR_CUSTOMER, [customerId]);
  return rows;
}

module.exports = {
  listAttendance,
  upsertAttendance,
  latestForCustomer,
};
