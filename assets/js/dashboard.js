import { $, supabase, isConfigured, showConfigWarning, requireUser, isAdmin, esc, formatDate, toast, signOut } from './core.js';

if(document.documentElement.dataset.maintenance!=='true'){

let me = null;
let profiles = [];
let directory = [];
let extras = [];
let tickets = [];
let profileLinks = [];
let adminMessages = [];
let memberships = [];

const statusText = s => s === 'published' ? 'منشورة' : s === 'in_progress' ? 'قيد المتابعة' : s === 'closed' ? 'مغلقة' : 'مسودة';
const statusClass = s => s === 'published' ? 'published' : s === 'open' ? 'open' : s === 'in_progress' ? 'in_progress' : s === 'closed' ? 'closed' : 'draft';
const profileUrl = username => new URL(`p.html?u=${encodeURIComponent(username)}`, location.href).href;
const safeHref = value => {
  try { const u = new URL(String(value || '')); return ['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol) ? u.href : ''; }
  catch { return /^(mailto:|tel:)/i.test(String(value || '')) ? String(value) : ''; }
};

// Admin's own account is excluded from member-facing lists and statistics.
function getMemberDirectory() {
  return directory.filter(user => user.id !== me?.id);
}

async function loadAll() {
  const [p, d, x, t, l, m, mb] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('user_directory').select('*').order('created_at', { ascending: false }),
    supabase.from('profile_extras').select('*'),
    supabase.from('support_tickets').select('*').order('created_at', { ascending: false }),
    supabase.from('profile_links').select('*').order('sort_order'),
    supabase.from('admin_messages').select('*').order('created_at', { ascending: false }).limit(30),
    supabase.from('profile_memberships').select('*'),
  ]);
  for (const r of [p, d, x, t, l, m, mb]) if (r.error) throw r.error;
  // Keep the currently signed-in admin out of member-management views.
  profiles = (p.data || []).filter(profile => profile.owner_id !== me?.id);
  directory = (d.data || []).filter(user => user.id !== me?.id);
  extras = x.data || [];
  tickets = t.data || [];
  profileLinks = l.data || [];
  adminMessages = m.data || [];
  memberships = mb.data || [];
  const myMembership = memberships.find(m => m.profile_id === me?.id) || { tier: 'free', is_verified: false, show_membership_badge: true, show_verified_badge: true, expires_at: '' };
  $('#myMembershipTier').value = myMembership.tier || 'free';
  $('#myMembershipVerified').checked = !!myMembership.is_verified;
  $('#myMembershipShowBadge').checked = myMembership.show_membership_badge !== false;
  $('#myMembershipShowVerified').checked = myMembership.show_verified_badge !== false;
  $('#myMembershipExpiry').value = myMembership.expires_at ? new Date(myMembership.expires_at).toISOString().slice(0,10) : '';
  $('#myMembershipBadge').textContent = myMembership.tier === 'vip' ? '✦ VIP' : myMembership.tier === 'pro' ? '✓ PRO' : 'FREE';
  $('#myMembershipBadge').className = `member-badge ${myMembership.tier === 'vip' ? 'badge-vip' : myMembership.tier === 'pro' ? 'badge-pro' : 'badge-free'}`;
  renderStats();
  renderUsers();
  renderTickets();
  renderMessageRecipients();
  renderAdminMessages();
}

function renderStats() {
  const members = getMemberDirectory();
  const memberIds = new Set(members.map(d => d.id));
  const memberProfiles = profiles.filter(p => memberIds.has(p.owner_id));
  $('#statUsers').textContent = members.length;
  $('#statPublished').textContent = memberProfiles.filter(p => p.is_published).length;
  $('#statDrafts').textContent = memberProfiles.filter(p => !p.is_published).length;
  $('#statTickets').textContent = tickets.filter(t => t.status !== 'closed').length;
  $('#statBanned').textContent = members.filter(d => d.is_banned).length;
  $('#statUnreadMessages').textContent = adminMessages.filter(m => !m.read_at).length;
}

function renderUsers() {
  const q = $('#userSearch').value.trim().toLowerCase();
  const filter = $('#statusFilter').value;
  const rows = getMemberDirectory().map(d => {
    const pages = profiles.filter(p => p.owner_id === d.id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    return { d, pages, p: pages[0] || null };
  });
  const filtered = rows.filter(({ d, pages, p }) => {
    const status = d.is_banned ? 'banned' : pages.some(x=>x.is_published) ? 'published' : 'draft';
    if (filter !== 'all' && filter !== status) return false;
    return [p?.display_name, p?.username, d.email, ...pages.map(x=>x.username)].some(v => String(v || '').toLowerCase().includes(q));
  });
  $('#userCount').textContent = `${filtered.length} من ${rows.length}`;
  if (!filtered.length) { $('#usersBody').innerHTML = '<tr><td colspan="5"><div class="empty-state">لا توجد نتائج مطابقة.</div></td></tr>'; return; }
  $('#usersBody').innerHTML = filtered.map(({ d, pages, p }) => {
    const name = p?.display_name || d.email || 'عضو';
    const avatar = p?.avatar_url ? `<img class="mini-avatar" src="${esc(p.avatar_url)}" alt="" referrerpolicy="no-referrer">` : `<span class="mini-avatar">${esc((name || 'L').slice(0, 1).toUpperCase())}</span>`;
    const status = d.is_banned ? '<span class="status-pill banned">محظور</span>' : pages.some(x=>x.is_published) ? '<span class="status-pill published">لديه صفحة منشورة</span>' : '<span class="status-pill draft">مسودة</span>';
    const membership = memberships.find(m => m.profile_id === d.id) || { tier: 'free', is_verified: false };
    const activeTier = membership.expires_at && new Date(membership.expires_at) <= new Date() ? 'free' : (membership.tier || 'free');
    const tierPill = activeTier === 'vip' ? '<span class="member-badge badge-vip">✦ VIP</span>' : activeTier === 'pro' ? '<span class="member-badge badge-pro">✓ PRO</span>' : '<span class="member-badge badge-free">FREE</span>';
    const verifiedPill = membership.is_verified ? '<span class="member-badge badge-verified" title="Linkora verified">✓</span>' : '';
    const actions = [
      p ? `<button class="btn btn-small" data-action="details" data-id="${esc(d.id)}">تفاصيل</button>` : '',
      p ? `<a class="btn btn-small" href="editor.html?user=${encodeURIComponent(d.id)}&page=${encodeURIComponent(p.id)}">تعديل الصفحات (${pages.length})</a>` : '<span class="muted small">لا توجد صفحة</span>',
      p ? `<a class="btn btn-small" href="${esc(profileUrl(p.username))}" target="_blank" rel="noopener">عرض ↗</a>` : '',
      p ? `<button class="btn btn-small" data-action="publish" data-id="${esc(d.id)}" data-page-id="${esc(p.id)}">${p.is_published ? 'إلغاء النشر' : 'نشر'}</button>` : '',
      `<button class="btn btn-small" data-action="reset" data-id="${esc(d.id)}">استعادة كلمة المرور</button>`,
      `<button class="btn btn-small" data-action="message" data-id="${esc(d.id)}">إرسال رسالة</button>`,
      p ? `<button class="btn btn-small" data-action="delete-page" data-id="${esc(d.id)}">إعادة ضبط الصفحة الأساسية</button>` : '',
      `<button class="btn btn-small ${d.is_banned ? '' : 'btn-danger'}" data-action="${d.is_banned ? 'unban' : 'ban'}" data-id="${esc(d.id)}">${d.is_banned ? 'فك الحظر' : 'حظر'}</button>`,
      `<button class="btn btn-small btn-danger" data-action="delete-account" data-id="${esc(d.id)}">حذف الحساب نهائيًا</button>`,
    ].filter(Boolean).join('');
    return `<tr><td><div class="user-cell">${avatar}<div><b>${esc(name)} ${tierPill} ${verifiedPill}</b><div class="muted small">@${esc(p?.username || '—')} · ${pages.length} صفحة</div></div></div></td><td>${esc(d.email || '—')}</td><td>${status} ${tierPill}</td><td>${formatDate(d.created_at || p?.created_at)}</td><td><div class="table-actions">${actions}</div></td></tr>`;
  }).join('');
}

function renderTickets() {
  const filter = $('#ticketFilter').value;
  const list = tickets.filter(t => filter === 'all' || t.status === filter);
  const host = $('#ticketsHost');
  if (!list.length) { host.innerHTML = '<div class="empty-state">لا توجد طلبات دعم في هذا التصنيف.</div>'; return; }
  host.innerHTML = list.map(t => {
    const p = profiles.find(p => p.owner_id === t.user_id);
    const d = directory.find(d => d.id === t.user_id);
    return `<article class="ticket-card" data-ticket="${esc(t.id)}"><div class="ticket-top"><div><b>${esc(t.subject)}</b><div class="muted small">${esc(p?.display_name || d?.email || 'عضو')} · ${esc(d?.email || '')} · ${formatDate(t.created_at)}</div></div><span class="status-pill ${statusClass(t.status)}">${statusText(t.status)}</span></div><p>${esc(t.message)}</p><div class="field"><label for="reply-${esc(t.id)}">رد المدير</label><textarea id="reply-${esc(t.id)}" maxlength="5000" rows="3" placeholder="اكتب ردًا يظهر في حساب العضو…">${esc(t.admin_reply || '')}</textarea></div><div class="toolbar" style="margin:9px 0 0"><select class="control ticket-status" style="width:auto"><option value="open" ${t.status === 'open' ? 'selected' : ''}>مفتوح</option><option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>قيد المتابعة</option><option value="closed" ${t.status === 'closed' ? 'selected' : ''}>مغلق</option></select><button class="btn btn-primary btn-small" data-action="reply" data-id="${esc(t.id)}">حفظ الرد والحالة</button><button class="btn btn-small" data-action="message-user" data-user-id="${esc(t.user_id)}">رسالة مباشرة للعضو</button></div></article>`;
  }).join('');
}

function renderMessageRecipients() {
  const select = $('#messageUser');
  const previous = select.value;
  const members = getMemberDirectory();
  select.innerHTML = '<option value="">اختر العضو المستلم</option>' + members.map(d => {
    const p = profiles.find(p => p.owner_id === d.id);
    const label = `${p?.display_name || d.email} — ${d.email}`;
    return `<option value="${esc(d.id)}">${esc(label)}</option>`;
  }).join('');
  if (members.some(d => d.id === previous)) select.value = previous;
}

function renderAdminMessages() {
  const host = $('#adminMessagesHost');
  if (!adminMessages.length) { host.innerHTML = '<p class="muted small">لم ترسل رسائل مباشرة بعد.</p>'; return; }
  host.innerHTML = adminMessages.map(m => {
    const d = directory.find(x => x.id === m.user_id);
    const p = profiles.find(x => x.owner_id === m.user_id);
    return `<article class="ticket-card"><div class="ticket-top"><b>${esc(m.subject)}</b><span class="status-pill ${m.read_at ? 'closed' : 'open'}">${m.read_at ? 'مقروءة' : 'غير مقروءة'}</span></div><div class="muted small">إلى: ${esc(p?.display_name || d?.email || 'عضو')} · ${esc(d?.email || '')} · ${formatDate(m.created_at)}</div><p>${esc(m.message)}</p></article>`;
  }).join('');
}

function showDetails(id) {
  const pages = profiles.filter(x => x.owner_id === id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  const p = pages[0];
  if (!p) return;
  const d = directory.find(x => x.id === id) || {};
  const x = extras.find(x => x.profile_id === p.id) || {};
  const theme = p.theme || {};
  const fmt = value => value ? esc(value) : '—';
  const links = profileLinks.filter(l => l.profile_id === p.id);
  const linksHtml = links.length ? links.map(l => { const url=safeHref(l.url);return `<div class="ticket-card" style="padding:9px 12px"><b>${esc(l.icon || '↗')} ${esc(l.label)}</b><div class="muted small" style="overflow-wrap:anywhere">${url?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(l.url)}</a>`:esc(l.url)}</div><small class="muted">${l.is_enabled?'مفعّل':'موقوف'}</small></div>`;}).join('') : '<p class="muted small">لا توجد روابط مسجلة.</p>';
  const pagesHtml=pages.map(page=>`<div class="ticket-card" style="padding:10px 12px"><b>${esc(page.display_name||page.username)}</b><div class="muted small">@${esc(page.username)} · ${page.is_published?'منشورة':'مسودة'}</div><div class="nav-actions" style="margin-top:7px"><a class="btn btn-small" href="editor.html?user=${encodeURIComponent(id)}&page=${encodeURIComponent(page.id)}">تعديل</a><a class="btn btn-small" href="${esc(profileUrl(page.username))}" target="_blank" rel="noopener">عرض ↗</a></div></div>`).join('');
  $('#detailsTitle').textContent = `تفاصيل ${p.display_name}`;
  $('#detailsBody').innerHTML = `<div class="form-grid"><div><span class="muted small">البريد</span><div>${fmt(d.email)}</div></div><div><span class="muted small">عدد الصفحات</span><div>${pages.length}</div></div><div><span class="muted small">المسمى</span><div>${fmt(p.subtitle)}</div></div><div><span class="muted small">تاريخ التسجيل</span><div>${formatDate(d.created_at || p.created_at)}</div></div><div class="field full"><span class="muted small">الوصف</span><div style="white-space:pre-wrap">${fmt(p.bio)}</div></div><div><span class="muted small">حالة الحساب</span><div>${d.is_banned?'محظور':'نشط'}</div></div><div><span class="muted small">تاريخ الميلاد (خاص)</span><div>${fmt(x.birth_date)}</div></div><div><span class="muted small">المكان</span><div>${fmt(x.location)}</div></div><div><span class="muted small">الطول</span><div>${x.height_cm?esc(x.height_cm)+' سم':'—'}</div></div><div><span class="muted small">الوزن</span><div>${x.weight_kg?esc(x.weight_kg)+' كجم':'—'}</div></div><div class="field full"><span class="muted small">صفحات الحساب</span><div class="ticket-list" style="margin-top:8px">${pagesHtml}</div></div><div class="field full"><span class="muted small">ألوان الصفحة الأساسية</span><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:7px"><span style="width:24px;height:24px;border-radius:8px;background:${esc(theme.accent||'#8a7cff')};border:1px solid var(--line)"></span><span>${fmt(theme.accent)}</span><span style="width:24px;height:24px;border-radius:8px;background:${esc(theme.accent2||'#62d9cf')};border:1px solid var(--line)"></span><span>${fmt(theme.accent2)}</span><span class="muted small">${fmt(theme.animation)} · ${fmt(theme.mode)} · ${fmt(theme.card)}</span></div></div><div class="field full"><span class="muted small">روابط الصفحة الأساسية (${links.length})</span><div class="ticket-list" style="margin-top:8px">${linksHtml}</div></div></div><div class="divider"></div><div class="nav-actions"><a class="btn btn-primary" href="${esc(profileUrl(p.username))}" target="_blank" rel="noopener">فتح الصفحة العامة ↗</a><a class="btn" href="editor.html?user=${encodeURIComponent(id)}&page=${encodeURIComponent(p.id)}">تعديل صفحات العضو</a><button class="btn" data-action="reset" data-id="${esc(id)}">إرسال رابط استعادة كلمة المرور</button><button class="btn" data-action="message" data-id="${esc(id)}">إرسال رسالة للعضو</button><button class="btn" data-action="delete-page" data-id="${esc(id)}">إعادة ضبط الصفحة الأساسية</button></div><p class="muted small">لا تطلب من العضو إرسال كلمة المرور أو مشاركة رمز الاستعادة.</p>`;
  $('#detailsBackdrop').hidden = false;
  const membership = memberships.find(m => m.profile_id === id) || { tier:'free',is_verified:false,show_membership_badge:true,show_verified_badge:true,expires_at:'',admin_note:'' };
  const expiryValue = membership.expires_at ? new Date(membership.expires_at).toISOString().slice(0,10) : '';
  $('#detailsBody').insertAdjacentHTML('beforeend', `<section class="panel membership-admin-panel" style="margin-top:18px"><h3>العضوية والتوثيق</h3><p class="muted small">تظهر الشارة بجوار الاسم في جميع صفحات العضو. حد الصفحات: Free صفحة واحدة، Pro خمس صفحات، VIP بلا حدود.</p><div class="form-grid"><div class="field"><label for="membershipTier">نوع العضوية</label><select id="membershipTier" class="control"><option value="free" ${membership.tier==='free'?'selected':''}>Free — مجانية</option><option value="pro" ${membership.tier==='pro'?'selected':''}>Pro — توثيق أزرق</option><option value="vip" ${membership.tier==='vip'?'selected':''}>VIP — شارة ذهبية</option></select></div><div class="field"><label for="membershipExpiry">تاريخ الانتهاء (اختياري)</label><input id="membershipExpiry" type="date" value="${expiryValue}"></div><div class="field full"><label class="check-row"><input id="membershipVerified" type="checkbox" ${membership.is_verified?'checked':''}> منح علامة Linkora Verified لهذا العضو</label></div><div class="field full"><label class="check-row"><input id="membershipShowBadge" type="checkbox" ${membership.show_membership_badge!==false?'checked':''}> إظهار شارة VIP أو Pro في الصفحة العامة</label></div><div class="field full"><label class="check-row"><input id="membershipShowVerified" type="checkbox" ${membership.show_verified_badge!==false?'checked':''}> إظهار علامة التوثيق الزرقاء في الصفحة العامة</label></div><div class="field full"><label for="membershipNote">ملاحظة داخلية للمدير</label><input id="membershipNote" maxlength="500" value="${esc(membership.admin_note||'')}" placeholder="سبب منح العضوية أو التوثيق (اختياري)"></div><div class="field full"><button class="btn btn-primary" type="button" data-action="save-membership" data-id="${esc(id)}">حفظ العضوية والتوثيق</button></div></div></section>`);
}

async function invokeAdmin(action, targetUserId, extra = {}) {
  const { data, error } = await supabase.functions.invoke('linkora-admin', { body: { action, ...(targetUserId ? { targetUserId } : {}), ...extra } });
  if (error) {
    let detail = error.message || 'تعذر تنفيذ الإجراء الإداري.';
    try { const context = error.context; if (context?.json) { const body = await context.json(); detail = body.error || detail; } } catch { /* keep SDK message */ }
    throw new Error(detail);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

function focusMessageForm(userId) {
  $('#messageUser').value = userId;
  $('#messageSubject').focus();
  $('#messageComposer').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function adminAction(action, id, button) {
  if (id === me?.id) {
    toast('لا يمكنك تنفيذ إجراءات إدارية على حساب المدير الحالي.', 'error');
    return;
  }
  const p = profiles.filter(x => x.owner_id === id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))[0];
  const d = directory.find(x => x.id === id);
  if (action === 'details') { showDetails(id); return; }
  if (action === 'save-membership') {
    const tier = $('#membershipTier').value;
    const expiry = $('#membershipExpiry').value;
    const extra = { tier, isVerified: $('#membershipVerified').checked, showMembershipBadge: $('#membershipShowBadge').checked, showVerifiedBadge: $('#membershipShowVerified').checked, expiresAt: expiry ? `${expiry}T23:59:59` : '', adminNote: $('#membershipNote').value.trim() };
    button.disabled = true;
    try {
      const result = await invokeAdmin('set-membership', id, extra);
      toast(result.message || 'تم تحديث العضوية.', 'success');
      await loadAll();
      showDetails(id);
    } catch (error) { toast(error.message || 'تعذر تحديث العضوية.', 'error'); }
    finally { button.disabled = false; }
    return;
  }
  if (action === 'message') { focusMessageForm(id); return; }
  if (action === 'publish') {
    if (!p) return;
    button.disabled = true;
    try {
      const pageId = button.dataset.pageId || p.id;
      const targetPage = profiles.find(x=>x.id===pageId) || p;
      const { error } = await supabase.from('profiles').update({ is_published: !targetPage.is_published }).eq('id', pageId);
      if (error) throw error;
      toast(targetPage.is_published ? 'تم إلغاء نشر الصفحة.' : 'تم نشر الصفحة.', 'success');
      await loadAll();
    } catch (error) { toast(error.message || 'تعذر تغيير حالة النشر.', 'error'); }
    finally { button.disabled = false; }
    return;
  }
  if (action === 'reset') {
    if (!d?.email) { toast('لا يوجد بريد إلكتروني لهذا الحساب.', 'error'); return; }
    if (!confirm(`إرسال رسالة استعادة كلمة المرور إلى ${d.email}؟`)) return;
    button.disabled = true;
    try {
      const redirectTo = new URL('auth.html?mode=reset', new URL('./', location.href)).href;
      const { error } = await supabase.auth.resetPasswordForEmail(d.email, { redirectTo });
      if (error) throw error;
      toast('تم طلب إرسال رابط الاستعادة. تأكد من إعداد SMTP و Redirect URLs.', 'success');
    } catch (error) { toast(error.message || 'تعذر إرسال رسالة الاستعادة.', 'error'); }
    finally { button.disabled = false; }
    return;
  }
  if (action === 'delete-page') {
    if (!confirm(`إعادة ضبط الصفحة الأساسية لحساب ${d?.email || p?.display_name}؟ سيتم مسح بيانات الصفحة وروابطها وإعادتها كمسودة فارغة، مع الاحتفاظ بباقي صفحات الحساب.`)) return;
    button.disabled = true;
    try { const result = await invokeAdmin('delete-page', id); toast(result.message || 'تم حذف محتوى الصفحة.', 'success'); $('#detailsBackdrop').hidden = true; await loadAll(); }
    catch (error) { toast(error.message, 'error'); }
    finally { button.disabled = false; }
    return;
  }
  if (action === 'ban' || action === 'unban') {
    const prompt = action === 'ban'
      ? `تأكيد حظر ${d?.email || p?.display_name}؟ لن يتمكن من تسجيل الدخول أو استخدام أدوات الحساب.`
      : `فك حظر ${d?.email || p?.display_name} والسماح له بالدخول مرة أخرى؟`;
    if (!confirm(prompt)) return;
    button.disabled = true;
    try { const result = await invokeAdmin(action, id); toast(result.message || 'تم تحديث حالة الحساب.', 'success'); await loadAll(); }
    catch (error) { toast(error.message, 'error'); }
    finally { button.disabled = false; }
    return;
  }
  if (action === 'delete-account') {
    if (!confirm(`تحذير: حذف ${d?.email || p?.display_name} نهائيًا؟ سيتم حذف حساب Auth والصفحة والروابط وطلبات الدعم والرسائل والملفات المرفوعة. لا يمكن التراجع.`)) return;
    if (!confirm('تأكيد أخير: هل أنت متأكد من الحذف النهائي؟')) return;
    button.disabled = true;
    try { const result = await invokeAdmin('delete-account', id); toast(result.message || 'تم حذف الحساب نهائيًا.', 'success'); $('#detailsBackdrop').hidden = true; await loadAll(); }
    catch (error) { toast(error.message, 'error'); }
    finally { button.disabled = false; }
  }
}

async function sendDirectMessage(event) {
  event.preventDefault();
  const userId = $('#messageUser').value;
  const subject = $('#messageSubject').value.trim();
  const message = $('#messageBody').value.trim();
  if (!userId || userId === me?.id || subject.length < 2 || message.length < 2) { toast('اختر عضوًا واكتب عنوان الرسالة ومحتواها.', 'error'); return; }
  const button = event.submitter || $('#sendAdminMessage');
  button.disabled = true;
  try {
    const { error } = await supabase.from('admin_messages').insert({ user_id: userId, admin_id: me.id, subject, message });
    if (error) throw error;
    $('#messageSubject').value = '';
    $('#messageBody').value = '';
    toast('تم إرسال الرسالة وستظهر داخل حساب العضو.', 'success');
    await loadAll();
  } catch (error) { toast(error.message || 'تعذر إرسال الرسالة.', 'error'); }
  finally { button.disabled = false; }
}

async function saveTicket(button) {
  const card = button.closest('[data-ticket]');
  const id = card.dataset.ticket;
  const reply = $(`#reply-${CSS.escape(id)}`).value.trim();
  const status = card.querySelector('.ticket-status').value;
  button.disabled = true;
  try {
    const { error } = await supabase.from('support_tickets').update({ admin_reply: reply, status }).eq('id', id);
    if (error) throw error;
    toast('تم حفظ الرد والحالة.', 'success');
    await loadAll();
  } catch (error) { toast(error.message || 'تعذر تحديث طلب الدعم.', 'error'); }
  finally { button.disabled = false; }
}

$('#usersBody').addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (button) adminAction(button.dataset.action, button.dataset.id, button);
});
$('#detailsBody').addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (button) adminAction(button.dataset.action, button.dataset.id, button);
});
$('#ticketsHost').addEventListener('click', event => {
  const replyButton = event.target.closest('[data-action="reply"]');
  const messageButton = event.target.closest('[data-action="message-user"]');
  if (replyButton) saveTicket(replyButton);
  if (messageButton) focusMessageForm(messageButton.dataset.userId);
});
$('#saveMyMembership').addEventListener('click', async () => {
  const button = $('#saveMyMembership'); button.disabled = true;
  const expiry = $('#myMembershipExpiry').value;
  try {
    const result = await invokeAdmin('set-membership', me.id, {
      tier: $('#myMembershipTier').value,
      isVerified: $('#myMembershipVerified').checked,
      showMembershipBadge: $('#myMembershipShowBadge').checked,
      showVerifiedBadge: $('#myMembershipShowVerified').checked,
      expiresAt: expiry ? `${expiry}T23:59:59` : '',
      adminNote: 'Platform owner membership',
    });
    toast(result.message || 'تم حفظ عضويتك.', 'success');
    await loadAll();
  } catch (error) { toast(error.message || 'تعذر حفظ عضويتك.', 'error'); }
  finally { button.disabled = false; }
});


async function loadMaintenanceSettings(){
  const {data,error}=await supabase.rpc('get_linkora_site_status');
  if(error)throw error;
  const enabled=!!data?.maintenance_mode;
  $('#maintenanceEnabled').checked=enabled;
  $('#maintenanceMessage').value=data?.message||'';
  const badge=$('#maintenanceStatus');badge.textContent=enabled?'● الصيانة مفعّلة':'● الموقع يعمل';badge.className=`maintenance-admin-status ${enabled?'is-on':'is-off'}`;
}
$('#saveMaintenanceBtn').addEventListener('click',async()=>{
  const button=$('#saveMaintenanceBtn');button.disabled=true;
  try{
    const result=await invokeAdmin('set-maintenance','',{enabled:$('#maintenanceEnabled').checked,message:$('#maintenanceMessage').value.trim()});
    toast(result.message||'تم حفظ إعدادات الصيانة.','success');await loadMaintenanceSettings();
  }catch(error){toast(error.message||'تعذر حفظ إعدادات الصيانة.','error');}
  finally{button.disabled=false;}
});

$('#adminMessageForm').addEventListener('submit', sendDirectMessage);
$('#userSearch').addEventListener('input', renderUsers);
$('#statusFilter').addEventListener('change', renderUsers);
$('#ticketFilter').addEventListener('change', renderTickets);
$('#refreshBtn').addEventListener('click', async () => {
  try { await loadAll(); toast('تم تحديث البيانات.', 'success'); }
  catch (error) { toast(error.message || 'تعذر تحديث البيانات.', 'error'); }
});
$('#closeDetails').addEventListener('click', () => $('#detailsBackdrop').hidden = true);
$('#detailsBackdrop').addEventListener('click', event => { if (event.target === $('#detailsBackdrop')) $('#detailsBackdrop').hidden = true; });
document.addEventListener('keydown', event => { if (event.key === 'Escape') $('#detailsBackdrop').hidden = true; });
$('#signOutBtn').addEventListener('click', signOut);

showConfigWarning();
if (isConfigured) {
  try {
    me = await requireUser();
    $('#adminEmail').textContent = me.email || '';
    const admin = await isAdmin(me.id);
    if (!admin) $('#deniedPanel').hidden = false;
    else { $('#adminArea').hidden = false; await loadAll(); await loadMaintenanceSettings(); }
  } catch (error) {
    if (!String(error.message || '').includes('Sign in required')) toast(error.message || 'تعذر فتح لوحة المدير.', 'error');
  }
}

}
