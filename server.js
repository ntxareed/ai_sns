const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const multer = require("multer");

const app = express();
const db = new sqlite3.Database("db.sqlite");

// ===== 画像 =====
const storage = multer.diskStorage({
  destination: "public/uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// ===== middleware =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: "secret",
  resave: false,
  saveUninitialized: false
}));

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req,res)=>res.sendFile(path.join(__dirname,"public/index.html")));

// ===== DB =====
db.serialize(()=>{

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    bio TEXT DEFAULT '',
    icon TEXT DEFAULT ''
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    content TEXT,
    image TEXT,
    reply_to INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    post_id INTEGER,
    UNIQUE(user_id, post_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id INTEGER,
    following_id INTEGER,
    UNIQUE(follower_id, following_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    from_user INTEGER,
    type TEXT,
    post_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

});

// ===== AUTH =====
app.post("/register", async (req,res)=>{
  if(!req.body.username || !req.body.password)
    return res.status(400).send("NG");

  const hash = await bcrypt.hash(req.body.password,10);

  db.run("INSERT INTO users (username,password) VALUES (?,?)",
    [req.body.username, hash],
    err=> err ? res.status(400).send("NG") : res.send("OK"));
});

app.post("/login",(req,res)=>{
  db.get("SELECT * FROM users WHERE username=?",
    [req.body.username],
    async (err,user)=>{
      if(!user) return res.status(400).send("NG");
      if(!(await bcrypt.compare(req.body.password,user.password)))
        return res.status(400).send("NG");

      req.session.user = { id:user.id, username:user.username };
      res.send("OK");
    });
});

app.post("/logout",(req,res)=>req.session.destroy(()=>res.send("OK")));
app.get("/me",(req,res)=>res.json(req.session.user||null));

// ===== 投稿 =====
app.post("/post", upload.single("image"), (req,res)=>{
  if(!req.session.user) return res.sendStatus(403);

  const img = req.file ? "/uploads/"+req.file.filename : null;

  db.run(
    "INSERT INTO posts (user_id,content,image,reply_to) VALUES (?,?,?,?)",
    [
      req.session.user.id,
      req.body.content || "",
      img,
      req.body.reply_to || null
    ],
    function(){

      // リプライ通知
      if(req.body.reply_to){
        db.get("SELECT user_id FROM posts WHERE id=?",
        [req.body.reply_to],(e,post)=>{
          if(post && post.user_id !== req.session.user.id){
            db.run("INSERT INTO notifications (user_id,from_user,type,post_id) VALUES (?,?,?,?)",
              [post.user_id, req.session.user.id, "reply", req.body.reply_to]);
          }
        });
      }

      res.send("OK");
    }
  );
});

// ===== TL =====
app.get("/timeline",(req,res)=>{
  db.all(`
    SELECT posts.*, users.username, users.icon,
    (SELECT COUNT(*) FROM likes WHERE post_id=posts.id) as like_count
    FROM posts
    JOIN users ON posts.user_id = users.id
    WHERE reply_to IS NULL
    ORDER BY created_at DESC
  `,(err,rows)=>res.json(rows||[]));
});

// ===== リプライ =====
app.get("/replies/:id",(req,res)=>{
  db.all(`
    SELECT posts.*, users.username
    FROM posts
    JOIN users ON posts.user_id = users.id
    WHERE reply_to=?
    ORDER BY created_at ASC
  `,[req.params.id],(err,rows)=>res.json(rows||[]));
});

// ===== いいね =====
app.post("/like",(req,res)=>{
  const uid=req.session.user.id;
  const pid=req.body.postId;

  db.get("SELECT * FROM likes WHERE user_id=? AND post_id=?",
  [uid,pid],(err,row)=>{
    if(row){
      db.run("DELETE FROM likes WHERE user_id=? AND post_id=?",
      [uid,pid],()=>res.send("UNLIKE"));
    }else{
      db.run("INSERT INTO likes (user_id,post_id) VALUES (?,?)",
      [uid,pid],()=>{

        db.get("SELECT user_id FROM posts WHERE id=?",[pid],(e,post)=>{
          if(post && post.user_id !== uid){
            db.run("INSERT INTO notifications (user_id,from_user,type,post_id) VALUES (?,?,?,?)",
              [post.user_id, uid, "like", pid]);
          }
        });

        res.send("LIKE");
      });
    }
  });
});

// ===== フォロー =====
app.post("/follow",(req,res)=>{
  const uid=req.session.user.id;
  const target=req.body.userId;

  db.get("SELECT * FROM follows WHERE follower_id=? AND following_id=?",
  [uid,target],(err,row)=>{
    if(row){
      db.run("DELETE FROM follows WHERE follower_id=? AND following_id=?",
      [uid,target],()=>res.send("UNFOLLOW"));
    }else{
      db.run("INSERT INTO follows (follower_id,following_id) VALUES (?,?)",
      [uid,target],()=>{

        if(target != uid){
          db.run("INSERT INTO notifications (user_id,from_user,type) VALUES (?,?,?)",
            [target, uid, "follow"]);
        }

        res.send("FOLLOW");
      });
    }
  });
});

// ===== プロフィール =====
app.get("/profile/:id",(req,res)=>{
  const id=req.params.id;

  db.get("SELECT id,username,bio,icon FROM users WHERE id=?",
  [id],(err,user)=>{

    db.get("SELECT COUNT(*) as followers FROM follows WHERE following_id=?",
    [id],(e,f1)=>{

      db.get("SELECT COUNT(*) as following FROM follows WHERE follower_id=?",
      [id],(e,f2)=>{

        db.get("SELECT * FROM follows WHERE follower_id=? AND following_id=?",
        [req.session.user?.id,id],(e,rel)=>{

          db.all("SELECT * FROM posts WHERE user_id=? ORDER BY created_at DESC",
          [id],(e,posts)=>{

            res.json({
              user,
              followers:f1.followers,
              following:f2.following,
              isFollowing:!!rel,
              posts
            });

          });
        });
      });
    });
  });
});

app.post("/profile",(req,res)=>{
  if(!req.session.user) return res.sendStatus(403);

  db.run("UPDATE users SET bio=?, icon=? WHERE id=?",
    [req.body.bio, req.body.icon, req.session.user.id],
    ()=>res.send("OK"));
});

// ===== 通知 =====
app.get("/notifications",(req,res)=>{
  if(!req.session.user) return res.json([]);

  db.all(`
    SELECT notifications.*, users.username
    FROM notifications
    JOIN users ON notifications.from_user = users.id
    WHERE notifications.user_id=?
    ORDER BY notifications.created_at DESC
    LIMIT 30
  `,[req.session.user.id],(e,rows)=>res.json(rows||[]));
});

app.listen(process.env.PORT || 3000);