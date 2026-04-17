async function login() {
  await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user.value, password: pass.value })
  });
  check();
}

async function register() {
  await fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user.value, password: pass.value })
  });
  alert("登録完了");
}

async function check() {
  const res = await fetch("/me");
  const user = await res.json();

  if (user) {
    auth.style.display = "none";
    app.style.display = "block";
    loadPosts();
  }
}

async function post() {
  await fetch("/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: content.value, className: document.getElementById("class").value })
  });
  content.value = "";
  loadPosts();
}

async function loadPosts() {
  const cls = document.getElementById("classFilter").value;
  const res = await fetch("/posts?class=" + cls);
  const data = await res.json();

  posts.innerHTML = data.map(p => `
    <div class="post">
      <b>${p.username}</b><br>
      ${p.content}
    </div>
  `).join("");
}

check();