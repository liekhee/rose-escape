'use strict';
// Reference-faithful sprite and scenery atlases; every gameplay object stays live.
const RoseArt = {
  actor:null, scenes:null, menu:null,objects:null, ready:false, sceneReady:false,menuReady:false,objectsReady:false,runReady:false,run:null,happyReady:false,happy:null,
  get loaded(){return this.ready&&this.sceneReady&&this.menuReady&&this.objectsReady&&this.runReady&&this.happyReady},
  load(){if(typeof Image==='undefined')return;for(const [key,path,flag]of[['actor','rose-girl-atlas.png','ready'],['scenes','gothic-scenes.png','sceneReady'],['menu','rose-title-scene.png','menuReady'],['objects','rose-object-atlas.png','objectsReady'],['run','rose-run-v2.png','runReady'],['happy','rose-happy.png','happyReady']]){this[key]=new Image();this[key].onload=()=>{this[flag]=true;if(key==='scenes')this.prepareScenes();if(key==='run')this.prepareRun();if(key==='happy')this.prepareHappy();if(this.loaded)document.querySelector('#assetLoading').hidden=true};this[key].onerror=()=>{document.querySelector('#assetStatus').textContent='素材加载失败，请检查网络后重试';document.querySelector('#assetRetry').hidden=false};this[key].src='assets/'+path}},
  prepareScenes(){this.softScenes=[];const w=this.scenes.width/2,h=this.scenes.height/2;for(let n=0;n<4;n++){const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;const c=canvas.getContext('2d');c.filter='blur(4px) brightness(.66) saturate(.72)';c.drawImage(this.scenes,n%2*w,Math.floor(n/2)*h,w,h,-16,-16,992,572);this.softScenes.push(canvas)}},
  prepareRun(){
    const w=this.run.width/4,h=this.run.height/2,canvas=document.createElement('canvas');canvas.width=this.run.width;canvas.height=this.run.height;const c=canvas.getContext('2d');c.drawImage(this.run,0,0);const pixels=c.getImageData(0,0,canvas.width,canvas.height)?.data;this.runFeet=[];let tallest=0;
    for(let frame=0;frame<8;frame++){const ox=Math.round(frame%4*w),oy=Math.round(Math.floor(frame/4)*h);let top=h,bottom=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels?.[((oy+y)*canvas.width+ox+x)*4+3]>32){top=Math.min(top,y);bottom=Math.max(bottom,y+1)}this.runFeet.push(bottom||h*.92);tallest=Math.max(tallest,bottom-top)}this.runHeight=tallest||h*.84;this.runGround=Math.max(...this.runFeet);
  },
  prepareHappy(){const w=this.happy.width/4,h=this.happy.height/6,cvs=document.createElement('canvas');cvs.width=this.happy.width;cvs.height=this.happy.height;const c=cvs.getContext('2d');c.drawImage(this.happy,0,0);const pixels=c.getImageData(0,0,cvs.width,cvs.height)?.data;this.happyFeet=[];let tallest=0;for(let f=0;f<24;f++){const ox=Math.round(f%4*w),oy=Math.round(Math.floor(f/4)*h);let top=h,bottom=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels?.[((oy+y)*cvs.width+ox+x)*4+3]>32){top=Math.min(top,y);bottom=Math.max(bottom,y+1)}this.happyFeet.push(bottom||h*.94);if(f<8)tallest=Math.max(tallest,bottom-top)}this.happyRunHeight=tallest||h*.84;this.happyGround=Math.max(...this.happyFeet.slice(0,8));},
  sprite(c,x,y,scale,t,outfit,anim,stride=0,happy=false){
    if(!this.ready)return false;
    let frame=anim==='run'?Math.floor(stride*8)%8:({idle:8,jump:9,double:10,fall:11,hurt:12,dead:13,victory:14})[anim]??8;
    const running=anim==='run',sheet=happy?this.happy:running?this.run:this.actor;if(happy&&!running)frame+=8;const cw=sheet.width/4,ch=sheet.height/(happy?6:running?2:4);
    const height=running?Math.round(scale*50*ch/(happy?this.happyRunHeight:this.runHeight)):Math.round(scale*50),width=running?Math.round(height*cw/ch):height,feet=y+scale*20,footOffset=happy?(running?this.happyGround:this.happyFeet[frame])/ch:running?this.runGround/ch:1;
    c.save();c.imageSmoothingEnabled=false;
    if(running)c.translate(0,-Math.round((1-Math.cos(stride*Math.PI*4))*scale*.35));
    if(anim==='idle')c.translate(0,Math.round(Math.sin(t*2)*scale*.5));
    if(anim==='victory')c.translate(0,-Math.round(Math.abs(Math.sin(t*5))*scale*2));
    // Palettes retain the reference silhouette and its full detail.
    c.filter=['none','grayscale(1) brightness(.72)','sepia(.4) saturate(2)','sepia(.4) hue-rotate(310deg) saturate(.8) brightness(1.25)','sepia(.4) hue-rotate(220deg) saturate(.55) brightness(1.1)'][outfit]||'none';
    c.drawImage(sheet,frame%4*cw,Math.floor(frame/4)*ch,cw,ch,Math.round(x-width/2),Math.round(feet-height*footOffset),width,height);
    c.restore();return true;
  },
  rose(c,x,y,r=10){return this.object(c,0,x,y,r*2.8)},
  object(c,index,x,y,size){if(!this.objectsReady)return false;const w=this.objects.width/4,h=this.objects.height/4;c.drawImage(this.objects,index%4*w,Math.floor(index/4)*h,w,h,Math.round(x-size/2),Math.round(y-size/2),Math.round(size),Math.round(size));return true},
  background(c,camera,n,t,menu){
    if(menu&&this.menuReady){c.drawImage(this.menu,0,0,960,540);for(let i=0;i<22;i++)this.petal(c,(i*73+t*(12+i%4))%960,(i*41+t*(8+i%6))%540,t+i,i%3?'#b92448':'#ee6283',1);return true}
    if(!this.sceneReady)return false;const shift=camera*.055%960;
    c.drawImage(this.softScenes[n],-shift,0);if(shift)c.drawImage(this.softScenes[n],960-shift,0);
    return true;
  },
  petal(c,x,y,angle,color,size=1){c.save();c.translate(Math.round(x),Math.round(y));c.rotate(Math.sin(angle)*.65);c.fillStyle='#580e2b';c.fillRect(-3*size,-2*size,5*size,5*size);c.fillStyle=color;c.fillRect(-2*size,-3*size,4*size,5*size);c.fillRect(-3*size,-1*size,6*size,2*size);c.fillStyle='#ff92ab';c.fillRect(-size,-2*size,size,2*size);c.restore()},
  platform(c,p,camera,y){let x=Math.round(p.x-camera);if(x>990||x+p.w<-30)return;
    if(this.objectsReady){c.save();c.beginPath();c.rect(x,y-1,p.w,p.kind==='ground'?120:p.h+8);c.clip();const iw=this.objects.width,ih=this.objects.height;for(let j=0;j<p.w;j+=160)c.drawImage(this.objects,iw*.025,ih*.78,iw*.28,ih*.22,x+j,y-8,160,120);for(let j=20;j<p.w;j+=65)this.rose(c,x+j,y+3,7);if(p.kind==='step'){c.fillStyle='#efb2c6';c.fillRect(x,y-2,p.w,3)}c.restore();return}

  }
};
RoseArt.load();
