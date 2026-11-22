# ഗ്രാമസേവ — Setup ഗൈഡ് (തുടക്കക്കാർക്ക്)

ഈ ഗൈഡ് പിന്തുടർന്നാൽ ഗ്രാമസേവ app നിങ്ങളുടെ സ്വന്തം website ആയും ഫോണിൽ install ചെയ്യാവുന്ന app ആയും പ്രവർത്തിക്കും. Coding അറിയേണ്ട; പറഞ്ഞ commands copy-paste ചെയ്താൽ മതി.

> **gramaseva-b2724 project-ൽ ഇതിനകം ചെയ്തത് (Claude):** Web app register ചെയ്തു, `.env`, `.firebaserc` നിറച്ചു (3.5, 3.6-ലെ `firebase use`), Firestore database Mumbai-യിൽ ഉണ്ടാക്കി (3.4), security rules publish ചെയ്തു, Phone sign-in on ആക്കി, SMS region policy-യിൽ India allow ചെയ്തു, test നമ്പർ **+91 9999999999 / OTP 123456** ചേർത്തു (3.3). ഇനി നിങ്ങൾ ചെയ്യേണ്ടത്: ഭാഗം 1 → `npm run dev` → 3.7 മുതൽ.

ആകെ 4 ഭാഗങ്ങൾ:

1. Computer തയ്യാറാക്കുക (ഒറ്റത്തവണ, 15 മിനിറ്റ്)
2. Demo mode-ൽ app തുറന്ന് നോക്കുക (5 മിനിറ്റ്)
3. Firebase ഉണ്ടാക്കി യഥാർത്ഥ app ആക്കുക (45 മിനിറ്റ്)
4. Internet-ൽ ഇടുക (publish), ഫോണിൽ install ചെയ്യുക

---

## ഭാഗം 1: Computer തയ്യാറാക്കുക

Windows, Mac, Linux ഏതായാലും മതി.

1. **Node.js install ചെയ്യുക**: https://nodejs.org തുറന്ന് **LTS** എന്നെഴുതിയ ബട്ടൺ അമർത്തി download ചെയ്ത് install ചെയ്യുക. എല്ലാ ചോദ്യങ്ങൾക്കും "Next" മതി.
2. **ഈ project folder unzip ചെയ്യുക**: `gramaseva.zip` right-click → Extract All. ഉദാ: `Documents\gramaseva`.
3. **Terminal തുറക്കുക**:
   - Windows: folder തുറന്ന്, മുകളിലെ address bar-ൽ `cmd` എന്ന് type ചെയ്ത് Enter.
   - Mac: Terminal app തുറന്ന് `cd ` എന്ന് type ചെയ്ത്, folder Terminal-ലേക്ക് വലിച്ചിട്ട് Enter.
4. Terminal-ൽ ഇത് type ചെയ്ത് Enter (ഒറ്റത്തവണ മതി, 1–2 മിനിറ്റ് എടുക്കും):

   ```
   npm install
   ```

## ഭാഗം 2: Demo mode-ൽ തുറന്ന് നോക്കുക

```
npm run dev
```

Terminal-ൽ `http://localhost:5173` എന്ന് കാണിക്കും. അത് Chrome-ൽ തുറക്കുക.

- ഏത് 10 അക്ക ഫോൺ നമ്പറും നൽകാം. OTP: **123456**
- ഇതിലുള്ള ആളുകളും നമ്പറുകളും വാർത്തകളും ഉദാഹരണം മാത്രമാണ്.
- Demo-യിൽ നിങ്ങൾ തന്നെയാണ് Super admin. Profile → Admin panel തുറന്ന് നോക്കാം.
- നിർത്താൻ Terminal-ൽ `Ctrl + C`.

## ഭാഗം 3: Firebase (യഥാർത്ഥ data, യഥാർത്ഥ OTP)

Firebase എന്നത് Google-ന്റെ സേവനമാണ്. Login, database, website hosting എല്ലാം ഇതിലാണ്.

### 3.1 Project ഉണ്ടാക്കുക

1. https://console.firebase.google.com തുറന്ന് Google account-ൽ login ചെയ്യുക.
2. **Create a project** → പേര്: `gramaseva` → Google Analytics വേണ്ട (off) → Create.

### 3.2 Billing (യഥാർത്ഥ SMS-ന് നിർബന്ധം)

Free (Spark) plan-ൽ **Firebase-ൽ ചേർത്ത test നമ്പറുകൾ മാത്രമേ** login ചെയ്യൂ (SMS പോകില്ല). യഥാർത്ഥ നമ്പറുകളിലേക്ക് OTP SMS അയയ്ക്കാൻ **Blaze (pay-as-you-go)** plan വേണം; ഇല്ലെങ്കിൽ app `auth/billing-not-enabled` എന്ന് കാണിക്കും.

- Database, hosting എന്നിവ free പരിധിക്കുള്ളിൽ ആണെങ്കിൽ പൈസ വരില്ല (ദിവസം 50,000 reads, 20,000 writes വരെ free).
- **OTP SMS-ന് മാത്രം പൈസ**: ഇന്ത്യയിലേക്ക് ഒരു SMS-ന് ഏകദേശം $0.07 (₹6 ഓളം). ഒരാൾ ഒരിക്കൽ login ചെയ്താൽ പിന്നെ SMS വേണ്ട.
- Firebase console → ഇടത് താഴെ **Upgrade** → Blaze → card ചേർക്കുക. ഉടൻ **Budget alert** വെക്കുക (Google Cloud Billing → Budgets & alerts → ₹500).

### 3.3 Phone login on ആക്കുക

1. ഇടത് menu → **Build → Authentication** → Get started.
2. **Sign-in method** → **Phone** → Enable → Save.
3. Testing-ന് (SMS പൈസ ഇല്ലാതെ): അതേ പേജിൽ **Phone numbers for testing** → ഉദാ: `+91 9999999999`, code `123456` ചേർക്കുക.
4. **Settings → Authorized domains**: പിന്നീട് publish ചെയ്യുമ്പോൾ കിട്ടുന്ന `gramaseva-xxxx.web.app` ഇവിടെ തനിയെ ഉണ്ടാകും. സ്വന്തം domain (ഉദാ: gramaseva.in) വാങ്ങിയാൽ അത് ഇവിടെ ചേർക്കുക.

### 3.4 Database ഉണ്ടാക്കുക

1. **Build → Firestore Database** → Create database.
2. Location: **asia-south1 (Mumbai)** → Next → **Start in production mode** → Create.

### 3.5 App-നെ Firebase-ലേക്ക് ബന്ധിപ്പിക്കുക

1. Project Overview-ന് അടുത്തുള്ള ⚙️ → **Project settings**.
2. താഴെ **Your apps** → `</>` (Web) ഐക്കൺ → App nickname: `gramaseva-web` → Register app.
3. ഒരു `firebaseConfig` കാണിക്കും. അതിലെ values വേണം.
4. Project folder-ലെ `.env.example` എന്ന file copy ചെയ്ത് പേര് `.env` എന്ന് മാറ്റുക. Notepad-ൽ തുറന്ന് ഓരോ വരിയും നിറയ്ക്കുക:

   ```
   VITE_FIREBASE_API_KEY=AIza........
   VITE_FIREBASE_AUTH_DOMAIN=gramaseva-xxxx.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=gramaseva-xxxx
   VITE_FIREBASE_STORAGE_BUCKET=gramaseva-xxxx.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
   VITE_FIREBASE_APP_ID=1:1234567890:web:abcd...
   ```

   (ഈ values രഹസ്യമല്ല; app-നെ സംരക്ഷിക്കുന്നത് `firestore.rules` ആണ്.)

### 3.6 Firebase tool install ചെയ്യുക, rules ഇടുക

Terminal-ൽ ഓരോന്നായി:

```
npm install -g firebase-tools
firebase login
firebase use --add
```

`firebase use --add` ചോദിക്കുമ്പോൾ നിങ്ങളുടെ project തിരഞ്ഞെടുക്കുക, alias: `default`.

Security rules ഇടുക:

```
firebase deploy --only firestore
```

### 3.7 ആദ്യത്തെ Super admin (നിങ്ങൾ)

1. `npm run dev` → app തുറന്ന് **നിങ്ങളുടെ സ്വന്തം ഫോൺ നമ്പറിൽ** login ചെയ്യുക. Test നമ്പർ (9999999999) superadmin ആക്കരുത്: OTP 123456 അറിയാവുന്ന ആർക്കും അതിൽ login ചെയ്യാം. Launch-ന് മുമ്പ് test നമ്പർ Authentication → Sign-in method → Phone-ൽ നിന്ന് മാറ്റുക.
2. വില്ലേജ് ഇതുവരെ ഇല്ലാത്തതിനാൽ **"ഇപ്പോൾ ഒഴിവാക്കുക"** അമർത്തി പേര് നൽകി തുടരുക.
3. Firebase console → **Firestore Database** → `users` → നിങ്ങളുടെ document തുറക്കുക.
4. `role` എന്ന field-ലെ `user` എന്നത് `superadmin` ആക്കി Update.
5. App reload ചെയ്യുക → Profile → **Admin panel** കാണാം.

### 3.8 വില്ലേജുകൾ ചേർക്കുക

Admin panel → **വില്ലേജുകൾ** →

- പേര് (മലയാളം, English), പഞ്ചായത്ത്, ജില്ല.
- Latitude/Longitude: Google Maps-ൽ വില്ലേജിന്റെ മധ്യത്തിൽ long-press ചെയ്യുമ്പോൾ മുകളിൽ കാണുന്ന നമ്പറുകൾ (ഉദാ: `10.5276, 76.2144`).
- പഞ്ചായത്ത് ഓഫീസ് ഫോൺ.
- ആദ്യം **"ഉടൻ വരുന്നു"** ആയി സേവ് ചെയ്യുക. 20 പണിക്കാർ ചേർന്ന ശേഷം **"ലഭ്യം (Live)"** ആക്കുക.

പിന്നെ App → Profile → വില്ലേജ് → നിങ്ങളുടെ വില്ലേജ് തിരഞ്ഞെടുക്കുക.

### 3.9 Village Coordinator-മാരെ നിയമിക്കുക

1. Coordinator ആദ്യം സ്വന്തം ഫോണിൽ app-ൽ login ചെയ്യണം.
2. Admin panel → **Coordinators** → അവരുടെ നമ്പർ + വില്ലേജ് → നിയമിക്കുക.
3. അവർക്ക് ആ വില്ലേജിലെ വാർത്ത, സേവനദാതാക്കളുടെ approval, പരാതികൾ എന്നിവ നോക്കാം.

## ഭാഗം 4: Internet-ൽ ഇടുക (publish)

```
npm run deploy
```

ഇത് app build ചെയ്ത് Firebase Hosting-ൽ ഇടും. അവസാനം `Hosting URL: https://gramaseva-xxxx.web.app` എന്ന് കാണിക്കും. ഇതാണ് നിങ്ങളുടെ website.

**മാറ്റം വരുത്തിയാൽ** വീണ്ടും `npm run deploy` മാത്രം മതി.

### ഫോണിൽ app ആയി install ചെയ്യാൻ (free)

- Android Chrome-ൽ website തുറക്കുക → ⋮ menu → **Add to Home screen / Install app**.
- iPhone Safari → Share → **Add to Home Screen**.

ഹോം സ്ക്രീനിൽ ഗ്രാമസേവ ഐക്കൺ വരും, സാധാരണ app പോലെ തുറക്കാം.

### Play Store-ൽ ഇടാൻ (പിന്നീട്)

1. Google Play developer account എടുക്കുക (ഒറ്റത്തവണ $25).
2. https://www.pwabuilder.com തുറന്ന് നിങ്ങളുടെ website address നൽകുക → **Package for stores → Android** → download.
3. കിട്ടുന്ന `.aab` file Play Console-ൽ upload ചെയ്യുക. PWABuilder കൊടുക്കുന്ന `assetlinks.json` file ഈ project-ലെ `public/.well-known/` folder-ൽ ഇട്ട് വീണ്ടും `npm run deploy` ചെയ്യുക.
4. പുതിയ personal account ആണെങ്കിൽ ആദ്യം കുറച്ചുപേരെ വെച്ച് closed testing ചെയ്യണമെന്ന് Google ആവശ്യപ്പെടും; ഗ്രാമത്തിലെ പരിചയക്കാരെ ഉപയോഗിക്കാം.

---

## Launch checklist

- [ ] Budget alert വെച്ചു
- [ ] സ്വന്തം നമ്പറിൽ login ചെയ്ത് superadmin ആക്കി
- [ ] വില്ലേജ് ചേർത്തു
- [ ] 20 പണിക്കാരെയും ഡ്രൈവർമാരെയും നേരിട്ട് കണ്ട് app-ൽ register ചെയ്യിച്ചു, approve ചെയ്തു
- [ ] 3–4 വാർത്തകൾ ഇട്ടു (പഞ്ചായത്ത്, KSEB മുടക്കം…)
- [ ] 15–20 പേരെ വെച്ച് 2 ആഴ്ച test ചെയ്തു
- [ ] വില്ലേജ് "Live" ആക്കി, ഓട്ടോ സ്റ്റാൻഡിലും കടകളിലും website QR code poster വെച്ചു

## പ്രശ്നങ്ങൾ വന്നാൽ

| പ്രശ്നം | പരിഹാരം |
| --- | --- |
| `npm` കണ്ടെത്താനായില്ല | Node.js install ചെയ്ത ശേഷം Terminal അടച്ച് വീണ്ടും തുറക്കുക |
| ഇപ്പോഴും "Demo" എന്ന് കാണിക്കുന്നു | `.env` file-ന്റെ പേര് ശരിയാണോ (`.env.example` അല്ല) എന്ന് നോക്കി `npm run dev` വീണ്ടും തുടങ്ങുക |
| OTP വരുന്നില്ല / `auth/operation-not-allowed` | Authentication → Settings → **SMS region policy** → Allow → India → Save. Phone sign-in enable ആണോ, domain Authorized domains-ൽ ഉണ്ടോ എന്നും നോക്കുക |
| `auth/billing-not-enabled` | യഥാർത്ഥ SMS-ന് Blaze plan വേണം (3.2). അതുവരെ test നമ്പർ ഉപയോഗിക്കുക |
| `auth/quota-exceeded` | ഇന്നത്തെ SMS പരിധി കഴിഞ്ഞു. കുറച്ച് കഴിഞ്ഞ് ശ്രമിക്കുക |
| "Missing or insufficient permissions" | `firebase deploy --only firestore` ചെയ്തോ? Admin കാര്യങ്ങൾക്ക് `role` ശരിയാണോ? |
| Admin panel കാണുന്നില്ല | Firestore-ൽ നിങ്ങളുടെ `role` = `superadmin` ആണോ എന്ന് നോക്കി app reload ചെയ്യുക |
