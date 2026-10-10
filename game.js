'use strict';
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
const $=s=>document.querySelector(s),overlay=$('#overlay');
const stages=[{name:'Rose Garden',speed:175,gap:85,maxSpeed:3},{name:'Dark Castle',speed:195,gap:105,maxSpeed:3},{name:'Moonlight Rooftop',speed:215,gap:145,maxSpeed:6},{name:'The Final Stage',speed:235,gap:160,maxSpeed:6}];
const outfits=[{name:'Black & Red Rose',cost:0},{name:'All Black Gothic',cost:40},{name:'Crimson Princess',cost:80},{name:'Pink Rose Princess',cost:130},{name:'Moonlight Queen',cost:200}];
let save={best:0,bank:0,unlocked:[0],outfit:0,stars:[0,0,0,0],music:.35,sfx:.65};try{Object.assign(save,JSON.parse(localStorage.getItem('roseEscape')||'{}'))}catch{}
// Ignore malformed/older local saves without blocking gameplay.
const nonnegative=v=>Number.isFinite(v)?Math.max(0,Math.floor(v)):0;
save.best=nonnegative(save.best);save.bank=nonnegative(save.bank);
save.unlocked=[...new Set([0,...(Array.isArray(save.unlocked)?save.unlocked:[]).filter(v=>Number.isInteger(v)&&v>=0&&v<outfits.length)])];
save.outfit=save.unlocked.includes(save.outfit)?save.outfit:0;
save.stars=stages.map((_,n)=>Math.min(3,nonnegative(Array.isArray(save.stars)?save.stars[n]:0)));
for(const key of ['music','sfx'])save[key]=Number.isFinite(save[key])?Math.max(0,Math.min(1,save[key])):.35;
function persist(){try{localStorage.setItem('roseEscape',JSON.stringify(save))}catch{}}
let state='menu',level=0,world=null,player=null,time=0,last=0,lastRender=0,accumulator=0,particles=[],petals=[],petalClock=0,shake=0,menuReturn='menu',audio=null;
function tone(freq,duration=.1,type='square',volume=.07){if(!audio||volume<=0)return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}
function sound(kind){if(!audio)return;const notes={jump:520,double:780,rose:1046,hurt:130,win:880,lose:90,unlock:660};tone(notes[kind]||440,.12,'triangle',save.sfx*.14)}
function initAudio(){if(!audio){const A=window.AudioContext||window.webkitAudioContext;if(A)audio=new A()}audio?.resume()}
function button(label,action,cls=''){return `<button class="${cls}" data-action="${action}">${label}</button>`}
function show(html){RoseBGM.setVolume(save.music);RoseBGM.sync({paused:state==='pause'||(state==='settings'&&menuReturn==='pause'),hidden:document.hidden});$('#frame').dataset.screen=state;overlay.innerHTML=`<div class="panel">${html}</div>`;$('#hud').hidden=true;$('#hint').textContent=''}
function menu(){state='menu';show(`<p class="eyebrow">A MOONLIT ROSE ADVENTURE</p><h1 class="title"><span class="eight">8</span>WONYOUNG</h1><p class="subtitle">Rose Escape</p><p class="desc">A little princess. A midnight castle. A thousand roses.</p>${button('BEGIN THE ESCAPE →','start','primary')}<div class="nav">${button('CHAPTERS','levels')}${button('WARDROBE','wardrobe')}${button('SETTINGS','settings')}</div><p class="best">PERSONAL BEST ${String(save.best).padStart(6,'0')} &nbsp; · &nbsp; ${save.bank} ROSES IN YOUR GARDEN</p>`)}
function levels(){state='levels';show(`<p class="eyebrow">FOUR CHAPTERS · ONE ESCAPE</p><h2>Choose your midnight</h2><div class="cards">${stages.map((s,i)=>`<div class="card"><span>0${i+1} / 04</span><strong>${s.name}</strong><small>${['EASY','MEDIUM','HARD','VERY HARD'][i]} · MAX ×${s.maxSpeed}<br>70 SECONDS</small><div style="color:#e1b97b">${'★'.repeat(save.stars[i])}${'☆'.repeat(3-save.stars[i])}</div>${button('PLAY →','level:'+i)}</div>`).join('')}</div>${button('← MAIN MENU','menu')}`)}
function wardrobe(){state='wardrobe';show(`<p class="eyebrow">${save.bank} ROSES TO SPEND</p><h2>The rose wardrobe</h2><div class="cards">${outfits.map((o,i)=>`<div class="card" style="width:18%"><canvas class="portrait" data-outfit="${i}" width="96" height="120" style="width:96px;height:120px;max-width:100%;image-rendering:pixelated"></canvas><strong style="font-size:18px">${o.name}</strong><small>${save.unlocked.includes(i)?'UNLOCKED':o.cost+' ROSES'}</small>${button(save.outfit===i?'EQUIPPED':save.unlocked.includes(i)?'EQUIP':'UNLOCK','outfit:'+i)}</div>`).join('')}</div><p id="wardrobeNotice" class="desc">Collect roses on your journey to unlock every look.</p>${button('← MAIN MENU','menu')}`);document.querySelectorAll('.portrait').forEach(c=>sprite(c.getContext('2d'),48,80,1.8,0,+c.dataset.outfit,'idle'))}
function settings(){menuReturn=state==='pause'?'pause':'menu';state='settings';show(`<p class="eyebrow">MAKE THE NIGHT YOURS</p><h2>Settings</h2><label class="setting">Music <input aria-label="Music volume" id="musicVolume" type="range" min="0" max="1" step=".05" value="${save.music}"></label><label class="setting">Sound effects <input aria-label="Sound effect volume" id="sfxVolume" type="range" min="0" max="1" step=".05" value="${save.sfx}"></label><p class="desc">BGM：张元英《8》 · 默认开启 · 点击开始自动播放 · 右上角可关闭<br>Tap or Space: jump / double jump · Esc: pause</p>${button('SAVE & RETURN','settingsBack','primary')}`)}
function pause(){if(!world)return;state='pause';show(`<p class="eyebrow">TAKE A BREATH</p><h2>Moonlight can wait.</h2>${button('RESUME →','resume','primary')}<div class="nav">${button('RESTART','restart')}${button('SETTINGS','settings')}${button('MAIN MENU','menu')}</div>`)}
function resume(){state='play';if(typeof performance!=='undefined')last=performance.now();RoseBGM.sync({paused:false,hidden:document.hidden});$('#frame').dataset.screen='play';overlay.innerHTML='';$('#hud').hidden=false}
const stagePhotos=[{"file":"eight-stage-1.jpg","url":"https://pbs.twimg.com/media/G4q7IQ2bQAQrZVV.jpg","source":"https://x.com/yebi_wy/status/1984604368306602312","credit":"YEBI / @yebi_wy"},{"file":"eight-stage-2.jpg","url":"https://image.koreaboo.com/2025/11/CziOwz-640x896.jpg","source":"https://www.koreaboo.com/news/ive-jang-wonyoung-new-solo-song-eight-lyrics-reactions/","credit":"Photo via Koreaboo"},{"file":"eight-stage-3.jpg","url":"https://www.niusnews.com/upload/imgs/default/202511___LIUJOYCE/1103/xx10.jpg","source":"https://www.niusnews.com/=P2c9e9570","credit":"Photo via 妞新聞"},{"file":"eight-stage-4.jpg","url":"https://img.mimint.co.kr/talk/bbs/2026/02/16/M2602160818420450.jpg","source":"https://www.mimint.co.kr/bbs/view/tvnews/photo/494664","credit":"Photo via Mimint / original watermark retained"}];
let comfortRound=0;
function resultCard(won,stars){
 const photo=stagePhotos[won?[0,1,2,0][level]:(3+comfortRound++)%stagePhotos.length];
 const cheers=['第一束玫瑰，为你盛开。','你闯过了黑夜，继续闪耀吧。','月光也在为你喝彩。','全部通关！今晚的舞台属于你。'];
 return `<div class="result-layout"><figure class="result-photo"><img src="assets/${photo.file}" alt="张元英${won?' Eight solo':''} 舞台照片" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><p class="photo-unavailable" hidden>照片暂时加载失败<br>也别忘了给自己一点鼓励 🌹</p><figcaption><span>JANG WONYOUNG</span><a href="${photo.source}" target="_blank" rel="noopener noreferrer">照片来源 ↗</a></figcaption></figure><div class="result-copy"><p class="eyebrow">${won?'STAGE CLEAR · '+(level+1)+' / 4':'A LITTLE ENCOURAGEMENT'}</p><h2>${won?'你做到了！':'没关系，再试一次。'}</h2><p class="result-message">${won?cheers[level]:'先看看元英，给自己充充电。<br>每一次尝试，都离终点更近一点。'}</p>${won?`<div class="stars" aria-label="${stars} stars">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</div>`:''}<div class="stats"><div><small>SCORE</small><b>${world.score}</b></div><div><small>ROSES</small><b>${world.roses} / ${world.totalRoses}</b></div><div><small>SKY ROUTES</small><b>${world.skyCompleted} / ${world.skyTrials.length}</b></div></div>${button(won?(level===3?'回到玫瑰花园':'继续下一关 →'):'再试一次 →',won?(level===3?'menu':'level:'+(level+1)):'restart','primary')}<div class="nav">${button('重玩本关','restart')}${button('主菜单','menu')}</div></div></div>`;
}
function finish(won){state=won?'clear':'over';sound(won?'win':'lose');save.bank+=world.roses;save.best=Math.max(save.best,world.score);let stars=won?1+(player.hp>=2?1:0)+(player.hp===3&&world.roses>=world.totalRoses*.8?1:0):0;if(won)save.stars[level]=Math.max(save.stars[level],stars);persist();if(won)burst(player.x,player.y,65,'#f4a3be');show(resultCard(won,stars))}
overlay.addEventListener('click',e=>{const a=e.target.closest('[data-action]')?.dataset.action;if(!a)return;initAudio();if(a==='menu')menu();if(a==='start')start(0);if(a==='levels')levels();if(a==='wardrobe')wardrobe();if(a==='settings')settings();if(a==='resume')resume();if(a==='restart')start(level);if(a.startsWith('level:'))start(+a.split(':')[1]);if(a==='settingsBack'){save.music=+$('#musicVolume').value;RoseBGM.setVolume(save.music);save.sfx=+$('#sfxVolume').value;persist();menuReturn==='pause'?pause():menu()}if(a.startsWith('outfit:')){let i=+a.split(':')[1];if(save.unlocked.includes(i))save.outfit=i;else if(save.bank>=outfits[i].cost){save.bank-=outfits[i].cost;save.unlocked.push(i);save.outfit=i;sound('unlock')}else{$('#wardrobeNotice').textContent=`You need ${outfits[i].cost-save.bank} more roses.`;return}persist();wardrobe()}});
overlay.addEventListener('input',e=>{if(e.target.id==='musicVolume')RoseBGM.setVolume(e.target.value)});
function runSpeed(n,elapsed){const s=stages[n];return s.speed*(1+(s.maxSpeed-1)*Math.max(0,Math.min(1,elapsed/45)))}
function runDistance(n,elapsed){const s=stages[n],ramp=Math.max(0,Math.min(45,elapsed));return s.speed*(ramp+(s.maxSpeed-1)*ramp*ramp/90+Math.max(0,elapsed-45)*s.maxSpeed)}
function levelTimeAtDistance(n,x){const s=stages[n],distance=x/s.speed,rampDistance=45*(s.maxSpeed+1)/2;return distance<rampDistance?(Math.sqrt(2025+90*(s.maxSpeed-1)*distance)-45)/(s.maxSpeed-1):45+(distance-rampDistance)/s.maxSpeed}
function actualSpeed(n,elapsed,rush=false){return Math.min(stages[n].speed*Math.max(3.75,stages[n].maxSpeed),runSpeed(n,elapsed)*(rush?1.25:1))}
function makeLevel(n){
 const s=stages[n],length=runDistance(n,70),platforms=[],hazards=[],items=[],skyTrials=[],checks=[0];let x=0,idx=0;
 const item=(x,y,type,challenge='ground')=>items.push({x,y,type,challenge,taken:false});
 while(x<length+900){
  const plannedTime=levelTimeAtDistance(n,x),spacing=1+(s.maxSpeed-1)/2*Math.min(1,plannedTime/45);
  const w=Math.round((950+(idx%3)*45)*spacing),pattern=idx%4;
  const sky=pattern===3&&idx!==11&&x+w<length-150,y=sky||idx===0?430:430-[0,35,0,65][idx%4];
  platforms.push({x,y,w,h:100,moving:false,kind:'ground',pattern});
  // Alternate ground clusters, a two-jump arc, stairs and optional feather flights.
  if(pattern===0){for(let k=0;k<7;k++)item(x+(90+k*60)*spacing,y-52,'rose')}
  if(pattern===1){
   for(const [rx,lift]of[[165,80],[230,135],[290,205],[315,220],[340,230],[365,220],[390,205]])item(x+rx*spacing,y-lift,'rose',lift>=205?'double':'jump');
  }
  if(pattern===2){
   for(let step=0;step<3;step++){
    const sx=x+(120+step*250)*spacing,sy=y-(step+1)*60,sw=(step===2?(n>=2?330:285):300)*spacing;
    platforms.push({x:sx,y:sy,w:sw,h:26,moving:false,kind:'step',step:step+1});
    for(let k=0;k<(step===2?4:2);k++)item(sx+(step===2?90+k*48:145+k*55)*spacing,sy-42,'rose','steps');
   }
  }
  if(sky){
   const id=skyTrials.length,launch=x+170*spacing,flightSpeed=runSpeed(n,plannedTime+.8);
   item(x+65*spacing,y-48,'feather');
   const route=[[.26,90,'star',50,1],[.63,175,'star',50,2],[.92,275,'star',100,3],[1.08,300,'crown',300,3],[1.42,285,'star',100,3]];
   for(const [after,lift,type,points,tap]of route){item(launch+flightSpeed*after,y-lift,type,tap===3?'triple':'sky-guide');Object.assign(items.at(-1),{trial:id,points,tap})}
   skyTrials.push({id,launch,y,end:launch+flightSpeed*1.85,collected:0,total:3,complete:false});
  }
  if(idx>0&&pattern!==2&&!sky){
   const types=n===0?['thorn']:n===1?['thorn','bat','stone']:n===2?['thorn','blade','bat']:['thorn','bat','stone','blade','laser'];
   const type=types[(idx-1)%types.length],hx=x+(pattern===0||pattern===1?650:480)*spacing;
   hazards.push({x:hx,y:y-(type==='bat'?85:type==='blade'?65:0),type,trigger:false,fallY:-100});
  }
  if(idx%3===1){const type=['star','heart','feather','hourglass','crown'][Math.floor(idx/3)%5];if(type!=='feather'||!sky)item(x+w-100,y-90,type)}
  if(idx%3===0){checks.push(x+25);item(x+35,y-40,'checkpoint')}
  const gap=s.gap+(idx%2)*15;
  if(n>0&&idx%3===2)platforms.push({x:x+w+gap/2-28,y:y-30,w:65,h:16,moving:true,kind:'bridge'});
  x+=w+gap;idx++;
 }
 return{length,platforms,hazards,items,skyTrials,skyCompleted:0,skyCelebrate:0,checks,checkpoint:0,score:0,roses:0,totalRoses:items.filter(i=>i.type==='rose'&&i.x<length).length,elapsed:0,rush:0,feather:0};
}
function start(n){if(typeof Image!=='undefined'&&!RoseArt.loaded)return;initAudio();level=n;world=makeLevel(n);player={x:80,y:430,v:0,hp:3,jumps:0,ground:true,coyote:.1,buffer:0,inv:0,anim:'run',stride:0,joy:0,joyKind:'rose'};particles=[];petals=[];petalClock=0;accumulator=0;resume()}
function jump(){
 if(state!=='play')return;
 const max=world.feather>0?3:2;
 const landingSoon=!player.ground&&player.v>=0&&world.platforms.some(p=>{const y=movingY(p);return player.x+13>p.x&&player.x-13<p.x+p.w&&y>=player.y-4&&y-player.y<=Math.max(10,player.v*.08)});
 if(player.jumps>=max||landingSoon){player.buffer=.12;return}
 player.buffer=0;player.coyote=0;player.v=-460;player.ground=false;player.jumps++;sound(player.jumps===3?'unlock':player.jumps===1?'jump':'double');burst(player.x,player.y,player.jumps===3?22:12,player.jumps===3?'#fff0b8':'#ffb2d2');
}
function requestJump(){if(state!=='play')return;if(typeof performance!=='undefined')advanceSimulation(performance.now());jump()}
canvas.addEventListener('pointerdown',e=>{e.preventDefault();initAudio();requestJump()});document.addEventListener('keydown',e=>{if(e.code==='Space'){if(e.target.tagName==='INPUT'||e.target.tagName==='BUTTON')return;e.preventDefault();if(!e.repeat){state==='play'?requestJump():state==='menu'?start(0):null}}if(e.code==='Escape'){state==='play'?pause():state==='pause'?resume():null}});$('#pause').onclick=pause;$('#home').onclick=menu;$('#full').onclick=()=>document.fullscreenElement?document.exitFullscreen():$('#shell').requestFullscreen?.().catch(()=>{});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')pause();RoseBGM.sync({hidden:document.hidden})});
function burst(x,y,count,color){for(let i=0;i<count;i++)particles.push({x,y,vx:(Math.random()-.5)*150,vy:-Math.random()*180,life:.4+Math.random()*.6,color})}
function damage(fall=false){if((player.inv>0||world.rush>0)&&!fall)return;player.hp--;player.inv=1.6;shake=.25;sound('hurt');burst(player.x,player.y-25,18,'#d42e5d');if(player.hp<=0){player.anim='dead';finish(false);return}if(fall){player.x=world.checkpoint+60;const p=world.platforms.find(p=>p.kind==='ground'&&player.x>=p.x&&player.x<=p.x+p.w);player.y=p?p.y:430;player.v=0;player.jumps=0;player.ground=true;player.coyote=.1;player.buffer=0}}
function movingY(p){return p.y+(p.moving?Math.sin(world.elapsed*2+p.x)*25:0)}
// Sweep the character's path so fast frames cannot skip pickups.
function crossedPickup(i,x0,y0,x1,y1,rx,ry){let lo=0,hi=1;for(const [origin,delta,target,radius]of[[x0,x1-x0,i.x,rx],[y0,y1-y0,i.y,ry]]){if(Math.abs(delta)<.00001){if(Math.abs(origin-target)>radius)return false;continue}let a=(target-radius-origin)/delta,b=(target+radius-origin)/delta;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(lo>hi)return false}return true}
function update(dt){if(state!=='play')return;const speed=actualSpeed(level,world.elapsed,world.rush>0),prevY=player.y,prevX=player.x;world.elapsed+=dt;world.skyCelebrate=Math.max(0,world.skyCelebrate-dt);player.joy=Math.max(0,player.joy-dt);world.rush=Math.max(0,world.rush-dt);world.feather=Math.max(0,world.feather-dt);player.inv=Math.max(0,player.inv-dt);player.coyote=Math.max(0,player.coyote-dt);player.buffer=Math.max(0,player.buffer-dt);player.x+=speed*dt;if(player.ground)player.stride+=dt*(1.5+1.5*Math.sqrt(speed/175));player.v+=1000*dt;player.y+=player.v*dt;player.ground=false;for(const p of world.platforms){let y=movingY(p);if(player.x+13>p.x&&player.x-13<p.x+p.w&&prevY<=y+4&&player.y>=y&&player.v>=0){if(player.v>120)burst(player.x,y,8,'#bd8c9b');player.y=y;player.v=0;player.jumps=0;player.ground=true;player.coyote=.1;break}}if(!player.ground&&player.jumps===0&&player.coyote===0)player.jumps=1;if(player.ground&&player.buffer>0)jump();trail(dt);player.anim=player.ground?'run':player.v<0?(player.jumps>1?'double':'jump'):'fall';if(player.y>600){damage(true);if(state!=='play')return}for(const h of world.hazards){if(Math.abs(h.x-player.x)>Math.max(350,speed*1.2))continue;let hy=h.y-15;if(h.type==='bat')hy=h.y+Math.sin(world.elapsed*3+h.x)*24;if(h.type==='blade')hy=h.y;if(h.type==='stone'){if(player.x>h.x-speed*1.15)h.trigger=true;if(h.trigger)h.fallY=Math.min(h.y-16,h.fallY+dt*600);hy=h.fallY}if(h.type==='laser'){if(Math.floor(world.elapsed*2)%4>=2)continue;hy=h.y-60}let hw=h.type==='thorn'?27:18,hh=h.type==='laser'?70:18;if(Math.abs(player.x-h.x)<hw+10&&player.y>hy-hh&&player.y-48<hy+hh)damage()}if(state!=='play')return;const teleported=Math.abs(player.x-prevX-speed*dt)>1,pickupX0=teleported?player.x:prevX,pickupY0=teleported?player.y-28:prevY-28,pickupReach=160,pickupLeft=Math.min(pickupX0,player.x)-pickupReach,pickupRight=Math.max(pickupX0,player.x)+pickupReach;for(const i of world.items){if(i.taken||i.x>world.length||i.x<pickupLeft||i.x>pickupRight)continue;if(i.challenge==='triple'&&(world.feather<=0||player.jumps!==3))continue;const rosePickup=i.type==='rose',roseReach=64+Math.min(32,Math.max(0,speed/stages[level].speed-3)*32/3),skyReach=level>=2?Math.max(56,speed*.1):56,caught=crossedPickup(i,pickupX0,pickupY0,player.x,player.y-28,rosePickup?roseReach:i.challenge==='triple'?skyReach:24,rosePickup?(i.challenge==='double'||i.challenge==='steps'?36:50):(i.challenge==='triple'?32:40)),magnet=world.rush>0&&rosePickup&&i.challenge!=='double'&&i.challenge!=='steps'&&Math.hypot(i.x-player.x,i.y-(player.y-28))<160;if(!caught&&!magnet)continue;if(i.type==='checkpoint'){world.checkpoint=i.x-35;i.taken=true;burst(i.x,i.y,15,'#ffd19a');continue}i.taken=true;player.joy=1.1;player.joyKind=i.type;world.score+=i.points??(i.type==='rose'?10:i.type==='star'?50:i.type==='crown'?200:20);if(i.challenge==='triple'){const trial=world.skyTrials[i.trial];trial.collected++;if(trial.collected===trial.total){trial.complete=true;world.skyCompleted++;world.skyCelebrate=2;world.score+=150;burst(i.x,i.y,35,'#ffe4a4');sound('win')}}if(i.type==='rose')world.roses++;if(i.type==='heart')player.hp=Math.min(3,player.hp+1);if(i.type==='feather')world.feather=8;if(i.type==='hourglass'){world.rush=4;burst(player.x,player.y-28,40,'#ffb5d9');sound('unlock')};sound('rose');burst(i.x,i.y,10,'#ee7d9d')}if(player.x>=world.length){finish(true);return}$('#hearts').textContent='♥'.repeat(player.hp)+'♡'.repeat(3-player.hp);$('#score').textContent=String(world.score).padStart(6,'0');$('#roses').textContent='🌹 '+world.roses+' / '+world.totalRoses;$('#speed').textContent='×'+(actualSpeed(level,world.elapsed,world.rush>0)/stages[level].speed).toFixed(1);$('#progress').style.width=Math.min(100,player.x/world.length*100)+'%';$('#stageLabel').textContent=`1–${level+1} ${stages[level].name.toUpperCase()}`;$('#hint').textContent=world.skyCelebrate>0?'高空皇冠收齐 · 额外 +150':world.rush>0?'ROSE RUSH · INVINCIBLE + ROSE MAGNET · '+world.rush.toFixed(1)+'s':world.feather>0?'羽毛 · '+Math.min(3,player.jumps)+' / 3 跳 · '+world.feather.toFixed(1)+'s · 追逐高空皇冠':world.elapsed<7?'TAP TO JUMP · TAP AGAIN FOR HIGH ROSES':world.elapsed<11?'CLIMB THE STEPS · FOLLOW THE HIGH ROSES':'RUN SPEED ×'+(runSpeed(level,world.elapsed)/stages[level].speed).toFixed(2)}

function trail(dt){
  if(player.ground){petalClock+=dt;while(petalClock>=.055){petalClock-=.055;petals.push({x:player.x-22-Math.random()*16,y:player.y-18-Math.random()*38,vx:-25-Math.random()*35,vy:8+Math.random()*24,life:1.7+Math.random()*.7,angle:Math.random()*6,color:['#be173d','#e83b61','#f46a8b'][Math.floor(Math.random()*3)],size:1+Math.random()*.7})}}
  for(const p of petals){p.life-=dt;p.x+=p.vx*dt+Math.sin(p.angle)*9*dt;p.y+=p.vy*dt;p.vy+=28*dt;p.angle+=dt*3}
  petals=petals.filter(p=>p.life>0).slice(-100);
}

function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h)}
function rose(x,y,r=10){RoseArt.rose(ctx,x,y,r)}
function sprite(c,x,y,scale,t,oi,anim,stride=0,happy=false){RoseArt.sprite(c,x,y,scale,t,oi,anim,stride,happy)}
function background(camera){RoseArt.background(ctx,camera,level,time,['menu','levels','wardrobe','settings'].includes(state))}
function drawPlatform(p,camera){RoseArt.platform(ctx,p,camera,movingY(p))}
function drawHazard(h,camera){
  if(RoseArt.objectsReady&&h.type!=='laser'){
    const x=h.x-camera;if(x<-80||x>1040)return;
    if(h.type==='thorn'){RoseArt.object(ctx,8,x,h.y-19,86);return}
    if(h.type==='bat'){const y=h.y+Math.sin(world.elapsed*3+h.x)*24;ctx.save();ctx.translate(x,y);ctx.scale(1,1+Math.sin(time*16)*.08);RoseArt.object(ctx,6,0,0,72);ctx.restore();return}
    if(h.type==='stone'){RoseArt.object(ctx,9,x,h.fallY,54);if(!h.trigger){ctx.fillStyle='#ff769d';ctx.fillRect(x-2,28,4,16);ctx.fillRect(x-2,49,4,4)}return}
    if(h.type==='blade'){ctx.save();ctx.translate(x,h.y);ctx.rotate(time*3);RoseArt.object(ctx,7,0,0,86);ctx.restore();return}
  }
  if(h.type==='laser'){const x=h.x-camera,y=h.y,active=Math.floor(world.elapsed*2)%4<2;if(x<-60||x>1020)return;rect(x-15,y-140,30,8,'#8b3556');rect(x-15,y,30,8,'#8b3556');rect(x-3,y-130,6,130,active?'#ee477b':'#51213c');if(active)rect(x-1,y-130,2,130,'#ffe5ee')}
}
function drawSkyTrial(trial,camera){
 if(trial.end-camera<0||trial.launch-camera>1000)return;
 const path=world.items.filter(i=>i.trial===trial.id);
 ctx.save();ctx.lineWidth=2;ctx.strokeStyle=trial.complete?'#ffdd91':'#dfb7ee88';ctx.setLineDash([3,9]);ctx.beginPath();ctx.moveTo(trial.launch-camera,trial.y-30);for(const i of path)ctx.lineTo(i.x-camera,i.y);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle='#f8d5ff';ctx.font='bold 15px Georgia';ctx.textAlign='center';ctx.fillText('TAP · TAP · TAP',trial.launch-camera,trial.y-18);ctx.restore();
}
function drawItem(i,camera){
  if(RoseArt.objectsReady){if(i.taken||i.x>world.length)return;const x=i.x-camera,y=i.y+Math.sin(time*3+i.x)*3;if(x<-50||x>1010)return;const index={rose:0,heart:1,star:2,crown:3,feather:4,hourglass:5,checkpoint:10}[i.type];
   if(i.challenge==='triple'){ctx.save();ctx.strokeStyle='#ffdba7';ctx.lineWidth=2;ctx.shadowColor='#ffbd69';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(x,y,22+Math.sin(time*4)*2,0,Math.PI*2);ctx.stroke();ctx.restore()}
   RoseArt.object(ctx,index,x,y,i.type==='checkpoint'?64:i.challenge==='triple'?42:36);
   if(i.tap){ctx.save();ctx.textAlign='center';ctx.font='bold 14px Georgia';ctx.fillStyle=i.tap===3?'#ffe7ad':'#f6d1ff';ctx.fillText(i.tap===3?'③ +'+i.points:String(i.tap),x,y+35);ctx.restore()}return}

}
function render(dt){const camera=world&&['play','pause','clear','over'].includes(state)?Math.max(0,player.x-(288-Math.max(0,runSpeed(level,world.elapsed)/stages[level].speed-3)*40)):time*12;ctx.save();if(shake>0){shake-=dt;ctx.translate((Math.random()-.5)*7,(Math.random()-.5)*7)}background(camera);if(world&&['play','pause','clear','over'].includes(state)){world.platforms.forEach(p=>drawPlatform(p,camera));world.hazards.forEach(h=>drawHazard(h,camera));world.skyTrials.forEach(t=>drawSkyTrial(t,camera));world.items.forEach(i=>drawItem(i,camera));if(player.x>world.length-1000){let x=world.length-camera;rect(x,160,10,270,'#a07487');rect(x+180,160,10,270,'#a07487');rect(x,158,190,10,'#c194a4');for(let j=0;j<7;j++)rose(x+j*29,165,11);ctx.fillStyle='#f4c4d4';ctx.font='20px Georgia';ctx.textAlign='center';ctx.fillText('THE ROSE THRONE',x+95,140)}if(world.rush>0){ctx.save();ctx.strokeStyle='#ff9bc8';ctx.lineWidth=3;ctx.shadowColor='#ff427f';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(player.x-camera,player.y-32,42+Math.sin(time*12)*3,0,Math.PI*2);ctx.stroke();for(let j=0;j<5;j++)rect(player.x-camera-55-j*18,player.y-15-j*8,22,2,'#ffc7dc');ctx.restore()}for(const p of petals)RoseArt.petal(ctx,p.x-camera,p.y,p.angle,p.color,p.size);if(player.inv===0||Math.floor(time*12)%2)sprite(ctx,player.x-camera,player.y-40,2,time,save.outfit,state==='clear'?'victory':state==='over'?'dead':player.inv>1.3?'hurt':player.anim,player.stride,player.joy>0&&player.inv<1.3);for(const p of particles){if(state==='play'||state==='clear'){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=300*dt}rect(p.x-camera,p.y,3,3,p.color)}particles=particles.filter(p=>p.life>0)}ctx.restore()}
function advanceSimulation(ts){
 const dt=last?Math.max(0,Math.min((ts-last)/1000,.1)):0;last=ts;
 if(typeof Image!=='undefined'&&!RoseArt.loaded){accumulator=0;return dt}
 if(state==='play'){accumulator+=dt;while(accumulator+1e-9>=1/120&&state==='play'){time+=1/120;update(1/120);accumulator=Math.max(0,accumulator-1/120)}}
 else{accumulator=0;if(state!=='pause'&&!(state==='settings'&&menuReturn==='pause'))time+=dt}
 return dt;
}
function frame(ts){
 const dt=lastRender?Math.max(0,Math.min((ts-lastRender)/1000,.1)):0;lastRender=ts;advanceSimulation(ts);
 if(typeof Image!=='undefined'&&!RoseArt.loaded){rect(0,0,960,540,'#170c17');requestAnimationFrame(frame);return}
 render(dt);requestAnimationFrame(frame);
}
// Pure level geometry is exposed for repeatable, offline smoke tests.
window.RoseEscape={stages,outfits,runSpeed,runDistance,actualSpeed,makeLevel,get state(){return state},get world(){return world},get player(){return player},get petals(){return petals},start,jump,requestJump,update,pause,resume};menu();requestAnimationFrame(frame);
