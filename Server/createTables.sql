DROP TABLE IF EXISTS rents;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL ,                -- Full Name
  email TEXT ,                 -- Optional
  phone TEXT,                        -- Optional
  password TEXT NOT NULL,            -- Hashed password
  role TEXT NOT NULL CHECK(role IN ('owner', 'tenant')),
  owner_code TEXT UNIQUE,            -- For owners
  linked_owner_id INTEGER,           -- For tenants
  qr_image_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(linked_owner_id) REFERENCES users(id)
);

CREATE TABLE rents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  month TEXT NOT NULL,
  year INTEGER NOT NULL,
  rent REAL NOT NULL,
  prev_unit REAL NOT NULL,
  curr_unit REAL NOT NULL,
  electricity_rate REAL NOT NULL,
  water REAL NOT NULL,
  internet INTEGER NOT NULL,
  internet_amount REAL DEFAULT 0,
  waste REAL NOT NULL,
  total REAL NOT NULL,
  previous_rent REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  remaining_amount REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  owner_id INTEGER NOT NULL,
  message TEXT DEFAULT 'Rent payment completed',
  is_read BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id) REFERENCES users(id),
  FOREIGN KEY(owner_id) REFERENCES users(id)
);