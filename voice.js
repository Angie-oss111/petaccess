/* Browser speech recognition; audio is never recorded or uploaded by this app. */
let voiceSession=null;

function chatComposer(){return `<form class="chat-input-wrap" id="chat-form"><div class="chat-input"><input name="message" aria-label="告诉 AI 你的出行想法" aria-describedby="voice-status" placeholder="想去哪儿？打字或点语音" autocomplete="off" required><button class="voice-button" type="button" data-action="voice-input" aria-label="开始语音输入" aria-pressed="false" title="中文语音输入">${icon('mic')}<span>语音</span></button><button class="chat-send" type="submit" aria-label="发送消息">${icon('send')}</button></div><p class="voice-status" id="voice-status" role="status" aria-live="polite" aria-atomic="true">中文语音转文字，检查后再发送</p><p class="chat-caption">AI 路线交互演示 · 基于本地示例库生成，未接入真实模型</p></form>`}

function setVoiceStatus(message,mode='idle',form=document.querySelector('#chat-form')){
 if(!form?.isConnected)return;
 form.dataset.voice=mode;
 form.querySelector('#voice-status').textContent=message;
 const busy=['connecting','listening','stopping'].includes(mode),button=form.querySelector('.voice-button');
 button.setAttribute('aria-pressed',String(busy));
 button.setAttribute('aria-label',mode==='connecting'?'取消语音输入':busy?'结束语音输入':'开始语音输入');
 button.querySelector('span').textContent=mode==='connecting'?'取消':busy?'结束':'语音';
 button.disabled=mode==='stopping';
 form.querySelector('.chat-send').disabled=busy;
 form.elements.message.readOnly=busy;
}

function finishVoice(session,message,mode='idle'){
 if(voiceSession!==session)return;
 clearTimeout(session.timer);voiceSession=null;
 setVoiceStatus(message,mode,session.form);
}

function cancelVoiceInput(message='语音输入已结束，文字已保留'){
 const session=voiceSession;if(!session)return;
 // Invalidate before abort: late callbacks must never affect a new dialog/session.
 finishVoice(session,message);
 try{session.recognition.abort()}catch{}
}

function stopVoiceInput(){
 const session=voiceSession;if(!session)return;
 if(!session.started){cancelVoiceInput('已取消语音输入，可以继续打字');return}
 setVoiceStatus('正在整理文字，请稍候…','stopping',session.form);
 clearTimeout(session.timer);
 session.timer=setTimeout(()=>cancelVoiceInput('语音已结束，请检查文字后发送'),5000);
 try{session.recognition.stop()}catch{cancelVoiceInput('语音已结束，请检查文字后发送')}
}

function startVoiceInput(){
 if(voiceSession){stopVoiceInput();return}
 const form=document.querySelector('#chat-form');if(!form)return;
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition){setVoiceStatus('当前浏览器不支持网页语音，可用手机键盘的麦克风听写，或在 Safari / Chrome 中打开。','error',form);return}
 if(!window.isSecureContext){setVoiceStatus('语音需要安全连接，请从线上 HTTPS 链接打开，或使用键盘听写。','error',form);return}
 let recognition;
 try{recognition=new Recognition()}catch{setVoiceStatus('暂时无法启动语音，请使用键盘听写或稍后重试。','error',form);return}
 const input=form.elements.message;
 const session={recognition,form,input,draft:input.value,started:false,heard:false,timer:null};
 voiceSession=session;
 recognition.lang=voiceLanguage();recognition.continuous=false;recognition.interimResults=true;recognition.maxAlternatives=1;
 const isCurrent=()=>voiceSession===session&&form.isConnected;
 recognition.onstart=()=>{
  if(!isCurrent()){try{recognition.abort()}catch{}return}
  session.started=true;clearTimeout(session.timer);
  setVoiceStatus('正在听…说完后点“结束”，或等待自动结束','listening',form);
  session.timer=setTimeout(stopVoiceInput,60000);
 };
 recognition.onresult=event=>{
  if(!isCurrent())return;
  let transcript='';for(let i=0;i<event.results.length;i++)transcript+=event.results[i][0]?.transcript||'';
  if(!transcript.trim())return;
  session.heard=true;input.value=session.draft+(session.draft.trim()?' ':'')+transcript.trim();
  input.scrollLeft=input.scrollWidth;
 };
 recognition.onerror=event=>{
  if(!isCurrent())return;
  const messages={
   'not-allowed':'未能使用麦克风，请检查浏览器的麦克风权限，或使用键盘听写。',
   'service-not-allowed':'当前浏览器未开放语音服务，可在 Safari / Chrome 中打开，或使用键盘听写。',
   'audio-capture':'没有找到可用麦克风，请检查设备，或使用键盘输入。',
   'no-speech':'没有听清，可以点“语音”再试一次，或直接打字。',
   'network':'语音服务连接失败，请检查网络后重试，或使用键盘听写。',
   'language-not-supported':'当前语音服务不支持所选语言，请使用键盘听写。',
   'aborted':'语音输入已结束，可以继续编辑文字。'
  };
  finishVoice(session,messages[event.error]||'语音识别暂不可用，请重试或使用键盘听写。','error');
  try{recognition.abort()}catch{}
 };
 recognition.onend=()=>{
  if(!isCurrent())return;
  finishVoice(session,session.heard?'文字已填入，可修改后点击发送':'没有听到内容，点“语音”重试或直接打字');
 };
 input.blur();
 setVoiceStatus('请允许使用麦克风；识别可能由浏览器的在线语音服务处理。','connecting',form);
 session.timer=setTimeout(()=>{
  if(voiceSession===session){finishVoice(session,'语音启动超时，请检查麦克风权限后重试，或使用键盘听写。','error');try{recognition.abort()}catch{}}
 },15000);
 try{recognition.start()}catch{
  finishVoice(session,'语音启动失败，请稍后重试或使用键盘听写。','error');try{recognition.abort()}catch{}
 }
}

document.addEventListener('click',event=>{if(event.target.closest('[data-action="voice-input"]'))startVoiceInput()});
document.addEventListener('submit',event=>{
 if(event.target.id==='chat-form'&&voiceSession){event.preventDefault();event.stopImmediatePropagation();stopVoiceInput()}
},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelVoiceInput('语音已暂停，文字已保留；需要时可重新开始')});
window.addEventListener('pagehide',()=>cancelVoiceInput());
