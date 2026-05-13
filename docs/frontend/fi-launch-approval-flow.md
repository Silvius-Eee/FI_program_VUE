# 上线审批流说明文档

## 1. 文档目的

本文档面向技术和测试，说明当前 FI 项目中的上线审批流页面、状态、数据口径和验收场景。

上线审批流以 `Go-live Management` 为总览入口，以 `Fund Review` 和 `FI Supervisor Review` 作为上线前最后两段控制。KYC、法务、报价单、资金卡片内部流程已有独立说明，本文只说明它们在上线审批中的门禁作用，不重复展开内部提交、审批、退回和撤回细节。

当前实现参考：

| 模块 | 文件 | 说明 |
| --- | --- | --- |
| Go-live Management 总览 | `src/components/WorkflowBoard.vue` | 展示 KYC、Legal、Fund Review、FI Supervisor Review 四个节点。 |
| FI Supervisor 上线审批队列 | `src/components/LaunchApprovalWorkspace.vue` | 展示 Launch Queue、只读详情入口、审批抽屉和最终审批操作。 |
| Dashboard 入口 | `src/components/ChannelDashboard.vue` | FI Supervisor 可看到 `Launch Queue (n)`。 |
| 状态、门禁和动作函数 | `src/constants/initialData.ts` | 定义 launch 状态、队列映射、门禁快照和审批动作。 |
| 页面权限与跳转 | `src/stores/app.ts` | 控制 `launchApprovalWorkspace` 权限守卫和只读详情入口。 |

## 2. 页面入口

### 2.1 Go-live Management

`WorkflowBoard.vue` 在 corridor detail 中展示 `Go-live Management`，包含四个节点：

| 节点 | 页面含义 |
| --- | --- |
| `KYC Verification` | 展示 WooshPay onboarding 和 Corridor onboarding 的状态摘要。 |
| `Legal` | 展示 NDA、MSA、Pricing Schedule、Other Attachments 的状态摘要。 |
| `Fund Review` | 展示资金审核状态，是进入最终上线审批前的直接前置。 |
| `FI Supervisor Review` | 展示最终上线审批状态。 |

KYC、Legal/Pricing 可以并行推进；Fund Review 和 FI Supervisor Review 在材料 ready 后顺序推进。Fund 审批通过后，Launch 才会进入 FI Supervisor 最终审批阶段。

### 2.2 Launch Queue

FI Supervisor 在 Dashboard 顶部可看到 `Launch Queue (n)` 按钮。`n` 只统计 `buildLaunchApprovalQueueRows(store.channelList)` 中 `queueTab === 'pending'` 的记录，也就是等待 FI Supervisor 最终审批的上线任务。

只有 `FI_SUPERVISOR` 可以进入 `launchApprovalWorkspace`。非 FI Supervisor 停留在该页面时，`src/stores/app.ts` 的页面守卫会清理当前选择并退回 `detail` 或 `dashboard`。

## 3. 状态模型

上线审批状态由 `launchApproval.status` 表示。

| 状态 | 展示含义 | 说明 |
| --- | --- | --- |
| `not_submitted` | Not submitted | 尚未进入上线审批。 |
| `under_fund_review` | Under Fund review | FI 侧已提交 Fund review，等待 Fund 审批。 |
| `fund_returned` | Returned by Fund | Fund 退回，FI 侧需要修正后重新提交 Fund review。 |
| `under_fi_supervisor_review` | Under FI Supervisor review | Fund 已审批通过，等待 FI Supervisor 最终上线审批。 |
| `supervisor_returned` | Returned by FI Supervisor | FI Supervisor 退回，FI 侧需要按退回原因修正并重新提交 Fund review。 |
| `live` | Live | FI Supervisor 已通过最终审批，corridor 状态变为 `Live`。 |

队列 tab 与状态映射如下：

| Tab | 包含状态 | 页面操作 |
| --- | --- | --- |
| `Pending` | `under_fi_supervisor_review` | 可查看详情；未 blocked 时可打开审批抽屉。 |
| `Returned` | `supervisor_returned` | 可查看只读详情和退回原因。 |
| `Live` | `live` | 可查看只读详情和最终审批记录。 |

`under_fund_review`、`fund_returned`、`not_submitted` 不进入 FI Supervisor 的 Launch Queue。

## 4. 前置门禁

上线审批使用两层门禁。

### 4.1 Fund Review 前置

Fund Review 提交前置由 `buildFundPrerequisiteSnapshot(channel)` 计算。它只关心上线材料是否 ready：

| 门禁项 | 放行口径 |
| --- | --- |
| WooshPay onboarding KYC | 已进入终态：Completed 或 No Need。 |
| Corridor onboarding KYC | 已进入终态：Completed 或 No Need。 |
| NDA | 已完成或 No Need。 |
| MSA | 已完成。 |
| Pricing Schedule | 已完成。 |
| Other Attachments | 可选，不阻塞 Fund Review。 |

### 4.2 Launch 最终审批前置

FI Supervisor 最终审批前置由 `buildLaunchPrerequisiteSnapshot(channel)` 计算，包含：

- Fund approval 必须为 `approved`。
- KYC、Legal/Pricing 前置仍然 ready。
- `missingItems` 为空时，Launch gate 才算通过。

当 `launchApproval.status` 为 `under_fund_review` 或 `under_fi_supervisor_review`，但当前前置条件不再满足时，`isLaunchApprovalBlocked(channel)` 返回 true。Launch Approval 抽屉会显示阻塞提示，并禁用审批动作。

## 5. Launch Queue 页面

页面：`LaunchApprovalWorkspace`

### 5.1 筛选与列表

页面提供：

- `Pending`、`Returned`、`Live` 三个 tab。
- corridor 名称搜索。
- FIOP 筛选。
- `Reset` 清空筛选。
- 按 `latestActionAt` 倒序展示。

列表字段：

| 字段 | 说明 |
| --- | --- |
| `Corridor` | corridor 名称，下方展示当前 launch 状态 label。 |
| `Cooperation Mode` | corridor 合作模式。 |
| `FIOP` | corridor 当前 FIOP owner。 |
| `Submitted At` | launch 提交时间。 |
| `Status` | 当前 `launchApproval.status` 的展示值。 |
| `Latest Update` | 最近一次 launch 动作时间。 |
| `Actor` | 最近一次 launch 动作人。 |
| `Reviewer Note` | 最近一次备注；无备注时展示 `No note recorded.` |
| `Action` | `Details` 和 `Approval`。 |

### 5.2 Details

`Details` 进入 corridor detail 的只读上线审批上下文，调用 `openLaunchApprovalReadonlyDetail(row.channel)`。

该入口用于查看 corridor 详情、Go-live Management 状态和相关材料摘要，不执行上线审批动作。进入后 `detailEntryMode = launchApprovalReadonly`，返回路径为 `launchApprovalWorkspace`。

### 5.3 Approval

`Approval` 只在以下条件同时满足时可用：

- 当前行状态为 `under_fi_supervisor_review`。
- 当前行未 blocked。

点击后打开 `Launch approval detail` 抽屉。`Returned`、`Live`、blocked 记录不允许直接打开审批动作。

## 6. 审批抽屉

审批抽屉标题为 `Launch approval detail`，用于 FI Supervisor 做最终上线审批。

### 6.1 区块

| 区块 | 说明 |
| --- | --- |
| `Final launch review` | 展示 corridor 名称和当前上线审批状态。 |
| `Prerequisites` | 展示 KYC、Legal/Pricing、Fund approval 的门禁状态。 |
| `Fund approval record` | 展示 Fund 状态、最新动作时间、动作人和备注。 |
| `Launch history` | 展示上线审批历史。 |
| `Review action` | 展示 reviewer note、`Return to FIOP` 和 `Approve & Go Live`。 |

### 6.2 Prerequisites

`Prerequisites` 中展示以下项目：

- `KYC verification`：WooshPay / Corridor 两条 KYC track 的当前展示状态。
- Legal items：NDA、MSA、Pricing Schedule、Other Attachments。
- `Fund approval`：当前 Fund approval 状态。

Other Attachments 在页面上标记为 optional，不作为 Fund Review 或 Launch 最终审批的必填阻塞项。

如果前置条件不满足，抽屉展示：

`Fund approval or prerequisites changed. FIOP must resubmit Fund review before final launch approval.`

并列出 `missingItems`。

### 6.3 Fund approval record

Fund approval record 读取当前 `fundApproval`，展示：

| 字段 | 来源 |
| --- | --- |
| Status | `fundApproval.status` |
| Latest Action At | 最新 fund history 时间，或 `lastActionAt` / `submittedAt` |
| Latest Action By | 最新 fund history user，或 `lastActionBy` / `submittedBy` |
| Latest Note | 最新 fund history note，或 `note` / `submitNote` |

### 6.4 Launch history

Launch history 来自 `launchApproval.history[]`，按时间倒序展示。当前标题映射：

| history type | 展示标题 |
| --- | --- |
| `submit` | Submitted to Fund |
| `fund_approve` | Fund approved |
| `fund_return` | Fund returned |
| `supervisor_approve` | FI Supervisor approved |
| `supervisor_return` | FI Supervisor returned |
| `reopened` | Launch status updated |

## 7. 审批动作

### 7.1 Approve & Go Live

`Approve & Go Live` 用于最终通过上线审批。

前置条件：

- 当前状态为 `under_fi_supervisor_review`。
- 当前记录未 blocked。

备注规则：

- `Reviewer note` 可选。
- 未填写时，系统默认使用 `FI Supervisor approved final launch.`。

提交后执行 `applyLaunchSupervisorDecision(channel, 'approve', actor, timestamp, note)`：

- `launchApproval.status` 变为 `live`。
- 写入 `supervisorDecisionBy`、`supervisorDecisionAt`、`supervisorNote`。
- `launchApproval.history[]` 新增 `type = supervisor_approve`。
- corridor `status` 变为 `Live`。
- corridor `auditLogs` 记录最终通过动作。

### 7.2 Return to FIOP

`Return to FIOP` 用于退回 FI 侧修正。

前置条件：

- 当前状态为 `under_fi_supervisor_review`。
- 当前记录未 blocked。

备注规则：

- `Reviewer note` 必填。
- 未填写时提示：`Please enter the return reason.`。

提交后执行 `applyLaunchSupervisorDecision(channel, 'request_changes', actor, timestamp, note)`：

- `launchApproval.status` 变为 `supervisor_returned`。
- 写入 `supervisorDecisionBy`、`supervisorDecisionAt`、`supervisorNote`。
- `launchApproval.history[]` 新增 `type = supervisor_return`。
- `fundApproval.status` 回到 `pending`。
- 清空 `fundApproval.submittedAt`、`submittedBy`、`submitNote`。
- `fundApproval.history[]` 新增 `type = reopened`。
- corridor `auditLogs` 记录退回动作。

FI Supervisor 退回后，FI 侧需要按退回原因修正材料并重新提交 Fund Review。Fund 再次审批通过后，Launch 会重新进入 `under_fi_supervisor_review`，并回到 Launch Queue 的 `Pending`。

## 8. 测试验收清单

### 8.1 权限与入口

1. `FI_SUPERVISOR` 登录后，Dashboard 显示 `Launch Queue (n)`。
2. `Launch Queue (n)` 只统计 `Pending`，不统计 `Returned` 和 `Live`。
3. 非 `FI_SUPERVISOR` 登录后，不显示 Launch Queue 入口。
4. 非 `FI_SUPERVISOR` 强行进入 `launchApprovalWorkspace` 时，应被页面守卫退回。

### 8.2 Go-live Management

1. corridor detail 中展示 `Go-live Management`。
2. 页面包含 KYC、Legal、Fund Review、FI Supervisor Review 四个节点。
3. KYC、Legal/Pricing、Fund 只验证状态摘要和门禁影响，不重复验证内部审批流。
4. Fund 审批通过后，FI Supervisor Review 节点展示等待最终审批。
5. FI Supervisor 通过后，FI Supervisor Review 节点展示最终审批已记录。

### 8.3 Launch Queue

1. `under_fi_supervisor_review` 显示在 `Pending`。
2. `supervisor_returned` 显示在 `Returned`。
3. `live` 显示在 `Live`。
4. `under_fund_review`、`fund_returned`、`not_submitted` 不显示在 Launch Queue。
5. corridor 搜索生效。
6. FIOP 筛选生效。
7. 列表按 `latestActionAt` 倒序展示。
8. 点击 `Details` 进入只读详情上下文。
9. `Approval` 只在 pending 且未 blocked 时可用。

### 8.4 审批抽屉

1. 点击可用的 `Approval` 后打开 `Launch approval detail` 抽屉。
2. 抽屉展示 Final launch review、Prerequisites、Fund approval record、Launch history、Review action。
3. Prerequisites 正确展示 KYC、Legal items、Fund approval。
4. 前置条件不满足时展示 blocked note 和 missing items。
5. blocked 时 `Reviewer note`、`Return to FIOP`、`Approve & Go Live` 均不可操作。

### 8.5 最终通过

1. pending 且未 blocked 的记录可点击 `Approve & Go Live`。
2. reviewer note 为空时允许通过。
3. 通过后 `launchApproval.status = live`。
4. 通过后 corridor `status = Live`。
5. Launch history 新增 `supervisor_approve`。
6. 记录进入 Launch Queue 的 `Live` tab。

### 8.6 退回重提

1. pending 且未 blocked 的记录可点击 `Return to FIOP`。
2. reviewer note 为空时阻止提交，并提示 `Please enter the return reason.`。
3. 填写原因后退回成功。
4. 退回后 `launchApproval.status = supervisor_returned`。
5. 退回后 `fundApproval.status = pending`，并清空 active submit 信息。
6. Launch history 新增 `supervisor_return`。
7. Fund history 新增 `reopened`。
8. 记录进入 Launch Queue 的 `Returned` tab。
9. FI 侧重新提交 Fund Review，Fund 审批通过后，记录重新进入 `Pending`。

## 9. 注意事项

- Launch Queue 是 FI Supervisor 最终上线审批队列，不等同于报价单审批队列。
- `Details` 是只读详情入口，不应触发审批动作。
- `Approval` 是最终审批入口，只允许 pending 且未 blocked 的记录使用。
- KYC、Legal/Pricing、Fund 的内部流程按各自文档验收；本文只验证它们是否正确阻塞或放行 Launch gate。
- FI Supervisor 退回不是直接回到 Live 前一状态，而是要求 FI 侧重新提交 Fund Review。
