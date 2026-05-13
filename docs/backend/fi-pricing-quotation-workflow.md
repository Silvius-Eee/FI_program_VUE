# FI 报价单角色流转与验收文档

更新时间：2026-05-06

## 1. 背景与目标

当前项目中，报价单由 `PricingManagementPage` 维护，并作为 Legal Workbench 中 `Pricing Schedule` 子项的一部分参与上线前审批。报价单流转不同于普通法务文档，需要先经过 `FI Supervisor` 审批，再进入 `Legal` 审核。

本文档用于统一开发和测试对“报价单角色流转”的理解，按当前前端实现整理角色权限、状态机、队列口径、数据字段和验收场景。

本文档目标：

- 明确 `FIOP/FIBD`、`FI Supervisor`、`Legal`、`Compliance` 在报价单流转中的职责边界。
- 明确报价单从创建、提交、审批、退回、重提、Legal 完成到撤回的状态变化。
- 明确 FI Supervisor Queue、Legal Queue、Dashboard、WorkflowBoard 的展示和验收口径。
- 明确当前实现中的特殊行为，不在本文档中默认要求改造。

## 2. 范围与角色

### 2.1 业务对象

报价单流转以 proposal 为最小状态对象：

- 一个 `corridor` 下可以有多个 `pricingProposals`。
- 每个 proposal 可以包含多个 `paymentMethods`。
- 每个 proposal 独立维护审批状态、Legal 状态、提交包、时间线和待处理 handoff。
- corridor 级别的 `pricingProposalStatus` / `globalProgress.pricing` 是多个 proposal 状态的聚合展示。

### 2.2 操作角色

| 角色 | 当前职责 |
| --- | --- |
| `FIOP/FIBD` | 仅在 assignment 命中的 corridor 中维护报价单、维护 payment methods、提交报价单、处理退回后的修改和重提。 |
| `FI Supervisor` | 可维护任意 corridor 的报价单；可进入 FI Supervisor Approval Queue；可审批通过或退回报价单。 |
| `Legal` | 在 Legal Queue 的 `PRICING` tab 处理已进入 Legal 阶段的报价单；可退回给 FI 跟进，或标记完成。 |
| `Compliance` | 不参与报价单流转，不具备报价单维护、审批或 Legal 决策权限。 |

说明：

- `FIOP` 与 `FIBD` 在报价单维护和提交上的权限当前一致。
- `FI Supervisor` 可以维护和提交报价单，但提交动作仍按 FI 侧 submit 进入报价单审批链，不自动跳过 FI Supervisor 审批。
- 外部 corridor 不作为系统内操作角色，`Under Corridor review` 表示业务上等待 FI 侧跟进渠道反馈或修改材料。

### 2.3 权限边界

| 能力 | `FIOP/FIBD` | `FI Supervisor` | `Legal` | `Compliance` |
| --- | --- | --- | --- | --- |
| 查看 Dashboard 中报价单状态 | assignment 命中 corridor | 全部 corridor | 可看 Legal Queue 相关任务 | 不参与 |
| 进入 Pricing 页面 | assignment 命中 corridor | 全部 corridor | 不作为 FI 侧维护入口 | 不参与 |
| 创建/编辑 proposal | assignment 命中 corridor | 全部 corridor | N | N |
| 编辑 payment methods | assignment 命中 corridor | 全部 corridor | N | N |
| 提交/重提报价单 | assignment 命中 corridor | 全部 corridor | N | N |
| 进入 FI Supervisor Approval Queue | N | Y | N | N |
| FI Supervisor approve / return | N | Y | N | N |
| 进入 Legal Queue 的 `PRICING` | N | N | Y | N |
| Legal return / complete | N | N | Y | N |

## 3. 状态定义

| 状态 | 含义 | 主要处理角色 |
| --- | --- | --- |
| `Not Started` | 报价单尚未进入审批流。 | `FIOP/FIBD/FI Supervisor` |
| `Under FI supervisor review` | FI 侧已提交，等待 `FI Supervisor` 审批。 | `FI Supervisor` |
| `Under legal review` | `FI Supervisor` 已通过，等待 `Legal` 审核。 | `Legal` |
| `Under Corridor review` | 已被 `FI Supervisor` 或 `Legal` 退回，等待 FI 侧跟进渠道反馈、修改报价单或补充材料。 | `FIOP/FIBD/FI Supervisor` |
| `Completed` | `Legal` 已完成报价单法务审核。 | 终态 |

状态归一化说明：

- 历史数据中的 `pending`、`in review`、`under review` 等会归一为 `Under FI supervisor review`。
- 历史数据中的 `approved`、`approved by fi supervisor`、`ready for legal` 等会归一为 `Under legal review`。
- 历史数据中的 `changes requested`、`returned by fi supervisor` 等会归一为 `Under Corridor review`。
- 历史数据中的 `signed` 会归一为 `Completed`。

## 4. 报价单流转规则

### 4.1 主流程

| 操作 | 操作角色 | 前置状态 | 目标状态 | 下一处理角色 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 创建/保存报价单 | `FIOP/FIBD/FI Supervisor` | 任意可编辑状态 | 不改变审批状态 | 当前操作人 | 仅保存 proposal、payment methods、附件、link、remark 等内容。 |
| 首次提交 `Submit pricing` | `FIOP/FIBD/FI Supervisor` | `Not Started` | `Under FI supervisor review` | `FI Supervisor` | 进入 FI Supervisor Queue 的 `Pending`。 |
| FI Supervisor 通过 `Approve` | `FI Supervisor` | `Under FI supervisor review` | `Under legal review` | `Legal` | 进入 Legal Queue 的 `PRICING / Legal action required`。 |
| FI Supervisor 退回 `Return` | `FI Supervisor` | `Under FI supervisor review` | `Under Corridor review` | FI 侧 | FI 侧修改后重新提交，下一跳仍回到 `FI Supervisor`。 |
| Legal 退回 `Legal return` | `Legal` | `Under legal review` | `Under Corridor review` | FI 侧 | FI 侧修改后重新提交，下一跳直接回到 `Legal`。 |
| Legal 完成 `Legal complete` | `Legal` | `Under legal review` | `Completed` | 无 | 报价单 Legal 审核完成。 |

### 4.2 `Under Corridor review` 的来源差异

`Under Corridor review` 是一个共享状态，但当前实现中必须结合历史和 `legalStatus` 判断下一跳：

| 来源 | 进入方式 | FI 侧重提后的目标状态 | 说明 |
| --- | --- | --- | --- |
| FI Supervisor 退回 | `FI Supervisor` 在审批详情页执行 `request_changes` | `Under FI supervisor review` | 因为报价单尚未进入 Legal 阶段，重提后仍需 FI Supervisor 重新审批。 |
| Legal 退回 | `Legal` 在 Legal Workbench 的 `PRICING` tab 执行 `Under Corridor review` | `Under legal review` | 因为报价单已经通过 FI Supervisor，重提后直接回到 Legal 审核。 |

测试时不能只根据当前状态判断重提后的下一跳，必须覆盖以上两个来源。

### 4.3 撤回规则

| 撤回对象 | 可撤回角色 | 条件 | 恢复状态 | 说明 |
| --- | --- | --- | --- | --- |
| FI 侧最新提交 | 原 FI 侧提交方 | 最新 handoff 尚未被下一角色处理 | handoff 的 `sourceStatus` | 历史记录保留，提交事件 lifecycle 标记为 `revoked`。 |
| FI Supervisor 最新决策 | 原 `FI Supervisor` 操作人 | 最新 FI Supervisor 决策仍为最新可见事件 | 决策前状态 | 适用于 approve 或 return，历史记录保留。 |
| Legal 最新终态/退回决策 | 原 `Legal` 操作人 | 最新 Legal 决策仍为最新可见事件 | 决策前状态 | 适用于 Legal return 或 complete，历史记录保留。 |

撤回不允许物理删除历史，只允许通过 lifecycle / terminalDecision 标记恢复展示状态。

## 5. 队列与页面展示口径

### 5.1 FI 侧 Pricing 页面

页面：`PricingManagementPage`

当前行为：

- `FIOP/FIBD` 仅能进入 assignment 命中的 corridor。
- `FI Supervisor` 可进入任意 corridor。
- 可维护 proposal、payment methods、报价单附件、document link、remark。
- 当 proposal 处于 `Under FI supervisor review`、`Under legal review`、`Completed` 时，不允许直接再次提交。
- 当 proposal 处于 `Under Corridor review` 时，允许 FI 侧修改后重提。

### 5.2 FI Supervisor Approval Queue

页面：

- `PricingApprovalWorkspace`
- `PricingApprovalDetailPage`

队列 tab：

| Tab | 包含状态 | 操作 |
| --- | --- | --- |
| `Pending` | `Under FI supervisor review` | 可进入详情执行 `Approve` 或 `Return`。 |
| `Returned` | `Under Corridor review` | 仅用于跟踪已退回报价单。 |
| `Legal / Completed` | `Under legal review` / `Completed` | 仅用于跟踪已通过 FI Supervisor 后的 Legal 进度。 |

权限：

- 只有 `FI Supervisor` 可以进入该工作台和详情页。
- 非 `FI Supervisor` 停留在该页面时，页面守卫会退回 detail 或 dashboard。

### 5.3 Legal Queue 的 `PRICING`

页面：

- `LegalApprovalWorkspace`
- `LegalFiDetailPage` 的 `Pricing Schedule` tab

Legal Queue 分组：

| 分组 | 包含状态 | 操作 |
| --- | --- | --- |
| `Legal action required` | `Under legal review` | `Legal` 可退回或完成。 |
| `Waiting on Corridor` | `Under Corridor review` | 等待 FI 侧修改和重提。 |
| `Completed` | `Completed` | 只读跟踪。 |

Legal 决策限制：

- `Legal` 仅在当前状态为 `Under legal review` 时可以保存 pricing legal status。
- Legal 可选目标状态只有 `Under Corridor review` 和 `Completed`。
- Legal 不维护报价单价格配置，不编辑 payment methods。

### 5.4 Dashboard 与 WorkflowBoard

当前实现中存在两个聚合口径：

| 位置 | 聚合优先级 | 说明 |
| --- | --- | --- |
| channel 级 `pricingProposalStatus` / `globalProgress.pricing` | `Under legal review` > `Under FI supervisor review` > `Under Corridor review` > 全部 `Completed` > `Not Started` | 由 channel 数据更新时聚合。 |
| WorkflowBoard 法务卡片中的 Pricing Schedule 聚合 | `Under legal review` > `Under Corridor review` > `Under FI supervisor review` > 全部 `Completed` > `Not Started` | 用于 Go-live Management 中 Legal 卡片的展示。 |

这是当前代码现状。本文档不要求在本次改造中统一两个聚合优先级；测试需要按页面分别验证。

## 6. 数据口径

### 6.1 proposal 级字段

后端或 BFF 至少需要承载以下语义，字段名可按现有接口规范调整，但含义必须一致：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `approvalStatus` | string | FI Supervisor 阶段状态。 |
| `legalStatus` | string | Legal 阶段状态；有值时优先作为 proposal 当前 Legal 阶段展示状态。 |
| `approvalHistory[]` | array | FI 侧提交、FI Supervisor approve / return 的历史。 |
| `legalHistory[]` | array | Legal return / complete 的历史。 |
| `pendingHandoff` | object/null | 当前未被下一角色消费的 handoff。 |
| `legalRequestPacket` | object | 提交给下一角色的报价单材料包。 |
| `attachments` | array | 报价单附件。 |
| `paymentMethods` | array | 报价单下的 payment method 配置。 |
| `updatedAt` | datetime/string | proposal 最近更新时间。 |

### 6.2 `legalRequestPacket`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `documentLink` | string | 报价单文档或外部材料链接。 |
| `remarks` | string | FI 侧备注。 |
| `attachments` | array | 提交给审核方可查看的附件快照。 |
| `submittedAt` | datetime/string | 最近一次提交时间。 |
| `submittedBy` | string | 最近一次提交人显示名。 |

### 6.3 `pendingHandoff`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `flowType` | enum | 当前为 `pricing`。 |
| `flowKey` | string | proposal id。 |
| `senderRole` | enum | 发起角色。 |
| `senderName` | string | 发起人显示名。 |
| `receiverRole` | enum | 下一处理角色。 |
| `sourceStatus` | string/null | 撤回时恢复到的状态。 |
| `targetStatus` | string/null | 本次 handoff 目标状态。 |
| `originEventId` | string | 对应时间线事件。 |
| `payloadSnapshot` | object | 提交时的报价单快照。 |
| `state` | enum | `pending` / `consumed` / `revoked`。 |

当前实现特别说明：

- FI 侧提交报价单时，`pendingHandoff.senderRole` 当前统一写为 `FIOP`。
- 如果实际操作人是 `FIBD` 或 `FI Supervisor`，当前实现通过 `senderName`、`approvalHistory.user`、`legalRequestPacket.submittedBy` 体现真实操作人。
- 本文档只记录该现状，不要求本次开发将 `senderRole` 拆成 `FIOP/FIBD/FI Supervisor`。

### 6.4 corridor 聚合字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `pricingProposalStatus` | string | corridor 维度报价单聚合状态。 |
| `globalProgress.pricing` | string | 工作流维度报价单聚合状态。 |
| `submissionHistory.pricing` | object | 最近一次报价单相关提交或状态更新摘要。 |

## 7. 开发实现验收点

### 7.1 权限验收

1. `FIOP/FIBD` 命中 assignment 时，可以进入对应 corridor 的 Pricing 页面并编辑、提交报价单。
2. `FIOP/FIBD` 未命中 assignment 时，不能进入或操作该 corridor 的 Pricing 页面。
3. `FI Supervisor` 可以进入任意 corridor 的 Pricing 页面并维护报价单。
4. 只有 `FI Supervisor` 可以进入 `PricingApprovalWorkspace` 和 `PricingApprovalDetailPage`。
5. 只有 `Legal` 可以在 Legal Workbench 的 `PRICING` tab 保存 Legal 状态。
6. `Compliance` 不能操作报价单维护、FI Supervisor 审批或 Legal 决策。

### 7.2 状态流转验收

1. 首次提交：`Not Started -> Under FI supervisor review`，进入 FI Supervisor Queue 的 `Pending`。
2. FI Supervisor approve：`Under FI supervisor review -> Under legal review`，进入 Legal Queue 的 `PRICING / Legal action required`。
3. FI Supervisor return：`Under FI supervisor review -> Under Corridor review`，进入 FI Supervisor Queue 的 `Returned`。
4. FI Supervisor return 后，FI 侧修改并重提，应回到 `Under FI supervisor review`。
5. Legal return：`Under legal review -> Under Corridor review`，进入 Legal Queue 的 `PRICING / Waiting on Corridor`。
6. Legal return 后，FI 侧修改并重提，应直接回到 `Under legal review`。
7. Legal complete：`Under legal review -> Completed`，进入 Legal Queue 的 `PRICING / Completed`。
8. `Completed` 状态下，FI 侧不能直接重新提交。

### 7.3 撤回验收

1. FI 侧最新提交尚未被下一角色处理时，原提交方可以撤回，状态恢复到提交前。
2. FI Supervisor 最新 approve / return 仍为最新可见事件时，原 FI Supervisor 操作人可以撤回，状态恢复到决策前。
3. Legal 最新 return / complete 仍为最新可见事件时，原 Legal 操作人可以撤回，状态恢复到决策前。
4. 撤回后历史记录仍保留，但对应事件 lifecycle 应展示为 revoked，不应物理删除。
5. 非原操作人、非最新事件、已被下一角色处理的 handoff 不应允许撤回。

### 7.4 多报价单验收

1. 一个 corridor 下多个 proposal 应各自独立流转。
2. FI Supervisor Queue 以 proposal 为粒度展示，而不是只展示 corridor 聚合。
3. Legal Queue 的 `PRICING` 同样以 proposal 为粒度展示。
4. proposal 单条状态变化后，corridor 级 `pricingProposalStatus`、`globalProgress.pricing`、`submissionHistory.pricing` 需要同步更新。
5. Dashboard 和 WorkflowBoard 聚合优先级当前不同，测试应分别按第 5.4 节验收。

## 8. 测试用例清单

### 8.1 正向场景

1. assigned `FIOP` 创建报价单、添加 payment method、保存、提交，状态变为 `Under FI supervisor review`。
2. `FI Supervisor` 在 Approval Queue 的 `Pending` tab 打开报价单并 approve，状态变为 `Under legal review`。
3. `Legal` 在 Legal Queue 的 `PRICING` tab 打开报价单并 complete，状态变为 `Completed`。
4. `FI Supervisor` return 后，FI 侧修改报价单并重提，状态回到 `Under FI supervisor review`。
5. `Legal` return 后，FI 侧修改报价单并重提，状态直接回到 `Under legal review`。
6. 多个 proposal 分别处于 `Under legal review`、`Under FI supervisor review`、`Under Corridor review`、`Completed` 时，各队列和聚合展示符合当前实现。

### 8.2 反向场景

1. 未 assigned 的 `FIOP/FIBD` 不能操作该 corridor 的报价单。
2. `FIOP/FIBD` 不能进入 FI Supervisor Approval Queue。
3. `Legal` 不能进入 FI Supervisor Approval Queue。
4. `Compliance` 不能进入报价单维护、审批或 Legal PRICING 决策入口。
5. `Legal` 在报价单非 `Under legal review` 状态下不能保存 Legal 状态。
6. proposal 处于 `Under FI supervisor review`、`Under legal review`、`Completed` 时，FI 侧不能直接重复提交。
7. 缺少有效 proposal 时，提交动作应提示先创建或选择报价单。

### 8.3 撤回场景

1. FI 提交后、FI Supervisor 未处理前，撤回后回到 `Not Started` 或提交前状态。
2. FI Supervisor approve 后、Legal 未处理前，撤回后回到 `Under FI supervisor review`。
3. FI Supervisor return 后、FI 未重提前，撤回后回到 `Under FI supervisor review`。
4. Legal return 后、FI 未重提前，Legal 撤回后回到 `Under legal review`。
5. Legal complete 后，Legal 撤回后回到 `Under legal review`。

## 9. 参考实现

当前文档基于以下前端实现整理：

| 模块 | 文件 | 说明 |
| --- | --- | --- |
| 状态、提交、审批、Legal 决策、队列构建 | `src/constants/initialData.ts` | `applyPricingSubmission`、`applyPricingApprovalDecision`、`applyPricingLegalDecision`、`buildPricingApprovalQueueRows` 等。 |
| FI 侧报价单维护和提交入口 | `src/components/PricingManagementPage.vue` | proposal、payment methods、附件、提交动作。 |
| FI Supervisor 审批详情 | `src/components/PricingApprovalDetailPage.vue` | approve、request changes、撤回。 |
| Legal PRICING 审核入口 | `src/components/LegalFiDetailPage.vue` | Legal return、complete、撤回、FI 侧处理退回。 |
| Legal 队列 | `src/components/LegalApprovalWorkspace.vue` | `PRICING` tab 的 Legal 队列展示。 |
| 角色权限与页面守卫 | `src/stores/app.ts` | assignment、FI Supervisor 页面守卫、Legal 页面入口。 |

