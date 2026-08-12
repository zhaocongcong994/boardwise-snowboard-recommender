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

`lib/recommendation.ts` 中的数据用于功能演示，价格不代表实时成交价。正式上线前应通过品牌官网及获得授权的店铺来源建立采集适配器，并经过人工审核后发布。

## 验证

```bash
npm test
```
