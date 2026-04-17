const path = require("path");
const express = require("express");
const app = express();

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (!user) return res.status(400).send("ユーザーなし");

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).send("パスワード違う");

    req.session.user = user;
    res.send("OK");
  });
});

app.get("/me", (req, res) => {
  if (!req.session.user) return res.json(null);
  res.json(req.session.user);
});

// ===== 投稿 =====
app.post("/post", (req, res) => {
  if (!req.session.user) return res.sendStatus(403);

  const { content, className } = req.body;

  db.run(
    "INSERT INTO posts (user_id, content, class) VALUES (?, ?, ?)",
    [req.session.user.id, content, className],
    () => res.send("OK")
  );
});

app.get("/posts", (req, res) => {
  const classFilter = req.query.class;

  let query = `SELECT posts.*, users.username FROM posts
               JOIN users ON posts.user_id = users.id`;

  if (classFilter && classFilter !== "all") {
    query += ` WHERE class = '${classFilter}'`;
  }

  query += " ORDER BY created_at DESC LIMIT 50";

  db.all(query, [], (err, rows) => {
    res.json(rows);
  });
});

// ===== 起動 =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
