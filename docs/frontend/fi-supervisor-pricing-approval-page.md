# FI 主管报价单审批页面说明文档

更新时间：2026-05-08

## 1. 文档目的

本文档面向技术和测试，说明当前项目中 `FI Supervisor` 报价单审批页面的页面入口、队列口径、详情页字段、审批操作、撤回规则和验收场景。

报价单全链路状态机以 [../backend/fi-pricing-quotation-workflow.md](../backend/fi-pricing-quotation-workflow.md) 为背景参考。本文只聚焦 FI 主管审批页面现状，不提出本次改造需求。

当前页面相关实现：

| 模块 | 文件 | 说明 |
| --- | --- | --- |
| FI Supervisor 审批队列 | `src/components/PricingApprovalWorkspace.vue` | 展示 Pending、Returned、Legal / Completed 三类报价单任务。 |
| FI Supervisor 审批详情 | `src/components/PricingApprovalDetailPage.vue` | 展示报价单详情、payment method、审批操作、历史和撤回入口。 |
| 状态与队列构建 | `src/constants/initialData.ts` | 定义 pricing 状态常量、状态归一、队列 tab、审批/撤回处理函数。 |
| 页面入口与守卫 | `src/stores/app.ts` | 控制 view 切换、角色守卫、详情页返回路径。 |
| Dashboard 入口 | `src/components/ChannelDashboard.vue` | FI Supervisor 看到 `Approval Queue (n)` 按钮。 |

## 2. 页面入口与权限

### 2.1 入口

`FI Supervisor` 在 Dashboard 顶部工具区可看到 `Approval Queue (n)` 按钮，点击后进入 `PricingApprovalWorkspace`。

`n` 的计算口径只统计 `buildPricingApprovalQueueRows(store.channelList)` 中 `queueTab === 'pending'` 的行数，即只统计等待 FI Supervisor 审批的报价单，不包含已退回、Legal 审核中或已完成的报价单。

### 2.2 权限

| 角色 | 是否可进入 FI Supervisor 报价单审批页面 | 说明 |
| --- | --- | --- |
| `FI_SUPERVISOR` | Y | 可进入队列和详情，可执行 approve / request changes，可查看后续 Legal 阶段进度。 |
| `FIOP` / `FIBD` | N | 可在 FI 侧 Pricing 页面维护报价单，但不能进入 FI Supervisor 审批页面。 |
| `LEGAL` | N | 在 Legal Workbench 的 `PRICING` tab 处理报价单，不进入 FI Supervisor 审批页面。 |
| `COMPLIANCE` | N | 不参与报价单流转。 |
| `TECH` | N | 不参与报价单审批。 |

`src/stores/app.ts` 中有 view 守卫：当当前用户不是 `FI_SUPERVISOR` 且停留在 `pricingApprovalWorkspace` 或 `pricingApprovalDetail` 时，系统会清理已选 proposal / method，并退回 `detail` 或 `dashboard`。

## 3. 队列页面说明

页面：`PricingApprovalWorkspace`

队列以 proposal 为粒度展示，不以 corridor 聚合状态为粒度。一个 corridor 下多个 `pricingProposals` 会分别进入队列。

### 3.1 Tab 口径

| Tab | 对应状态 | 页面目的 | 是否可审批 |
| --- | --- | --- | --- |
| `Pending` | `Under FI supervisor review` | 等待 FI Supervisor 审批的报价单。 | Y，进入详情后可 approve 或 request changes。 |
| `Returned` | `Under Corridor review` | FI Supervisor 或 Legal 退回后的报价单跟踪视图。 | N，只用于查看退回原因和最新状态。 |
| `Legal / Completed` | `Under legal review` / `Completed` | 已通过 FI Supervisor，正在 Legal 审核或已完成的报价单跟踪视图。 | N，只用于跟踪 Legal 阶段。 |

Tab 归类由 `getPricingApprovalQueueTab(getPricingLegalStageStatus(proposal))` 决定。

### 3.2 列表字段

队列表格当前展示以下字段：

| 字段 | 说明 |
| --- | --- |
| `Corridor` | corridor 名称。点击行或 `Details` 进入审批详情。 |
| `Quotation` | proposal 名称，默认显示 `Pricing Schedule`；下方显示 payment method 数量。 |
| `Cooperation Mode` | proposal 的合作模式。 |
| `FIOP` | corridor 当前 FI owner。 |
| `Submitted At` | 最近提交时间。 |
| `Status` | 当前 proposal 阶段状态。 |
| `Latest Update` | 最近一次可见动作时间。 |
| `Actor` | 最近一次可见动作人。 |
| `Reviewer Note` | 最近一次备注；无备注时显示 `No note recorded.` |
| `Action` | `Details`，进入详情页。 |

### 3.3 筛选与排序

- 支持按 corridor 名称搜索。
- 支持按当前 tab 内的 `FIOP` 筛选。
- 支持 `Reset` 清空筛选。
- 列表按 `latestActionAt` 倒序排列。

## 4. 审批详情页说明

页面：`PricingApprovalDetailPage`

详情页根据当前 proposal 状态决定展示“可操作审批表单”还是“只读决策摘要”。

### 4.1 页面区块

| 区块 | 说明 |
| --- | --- |
| Header | 展示 `FI Supervisor review`、proposal 名称、当前状态、最近提交/决策时间和操作人。 |
| `Open Pricing Schedule` | 进入 Pricing 页面查看报价单详情，使用 `approvalReviewScoped` 上下文。 |
| `Quotation Summary` | 展示 Quotation Name、Corridor、Cooperation Mode、FIOP、Document Link、Remark。 |
| `Payment Method List` | 展示 payment method、Consumer Region、Fee、Settlement Currency。 |
| 决策区块 | Pending 时展示审批输入和按钮；非 Pending 时展示决策摘要。 |
| `Approval History` | 展示 submit、FI Supervisor approve / request changes、Legal return / complete 等统一历史。 |

### 4.2 Pending 状态操作

当 proposal 当前状态为 `Under FI supervisor review` 时，`canReview === true`，页面展示：

| 操作 | 按钮 | 备注规则 | 结果 |
| --- | --- | --- | --- |
| 审批通过 | `Approve` | 备注可选；点击后弹窗二次确认。 | 状态进入 `Under legal review`，进入 Legal 阶段。 |
| 退回修改 | `Request Changes` | 备注必填；为空时提示 `Please enter the reason for changes.` | 状态进入 `Under Corridor review`，等待 FI 侧修改并重提。 |

审批动作由 `applyPricingApprovalDecision(channel, proposalId, type, actor, timestamp, note)` 处理。

### 4.3 非 Pending 状态展示

当 proposal 不在 `Under FI supervisor review` 时，详情页不展示 `Approve` / `Request Changes` 按钮，只展示决策摘要：

| 当前队列 | 摘要标题 | 含义 |
| --- | --- | --- |
| `Returned` | `Returned to FI` | 报价单已退回 FI 侧，等待修改和重提。 |
| `Legal / Completed` | `Moved to Legal review` | 报价单已离开 FI Supervisor 审批队列，当前由 Legal 继续审核或已完成。 |

## 5. 状态流转

### 5.1 FI Supervisor 页面相关主流程

| 操作 | 操作角色 | 前置状态 | 目标状态 | 页面结果 |
| --- | --- | --- | --- | --- |
| FI 侧提交报价单 | `FIOP` / `FIBD` / `FI Supervisor` | `Not Started` 或可重提状态 | `Under FI supervisor review` | 进入 FI Supervisor Queue 的 `Pending`。 |
| FI Supervisor approve | `FI Supervisor` | `Under FI supervisor review` | `Under legal review` | 从 `Pending` 移入 `Legal / Completed`，Legal 可在 PRICING tab 继续处理。 |
| FI Supervisor request changes | `FI Supervisor` | `Under FI supervisor review` | `Under Corridor review` | 从 `Pending` 移入 `Returned`，等待 FI 侧修改。 |
| FI 侧重提 FI Supervisor 退回的报价单 | `FIOP` / `FIBD` / `FI Supervisor` | `Under Corridor review` | `Under FI supervisor review` | 回到 `Pending`。 |
| Legal complete | `Legal` | `Under legal review` | `Completed` | 保持在 `Legal / Completed`，作为完成记录跟踪。 |

### 5.2 注意事项

- `Under Corridor review` 是共享状态，可能来自 FI Supervisor 退回，也可能来自 Legal 退回。
- 对 FI Supervisor 页面而言，`Returned` tab 只说明当前报价单处于退回等待 FI 侧处理状态。
- 如果报价单已通过 FI Supervisor 并进入 Legal 阶段，FI Supervisor 页面不再提供审批操作，只跟踪后续进度。

## 6. 撤回规则

详情页右侧 `Approval History` 中，如果某条历史满足可撤回条件，会展示撤回按钮。

### 6.1 可撤回项

FI Supervisor 页面中的可撤回项由 `getPricingRevocableAction(proposal, 'FI Supervisor', 'FI Supervisor')` 判断。

当前页面重点覆盖：

| 可撤回动作 | 条件 | 撤回后状态 |
| --- | --- | --- |
| FI Supervisor approve | 该 approve 仍是最新可见 FI Supervisor 决策，且未被后续处理破坏撤回条件。 | 恢复到决策前，通常为 `Under FI supervisor review`。 |
| FI Supervisor request changes | 该 request changes 仍是最新可见 FI Supervisor 决策，且 FI 侧尚未重提。 | 恢复到决策前，通常为 `Under FI supervisor review`。 |

### 6.2 撤回展示

- 撤回不会物理删除历史。
- 被撤回事件在历史中展示 `Revoked`。
- 状态恢复依赖事件中的 `terminalDecision.previousStatus` 等信息。
- 已被下一角色处理、非最新事件或非当前角色可撤回事件，不应显示撤回入口。

## 7. 数据口径

### 7.1 proposal 级核心字段

| 字段 | 说明 |
| --- | --- |
| `pricingProposals[]` | corridor 下的报价单列表；队列按其中的 proposal 逐条构建。 |
| `approvalStatus` | FI Supervisor 审批阶段状态。 |
| `legalStatus` | Legal 阶段状态；存在有效值时优先作为 proposal 当前阶段状态。 |
| `approvalHistory[]` | FI 侧 submit、FI Supervisor approve / request changes 历史。 |
| `legalHistory[]` | Legal return / complete 历史。 |
| `pendingHandoff` | 当前未被下一角色消费的 handoff，用于撤回和下一处理角色判断。 |
| `legalRequestPacket` | FI 侧提交给审核方的报价单材料快照。 |
| `paymentMethods[]` | 报价单下的 payment method 配置，详情页只读展示。 |

### 7.2 状态计算函数

| 函数 | 说明 |
| --- | --- |
| `getPricingLegalStageStatus(proposal)` | 得到 proposal 当前用于队列和详情展示的阶段状态。 |
| `getPricingApprovalQueueTab(status)` | 将状态映射到 `pending`、`changes_requested`、`approved` 三类 tab。 |
| `buildPricingApprovalQueueRows(channels)` | 从 channel 列表构建 FI Supervisor 队列行。 |
| `buildPricingUnifiedHistory(proposal)` | 构建详情页统一历史。 |
| `getPricingRevocableAction(proposal, actorRole, actorName)` | 判断当前是否存在可撤回动作。 |

## 8. 测试验收清单

### 8.1 权限测试

1. `FI_SUPERVISOR` 登录后 Dashboard 显示 `Approval Queue (n)`，点击可进入 `PricingApprovalWorkspace`。
2. `FIOP` / `FIBD` 登录后不显示 FI Supervisor 审批队列入口。
3. `LEGAL`、`COMPLIANCE`、`TECH` 登录后不显示 FI Supervisor 审批队列入口。
4. 非 `FI_SUPERVISOR` 强行进入 `pricingApprovalWorkspace` 或 `pricingApprovalDetail` 时，应被页面守卫退回。

### 8.2 队列测试

1. proposal 状态为 `Under FI supervisor review` 时，显示在 `Pending`。
2. proposal 状态为 `Under Corridor review` 时，显示在 `Returned`。
3. proposal 状态为 `Under legal review` 时，显示在 `Legal / Completed`。
4. proposal 状态为 `Completed` 时，显示在 `Legal / Completed`。
5. 同一 corridor 下多个 proposal 状态不同时，应分别出现于各自 tab，不应只展示 corridor 聚合状态。
6. `Approval Queue (n)` 只统计 `Pending` 数量，不统计 Returned 或 Legal / Completed。

### 8.3 审批操作测试

1. Pending 详情页展示 `Approve` 和 `Request Changes`。
2. 点击 `Approve` 后出现确认弹窗；确认后状态变为 `Under legal review`。
3. `Approve` 备注为空时允许提交。
4. 点击 `Request Changes` 且备注为空时，应提示 `Please enter the reason for changes.`，状态不变。
5. 填写备注后点击 `Request Changes`，状态变为 `Under Corridor review`。
6. Returned 详情页不展示 `Approve` / `Request Changes`，展示 `Returned to FI` 摘要。
7. Legal / Completed 详情页不展示 `Approve` / `Request Changes`，展示 Legal 阶段跟踪摘要。

### 8.4 Pricing Schedule 只读上下文测试

1. 从审批详情点击 `Open Pricing Schedule` 后进入对应 proposal 的 Pricing 页面。
2. 页面标题或返回路径体现 FI Supervisor Review 上下文。
3. 返回后回到 `PricingApprovalDetailPage`。
4. payment method 详情在该上下文中用于查看，不应作为 FI Supervisor 审批页直接编辑入口。

### 8.5 撤回测试

1. FI Supervisor approve 后，若 Legal 尚未处理且该决策仍为最新可见事件，历史中显示撤回入口。
2. 撤回 approve 后，状态恢复到 `Under FI supervisor review`，历史保留并标记 `Revoked`。
3. FI Supervisor request changes 后，若 FI 侧尚未重提且该决策仍为最新可见事件，历史中显示撤回入口。
4. 撤回 request changes 后，状态恢复到 `Under FI supervisor review`，历史保留并标记 `Revoked`。
5. 事件已被后续角色处理、不是最新事件或不是当前角色可撤回事件时，不显示撤回入口。

## 9. 技术与测试注意事项

- 测试 FI Supervisor 页面时，应以 proposal 状态为准，不要只看 corridor 级 `pricingProposalStatus`。
- `Legal / Completed` tab 是 FI Supervisor 的跟踪视图，不代表 FI Supervisor 还能继续审批。
- `Under Corridor review` 的下一跳需要结合来源判断；FI Supervisor 退回后重提回到 `Under FI supervisor review`，Legal 退回后重提直接回到 `Under legal review`。
- 历史和撤回属于审计口径，验收时应确认历史保留、事件状态标记和当前状态恢复同时正确。
