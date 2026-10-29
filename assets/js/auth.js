
import {
  $,
  $$,
  supabase,
  isConfigured,
  showConfigWarning,
  appUrl
} from './core.js';

const form = $('#authForm');
const title = $('#authTitle');
const desc = $('#authDescription');
const status = $('#authStatus');
const submit = $('#submitAuth');

let mode = new URLSearchParams(location.search).get('mode') || 'login';

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

function setStatus(message, type = '') {
  status.textContent = message;
  status.className = `status-line ${type}`;
}

function setMode(next, updateUrl = true) {
  mode = next;

  const signup = mode === 'signup';
  const forgot = mode === 'forgot';
  const reset = mode === 'reset';
  const confirm = mode === 'confirm';

  fields.email.hidden = reset || confirm;
  fields.name.hidden = !signup;
  fields.password.hidden = forgot || reset || confirm;
  fields.confirm.hidden = !signup;
  fields.reset.hidden = !reset;
  fields.confirmNew.hidden = !reset;
  fields.tabs.hidden = forgot || reset || confirm;
  fields.forgot.hidden = signup || forgot || reset || confirm;

  // Prevent hidden required inputs from blocking form submission.
  $('#email').required = !reset && !confirm;
  $('#password').required = !forgot && !reset && !confirm;
  $('#confirmPassword').required = signup;
  $('#newPassword').required = reset;
  $('#confirmNewPassword').required = reset;

  $('#password').autocomplete = signup ? 'new-password' : 'current-password';

  submit.hidden = confirm;
  submit.disabled = false;

  const labels = {
    login: 'تسجيل الدخول ↗',
    signup: 'إنشاء الحساب ✦',
    forgot: 'إرسال رابط الاستعادة ↗',
    reset: 'حفظ كلمة المرور',
    confirm: 'تأكيد البريد الإلكتروني'
  };

  if (signup) {
    title.textContent = 'أنشئ صفحتك';
    desc.textContent = 'ابدأ حسابك المجاني وخلي صفحتك تعبر عنك.';
  } else if (forgot) {
    title.textContent = 'استعادة كلمة المرور';
    desc.textContent = 'هنبعت لك رابط آمن لاستعادة الحساب على بريدك.';
  } else if (reset) {
    title.textContent = 'اختَر كلمة مرور جديدة';
    desc.textContent = 'اكتب كلمة مرور جديدة لحسابك.';
  } else if (confirm) {
    title.textContent = 'تأكيد البريد الإلكتروني';
    desc.textContent = 'افتح رسالة التأكيد في بريدك، ثم ارجع وسجّل الدخول.';
  } else {
    title.textContent = 'أهلاً بيك من جديد';
    desc.textContent = 'ادخل لحسابك وكمل تصميم صفحتك.';
  }

  submit.textContent = labels[mode] || 'متابعة';

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', mode);
    history.replaceState({}, '', url);
  }

  setStatus(
    confirm
      ? 'افتح رسالة التأكيد في بريدك، ثم ارجع وسجّل الدخول.'
      : '',
    confirm ? 'success' : ''
  );

  $$('#authTabs button').forEach(button => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
}

function friendlyError(error) {
  const message = error?.message || '';

  if (/invalid login credentials/i.test(message)) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  }

  if (/user already registered/i.test(message)) {
    return 'البريد الإلكتروني مسجل بالفعل. جرّب تسجيل الدخول بدل إنشاء حساب جديد.';
  }

  if (/email not confirmed/i.test(message)) {
    return 'لازم تأكد بريدك الإلكتروني من رسالة Supabase قبل تسجيل الدخول.';
  }

  if (/password should be at least/i.test(message)) {
    return 'كلمة المرور قصيرة؛ استخدم 8 أحرف على الأقل.';
  }

  if (/failed to fetch|networkerror|fetch failed/i.test(message)) {
    return 'تعذر الاتصال بـ Supabase. راجع الإنترنت ورابط المشروع في config.js.';
  }

  return message || 'حصل خطأ غير متوقع. جرّب مرة أخرى.';
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

if (['login', 'signup', 'forgot', 'reset', 'confirm'].includes(mode)) {
  setMode(mode, false);
} else {
  setMode('login', false);
}

if (!isConfigured) {
  setStatus(
    'إعدادات Supabase غير مكتملة. افتح assets/js/config.js وأضف رابط المشروع والمفتاح العام.',
    'error'
  );
} else {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      setMode('reset', false);
      return;
    }

    if (event === 'SIGNED_IN' && session?.user && mode !== 'reset') {
      window.location.href = 'editor.html';
    }
  });

  if (mode === 'reset') {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (!data.session) {
        setStatus(
          'افتح رابط استعادة كلمة المرور الذي وصلك على البريد الإلكتروني أولًا.',
          'error'
        );
      }
    } catch (error) {
      setStatus(friendlyError(error), 'error');
    }
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();

  if (!isConfigured || !supabase) {
    setStatus(
      'أضف رابط Supabase والمفتاح العام الصحيح في assets/js/config.js أولًا.',
      'error'
    );
    return;
  }

  if (!form.reportValidity()) return;

  submit.disabled = true;
  submit.textContent = 'جارٍ التنفيذ…';
  setStatus('');

  try {
    const email = $('#email').value.trim().toLowerCase();
    const password = $('#password').value;

    if (mode === 'signup') {
      const displayName = $('#displayName').value.trim();

      if (password.length < 8) {
        throw new Error('كلمة المرور لازم تكون 8 أحرف على الأقل.');
      }

      if (password !== $('#confirmPassword').value) {
        throw new Error('كلمتا المرور غير متطابقتين.');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName || email.split('@')[0]
          },
          emailRedirectTo: appUrl('auth.html?mode=confirm')
        }
      });

      if (error) throw error;

      if (data.session) {
        setStatus('تم إنشاء الحساب بنجاح. جاري فتح المحرر…', 'success');
        window.location.href = 'editor.html';
        return;
      }

      setStatus(
        'تم إرسال طلب التسجيل. راجع بريدك لتأكيد الحساب قبل تسجيل الدخول.',
        'success'
      );
      return;
    }

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      window.location.href = 'editor.html';
      return;
    }

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: appUrl('auth.html?mode=reset')
      });

      if (error) throw error;

      setStatus(
        'لو البريد مرتبط بحساب، هتوصلك رسالة لاستعادة كلمة المرور.',
        'success'
      );
      return;
    }

    if (mode === 'reset') {
      const nextPassword = $('#newPassword').value;
      const confirmPassword = $('#confirmNewPassword').value;

      if (nextPassword.length < 8) {
        throw new Error('كلمة المرور لازم تكون 8 أحرف على الأقل.');
      }

      if (nextPassword !== confirmPassword) {
        throw new Error('كلمتا المرور غير متطابقتين.');
      }

      const { error } = await supabase.auth.updateUser({
        password: nextPassword
      });

      if (error) throw error;

      setStatus('تم تحديث كلمة المرور بنجاح. جاري تحويلك…', 'success');

      window.setTimeout(() => {
        window.location.href = 'editor.html';
      }, 1000);

      return;
    }

    if (mode === 'confirm') {
      setStatus(
        'افتح رسالة التأكيد في بريدك، ثم ارجع وسجّل الدخول.',
        'success'
      );
    }
  } catch (error) {
    console.error('Linkora authentication error:', error);
    setStatus(friendlyError(error), 'error');
  } finally {
    submit.disabled = false;

    if (!submit.hidden) {
      const labels = {
        login: 'تسجيل الدخول ↗',
        signup: 'إنشاء الحساب ✦',
        forgot: 'إرسال رابط الاستعادة ↗',
        reset: 'حفظ كلمة المرور',
        confirm: 'تأكيد البريد الإلكتروني'
      };

      submit.textContent = labels[mode] || 'متابعة';
    }
  }
});
