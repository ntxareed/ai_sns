let me=null;

async function login(){
  const r=await fetch("/login",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({username:user.value,password:pass.value})
  });
  if(!r.ok)return alert("失敗");
  init();
}

async function register(){
  await fetch("/register",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({username:user.value,password:pass.value})
  });
  alert("OK");
}

async function logout(){
  await fetch("/logout",{method:"POST"});
  location.reload();
}

async function init(){
  const r=await fetch("/me");
  me=await r.json();
  if(me){
    auth.style.display="none";
    app.style.display="block";
    loadHome();
  }
}

// ===== TL =====
async function loadHome(){
  const r=await fetch("/timeline");
  const d=await r.json();

  home.innerHTML = `
    <input id="postInput">
    <input type="file" id="fileInput">
    <button onclick="post()">投稿</button>
  ` + d.map(p=>`
    <div class="post">
      <img src="${p.icon||'https://placehold.co/30'}" width="30">
      <b onclick="openProfile(${p.user_id})">${p.username}</b><br>
      ${p.content}<br>
      ${p.image?`<img src="${p.image}" style="max-width:100%">`:''}
      ❤️${p.like_count}
      <button onclick="like(${p.id})">いいね</button>
      <button onclick="reply(${p.id})">返信</button>
      <div id="r-${p.id}"></div>
    </div>
  `).join("");

  setTimeout(()=>d.forEach(p=>loadReplies(p.id)),100);
}

// ===== 投稿 =====
async function post(replyTo=null){
  const form=new FormData();
  form.append("content",postInput.value);
  form.append("reply_to",replyTo||"");

  const file=fileInput.files[0];
  if(file) form.append("image",file);

  await fetch("/post",{method:"POST",body:form});

  postInput.value="";
  fileInput.value="";
  loadHome();
}

// ===== いいね =====
async function like(id){
  await fetch("/like",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({postId:id})
  });
  loadHome();
}

// ===== リプライ =====
async function reply(id){
  const text=prompt("返信");
  if(!text)return;

  await fetch("/post",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({content:text,reply_to:id})
  });

  loadReplies(id);
}

async function loadReplies(id){
  const r=await fetch("/replies/"+id);
  const d=await r.json();

  document.getElementById("r-"+id).innerHTML=
    d.map(x=>`<div style="margin-left:20px">${x.username}: ${x.content}</div>`).join("");
}

// ===== プロフィール =====
async function openProfile(id){
  const r=await fetch("/profile/"+id);
  const d=await r.json();

  home.innerHTML=`
    <img src="${d.user.icon||'https://placehold.co/80'}" width="80"><br>
    <h2>${d.user.username}</h2>
    ${d.user.bio}<br>

    <button onclick="follow(${d.user.id})">
      ${d.isFollowing?"解除":"フォロー"}
    </button>

    ${me.id==d.user.id?`
      <input id="bio" value="${d.user.bio}">
      <input id="icon" value="${d.user.icon}">
      <button onclick="saveProfile()">保存</button>
    `:""}

    <hr>

    ${d.posts.map(p=>`<div class="post">${p.content}</div>`).join("")}
  `;
}

async function saveProfile(){
  await fetch("/profile",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({bio:bio.value,icon:icon.value})
  });
  alert("保存");
  init();
}

async function follow(id){
  await fetch("/follow",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({userId:id})
  });
  openProfile(id);
}

init();