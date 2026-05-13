# 法务卡片状态提交流转需求文档

更新时间：2026-04-29

## 1. 背景与目标

审批流中的法务卡片用于汇总一个 corridor 上线前需要处理的法务事项。当前法务卡片包含 4 个子项：

- `NDA`
- `MSA`
- `Pricing Schedule`
- `Other Attachments`

本文档用于统一前端、后端和测试对“法务卡片状态提交与流转”的理解，明确每个子项的状态、操作角色、流转规则、页面展示口径和验收场景。

本期目标：

- `FIOP/FIBD` 或 `FI Supervisor` 可以提交法务材料给 `Legal`。
- `Legal` 可以基于提交材料更新审核状态、退回、标记完成或标记无需处理。
- `Pricing Schedule` 保留 `FI Supervisor` 审批阶段，通过后再进入 `Legal` 审核。
- 每次提交、审核、退回、完成、撤回都必须保留时间线记录。
- 法务卡片聚合状态必须能准确反映 4 个子项的整体进度。

## 2. 范围与角色

### 2.1 子项范围

| 子项 | 提交方 | 审核方 | 是否支持 `No Need` |
| --- | --- | --- | --- |
| `NDA` | `FIOP/FIBD/FI Supervisor` | `Legal` | 支持 |
| `MSA` | `FIOP/FIBD/FI Supervisor` | `Legal` | 不支持 |
| `Other Attachments` | `FIOP/FIBD/FI Supervisor` | `Legal` | 不支持 |
| `Pricing Schedule` | `FIOP/FIBD -> FI Supervisor -> Legal` | `FI Supervisor / Legal` | 不支持 |

### 2.2 操作角色

| 角色 | 说明 |
| --- | --- |
| `FIOP/FIBD` | 维护并提交法务材料包；负责在外部渠道与我方 `Legal`、`FI Supervisor` 等内部角色之间做材料、反馈、签署进度的交接和系统记录。 |
| `FI Supervisor` | 可协助 FI 侧提交法务材料；对 `Pricing Schedule` 先做审批。 |
| `Legal` | 审核材料，更新法务状态，退回或完成。 |

说明：外部渠道不作为系统内操作角色、权限主体或 handoff 接收方。状态文案中的 `Corridor` 仅表示业务进度，由 `FIOP/FIBD` 作为中转人跟进渠道反馈并在系统内更新。

## 3. NDA / MSA / Other Attachments 流转

### 3.1 状态定义

| 状态 | 含义 | 适用子项 |
| --- | --- | --- |
| `Not Started` | 尚未提交材料。 | `NDA` / `MSA` / `Other Attachments` |
| `Under our review` | FI 已提交，等待 Legal 审核。 | `NDA` / `MSA` / `Other Attachments` |
| `Under Corridor review` | 等待 `FIOP/FIBD` 跟进渠道反馈、补充确认或外部审核结果。 | `NDA` / `MSA` / `Other Attachments` |
| `Pending Corridor signature` | 等待 `FIOP/FIBD` 跟进渠道签署进度。 | `NDA` / `MSA` / `Other Attachments` |
| `Completed` | 法务事项完成。 | `NDA` / `MSA` / `Other Attachments` |
| `No Need` | 无需处理。 | 仅 `NDA` |

### 3.2 流转规则

| 操作 | 操作角色 | 前置状态 | 目标状态 | 说明 |
| --- | --- | --- | --- | --- |
| `Send to Legal` | `FIOP/FIBD/FI Supervisor` | `Not Started` | `Under our review` | 首次提交材料包。 |
| `Resend to Legal` | `FIOP/FIBD/FI Supervisor` | `Under Corridor review` / `Pending Corridor signature` | `Under our review` | 更新材料后重新提交给 Legal。 |
| `Return to Corridor review` | `Legal` | `Under our review` | `Under Corridor review` | Legal 需要 `FIOP/FIBD` 跟进渠道反馈并更新材料。 |
| `Mark pending signature` | `Legal` | `Under our review` / `Under Corridor review` | `Pending Corridor signature` | Legal 判断文件进入签署等待阶段。 |
| `Complete` | `Legal` | 任一处理中状态 | `Completed` | 法务事项完成。 |
| `Mark No Need` | `Legal` | `Not Started` / `Under our review` | `No Need` | 仅 `NDA` 支持。 |
| `Revoke latest send` | 原提交方 | 最新提交尚未被 Legal 处理 | 回到提交前状态 | 撤回未处理 handoff，历史记录保留并标记 revoked。 |
| `Revoke latest Legal decision` | 原 Legal 操作人 | 最新 Legal 终态决定仍可撤回 | 回到决定前状态 | 适用于最新 `Completed` / `No Need` 等终态决定。 |

### 3.3 终态规则

- `Completed` 和 `No Need` 视为终态。
- 终态后，FI 侧不能直接重新提交材料。
- 如需重开终态事项，应由 Legal 撤回最新终态决定，或另走重开流程。
- `MSA` 和 `Other Attachments` 不展示、不允许提交 `No Need`。
- 撤回不允许物理删除历史记录，只能更新生命周期标记。

## 4. Pricing Schedule 流转

`Pricing Schedule` 在法务卡片中展示，但它的审批链路不同于普通法务文档，需要先经过 `FI Supervisor`，再进入 `Legal`。

### 4.1 状态定义

| 状态 | 含义 |
| --- | --- |
| `Not Started` | 尚未提交 pricing。 |
| `Under FI supervisor review` | FI 已提交，等待 FI Supervisor 审批。 |
| `Under legal review` | FI Supervisor 已通过，等待 Legal 审核。 |
| `Under Corridor review` | FI Supervisor 或 Legal 退回，等待 `FIOP/FIBD` 跟进渠道反馈并更新材料。 |
| `Completed` | Legal 完成 pricing 法务审核。 |

### 4.2 流转规则

| 操作 | 操作角色 | 前置状态 | 目标状态 | 说明 |
| --- | --- | --- | --- | --- |
| `Submit pricing` | `FIOP/FIBD/FI Supervisor` | `Not Started` | `Under FI supervisor review` | 首次提交 pricing，进入 FI Supervisor 队列。 |
| `Approve pricing` | `FI Supervisor` | `Under FI supervisor review` | `Under legal review` | FI Supervisor 通过后交给 Legal。 |
| `Return pricing` | `FI Supervisor` | `Under FI supervisor review` | `Under Corridor review` | FI Supervisor 退回，等待 `FIOP/FIBD` 修改并跟进渠道反馈。 |
| `Legal return` | `Legal` | `Under legal review` | `Under Corridor review` | Legal 退回，等待 `FIOP/FIBD` 跟进渠道反馈并更新材料。 |
| `Resubmit returned pricing` | `FIOP/FIBD/FI Supervisor` | `Under Corridor review` | `Under legal review` | 已被 Legal 退回的 pricing 修改后，重新提交应直接回到 Legal。 |
| `Legal complete` | `Legal` | `Under legal review` | `Completed` | Legal 完成 pricing 法务审核。 |
| `Revoke latest handoff/decision` | 原操作方 | 最新 handoff 或终态决定仍可撤回 | 回到上一个有效状态 | 撤回后历史记录保留并标记 revoked。 |

## 5. 前后端同步口径

### 5.1 前端展示要求

- 法务卡片展示一个聚合状态。
- 法务卡片内展示 4 个子项及各自状态：
  - `NDA`
  - `MSA`
  - `Pricing Schedule`
  - `Other Attachments`
- 点击法务卡片进入 `Legal Workbench`。
- `Legal Workbench` 按 `NDA` / `MSA` / `Pricing Schedule` / `Other Attachments` 分 tab 展示。
- 每个子项详情页需要展示：
  - 当前状态
  - 最新提交材料包
  - 提交人
  - 提交时间
  - 备注
  - 附件
  - 时间线
  - 可撤回动作
- 非授权角色只能查看，不能提交或更新状态。

### 5.2 后端数据能力

每个 corridor 需要返回 4 个法务子项的当前状态。建议结构可以按现有接口命名调整，但语义必须一致。

#### 法务子项状态字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `doc_type` | enum | `NDA` / `MSA` / `OTHER_ATTACHMENTS` / `PRICING` |
| `status` | enum | 当前子项状态。 |
| `last_updated_at` | datetime/null | 最近更新时间。 |
| `last_updated_by` | string/null | 最近更新人。 |
| `pending_handoff` | object/null | 当前是否存在待下一角色处理的 handoff。 |

#### 最新提交包字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `entities` | string[] | WooshPay 侧签约主体。 |
| `document_link` | string | 文档链接或签署链接。 |
| `remarks` | string | 提交备注。 |
| `attachments` | array | 附件列表。 |
| `submitted_at` | datetime/null | 提交时间。 |
| `submitted_by` | string/null | 提交人。 |

#### 状态历史字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `event_id` | string | 事件唯一 ID。 |
| `from_status` | enum/null | 变更前状态。 |
| `to_status` | enum | 变更后状态。 |
| `actor_role` | enum | `FIOP` / `FI Supervisor` / `Legal`。 |
| `actor_name` | string | 操作人。 |
| `note` | string | 备注、退回原因或审核结论。 |
| `created_at` | datetime | 事件时间。 |
| `attachments` | array | 本次事件关联附件。 |
| `lifecycle_state` | enum | `active` / `consumed` / `revoked`。 |
| `terminal_decision` | object/null | 终态决定撤回所需元数据。 |

### 5.3 Handoff 与撤回

当操作把事项交给下一角色处理时，后端需要记录 pending handoff。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `flow_type` | enum | `legal` / `pricing`。 |
| `flow_key` | string | 子项或 pricing proposal 标识。 |
| `sender_role` | enum | 发起方角色，仅允许系统内角色：`FIOP` / `FI Supervisor` / `Legal`。 |
| `sender_name` | string | 发起人。 |
| `receiver_role` | enum | 接收方角色，仅允许系统内角色：`FIOP` / `FI Supervisor` / `Legal`，不允许外部渠道。 |
| `source_status` | enum/null | 撤回时恢复的状态。 |
| `target_status` | enum | handoff 目标状态。 |
| `origin_event_id` | string | 触发 handoff 的历史事件 ID。 |
| `state` | enum | `pending` / `consumed` / `revoked`。 |

撤回规则：

- 只有原提交方可以撤回自己发起、且尚未被接收方处理的 handoff。
- 只有原 Legal 操作人可以撤回自己做出的最新终态决定。
- 撤回后状态回到 `source_status` 或终态决定前状态。
- 撤回后原历史事件不能删除，只能标记为 `revoked`。

### 5.4 法务卡片聚合状态

聚合状态用于 `Go-live Management` 中法务卡片主状态展示。

| 聚合状态 | 规则 |
| --- | --- |
| `Not Started` | 4 个子项均未开始。 |
| `Pending` | 存在等待 `FI Supervisor` 的 pricing。 |
| `In Progress` | 任一子项处于 Legal 审核、渠道反馈、签署或退回跟进中。 |
| `Completed` | 所有必需子项均为 `Completed` 或合法的 `No Need`。 |

优先级建议：

1. 存在 `Under legal review` / `Under Corridor review` / `Pending Corridor signature` / `Under our review` 时，展示 `In Progress`。
2. 不存在处理中状态但存在 `Under FI supervisor review` 时，展示 `Pending`。
3. 所有子项均完成或合法无需处理时，展示 `Completed`。
4. 其他情况展示 `Not Started`。

## 6. 校验与权限

### 6.1 FI 侧提交校验

`Send to Legal` / `Resend to Legal` 必须满足：

- 当前用户是被授权的 `FIOP/FIBD` 或 `FI Supervisor`。
- 至少选择一个 contracting entity。
- `remarks` 必填。
- 附件可选，但如果存在上传中或上传失败状态，不允许提交。
- 当前子项不是终态；终态重开必须先撤回终态决定或走重开流程。

### 6.2 Legal 状态更新校验

`Legal` 更新状态必须满足：

- 当前用户角色是 `Legal`。
- `NDA` 可选状态包括：
  - `Under Corridor review`
  - `Pending Corridor signature`
  - `Completed`
  - `No Need`
- `MSA` / `Other Attachments` 可选状态包括：
  - `Under Corridor review`
  - `Pending Corridor signature`
  - `Completed`
- `Pricing Schedule` 在 Legal 阶段只允许：
  - `Under Corridor review`
  - `Completed`
- Legal 的状态更新必须进入时间线。

## 7. 测试验收场景

### 7.1 核心用例

1. `NDA` 从 `Not Started` 提交后变为 `Under our review`，Legal 队列可见，时间线新增提交记录。
2. Legal 将 `NDA` 更新为 `Under Corridor review`，FI 侧可看到退回状态和备注。
3. Legal 将 `NDA` 更新为 `No Need`，仅 `NDA` 可操作，`MSA` / `Other Attachments` 不出现该选项。
4. `MSA` 提交、Legal 更新为 `Pending Corridor signature`、再更新为 `Completed`，状态和时间线一致。
5. `Other Attachments` 提交时必须校验备注，附件可选但需正确展示。
6. `Pricing Schedule` 首次提交后进入 `Under FI supervisor review`。
7. `FI Supervisor` approve 后，`Pricing Schedule` 进入 `Under legal review`。
8. `Pricing Schedule` 被 Legal 退回后进入 `Under Corridor review`，由 `FIOP/FIBD` 跟进渠道反馈并更新材料。
9. 被退回的 `Pricing Schedule` 经 `FIOP/FIBD` 修改后再次提交，应直接回到 `Under legal review`。
10. 任一提交在接收方未处理前撤回，状态回滚，历史记录保留并标记 `revoked`。
11. Legal 最新终态决定撤回后，状态回到决定前，历史记录保留。
12. 法务卡片聚合状态随子项状态实时更新。
13. 外部渠道不需要登录或操作系统；所有渠道反馈、签署进度和补充材料都由 `FIOP/FIBD` 在系统内记录。

### 7.2 异常用例

1. 非授权角色不能提交材料或更新 Legal 状态。
2. `Completed` / `No Need` 后不能由 FI 直接重新提交。
3. `MSA` / `Other Attachments` 不能提交 `No Need`。
4. 缺少 contracting entity 时，不允许 `Send to Legal`。
5. 缺少 remarks 时，不允许 `Send to Legal`。
6. 附件上传失败或处理中时，不允许提交。
7. 历史记录不得因撤回被物理删除。
8. Pricing 未通过 `FI Supervisor` 时，不能直接进入 Legal 完成状态。

## 8. 对齐结论

- 本文档覆盖全部法务卡片子项：`NDA`、`MSA`、`Pricing Schedule`、`Other Attachments`。
- 状态展示文案沿用当前前端英文文案。
- `No Need` 仅适用于 `NDA`。
- `Pricing Schedule` 保留 `FI Supervisor` 审批阶段，不并入普通 Legal 文档流。
- 所有状态变化必须进入时间线。
- 撤回只能标记历史状态，不允许删除历史记录。
