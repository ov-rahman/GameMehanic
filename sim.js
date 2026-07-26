/* ============================================================
   GAME FEEL LAB — мини-движок превью
   Каждое превью это НАСТОЯЩАЯ симуляция физики, а не анимация.
   Слева — как ведёт себя игра БЕЗ механики, справа — С механикой.
   Ввод (нажатия) в обеих панелях абсолютно одинаковый.
   ============================================================ */
(function(global){
"use strict";

const V = { W:100, H:50, P:5, G:260, JV:78 };   // виртуальные единицы
const FLIGHT = 2*V.JV/V.G;                       // время полёта прыжка (0.6с)
const DIST   = vx => vx*FLIGHT;                  // дальность прыжка

/* ---------------- физика ---------------- */
function newState(w){
  return { t:0, x:w.start[0], y:w.start[1], vx:w.vx||0, vy:0,
    gr:true, coy:0, buf:0, aj:w.airJumps||0, hold:false, pressT:-9, btnAuto:0, dead:false,
    fired:0, wall:0, lastJump:-9, trail:[], presses:[], arcs:[], cur:null, done:0 };
}
function jump(s){
  s.vy=-V.JV; s.gr=false; s.coy=0; s.fired++; s.lastJump=s.t;
  s.cur={ x0:s.x, top:s.y };                       // для отметки высоты
}
function press(s,w,f){
  s.presses.push(s.t);
  s.hold=true; s.pressT=s.t;          // кнопка зажата — видно ВСЕГДА, даже если прыжка не будет
  if(s.gr || (f.coyote && s.coy>0)) jump(s);
  else if(f.djump && s.aj>0){ s.aj--; jump(s); }
  else if(f.wall && s.wall){ const d=s.wall; jump(s); s.vx=-d*24; s.wall=0; }
  else if(f.buffer) s.buf=0.16;                    // запомнили раннее нажатие
}
function release(s,f){
  s.hold=false;
  if(f.vary && s.vy<0) s.vy*=0.38;                 // обрезаем прыжок
}
const hit=(ax,ay,aw,ah,bx,by,bw,bh)=> ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by;

function step(s,w,f,dt){
  s.t+=dt;
  if(s.dead){ s.y+=s.vy*dt; s.vy+=V.G*dt; return; }

  let g=V.G;
  if(f.apex && Math.abs(s.vy)<20) g*=0.42;         // зависание на пике
  if(f.fastfall && s.vy>0) g*=2.2;                 // быстрое падение
  if(!s.gr) s.vy += g*dt;

  /* --- горизонталь + стены --- */
  s.x += s.vx*dt;
  for(const b of (w.blocks||[])){
    if(hit(s.x,s.y,V.P,V.P,b[0],b[2],b[1]-b[0],b[3]-b[2])){
      if(s.vx>0) s.x=b[0]-V.P; else if(s.vx<0) s.x=b[1];
      s.vx=0;
    }
  }
  // контакт со стеной: проба сбоку — держится и когда скорость уже нулевая
  const prevWall=s.wall; s.wall=0;
  for(const b of (w.blocks||[])){
    const vo=(s.y+V.P>b[2]+0.3)&&(s.y<b[3]-0.3);
    if(!vo) continue;
    if(Math.abs(s.x-b[1])<0.7) s.wall=-1;             // стена слева
    if(Math.abs((s.x+V.P)-b[0])<0.7) s.wall=1;        // стена справа
  }
  if(s.wall && !prevWall) s.wallTouch=s.t;          // момент зацепа
  if(f.wall && !s.gr && s.wall && s.vy>6) s.vy=6;    // цепляется и медленно сползает

  /* --- вертикаль --- */
  const prevBot=s.y+V.P;
  s.y += s.vy*dt;
  s.gr=false;

  if(s.vy<0){                                       // удар головой о потолок
    for(const b of (w.blocks||[])){
      if(hit(s.x,s.y,V.P,V.P,b[0],b[2],b[1]-b[0],b[3]-b[2]) && s.y>b[2] && s.y<b[3]){
        const ovR=(s.x+V.P)-b[0], ovL=b[1]-s.x;     // насколько зашли углом
        if(f.corner && ovR>0 && ovR<2.7){ s.x-=ovR+0.15; s.cornerFix=s.t; }      // подтолкнули мимо
        else if(f.corner && ovL>0 && ovL<2.7){ s.x+=ovL+0.15; s.cornerFix=s.t; }
        else { s.y=b[3]; s.vy=0; s.bonk=s.t; }      // иначе — стоп
      }
    }
  } else {                                          // приземление
    const pad = f.hitbox ? 2.0 : 0;                 // прощение края
    for(const p of (w.plats||[])){
      if(s.x+V.P>p[0]-pad && s.x<p[1]+pad && prevBot<=p[2]+0.8 && s.y+V.P>=p[2]){
        s.y=p[2]-V.P; s.vy=0; s.gr=true;
        if(s.cur){ s.arcs.push(s.cur); s.cur=null; }
        if(f.buffer && s.buf>0){ s.buf=0; jump(s); } // сработал буфер
        break;
      }
    }
  }

  if(s.gr){ s.coy=0.13; s.aj=w.airJumps||0; }
  else if(s.coy>0) s.coy=Math.max(0,s.coy-dt);
  if(s.buf>0) s.buf=Math.max(0,s.buf-dt);
  if(s.cur) s.cur.top=Math.min(s.cur.top,s.y);

  if(s.btnAuto && s.t>=s.btnAuto){ s.hold=false; s.btnAuto=0; }
  if(!s.gr && s.vy>0) s.fallT=(s.fallT||0)+dt;      // сколько падал
  if(!s.gr && Math.abs(s.vy)<20) s.apexT=(s.apexT||0)+dt; // сколько держался у пика
  if(s.y > (w.deathY!==undefined ? w.deathY : V.H+4)) s.dead=true;   // упал в пропасть

  s.trail.push({x:s.x,y:s.y,h:s.hold});
  if(s.trail.length>26) s.trail.shift();
  if(w.bot) w.bot(s,w,f,press,release);
}

/* ---------------- отрисовка ---------------- */
const CSS={ line:'#ffffff', dim:'rgba(255,255,255,.16)', acc:'#3dff9e', bad:'#ff5c5c' };

// равномерный масштаб: куб всегда квадратный, камера следит за действием
function viewOf(pw,ph){ const sc=ph/V.H; return {sc, visW:pw/sc}; }

function drawPane(c, px, py, pw, ph, w, s, f, label, opt){
  const sc=opt.sc, cam=opt.cam, camY=opt.camY||0;
  const X=v=>px+(v-cam)*sc, Y=v=>py+(v-camY)*sc;

  c.save(); c.beginPath(); c.rect(px,py,pw,ph); c.clip();

  for(const b of (w.blocks||[])){
    c.fillStyle='rgba(255,255,255,.05)'; c.fillRect(X(b[0]),Y(b[2]),(b[1]-b[0])*sc,(b[3]-b[2])*sc);
    c.strokeStyle=CSS.line; c.lineWidth=1.5; c.beginPath();
    c.moveTo(X(b[0]),Y(b[3])); c.lineTo(X(b[1]),Y(b[3])); c.stroke();
  }
  // насечки на стенах — по ним видно, что куб реально поднимается
  if(w.wallTicks){
    c.strokeStyle='rgba(255,255,255,.32)'; c.lineWidth=1.4;
    const y0=Math.floor((camY-14)/13)*13;
    for(let yy=y0; yy<camY+V.H+14; yy+=13){
      for(const b of (w.blocks||[])){
        const left=b[1]<50, inner=left?b[1]:b[0], dir=left?-1:1;
        c.beginPath(); c.moveTo(X(inner),Y(yy)); c.lineTo(X(inner+dir*6),Y(yy)); c.stroke();
      }
    }
  }
  for(const p of (w.plats||[])){
    c.fillStyle='rgba(255,255,255,.035)'; c.fillRect(X(p[0]),Y(p[2]),(p[1]-p[0])*sc,ph);
    c.strokeStyle=CSS.line; c.lineWidth=2; c.shadowColor='rgba(255,255,255,.5)'; c.shadowBlur=5;
    c.beginPath(); c.moveTo(X(p[0]),Y(p[2])+.5); c.lineTo(X(p[1]),Y(p[2])+.5); c.stroke(); c.shadowBlur=0;
    if(f.hitbox){                                   // зона прощения края
      c.strokeStyle=CSS.acc; c.lineWidth=2; c.setLineDash([4,3]);
      c.beginPath();
      c.moveTo(X(p[0]-2.0),Y(p[2])+.5); c.lineTo(X(p[0]),Y(p[2])+.5);
      c.moveTo(X(p[1]),Y(p[2])+.5);     c.lineTo(X(p[1]+2.0),Y(p[2])+.5);
      c.stroke(); c.setLineDash([]);
    }
  }
  // тень как в оригинальной игре: пол пропадает прямо под кубом
  const shx=s.x+V.P/2;
  let shy=null;
  for(const p of (w.plats||[])){
    if(shx>=p[0]-2.5 && shx<=p[1]+2.5 && p[2]>=s.y+V.P-0.6){ if(shy===null||p[2]<shy) shy=p[2]; }
  }
  if(shy!==null){
    c.fillStyle='#050505';
    c.beginPath(); c.arc(X(shx), Y(shy), V.P*0.82*sc, 0, Math.PI*2); c.fill();
  }

  // отметки высоты прыжков
  for(const a of s.arcs.concat(s.cur?[s.cur]:[])){
    c.strokeStyle= opt.on?'rgba(61,255,158,.5)':'rgba(255,255,255,.35)';
    c.lineWidth=1; c.setLineDash([3,3]);
    c.beginPath(); c.moveTo(X(a.x0-2),Y(a.top)+.5); c.lineTo(X(a.x0+14),Y(a.top)+.5); c.stroke();
    c.setLineDash([]);
  }
  // шлейф
  for(let i=0;i<s.trail.length;i++){
    const t=s.trail[i], al=(i/s.trail.length)*0.20;
    c.strokeStyle='rgba(255,255,255,'+al.toFixed(3)+')'; c.lineWidth=1;
    c.strokeRect(X(t.x)+.5,Y(t.y)+.5,V.P*sc-1,V.P*sc-1);
  }
  // куб (квадрат). Зажата кнопка -> залит белым, как в самой игре
  const cx=X(s.x), cy=Y(s.y), cs=V.P*sc;
  c.shadowColor= s.dead?'rgba(255,92,92,.8)':'rgba(255,255,255,.9)'; c.shadowBlur=s.hold?18:7;
  if(s.hold){ c.fillStyle='#fff'; c.fillRect(cx,cy,cs,cs); }
  else{ c.strokeStyle= s.dead?CSS.bad:'#fff'; c.lineWidth=2; c.strokeRect(cx+1,cy+1,cs-2,cs-2); }
  c.shadowBlur=0;
  // куб цепляется за стену — подсвечиваем сторону контакта
  if(f.wall && s.wall && !s.gr){
    c.strokeStyle=CSS.acc; c.lineWidth=3; c.shadowColor=CSS.acc; c.shadowBlur=8;
    const gx = s.wall<0 ? cx : cx+cs;
    c.beginPath(); c.moveTo(gx, cy+2); c.lineTo(gx, cy+cs-2); c.stroke(); c.shadowBlur=0;
  }
  // вспышка ровно в момент нажатия
  const age=s.t-s.pressT;
  if(age>=0 && age<0.34){
    const k=age/0.34, pad=cs*(0.15+0.55*k);
    c.strokeStyle='rgba(61,255,158,'+(0.95*(1-k)).toFixed(3)+')'; c.lineWidth=2;
    c.strokeRect(cx-pad, cy-pad, cs+pad*2, cs+pad*2);
    if(k<0.75){
      c.font='9px "Pixelify Sans",monospace'; c.textAlign='center'; c.textBaseline='bottom';
      c.fillStyle='rgba(61,255,158,'+(1-k).toFixed(3)+')';
      c.fillText('КЛИК', cx+cs/2, cy-pad-3);
      c.textAlign='left'; c.textBaseline='top';
    }
  }
  // индикатор окна койота / буфера
  const bar=(val,max)=>{ c.fillStyle='rgba(61,255,158,.22)'; c.fillRect(cx,cy-8,cs,3);
                         c.fillStyle=CSS.acc; c.fillRect(cx,cy-8,cs*(val/max),3); };
  if(f.coyote && s.coy>0 && !s.gr) bar(s.coy,0.13);
  if(f.buffer && s.buf>0) bar(s.buf,0.16);

  c.font='10px "Pixelify Sans",monospace'; c.textBaseline='top';
  c.fillStyle= opt.on ? 'rgba(61,255,158,.95)' : 'rgba(255,255,255,.5)';
  c.fillText(label, px+9, py+8);

  // вердикт — внизу, не мешает подписи
  if(opt.verdict){
    c.font='11px "Pixelify Sans",monospace'; c.textBaseline='bottom';
    c.fillStyle = opt.verdict.ok ? CSS.acc : CSS.bad;
    c.fillText(opt.verdict.text, px+9, py+ph-20);
  }
  // лента нажатий
  const by=py+ph-9;
  c.fillStyle='rgba(255,255,255,.10)'; c.fillRect(px+9,by,pw-18,2);
  c.fillStyle='rgba(255,255,255,.3)';  c.fillRect(px+9,by,(pw-18)*Math.min(1,s.t/w.dur),2);
  for(const t of s.presses) c.fillRect(px+9+(pw-18)*(t/w.dur)-1, by-4, 2.5, 10);
  c.fillStyle=CSS.acc;
  for(const t of s.presses) c.fillRect(px+9+(pw-18)*(t/w.dur)-1, by-4, 2.5, 10);

  c.restore();
  c.strokeStyle='rgba(255,255,255,.14)'; c.lineWidth=1; c.strokeRect(px+.5,py+.5,pw-1,ph-1);
}

/* ---------------- камера (особая сцена) ---------------- */
function cameraSim(c,px,py,pw,ph,st,dt,look){
  st.t+=dt;
  const WORLD=210, DEAD=13, LOOK=11, SMOOTH=3.2, GY=36;
  const sc=ph/V.H, visW=pw/sc;
  st.x = 105 + Math.sin(st.t*0.55)*70;                        // игрок ездит туда-сюда
  const vx = Math.cos(st.t*0.55)*70*0.55;
  const aim = st.x + (look ? Math.max(-1,Math.min(1,vx/26))*LOOK : 0); // упреждение
  const center = st.cam + visW/2;
  let want = st.cam;
  if(aim>center+DEAD) want = aim-(visW/2+DEAD);
  else if(aim<center-DEAD) want = aim-(visW/2-DEAD);
  st.cam += (want-st.cam)*Math.min(1,SMOOTH*dt);
  st.cam = Math.max(0,Math.min(WORLD-visW,st.cam));

  const X=v=>px+(v-st.cam)*sc, Y=v=>py+v*sc;
  c.save(); c.beginPath(); c.rect(px,py,pw,ph); c.clip();
  c.strokeStyle=CSS.line; c.lineWidth=2; c.shadowColor='rgba(255,255,255,.5)'; c.shadowBlur=5;
  c.beginPath(); c.moveTo(X(0),Y(GY)+.5); c.lineTo(X(WORLD),Y(GY)+.5); c.stroke(); c.shadowBlur=0;
  c.strokeStyle='rgba(255,255,255,.32)'; c.lineWidth=1.4;
  for(let m=10;m<WORLD;m+=14){ c.beginPath(); c.moveTo(X(m),Y(GY)); c.lineTo(X(m),Y(GY-4)); c.stroke(); }
  // мёртвая зона — в экранных координатах
  c.strokeStyle='rgba(61,255,158,.6)'; c.setLineDash([5,4]); c.lineWidth=1.4;
  c.strokeRect(px+pw/2-DEAD*sc, py+22, DEAD*2*sc, ph-52); c.setLineDash([]);
  c.font='9px "Pixelify Sans",monospace'; c.textBaseline='top';
  c.fillStyle='rgba(61,255,158,.85)';
  c.fillText('МЁРТВАЯ ЗОНА — ЗДЕСЬ КАМЕРА СТОИТ', px+pw/2-DEAD*sc, py+9);
  // тень под игроком (как в игре)
  c.fillStyle='#050505';
  c.beginPath(); c.arc(X(st.x+V.P/2), Y(GY), V.P*0.82*sc, 0, Math.PI*2); c.fill();
  // игрок
  c.shadowColor='rgba(255,255,255,.85)'; c.shadowBlur=7; c.strokeStyle='#fff'; c.lineWidth=2;
  c.strokeRect(X(st.x)+1, Y(GY-V.P)+1, V.P*sc-2, V.P*sc-2); c.shadowBlur=0;
  if(look){                                     // линия и точка упреждения
    c.strokeStyle='rgba(61,255,158,.85)'; c.lineWidth=1.6; c.beginPath();
    c.moveTo(X(st.x+V.P/2),Y(GY-V.P/2)); c.lineTo(X(aim),Y(GY-V.P/2)); c.stroke();
    c.beginPath(); c.arc(X(aim),Y(GY-V.P/2),3,0,7); c.fillStyle=CSS.acc; c.fill();
  }
  c.font='10px "Pixelify Sans",monospace'; c.textBaseline='bottom';
  c.fillStyle='rgba(61,255,158,.9)';
  c.fillText(look?'ТОЧКА — КУДА СМОТРИТ КАМЕРА (УПРЕЖДЕНИЕ)':'КАМЕРА ЕДЕТ, ТОЛЬКО КОГДА ИГРОК ВЫШЕЛ ЗА РАМКУ', px+9, py+ph-10);
  c.restore();
  c.strokeStyle='rgba(255,255,255,.14)'; c.lineWidth=1; c.strokeRect(px+.5,py+.5,pw-1,ph-1);
}

/* ---------------- сцены ---------------- */
const GY=36, TOP=GY-V.P;
const SCENES = {
  // ЧАСТЬ I — невидимые механики (A/B)
  vary:{ ab:1, flag:'vary', labels:['БЕЗ МЕХАНИКИ','С МЕХАНИКОЙ'],
    world:{ plats:[[0,100,GY]], start:[8,TOP], vx:13, dur:3.6,
      script:[[0.45,'p'],[0.52,'r'],[1.9,'p'],[2.6,'r']] },
    hint:'Одинаковые два нажатия: первое короткое, второе долгое.' },

  coyote:{ ab:1, flag:'coyote', labels:['БЕЗ МЕХАНИКИ','С МЕХАНИКОЙ'],
    world:{ plats:[[0,46,GY],[59,100,GY]], start:[10,TOP], vx:26, dur:3.0,
      script:[[1.49,'p'],[1.95,'r']] },
    hint:'Нажатие на 0.10 сек ПОЗЖЕ схода с края.' },

  buffer:{ ab:1, flag:'buffer', labels:['БЕЗ МЕХАНИКИ','С МЕХАНИКОЙ'],
    world:{ plats:[[0,100,GY]], start:[16,TOP], vx:15, dur:3.2,
      script:[[0.4,'p'],[0.55,'r'],[0.88,'p'],[1.18,'r']] },
    hint:'Второе нажатие на 0.12 сек РАНЬШЕ приземления.' },

  hitbox:{ ab:1, flag:'hitbox', labels:['БЕЗ МЕХАНИКИ','С МЕХАНИКОЙ'],
    world:{ plats:[[0,46,GY],[58,100,GY]], start:[10,TOP], vx:26, dur:3.0,
      script:[[1.04,'p'],[1.6,'r']] },
    hint:'Прыжку не хватает буквально сантиметра до края платформы.' },

  // ЧАСТЬ II
  fastfall:{ ab:1, flag:'fastfall', labels:['БЕЗ МЕХАНИКИ','С МЕХАНИКОЙ'],
    world:{ plats:[[0,100,GY]], start:[14,TOP], vx:17, dur:2.8, script:[[0.4,'p'],[1.1,'r']] },
    hint:'Взлёт одинаковый — разное только падение.' },

  apex:{ ab:1, flag:'apex', labels:['БЕЗ МЕХАНИКИ','С МЕХАНИКОЙ'],
    world:{ plats:[[0,100,GY]], start:[14,TOP], vx:17, dur:2.8, script:[[0.4,'p'],[1.1,'r']] },
    hint:'Смотри на верхнюю точку: справа куб держится там дольше.' },

  djump:{ ab:1, flag:'djump', labels:['БЕЗ МЕХАНИКИ','С МЕХАНИКОЙ'],
    world:{ plats:[[0,40,GY],[64,100,GY]], start:[10,TOP], vx:26, dur:3.2, airJumps:1,
      script:[[1.10,'p'],[1.25,'r'],[1.5,'p'],[1.8,'r']] },
    hint:'Второе нажатие уже в воздухе, над пропастью.' },

  corner:{ ab:1, flag:'corner', labels:['БЕЗ МЕХАНИКИ','С МЕХАНИКОЙ'],
    world:{ plats:[[0,100,GY]], blocks:[[44,100,0,24]], start:[18,TOP], vx:20, dur:2.8,
      script:[[1.05,'p'],[1.6,'r']] },
    hint:'Угол задет всего на пару пикселей.' },

  wall:{ ab:0, flag:'wall',
    world:{ plats:[[28,45,104]], blocks:[[0,28,-140,110],[45,100,-140,110]],
      start:[34,99], vx:0, dur:7.5, sceneW:100, followY:1, deathY:130, wallTicks:1,
      bot:(s,w,f,press)=>{
        // с земли — прыжок к стене; дальше висит на стене и отталкивается на другую
        if(s.gr && s.t>0.5 && s.t-s.lastJump>0.4){ press(s,w,f); s.btnAuto=s.t+0.18; s.vx=16; }
        else if(!s.gr && s.wall && s.t-(s.wallTouch||0)>0.3 && s.t-s.lastJump>0.25){
          press(s,w,f); s.btnAuto=s.t+0.18;
        }
      } },
    hint:'Куб цепляется за стену, сползает и отталкивается — и так с одной стены на другую, всё выше.' },

  camlerp:{ camera:1, look:0, hint:'Пока игрок внутри пунктирной рамки — камера стоит на месте. Вышел — плавно догоняет.' },

  camera:{ camera:1, look:1, hint:'Пока игрок внутри пунктирной рамки — камера стоит. Вышел — поехала.' }
};

/* ---------------- запуск ---------------- */
const sims=[];
function mount(canvas, key){
  const sc=SCENES[key]; if(!sc) return;
  const sim={ canvas, ctx:canvas.getContext('2d'), sc, key, vis:false,
    A:null, B:null, camst:{t:0,cam:55,x:105}, hold:0 };
  if(!sc.camera){
    sim.A=newState(sc.world); sim.B=newState(sc.world);
    sim.fA={}; sim.fB={}; sim.fB[sc.flag]=true;
    sim.fired={A:0,B:0};
  }
  sims.push(sim); resizeSim(sim);
  const io=new IntersectionObserver(es=>es.forEach(e=>sim.vis=e.isIntersecting),{threshold:.05});
  io.observe(canvas);
  return sim;
}
function resizeSim(s){
  const r=s.canvas.getBoundingClientRect(), d=Math.min(devicePixelRatio||1,2);
  s.canvas.width=Math.max(2,Math.round(r.width*d)); s.canvas.height=Math.max(2,Math.round(r.height*d));
  s.ctx.setTransform(d,0,0,d,0,0); s.w=r.width; s.h=r.height;
}
addEventListener('resize',()=>sims.forEach(resizeSim));

function verdictFor(sim,which){
  const s=which==='A'?sim.A:sim.B, k=sim.key, w=sim.sc.world;
  const A=which==='A';
  // не судим, пока исход не решён (куб ещё в воздухе)
  const settled = s.dead || (s.gr && s.t>0.2);
  switch(k){
    case 'coyote': case 'hitbox': case 'djump':
      if(s.dead) return {ok:0,text: k==='coyote'?'✗ ПРОВАЛ В ЯМУ': k==='hitbox'?'✗ СОРВАЛСЯ У КРАЯ':'✗ НЕ ДОЛЕТЕЛ'};
      if(!s.gr || s.fired===0) return null;
      return {ok:1,text: k==='coyote'?'✓ ПРЫЖОК ПРОШЁЛ': k==='hitbox'?'✓ КРАЙ ПРОСТИЛ':'✓ ДОЛЕТЕЛ'};
    case 'buffer':
      if(s.presses.length<2 || !settled) return null;
      return s.fired>=2?{ok:1,text:'✓ ПРЫЖОК СРАБОТАЛ'}:{ok:0,text:'✗ НАЖАТИЕ ПОТЕРЯНО'};
    case 'corner':
      if(s.fired===0) return null;
      if(s.bonk) return {ok:0,text:'✗ ЗАСТРЯЛ ПОД УГЛОМ'};
      return s.t>w.dur*0.6?{ok:1,text:'✓ ПРОСКОЛЬЗНУЛ'}:null;
    case 'vary':
      if(s.arcs.length<2) return null;
      return A?{ok:0,text:'ВЫСОТА ВСЕГДА ОДНА'}:{ok:1,text:'ВЫСОТА ЗАВИСИТ ОТ НАЖАТИЯ'};
    case 'fastfall':
      if(!settled || !(s.fallT>0)) return null;
      return {ok:!A,text:'ПАДАЛ '+s.fallT.toFixed(2)+' сек'};
    case 'apex':
      if(!settled || !(s.apexT>0)) return null;
      return {ok:!A,text:'НА ПИКЕ '+s.apexT.toFixed(2)+' сек'};
  }
  return null;
}

let last=performance.now();
function frame(now){
  let dt=(now-last)/1000; last=now; if(dt>0.05) dt=0.05;
  for(const sim of sims){
    if(!sim.vis || !sim.w) continue;
    const c=sim.ctx; c.clearRect(0,0,sim.w,sim.h);
    c.fillStyle='#050505'; c.fillRect(0,0,sim.w,sim.h);

    if(sim.sc.camera){ cameraSim(c,0,0,sim.w,sim.h,sim.camst,dt,sim.sc.look); continue; }

    const w=sim.sc.world;
    // шаги фиксированным dt
    let acc=dt;
    while(acc>0){
      const h=Math.min(1/120,acc); acc-=h;
      for(const key of ['A','B']){
        const s=sim[key], f=key==='A'?sim.fA:sim.fB;
        if(s.t>=w.dur) continue;
        // отработка сценария нажатий (одинакового для обеих панелей)
        const idx=key==='A'?'iA':'iB'; sim[idx]=sim[idx]||0;
        const SCR=w.script||[];
        while(sim[idx]<SCR.length && SCR[sim[idx]][0]<=s.t){
          const ev=SCR[sim[idx]][1];
          if(ev==='p') press(s,w,f); else release(s,f);
          sim[idx]++;
        }
        step(s,w,f,h);
      }
    }
    if(sim.A.t>=w.dur && sim.B.t>=w.dur){
      sim.hold+=dt;
      if(sim.hold>1.3){ sim.hold=0; sim.A=newState(w); sim.B=newState(w); sim.iA=0; sim.iB=0; sim.camX=undefined; sim.camY=undefined; }
    }

    // общая камера для обеих панелей: следит за действием, куб всегда квадратный
    const paneW = sim.sc.ab ? (sim.w-3)/2 : sim.w;
    const vw = viewOf(paneW, sim.h);
    const sceneW = w.sceneW || 100;
    const focus = sim.sc.ab ? (sim.A.x+sim.B.x)/2 : sim.B.x;
    let want = focus + V.P/2 - vw.visW/2;
    want = vw.visW>=sceneW ? (sceneW-vw.visW)/2 : Math.max(0, Math.min(sceneW-vw.visW, want));
    if(sim.camX===undefined) sim.camX=want;
    sim.camX += (want-sim.camX)*Math.min(1, 6*dt);

    // вертикальная камера — для сцен, где лезут вверх (прыжок от стены)
    let camY=0;
    if(w.followY){
      const visH=sim.h/vw.sc;
      let wantY = sim.B.y + V.P/2 - visH*0.55;
      const floorY = (w.plats&&w.plats[0]) ? w.plats[0][2] : V.H;
      wantY = Math.min(wantY, floorY + 6 - visH);
      if(sim.camY===undefined) sim.camY=wantY;
      sim.camY += (wantY-sim.camY)*Math.min(1, 4*dt);
      camY = sim.camY;
    }
    const opt={sc:vw.sc, cam:sim.camX, camY:camY};

    if(sim.sc.ab){
      drawPane(c,0,0,paneW,sim.h,w,sim.A,sim.fA,sim.sc.labels[0],Object.assign({on:0,verdict:verdictFor(sim,'A')},opt));
      drawPane(c,paneW+3,0,paneW,sim.h,w,sim.B,sim.fB,sim.sc.labels[1],Object.assign({on:1,verdict:verdictFor(sim,'B')},opt));
      c.fillStyle='rgba(255,255,255,.2)'; c.fillRect(paneW,0,3,sim.h);
    } else {
      drawPane(c,0,0,sim.w,sim.h,w,sim.B,sim.fB,'МЕХАНИКА В ДЕЙСТВИИ',Object.assign({on:1},opt));
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

global.GFSim={ mount, SCENES, sims };
})(window);
