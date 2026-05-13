# FI 视图下 KYC / 合规审批流联动

## 1. 背景与目标

当前一个 `corridor` 下存在两条独立的 KYC track：

- `WooshPay onboarding`
- `Corridor onboarding`

FI 与 Compliance 围绕这两条 track 做提交、审批、退回补件、终态关闭与时间线追踪。当前前端已经改为在 `Dashboard/List` 中按两列分别展示两条 track 的状态，不再以聚合 `complianceStatus` 作为主展示字段。

本需求文档的目标是给后端提供一套可以直接落地的数据模型、状态机和接口能力，满足以下需求：

- 支持两条 KYC track 独立流转、独立审计、独立关闭
- 支持 `FI 提交/补件`、`Compliance 审批通过`、`Compliance 退回补件`、`Compliance 标记 no need`
- 支持 `FI 撤回未处理提交`、`Compliance 撤回最新终态`
- 支持 `Dashboard/List` 直接展示双列状态，并按两列分别筛选和排序
- 支持详情页、审批页、时间线展示使用同一套后端事实数据

## 2. 范围与非目标

### 2.1 范围

- FI 视图下 KYC / Compliance 双 track 审批流
- Dashboard/List 双列状态输出与查询
- Track 详情、提交版本、审批事件、时间线事件
- 历史兼容字段保留策略

### 2.2 非目标

- 本期不重做 `Legal / Pricing / Tech` 流程
- 本期不要求删除历史字段 `complianceStatus`
- 本期不要求统一其他模块的状态枚举
- 本期不强制指定数据库表名；后端可按现有服务/表结构命名规范实现

## 3. 角色与业务对象

### 3.1 角色

- `FIOP(FI)`：提交首版材料、补件、撤回未处理提交
- `Compliance`：审批通过、退回补件、标记 `NO_NEED`、撤回自己做出的最新终态决定

### 3.2 业务对象

#### Corridor

业务主对象。一个 `Corridor` 下固定包含两条 `KycTrack`：

- `WOOSHPAY`
- `CORRIDOR`

列表接口需要直接返回以下字段，供前端双列展示：

- `wooshpay_onboarding_status`
- `corridor_onboarding_status`

#### KycTrack

表示某一条独立审批 track。最少需要提供以下字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `track_type` | enum | `WOOSHPAY` / `CORRIDOR` |
| `status` | enum | 后端规范状态，见第 4 节 |
| `current_version` | integer | 当前最新提交版本号，从 `1` 开始 |
| `latest_submission` | object/null | 最新提交快照 |
| `latest_reviewer_note` | string/null | 最近一次 reviewer note，退回补件时必须可读 |
| `last_updated_at` | datetime | 当前 track 最近更新时间 |
| `last_updated_by` | string | 当前 track 最近更新人 |
| `pending_handoff` | object/null | 当前是否存在未被消费的待处理 handoff |

建议 `pending_handoff` 至少包含：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `is_active` | boolean | 是否仍未消费 |
| `source_status` | enum | 回滚时恢复到的上一个状态 |
| `origin_event_id` | string | 触发本次 handoff 的时间线事件 ID |
| `created_at` | datetime | handoff 创建时间 |
| `created_by` | string | handoff 创建人 |
| `sender_role` | enum | `FI` / `COMPLIANCE` |

#### SubmissionVersion

表示一次可追溯的提交版本。不同 track 的提交内容结构可以不同，但都必须能追溯以下元信息：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `version` | integer | 版本号 |
| `submitted_at` | datetime | 提交时间 |
| `submitted_by` | string | 提交人 |
| `payload` | object | 提交内容快照，track-specific |
| `attachments` | array | 附件列表 |
| `is_current` | boolean | 是否当前有效版本 |

#### TimelineEvent

表示所有可审计事件。所有提交、审批、退回、撤回都必须落时间线，不允许物理删除。

建议最少包含：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `event_id` | string | 事件唯一 ID |
| `corridor_id` | string | 所属 corridor |
| `track_type` | enum | `WOOSHPAY` / `CORRIDOR` |
| `event_type` | enum | `SUBMISSION` / `RESUBMISSION` / `APPROVAL` / `REQUEST_CHANGES` / `NO_NEED` / `REVOCATION` |
| `status_after_event` | enum | 事件发生后的状态 |
| `actor_role` | enum | `FI` / `COMPLIANCE` |
| `actor_name` | string | 操作人 |
| `remark` | string/null | 备注 / reviewer note / 撤回原因 |
| `created_at` | datetime | 事件时间 |
| `lifecycle_state` | enum | `ACTIVE` / `REVOKED` |
| `revoked_by` | string/null | 撤回人 |
| `revoked_at` | datetime/null | 撤回时间 |

## 4. 状态机与流转规则

### 4.1 后端规范状态枚举

后端应使用统一规范状态，不直接使用前端展示文案：

| 状态 | 含义 |
| --- | --- |
| `NOT_STARTED` | 尚未提交任何材料 |
| `PENDING_COMPLIANCE_REVIEW` | 已由 FI 提交，等待 Compliance 审核 |
| `PENDING_FI_SUPPLEMENT` | 已被 Compliance 退回，等待 FI 补件 |
| `APPROVED` | Compliance 已审批通过 |
| `NO_NEED` | Compliance 判定该 track 无需处理 |

### 4.2 单条 track 流转

每条 `KycTrack` 独立流转，互不影响：

1. `FI 首次提交/补件提交`  
   `NOT_STARTED` 或 `PENDING_FI_SUPPLEMENT` -> `PENDING_COMPLIANCE_REVIEW`

2. `Compliance 审批通过`  
   `PENDING_COMPLIANCE_REVIEW` -> `APPROVED`

3. `Compliance 退回补件`  
   `PENDING_COMPLIANCE_REVIEW` -> `PENDING_FI_SUPPLEMENT`

4. `Compliance 标记 no need`  
   `PENDING_COMPLIANCE_REVIEW` -> `NO_NEED`

### 4.3 撤回规则

#### FI 撤回未处理提交

- 仅允许 `FI` 撤回该 track 最新一次、且尚未被 Compliance 处理的提交
- 撤回后状态应回滚到该次提交前的状态
- 对应 `pending_handoff` 置空或标记为已失效
- 原提交事件不能删除，只能新增一条 `REVOCATION` 或将原事件 `lifecycle_state` 标记为 `REVOKED`

#### Compliance 撤回最新终态

- 仅允许 `Compliance` 撤回自己做出的该 track 最新终态决定
- 可撤回的终态为 `APPROVED` 或 `NO_NEED`
- 撤回后状态回滚到该次终态前的状态，通常为 `PENDING_COMPLIANCE_REVIEW`
- 原终态事件不能删除，只能保留痕迹并标记已撤回

### 4.4 审计要求

- 所有状态变更都必须生成 `TimelineEvent`
- 任一历史事件都不可物理删除
- 时间线必须支持还原当前状态的来龙去脉
- 同一 corridor 的两条 track 各自维护独立时间线，但可在前端按 corridor 汇总展示

## 5. 前端展示映射

后端规范状态与前端展示文案是两层概念。前端当前使用以下映射规则：

| Track | 后端规范状态 | 前端展示文案 | 当前前端内部状态键 |
| --- | --- | --- | --- |
| `WOOSHPAY` | `NOT_STARTED` | `Not Started` | `not_started` |
| `WOOSHPAY` | `PENDING_COMPLIANCE_REVIEW` | `WooshPay preparation` | `wooshpay_preparation` |
| `WOOSHPAY` | `PENDING_FI_SUPPLEMENT` | `Corridor reviewing` | `corridor_reviewing` |
| `WOOSHPAY` | `APPROVED` | `Completed` | `completed` |
| `WOOSHPAY` | `NO_NEED` | `No Need` | `no_need` |
| `CORRIDOR` | `NOT_STARTED` | `Not Started` | `not_started` |
| `CORRIDOR` | `PENDING_COMPLIANCE_REVIEW` | `WooshPay reviewing` | `wooshpay_reviewing` |
| `CORRIDOR` | `PENDING_FI_SUPPLEMENT` | `Corridor preparation` | `corridor_preparation` |
| `CORRIDOR` | `APPROVED` | `Completed` | `completed` |
| `CORRIDOR` | `NO_NEED` | `No Need` | `no_need` |

说明：

- 后端只需要输出规范状态枚举
- 前端负责把规范状态映射为当前页面文案
- Dashboard/List 主展示字段改为：
  - `wooshpay_onboarding_status`
  - `corridor_onboarding_status`
- 新前端不再依赖聚合 `complianceStatus` 决定 KYC 主展示

## 6. 接口 / 字段要求

以下为后端必须提供的能力。URL 可按现有服务命名规范调整，但字段语义必须保持一致。

### 6.1 Corridor 列表接口

建议能力：`GET /corridors`

必须支持返回：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `corridor_id` | string | 主键 |
| `channel_name` | string | 展示名称 |
| `wooshpay_onboarding_status` | enum | `WOOSHPAY` track 当前状态 |
| `corridor_onboarding_status` | enum | `CORRIDOR` track 当前状态 |
| `compliance_status` | enum/null | 兼容字段，可保留 |

必须支持查询能力：

- 按 `wooshpay_onboarding_status` 过滤
- 按 `corridor_onboarding_status` 过滤
- 按 `wooshpay_onboarding_status` 排序
- 按 `corridor_onboarding_status` 排序

建议查询参数：

| 参数 | 说明 |
| --- | --- |
| `wooshpay_onboarding_status` | 单值或多值过滤 |
| `corridor_onboarding_status` | 单值或多值过滤 |
| `sort_by` | `wooshpay_onboarding_status` / `corridor_onboarding_status` |
| `sort_order` | `asc` / `desc` |

### 6.2 KYC Track 详情接口

建议能力：`GET /corridors/{corridor_id}/kyc-tracks`

响应中应一次返回两条 track，或返回单条 track 列表。最少包含：

```json
{
  "corridor_id": "cr_001",
  "tracks": [
    {
      "track_type": "WOOSHPAY",
      "status": "PENDING_COMPLIANCE_REVIEW",
      "current_version": 2,
      "latest_submission": {
        "version": 2,
        "submitted_at": "2026-04-15T10:00:00Z",
        "submitted_by": "Alice",
        "payload": {},
        "attachments": []
      },
      "latest_reviewer_note": "Please supplement fallback settlement contact.",
      "last_updated_at": "2026-04-15T10:00:00Z",
      "last_updated_by": "Alice",
      "pending_handoff": {
        "is_active": true,
        "source_status": "PENDING_FI_SUPPLEMENT",
        "origin_event_id": "evt_123",
        "created_at": "2026-04-15T10:00:00Z",
        "created_by": "Alice",
        "sender_role": "FI"
      }
    }
  ]
}
```

### 6.3 时间线接口

建议能力：`GET /corridors/{corridor_id}/kyc-tracks/{track_type}/timeline`

必须支持返回该 track 全量事件，包含已撤回事件与撤回痕迹。

### 6.4 动作接口

建议动作能力如下：

#### 1) FI 提交 / 补件

`POST /corridors/{corridor_id}/kyc-tracks/{track_type}/submissions`

请求体最少包含：

```json
{
  "payload": {},
  "attachments": []
}
```

处理要求：

- 若当前状态为 `NOT_STARTED` 或 `PENDING_FI_SUPPLEMENT`，允许提交
- `current_version + 1`
- 状态更新为 `PENDING_COMPLIANCE_REVIEW`
- 创建 `SubmissionVersion`
- 创建 `TimelineEvent`
- 返回更新后的 track 与 corridor summary

#### 2) Compliance 审批通过

`POST /corridors/{corridor_id}/kyc-tracks/{track_type}/approve`

请求体建议：

```json
{
  "remark": "Approved"
}
```

处理要求：

- 当前状态必须为 `PENDING_COMPLIANCE_REVIEW`
- 更新状态为 `APPROVED`
- 创建时间线事件
- 返回更新后的 track 与 corridor summary

#### 3) Compliance 退回补件

`POST /corridors/{corridor_id}/kyc-tracks/{track_type}/request-supplement`

请求体最少包含：

```json
{
  "remark": "Please update fallback payout contact and escalation path."
}
```

处理要求：

- 当前状态必须为 `PENDING_COMPLIANCE_REVIEW`
- 更新状态为 `PENDING_FI_SUPPLEMENT`
- 更新 `latest_reviewer_note`
- 创建时间线事件
- 返回更新后的 track 与 corridor summary

#### 4) Compliance 标记 No Need

`POST /corridors/{corridor_id}/kyc-tracks/{track_type}/mark-no-need`

请求体建议：

```json
{
  "remark": "No compliance review needed for this track."
}
```

处理要求：

- 当前状态必须为 `PENDING_COMPLIANCE_REVIEW`
- 更新状态为 `NO_NEED`
- 创建时间线事件
- 返回更新后的 track 与 corridor summary

#### 5) FI 撤回未处理提交

`POST /corridors/{corridor_id}/kyc-tracks/{track_type}/revoke-latest-submission`

请求体建议：

```json
{
  "reason": "Submitted by mistake."
}
```

处理要求：

- 仅允许撤回最新且未被处理的提交
- 状态回滚到上一个状态
- 对应 handoff 标记为失效
- 创建撤回时间线事件或将原事件标记为 `REVOKED`
- 返回更新后的 track 与 corridor summary

#### 6) Compliance 撤回最新终态

`POST /corridors/{corridor_id}/kyc-tracks/{track_type}/revoke-latest-decision`

请求体建议：

```json
{
  "reason": "Restore to review state."
}
```

处理要求：

- 仅允许撤回最近一次由当前 reviewer 做出的 `APPROVED` / `NO_NEED`
- 状态回滚到该终态前的状态
- 创建撤回时间线事件或将原终态事件标记为 `REVOKED`
- 返回更新后的 track 与 corridor summary

## 7. Dashboard / List 联动要求

### 7.1 列表展示

Dashboard/List 中 KYC 相关展示拆为两列：

- `WooshPay onboarding`
- `Corridor onboarding`

每列独立读取各自 track 状态：

- `WooshPay onboarding` <- `wooshpay_onboarding_status`
- `Corridor onboarding` <- `corridor_onboarding_status`

### 7.2 列表筛选

前端需能按两列分别筛选，因此后端查询层必须支持：

- 仅按 `wooshpay_onboarding_status` 过滤
- 仅按 `corridor_onboarding_status` 过滤
- 两个条件组合过滤

### 7.3 列表排序

前端需能按两列分别排序，因此后端查询层必须支持：

- 以 `wooshpay_onboarding_status` 排序
- 以 `corridor_onboarding_status` 排序

## 8. 验收场景

1. 新建 corridor 后，两条 track 默认状态均为 `NOT_STARTED`，列表双列均显示 `Not Started`。

2. 仅提交 `WOOSHPAY` 时：
   - `wooshpay_onboarding_status` 更新为 `PENDING_COMPLIANCE_REVIEW`
   - `corridor_onboarding_status` 保持不变
   - 时间线新增 `WOOSHPAY` track 提交事件

3. Compliance 退回 `CORRIDOR` 补件时：
   - `corridor_onboarding_status` 更新为 `PENDING_FI_SUPPLEMENT`
   - `wooshpay_onboarding_status` 不受影响
   - `latest_reviewer_note` 可在详情页读取

4. 同一 corridor 下，一条 track 为 `APPROVED`、另一条为 `PENDING_FI_SUPPLEMENT` 时：
   - 列表双列分别展示
   - 不做聚合覆盖

5. FI 二次补件后：
   - `current_version + 1`
   - 新建一条 `SubmissionVersion`
   - 上一轮 handoff 标记为已消费或失效

6. FI 撤回未处理提交后：
   - 仅回滚对应 track
   - 历史提交事件仍保留
   - 列表和详情状态同步回滚

7. Compliance 撤回最新终态后：
   - 仅回滚对应 track
   - 终态事件保留且有撤回痕迹
   - 列表、详情、时间线一致

8. 老数据或旧页面仍读取 `complianceStatus` 时：
   - 不影响本期新接口字段输出
   - 不应阻塞双列方案上线

## 9. 兼容性要求

- `complianceStatus` 可以作为兼容字段保留，但不再作为 Dashboard/List 主展示字段
- 新前端主依赖字段为：
  - `wooshpay_onboarding_status`
  - `corridor_onboarding_status`
- 若现有后端已有聚合状态计算逻辑，可继续保留用于旧页面，但不能替代双列状态输出
- 若现有接口已支持某些动作，可复用现有 URL；但请求 / 响应语义需满足本文要求

## 10. 交付建议

建议把本文件作为正式需求文档发给后端，并在 Jira / 飞书任务中附上以下摘要：

> 需求核心：KYC / Compliance 流程改为双 track 独立模型，Dashboard/List 不再展示聚合 `complianceStatus`，而是分别展示 `wooshpay_onboarding_status` 和 `corridor_onboarding_status`。后端需提供双 track 状态、详情、动作接口、时间线和撤回能力，并保留 `complianceStatus` 作为兼容字段。

如果后端需要进一步细化，可以基于本文件继续补两份附录：

- Swagger / OpenAPI 示例
- 表结构 / 状态机时序图
