import { $, $$, supabase, isConfigured, showConfigWarning, requireUser, isAdmin, esc, cleanSlug, safeUrl, formatDate, toast, signOut, appUrl } from './core.js';

const presets = {
  aurora:{accent:'#8a7cff',accent2:'#62d9cf',background:'#0c101b',mode:'dark',animation:'aurora',card:'glass'},
  sunset:{accent:'#ff9d75',accent2:'#ed84bd',background:'#19111c',mode:'dark',animation:'glow',card:'glass'},
  ocean:{accent:'#5fa8ff',accent2:'#57e2d0',background:'#091923',mode:'dark',animation:'aurora',card:'glass'},
  forest:{accent:'#8bdc9b',accent2:'#d3e79e',background:'#111d19',mode:'dark',animation:'float',card:'solid'},
  mono:{accent:'#b4c0d8',accent2:'#f0f3ff',background:'#171a22',mode:'dark',animation:'glow',card:'outline'},
  rose:{accent:'#d18aff',accent2:'#ff9dbb',background:'#1a1221',mode:'dark',animation:'aurora',card:'glass'}
};
let user = null, profileId = null, profile = null, extras = {}, savedLinks = [], selectedFile = null, currentAvatar = '', admin = false, saving = false;
const val = id => $(`#${id}`).value;
const checked = id => $(`#${id}`).checked;
const setVal = (id, v='') => { $(`#${id}`).value = v ?? ''; };
const fields = ['displayName','username','subtitle','bio','avatarUrl','birthDate','location','heightCm','weightKg','occupation','showBirthDate','showLocation','showHeight','showWeight','showOccupation','accent','accent2','background','mode','animation','card','publishToggle'];

function currentTheme(){ return { accent:val('accent')||presets.aurora.accent, accent2:val('accent2')||presets.aurora.accent2, background:val('background')||presets.aurora.background, mode:val('mode'), animation:val('animation'), card:val('card') }; }
function shareUrl(){ const slug=cleanSlug(val('username')); return slug ? `${new URL('p.html',location.href).href}?u=${encodeURIComponent(slug)}` : ''; }
function updateShare(){ const url=shareUrl(); $('#shareUrl').value=url; $('#openPublicBtn').href=url || 'p.html'; $('#openPageLink').href=url || 'p.html'; }
function syncPublish(v){ $('#publishToggle').checked=v; $('#publishBottom').checked=v; }
function updatePreview(){
  $('#bioCount').textContent=val('bio').length;
  $('#previewName').textContent=val('displayName').trim()||'اسمك هنا';
  $('#previewSubtitle').textContent=val('subtitle').trim()||'سطر تعريفي قصير';
  $('#previewBio').textContent=val('bio').trim()||'اكتب نبذة صغيرة عنك هنا…';
  const t=currentTheme(), p=$('#previewProfile');
  p.style.setProperty('--pbg', t.card==='solid' ? t.background : (t.mode==='light' ? '#f8f8ff' : t.background));
  p.style.setProperty('--ptxt',t.mode==='light'?'#22283b':'#f4f5ff');
  p.style.setProperty('--paccent',t.accent);p.style.setProperty('--paccent2',t.accent2);
  p.classList.toggle('no-anim',t.animation==='none');p.classList.toggle('card-outline',t.card==='outline');
  if(t.animation==='float') p.style.setProperty('--angle','0deg');
  p.style.background=t.card==='outline'?'transparent':(t.card==='glass'?(t.mode==='light'?'rgba(248,248,255,.88)':'rgba(18,23,37,.82)'):t.background);
  const avatar=$('#previewAvatar'), src=val('avatarUrl').trim();
  if(selectedFile){
    if(!avatar.dataset.tempUrl) avatar.dataset.tempUrl=URL.createObjectURL(selectedFile);
    if(avatar.tagName==='IMG'){ avatar.src=avatar.dataset.tempUrl; avatar.className='preview-avatar'; }
    else { const img=document.createElement('img');img.id='previewAvatar';img.className='preview-avatar';img.src=avatar.dataset.tempUrl;img.alt='صورة البروفايل';avatar.replaceWith(img); }
  } else if(src && safeUrl(src)){
    if(avatar.tagName==='IMG'){avatar.src=safeUrl(src);avatar.className='preview-avatar';}
    else { const img=document.createElement('img');img.id='previewAvatar';img.className='preview-avatar';img.src=safeUrl(src);img.alt='صورة البروفايل';img.onerror=()=>{img.replaceWith(makeAvatarFallback());};avatar.replaceWith(img); }
  } else if(avatar.tagName==='IMG') avatar.replaceWith(makeAvatarFallback());
  else { avatar.textContent=(val('displayName').trim().slice(0,1)||'L').toUpperCase();avatar.className='preview-avatar-fallback'; }
  const facts=[];
  if(checked('showBirthDate') && val('birthDate')) { const age=ageFromDate(val('birthDate'));if(age!==null)facts.push(`${age} سنة`); }
  if(checked('showLocation') && val('location').trim()) facts.push(`⌖ ${val('location').trim()}`);
  if(checked('showHeight') && val('heightCm')) facts.push(`↕ ${val('heightCm')} سم`);
  if(checked('showWeight') && val('weightKg')) facts.push(`⚖ ${val('weightKg')} كجم`);
  if(checked('showOccupation') && val('occupation').trim()) facts.push(val('occupation').trim());
  $('#previewFacts').innerHTML=facts.map(x=>`<span class="fact-chip">${esc(x)}</span>`).join('');
  const rows=$$('#linkRows .link-edit-row').map(row=>({label:row.querySelector('.link-label-input').value.trim(),url:row.querySelector('.link-url-input').value.trim(),icon:row.querySelector('.link-icon-input').value.trim()})).filter(x=>x.label && safeUrl(x.url));
  $('#previewLinks').innerHTML=rows.map(l=>`<div class="preview-link"><span>${esc(l.icon||'↗')} &nbsp; ${esc(l.label)}</span><span>↗</span></div>`).join('') || '<p class="muted small">روابطك هتظهر هنا بعد إضافتها.</p>';
  updateShare();
}
function makeAvatarFallback(){const d=document.createElement('div');d.id='previewAvatar';d.className='preview-avatar-fallback';d.textContent=(val('displayName').trim().slice(0,1)||'L').toUpperCase();return d;}
function ageFromDate(s){if(!s)return null;const d=new Date(`${s}T00:00:00`);if(Number.isNaN(d.getTime()))return null;const now=new Date();let a=now.getFullYear()-d.getFullYear();if(now.getMonth()<d.getMonth()||(now.getMonth()===d.getMonth()&&now.getDate()<d.getDate()))a--;return a>=0&&a<=125?a:null;}
function renderLinkRows(links=[]){
  const host=$('#linkRows');host.innerHTML='';
  links.forEach(l=>{
    const row=document.createElement('div');row.className='link-edit-row';row.dataset.linkId=l.id||'';
    row.innerHTML=`<input class="link-label-input" maxlength="70" aria-label="اسم الرابط" placeholder="Instagram" value="${esc(l.label||'')}"><input class="link-url-input" type="url" aria-label="عنوان الرابط" placeholder="https://…" value="${esc(l.url||'')}"><input class="link-icon-input" maxlength="8" aria-label="رمز الرابط" placeholder="↗" value="${esc(l.icon||'↗')}"><button type="button" class="btn btn-danger btn-small remove-link" aria-label="حذف الرابط">حذف</button>`;
    host.append(row);
  });
  $('#emptyLinks').hidden=links.length>0;
}
function addLinkRow(link={}){const current=$$('#linkRows .link-edit-row').map(row=>({id:row.dataset.linkId,label:row.querySelector('.link-label-input').value,url:row.querySelector('.link-url-input').value,icon:row.querySelector('.link-icon-input').value}));current.push(link);renderLinkRows(current);updatePreview();}
function setPreset(name){const p=presets[name];if(!p)return;Object.entries(p).forEach(([k,v])=>setVal(k,v));$$('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===name));updatePreview();}
async function loadPage(){
  if(!isConfigured){showConfigWarning();$('#currentEmail').textContent='Supabase غير مضبوط';return;}
  user=await requireUser();
  const requestedId=new URLSearchParams(location.search).get('user');
  try{admin=await isAdmin(user.id);$('#adminNav').hidden=!admin;}catch{admin=false;}
  if(requestedId && requestedId!==user.id && !admin) throw new Error('التعديل بالنيابة متاح لمدير المنصة فقط.');
  profileId=requestedId||user.id;
  const supportMode=profileId!==user.id;
  $('#currentEmail').textContent=(user.email||'')+(supportMode?' · وضع الدعم الفني':'');
  if(supportMode){$('#editorHeading').textContent='تعديل صفحة عضو';$('.page-heading p').textContent='وضع الدعم الفني: التعديلات ستظهر في صفحة العضو بعد الحفظ.';$('#supportForm').closest('.panel').hidden=true;$('#adminMessagesPanel').hidden=true;}
  const {data:p,error:pErr}=await supabase.from('profiles').select('*').eq('id',profileId).maybeSingle();if(pErr)throw pErr;
  if(!p){toast('لم يتم العثور على ملفك. شغّل schema.sql في Supabase.','error');return;}
  profile=p;
  const {data:x,error:xErr}=await supabase.from('profile_extras').select('*').eq('profile_id',profileId).maybeSingle();if(xErr)throw xErr;extras=x||{};
  const {data:ls,error:lErr}=await supabase.from('profile_links').select('*').eq('profile_id',profileId).order('sort_order').order('created_at');if(lErr)throw lErr;savedLinks=ls||[];
  setVal('displayName',p.display_name);setVal('username',p.username);setVal('subtitle',p.subtitle);setVal('bio',p.bio);currentAvatar=p.avatar_url||'';setVal('avatarUrl',currentAvatar);
  setVal('birthDate',x?.birth_date||'');setVal('location',x?.location||'');setVal('heightCm',x?.height_cm??'');setVal('weightKg',x?.weight_kg??'');setVal('occupation',x?.occupation||'');
  ['showBirthDate','showLocation','showHeight','showWeight','showOccupation'].forEach(k=>$('#'+k).checked=!!x?.[({showBirthDate:'show_birth_date',showLocation:'show_location',showHeight:'show_height',showWeight:'show_weight',showOccupation:'show_occupation'})[k]]);
  const t={...presets.aurora,...(p.theme||{})};['accent','accent2','background','mode','animation','card'].forEach(k=>setVal(k,t[k]||presets.aurora[k]));syncPublish(!!p.is_published);renderLinkRows(savedLinks);updatePreview();
  if(p.theme?.accent) $$('[data-preset]').forEach(b=>b.classList.remove('active'));
  $('#saveTopBtn').disabled=false; await loadTickets(); if(!supportMode) await loadAdminMessages();
}
async function uploadAvatar(){
  const file=$('#avatarFile').files[0];if(!file)return safeUrl(val('avatarUrl'))||'';
  if(file.size>5*1024*1024)throw new Error('حجم الصورة أكبر من 5 ميجابايت.');
  if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type))throw new Error('نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP أو GIF.');
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const path=`${profileId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext||'jpg'}`;
  const {error}=await supabase.storage.from('linkora-avatars').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(error)throw error;
  const {data}=supabase.storage.from('linkora-avatars').getPublicUrl(path);return data.publicUrl;
}
async function saveAll(){
  if(saving)return;saving=true;const buttons=[$('#saveTopBtn'),$('#saveBottomBtn')];buttons.forEach(b=>{b.disabled=true;b.textContent='جارٍ الحفظ…';});
  try{
    if(!user)throw new Error('سجّل الدخول أولًا.');
    const name=val('displayName').trim(), slug=cleanSlug(val('username'));
    if(!name)throw new Error('اكتب الاسم الظاهر.');if(slug.length<3||slug.length>28)throw new Error('اسم الرابط لازم يكون من 3 إلى 28 حرفًا، ويحتوي حروفًا إنجليزية أو أرقامًا أو شرطة.');
    if(val('birthDate') && new Date(val('birthDate'))>new Date())throw new Error('تاريخ الميلاد لا يمكن أن يكون في المستقبل.');
    const normalizedLinks=[];for(const row of $$('#linkRows .link-edit-row')){const label=row.querySelector('.link-label-input').value.trim(),url=row.querySelector('.link-url-input').value.trim(),icon=row.querySelector('.link-icon-input').value.trim();if(!label&&!url)continue;if(!label||!url)throw new Error('أكمل اسم الرابط وعنوانه، أو احذف الصف الفارغ.');const valid=safeUrl(url);if(!valid)throw new Error(`عنوان الرابط غير صالح: ${label}. استخدم https:// أو mailto: أو tel:.`);normalizedLinks.push({id:row.dataset.linkId||null,label,url:valid,icon:icon||'↗',sort_order:normalizedLinks.length,is_enabled:true,profile_id:profileId});}
    let avatarUrl=currentAvatar;
    if($('#avatarFile').files[0]) avatarUrl=await uploadAvatar(); else if(val('avatarUrl').trim()){avatarUrl=safeUrl(val('avatarUrl'));if(!avatarUrl)throw new Error('رابط الصورة غير صالح.');} else avatarUrl='';
    const row={id:profileId,username:slug,display_name:name,subtitle:val('subtitle').trim(),bio:val('bio').trim(),avatar_url:avatarUrl,theme:currentTheme(),is_published:checked('publishToggle')};
    const {error:pErr}=await supabase.from('profiles').upsert(row,{onConflict:'id'});if(pErr)throw pErr;
    const x={profile_id:profileId,birth_date:val('birthDate')||null,show_birth_date:checked('showBirthDate'),height_cm:val('heightCm')?Number(val('heightCm')):null,show_height:checked('showHeight'),weight_kg:val('weightKg')?Number(val('weightKg')):null,show_weight:checked('showWeight'),location:val('location').trim(),show_location:checked('showLocation'),occupation:val('occupation').trim(),show_occupation:checked('showOccupation')};
    const {error:xErr}=await supabase.from('profile_extras').upsert(x,{onConflict:'profile_id'});if(xErr)throw xErr;
    const keepIds=normalizedLinks.filter(l=>l.id).map(l=>l.id);
    for(const old of savedLinks){if(!keepIds.includes(old.id)){const {error}=await supabase.from('profile_links').delete().eq('id',old.id).eq('profile_id',profileId);if(error)throw error;}}
    const toSave=normalizedLinks.map(l=>{const v={profile_id:profileId,label:l.label,url:l.url,icon:l.icon,sort_order:l.sort_order,is_enabled:true};if(l.id)v.id=l.id;return v;});
    if(toSave.length){const {error}=await supabase.from('profile_links').upsert(toSave,{onConflict:'id'});if(error)throw error;}
    else {const {error}=await supabase.from('profile_links').delete().eq('profile_id',profileId);if(error)throw error;}
    currentAvatar=avatarUrl;selectedFile=null;$('#avatarFile').value='';setVal('avatarUrl',avatarUrl);const temp=$('#previewAvatar')?.dataset?.tempUrl;if(temp)URL.revokeObjectURL(temp);if($('#previewAvatar'))delete $('#previewAvatar').dataset.tempUrl;
    const {data:updatedLinks,error:reloadLinksErr}=await supabase.from('profile_links').select('*').eq('profile_id',profileId).order('sort_order');if(!reloadLinksErr){savedLinks=updatedLinks||[];renderLinkRows(savedLinks);}
    const {data:updated,error:uErr}=await supabase.from('profiles').select('*').eq('id',profileId).single();if(!uErr)profile=updated;
    updatePreview();toast('اتحفظت التغييرات بنجاح ✦','success');
  }catch(err){toast(err.message||'حصل خطأ أثناء الحفظ.','error');}
  finally{saving=false;buttons.forEach((b,i)=>{b.disabled=false;b.textContent=i===0?'حفظ التغييرات':'حفظ التغييرات ✦';});updateShare();}
}
async function loadTickets(){
  if(profileId!==user.id){$('#myTickets').innerHTML='';return;}
  const {data,error}=await supabase.from('support_tickets').select('id,subject,message,status,admin_reply,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(10);
  const host=$('#myTickets');if(error){host.innerHTML='<p class="muted small">تعذر تحميل الطلبات.</p>';return;}
  if(!data?.length){host.innerHTML='<p class="muted small">لسه مفيش طلبات دعم.</p>';return;}
  host.innerHTML=data.map(t=>`<article class="ticket-card"><div class="ticket-top"><b>${esc(t.subject)}</b><span class="status-pill ${esc(t.status)}">${t.status==='open'?'مفتوح':t.status==='in_progress'?'قيد المتابعة':'مغلق'}</span></div><p>${esc(t.message)}</p>${t.admin_reply?`<div class="notice" style="margin-bottom:0"><b>رد الدعم:</b><br>${esc(t.admin_reply)}</div>`:''}<small class="muted">${formatDate(t.created_at)}</small></article>`).join('');
}
async function submitTicket(e){e.preventDefault();const subject=val('ticketSubject').trim(),message=val('ticketMessage').trim();if(subject.length<3||message.length<5){toast('اكتب عنوانًا وتفاصيل أوضح شوية.','error');return;}const b=e.submitter;b.disabled=true;try{const {error}=await supabase.from('support_tickets').insert({user_id:user.id,subject,message});if(error)throw error;setVal('ticketSubject','');setVal('ticketMessage','');toast('تم إرسال طلب الدعم.','success');await loadTickets();}catch(err){toast(err.message||'تعذر إرسال الطلب.','error');}finally{b.disabled=false;}}

async function loadAdminMessages(){
  const host=$('#myAdminMessages');
  const {data,error}=await supabase.from('admin_messages').select('id,subject,message,created_at,read_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(30);
  if(error){host.innerHTML='<p class="muted small">تعذر تحميل رسائل الإدارة. تأكد من تشغيل supabase/upgrade_admin.sql.</p>';return;}
  $('#adminMessageCount').textContent=String((data||[]).filter(m=>!m.read_at).length);
  if(!data?.length){host.innerHTML='<p class="muted small">لا توجد رسائل من الإدارة حاليًا.</p>';return;}
  host.innerHTML=data.map(m=>`<article class="ticket-card"><div class="ticket-top"><b>${esc(m.subject)}</b><span class="status-pill ${m.read_at?'closed':'open'}">${m.read_at?'مقروءة':'جديدة'}</span></div><p>${esc(m.message)}</p><div class="toolbar" style="margin:8px 0 0"><small class="muted">${formatDate(m.created_at)}</small>${m.read_at?'':`<button type="button" class="btn btn-small" data-read-message="${esc(m.id)}">تحديد كمقروءة</button>`}</div></article>`).join('');
}
async function markAdminMessageRead(button){
  const id=button.dataset.readMessage;button.disabled=true;
  try{const {data,error}=await supabase.rpc('mark_admin_message_read',{p_message_id:id});if(error)throw error;if(!data)throw new Error('لم يتم العثور على الرسالة.');await loadAdminMessages();}
  catch(error){toast(error.message||'تعذر تحديث الرسالة.','error');button.disabled=false;}
}

// Live preview + controls
$('#profileForm').addEventListener('input',updatePreview);
['birthDate','location','heightCm','weightKg','occupation','showBirthDate','showLocation','showHeight','showWeight','showOccupation','accent','accent2','background','mode','animation','card'].forEach(id=>$('#'+id).addEventListener('input',updatePreview));
$('#avatarFile').addEventListener('change',()=>{selectedFile=$('#avatarFile').files[0]||null;if(selectedFile){setVal('avatarUrl','');}updatePreview();});
$('#avatarUrl').addEventListener('input',()=>{selectedFile=null;$('#avatarFile').value='';updatePreview();});
$('#username').addEventListener('input',()=>{const pos=$('#username').selectionStart;setVal('username',cleanSlug(val('username')));try{$('#username').setSelectionRange(pos,pos);}catch{}updateShare();});
$('#linkRows').addEventListener('input',updatePreview);$('#linkRows').addEventListener('click',e=>{const b=e.target.closest('.remove-link');if(!b)return;b.closest('.link-edit-row').remove();$('#emptyLinks').hidden=$$('#linkRows .link-edit-row').length>0;updatePreview();});
$('#addLinkBtn').addEventListener('click',()=>addLinkRow({label:'',url:'',icon:'↗'}));
$('#presetGrid').addEventListener('click',e=>{const b=e.target.closest('[data-preset]');if(b)setPreset(b.dataset.preset);});
$('#publishToggle').addEventListener('change',()=>syncPublish(checked('publishToggle')));$('#publishBottom').addEventListener('change',()=>syncPublish(checked('publishBottom')));
$('#saveTopBtn').addEventListener('click',saveAll);$('#saveBottomBtn').addEventListener('click',saveAll);
$('#copyLinkBtn').addEventListener('click',async()=>{const link=shareUrl();if(!link){toast('اختَر اسم مستخدم صالح واحفظه أولًا.','error');return;}try{await navigator.clipboard.writeText(link);toast('تم نسخ رابط صفحتك.','success');}catch{ $('#shareUrl').select();toast('انسخ الرابط المحدد يدويًا.');}});
$('#qrBtn').addEventListener('click',()=>{const link=shareUrl();if(!link){toast('اختَر اسم مستخدم صالح واحفظه أولًا.','error');return;}if(!checked('publishToggle')){toast('انشر صفحتك أولًا حتى يستطيع الآخرون فتحها.','error');return;}if(!window.QRCode){toast('تعذر تحميل مولّد QR. تحقق من اتصال الإنترنت.','error');return;}const panel=$('#qrPanel');panel.hidden=false;$('#qrCode').innerHTML='';new QRCode($('#qrCode'),{text:link,width:180,height:180,colorDark:'#171a2b',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});});
$('#supportForm').addEventListener('submit',submitTicket);$('#myAdminMessages').addEventListener('click',e=>{const b=e.target.closest('[data-read-message]');if(b)markAdminMessageRead(b);});$('#signOutBtn').addEventListener('click',signOut);
showConfigWarning();
if(isConfigured){try{await loadPage();}catch(err){if(!String(err.message||'').includes('Sign in required'))toast(err.message||'تعذر تحميل المحرر. راجع إعداد Supabase.','error');}}
