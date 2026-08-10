# 找回密码功能 · 部署与配置指南

> 邮箱验证码找回密码已可用；手机短信通道预留但未接入，前后端均显示「部署中」。

## 一、功能构成

| 层 | 文件 | 说明 |
|----|------|------|
| 数据库 | `sql/002_password_reset.sql` | `profiles.email/phone` 字段、`password_reset_codes` 验证码表、`bind_contact()` 绑定函数 |
| 服务端 | `netlify/functions/password-reset.mjs` | 发码 / 验码 / 改密，密钥只存在于 Netlify 环境变量 |
| 前端服务 | `src/services/passwordReset.js` | 调用上面的 Function |
| 找回页面 | `src/pages/ForgotPasswordPage.jsx` | 邮箱 / 手机双 Tab，手机 Tab 显示「部署中」 |
| 弹窗入口 | `src/components/AuthModals.jsx` | 登录弹窗「忘记密码？」→ 找回密码 |
| 路由入口 | `src/App.jsx` | 独立页 `/forgot-password` |
| 补绑入口 | `src/pages/ProfilePage.jsx` | 个人中心 →「账号安全」，老用户补邮箱/手机 |
| 注册补绑 | `src/pages/RegisterPage.jsx` | 注册时可选填邮箱/手机 |

安全设计：
- 验证码不落库明文，存 `sha256(code + user_id)`；有效期 10 分钟。
- 单个验证码最多校验 5 次，超出即作废。
- 同一联系方式 60 秒内只能发一次，防邮件轰炸与发信额度被刷。
- 账号不存在时**也返回发送成功**，防止通过接口枚举已注册邮箱。
- `password_reset_codes` 表开启 RLS 且不建任何策略，只有服务端 `service_role` 能读写。

---

## 二、第一步：执行数据库脚本

Supabase Dashboard → SQL Editor，依次执行：

1. `sql/002_password_reset.sql`（幂等，可重复执行）

如果之前执行过旧版本、遇到 `INSERT has more target columns than expressions` 报错，再补执行一次 `sql/fix_bind_contact.sql`。

验证是否成功：

```sql
-- 应能看到 email / phone 两列
select column_name from information_schema.columns
where table_schema='public' and table_name='profiles' and column_name in ('email','phone');

-- 应能看到验证码表
select to_regclass('public.password_reset_codes');
```

---

## 三、第二步：阿里云邮件推送（DirectMail）配置

你已有发信域名，按下面把它接到系统里。

### 3.1 控制台侧

1. 进入 [邮件推送控制台](https://dm.console.aliyun.com/)，确认**发信域名**状态为「验证通过」（SPF、MX、DKIM 三项都要通过，否则会大量进垃圾箱）。
2. 左侧「发信地址」→ 新建发信地址，例如 `noreply@你的域名.com`：
   - 发信类型选 **触发邮件**（验证码属于触发类，走的额度和通道都更合适）
   - 设置回信地址并完成验证
3. 记下这个完整发信地址，它就是环境变量 `EMAIL_FROM`。

### 3.2 创建 RAM 子账号（不要用主账号 AccessKey）

1. [RAM 控制台](https://ram.console.aliyun.com/users) → 创建用户 → 勾选「使用永久 AccessKey 访问」
2. 保存好 **AccessKey ID** 和 **AccessKey Secret**（Secret 只显示一次）
3. 给该用户授权：`AliyunDirectMailFullAccess`（或更小范围的自定义只发信策略）

### 3.3 Netlify 环境变量

Netlify 后台 → Site settings → Environment variables，添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | **service_role** 密钥，非 anon key |
| `EMAIL_PROVIDER` | `aliyun` | 固定值 |
| `EMAIL_FROM` | `noreply@你的域名.com` | 3.1 里创建的发信地址 |
| `EMAIL_FROM_NAME` | `依神网站汇总` | 可选，发件人显示名；不配时使用默认值 |
| `ALIYUN_ACCESS_KEY_ID` | `LTAI...` | RAM 子账号 |
| `ALIYUN_ACCESS_KEY_SECRET` | `****` | RAM 子账号 |
| `ALIYUN_REGION_ID` | `cn-hangzhou` | 可选，默认杭州；新加坡填 `ap-southeast-1` |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` 拥有绕过 RLS 的最高权限，**只能配在 Netlify 服务端环境变量里**，绝不能写进 `.env.local` 里带 `VITE_` 前缀的变量，否则会被打包进前端产物泄露。

改完环境变量需要 **重新部署（Trigger deploy → Clear cache and deploy site）** 才会生效。

---

## 四、防垃圾邮件与送达率（Outlook 进垃圾箱排查）

验证码邮件被 Outlook 等邮箱判为垃圾邮件，通常与发信域名信誉和邮件内容有关，按下面顺序排查：

1. 发信域名必须在阿里云 DirectMail 控制台显示「验证通过」，SPF、MX、DKIM 三项齐全，建议再配置 DMARC；`EMAIL_FROM` 必须使用控制台里已验证的发信地址，不要用免费邮箱或转发地址。
2. 新域名或共享 IP 需要低量预热，持续关注阿里云控制台的退信和投诉数据，投诉率过高会直接拉低发信域名信誉。
3. 邮件内容保持纯文本 + 简洁 HTML：无外链、图片、附件与跟踪像素；不要把验证码写进邮件主题，避免更贴近钓鱼邮件特征。
4. Outlook 用户首次收到时选择「标记为不是垃圾邮件」，可在 Outlook 安全发件人列表中加入发信地址；若仍进垃圾箱，优先回阿里云控制台确认域名验证状态，并核对 `InvalidSendingDomain` / `InvalidAccountName` 报错。
5. 修改 `EMAIL_FROM_NAME` 或域名验证后，在 Netlify 触发一次带缓存的重新部署再测试。

---

## 五、第三步：验证

### 本地验证

```bash
npm run netlify:dev
```

然后直接打接口：

```bash
curl -X POST http://localhost:8888/.netlify/functions/password-reset \
  -H "Content-Type: application/json" \
  -d '{"action":"request","contactType":"email","contact":"你已绑定的邮箱@example.com"}'
```

预期返回 `{"ok":true,"channel":"email","message":"若该联系方式已绑定账号..."}` 并收到邮件。

### 线上验证

1. 用一个老账号登录 → 个人中心 → 账号安全 → 填邮箱 → 保存联系方式
2. 退出登录 → 点登录 → 「忘记密码？」
3. 输入刚绑定的邮箱 → 获取验证码 → 收邮件 → 填验证码 + 新密码 → 重置
4. 用新密码登录

### 常见报错对照

| 报错 | 原因 | 处理 |
|------|------|------|
| `InvalidAccountName` | `EMAIL_FROM` 不是控制台里已验证的发信地址 | 核对 3.1 的发信地址 |
| `InvalidSendingDomain` | 发信域名未验证通过 | 回控制台补齐 SPF/MX/DKIM |
| `Forbidden.NotEnabled` | 邮件推送服务未开通 | 控制台开通 DirectMail |
| `SignatureDoesNotMatch` | AccessKey Secret 错了，或复制时带了空格 | 重新填写 |
| `阿里云邮件未配置（...）` | `ALIYUN_ACCESS_KEY_ID/SECRET` 缺失 | 补齐并重新部署 |
| `服务器未配置发信地址（EMAIL_FROM）` | `EMAIL_FROM` 没配 | 补齐并重新部署 |
| `发送过于频繁，请 N 秒后再试` | 触发了 60 秒限频 | 正常保护，等待即可 |
| 收不到邮件但接口返回成功 | 进了垃圾箱 / 该邮箱未绑定任何账号 | 查垃圾箱；确认已在个人中心绑定 |
| 验证码进了 Outlook 垃圾箱 | 发信域名未验证、信誉不足或邮件内容触发垃圾规则 | 按「四、防垃圾邮件与送达率」检查 SPF/DKIM/DMARC、发信地址与预热；Outlook 首次标记为非垃圾邮件 |

---

## 六、老用户补绑说明（重要）

本站账号体系是「用户名 + 自动补 `@nav.local` 假邮箱」，**老用户默认没有真实邮箱**，因此：

- 还记得密码的老用户：登录 → 个人中心 → 账号安全 → 补填邮箱，之后即可自助找回。
- **已经忘记密码且从未绑定邮箱的老用户：无法自助找回**，只能由管理员在 Supabase Dashboard → Authentication → Users 里手动重置密码，或用 SQL 帮其写入 `profiles.email` 后再走找回流程。

建议在站内公告里提醒老用户尽早补绑，否则这个功能对他们不生效。

---

## 七、手机短信通道（当前：部署中）

前端手机 Tab 已做灰化 + 「🚧 正在部署中」提示，后端对 `contactType=phone` 直接返回 503。

后续接入阿里云短信服务时，只需：

1. 在 `password-reset.mjs` 里新增 `sendCodeSms()`（阿里云 SMS 的 `SendSms` 接口，签名逻辑与本文件的 `aliyunEncode` + HMAC-SHA1 完全一致，可直接复用）
2. 把 `handleRequest` 开头那段 `if (!email) return 503` 改为调用 `sendCodeSms`
3. 前端把 `ForgotPasswordPage.jsx` 里 `tab === 'phone'` 的禁用条件与提示块删掉

数据库和验证码校验逻辑已按 `contact_type in ('email','phone')` 设计好，无需改表。
