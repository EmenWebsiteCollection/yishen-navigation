# 找回密码功能（邮箱验证码，方案 B：Netlify 函数 + Resend）

本补丁为登录流程增加了「忘记密码？」入口，支持通过 **邮箱** 接收 6 位验证码，校验通过后重置密码。

> 手机号验证码暂未上线：找回密码弹窗里点「手机号（部署中）」只会显示占位提示，不发送短信。

## 实现方式（不依赖 Supabase SMTP）

整站账号/数据仍在 **Supabase** 上，但「发邮件」这一步不再走 Supabase 的邮件渠道，而是：

1. **前端**（`src/services/passwordRecovery.js`）向两个 Netlify 函数发请求：
   - `POST /.netlify/functions/send-reset-code` —— 请求发送验证码
   - `POST /.netlify/functions/reset-password` —— 提交验证码 + 新密码
2. **`send-reset-code` 函数**：校验邮箱格式 → 用 Supabase `service_role` 确认账号存在 → 生成 6 位随机码（10 分钟有效）存入 **Netlify Blob** → 调用 **Resend API** 发送验证码邮件。
3. **`reset-password` 函数**：校验验证码与有效期 → 用 Supabase `service_role` 的 `updateUserById` 直接重置密码（无需用户会话）。

好处：你的 **Resend Key 与 Supabase service_role Key 只存在于 Netlify 服务端环境变量**，不进前端代码、不提交公开仓库；也完全不用在 Supabase 后台配置 SMTP / Email 渠道。

涉及文件：
- `netlify/functions/send-reset-code.mjs` —— 生成码 + Resend 发信
- `netlify/functions/reset-password.mjs` —— 校验码 + service_role 重置
- `src/services/passwordRecovery.js` —— 前端改为调用上述函数
- `src/pages/ForgotPasswordPage.jsx` —— 找回密码弹窗（邮箱 Tab；手机号 Tab 显示「部署中」）
- `src/pages/LoginPage.jsx` —— 新增「忘记密码？」链接
- `src/pages/HomePage.jsx` —— 挂载找回密码弹窗
- `src/services/auth.js` —— `login`/`register` 支持识别用户名/邮箱/手机号（兼容旧 `username@nav.local` 账号）

## 必须配置的 Netlify 环境变量

在 Netlify 控制台 → **Site settings → Environment variables** 添加：

| Key | 值 | 说明 |
|---|---|---|
| `RESEND_API_KEY` | `re_xxx...` | 你的 Resend API Key（仅服务端） |
| `RESEND_FROM` | `onboarding@resend.dev` | 发件地址；测试用，无需验证域名；正式环境改为 Resend 验证过的域名邮箱 |
| `SUPABASE_URL` | `https://naaczfnskkpsujdfwurj.supabase.co` | 你的 Supabase 项目地址 |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | **service_role 密钥**，见下方获取方式（仅服务端，切勿暴露到前端） |

### 获取 `SUPABASE_SERVICE_ROLE_KEY`
这是方案 B 唯一需要进一次 Supabase 后台的地方：
1. 打开 https://supabase.com/dashboard → 进入项目 `naaczfnskkpsujdfwurj`
2. 左侧 **Project Settings → API**
3. 在 **Project API keys** 里找到 `service_role` 那一行，点击小眼睛复制（注意和 `anon`/`public` 区分开）

> ⚠️ `service_role` Key 拥有绕过所有权限规则的最高权限，**只能放在服务端环境变量**，绝不能写进前端代码或提交到仓库。

## 本地调试

Netlify 函数依赖 Netlify 运行时（含 Blob 存储），本地需使用 `netlify dev` 而非 `npm run dev`：

```bash
npm install
npx netlify dev          # 会同时启动前端与 /.netlify/functions
```

本地运行时也要在 shell 里导出上述 4 个环境变量（或在项目根目录建 `.env` 供 `netlify dev` 读取，注意别提交）。

## 重要限制（务必阅读）

1. **旧账号（`username@nav.local`）仍无法被找回**
   原注册逻辑把用户名补全为 `username@nav.local` 这个假邮箱，收不到真实邮件。用纯用户名注册的旧账号只能靠记住用户名登录；只有**注册时填了真实邮箱**的账号能用本功能找回。

2. **让新账号可被找回**
   注册页「用户名」现已支持填写真实邮箱。建议用户注册时用真实邮箱，既能直接登录，也能在忘记密码时通过验证码找回。

3. **service_role Key 安全**
   该 Key 只在 Netlify 函数中使用。任何前端代码、GitHub 公开仓库都不要出现它。

4. **手机号验证码未上线**
   当前版本手机号 Tab 显示「🚧 手机号验证码功能正在部署中」，不会发送短信。
