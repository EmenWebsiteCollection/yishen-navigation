# 找回密码功能（手机号 / 邮箱验证码）

本补丁为登录流程增加了「忘记密码？」入口，支持通过 **邮箱** 或 **手机号** 接收 6 位验证码，校验通过后重置密码。

## 实现方式

基于项目已有的 **Supabase Auth**，使用官方 OTP（一次性验证码）能力，纯前端实现，无需自建后端：

1. `supabase.auth.signInWithOtp({ email } | { phone })` —— 发送验证码
   - 已设置 `shouldCreateUser: false`，仅向已存在的账号发送，不会误建新账号。
2. `supabase.auth.verifyOtp({ email|phone, token, type })` —— 校验验证码并建立会话
3. `supabase.auth.updateUser({ password })` —— 在会话中重置密码（账号不变，仅更新密码）

涉及文件：
- `src/services/passwordRecovery.js` —— 发送验证码 / 校验并重置密码 / 格式校验
- `src/pages/ForgotPasswordPage.jsx` —— 找回密码弹窗（邮箱/手机号切换、60s 重发倒计时、验证码与新密码输入）
- `src/pages/LoginPage.jsx` —— 新增「忘记密码？」链接（`onForgotPassword`）
- `src/pages/HomePage.jsx` —— 挂载找回密码弹窗
- `src/services/auth.js` —— `login` / `register` 现在可识别用户名 / 邮箱 / 手机号（兼容旧的 `username@nav.local` 账号）

## 前置配置（必须在 Supabase 后台开启）

验证码要能真正发出，需要在 Supabase 项目中启用对应渠道：

### 邮箱验证码（经由 Resend 发送，推荐）
本项目的邮件通过 **Resend** 发送。Resend 的 API Key 本身就是 **SMTP 密码**，最安全、零代码改动的做法是把它填进 Supabase 的自定义 SMTP，这样 `signInWithOtp` 就会经由 Resend 真实把验证码邮件发出去（**Key 不进前端代码、不提交到公开仓库**）。

配置步骤（Supabase 控制台 → **Authentication → Settings → Custom SMTP → Enable**）：
- **SMTP Host**：`smtp.resend.com`
- **SMTP Port**：`587`（STARTTLS）
- **SMTP User**：`resend`
- **SMTP Password**：你的 Resend API Key（形如 `re_xxx...`）
- **Sender email**：`onboarding@resend.dev`（测试用，无需验证域名）；正式环境改为你在 Resend 验证过的域名邮箱
- **Sender name**：依神导航
- **Authentication → Providers → Email** 中确认 **Email OTP** 已启用

> 验证是否生效：注册一个用真实邮箱的账号（或在已有账号的 Email 里改成你的真实邮箱），点「忘记密码？」→ 选邮箱 → 发送验证码，正常应能收到来自 Resend 的邮件。

### 手机号验证码（短信）—— 暂未上线
- 当前版本中「手机号」Tab 点击后显示 **「🚧 手机号验证码功能正在部署中」**，不会真正发送短信。
- 如需上线，再于 Supabase 控制台 **Authentication → Providers → Phone** 启用并配置短信服务商（Twilio / Vonage / MessageBird 等）。

> ⚠️ 若未配置上述邮箱 SMTP，`signInWithOtp` 会返回错误（如未配置邮件服务），前端会如实提示，但不会静默失败。

## 重要限制（务必阅读）

1. **旧账号（`username@nav.local`）无法被找回**
   原注册逻辑把用户名自动补全为 `username@nav.local` 这个「假邮箱」，该地址无法接收真实邮件 / 短信。因此：
   - 用**纯用户名**注册的旧账号无法通过本功能找回密码（它们本来也不需要邮箱/手机，记住用户名即可登录）。
   - 只有**注册时填写了真实邮箱或手机号**的账号，才能用本功能找回密码。

2. **让新账号可被找回**
   注册页「用户名」现已支持填写真实邮箱或手机号。建议用户注册时使用真实邮箱 / 手机号，这样既能用该联系方式直接登录，也能在忘记密码时通过验证码找回。

3. **短信资费**
   手机号验证码依赖第三方短信服务，会产生费用，请注意套餐限额。

## 本地验证

```bash
npm install
npm run dev
```

打开登录弹窗 → 点击「忘记密码？」→ 选择邮箱/手机号 → 发送验证码 → 输入验证码与新密码 → 重置成功后用新密码登录。
