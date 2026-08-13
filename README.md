# BOARDWISE 滑雪单板推荐

面向中国大陆新手至中级滑手的响应式选板 MVP。系统先使用确定性规则执行体重、板腰和预算筛选，再由可选的 Dify Workflow 生成自然语言解读。

## 已完成

- 四步选板问卷：身体条件、鞋码、技术能力、玩法和预算
- 支持脚长、雪鞋 Mondo、日常运动鞋 EU 码三种输入
- 日常鞋码仅用于估算；临界板宽会降低推荐置信度
- 三类推荐：稳妥首选、成长型选择、性价比选择
- 匿名反馈通过 D1 持久化
- Dify 未配置或超时时自动使用规则模板，不影响推荐结果
- 桌面端与移动端响应式展示
- D1 正式雪板目录、来源与价格快照
- 登录及白名单保护的数据审核后台
- 未审核数据与正式推荐目录严格隔离

## 本地运行

```bash
npm install
npm run dev
```

默认地址为 `http://localhost:3000`。

## Dify 接入

复制 `.env.example` 为 `.env.local`，填写 `DIFY_API_KEY`。Workflow 需要接收一个名为 `recommendation_context` 的字符串变量，并在输出中返回 `answer` 或 `result`。

推荐排序不会交给 Dify。Workflow 仅对已经过规则筛选的结果进行解释。

## 数据说明

迁移期仍保留 `lib/recommendation.ts` 中的演示目录，并在结果页明确标识。正式数据通过 D1 存储，所有规格和价格必须带来源，经 `/admin/catalog` 人工审核后才能发布。完整规则见 `docs/CATALOG.md`。

审核后台需要在运行环境设置 `ADMIN_EMAILS`。完成正式目录审核后，将 `CATALOG_MODE` 从 `demo` 切换为 `database`，即可禁止演示数据回退。

## 验证

```bash
npm test
```
