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

### 邮箱验证码
- Supabase 控制台 → **Authentication → Providers → Email**
  - 确认 **Email OTP** 已启用（默认开启）。
  - 配置 **SMTP**（Authentication → Email → SMTP settings），否则验证码只会在开发环境的 Auth 日志中显示，不会真正发信。
- 开发调试：未配置 SMTP 时，验证码会出现在 Supabase 控制台 **Authentication → Users** 对应用户详情，或 **Logs** 中。

### 手机号验证码（短信）
- Supabase 控制台 → **Authentication → Providers → Phone**
  - 启用 Phone，并配置短信服务商（Twilio / Vonage / MessageBird 等）的 API 凭据。
  - 短信 OTP 必须配置服务商后才能发送。

> ⚠️ 若未配置上述渠道，`signInWithOtp` 会返回错误（如 `sms_send_failed` / 未配置邮件服务），前端会如实提示，但不会静默失败。

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
