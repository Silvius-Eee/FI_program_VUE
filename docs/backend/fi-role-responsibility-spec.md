# FI 项目 FI 侧角色权限区分开发需求文档

## 1. 文档目标

本文档基于当前项目代码实现，重新整理 `FI_SUPERVISOR`、`FIOP`、`FIBD` 三个 FI 侧角色的权限规则，用于：

- 前后端联调时统一权限口径
- 后端/BFF 设计权限字段与 assignment 接口
- 后续重构时把页面里的隐式判断沉淀为正式规则

本文档只聚焦 FI 侧三个角色，不展开 `COMPLIANCE`、`LEGAL`、`TECH`、`FUND` 的完整权限模型。

## 2. 当前项目中的权限判断基线

当前代码里，FI 侧角色权限主要由以下几个判断控制：

### 2.1 当前用户角色

用户角色来源于 `currentUserRole`，FI 侧包含：

- `FI_SUPERVISOR`
- `FIOP`
- `FIBD`

其中：

- `FI_SUPERVISOR` 在页面上显示为 `FI Supervisor`
- `FIOP` 和 `FIBD` 在页面上统一显示为 `FI`

### 2.2 `visibleChannels`

当前 dashboard 数据范围规则：

- `FI_SUPERVISOR`：可见全部 corridor
- `FIOP/FIBD`：只可见 assignment 命中的 corridor

### 2.3 `canCreateChannel()`

当前代码中，以下角色都允许创建 corridor：

- `FI_SUPERVISOR`
- `FIOP`
- `FIBD`

这意味着当前项目里，“新建 corridor”不是 supervisor 独占功能。

### 2.4 `canManageAssignments()`

当前代码中，只有 `FI_SUPERVISOR` 可以管理 assignment。

### 2.5 `canAccessChannel(channel)`

当前 corridor 访问规则：

- `FI_SUPERVISOR`：可访问任意 corridor
- `FIOP/FIBD`：仅可访问 assignment 命中的 corridor

### 2.6 `canOperateFiWork(channel)`

当前 FI 侧编辑规则：

- `FI_SUPERVISOR`：可操作任意 corridor 的 FI 侧内容
- `FIOP/FIBD`：仅可操作 assignment 命中的 corridor 的 FI 侧内容

这套规则直接影响：

- Corridor Detail 区块编辑
- KYC submit / supplement
- Legal packet 维护
- Pricing proposal 维护
- FIOP Tracking 编辑

## 3. 当前项目中的三类角色定义

### 3.1 `FI_SUPERVISOR`

当前项目中的 supervisor 角色具备两类能力：

#### 1) 全局管理能力

- 可见全部 corridor
- 可管理 assignment
- 可进入 `Pricing approval workspace`
- 可进入 `Pricing approval detail`

#### 2) 普通 FI 侧操作能力

- 也具备所有普通 FI operator 的 corridor 录入和编辑能力
- 可以对任意 corridor 执行 KYC、Legal、Pricing、Corridor Detail 编辑动作

### 3.2 `FIOP`

- 只能看到自己被 assignment 覆盖的 corridor
- 可以编辑这些 corridor 的 FI 侧内容
- 不能管理 assignment
- 不能进入 supervisor 专属 pricing approval 页面

### 3.3 `FIBD`

当前代码中，`FIBD` 的权限口径与 `FIOP` 完全一致：

- 只能看到自己被 assignment 覆盖的 corridor
- 可以编辑这些 corridor 的 FI 侧内容
- 不能管理 assignment
- 不能进入 supervisor 专属 pricing approval 页面

说明：

- 当前项目中，`FIOP` 和 `FIBD` 只在业务身份和 owner 字段上区分
- 在页面权限和按钮权限上，二者没有细粒度差异

## 4. 角色权限总表

| 权限项 | `FI_SUPERVISOR` | `FIOP` | `FIBD` |
| --- | --- | --- | --- |
| 查看全部 corridor | Y | N | N |
| 查看 assignment 命中的 corridor | Y | Y | Y |
| 创建 corridor | Y | Y | Y |
| 管理 assignment | Y | N | N |
| 进入 corridor detail | Y | 仅已分配 corridor | 仅已分配 corridor |
| 编辑 corridor detail 区块 | Y | 仅已分配 corridor | 仅已分配 corridor |
| 进入 KYC submit | Y | 仅已分配 corridor | 仅已分配 corridor |
| 进入 Legal detail | Y | 仅已分配 corridor | 仅已分配 corridor |
| 进入 Pricing | Y | 仅已分配 corridor | 仅已分配 corridor |
| 提交 Pricing 进入 review | Y | 仅已分配 corridor | 仅已分配 corridor |
| 进入 Pricing approval workspace | Y | N | N |
| 进入 Pricing approval detail | Y | N | N |
| 执行 Pricing approval | Y | N | N |

## 5. 页面级权限规则

### 5.1 Dashboard

当前项目中，三类 FI 角色都可以进入 dashboard。

#### `FI_SUPERVISOR`

- 可看到全部 corridor
- 可在 corridor view 中打开 assignment drawer
- 可使用 FIOP/FIBD assignment 批量分配能力
- 可看到并进入 pricing approval 工作台入口
- 可创建新 corridor

#### `FIOP/FIBD`

- 只能看到 assignment 命中的 corridor
- 不能打开 assignment drawer
- 不能进入 pricing approval 工作台
- 可以创建新 corridor

说明：

- dashboard 中的数据范围并不是按页面类型区分，而是统一复用 `visibleChannels`
- 因此 corridor view 和 matrix view 都继承同一套数据权限

### 5.2 New Corridor Form

当前项目中，`form` 页面对三类 FI 角色都开放。

#### 允许进入的角色

- `FI_SUPERVISOR`
- `FIOP`
- `FIBD`

#### 当前项目中的创建后默认 assignment 行为

创建 corridor 时，assignment 会根据创建人角色自动初始化：

##### 如果创建人是 `FIOP`

```json
{
  "primaryFiopUserId": "当前用户",
  "primaryFibdUserId": null,
  "fiopCollaboratorUserIds": ["当前用户"],
  "fibdCollaboratorUserIds": []
}
```

##### 如果创建人是 `FIBD`

```json
{
  "primaryFiopUserId": null,
  "primaryFibdUserId": "当前用户",
  "fiopCollaboratorUserIds": [],
  "fibdCollaboratorUserIds": ["当前用户"]
}
```

##### 如果创建人是 `FI_SUPERVISOR`

```json
{
  "primaryFiopUserId": null,
  "primaryFibdUserId": null,
  "fiopCollaboratorUserIds": [],
  "fibdCollaboratorUserIds": []
}
```

开发含义：

- `FIOP/FIBD` 创建 corridor 后，会自动拿到该 corridor 的访问权
- `FI_SUPERVISOR` 创建 corridor 后，因为本身不受 assignment 限制，所以仍然可访问该 corridor

### 5.3 Corridor Detail

当前项目中，`corridor detail` 是 FI 侧最核心的编辑页面。

进入 detail 的规则如下：

- `FI_SUPERVISOR`：可进入任意 corridor detail
- `FIOP/FIBD`：仅可进入 assignment 命中的 corridor detail

如果当前用户已经失去该 corridor 权限，系统应：

- 清空当前 `selectedChannel`
- 清空相关 detail 上下文
- 回退到 `dashboard`

### 5.4 Corridor Detail 可编辑区块

当前 `ChannelDetail.vue` 中，FI 侧可编辑的区块包括：

- `Corridor Profile`
- `Pricing`
- `Capability`
- `Dispute SOP`
- `Reconciliation`
- `Tax Configuration`
- `Merchant Onboarding Flow`
- `FIOP Tracking`

此外还有一个总览入口区块：

- `Go-live Management`

#### 编辑规则

只要 `canOperateFiWork(channel)` 为真，该用户就可以编辑这些区块。

因此：

- `FI_SUPERVISOR` 可编辑任意 corridor 的上述区块
- `FIOP/FIBD` 仅可编辑 assignment 命中的 corridor 的上述区块

特别说明：

- `FIOP Tracking` 虽然名称上指向 FIOP，但当前代码并没有限制“只有 FIOP 可编辑”
- 当前实际行为是：`FI_SUPERVISOR`、被分配的 `FIOP`、被分配的 `FIBD` 都可以编辑该区块

### 5.5 Go-live Management

当前项目在 corridor detail 顶部提供 `Go-live Management` 入口，用来跳转 KYC、Legal、Tech 等工作流。

规则如下：

- `FI_SUPERVISOR`：可对任意 corridor 使用这些入口
- `FIOP/FIBD`：仅可对 assignment 命中的 corridor 使用这些入口
- 无权限时，页面会提示只有 assigned FIOP/FIBD 或 FI Supervisor 才能操作该 workflow

## 6. 业务模块权限

### 6.1 KYC Submit / KYC Hub

当前项目中，FI 侧通过 `openKycSubmit` / `KycHubPage` 进入 KYC 提交和补件流程。

#### `FI_SUPERVISOR`

- 可对任意 corridor 的 KYC track 发起提交或补件

#### `FIOP/FIBD`

- 仅可操作 assignment 命中的 corridor 的 KYC

说明：

- 当前代码中，`FIOP` 与 `FIBD` 在 KYC submit 上没有额外差异

### 6.2 Legal Detail

当前项目中，FI 侧通过 `openLegalDetail` 进入 unified legal workbench，维护：

- `NDA`
- `MSA`
- `Other Attachments`
- 与 pricing legal 同步相关的内容

#### `FI_SUPERVISOR`

- 可进入任意 corridor 的 legal detail
- 可维护任意 corridor 的 FI 侧 legal packet

#### `FIOP/FIBD`

- 仅可进入 assignment 命中的 corridor 的 legal detail
- 仅可维护 assignment 命中的 corridor 的 FI 侧 legal packet

### 6.3 Pricing

当前项目中的 `PricingManagementPage` 是 FI 侧维护报价单和 payment method 的页面。

FI 侧在该页面可以：

- 创建 / 选择 pricing proposal
- 编辑 proposal
- 编辑 payment methods
- 提交 pricing schedule 进入 review
- 在可撤回时撤回 send

#### `FI_SUPERVISOR`

- 可维护任意 corridor 的 pricing proposal
- 可提交任意 corridor 的 pricing proposal

#### `FIOP/FIBD`

- 仅可维护 assignment 命中的 corridor 的 pricing proposal
- 仅可提交 assignment 命中的 corridor 的 pricing proposal

说明：

- 当前项目中，`FIOP` 与 `FIBD` 的 pricing 编辑权限完全一致

### 6.4 Pricing Approval

当前项目中，Pricing 审批被拆成两个 supervisor 专属页面：

- `PricingApprovalWorkspace`
- `PricingApprovalDetailPage`

#### `FI_SUPERVISOR`

- 可以进入审批工作台
- 可以查看待审批、退回、已审批报价单
- 可以在 detail 页面执行 pricing approval 动作

#### `FIOP/FIBD`

- 不可进入 `PricingApprovalWorkspace`
- 不可进入 `PricingApprovalDetailPage`
- 不可执行 pricing approval 动作

这是当前 FI 三角色差异中最明确、最刚性的权限边界。

## 7. Assignment 规则

assignment 是当前项目里 FI 侧权限控制的唯一正式来源。

### 7.1 数据结构

```json
{
  "primaryFiopUserId": "user-fiop-alice",
  "primaryFibdUserId": "user-fibd-emma",
  "fiopCollaboratorUserIds": ["user-fiop-alice", "user-fiop-bob"],
  "fibdCollaboratorUserIds": ["user-fibd-emma"],
  "updatedAt": "2026-04-20 10:00:00",
  "updatedByUserId": "user-fi-supervisor-ivy"
}
```

### 7.2 当前项目中的有效命中条件

对于 `FIOP/FIBD`，满足以下任一条件，即视为该 corridor 的有权限用户：

- 命中 `primaryFiopUserId`
- 命中 `primaryFibdUserId`
- 命中 `fiopCollaboratorUserIds`
- 命中 `fibdCollaboratorUserIds`

对于 `FI_SUPERVISOR`：

- 永远不依赖 assignment

### 7.3 当前项目中的 assignment 管理行为

当前 assignment 管理发生在 Dashboard 的 corridor 视图中：

- 只有 `FI_SUPERVISOR` 能打开 assignment drawer
- drawer 分 `Assign FIOP` 和 `Assign FIBD` 两种入口
- 支持选择一个或多个 corridor 批量修改
- 支持按当前 primary owner 过滤目标 corridor
- 保存时会自动把 primary owner 加入 collaborator

### 7.4 更新后的联动要求

assignment 更新后，以下能力必须立即同步：

- corridor 列表可见性
- corridor detail 访问权
- KYC submit 访问权
- legal detail 访问权
- pricing 编辑权

## 8. 前后端实现要求

### 8.1 必须沉淀的权限事实

后端或 BFF 至少需要向前端返回以下 FI 侧权限事实：

```json
{
  "current_user_role": "FIOP",
  "can_create_channel": true,
  "can_manage_assignments": false,
  "can_access_pricing_approval": false,
  "can_access_channel": true,
  "can_operate_fi_work": true,
  "channel_assignment": {
    "primaryFiopUserId": "user-fiop-alice",
    "primaryFibdUserId": "user-fibd-emma",
    "fiopCollaboratorUserIds": ["user-fiop-alice", "user-fiop-bob"],
    "fibdCollaboratorUserIds": ["user-fibd-emma"],
    "updatedAt": "2026-04-20 10:00:00",
    "updatedByUserId": "user-fi-supervisor-ivy"
  }
}
```

### 8.2 列表接口要求

`GET /corridors`

返回口径：

- `FI_SUPERVISOR` 返回全部 corridor
- `FIOP/FIBD` 只返回 assignment 命中的 corridor

### 8.3 assignment 接口要求

`GET /corridors/{corridor_id}/assignment`

返回：

- primary FIOP
- primary FIBD
- collaborator 列表
- 更新时间
- 更新人

`PUT /corridors/{corridor_id}/assignment`

规则：

- 仅 `FI_SUPERVISOR` 可调用
- primary owner 自动加入 collaborator
- 保存成功后，相关用户权限立即生效

### 8.4 corridor 级写接口要求

所有 corridor 级写接口都应统一校验：

- `FI_SUPERVISOR`：恒为允许
- `FIOP/FIBD`：必须命中 assignment

包括但不限于：

- corridor detail 保存接口
- KYC submit / supplement
- legal packet save
- pricing proposal save / submit
- FIOP Tracking save

### 8.5 页面权限要求

前端页面权限不能只依赖按钮隐藏。

必须同时满足：

- 页面入口处有角色校验
- 页面进入后仍有 corridor 上下文校验
- 权限失效时自动退出当前 corridor 上下文

## 9. 验收用例

### 9.1 `FI_SUPERVISOR`

1. 登录后可以看到全部 corridor。
2. 可以进入 `new corridor form`。
3. 可以打开 dashboard 中的 assignment drawer。
4. 可以批量修改多个 corridor 的 FIOP/FIBD owner。
5. 可以进入任意 corridor 的 detail、kyc submit、legal detail、pricing。
6. 可以进入 `pricing approval workspace` 和 `pricing approval detail`。

### 9.2 `FIOP`

1. 登录后只能看到 assignment 命中的 corridor。
2. 可以进入 `new corridor form`。
3. 自己创建 corridor 后，应自动成为该 corridor 的 primary FIOP 和 FIOP collaborator。
4. 可以进入自己被分配 corridor 的 detail。
5. 可以编辑自己被分配 corridor 下的：
   - Corridor Profile
   - Capability
   - Dispute SOP
   - Reconciliation
   - Tax Configuration
   - Merchant Onboarding Flow
   - FIOP Tracking
   - KYC submit
   - Legal detail
   - Pricing
6. 不能打开 assignment drawer。
7. 不能进入 `pricing approval workspace/detail`。

### 9.3 `FIBD`

1. 登录后只能看到 assignment 命中的 corridor。
2. 可以进入 `new corridor form`。
3. 自己创建 corridor 后，应自动成为该 corridor 的 primary FIBD 和 FIBD collaborator。
4. 页面进入规则与 `FIOP` 一致。
5. corridor 编辑能力与 `FIOP` 一致。
6. 不能打开 assignment drawer。
7. 不能进入 `pricing approval workspace/detail`。

### 9.4 assignment 联动

1. 给某个 `FIOP/FIBD` 加入 assignment 后，该用户应立即看到对应 corridor。
2. 把某个 `FIOP/FIBD` 从 assignment 中移除后，该用户应立即失去对应 corridor 的 detail / pricing / legal / kyc 访问权。
3. 保存 assignment 时，primary owner 自动写入 collaborator。
4. `FI_SUPERVISOR` 始终不受 assignment 影响。

### 9.5 页面拦截

1. `FIOP/FIBD` 强行进入 `pricing approval workspace/detail` 时必须被重定向。
2. `FIOP/FIBD` 强行进入未分配 corridor 的 detail 时必须被拦截并回退到 dashboard。
3. corridor 已失权时，如果用户仍停留在 `detail / pricing / legal detail / kyc submit`，页面应自动退出当前 corridor 上下文。

## 10. 结论

基于当前项目内容，FI 侧角色权限可以收敛为以下一句话：

- `FIOP` 和 `FIBD` 当前是同一权限层级的 FI operator，差异只体现在业务身份和 assignment 字段上
- `FI_SUPERVISOR` 在此基础上额外拥有 `管理 assignment` 和 `处理 Pricing approval` 的管理权限
- FI 侧所有 corridor 级页面和编辑动作，本质上都以 assignment 为权限前提，只有 `FI_SUPERVISOR` 不受该前提限制
