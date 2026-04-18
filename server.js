const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");

const app = express();
const db = new sqlite3.Database("db.sqlite");

// ===== ミドルウェア =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: false,
}));

app.use(express.static(path.join(__dirname, "public")));

// ===== ルート =====
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===== DB =====
db.serialize(() => {

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id INTEGER,
    following_id INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    post_id INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user INTEGER,
    to_user INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS timetable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    day TEXT,
    period INTEGER,
    subject TEXT
  )`);

});

// ===== AUTH =====
app.post("/register", async (req, res) => {
  try {
    if (!req.body.username || !req.body.password)
      return res.status(400).send("入力不足");

    const hash = await bcrypt.hash(req.body.password, 10);

    db.run("INSERT INTO users (username,password) VALUES (?,?)",
      [req.body.username, hash],
      function(err) {
        if (err) return res.status(400).send("ユーザー名重複");
        res.send("OK");
      });
  } catch {
    res.status(500).send("error");
  }
});

app.post("/login", (req, res) => {
  db.get("SELECT * FROM users WHERE username=?", [req.body.username], async (err, user) => {
    if (!user) return res.status(400).send("ユーザーなし");

    const ok = await bcrypt.compare(req.body.password, user.password);
    if (!ok) return res.status(400).send("パス違い");

    req.session.user = { id: user.id, username: user.username };
    res.send("OK");
  });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.send("OK"));
});

app.get("/me", (req, res) => {
  res.json(req.session.user || null);
});

// ===== 投稿 =====
app.post("/post", (req, res) => {
  if (!req.session.user) return res.sendStatus(403);

  db.run("INSERT INTO posts (user_id,content) VALUES (?,?)",
    [req.session.user.id, req.body.content || ""],
    () => res.send("OK"));
});

// ===== タイムライン =====
app.get("/timeline", (req, res) => {
  if (!req.session.user) return res.json([]);

  db.all(`
    SELECT posts.*, users.username,
    (SELECT COUNT(*) FROM likes WHERE post_id=posts.id) as like_count
    FROM posts
    JOIN users ON posts.user_id = users.id
    WHERE posts.user_id = ?
       OR posts.user_id IN (
         SELECT following_id FROM follows WHERE follower_id = ?
       )
    ORDER BY posts.created_at DESC
  `, [req.session.user.id, req.session.user.id],
  (err, rows) => res.json(rows || []));
});

// ===== フォロー =====
app.post("/follow", (req, res) => {
  if (!req.session.user) return res.sendStatus(403);

  db.run("INSERT INTO follows (follower_id,following_id) VALUES (?,?)",
    [req.session.user.id, req.body.userId],
    () => res.send("OK"));
});

// ===== いいね =====
app.post("/like", (req, res) => {
  if (!req.session.user) return res.sendStatus(403);

  db.run("INSERT INTO likes (user_id,post_id) VALUES (?,?)",
    [req.session.user.id, req.body.postId],
    () => res.send("OK"));
});

// ===== DM =====
app.post("/message", (req, res) => {
  if (!req.session.user) return res.sendStatus(403);

  db.run("INSERT INTO messages (from_user,to_user,content) VALUES (?,?,?)",
    [req.session.user.id, req.body.to, req.body.content || ""],
    () => res.send("OK"));
});

app.get("/messages/:id", (req, res) => {
  if (!req.session.user) return res.json([]);

  db.all(`
    SELECT * FROM messages
    WHERE (from_user=? AND to_user=?)
       OR (from_user=? AND to_user=?)
    ORDER BY created_at
  `, [req.session.user.id, req.params.id, req.params.id, req.session.user.id],
  (err, rows) => res.json(rows || []));
});

// ===== 時間割 =====
app.get("/timetable", (req, res) => {
  if (!req.session.user) return res.json([]);

  db.all("SELECT * FROM timetable WHERE user_id=?",
    [req.session.user.id],
    (err, rows) => res.json(rows || []));
});

app.post("/timetable", (req, res) => {
  if (!req.session.user) return res.sendStatus(403);

  db.run("DELETE FROM timetable WHERE user_id=?", [req.session.user.id], () => {

    const stmt = db.prepare(
      "INSERT INTO timetable (user_id,day,period,subject) VALUES (?,?,?,?)"
    );

    (req.body.data || []).forEach(d => {
      stmt.run(req.session.user.id, d.day, d.period, d.subject);
    });

    stmt.finalize();
    res.send("OK");
  });
});

// ===== 起動 =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));