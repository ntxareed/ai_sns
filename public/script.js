let me=null;

async function login(){
  const r=await fetch("/login",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({username:user.value,password:pass.value})
  });
  if(!r.ok)return alert(await r.text());
  init();
}

async function register(){
  const r=await fetch("/register",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({username:user.value,password:pass.value})
  });
  alert(await r.text());
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
    loadTimetable();
  }
}

async function loadHome(){
  const r=await fetch("/timeline");
  const d=await r.json();

  home.innerHTML = `
    <input id="postInput" placeholder="投稿">
    <button onclick="post()">投稿</button>
  ` + d.map(p=>`
    <div class="post">
      <b>${p.username}</b><br>
      ${p.content}<br>
      ❤️${p.like_count}
      <button onclick="like(${p.id})">いいね</button>
      <button onclick="follow(${p.user_id})">フォロー</button>
    </div>
  `).join("");
}

async function post(){
  await fetch("/post",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({content:postInput.value})
  });
  loadHome();
}

async function like(id){
  await fetch("/like",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({postId:id})
  });
  loadHome();
}

async function follow(id){
  await fetch("/follow",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({userId:id})
  });
}

function showHome(){
  home.style.display="block";
  dm.style.display="none";
}

function showDM(){
  home.style.display="none";
  dm.style.display="block";
}

async function sendDM(){
  await fetch("/message",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({to:dmUser.value,content:dmInput.value})
  });
  loadDM();
}

async function loadDM(){
  const r=await fetch("/messages/"+dmUser.value);
  const d=await r.json();
  dmBox.innerHTML=d.map(m=>`<div>${m.from_user}:${m.content}</div>`).join("");
}

async function loadTimetable(){
  const r=await fetch("/timetable");
  const d=await r.json();

  const days=["月","火","水","木","金"];
  timetable.innerHTML = days.map(day=>{
    let html=`<b>${day}</b><br>`;
    for(let i=1;i<=6;i++){
      const f=d.find(x=>x.day===day&&x.period===i);
      html+=`<input data-day="${day}" data-period="${i}" value="${f?f.subject:""}"><br>`;
    }
    return html;
  }).join("");
}

async function saveTimetable(){
  const inputs=timetable.querySelectorAll("input");
  let data=[];
  inputs.forEach(i=>{
    if(i.value) data.push({
      day:i.dataset.day,
      period:Number(i.dataset.period),
      subject:i.value
    });
  });

  await fetch("/timetable",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({data})
  });
  alert("保存");
}

init();