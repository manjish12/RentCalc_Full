// server.js
const express = require("express");
const Database = require('better-sqlite3');
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;  // use Render's port if available
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


// Middleware
app.use(cors());
app.use(cors({ origin: 'https://your-frontend.vercel.app' }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (for QR images)
const uploadDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use("/uploads", express.static(uploadDir));

// Initialize DB and recreate tables on every startup (for development)
const dbPath = path.join(__dirname, 'rentcalc.db');
const db = new Database(dbPath);



// Recreate tables with full schema

  // Only create tables if they don't exist — DO NOT DROP
 db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner', 'tenant')),
    owner_code TEXT UNIQUE,
    linked_owner_id INTEGER,
    qr_image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(linked_owner_id) REFERENCES users(id)
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS rents (
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
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    message TEXT DEFAULT 'Rent payment completed',
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tenant_id) REFERENCES users(id),
    FOREIGN KEY(owner_id) REFERENCES users(id)
  )
`).run();



// Helper: generate 6-digit code
const generateOwnerCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// ======================
// USER ROUTES
// ======================

// GET users by owner ID
app.get("/api/users", (req, res) => {
  const ownerId = req.query.ownerId;
  if (ownerId) {
    db.all(`
      SELECT * FROM users WHERE role = 'tenant' AND linked_owner_id = ?
    `, [ownerId], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  } else {
    // Default: Fetch all users (for tenant view or admin)
    db.all(`SELECT * FROM users ORDER BY name`, [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }
});



// POST /api/users (Registration)
app.post("/api/users", async (req, res) => {
  const { name, email, phone, password, role, ownerCode } = req.body;

  // Validation
  if (!name || !email || !password || !role || !['owner', 'tenant'].includes(role)) {
    return res.status(400).json({ error: "Name, email, password, and role are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    if (role === 'owner') {
      let code = generateOwnerCode();
      let attempts = 0;
      const tryInsert = () => {
        db.get("SELECT 1 FROM users WHERE owner_code = ?", [code], (err, row) => {
          if (err) return res.status(500).json({ error: err.message });
          if (row && attempts < 10) {
            attempts++;
            code = generateOwnerCode();
            return tryInsert();
          }
          if (row) return res.status(500).json({ error: "Code gen failed" });

          db.run(
            `INSERT INTO users (name, email, phone, password, role, owner_code) VALUES (?, ?, ?, ?, ?, ?)`,
            [name, email, phone || null, hashedPassword, 'owner', code],
            function (err) {
              if (err) {
                if (err.message.includes('UNIQUE constraint failed: users.email')) {
                  return res.status(400).json({ error: "Email already exists" });
                }
                return res.status(500).json({ error: err.message });
              }
              res.json({ 
                id: this.lastID, 
                name, 
                role: 'owner', 
                owner_code: code 
              });
            }
          );
        });
      };
      tryInsert();
    } else {
      if (!ownerCode) return res.status(400).json({ error: "Owner code required" });
      db.get("SELECT id FROM users WHERE role = 'owner' AND owner_code = ?", [ownerCode], (err, owner) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!owner) return res.status(400).json({ error: "Invalid owner code" });

        db.run(
          `INSERT INTO users (name, email, phone, password, role, linked_owner_id) VALUES (?, ?, ?, ?, ?, ?)`,
          [name, email, phone || null, hashedPassword, 'tenant', owner.id],
          function (err) {
            if (err) {
              if (err.message.includes('UNIQUE constraint failed: users.email')) {
                return res.status(400).json({ error: "Email already exists" });
              }
              return res.status(500).json({ error: err.message });
            }
            res.json({ 
              id: this.lastID, 
              name, 
              role: 'tenant', 
              linked_owner_id: owner.id 
            });
          }
        );
      });
    }
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(400).json({ error: "Invalid email or password" });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(400).json({ error: "Invalid email or password" });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });
});

app.delete("/api/users/:id", (req, res) => {
  const userId = req.params.id;
  db.run(`DELETE FROM rents WHERE user_id = ?`, [userId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run(`DELETE FROM users WHERE id = ?`, [userId], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ deleted: true });
    });
  });
});

// ======================
// RENT ROUTES (FULL CRUD)
// ======================

app.get("/api/rents", (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "userId required" });

  const query = `
    SELECT * FROM rents 
    WHERE user_id = ?
    ORDER BY 
      year DESC,
      CASE month
        WHEN 'Baisakh' THEN 0 WHEN 'Jestha' THEN 1 WHEN 'Ashadh' THEN 2
        WHEN 'Shrawan' THEN 3 WHEN 'Bhadra' THEN 4 WHEN 'Ashwin' THEN 5
        WHEN 'Kartik' THEN 6 WHEN 'Mangsir' THEN 7 WHEN 'Poush' THEN 8
        WHEN 'Magh' THEN 9 WHEN 'Falgun' THEN 10 WHEN 'Chaitra' THEN 11
        ELSE 12
      END ASC
  `;

  db.all(query, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/rents", (req, res) => {
  const {
    user_id,
    month,
    year,
    rent,
    prev_unit,
    curr_unit,
    electricity_rate,
    water,
    internet,
    internet_amount,
    waste,
    total,
    payment_status,
    paid_amount,
    remaining_amount,
  } = req.body;

  if (
    !user_id || !month || !year || rent == null || prev_unit == null ||
    curr_unit == null || electricity_rate == null || water == null ||
    internet == null || waste == null || total == null
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const internetNum = internet ? 1 : 0;
  const internetAmt = internet_amount || 0;

  db.run(`
    INSERT INTO rents (
      user_id, month, year, rent, prev_unit, curr_unit, electricity_rate,
      water, internet, internet_amount, waste, total, payment_status, 
      paid_amount, remaining_amount
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    user_id, month, year, rent, prev_unit, curr_unit, electricity_rate,
    water, internetNum, internetAmt, waste, total, 
    payment_status || "unpaid", paid_amount || 0, remaining_amount || 0
  ], function (err) {
    if (err) {
      console.error("Insert error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, message: "Rent entry added successfully" });
  });
});

app.put("/api/rents/:id", (req, res) => {
  const rentId = req.params.id;
  const {
    user_id,
    month,
    year,
    rent,
    prev_unit,
    curr_unit,
    electricity_rate,
    water,
    internet,
    internet_amount,
    waste,
    total,
    payment_status,
    paid_amount,
    remaining_amount,
  } = req.body;

  if (
    !user_id || !month || !year || rent == null || prev_unit == null ||
    curr_unit == null || electricity_rate == null || water == null ||
    internet == null || waste == null || total == null
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const internetNum = internet ? 1 : 0;
  const internetAmt = internet_amount || 0;

  db.run(`
    UPDATE rents SET
      user_id = ?, month = ?, year = ?, rent = ?, prev_unit = ?, curr_unit = ?,
      electricity_rate = ?, water = ?, internet = ?, internet_amount = ?,
      waste = ?, total = ?, payment_status = ?, paid_amount = ?, remaining_amount = ?
    WHERE id = ?
  `, [
    user_id, month, year, rent, prev_unit, curr_unit, electricity_rate,
    water, internetNum, internetAmt, waste, total,
    payment_status || "unpaid", paid_amount || 0, remaining_amount || 0,
    rentId
  ], function (err) {
    if (err) {
      console.error("Update error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ changes: this.changes });
  });
});

app.delete("/api/rents/:id", (req, res) => {
  const rentId = req.params.id;
  db.run(`DELETE FROM rents WHERE id = ?`, [rentId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// ======================
// QR & NOTIFICATION ROUTES
// ======================

app.get("/api/qr/:userId", (req, res) => {
  db.get("SELECT qr_image_url FROM users WHERE id = ?", [req.params.userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ qr_image_url: row?.qr_image_url || null });
  });
});

app.post("/api/qr/:userId", (req, res) => {
  const { imageBase64 } = req.body;
  const userId = req.params.userId;

  if (!imageBase64) return res.status(400).json({ error: "Image required" });

  const fileName = `qr_${userId}.png`;
  const filePath = path.join(uploadDir, fileName);

  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
    const qrUrl = `http://localhost:5000/uploads/${fileName}`;
    db.run("UPDATE users SET qr_image_url = ? WHERE id = ?", [qrUrl, userId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ qr_image_url: qrUrl });
    });
  } catch (err) {
    res.status(500).json({ error: "Save failed" });
  }
});

app.post("/api/notify", (req, res) => {
  
  const { tenantId, message = "Rent payment completed" } = req.body; // ← accept message
  db.get("SELECT linked_owner_id FROM users WHERE id = ? AND role = 'tenant'", [tenantId], (err, user) => {
    if (err || !user) return res.status(400).json({ error: "Invalid tenant" });
    
    db.run(
          `INSERT INTO notifications (tenant_id, owner_id, message) VALUES (?, ?, ?)`,
    [tenantId, user.linked_owner_id, message], // ← use provided message
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  });
});
// GET notifications for an owner
app.get("/api/notifications/:ownerId", (req, res) => {
  const ownerId = req.params.ownerId;
  db.all(`
    SELECT 
      n.id,
      n.tenant_id,
      n.message,
      n.is_read,
      n.created_at,
      u.name as tenant_name
    FROM notifications n
    JOIN users u ON n.tenant_id = u.id
    WHERE n.owner_id = ?
    ORDER BY n.created_at DESC
  `, [ownerId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// DELETE notification
app.delete("/api/notifications/:id", (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM notifications WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: true });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});