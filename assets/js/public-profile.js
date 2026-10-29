import { $, supabase, isConfigured, esc, safeUrl, initials } from './core.js';
const username=(new URLSearchParams(location.search).get('u')||'').toLowerCase().trim();
function fail(title,body){$('#publicShell').innerHTML=`<section class="not-found"><div class="brand-mark" style="margin:0 auto 18px">L</div><h1>${esc(title)}</h1><p class="muted">${esc(body)}</p><a class="btn btn-primary" href="index.html">اعرف أكتر عن Linkora ↗</a></section>`;document.title=`${title} — Linkora`;}
function ageFromDate(s){if(!s)return null;const d=new Date(`${s}T00:00:00`);if(Number.isNaN(d.getTime()))return null;const n=new Date();let a=n.getFullYear()-d.getFullYear();if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate()))a--;return a>=0&&a<=125?a:null;}
function linkLabelIcon(icon){const map={instagram:'◎',linkedin:'in',facebook:'f',whatsapp:'◉',github:'⌘',youtube:'▶',tiktok:'♪',telegram:'➤',website:'↗',email:'✉',phone:'☎'};return map[String(icon||'').toLowerCase()]||icon||'↗';}
async function init(){
 if(!username){fail('فين اسم الصفحة؟','الرابط ناقصه اسم المستخدم. افتح الرابط اللي صاحب الصفحة شاركه معاك.');return;}
 if(!isConfigured){fail('الموقع لسه محتاج إعداد','صاحب المنصة لازم يضيف إعدادات Supabase في assets/js/config.js قبل تشغيل الصفحات.');return;}
 try{
  const {data,error}=await supabase.rpc('get_public_profile',{p_username:username});if(error)throw error;if(!data?.profile){fail('الصفحة غير متاحة','يمكن صاحب الصفحة لسه ما نشرهاش، أو اسم المستخدم في الرابط غير صحيح.');return;}
  const p=data.profile,x=data.extras||{},links=data.links||[],t={accent:'#8a7cff',accent2:'#62d9cf',background:'#0c101b',mode:'dark',animation:'aurora',card:'glass',...(p.theme||{})};
  document.title=`${p.display_name||p.username} — Linkora`;
  const live=$('#profileLive'),card=$('#publicProfile');live.style.setProperty('--pub-bg',t.mode==='light'?'#eef0f7':t.background);live.style.setProperty('--pub-text',t.mode==='light'?'#252a41':'#f4f5ff');live.style.setProperty('--pub-accent',t.accent);live.style.setProperty('--pub-accent2',t.accent2);
  live.style.background=t.mode==='light'?'#eef0f7':t.background;
  const cardBg=t.card==='solid'?(t.mode==='light'?'#fff':t.background):(t.card==='outline'?'transparent':(t.mode==='light'?'rgba(255,255,255,.82)':'rgba(18,23,37,.80)'));
  card.style.setProperty('--pub-card',cardBg);card.style.borderRadius=t.card==='outline'?'20px':'32px';if(t.card==='outline'){card.style.backdropFilter='none';card.style.boxShadow='none';}
  card.classList.add(`anim-${t.animation||'aurora'}`);if(t.animation==='none'){card.classList.add('anim-none');live.classList.add('no-orbs');live.style.setProperty('--pub-accent','transparent');live.style.setProperty('--pub-accent2','transparent');}if(t.animation==='float')card.style.setProperty('--angle','0deg');if(t.animation==='glow'){$('#publicAvatar').style.animation='none';}
  const av=$('#publicAvatar');if(p.avatar_url&&safeUrl(p.avatar_url)){const img=document.createElement('img');img.id='publicAvatar';img.className='public-avatar';img.alt=`صورة ${p.display_name||p.username}`;img.src=safeUrl(p.avatar_url);img.referrerPolicy='no-referrer';img.onerror=()=>{const f=document.createElement('div');f.id='publicAvatar';f.className='public-avatar placeholder';f.textContent=initials(p.display_name||p.username);img.replaceWith(f);};av.replaceWith(img);}else{av.textContent=initials(p.display_name||p.username);}
  $('#publicName').textContent=p.display_name||p.username;$('#publicUsername').textContent='@'+p.username;$('#publicSubtitle').textContent=p.subtitle||'';$('#publicSubtitle').hidden=!p.subtitle;$('#publicBio').textContent=p.bio||'';$('#publicBio').hidden=!p.bio;
  const facts=[];const age=Number.isInteger(x.age)?x.age:null;if(age!==null&&age>=0&&age<=125)facts.push(`${age} سنة`);if(x.location)facts.push(`⌖ ${x.location}`);if(x.height_cm)facts.push(`↕ ${x.height_cm} سم`);if(x.weight_kg)facts.push(`⚖ ${x.weight_kg} كجم`);if(x.occupation)facts.push(x.occupation);$('#publicFacts').innerHTML=facts.map(f=>`<span class="fact-chip">${esc(f)}</span>`).join('');
  const host=$('#publicLinks');host.innerHTML='';for(const l of links){const href=safeUrl(l.url);if(!href)continue;const a=document.createElement('a');a.className='public-link';a.href=href;a.rel='noopener noreferrer';if(/^https?:/i.test(href)){a.target='_blank';}a.innerHTML=`<span class="link-icon">${esc(linkLabelIcon(l.icon))}</span><span class="link-label">${esc(l.label)}</span><span class="external">↗</span>`;host.append(a);}
  if(!links.length)host.innerHTML='<p class="muted small">لم تتم إضافة روابط إلى هذه الصفحة بعد.</p>';
 }catch(err){console.error(err);fail('حصل خطأ في تحميل الصفحة','تحقق من إعداد قاعدة البيانات ودالة get_public_profile في Supabase.');}
}
init();
