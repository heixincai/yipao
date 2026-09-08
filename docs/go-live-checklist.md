# 宜跑 v0.1 上线 Checklist（从零注册 · 先不接 GPS）

目标：**用个人主体，从零注册微信小程序账号到正式发布，且 v0.1 不接 GPS 定位**。
「先不接 GPS」符合 ADR-0004：跑点模式已是完整主路径，避开 `wx.getLocation` 类目/隐私申请这个最可能的审核卡点，先把产品验证跑起来。

> 正文用 `[ ]`/`[x]` 勾选，各地步骤均需逐项完成后才推进到下一步。

## 阶段 A｜账号注册与主体认证（微信公众平台）

- [ ] 到 https://mp.weixin.qq.com/ 用「邮箱 + 手机号」注册小程序账号，主体选**个人**（与 ADR-0006 一致）。
- [ ] 完成实名认证：个人主体用身份证 + 管理员微信扫码验证。
- [ ] 登录后把 **AppID** 记下（形如 `wx1234567890abcdef`），后续用到。

## 阶段 B｜开发者工具接入项目

- [ ] 安装**正式版**微信开发者工具，用管理员微信扫码登录。
- [ ] 「导入项目」，目录选本仓库根目录 `yipao`。
- [ ] 把 `project.config.json` 的 `appid` 从 `"touristappid"` 改成真实 AppID。
- [ ] 确认 `miniprogramRoot` = `miniprogram/`、`cloudfunctionRoot` = `cloudfunctions/` 已正确（当前已是）。

## 阶段 C｜开通云开发并初始化数据库

- [ ] 在工具「云开发」或公众台「开发 → 云开发」开通环境，记下**环境 ID**。
- [ ] 把环境 ID 填入 `miniprogram/config.js` 的 `envId`（单环境可留空）。
- [ ] 在云开发控制台**创建 4 个集合**：`runners`、`runSpots`、`spotRequests`、`posts`。
  - 权限统一设为「**仅创建者可读写**」（所有读写走云函数，客户端不直连，见 docs/database.md）。
- [ ] 对 `cloudfunctions/` 下每个函数目录（login/runner/spots/post/postAction）右键 →「创建并部署：云端安装依赖」。

## 阶段 D｜隐私与类目（先不接 GPS，故不声明定位）

> 既然 v0.1 不接 GPS，就不要在隐私声明里申报位置，否则提审会被要求能力/资质证明。

- [ ] **移除定位相关代码声明**（可选但推荐，避免提审追问）：
  - `miniprogram/app.json`：删除 `requiredPrivateInfos: ["getLocation"]` 和 `permission.scope.userLocation` 整段。
  - `pages/index/index.js` 的「找离我近的」按钮可保留 UI，但 `wx.getLocation` 调用无权限时会自动走 `fail → 跑点模式`（已实现）；若想更稳妥可把入口按钮也隐藏。
- [ ] 公众台「设置 → 服务内容声明 → 用户隐私保护指引」勾选并按实际用途声明：
  - 采集的信息：**头像、昵称**（chooseAvatar / 资料填写）、**文字内容**（帖子/评论）、**跑点坐标**（runSpots 种子数据）。
  - 不透**不存在的** `getLocation` 用途。
- [ ] 确认服务类目：约伴方向选个人主体可过、方向好描述的类目；若平台没有合适的，按 ADR-0006 准备备选方案（限制功能或考虑升级主体）。

## 阶段 E｜订阅消息接入（可后置，先保证能约跑）

- [ ] 「功能 → 订阅消息」申请两个模板：「加入/退出提醒」「帖子更新/取消提醒」，拿到**模板 ID**。
- [ ] 填入 `miniprogram/config.js` 的 `subscribeTemplates`（`joinChange` / `postChange`）。
- [ ] 在 `cloudfunctions/post/index.js` 与 `cloudfunctions/postAction/index.js` 的 `notify()` 里补真实发送：`cloud.openapi.subscribeMessage.send`（当前只打日志）。
  - **可先上线不接**：不填模板 ID 时 `requestSubscribe` 直接跳过（`utils/subscribe.js`），约跑闭环不受影响。

## 阶段 F｜本地与体验版验证

- [ ] 编译运行，完整走一遍主流程：
  1. 首次进入自动建档（login）→ 首次发现页自动种入杭州示例跑点。
  2. 发帖被拦（资料不完整）→ 完善昵称 + 至少 1 常跑点后可发布。
  3. 发布/加入/退出/发起人取消/发起人确认到场各路径。
  4. 重点核对：**资料门槛**、**2 小时爽约**（不足 2h 退出记 `absenceCount`）、**发起人取消无过错**。
- [ ] 先做一轮真实手工核对：`docs/database.md` 里 `runSpots` 的 6 个示例跑点**名称/地址/坐标**是否符合杭州实际情况，不对就在云开发控制台改或删除种子后重建。

## 阶段 G｜提审与发布

- [ ] 公众台「成员管理」加 2–5 位体验者 → 工具里「上传」→ 平台生成**体验版**，让真人跑 2–3 天（重点看云函数权限、并发加入是否报错）。
- [ ] 「版本管理」填版本号与描述，填充分发的**功能页面**、**服务类目**、**隐私信息**，提交审核。
- [ ] 提审被拒：读不通过原因（多为类目或隐私声明），按 ADR-0006 调整后重提；不要为 GPS 死磕。
- [ ] 审核通过 → 点击「发布」正式上线。

## 上线后第一件事

- `spotRequests`（新跑点申请）目前无管理后台，需去云开发控制台手工审核。若真实约跑量上来，这是第一个要补的工具（见 backlog.md）。