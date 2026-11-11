import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Server configuration is incomplete.' }, 500);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Authentication required.' }, 401);

    // Verify the caller with Auth; never trust a user id supplied by the browser.
    const callerClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
    const caller = callerData?.user;
    if (callerError || !caller) return json({ error: 'Invalid or expired session.' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: membership, error: membershipError } = await admin
      .from('platform_admins').select('user_id').eq('user_id', caller.id).maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return json({ error: 'Platform admin access required.' }, 403);

    const bucket = admin.storage.from('linkora-avatars');
    const collectFiles = async (prefix: string): Promise<string[]> => {
      const { data, error } = await bucket.list(prefix, { limit: 1000 });
      if (error) throw error;
      const paths: string[] = [];
      for (const item of data ?? []) {
        const fullPath = `${prefix}/${item.name}`;
        if (!item.id && !item.metadata) paths.push(...await collectFiles(fullPath));
        else paths.push(fullPath);
      }
      return paths;
    };
    const removeUserFiles = async (userId: string) => {
      const files = await collectFiles(userId);
      for (let i = 0; i < files.length; i += 100) {
        const { error } = await bucket.remove(files.slice(i, i + 100));
        if (error) throw error;
      }
    };

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');
    const targetUserId = String(body.targetUserId ?? '');
    if (action === 'set-maintenance') {
      const enabled = body.enabled === true;
      const message = String(body.message ?? '').trim().slice(0, 500) || 'الموقع في حالة صيانة حاليًا. سنعود للعمل قريبًا.';
      const { error } = await admin.from('site_settings').upsert({ id: true, maintenance_mode: enabled, maintenance_message: message, updated_by: caller.id, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (error) throw error;
      return json({ ok: true, message: enabled ? 'تم تفعيل وضع الصيانة.' : 'تم إيقاف وضع الصيانة.' });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) {
      return json({ error: 'Invalid target user id.' }, 400);
    }
    if (targetUserId === caller.id && action !== 'set-membership') return json({ error: 'You cannot perform member-management actions on your own admin account.' }, 400);

    const { data: targetAdmin, error: targetAdminError } = await admin
      .from('platform_admins').select('user_id').eq('user_id', targetUserId).maybeSingle();
    if (targetAdminError) throw targetAdminError;
    if (targetAdmin && action !== 'set-membership') return json({ error: 'Admin accounts are protected from member-management actions.' }, 403);

    if (action === 'set-membership') {
      const tier = String(body.tier ?? 'free').toLowerCase();
      if (!['free', 'pro', 'vip'].includes(tier)) return json({ error: 'Invalid membership tier.' }, 400);
      const isVerified = body.isVerified === true;
      const showMembershipBadge = body.showMembershipBadge !== false;
      const showVerifiedBadge = body.showVerifiedBadge !== false;
      const rawExpiry = String(body.expiresAt ?? '').trim();
      let expiresAt: string | null = null;
      if (rawExpiry) {
        const parsed = new Date(rawExpiry);
        if (Number.isNaN(parsed.getTime())) return json({ error: 'Invalid membership expiration date.' }, 400);
        expiresAt = parsed.toISOString();
      }
      const adminNote = String(body.adminNote ?? '').trim().slice(0, 500);
      const { error } = await admin.from('profile_memberships').upsert({
        profile_id: targetUserId,
        tier,
        is_verified: isVerified,
        show_membership_badge: showMembershipBadge,
        show_verified_badge: showVerifiedBadge,
        expires_at: expiresAt,
        admin_note: adminNote,
        updated_by: caller.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' });
      if (error) throw error;
      const tierLabel = tier === 'vip' ? 'VIP' : tier === 'pro' ? 'Pro' : 'Free';
      return json({ ok: true, message: `تم تحديث العضوية إلى ${tierLabel} وتحديث حالة التوثيق.` });
    }

    if (action === 'ban' || action === 'unban') {
      const duration = action === 'ban' ? '876000h' : 'none';
      const { error } = await admin.auth.admin.updateUserById(targetUserId, { ban_duration: duration });
      if (error) throw error;
      const isBanned = action === 'ban';
      const bannedUntil = isBanned ? new Date(Date.now() + 100 * 365.25 * 24 * 60 * 60 * 1000).toISOString() : null;
      const { error: directoryError } = await admin.from('user_directory')
        .update({ is_banned: isBanned, banned_until: bannedUntil }).eq('id', targetUserId);
      if (directoryError) throw directoryError;
      return json({ ok: true, message: isBanned ? 'تم حظر الحساب.' : 'تم فك حظر الحساب.' });
    }

    if (action === 'delete-page') {
      const { data: pages, error: pagesError } = await admin.from('profiles').select('id').eq('owner_id', targetUserId).order('created_at', { ascending: true }).limit(1);
      if (pagesError) throw pagesError;
      const primaryPage = pages?.[0];
      if (!primaryPage) throw new Error('No page found for this account.');
      const { data: targetData, error: getUserError } = await admin.auth.admin.getUserById(targetUserId);
      if (getUserError || !targetData?.user) throw getUserError ?? new Error('User not found.');
      const target = targetData.user;
      const displayName = String(target.user_metadata?.display_name || target.email?.split('@')[0] || 'صفحة جديدة').slice(0, 80);
      const pageFiles = await collectFiles(`${targetUserId}/${primaryPage.id}`);
      if (primaryPage.id === targetUserId) {
        const { data: legacyFiles, error: legacyError } = await bucket.list(targetUserId, { limit: 1000 });
        if (legacyError) throw legacyError;
        pageFiles.push(...(legacyFiles ?? []).filter(item => item.id || item.metadata).map(item => `${targetUserId}/${item.name}`));
      }
      for (let i = 0; i < pageFiles.length; i += 100) { const { error: storageError } = await bucket.remove(pageFiles.slice(i, i + 100)); if (storageError) throw storageError; }
      const { error: deleteLinksError } = await admin.from('profile_links').delete().eq('profile_id', primaryPage.id);
      if (deleteLinksError) throw deleteLinksError;
      const { error: extrasError } = await admin.from('profile_extras').upsert({ profile_id: primaryPage.id, birth_date: null, show_birth_date: false, height_cm: null, show_height: false, weight_kg: null, show_weight: false, location: '', show_location: false, occupation: '', show_occupation: false }, { onConflict: 'profile_id' });
      if (extrasError) throw extrasError;
      const { error: resetError } = await admin.from('profiles').update({ display_name: displayName, subtitle: '', bio: '', avatar_url: '', cover_url: '', is_published: false, theme: { mode: 'dark', accent: '#8a7cff', accent2: '#62d9cf', background: '#0c101b', animation: 'aurora', card: 'glass', linkCardStyle: 'glass', linkAnimation: 'lift', cardLanguage: 'ar', followerCounts: {} } }).eq('id', primaryPage.id);
      if (resetError) throw resetError;
      return json({ ok: true, message: 'تمت إعادة ضبط الصفحة الأساسية، وباقي صفحات الحساب لم تتأثر.' });
    }

    if (action === 'delete-account') {
      // Remove uploaded files first because Auth users that own Storage objects cannot be deleted.
      await removeUserFiles(targetUserId);
      const { error } = await admin.auth.admin.deleteUser(targetUserId);
      if (error) throw error;
      return json({ ok: true, message: 'تم حذف الحساب نهائيًا وكل البيانات المرتبطة به.' });
    }

    return json({ error: 'Unsupported admin action.' }, 400);
  } catch (error) {
    console.error('linkora-admin error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, 500);
  }
});
