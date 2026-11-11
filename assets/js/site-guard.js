import { supabase, isConfigured } from './core.js';

const html=document.documentElement;
const guardStyle=document.createElement('style');
guardStyle.textContent='html.maintenance-checking body{visibility:hidden!important}';
document.head.append(guardStyle);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function clearCheck(){html.classList.remove('maintenance-checking');}
function renderMaintenance(message){
  const lang=localStorage.getItem('linkora-language')==='en'?'en':'ar';
  const title=lang==='en'?'Linkora is under maintenance':'لينكورا في وضع الصيانة';
  const arabicDefault='الموقع في حالة صيانة حاليًا. سنعود للعمل قريبًا.';
  const defaultMessage=lang==='en'?'We are making improvements. The website will be back soon.':arabicDefault;
  const displayMessage=(!message||message===arabicDefault)?defaultMessage:message;
  const safeMessage=escapeHtml(displayMessage).replace(/\n/g,'<br>');
  html.lang=lang;html.dir=lang==='en'?'ltr':'rtl';
  document.title=title+' — Linkora';
  document.body.innerHTML=`<main class="maintenance-screen"><div class="maintenance-card"><div class="maintenance-mark">L</div><div class="maintenance-eyebrow">LINKORA · ${lang==='en'?'COMING BACK SOON':'سنعود قريبًا'}</div><h1>${title}</h1><p>${safeMessage}</p><div class="maintenance-loader" aria-hidden="true"><i></i><i></i><i></i></div><small>${lang==='en'?'Thank you for your patience.':'شكرًا لتفهمك.'}</small><a class="maintenance-admin-entry" href="auth.html?maintenance_admin=1">${lang==='en'?'Administrator sign-in':'دخول مدير الموقع'}</a></div></main><style>
    body{margin:0;min-height:100vh;background:radial-gradient(circle at 15% 10%,rgba(138,124,255,.22),transparent 34%),radial-gradient(circle at 90% 90%,rgba(98,217,207,.18),transparent 35%),#0b0e17;color:#eff2ff;font-family:Inter,Cairo,Arial,sans-serif}.maintenance-screen{min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box}.maintenance-card{width:min(560px,100%);box-sizing:border-box;text-align:center;padding:48px 34px;border:1px solid rgba(193,204,255,.17);border-radius:30px;background:rgba(20,25,40,.82);box-shadow:0 30px 100px rgba(0,0,0,.35);backdrop-filter:blur(18px)}.maintenance-mark{width:64px;height:64px;margin:0 auto 22px;display:grid;place-items:center;border-radius:21px;background:linear-gradient(135deg,#8a7cff,#62d9cf);color:#101321;font-weight:950;font-size:2rem;box-shadow:0 10px 36px rgba(138,124,255,.25)}.maintenance-eyebrow{color:#62d9cf;font-size:.74rem;font-weight:850;letter-spacing:.18em}.maintenance-card h1{font-size:clamp(1.7rem,5vw,2.5rem);line-height:1.2;margin:12px 0}.maintenance-card p{color:#c0c8dc;line-height:1.9;font-size:1rem;margin:0 auto 26px;white-space:normal}.maintenance-card small{display:block;color:#99a3bd;margin-top:18px}.maintenance-admin-entry{display:inline-flex;align-items:center;justify-content:center;margin-top:24px;padding:9px 16px;border:1px solid rgba(193,204,255,.2);border-radius:12px;color:#cbd4ec;text-decoration:none;font-size:.82rem}.maintenance-admin-entry:hover{border-color:#8a7cff;color:#fff}.maintenance-loader{display:flex;gap:7px;justify-content:center}.maintenance-loader i{width:8px;height:8px;border-radius:50%;background:#8a7cff;animation:maintenance-bounce .9s ease-in-out infinite alternate}.maintenance-loader i:nth-child(2){animation-delay:.18s;background:#62d9cf}.maintenance-loader i:nth-child(3){animation-delay:.36s;background:#ed9dc6}@keyframes maintenance-bounce{to{transform:translateY(-7px);opacity:.45}}@media(max-width:520px){.maintenance-card{padding:36px 22px;border-radius:24px}}
  </style>`;
}
async function checkMaintenance(){
  try{
    if(!isConfigured)return;
    const {data,error}=await supabase.rpc('get_linkora_site_status');
    if(error)throw error;
    if(!data?.maintenance_mode)return;
    const {data:{session}}=await supabase.auth.getSession();
    let isAdmin=false;
    if(session?.user){const result=await supabase.rpc('is_platform_admin');isAdmin=!result.error&&result.data===true;}
    const authRecoveryRoute=location.pathname.endsWith('/auth.html')&&new URLSearchParams(location.search).get('maintenance_admin')==='1';
    if(!isAdmin&&!authRecoveryRoute){html.dataset.maintenance='true';renderMaintenance(data.message);}
  }catch(error){console.warn('Linkora maintenance status could not be checked:',error);}
  finally{clearCheck();}
}
await checkMaintenance();
