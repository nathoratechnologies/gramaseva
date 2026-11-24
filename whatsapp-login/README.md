# WhatsApp വഴി free login — setup

SMS OTP-ക്ക് പണം കൊടുക്കാതെ, മൊബൈൽ നമ്പർ ഉറപ്പാക്കി login ചെയ്യാനുള്ള വഴി.

## എങ്ങനെ പ്രവർത്തിക്കുന്നു

1. User app-ൽ **"WhatsApp വഴി login (free)"** അമർത്തുന്നു.
2. WhatsApp തുറക്കും; `GRAMASEVA LOGIN AB12CD` എന്ന മെസേജ് നമ്മുടെ business നമ്പറിലേക്ക് അയയ്ക്കാൻ തയ്യാറായിരിക്കും. User **Send** അമർത്തുന്നു.
3. Meta ആ മെസേജ് ഈ Cloudflare Worker-ലേക്ക് അയയ്ക്കുന്നു (webhook). ഏത് നമ്പറിൽ നിന്നാണ് വന്നതെന്ന് Meta ഉറപ്പ് തരുന്നു.
4. Worker ഒരു Firebase login token ഉണ്ടാക്കുന്നു; app തനിയെ login ആകുന്നു.

**എന്തുകൊണ്ട് free?** User നമ്മുടെ നമ്പറിലേക്ക് അയയ്ക്കുന്ന മെസേജിന് Meta പണം ഈടാക്കില്ല. നമ്മൾ തിരിച്ച് ഒരു മെസേജും അയയ്ക്കുന്നില്ല. Cloudflare Workers-ന്റെ free plan മതി (ദിവസം 1 ലക്ഷം request). Firebase-ൽ custom token login, Spark (free) plan-ലും പ്രവർത്തിക്കും.

**പരിധി:** Cloudflare KV free plan-ൽ ദിവസം 1000 write. ഒരു login-ന് ഒരു write ആണ്, അതുകൊണ്ട് ദിവസം ഏകദേശം **1000 പുതിയ login** വരെ free. ഒരിക്കൽ login ചെയ്തവർ logout ചെയ്യുന്നത് വരെ login ആയി തന്നെ ഇരിക്കും.

## ആവശ്യമുള്ളത്

- WhatsApp-ൽ ഇതുവരെ ഉപയോഗിക്കാത്ത ഒരു മൊബൈൽ നമ്പർ (പുതിയ SIM). സാധാരണ WhatsApp / WhatsApp Business app-ൽ ഉള്ള നമ്പർ Cloud API-യിൽ ചേർക്കാൻ പറ്റില്ല.
- Meta (Facebook) developer account.
- Cloudflare account (free).
- Node.js (ഇപ്പോൾ ഉള്ളത് മതി).

## 1. Firebase service account

1. Firebase console → ⚙️ Project settings → **Service accounts** → **Generate new private key**. ഒരു JSON file download ആകും.
2. **ഈ file ആർക്കും കൊടുക്കരുത്, git-ൽ ചേർക്കരുത്.** അതിലെ `client_email`, `private_key`, `project_id` താഴെ ഉപയോഗിക്കും.

## 2. Cloudflare Worker

```bash
cd whatsapp-login
npx wrangler login
npx wrangler kv namespace create LOGINS     # കിട്ടുന്ന id wrangler.toml-ൽ [[kv_namespaces]] id = "..." ആയി ചേർക്കുക
```

`wrangler.toml`-ൽ നിറയ്ക്കുക: `WA_NUMBER` (ഉദാ: `919xxxxxxxxx`), `FIREBASE_PROJECT_ID`, `ALLOWED_ORIGINS` (ഉദാ: `https://gramaseva.web.app,https://gramaseva.firebaseapp.com`).

Secrets (ഓരോന്നും ചോദിക്കുമ്പോൾ value paste ചെയ്യുക):

```bash
npx wrangler secret put META_APP_SECRET
npx wrangler secret put META_VERIFY_TOKEN
npx wrangler secret put SESSION_SECRET
npx wrangler secret put UID_SALT          # പിന്നീട് ഒരിക്കലും മാറ്റരുത്
npx wrangler secret put FIREBASE_CLIENT_EMAIL
npx wrangler secret put FIREBASE_PRIVATE_KEY
npx wrangler deploy
```

Deploy കഴിഞ്ഞാൽ കിട്ടുന്ന address (ഉദാ: `https://gramaseva-wa-login.<name>.workers.dev`) കുറിച്ചു വെക്കുക.

## 3. Meta / WhatsApp Cloud API

1. https://developers.facebook.com → **My Apps → Create app** → Business type.
2. App-ൽ **WhatsApp** product ചേർക്കുക → **API Setup**-ൽ നിങ്ങളുടെ പുതിയ നമ്പർ ചേർത്ത് verify ചെയ്യുക.
3. **App settings → Basic → App secret** → ഇതാണ് `META_APP_SECRET`.
4. **WhatsApp → Configuration → Webhook → Edit**:
   - Callback URL: `https://gramaseva-wa-login.<name>.workers.dev/webhook`
   - Verify token: `META_VERIFY_TOKEN` ആയി കൊടുത്ത അതേ text
   - **Verify and save**, പിന്നെ **Webhook fields → messages → Subscribe**.
5. App **Live** mode-ലേക്ക് മാറ്റുക (Development mode-ൽ എല്ലാവരുടെയും മെസേജ് webhook-ൽ വരില്ല).

## 4. App-ൽ ഓൺ ചെയ്യുക

`.env`-ൽ ചേർക്കുക:

```
VITE_WA_LOGIN_URL=https://gramaseva-wa-login.<name>.workers.dev
```

പിന്നെ `npm run deploy`. ഇത് ഇല്ലെങ്കിൽ WhatsApp ബട്ടൺ കാണിക്കില്ല; Google, ഫോൺ OTP എന്നിവ പഴയത് പോലെ തന്നെ.

## ശ്രദ്ധിക്കുക

- മുമ്പ് SMS OTP വഴി login ചെയ്ത നമ്പർ ആണെങ്കിൽ, അതേ account തന്നെ തുറക്കും (Worker Firebase-ൽ നമ്പർ നോക്കുന്നു).
- Google വഴി മാത്രം login ചെയ്തവർ WhatsApp വഴി വന്നാൽ പുതിയ account ആയിരിക്കും.
- Meta-യുടെ നിരക്കുകൾ മാറാം. User അയയ്ക്കുന്ന മെസേജുകൾക്ക് ഇപ്പോൾ ചാർജ് ഇല്ല: https://developers.facebook.com/docs/whatsapp/pricing
