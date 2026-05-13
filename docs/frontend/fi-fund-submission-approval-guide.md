# 资金提交与审批说明

## 1. 文档目的

本文面向技术和测试，说明当前项目中的 Fund 提交与审批流程。范围只覆盖 `FIOP/FIBD -> Fund` 这一段：FI 侧提交资金审核，Fund 侧审批通过或退回修改。

KYC、Legal、Pricing 在本文中只作为资金提交前置条件出现；完整 Launch approval 流程不在本文展开。唯一需要关注的 Launch 联动是：Fund 审批通过后，Launch 前置门禁中的 Fund gate 才算通过。

## 2. 流程边界

资金提交审批的主流程如下：

1. `FIOP/FIBD` 在 assigned corridor 中维护资金相关源数据。
2. 系统在 Fund 提交页展示镜像只读数据，供 FI 提交前确认。
3. 当前置条件满足后，`FIOP/FIBD` 提交 Fund review。
4. Fund 用户在 Fund workspace 中看到待审批任务。
5. Fund 用户进入 Fund detail 审批，可以 approve 或 request changes。
6. Fund 退回后，`FIOP/FIBD` 修正镜像源数据并重新提交。
7. Fund 审批通过后，资金审批结束，Launch 的 Fund gate 通过。

不在本文范围内的内容：

- KYC、Legal、Pricing 自身的提交和审批细节。
- FI Supervisor 的 Launch approval 审批动作。
- 后端接口新设计或数据库表设计。

## 3. 角色与权限

| 角色 | 可做事项 | 限制 |
| --- | --- | --- |
| `FIOP` / `FIBD` | 打开资金提交页、提交 Fund review、撤回 pending 提交、在退回后重提 | 只能操作 assignment 命中的 corridor |
| `Fund` | 进入 Fund workspace/detail，查看 FI 提交的资金材料，执行 approve 或 request changes | 只能审批已提交且前置条件仍满足的 pending 任务 |
| `FI_SUPERVISOR` | 可从 FI 侧打开相关流程入口并查看状态 | 本文不把 FI Supervisor 的 Launch 审批作为主流程 |

前端入口口径：

- `ChannelDetail.vue` 和 `WorkflowBoard.vue` 展示 FI 侧入口与状态。
- `FundSubmitPage.vue` 是 FI 侧资金提交页。
- `FundWorkspace.vue` 是 Fund 审批队列。
- `FundDetailPage.vue` 是 Fund 审批详情页。

## 4. 状态模型

当前资金审批状态由 `fundApproval.status` 表示，允许值为：

| 状态 | 展示含义 | 可进入的下一步 |
| --- | --- | --- |
| `pending` | 默认状态，或已提交后等待 Fund 审批 | Fund approve、Fund request changes、FI 撤回 active submission |
| `changes_requested` | Fund 已退回，需要 FI 修正后重提 | FI 修正数据并 resubmit to Fund |
| `approved` | Fund 已审批通过 | 资金审批结束，Launch Fund gate 通过 |

注意事项：

- `pending` 既是默认状态，也是“已提交待审”的状态。是否已经提交，需要结合 `fundApproval.submittedAt`、`fundApproval.submittedBy` 或 `fundApproval.history` 判断。
- `changes_requested` 后允许 `FIOP/FIBD` 重提。
- `approved` 后不允许 FI 再提交 Fund review。

## 5. 提交前置条件

FI 侧提交 Fund review 前，必须满足：

- WooshPay onboarding KYC 已进入终态：Completed 或 No Need。
- Corridor onboarding KYC 已进入终态：Completed 或 No Need。
- NDA 已完成或 No Need。
- MSA 已完成。
- Pricing Schedule 已完成。
- Other Attachments 为可选项，不阻塞资金提交。

前端通过 `buildFundPrerequisiteSnapshot(channel)` 计算前置条件：

- `ready = true` 时允许提交。
- `missingItems` 用于展示阻塞原因。
- Legal prerequisites 中 `otherAttachments` 只展示状态，不参与必填判断。

## 6. FI 侧提交与撤回

### 6.1 首次提交

当 assigned `FIOP/FIBD` 点击 Submit to Fund 时，系统执行资金提交：

- 写入 `fundApproval.status = pending`。
- 写入 `fundApproval.submittedAt`、`fundApproval.submittedBy`、`fundApproval.submitNote`。
- 更新 `fundApproval.lastActionAt`、`fundApproval.lastActionBy`。
- 在 `fundApproval.history` 头部新增 `type = submit` 的记录。
- 在 corridor `auditLogs` 中记录提交动作。

提交成功后：

- Fund workspace 的 Pending tab 中出现该 corridor。
- FI 侧状态展示为 Pending。
- pending 且已有 active submission 时，不允许重复提交。

### 6.2 撤回提交

FI 侧只在以下条件同时满足时允许撤回：

- 当前用户是 assigned `FIOP/FIBD`。
- `fundApproval.status = pending`。
- 当前 corridor 已存在提交痕迹：`submittedAt` 或 `submittedBy` 不为空。

撤回后：

- 清空 `fundApproval.submittedAt`、`fundApproval.submittedBy`、`fundApproval.submitNote`。
- 最新 active submit history 会被标记为 revoked。
- 在 `fundApproval.history` 头部新增 `type = revoke` 的记录。
- 资金状态仍为 `pending`，但不再代表 active Fund 待审任务。
- Fund workspace 不应再把这条记录作为可审批 pending 任务处理。

## 7. Fund 侧审批

### 7.1 Fund workspace

Fund workspace 展示已提交且前置条件满足的 corridor。队列按状态分为：

- Pending
- Changes Requested
- Approved

列表字段来自当前 corridor 的资金镜像数据：

- Corridor
- Product
- Acquisition Method
- Settlement Account Details
- Dispute Handling Channel
- Handling Notes & References
- Status
- Updated

### 7.2 Fund approve

Fund 用户在 Fund detail 中点击 Approve 时，系统执行：

- 校验当前任务仍可审：已提交、前置条件仍满足、状态为 `pending`。
- 写入 `fundApproval.status = approved`。
- 写入 `fundApproval.note`、`lastActionAt`、`lastActionBy`。
- 在 `fundApproval.history` 头部新增 `type = approve` 的记录。
- corridor audit log 记录 approved fund go-live confirmation。

审批通过后：

- FI 侧不可再提交 Fund review。
- Launch prerequisite 中 Fund gate 变为通过。
- Launch approval 可继续进入后续 FI Supervisor 审批流程。

### 7.3 Fund request changes

Fund 用户退回时必须填写退回原因。系统执行：

- 校验当前任务仍可审：已提交、前置条件仍满足、状态为 `pending`。
- 写入 `fundApproval.status = changes_requested`。
- 写入退回原因到 `fundApproval.note`。
- 更新 `lastActionAt`、`lastActionBy`。
- 在 `fundApproval.history` 头部新增 `type = request_changes` 的记录。
- corridor audit log 记录 requested changes。

退回后：

- FI 侧展示 Changes Requested。
- `FIOP/FIBD` 可修正资金相关镜像源数据。
- 修正后允许 Resubmit to Fund，状态回到 `pending` 并新增 submit history。

## 8. 源数据变更与 Reopen

资金审批依赖的是 corridor 和 pricing 中的镜像源数据。相关源数据在审批后发生变化时，系统会重新打开资金审核。

当前实现中，以下更新路径会调用资金源数据更新逻辑：

- Dispute SOP 更新。
- Reconciliation 和 Backend Account 更新。
- Fund scoped pricing/payment method snapshot 更新。

当源数据变化时：

- 如果当前状态是 `approved`，状态回到 `pending`，说明审批后的资金依据已变化，需要重新确认。
- 如果当前状态是 `changes_requested`，状态回到 `pending`，说明 FI 已更新源数据，需要重新进入 Fund review。
- 系统清空 active submission 字段：`submittedAt`、`submittedBy`、`submitNote`。
- 在 `fundApproval.history` 头部新增 `type = reopened` 的记录。
- `fundApproval.note` 会写入 reopen 原因。

测试时应重点确认：reopen 后不能把旧的 approved 或 request changes 当作最终结论继续使用。

## 9. 资金镜像数据来源

Fund 提交页和审批详情页展示的数据是当前 corridor/pricing 的镜像只读信息，不是 Fund 独立维护的数据。

| 数据区块 | 来源 | 说明 |
| --- | --- | --- |
| Backend Account | corridor 的 `backendAccounts` | 包含环境、商户名、地址、账号、密码、备注 |
| Dispute SOP | corridor 的 `chargebackHandling`、`chargebackRemarks` | 展示争议处理渠道和处理备注 |
| Reconciliation | corridor 的 `reconMethods`、`reconMethodDetail`、`corridorPayoutAccount` | 展示对账获取方式、说明、结算账户信息 |
| Settlement account attachments | corridor 的 `corridorPayoutAccountAttachments` | Fund detail 中可查看附件 |
| Pricing Schedule | corridor 的 `pricingProposals` | 展示 proposal 和 payment methods |
| Payment method fund fields | pricing proposal 的 `paymentMethods[].settlement` 和 `capabilityFlags` | 展示币种、周期、阈值、FX、退款能力等 |

Fund 在审批详情中查看 pricing/payment method 时应为只读，不应修改源数据。

## 10. 页面行为对照

| 页面 | 主要职责 | 关键行为 |
| --- | --- | --- |
| `FundSubmitPage.vue` | FI 侧提交页 | 展示前置门禁、资金镜像数据、提交备注、Submit/Resubmit、Revoke |
| `FundWorkspace.vue` | Fund 队列 | 按 pending/changes requested/approved 过滤任务，支持 corridor 和 product 过滤 |
| `FundDetailPage.vue` | Fund 审批详情 | 展示资金镜像数据、审批历史、Approve、Request changes |
| `WorkflowBoard.vue` | FI 侧流程卡片 | 展示 Fund Review 状态和最近历史 |
| `ChannelDetail.vue` | Corridor 详情入口 | 入口校验、Fund review modal、提交动作、资金源数据更新后的 reopen |
| `LaunchApprovalWorkspace.vue` | Launch 审批工作台 | 展示 Fund approval gate，Fund approved 后才允许后续 Launch 审批 |

## 11. 测试用例

### 11.1 权限

1. assigned `FIOP/FIBD` 能从 corridor detail 打开 Fund submit 页面。
2. assigned `FIOP/FIBD` 在前置条件满足时能提交 Fund review。
3. 未 assigned 的 `FIOP/FIBD` 不能进入或操作该 corridor 的 Fund submit。
4. Fund 用户能进入 Fund workspace，并打开已提交的审批详情。
5. 非 Fund 用户不应通过 Fund workspace 执行 Fund 审批动作。

### 11.2 前置条件

1. KYC 任一 track 未终态时，Submit to Fund 禁用并展示缺失项。
2. NDA 未 completed/no need 时，Submit to Fund 禁用并展示缺失项。
3. MSA 未 completed 时，Submit to Fund 禁用并展示缺失项。
4. Pricing Schedule 未 completed 时，Submit to Fund 禁用并展示缺失项。
5. Other Attachments 未完成时，不阻塞 Submit to Fund。

### 11.3 首次提交

1. 前置条件满足时，FI 提交成功。
2. `fundApproval.status` 为 `pending`。
3. `submittedAt`、`submittedBy`、`submitNote` 正确写入。
4. `history[0].type` 为 `submit`。
5. Fund workspace Pending tab 出现该 corridor。

### 11.4 重复提交拦截

1. 已提交且状态仍为 `pending` 时，FI 侧不允许再次提交。
2. 页面展示“Fund review has already been submitted.”或等价提示。
3. history 不应因为重复点击产生多条 submit。

### 11.5 撤回

1. pending 且已提交时，FI 侧显示 Revoke submission。
2. 撤回后 active submit history 标记为 revoked。
3. `submittedAt`、`submittedBy`、`submitNote` 被清空。
4. `history[0].type` 为 `revoke`。
5. Fund 不应继续审批被撤回的提交。

### 11.6 Fund 退回

1. Fund request changes 未填写原因时不能提交。
2. 填写原因后退回成功。
3. `fundApproval.status` 变为 `changes_requested`。
4. `fundApproval.note` 写入退回原因。
5. `history[0].type` 为 `request_changes`。
6. FI 侧展示 Changes Requested，并允许 Resubmit to Fund。

### 11.7 退回后重提

1. `changes_requested` 后 FI 修改源数据或补充说明。
2. FI 点击 Resubmit to Fund 成功。
3. `fundApproval.status` 回到 `pending`。
4. `history[0].type` 为 `submit`。
5. Fund workspace Pending tab 再次出现该 corridor。

### 11.8 Fund 审批通过

1. Fund approve 后 `fundApproval.status` 变为 `approved`。
2. `history[0].type` 为 `approve`。
3. FI 侧 Submit/Resubmit 禁用。
4. WorkflowBoard 展示 Approved。
5. LaunchApprovalWorkspace 中 Fund Approval gate 显示 Approved。

### 11.9 源数据变更 Reopen

1. `approved` 后修改资金镜像源数据，状态回到 `pending`。
2. `changes_requested` 后修改资金镜像源数据，状态回到 `pending`。
3. `history[0].type` 为 `reopened`。
4. reopen 后不能继续沿用旧的 approved/request changes 作为最终结论。
5. FI 需要重新提交后，Fund 才能重新审批。

### 11.10 只读查看

1. Fund detail 中 Backend Account、Dispute SOP、Reconciliation 为只读展示。
2. Fund detail 中 pricing/payment method 详情为只读查看。
3. Fund scoped pricing 页面返回时仍回到 Fund detail 或 Fund submit 对应入口。
4. Fund 审批动作只更新 `fundApproval` 和 audit log，不应直接改写 pricing/corridor 源字段。

## 12. 技术验收点

- `fundApproval` 的状态、提交字段、审批字段和 history 始终一致。
- `pending` 状态必须结合提交痕迹判断是否存在 active Fund task。
- Fund 队列只展示已提交且前置条件满足的 corridor。
- 撤回、退回、重提、审批通过、源数据 reopen 都必须有 timeline/history 记录。
- Launch gate 只认 `fundApproval.status = approved`。
- 页面权限不能只靠按钮隐藏，入口和操作函数都需要校验当前角色与 corridor 访问权。
