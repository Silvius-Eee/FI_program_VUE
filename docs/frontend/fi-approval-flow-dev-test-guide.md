# FI 审批流开发测试说明文档

## 1. 文档目的

本文面向开发、测试和联调同学，作为当前 FI 审批流的统一阅读入口，覆盖 `KYC`、`法务`、`资金`、`上线` 四段流程。

本文只说明当前前端原型与状态工具中的实现口径，帮助开发和测试快速判断：

- 每段流程由谁提交、谁审批、谁退回。
- 页面入口、核心状态字段和关键函数在哪里。
- 哪些状态会阻塞或放行后续审批。
- 测试时应覆盖哪些主流程、异常流和联动场景。

本文不替代各单项详细文档。涉及字段模型、接口建议或单项页面细节时，仍应结合本文末尾的关联文档阅读。

## 2. 总体链路

当前上线审批链路以 `Go-live Management` 为总览入口，核心顺序如下：

```text
KYC + Legal/Pricing 并行推进
        ↓
Fund Review 提交与审批
        ↓
FI Supervisor Review 最终上线审批
        ↓
Live
```

关键规则：

- `KYC` 与 `Legal/Pricing` 可以并行推进。
- `Fund Review` 只能在两条 KYC track 终态、必需法务项完成后提交。
- `FI Supervisor Review` 只能在 Fund 审批通过后进入。
- FI Supervisor 最终通过后，corridor `status` 变为 `Live`。
- FI Supervisor 退回后，当前代码会把 `fundApproval.status` 重新打开为 `not_started`，清空 active Fund submit 信息，并在 `fundApproval.history` 写入 `type = reopened`。FI 侧需要重新提交 Fund Review。

## 3. 角色与入口

| 角色 | 主要职责 | 关键页面 |
| --- | --- | --- |
| `FIOP` / `FIBD` | 维护 corridor 材料，提交 KYC、法务、资金，处理退回后补件和重提。 | `ChannelDetail.vue`、`KycHubPage.vue`、`LegalFiDetailPage.vue`、`FundSubmitPage.vue` |
| `Compliance` | 审批 KYC track，退回补件，标记 completed 或 no need。 | `KycReviewWorkspace.vue`、`KycReviewDetailPage.vue` |
| `Legal` | 审核 NDA、MSA、Other Attachments 和已进入 Legal 阶段的 Pricing Schedule。 | `LegalApprovalWorkspace.vue`、`LegalFiDetailPage.vue` |
| `FI Supervisor` | 审批 Pricing Schedule 的 FI supervisor 阶段，并执行最终上线审批。 | `PricingApprovalWorkspace.vue`、`PricingApprovalDetailPage.vue`、`LaunchApprovalWorkspace.vue` |
| `Fund` | 审批资金提交，approve 或 request changes。 | `FundWorkspace.vue`、`FundDetailPage.vue` |

总览入口：

- `WorkflowBoard.vue`：corridor detail 中的 `Go-live Management`，展示 KYC、Legal、Fund Review、FI Supervisor Review 四个节点。
- `ChannelDashboard.vue`：根据角色展示审批队列入口，例如 Launch Queue。
- `src/stores/app.ts`：控制页面跳转、只读上下文和部分角色守卫。

## 4. KYC 审批流

### 4.1 流程对象

一个 corridor 下固定有两条独立 KYC track：

| Track | 前端标题 | 存储字段 |
| --- | --- | --- |
| `wooshpay` | `WooshPay onboarding` | `wooshpayOnboarding` |
| `corridor` | `Corridor onboarding` | `corridorOnboarding` |

两条 track 独立流转、独立时间线、独立撤回。任一 track 的提交、退回或终态不应覆盖另一条 track。

### 4.2 状态与展示

当前状态 key 和展示文案来自 `src/constants/onboarding.ts`：

| 状态 key | 展示文案 | 含义 |
| --- | --- | --- |
| `not_started` | `Not Started` | 尚未进入该 track 的 KYC 流程。 |
| `wooshpay_preparation` | `WooshPay preparation` | FI 已提交 WooshPay track，等待 Compliance 审核。 |
| `corridor_reviewing` | `Corridor reviewing` | WooshPay track 被退回，等待 FI 跟进 corridor 反馈或补件。 |
| `wooshpay_reviewing` | `WooshPay reviewing` | FI 已提交 Corridor track，等待 Compliance 审核。 |
| `corridor_preparation` | `Corridor preparation` | Corridor track 被退回，等待 FI 补件。 |
| `completed` | `Completed` | Compliance 审批通过。 |
| `no_need` | `No Need` | Compliance 判定该 track 无需处理。 |

队列 tab 由 `getOnboardingQueueTab(status)` 计算：

- `reviewing`：等待 Compliance 审核。
- `preparation`：等待 FI 补件或跟进。
- `completed`：已完成。
- `no_need`：无需处理。

### 4.3 动作规则

| 动作 | 操作方 | 结果 |
| --- | --- | --- |
| FI 提交或补件 | `FIOP/FIBD` | 进入对应 track 的 submitted status，并创建 pending handoff 给 Compliance。 |
| Compliance 通过 | `Compliance` | 状态变为 `completed`，写入终态 decision，可撤回。 |
| Compliance 退回 | `Compliance` | 状态变为该 track 的 handoff status，创建 pending handoff 给 FIOP。 |
| Compliance 标记 no need | `Compliance` | 状态变为 `no_need`，写入终态 decision，可撤回。 |
| FI 撤回未处理提交 | 原提交方 | 回滚到提交前状态，原事件保留并标记 revoked。 |
| Compliance 撤回最新终态 | 原 reviewer | 回滚到终态前状态，终态事件保留并标记 revoked。 |

测试重点：

- 两条 track 状态互不影响。
- 时间线展示已撤回事件和当前有效状态。
- `completed` 与 `no_need` 都可放行 Fund/Launch 的 KYC 门禁。
- 非授权角色不能执行提交或审核动作。

## 5. 法务审批流

### 5.1 子项范围

法务卡片覆盖四个子项：

| 子项 | 提交方 | 审核方 | 是否支持 No Need |
| --- | --- | --- | --- |
| `NDA` | `FIOP/FIBD/FI Supervisor` | `Legal` | 支持 |
| `MSA` | `FIOP/FIBD/FI Supervisor` | `Legal` | 不支持 |
| `Pricing Schedule` | `FIOP/FIBD -> FI Supervisor -> Legal` | `FI Supervisor / Legal` | 不支持 |
| `Other Attachments` | `FIOP/FIBD/FI Supervisor` | `Legal` | 不支持，且不阻塞 Fund/Launch |

法务状态工具主要在 `src/utils/workflowStatus.ts` 和 `src/constants/initialData.ts` 中使用。

### 5.2 NDA / MSA / Other Attachments

| 状态 | 含义 |
| --- | --- |
| `Not Started` | 尚未提交材料。 |
| `Under our review` | FI 已提交，等待 Legal 审核。 |
| `Under Corridor review` | Legal 退回或需要 FI 跟进渠道反馈。 |
| `Pending Corridor signature` | 等待 FI 跟进渠道签署进度。 |
| `Completed` | 法务事项完成。 |
| `No Need` | 无需处理，仅 `NDA` 合法。 |

提交校验重点：

- `Send to Legal` / `Resend to Legal` 需要授权角色。
- 至少选择一个 contracting entity。
- `remarks` 必填。
- 附件可选，但上传中或上传失败不允许提交。
- `Completed` / `No Need` 后不能由 FI 直接重新提交，需先撤回终态或走重开流程。

### 5.3 Pricing Schedule

`Pricing Schedule` 在法务卡片中展示，但审批链路不同于普通法务文档：

```text
FI 提交 pricing
    ↓
FI Supervisor review
    ↓
Legal review
    ↓
Completed
```

核心状态：

| 状态 | 含义 |
| --- | --- |
| `Not Started` | 尚未提交 pricing。 |
| `Under FI supervisor review` | 等待 FI Supervisor 审批。 |
| `Under legal review` | FI Supervisor 已通过，等待 Legal 审核。 |
| `Under Corridor review` | FI Supervisor 或 Legal 退回，等待 FI 修改或跟进渠道反馈。 |
| `Completed` | Legal 完成 pricing 法务审核。 |

测试重点：

- Pricing 未通过 `FI Supervisor` 时，不能直接进入 Legal 完成状态。
- Legal 退回后的 Pricing 再提交，应回到 Legal review 口径。
- 法务聚合状态必须随四个子项实时变化。

### 5.4 Go-live 门禁口径

Fund 和 Launch 门禁只要求必需法务项 ready：

- `NDA`：`Completed` 或 `No Need`。
- `MSA`：`Completed`。
- `Pricing Schedule`：`Completed`。
- `Other Attachments`：可选，仅展示状态，不阻塞 Fund Review 或 Launch 最终审批。

## 6. 资金审批流

### 6.1 状态字段

资金审批核心字段为 `fundApproval.status`，类型定义在 `src/constants/initialData.ts`：

| 状态 | 展示/业务含义 |
| --- | --- |
| `not_started` | 尚无 active Fund 提交。 |
| `pending` | 已提交并等待 Fund 审批，或处于可再次提交的待处理状态。 |
| `changes_requested` | Fund 已退回，需要 FI 修正后重提。 |
| `approved` | Fund 已审批通过。 |

重要口径：

- `pending` 必须结合 `fundApproval.submittedAt`、`submittedBy` 或 active `submit` history 判断是否存在 active Fund task。
- `normalizeFundApproval()` 会把没有 active submit 痕迹的 `pending` 规范为 `not_started`。
- Fund 队列由 `buildFundQueueRows()` 构建，只展示已提交且 `buildFundPrerequisiteSnapshot(channel).ready = true` 的记录。

### 6.2 前置门禁

Fund Review 提交前置由 `buildFundPrerequisiteSnapshot(channel)` 计算：

| 门禁项 | 放行口径 |
| --- | --- |
| WooshPay onboarding KYC | `completed` 或 `no_need`。 |
| Corridor onboarding KYC | `completed` 或 `no_need`。 |
| NDA | `Completed` 或 `No Need`。 |
| MSA | `Completed`。 |
| Pricing Schedule | `Completed`。 |
| Other Attachments | 可选，不阻塞。 |

### 6.3 动作与联动

| 动作 | 函数 | 结果 |
| --- | --- | --- |
| Submit / Resubmit to Fund | `applyFundReviewSubmission()` | 写入 active submit 字段，`status = pending`，新增 `submit` history，并联动 `launchApproval.status = under_fund_review`。 |
| Revoke submission | `applyFundReviewRevocation()` | 清空 active submit 字段，回滚到提交前状态，新增 `revoke` history，并联动 Launch 回到 `not_submitted` 或 `supervisor_returned`。 |
| Fund approve | `applyFundApprovalDecision(..., 'approve')` | `status = approved`，新增 `approve` history，并联动 Launch 进入 `under_fi_supervisor_review`。 |
| Fund request changes | `applyFundApprovalDecision(..., 'request_changes')` | `status = changes_requested`，写入退回原因，新增 `request_changes` history，Launch 回到未提交口径。 |
| 源数据变更 reopen | `applyFundSourceChannelUpdate()` | 已 approved 或 changes_requested 的资金审批被重新打开为 `not_started`，清空 active submit，新增 `reopened` history。 |

测试重点：

- 重复点击 Submit 不应产生多条 active submit。
- Revoke 后 Fund workspace 不应继续展示为可审批 pending 任务。
- Approve 后 Launch 的 Fund gate 通过。
- Request changes 后 FI 可以修改源数据并重提。
- 源数据变更后不能沿用旧的 approved 或 request changes 作为最终结论。

## 7. 上线审批流

### 7.1 状态字段

上线审批核心字段为 `launchApproval.status`：

| 状态 | 含义 |
| --- | --- |
| `not_submitted` | 尚未进入上线审批，或 Fund/源数据变更后需要重新提交。 |
| `under_fund_review` | FI 已提交 Fund Review，等待 Fund 审批。 |
| `under_fi_supervisor_review` | Fund 已通过，等待 FI Supervisor 最终审批。 |
| `supervisor_returned` | FI Supervisor 已退回，FI 需修正并重新提交 Fund Review。 |
| `live` | FI Supervisor 已通过，corridor 已上线。 |

说明：类型中存在 `fund_returned` 兼容值，但当前主流程中 Fund request changes 会把 Launch 退回到未提交口径，不进入 Launch Queue。

### 7.2 Launch Queue

Launch Queue 由 `buildLaunchApprovalQueueRows()` 构建，仅展示以下三类：

| Queue tab | 状态 |
| --- | --- |
| `pending` | `under_fi_supervisor_review` |
| `returned` | `supervisor_returned` |
| `live` | `live` |

`under_fund_review`、`not_submitted` 不进入 FI Supervisor 的 Launch Queue。

### 7.3 最终审批门禁

Launch 最终审批前置由 `buildLaunchPrerequisiteSnapshot(channel)` 计算：

- Fund approval 必须为 `approved`。
- KYC 与必需法务项仍然 ready。
- `missingItems` 为空时才允许最终审批。

`isLaunchApprovalBlocked(channel)` 只在 `under_fund_review` 或 `under_fi_supervisor_review` 状态下检查门禁。如果提交后 KYC、法务或 Fund 状态变化导致门禁不满足，审批入口应显示 blocked，并禁用审批动作。

### 7.4 页面动作

| 动作 | 页面入口 | 结果 |
| --- | --- | --- |
| Details | `LaunchApprovalWorkspace.vue` | 进入 corridor detail 的只读上线审批上下文，不触发审批动作。 |
| Approval | `LaunchApprovalWorkspace.vue` | 仅 `pending` 且未 blocked 时打开 `Launch approval detail` 抽屉。 |
| Approve & Go Live | 审批抽屉 | 执行 `applyLaunchSupervisorDecision(..., 'approve')`，`launchApproval.status = live`，corridor `status = Live`。 |
| Return to FIOP | 审批抽屉 | 执行 `applyLaunchSupervisorDecision(..., 'request_changes')`，`launchApproval.status = supervisor_returned`，并把 Fund 重新打开为 `not_started`、写入 `reopened` history。 |

测试重点：

- 非 `FI_SUPERVISOR` 不应看到或进入 Launch Queue。
- `Approval` 只在 pending 且未 blocked 时可用。
- Approve 允许 reviewer note 为空，系统使用默认通过备注。
- Return 必须填写退回原因。
- Return 后 FI 需要重新提交 Fund Review，Fund 再次通过后才能重新进入 Launch Queue pending。

## 8. 端到端验收场景

建议测试按以下主线组织：

1. 新 corridor：两条 KYC track 均为 `Not Started`，法务子项未开始，Fund 与 Launch 均未提交。
2. KYC 并行：只提交一条 track 时，另一条 track 不受影响；两条 track 都进入 `completed` 或 `no_need` 后，KYC gate 才通过。
3. 法务并行：NDA `No Need` 可放行，MSA 与 Pricing Schedule 必须 `Completed`，Other Attachments 未完成不阻塞。
4. Fund 提交：KYC 和必需法务项未 ready 时 Submit 禁用并展示缺失项；ready 后提交进入 Fund Pending。
5. Fund 退回重提：Fund request changes 后 FI 修改源数据并重提，Fund workspace 重新出现 pending 任务。
6. Fund 通过：Fund approve 后 Launch 进入 `under_fi_supervisor_review`，Launch Queue pending 出现记录。
7. Launch blocked：进入最终审批后，如果 KYC、法务或 Fund 门禁变化，审批动作禁用并展示 missing items。
8. Launch 通过：FI Supervisor Approve 后 Launch 进入 `live`，corridor `status = Live`。
9. Launch 退回：FI Supervisor Return 后 Launch 进入 `supervisor_returned`，Fund 重新打开为 `not_started` 并新增 `reopened` history；FI 重提 Fund 并通过后重新进入 Launch pending。
10. 撤回与审计：KYC、Legal、Fund 的撤回都不能物理删除历史，只能标记生命周期或新增撤回事件。

## 9. 开发测试对照表

| 模块 | 核心状态字段 | 关键函数/工具 | 重点文件 |
| --- | --- | --- | --- |
| KYC | `wooshpayOnboarding.status`、`corridorOnboarding.status` | `getChannelOnboardingWorkflow()`、`applyOnboardingSubmission()`、`applyOnboardingStatusUpdate()`、`getOnboardingQueueTab()` | `src/constants/onboarding.ts`、`KycHubPage.vue`、`KycReviewWorkspace.vue`、`KycReviewDetailPage.vue` |
| 法务 | `ndaStatus`、`contractStatus`、`otherAttachmentsStatus`、`pricingProposals[].legalStatus` | `normalizeNdaStatusLabel()`、`normalizeMsaStatusLabel()`、`getPricingLegalAggregateStatus()` | `src/utils/workflowStatus.ts`、`LegalApprovalWorkspace.vue`、`LegalFiDetailPage.vue` |
| 资金 | `fundApproval.status`、`submittedAt`、`submittedBy`、`history[]` | `buildFundPrerequisiteSnapshot()`、`buildFundQueueRows()`、`applyFundReviewSubmission()`、`applyFundApprovalDecision()` | `src/utils/fund.ts`、`src/constants/initialData.ts`、`FundSubmitPage.vue`、`FundWorkspace.vue`、`FundDetailPage.vue` |
| 上线 | `launchApproval.status`、`history[]` | `buildLaunchPrerequisiteSnapshot()`、`isLaunchApprovalBlocked()`、`buildLaunchApprovalQueueRows()`、`applyLaunchSupervisorDecision()` | `src/constants/initialData.ts`、`WorkflowBoard.vue`、`LaunchApprovalWorkspace.vue` |

开发自查：

- 状态枚举、展示文案和队列 tab 使用统一工具函数，不在页面中重复写一套判断。
- 任何审批动作都必须写入 history/timeline。
- 只隐藏按钮不够，入口和动作函数也要校验角色与可操作状态。
- `Other Attachments` 只展示，不作为 Fund/Launch 必填门禁。
- Supervisor 退回后的 Fund 状态以当前代码 `not_started + reopened history` 为准。

测试自查：

- 主流程、退回重提、撤回、终态撤回、源数据 reopen 都要覆盖。
- 同一 corridor 的两条 KYC track 要做互不影响验证。
- Fund `pending` 要同时验证有 active submit 和无 active submit 两种口径。
- Launch Queue 只统计 `under_fi_supervisor_review` 为 pending，不统计 returned/live 到 pending 数量。
- Details 入口必须保持只读，不应触发审批动作。

## 10. 关联文档

- [FI 视图下 KYC / 合规审批流联动](../backend/fi-kyc-compliance-workflow.md)
- [法务卡片状态提交流转需求文档](../backend/fi-legal-card-workflow.md)
- [资金提交与审批说明](./fi-fund-submission-approval-guide.md)
- [上线审批流说明文档](./fi-launch-approval-flow.md)
- [FI 前端权限补充说明](./fi-frontend-handoff-supplement.md)
