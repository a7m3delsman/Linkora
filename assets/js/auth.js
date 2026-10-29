import { $, supabase, isConfigured, showConfigWarning, appUrl, toast } from './core.js';
$('#year').textContent = new Date().getFullYear();
const form = $('#authForm'), title = $('#authTitle'), desc = $('#authDescription'), status = $('#authStatus'), submit = $('#submitAuth');
let mode = new URLSearchParams(location.search).get('mode') || 'login';
const fields = {name:$('#nameField'), email:$('#emailField'), password:$('#passwordField'), confirm:$('#confirmField'), reset:$('#resetPasswordField'), confirmNew:$('#confirmNewField'), tabs:$('#authTabs'), forgot:$('#forgotLine')};
function setStatus(text, type='') { status.textContent = text; status.className = `status-line ${type}`; }
function setMode(next, updateUrl=true) {
  mode = next;
  const signup = mode === 'signup', forgot = mode === 'forgot', reset = mode === 'reset', confirm = mode === 'confirm';
  fields.email.hidden = reset || confirm; fields.name.hidden = !signup; fields.password.hidden = forgot || reset || confirm; fields.confirm.hidden = !signup;
  fields.reset.hidden = !reset; fields.confirmNew.hidden = !reset; fields.tabs.hidden = forgot || reset || confirm; fields.forgot.hidden = signup || forgot || reset || confirm;
  $('#password').autocomplete = signup ? 'new-password' : 'current-password';
  if (signup) { title.textContent='أنشئ صفحتك'; desc.textContent='ابدأ حسابك المجاني وخلي صفحتك تعبر عنك.'; submit.textContent='إنشاء الحساب ✦'; }
  else if (forgot) { title.textContent='استعادة كلمة المرور'; desc.textContent='هنبعت لك رابط آمن لاستعادة الحساب على بريدك.'; submit.textContent='إرسال رابط الاستعادة ↗'; }
  else if (reset) { title.textContent='اختَر كلمة مرور جديدة'; desc.textContent='اكتب كلمة مرور جديدة لحسابك.'; submit.textContent='حفظ كلمة المرور'; }
  else if (confirm) { title.textContent='تأكيد البريد الإلكتروني'; desc.textContent='لو وصلت من رابط التأكيد، ارجع لتسجيل الدخول بعد التأكيد.'; submit.hidden=true; setStatus('افتح رسالة التأكيد في بريدك، ثم ارجع وسجّل الدخول.','success'); }
  else { title.textContent='أهلاً بيك من جديد'; desc.textContent='ادخل لحسابك وكمل تصميم صفحتك.'; submit.textContent='تسجيل الدخول ↗'; submit.hidden=false; }
  if (updateUrl) history.replaceState({},'',`auth.html?mode=${mode}`);
  setStatus('');
  $$('#authTabs button').forEach(b=>b.classList.toggle('active', b.dataset.mode===mode));
}
$('#authTabs').addEventListener('click', e => { const b=e.target.closest('[data-mode]'); if(b) setMode(b.dataset.mode); });
$('#forgotLink').addEventListener('click', e=>{e.preventDefault();setMode('forgot');});
showConfigWarning();
if (mode === 'reset') setMode('reset',false); else if (['signup','forgot','confirm'].includes(mode)) setMode(mode,false); else setMode('login',false);
if (isConfigured) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') setMode('reset',false);
    else if (event === 'SIGNED_IN' && session?.user && mode !== 'reset') window.location.href='editor.html';
  });
  if (mode === 'reset') { const {data:{session}} = await supabase.auth.getSession(); if (!session) setStatus('افتح رابط الاستعادة الذي وصلك على البريد الإلكتروني أولًا.','error'); }
}
form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!isConfigured) { setStatus('أضف إعدادات Supabase أولًا في assets/js/config.js.','error'); return; }
  submit.disabled=true; submit.innerHTML='<span class="spinner"></span> جارٍ التنفيذ…'; setStatus('');
  try {
    const email=$('#email').value.trim().toLowerCase(), password=$('#password').value;
    if (mode==='signup') {
      const displayName=$('#displayName').value.trim();
      if(password.length<8) throw new Error('كلمة المرور لازم تكون 8 أحرف على الأقل.');
      if(password!==$('#confirmPassword').value) throw new Error('كلمتا المرور غير متطابقتين.');
      const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:displayName||email.split('@')[0]},emailRedirectTo:appUrl('auth.html?mode=confirm')}});
      if(error) throw error;
      if(data.session) { setStatus('تم إنشاء الحساب، بنجهز صفحتك…','success'); window.location.href='editor.html'; return; }
      setStatus('تم إرسال رسالة تأكيد إلى بريدك. افتحها لتفعيل الحساب ثم ارجع لتسجيل الدخول.','success');
    } else if (mode==='login') {
      const {error}=await supabase.auth.signInWithPassword({email,password}); if(error) throw error;
      window.location.href='editor.html'; return;
    } else if (mode==='forgot') {
      const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:appUrl('auth.html?mode=reset')}); if(error) throw error;
      setStatus('لو الحساب موجود بالبريد ده، هتوصلك رسالة لاستعادة كلمة المرور.','success');
    } else if (mode==='reset') {
      const next=$('#newPassword').value;
      if(next.length<8) throw new Error('كلمة المرور لازم تكون 8 أحرف على الأقل.');
      if(next!==$('#confirmNewPassword').value) throw new Error('كلمتا المرور غير متطابقتين.');
      const {error}=await supabase.auth.updateUser({password:next}); if(error) throw error;
      setStatus('تم تحديث كلمة المرور بنجاح. جاري تحويلك إلى المحرر…','success'); setTimeout(()=>window.location.href='editor.html',1000); return;
    }
  } catch(err) { setStatus(err.message || 'حصل خطأ غير متوقع. جرّب مرة أخرى.','error'); }
  finally { submit.disabled=false; if(!submit.hidden) { const labels={login:'تسجيل الدخول ↗',signup:'إنشاء الحساب ✦',forgot:'إرسال رابط الاستعادة ↗',reset:'حفظ كلمة المرور'}; submit.textContent=labels[mode]||'متابعة'; } }
});
