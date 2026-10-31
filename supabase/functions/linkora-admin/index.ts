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
    const removeUserFiles = async (userId: string) => {
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
      const files = await collectFiles(userId);
      for (let i = 0; i < files.length; i += 100) {
        const { error } = await bucket.remove(files.slice(i, i + 100));
        if (error) throw error;
      }
    };

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');
    const targetUserId = String(body.targetUserId ?? '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) {
      return json({ error: 'Invalid target user id.' }, 400);
    }
    if (targetUserId === caller.id) return json({ error: 'You cannot perform this action on your own admin account.' }, 400);

    const { data: targetAdmin, error: targetAdminError } = await admin
      .from('platform_admins').select('user_id').eq('user_id', targetUserId).maybeSingle();
    if (targetAdminError) throw targetAdminError;
    if (targetAdmin) return json({ error: 'Admin accounts are protected from member-management actions.' }, 403);

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
      const { data: targetData, error: getUserError } = await admin.auth.admin.getUserById(targetUserId);
      if (getUserError || !targetData?.user) throw getUserError ?? new Error('User not found.');
      const target = targetData.user;
      const displayName = String(target.user_metadata?.display_name || target.email?.split('@')[0] || 'صفحة جديدة').slice(0, 80);
      const username = `member-${targetUserId.replaceAll('-', '').slice(0, 8)}`;
      await removeUserFiles(targetUserId);
      const { error: deleteError } = await admin.from('profiles').delete().eq('id', targetUserId);
      if (deleteError) throw deleteError;
      const { error: createError } = await admin.from('profiles').insert({
        id: targetUserId, username, display_name: displayName, subtitle: '', bio: '', avatar_url: '',
        is_published: false,
        theme: { mode: 'dark', accent: '#8a7cff', accent2: '#62d9cf', background: '#0c101b', animation: 'aurora', card: 'glass' },
      });
      if (createError) throw createError;
      const { error: extrasError } = await admin.from('profile_extras').upsert({ profile_id: targetUserId }, { onConflict: 'profile_id' });
      if (extrasError) throw extrasError;
      return json({ ok: true, message: 'تم حذف محتوى الصفحة وإعادتها كصفحة فارغة غير منشورة. الحساب ما زال موجودًا.' });
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
