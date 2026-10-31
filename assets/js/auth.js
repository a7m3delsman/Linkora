import { $, $$, supabase, isConfigured, showConfigWarning, appUrl } from './core.js';

$('#year').textContent = new Date().getFullYear();

const form = $('#authForm');
const title = $('#authTitle');
const desc = $('#authDescription');
const status = $('#authStatus');
const submit = $('#submitAuth');
const emailInput = $('#email');
const passwordInput = $('#password');
const initialParams = new URLSearchParams(location.search);
const initialHash = new URLSearchParams(location.hash.replace(/^#/, ''));
let mode = initialParams.get('mode') || (initialHash.get('type') === 'recovery' ? 'reset' : 'login');
if (!['login', 'signup', 'forgot', 'reset', 'confirm'].includes(mode)) mode = 'login';

const fields = {
  name: $('#nameField'),
  email: $('#emailField'),
  password: $('#passwordField'),
  confirm: $('#confirmField'),
  reset: $('#resetPasswordField'),
  confirmNew: $('#confirmNewField'),
  tabs: $('#authTabs'),
  forgot: $('#forgotLine')
};

function setStatus(message = '', type = '') {
  status.textContent = message;
  status.className = `status-line ${type}`;
}

function setFieldVisibility(wrapper, hidden) {
  wrapper.hidden = hidden;
  wrapper.querySelectorAll('input, select, textarea').forEach(input => {
    // Disabled hidden fields are ignored by browser validation and cannot block submission.
    input.disabled = hidden;
  });
}

function setMode(next, updateUrl = true) {
  mode = ['login', 'signup', 'forgot', 'reset', 'confirm'].includes(next) ? next : 'login';
  const signup = mode === 'signup';
  const forgot = mode === 'forgot';
  const reset = mode === 'reset';
  const confirm = mode === 'confirm';

  setFieldVisibility(fields.email, reset || confirm);
  setFieldVisibility(fields.name, !signup);
  setFieldVisibility(fields.password, forgot || reset || confirm);
  setFieldVisibility(fields.confirm, !signup);
  setFieldVisibility(fields.reset, !reset);
  setFieldVisibility(fields.confirmNew, !reset);
  fields.tabs.hidden = forgot || reset;
  fields.forgot.hidden = signup || forgot || reset || confirm;
  submit.hidden = confirm;
  submit.disabled = false;

  // Required fields must match the current mode, otherwise a hidden input can block the form.
  emailInput.required = ['login', 'signup', 'forgot'].includes(mode);
  passwordInput.required = ['login', 'signup'].includes(mode);
  $('#confirmPassword').required = signup;
  $('#newPassword').required = reset;
  $('#confirmNewPassword').required = reset;
  passwordInput.autocomplete = signup ? 'new-password' : 'current-password';

  if (signup) {
    title.textContent = 'أنشئ صفحتك';
    desc.textContent = 'ابدأ حسابك المجاني وخلي صفحتك تعبر عنك.';
    submit.textContent = 'إنشاء الحساب ✦';
  } else if (forgot) {
    title.textContent = 'استعادة كلمة المرور';
    desc.textContent = 'هنبعت لك رابط آمن لاستعادة الحساب على بريدك.';
    submit.textContent = 'إرسال رابط الاستعادة ↗';
  } else if (reset) {
    title.textContent = 'اختَر كلمة مرور جديدة';
    desc.textContent = 'اكتب كلمة مرور جديدة لحسابك.';
    submit.textContent = 'حفظ كلمة المرور';
  } else if (confirm) {
    title.textContent = 'تأكيد البريد الإلكتروني';
    desc.textContent = 'بعد تأكيد البريد، اختار «تسجيل الدخول» للمتابعة.';
  } else {
    title.textContent = 'أهلاً بيك من جديد';
    desc.textContent = 'ادخل لحسابك وكمل تصميم صفحتك.';
    submit.textContent = 'تسجيل الدخول ↗';
  }

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', mode);
    history.replaceState({}, '', url);
  }
  if (!confirm) setStatus('');
  $$('#authTabs button').forEach(button => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
}

$('#authTabs').addEventListener('click', event => {
  const button = event.target.closest('[data-mode]');
  if (button) setMode(button.dataset.mode);
});

$('#forgotLink').addEventListener('click', event => {
  event.preventDefault();
  setMode('forgot');
});

showConfigWarning();
setMode(mode, false);
if (initialParams.get('blocked') === '1') {
  setStatus('هذا الحساب محظور من استخدام Linkora. تواصل مع إدارة المنصة لمراجعة القرار.', 'error');
}

if (mode === 'confirm') {
  setStatus('لو ضغطت على رابط التأكيد في رسالة البريد، المفروض يتأكد الحساب تلقائيًا. لو تأكد بنجاح، اضغط «تسجيل الدخول».', 'success');
}

// Surface useful errors from failed email confirmation/recovery redirects.
const redirectParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
const redirectError = redirectParams.get('error_description') || redirectParams.get('error');
if (redirectError) {
  setMode(mode, false);
  setStatus(`تعذّر إكمال التحقق: ${redirectError.replace(/\+/g, ' ')}`, 'error');
}

if (isConfigured) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      setMode('reset', false);
      setStatus('تم التحقق من رابط الاستعادة. اكتب كلمة مرور جديدة.', 'success');
      return;
    }

    if (event === 'SIGNED_IN' && session?.user) {
      if (mode === 'confirm') {
        setStatus('تم تأكيد البريد الإلكتروني بنجاح! اضغط «تسجيل الدخول» للمتابعة إلى صفحتك.', 'success');
      } else if (mode !== 'reset') {
        window.location.href = 'editor.html';
      }
    }

    if (event === 'USER_UPDATED' && mode === 'reset') {
      setStatus('تم تحديث كلمة المرور بنجاح. تقدر تسجّل الدخول الآن.', 'success');
    }
  });

  // Some customized Supabase email templates redirect with token_hash/type directly.
  // Verify those links explicitly; the default ConfirmationURL flow is handled by the SDK.
  const callbackParams = new URLSearchParams(window.location.search);
  const tokenHash = callbackParams.get('token_hash');
  const tokenType = callbackParams.get('type');
  if (tokenHash && tokenType) {
    setMode('confirm', false);
    setStatus('جارٍ تأكيد البريد الإلكتروني…');
    try {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tokenType });
      if (error) throw error;
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('token_hash');
      cleanUrl.searchParams.delete('type');
      cleanUrl.searchParams.set('mode', 'confirm');
      history.replaceState({}, '', cleanUrl);
      setStatus('تم تأكيد البريد الإلكتروني بنجاح! اضغط «تسجيل الدخول» للمتابعة.', 'success');
    } catch (error) {
      setStatus(`فشل تأكيد البريد الإلكتروني: ${error?.message || 'الرابط غير صالح أو انتهت صلاحيته.'}`, 'error');
    }
  }

  if (mode === 'reset') {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session) {
      setStatus('لم يتم قبول رابط الاستعادة. افتح أحدث رسالة استعادة، وتأكد أن Site URL و Redirect URLs في Supabase يشيران إلى موقع GitHub Pages وليس localhost.', 'error');
    } else {
      setStatus('تم فتح رابط الاستعادة بنجاح. اكتب كلمة المرور الجديدة.', 'success');
    }
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!isConfigured) {
    setStatus('أضف إعدادات Supabase الصحيحة أولًا في assets/js/config.js.', 'error');
    return;
  }

  submit.disabled = true;
  submit.innerHTML = '<span class="spinner"></span> جارٍ التنفيذ…';
  setStatus('');

  try {
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (mode === 'signup') {
      const displayName = $('#displayName').value.trim();
      if (password.length < 8) throw new Error('كلمة المرور لازم تكون 8 أحرف على الأقل.');
      if (password !== $('#confirmPassword').value) throw new Error('كلمتا المرور غير متطابقتين.');

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName || email.split('@')[0] },
          emailRedirectTo: appUrl('auth.html?mode=confirm')
        }
      });
      if (error) throw error;

      if (data.session) {
        setStatus('تم إنشاء الحساب بنجاح. بنفتح محرر صفحتك…', 'success');
        window.location.href = 'editor.html';
        return;
      }

      setStatus('تم طلب إنشاء الحساب. افتح رسالة التأكيد في بريدك واضغط الرابط الموجود فيها، ثم ارجع لتسجيل الدخول. راجع مجلد Spam لو الرسالة مش ظاهرة.', 'success');
    } else if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = 'editor.html';
      return;
    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL('auth.html?mode=reset', new URL('./', window.location.href)).href
      });
      if (error) throw error;
      setStatus('لو فيه حساب مسجل بالبريد ده، هتوصلك رسالة لاستعادة كلمة المرور. راجع Spam كمان.', 'success');
    } else if (mode === 'reset') {
      const nextPassword = $('#newPassword').value;
      if (nextPassword.length < 8) throw new Error('كلمة المرور لازم تكون 8 أحرف على الأقل.');
      if (nextPassword !== $('#confirmNewPassword').value) throw new Error('كلمتا المرور غير متطابقتين.');
      const { error } = await supabase.auth.updateUser({ password: nextPassword });
      if (error) throw error;
      setStatus('تم تحديث كلمة المرور بنجاح. تقدر تسجّل الدخول بكلمة المرور الجديدة.', 'success');
      setMode('login');
      setStatus('تم تحديث كلمة المرور بنجاح. سجّل الدخول بكلمة المرور الجديدة.', 'success');
    }
  } catch (error) {
    const message = error?.message || 'حصل خطأ غير متوقع. جرّب مرة أخرى.';
    const likelyEmailConfig = /redirect|email|smtp|rate limit/i.test(message);
    setStatus(likelyEmailConfig ? `${message} — راجع إعدادات البريد و Redirect URLs في Supabase.` : message, 'error');
  } finally {
    submit.disabled = false;
    if (!submit.hidden) {
      const labels = {
        login: 'تسجيل الدخول ↗',
        signup: 'إنشاء الحساب ✦',
        forgot: 'إرسال رابط الاستعادة ↗',
        reset: 'حفظ كلمة المرور'
      };
      submit.textContent = labels[mode] || 'متابعة';
    }
  }
});
