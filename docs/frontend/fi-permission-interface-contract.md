# FI 权限接口契约说明

## 1. 目标

- 本文档面向后端、BFF、前端联调同学。
- 目标不是规定唯一 URL 或字段命名，而是明确前端必须拿到哪些“权限事实”。
- 若实际接口命名不同，只要语义一致即可。

## 2. 总原则

- `assignment` 是 `FIOP/FIBD` 可见性和可操作性的唯一事实来源。
- `FI_SUPERVISOR` 不受 assignment 限制。
- 前端权限控制至少分三层：
  - 列表数据过滤
  - 页面进入拦截
  - 页面内动作可执行性
- 不能只返回角色名而不返回具体权限事实，否则前端无法稳定处理页面拦截和直达链接。

## 3. 建议接口

| 能力 | 建议接口 | 用途 |
| --- | --- | --- |
| 查询当前 FI 全局权限 | `GET /me/fi-permissions` | 决定 `New Corridor`、`Approval Queue`、全局入口展示 |
| 查询 corridor 列表 | `GET /corridors` | 返回当前用户可见的 corridor 集合 |
| 查询 corridor assignment | `GET /corridors/{corridor_id}/assignment` | 决定 operator 是否命中 assignment |
| 更新 corridor assignment | `PUT /corridors/{corridor_id}/assignment` | 仅 supervisor 可调用 |

## 4. 前端至少需要的权限事实

### 4.1 全局权限上下文

建议 `GET /me/fi-permissions` 返回等价信息：

```json
{
  "currentUserRole": "FIOP",
  "visibleScope": "assigned_only",
  "canCreateCorridor": false,
  "canManageAssignments": false,
  "canAccessPricingApproval": false
}
```

字段语义：

- `currentUserRole`
  - 允许值：`FI_SUPERVISOR`、`FIOP`、`FIBD`
- `visibleScope`
  - `all`：当前用户可见全部 corridor
  - `assigned_only`：当前用户仅可见 assignment 命中的 corridor
- `canCreateCorridor`
  - 控制 `New Corridor` 入口与 `form` 页面
- `canManageAssignments`
  - 控制 dashboard 上 assignment 编辑入口与 `PUT assignment`
- `canAccessPricingApproval`
  - 控制 `Approval Queue` 入口与 approval 页面访问

### 4.2 Corridor 级权限上下文

对 detail、kyc、legal、pricing 这类带 corridor 上下文的页面，前端至少需要知道：

```json
{
  "corridorId": "COR-2026-001",
  "assignment": {
    "primaryFiopUserId": "user-fiop-alice",
    "primaryFibdUserId": "user-fibd-emma",
    "fiopCollaboratorUserIds": ["user-fiop-alice", "user-fiop-bob"],
    "fibdCollaboratorUserIds": ["user-fibd-emma"]
  },
  "fiPermissions": {
    "canAccessChannel": true,
    "canEditKyc": true,
    "canEditLegalPacket": true,
    "canEditPricing": true,
    "canSubmitPricing": true,
    "canReviewPricingApproval": false
  }
}
```

字段语义：

- `canAccessChannel`
  - 决定是否允许进入 `detail / kyc / legal / pricing`
- `canEditKyc`
  - 决定 KYC 页面是否可编辑、提交、补件
- `canEditLegalPacket`
  - 决定 Legal packet 是否可由 FI 侧编辑/发送
- `canEditPricing`
  - 决定 proposal 和 payment method 是否可编辑
- `canSubmitPricing`
  - 决定是否可从 pricing 提交
- `canReviewPricingApproval`
  - 决定是否可进入并操作 approval 页面

## 5. Assignment 契约要求

建议 `GET /corridors/{corridor_id}/assignment` 返回：

```json
{
  "primaryFiopUserId": "user-fiop-alice",
  "primaryFibdUserId": "user-fibd-emma",
  "fiopCollaboratorUserIds": ["user-fiop-alice", "user-fiop-bob"],
  "fibdCollaboratorUserIds": ["user-fibd-emma"],
  "updatedAt": "2026-04-20T10:00:00Z",
  "updatedByUserId": "user-fi-supervisor-ivy"
}
```

约束：

- 仅 `FI_SUPERVISOR` 可更新 assignment。
- 每条 corridor 必须有 `primaryFiopUserId` 和 `primaryFibdUserId`。
- primary owner 自动纳入 collaborator。
- 保存后权限立即生效。

## 6. 前端消费规则

### 6.1 列表页

- `GET /corridors` 最好直接返回当前用户可见的数据集合。
- 前端仍应保留基于 assignment/权限事实的二次保护，防止缓存或本地状态残留。

### 6.2 页面拦截

- 打开 `detail / kyc / legal / pricing` 前，必须先确认 `canAccessChannel`。
- 打开 `form` 前，必须先确认 `canCreateCorridor`。
- 打开 `pricing approval workspace/detail` 前，必须先确认 `canAccessPricingApproval` 或 `canReviewPricingApproval`。

### 6.3 动作拦截

- 即使页面已打开，点击 `Save`、`Submit`、`Approve` 前仍要校验细项权限。
- 若 assignment 在当前会话中被移除，前端应立即清空当前 corridor 上下文并退回允许页面。

## 7. 错误处理约定

建议后端/BFF 在权限不足时返回稳定错误码，前端统一处理：

- `FORBIDDEN_ROLE`
  - 角色本身不允许，例如 operator 打开 approval 页面
- `FORBIDDEN_ASSIGNMENT_SCOPE`
  - 当前 operator 不在 corridor assignment 中
- `ASSIGNMENT_NOT_FOUND`
  - corridor 缺失 assignment 信息

前端处理建议：

- 页面加载阶段遇到权限错误：退回 detail 或 dashboard，并提示“当前角色无权访问该页面”。
- 动作提交阶段遇到权限错误：保留当前页面，提示“当前角色无权执行该操作”，并刷新权限上下文。

## 8. 联调验收

联调时至少验证以下场景：

1. `FI_SUPERVISOR` 调 `GET /corridors` 返回全部 corridor。
2. `FIOP/FIBD` 调 `GET /corridors` 仅返回 assignment 命中的 corridor。
3. operator 命中 assignment 时，可进入 `detail / kyc / legal / pricing`。
4. operator 未命中 assignment 时，相关页面和写接口均被拒绝。
5. operator 永远不能进入 `pricing approval workspace/detail`。
6. assignment 更新后，无需重新登录即可看到权限变化。
