const bcrypt = require('bcryptjs');
const { query } = require('../../db/client');

const USER_COLUMNS = `
  id,
  name,
  email,
  phone,
  role,
  description,
  serves_lunch AS "handlesLunch",
  serves_dinner AS "handlesDinner"
`;

// Finds a user by email for login and profile hydration.
// language=SQL
const FIND_USER_BY_EMAIL = `
  SELECT ${USER_COLUMNS}, password_hash
  FROM users
  WHERE email = $1
`;

// Fetches a user by id for JWT hydration.
// language=SQL
const FIND_USER_BY_ID = `
  SELECT ${USER_COLUMNS}
  FROM users
  WHERE id = $1
`;

// Creates a new user with a salted password hash.
// language=SQL
const INSERT_USER = `
  INSERT INTO users (name, email, phone, role, password_hash, description, serves_lunch, serves_dinner)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING ${USER_COLUMNS}
`;

async function findByEmail(email) {
  const { rows } = await query(FIND_USER_BY_EMAIL, [email]);
  return rows[0];
}

async function findById(id) {
  const { rows } = await query(FIND_USER_BY_ID, [id]);
  return rows[0];
}

async function createUser({
  name,
  email,
  phone,
  role = 'DISPATCH',
  password,
  description,
  handlesLunch = false,
  handlesDinner = false,
}) {
  if (!password) {
    throw new Error('Password required for user creation');
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const params = [
    name,
    email,
    phone,
    role,
    passwordHash,
    description || null,
    handlesLunch,
    handlesDinner,
  ];
  const { rows } = await query(INSERT_USER, params);
  return rows[0];
}

async function updateUser(id, fields) {
  const updates = [];
  const values = [];
  let index = 1;

  const setField = (column, value) => {
    updates.push(`${column} = $${index}`);
    values.push(value);
    index += 1;
  };

  if (fields.name !== undefined) setField('name', fields.name);
  if (fields.email !== undefined) setField('email', fields.email);
  if (fields.phone !== undefined) setField('phone', fields.phone);
  if (fields.role !== undefined) setField('role', fields.role);
  if (fields.description !== undefined) setField('description', fields.description);
  if (fields.handlesLunch !== undefined) setField('serves_lunch', fields.handlesLunch);
  if (fields.handlesDinner !== undefined) setField('serves_dinner', fields.handlesDinner);

  if (fields.password) {
    const passwordHash = await bcrypt.hash(fields.password, 10);
    setField('password_hash', passwordHash);
  }

  if (updates.length === 0) {
    throw new Error('No fields provided for update');
  }

  const sql = `
    UPDATE users
    SET ${updates.join(', ')}
    WHERE id = $${index}
    RETURNING ${USER_COLUMNS}
  `;
  values.push(id);
  const { rows } = await query(sql, values);
  return rows[0];
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  updateUser,
};
