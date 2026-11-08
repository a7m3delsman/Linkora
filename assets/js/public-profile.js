import { $, supabase, isConfigured, esc, safeUrl, initials } from './core.js';
import { renderLinkIcon } from './link-icons.js';
const username=(new URLSearchParams(location.search).get('u')||'').toLowerCase().trim();
function fail(title,body){$('#publicShell').innerHTML=`<section class="not-found"><div class="brand-mark" style="margin:0 auto 18px">L</div><h1>${esc(title)}</h1><p class="muted">${esc(body)}</p><a class="btn btn-primary" href="index.html">اعرف أكتر عن Linkora ↗</a></section>`;document.title=`${title} — Linkora`;}
function openAvatar(src){if(!src)return;$('#avatarZoom').src=src;$('#avatarLightbox').hidden=false;document.body.style.overflow='hidden';}
function closeAvatar(){ $('#avatarLightbox').hidden=true;$('#avatarZoom').removeAttribute('src');document.body.style.overflow=''; }
function logEvent(eventType, linkId=null){void (async()=>{try{await supabase.rpc('log_profile_event',{p_username:username,p_event:eventType,p_link_id:linkId});}catch(_){/* Analytics must never block the public page. */}})();}
$('#closeAvatarLightbox').addEventListener('click',closeAvatar);
$('#avatarLightbox').addEventListener('click',e=>{if(e.target===$('#avatarLightbox'))closeAvatar();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAvatar();});
async function init(){
 if(!username){fail('فين اسم الصفحة؟','الرابط ناقصه اسم المستخدم. افتح الرابط اللي صاحب الصفحة شاركه معاك.');return;}
 if(!isConfigured){fail('الموقع لسه محتاج إعداد','صاحب المنصة لازم يضيف إعدادات Supabase في assets/js/config.js قبل تشغيل الصفحات.');return;}
 try{
  const {data,error}=await supabase.rpc('get_public_profile',{p_username:username});if(error)throw error;if(!data?.profile){fail('الصفحة غير متاحة','يمكن صاحب الصفحة لسه ما نشرهاش، أو اسم المستخدم في الرابط غير صحيح.');return;}
  const p=data.profile,x=data.extras||{},links=data.links||[],membership=data.membership||{tier:'free',is_verified:false,show_membership_badge:true,show_verified_badge:true},t={accent:'#8a7cff',accent2:'#62d9cf',background:'#0c101b',mode:'dark',animation:'aurora',card:'glass',linkCardStyle:'glass',linkAnimation:'lift',...(p.theme||{})};const cardLanguage=t.cardLanguage==='en'?'en':'ar';const words=cardLanguage==='en'?{age:'years old',height:'cm',weight:'kg',empty:'No links have been added to this page yet.',footer:'Created with Linkora',followers:'Followers',featured:'Featured'}:{age:'سنة',height:'سم',weight:'كجم',empty:'لم تتم إضافة روابط إلى هذه الصفحة بعد.',footer:'صُنع باستخدام Linkora',followers:'متابع',featured:'رابط مميز'};
  document.documentElement.lang=cardLanguage;document.documentElement.dir='ltr';document.body.dir='ltr';
  document.title=`${p.display_name||p.username} — Linkora`;
  const live=$('#profileLive'),card=$('#publicProfile');card.dir=cardLanguage==='en'?'ltr':'rtl';live.style.setProperty('--pub-bg',t.mode==='light'?'#eef0f7':t.background);live.style.setProperty('--pub-text',t.mode==='light'?'#252a41':'#f4f5ff');live.style.setProperty('--pub-accent',t.accent);live.style.setProperty('--pub-accent2',t.accent2);live.style.background=t.mode==='light'?'#eef0f7':t.background;
  const cardBg=t.card==='solid'?(t.mode==='light'?'#fff':t.background):(t.card==='outline'?'transparent':(t.mode==='light'?'rgba(255,255,255,.82)':'rgba(18,23,37,.80)'));
  card.style.setProperty('--pub-card',cardBg);card.classList.toggle('card-outline',t.card==='outline');
  const pageBackgroundUrl=safeUrl(t.pageBackgroundUrl||'');
  live.style.backgroundImage=pageBackgroundUrl?`linear-gradient(rgba(5,8,17,.25),rgba(5,8,17,.25)),url("${pageBackgroundUrl}")`:'';
  live.style.backgroundSize='cover';live.style.backgroundPosition='center';
  const frameBackgroundUrl=safeUrl(t.frameBackgroundUrl||'');
  card.style.setProperty('--pub-card-image',frameBackgroundUrl?`url("${frameBackgroundUrl}")`:'none');
  card.style.setProperty('--pub-card-overlay',frameBackgroundUrl?(t.mode==='light'?'rgba(255,255,255,.36)':'rgba(7,10,18,.42)'):'transparent');
  card.style.borderRadius=t.card==='outline'?'20px':'32px';if(t.card==='outline'){card.style.backdropFilter='none';card.style.boxShadow='none';}
  card.classList.add(`anim-${t.animation||'aurora'}`);if(t.animation==='none'){card.classList.add('anim-none');live.classList.add('no-orbs');live.style.setProperty('--pub-accent','transparent');live.style.setProperty('--pub-accent2','transparent');}if(t.animation==='float')card.style.setProperty('--angle','0deg');if(t.animation==='glow'){$('#publicAvatar').style.animation='none';}
  const coverUrl=safeUrl(p.cover_url||'');const coverEl=$('#publicCover');if(coverUrl){coverEl.style.backgroundImage=`url("${coverUrl}")`;coverEl.hidden=false;}else{coverEl.style.backgroundImage='';coverEl.hidden=true;}
  const av=$('#publicAvatar');if(p.avatar_url&&safeUrl(p.avatar_url)){const img=document.createElement('img');img.id='publicAvatar';img.className='public-avatar zoomable-avatar';img.alt=`صورة ${p.display_name||p.username}`;img.src=safeUrl(p.avatar_url);img.referrerPolicy='no-referrer';img.onerror=()=>{const f=document.createElement('div');f.id='publicAvatar';f.className='public-avatar placeholder';f.textContent=initials(p.display_name||p.username);img.replaceWith(f);};img.addEventListener('click',()=>openAvatar(img.src));img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openAvatar(img.src);}});img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label','تكبير صورة الملف الشخصي');av.replaceWith(img);}else{av.textContent=initials(p.display_name||p.username);}
  $('#publicName').textContent=p.display_name||p.username;$('#publicName').dir='auto';$('#publicUsername').textContent='@'+p.username;$('#publicSubtitle').textContent=p.subtitle||'';$('#publicSubtitle').dir='auto';$('#publicSubtitle').hidden=!p.subtitle;$('#publicBio').textContent=p.bio||'';$('#publicBio').dir='auto';$('#publicBio').hidden=!p.bio;$('#publicFooterLink').textContent=words.footer;
  const badgeHost=$('#publicBadges');badgeHost.innerHTML='';
  if(membership.show_membership_badge!==false){
    if(membership.tier==='vip'){const b=document.createElement('span');b.className='member-badge badge-vip';b.textContent='✦ VIP';b.title='Linkora VIP';badgeHost.append(b);}
    else if(membership.tier==='pro'){const b=document.createElement('span');b.className='member-badge badge-pro';b.textContent='PRO';b.title='Linkora Pro';badgeHost.append(b);}
  }
  if(membership.is_verified && membership.show_verified_badge!==false){const b=document.createElement('span');b.className='member-badge badge-verified';b.textContent='✓';b.title='Linkora Verified';b.setAttribute('aria-label','Linkora Verified');badgeHost.append(b);}
  const facts=[];const age=Number.isInteger(x.age)?x.age:null;if(age!==null&&age>=0&&age<=125)facts.push(age+' '+words.age);if(x.location)facts.push('⌖ '+x.location);if(x.height_cm)facts.push('↕ '+x.height_cm+' '+words.height);if(x.weight_kg)facts.push('⚖ '+x.weight_kg+' '+words.weight);if(x.occupation)facts.push(x.occupation);$('#publicFacts').innerHTML=facts.map(f=>'<span class="fact-chip" dir="auto">'+esc(f)+'</span>').join('');
  const cardsHost=$('#publicLinks'),iconsHost=$('#publicSocialIcons');cardsHost.innerHTML='';iconsHost.innerHTML='';
  let renderedCards=0,renderedIcons=0;
  for(const l of links){
    const href=safeUrl(l.url);if(!href)continue;
    const followerMeta=(t.followerCounts||{})[l.url]||(t.followerCounts||{})[href]||(t.followerCounts||{})[l.id]||{};
    const followerNumber=followerMeta.count===null||followerMeta.count===undefined?'':Number(followerMeta.count);
    const followerHtml=followerMeta.show&&followerNumber!==''&&Number.isFinite(followerNumber)?'<small class="link-followers">'+followerNumber.toLocaleString('en-US')+' '+words.followers+'</small>':'';
    if(l.show_as_card!==false){
      const a=document.createElement('a');a.className=`public-link${l.is_featured?' featured':''}`;a.href=href;a.rel='noopener noreferrer';if(/^https?:/i.test(href))a.target='_blank';
      a.setAttribute('aria-label',l.label||'Open link');
      a.innerHTML=(l.is_featured?'<span class="featured-label">✦ '+words.featured+'</span>':'')+renderLinkIcon(href,l.label,l.icon)+'<span class="link-copy"><span class="link-label" dir="auto">'+esc(l.label)+'</span>'+followerHtml+'</span><span class="external" aria-hidden="true">↗</span>';
      a.addEventListener('click',()=>logEvent('click',l.id));cardsHost.append(a);renderedCards++;
    }
    if(l.show_as_icon===true){
      const a=document.createElement('a');a.className=`social-icon-link${l.is_featured?' featured':''}`;a.href=href;a.rel='noopener noreferrer';if(/^https?:/i.test(href))a.target='_blank';
      a.title=l.label||'Social link';a.setAttribute('aria-label',l.label||'Social link');
      a.innerHTML=renderLinkIcon(href,l.label,l.icon,'social-icon-glyph');
      a.addEventListener('click',()=>logEvent('click',l.id));iconsHost.append(a);renderedIcons++;
    }
  }
  cardsHost.className=`public-links style-${t.linkCardStyle||'glass'} motion-${t.linkAnimation||'lift'}`;
  cardsHost.hidden=renderedCards===0;iconsHost.hidden=renderedIcons===0;
  if(!renderedCards&&!renderedIcons){cardsHost.hidden=false;cardsHost.innerHTML='<p class="muted small">'+words.empty+'</p>';}
  const qrHost=$('#desktopMobileQrCode'),qrPanel=$('#desktopMobileQr');if(qrHost&&qrPanel&&window.QRCode){qrHost.innerHTML='';new QRCode(qrHost,{text:window.location.href,width:118,height:118,colorDark:'#172033',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});qrPanel.hidden=false;}
  try { const key=`linkora-view-${username}`; if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');logEvent('view');} } catch { logEvent('view'); }
 }catch(err){console.error(err);fail('حصل خطأ في تحميل الصفحة','تحقق من إعداد قاعدة البيانات ودالة get_public_profile في Supabase.');}
}
init();
