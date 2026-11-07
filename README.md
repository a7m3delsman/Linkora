<div align="center">
  <img src="assets/readme-banner.svg" alt="Linkora — Your page. Your identity." width="100%">

  <p><strong>Your links, profile, and personal style — brought together in one beautiful page.</strong></p>

  <p>
    <a href="https://linkora-design.vercel.app/">Live Website</a> ·
    <a href="README_AR.md">النسخة العربية</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Frontend-HTML%20%7C%20CSS%20%7C%20JavaScript-8a7cff?style=flat-square" alt="Frontend stack">
    <img src="https://img.shields.io/badge/Backend-Supabase-3ecf8e?style=flat-square" alt="Supabase">
    <img src="https://img.shields.io/badge/Hosting-Vercel-white?style=flat-square&logo=vercel&logoColor=black" alt="Vercel">
    <img src="https://img.shields.io/badge/Interface-Arabic%20%2B%20English-62d9cf?style=flat-square" alt="Bilingual interface">
    <img src="https://img.shields.io/badge/Responsive-Mobile%20%26%20Desktop-64748b?style=flat-square" alt="Responsive design">
  </p>
</div>

---

## ✦ About Linkora

**Linkora** is a multi-user personal profile and link-sharing platform. It gives every member a customizable page to introduce themselves, showcase their work, and collect their important links in one place — without needing to build a website from scratch.

Members can create an account, choose a unique username, design their page in a live editor, publish it, and share it through a direct URL or QR code. They can return at any time to update their profile and design.

**Live project:** [linkora-design.vercel.app](https://linkora-design.vercel.app/)

## ✨ Highlights

| Feature | What it does |
| --- | --- |
| **Personal profile** | Profile photo, cover image, display name, headline, bio, and optional personal details. |
| **Live visual editor** | Edit your page and see the preview update while you work. |
| **Flexible links** | Add, arrange, feature, and manage website or social links. Display them as rectangular cards, circular icons, or both where supported. |
| **Personal styling** | Choose color palettes, custom colors, light or dark appearance, card styles, backgrounds, and motion effects. |
| **Privacy controls** | Keep a page unpublished until it is ready. Choose which optional profile details are visible to visitors. |
| **Share tools** | Publish or unpublish, copy the page URL, open the public page, and show a QR code. |
| **Page analytics** | View page visits and link clicks, with daily summaries for the selected analytics period. |
| **Arabic and English** | Switch the interface language between Arabic and English. |
| **Support center** | Submit support requests, follow their status, and receive replies or private admin messages. |
| **Membership badges** | Admin-managed Free, Pro, and VIP tiers, plus a separate Linkora Verified badge and visibility controls. |
| **Admin dashboard** | Manage members, published pages, membership, support requests, and account actions. |

### Membership note

Membership tiers currently control profile badges and their display settings. **All editor features remain available to every member**, regardless of tier. A payment gateway or automatic paid-subscription flow is **not included** in this release.

## 🧭 How it works

1. **Create an account** with your email address.
2. **Choose a username** that becomes part of your public profile link.
3. **Build your page** by adding your photo, bio, links, colors, and preferred layout.
4. **Preview and publish** when everything looks right.
5. **Share your page** using its URL or QR code, and update it whenever you need.

Public profile URLs use this format:

```text
https://linkora-design.vercel.app/p.html?u=YOUR_USERNAME
```

Usernames are unique across the platform and use lowercase English letters, numbers, and hyphens (3–28 characters).

## 🛠️ Tech stack

- **Frontend:** HTML5, CSS3, vanilla JavaScript (ES modules)
- **Authentication and database:** Supabase Auth and PostgreSQL
- **Data protection:** PostgreSQL Row Level Security (RLS) and database functions
- **File storage:** Supabase Storage
- **Administrative operations:** Supabase Edge Function (`linkora-admin`)
- **Hosting and deployment:** Vercel, connected to a Git repository

There is no frontend framework or build pipeline required. The site is served as a static web application.

## 📁 Project structure

```text
Linkora/
├── index.html                         # Landing page
├── auth.html                          # Sign up, login, and password recovery
├── editor.html                        # Member profile editor and live preview
├── p.html                             # Public profile page
├── dashboard.html                     # Platform admin dashboard
├── assets/
│   ├── brand.svg                      # Linkora brand mark
│   ├── css/
│   │   └── app.css                    # Shared responsive design system
│   └── js/
│       ├── config.js                  # Public Supabase project configuration
│       ├── core.js                    # Shared client and helper functions
│       ├── auth.js                    # Authentication flows
│       ├── home.js                    # Landing page interactions
│       ├── editor.js                  # Profile editor and publishing
│       ├── public-profile.js           # Public profile rendering and events
│       ├── dashboard.js               # Admin dashboard and support tools
│       ├── i18n.js                    # Arabic / English translations
│       └── link-icons.js              # Social and link icon definitions
└── supabase/
    ├── schema.sql                     # Base database schema and RLS policies
    ├── upgrade_admin.sql              # Admin messaging and account controls
    ├── linkora_features_upgrade.sql   # Memberships, cover images, and analytics
    ├── linkora_display_controls_upgrade.sql
    └── functions/
        └── linkora-admin/
            └── index.ts               # Protected administrative Edge Function
```

## 🚀 Setup and deployment

The instructions below are for setting up your own instance. You need a Supabase project and a Git repository connected to Vercel.

### 1. Create a Supabase project

Create a project in [Supabase](https://supabase.com/), then open its SQL Editor.

For a **new database**, run the SQL files in this order:

1. `supabase/schema.sql` — creates the core tables, profile functions, storage bucket, triggers, and base RLS policies.
2. `supabase/upgrade_admin.sql` — adds the admin messaging and account-management support.
3. `supabase/linkora_features_upgrade.sql` — adds memberships, cover images, and profile analytics.
4. `supabase/linkora_display_controls_upgrade.sql` — adds independent badge visibility and link display controls. Run this after the features upgrade.

Run each file completely and check that it finishes without errors before moving to the next one. If you are updating an existing installation, back up the database first and apply only the migrations that are not already installed. Do not blindly rerun an old schema against a live production database.

### 2. Configure the frontend

Open `assets/js/config.js` and add your own Supabase project URL and **publishable key** (or the legacy `anon` key for an older project):

```js
window.LINKORA_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseKey: "YOUR_SUPABASE_PUBLISHABLE_KEY",
  projectName: "Linkora"
};
```

The publishable key is intended for browser applications, but it must be paired with correctly configured RLS policies. **Never put a Supabase secret key or `service_role` key in this file, any frontend script, or a public Git repository.** See the [Supabase security guide](https://supabase.com/docs/guides/database/secure-data) and [API keys guide](https://supabase.com/docs/guides/getting-started/api-keys).

### 3. Configure authentication URLs

In Supabase, open **Authentication → URL Configuration** and set the production Site URL to your deployed domain, for example:

```text
https://linkora-design.vercel.app
```

Add the following redirect URLs (replace the domain if you deploy elsewhere):

```text
https://linkora-design.vercel.app/auth.html
https://linkora-design.vercel.app/auth.html?mode=confirm
https://linkora-design.vercel.app/auth.html?mode=reset
```

Add your local development URLs as well when testing locally. Make sure your email confirmation and password recovery templates send users back to the configured application URL.

### 4. Deploy the admin Edge Function

The admin dashboard calls the `linkora-admin` Supabase Edge Function for protected operations such as membership updates, account bans, page resets, and permanent account deletion.

From the project root, use the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy linkora-admin
```

The function expects the Supabase project URL, a public/publishable client key, and a backend-only secret/service-role key in its runtime environment. Keep the secret/service-role key in Supabase function secrets only. The function verifies the signed-in user and checks the `platform_admins` table before performing administrative actions. Keep the supplied `supabase/config.toml` function setting aligned with the current handler.

### 5. Create the first platform administrator

First, register the account that should own the platform. After the account exists, run the following SQL in Supabase, replacing the email address:

```sql
insert into public.platform_admins (user_id)
select id
from auth.users
where lower(email) = lower('YOUR-ADMIN-EMAIL@example.com')
on conflict (user_id) do nothing;
```

Sign out and sign in again, then open `dashboard.html`. Only trusted project owners should be able to add rows to `platform_admins`.

### 6. Deploy on Vercel

1. Push the project files to a Git repository on GitHub.
2. In [Vercel](https://vercel.com/), choose **Add New → Project** and import that repository.
3. Use the project root as the Root Directory and choose **Other** as the framework preset.
4. This is a static site: no build command or install command is required. If Vercel asks for an output directory, use the project root (`.`).
5. Deploy and confirm that the homepage and the authentication redirect URLs use the production domain.

Once the repository is connected, pushes to the configured production branch can trigger deployments automatically. See [Vercel Git deployments](https://vercel.com/docs/git).

### 7. Test the main flows

Before sharing the site publicly, test these flows with separate ordinary-member and administrator accounts:

- Sign up, email confirmation, login, logout, and password recovery.
- Create a profile, choose a unique username, add links, and upload an image.
- Save a draft, publish it, and open the public profile in a private browser window.
- Verify optional profile fields remain hidden unless their visibility setting is enabled.
- Test page views, link clicks, QR display, and copy-link behavior.
- Submit a support request and reply from the admin dashboard.
- Verify that an ordinary member cannot access administrator actions or grant themselves badges.

## 🔐 Privacy and security

- Supabase RLS policies are the authorization layer; hiding a button in the interface is not a security control.
- Keep `platform_admins` restricted. Grant admin access manually through trusted SQL operations only.
- Never expose a secret/service-role key in browser code or GitHub. Use it only in the Edge Function's protected runtime.
- Public profile data is returned through a dedicated database function. Optional fields are included according to the member's visibility settings; the public profile receives the age rather than the exact date of birth.
- Uploaded profile and cover images are stored in a public-readable bucket so published pages can display them. Upload only images you are comfortable making public.
- Test RLS with a visitor, an ordinary member, and an administrator before launch. Review the project's privacy notice, terms, backup plan, and account-deletion process before operating it as a public service.

## 🧪 Local development

Because the project uses JavaScript modules, serve it through a local web server instead of opening HTML files with `file://`. For example, use the VS Code Live Server extension or another local static server. Configure Supabase redirect URLs for the local origin before testing email confirmation or password recovery.

## 📌 Current scope

Linkora is a working multi-user web application, but its deployment still depends on correct Supabase configuration and database migrations. Membership badges are currently assigned by an administrator; paid checkout and automatic subscription billing are not part of this release. Analytics require the supplied feature migration to be applied.

## 📄 License

No `LICENSE` file is included in this repository. Unless a license is added by the project owner, do not assume that the source code is licensed for reuse or redistribution.

---

<div align="center">
  <strong>Linkora</strong><br>
  <sub>Your page. Your colors. Your identity.</sub><br><br>
  <a href="https://linkora-design.vercel.app/">Visit the live website ↗</a>
</div>
