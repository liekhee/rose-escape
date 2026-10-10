'use strict';
const RoseBGM={
  enabled:false,paused:false,hidden:false,volume:.35,playing:false,request:0,
  init(){
    this.button=document.querySelector('#musicToggle');
    this.media=document.querySelector('#bgmAudio');
    this.media.loop=true;this.media.volume=this.volume;
    this.button.addEventListener('click',()=>this.toggle());
    this.media.addEventListener('error',()=>this.fail());
    this.paint();
  },
  paint(){
    this.button.textContent='♫';
    this.button.setAttribute('aria-pressed',String(this.enabled));
    this.button.setAttribute('aria-label',this.enabled?'关闭 Eight 背景音乐':'开启 Eight 背景音乐');
    this.button.title='张元英《8》 · 点击开启或关闭';
  },
  toggle(){this.enabled=!this.enabled;this.paint();return this.sync()},
  fail(){this.enabled=false;this.playing=false;this.request++;this.media.pause();this.paint();this.button.title='音频暂时无法播放，请检查网络后点击重试'},
  async sync(options={}){
    if('paused' in options)this.paused=options.paused;
    if('hidden' in options)this.hidden=options.hidden;
    const request=++this.request;
    if(!this.enabled||this.paused||this.hidden){this.media.pause();this.playing=false;return}
    this.media.volume=this.volume;
    try{
      await this.media.play();
      if(request!==this.request)return;
      this.playing=true;this.paint();
    }catch(error){if(request===this.request)this.fail()}
  },
  setVolume(volume){const number=Number(volume);if(!Number.isFinite(number))return;this.volume=Math.max(0,Math.min(1,number));this.media.volume=this.volume}
};
RoseBGM.init();window.RoseBGM=RoseBGM;
