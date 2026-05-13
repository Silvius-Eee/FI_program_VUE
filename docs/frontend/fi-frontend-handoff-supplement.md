# FI 前端交付补充说明

## 1. 说明

- 本文档是 [../backend/fi-role-responsibility-spec.md](../backend/fi-role-responsibility-spec.md) 的前端落地补充，不改动后端权限定义。
- 交付对象是中文开发团队，目标是让前端、后端、测试对 `FI_SUPERVISOR`、`FIOP`、`FIBD` 三类角色的页面行为有统一口径。
- 当前 Vue 仓库只用于表达交互与页面关系，不作为开发直接复用代码。

## 2. 角色一句话定义

- `FI_SUPERVISOR`：FI 管理角色，可查看全部 corridor、维护 assignment、创建 corridor，并承担 pricing approval 审批职责。
- `FIOP`：FI operator，只能处理 assignment 命中的 corridor，可做 FI 侧录入、提交、补件和 pricing proposal 编辑/提交。
- `FIBD`：FI operator，权限结果与 `FIOP` 一致，只在业务身份和 owner 字段上区分，不单独拆权限。

必须明确给开发的一句话：

> `FIOP` 和 `FIBD` 当前是同级 operator，权限不拆分；真正有权限差异的是 `FI_SUPERVISOR` 与 `FIOP/FIBD`。

## 3. 权限总表

| 权限层 | `FI_SUPERVISOR` | `FIOP` | `FIBD` |
| --- | --- | --- | --- |
| 数据范围 | 全部 corridor | assignment 命中的 corridor | assignment 命中的 corridor |
| 创建 corridor | Y | N | N |
| 维护 assignment | Y | N | N |
| 查看 assignment | Y | Y | Y |
| 进入 `dashboard` | Y | Y | Y |
| 进入 `detail` | Y | 仅 assigned corridor | 仅 assigned corridor |
| 进入 `form` | Y | N | N |
| 进入 `kyc submit / kyc hub submit` | Y | 仅 assigned corridor | 仅 assigned corridor |
| 进入 `legal detail` | Y | 仅 assigned corridor | 仅 assigned corridor |
| 进入 `pricing` | Y | 仅 assigned corridor | 仅 assigned corridor |
| 进入 `pricing approval workspace/detail` | Y | N | N |
| 编辑/提交 KYC | Y | 仅 assigned corridor | 仅 assigned corridor |
| 编辑/提交 Legal packet | Y | 仅 assigned corridor | 仅 assigned corridor |
| 编辑/提交 Pricing proposal | Y | 仅 assigned corridor | 仅 assigned corridor |
| Pricing approval 审批 | Y | N | N |

## 4. 页面权限地图

页面按页面讲，不按组件讲。每页都只回答 4 个问题：谁能看到入口、谁能进入页面、谁能编辑/提交、无权限时前端怎么处理。

### 4.1 `dashboard`

- 入口可见：
  - 三类角色都能进入 dashboard。
  - `New Corridor` 只给 `FI_SUPERVISOR`。
  - `Approval Queue` 只给 `FI_SUPERVISOR`。
  - `Filter`、视图切换、导出对三类角色都可见。
- 页面进入：
  - 三类角色都能进入。
  - `FI_SUPERVISOR` 看全部 corridor。
  - `FIOP/FIBD` 仅看 assignment 命中的 corridor。
- 编辑/提交：
  - 仅 `FI_SUPERVISOR` 可从 dashboard 发起新建 corridor 和修改 assignment。
- 无权限处理：
  - 非 `FI_SUPERVISOR` 不展示 `New Corridor`、`Approval Queue`、assignment 编辑入口。
  - 列表数据必须后端过滤或前端基于 assignment 二次过滤，不能只靠按钮隐藏。

### 4.2 `detail`

- 入口可见：
  - 三类角色都能从 dashboard 行点击进入 detail。
- 页面进入：
  - `FI_SUPERVISOR` 可进入任意 corridor 的 detail。
  - `FIOP/FIBD` 只能进入 assigned corridor 的 detail。
- 编辑/提交：
  - `FI_SUPERVISOR`、assigned 的 `FIOP/FIBD` 可编辑 FI 侧内容。
  - 未命中的 operator 不允许编辑，也不允许进入详情页。
- 无权限处理：
  - 未命中 assignment 的 operator 打开 detail 时，前端应重定向回 dashboard 或当前允许页面。
  - 已打开 detail 后若 assignment 被移除，应立即失去访问权限并返回 dashboard。

### 4.3 `form`

- 入口可见：
  - 只有 `FI_SUPERVISOR` 可见 `New Corridor` 按钮。
- 页面进入：
  - 只有 `FI_SUPERVISOR` 可进入新建页。
- 编辑/提交：
  - 只有 `FI_SUPERVISOR` 可创建 corridor。
- 无权限处理：
  - `FIOP/FIBD` 即使通过异常跳转打开 `form`，也要被页面级拦截并退回 dashboard。

### 4.4 `kyc submit / kyc hub submit`

- 入口可见：
  - `FI_SUPERVISOR` 和 assigned 的 `FIOP/FIBD` 可从 detail 或 workflow 卡片进入。
- 页面进入：
  - `FI_SUPERVISOR` 可进入任意 corridor 的 KYC 页面。
  - `FIOP/FIBD` 仅能进入 assigned corridor 的 KYC 页面。
- 编辑/提交：
  - `FI_SUPERVISOR` 和 assigned 的 `FIOP/FIBD` 可编辑、提交和补件。
- 无权限处理：
  - 非法进入时退回 detail 或 dashboard。
  - 不能只把提交按钮禁用，页面入口和页面进入都要拦截。

### 4.5 `legal detail`

- 入口可见：
  - `FI_SUPERVISOR` 和 assigned 的 `FIOP/FIBD` 可从 detail/流程面板进入 FI 侧 legal detail。
- 页面进入：
  - `FI_SUPERVISOR` 可进入任意 corridor。
  - `FIOP/FIBD` 仅能进入 assigned corridor。
- 编辑/提交：
  - `FI_SUPERVISOR` 和 assigned 的 `FIOP/FIBD` 可发送或更新 Legal packet。
  - Legal reviewer 自己的状态操作另按 Legal 文档处理，不在本文重点内。
- 无权限处理：
  - 非法进入时退回 detail 或 dashboard。
  - FI 侧操作区不允许只做按钮隐藏，必须在页面加载时校验 corridor 访问权。

### 4.6 `pricing`

- 入口可见：
  - `FI_SUPERVISOR` 和 assigned 的 `FIOP/FIBD` 可从 detail 进入 pricing。
- 页面进入：
  - `FI_SUPERVISOR` 可进入任意 corridor 的 pricing。
  - `FIOP/FIBD` 仅能进入 assigned corridor 的 pricing。
- 编辑/提交：
  - `FI_SUPERVISOR` 和 assigned 的 `FIOP/FIBD` 可编辑 proposal、payment method、remark，并提交 proposal。
- 无权限处理：
  - 非法进入时退回 detail 或 dashboard。
  - 未授权用户不允许看到可提交、可保存的状态。

### 4.7 `pricing approval workspace/detail`

- 入口可见：
  - 只有 `FI_SUPERVISOR` 在 dashboard 看得到 `Approval Queue`。
- 页面进入：
  - 只有 `FI_SUPERVISOR` 可进入 `pricing approval workspace` 和 `pricing approval detail`。
- 编辑/提交：
  - 只有 `FI_SUPERVISOR` 可执行 approve、request changes 等审批动作。
- 无权限处理：
  - `FIOP/FIBD` 即使直接跳转，也要被页面级拦截并退回 detail 或 dashboard。

## 5. 页面内控件权限

| 页面 | 控件/动作 | `FI_SUPERVISOR` | `FIOP`/`FIBD` | 备注 |
| --- | --- | --- | --- | --- |
| `dashboard` | `New Corridor` | 显示并可点 | 不显示 | 不用 disabled 态，直接不展示 |
| `dashboard` | `Approval Queue` | 显示并可点 | 不显示 | 仅 supervisor 有审批入口 |
| `dashboard` | FIOP/FIBD assignment 编辑 | 显示并可点 | 不显示 | 仅 supervisor 能改 assignment |
| `dashboard` | 列表行点击 | 全部 corridor 可点 | 仅 assigned 可点 | 数据层也要过滤 |
| `detail` | Edit/Save | 可点 | assigned 可点 | 未分配 operator 不可进此页 |
| `form` | Create New Corridor | 可点 | 不可进入 | 页面级拦截 |
| `kyc submit` | Submit / Resubmit | 可点 | assigned 可点 | 必须结合 corridor 权限 |
| `legal detail` | Send to Legal | 可点 | assigned 可点 | Legal reviewer 操作另算 |
| `pricing` | Save / Submit for Review | 可点 | assigned 可点 | operator 可编辑 proposal |
| `pricing approval` | Approve / Request changes | 可点 | 不可进入 | 只允许 supervisor |

## 6. 接口依赖

前端不要靠“隐藏按钮”做权限，必须依赖后端/BFF 返回的权限事实。

最少需要以下接口或等价能力：

- `GET /me/fi-permissions`
- `GET /corridors`
- `GET /corridors/{corridor_id}/assignment`
- `PUT /corridors/{corridor_id}/assignment`

对应详细字段和示例见 [fi-permission-interface-contract.md](./fi-permission-interface-contract.md)。

## 7. 验收用例

### 7.1 `FI_SUPERVISOR`

1. 可查看全部 corridor。
2. 可看到并点击 `New Corridor`。
3. 可进入 `form` 并创建 corridor。
4. 可打开并保存 assignment。
5. 可进入 `pricing approval workspace/detail`。
6. 可对任意 corridor 执行 KYC、Legal、Pricing 操作。

### 7.2 `FIOP`

1. 只能看到 assignment 命中的 corridor。
2. 能进入 assigned corridor 的 `detail / kyc submit / legal detail / pricing`。
3. 看不到 `New Corridor`。
4. 不能进入 `form`。
5. 看不到 `Approval Queue`，也不能进入 `pricing approval workspace/detail`。
6. 不能更新 assignment。

### 7.3 `FIBD`

1. 权限结果与 `FIOP` 一致。
2. 只能看到 assignment 命中的 corridor。
3. 只能操作 assigned corridor 的 FI 侧内容。
4. 不能进入 `form`。
5. 不能进入 `pricing approval workspace/detail`。
6. 不能更新 assignment。

### 7.4 Assignment 联动

1. 当 `FIOP/FIBD` 被加入 assignment 后，应立即看到对应 corridor。
2. 当 `FIOP/FIBD` 被移出 assignment 后，应立即失去列表与详情访问权。
3. primary owner 自动加入 collaborator。
4. `FI_SUPERVISOR` 始终不受 assignment 影响。
5. 页面级拦截必须存在，不能只靠按钮隐藏。

## 8. 原型说明与例外说明

- 当前仓库用于表达页面结构、交互关系和角色差异，不作为开发直接复用代码。
- 权限真值以 [../backend/fi-role-responsibility-spec.md](../backend/fi-role-responsibility-spec.md) 和 [fi-permission-interface-contract.md](./fi-permission-interface-contract.md) 为准。
- 当前原型允许适度保留展示性实现，但不允许覆盖权限口径。
- 历史上原型里出现过 `canCreateChannel()` 放开给 `FIOP/FIBD` 的情况，这种与文档不一致的实现不能交给开发当规则；以本文和后端权限文档为准。

## 9. 截图标注清单

截图和标注文件放在 `./assets/`，当前已生成以下交付组：

1. Dashboard / `FI_SUPERVISOR`
   - 原图：`assets/dashboard-fi-supervisor.png`
   - 标注：`assets/dashboard-fi-supervisor.svg`
2. Dashboard / `FIOP`
   - 原图：`assets/dashboard-fiop.png`
   - 标注：`assets/dashboard-fiop.svg`
3. Corridor Detail / assigned operator
   - 原图：`assets/detail-fiop-assigned.png`
   - 标注：`assets/detail-fiop-assigned.svg`
4. Form / `FI_SUPERVISOR`
   - 原图：`assets/form-fi-supervisor.png`
   - 标注：`assets/form-fi-supervisor.svg`
5. KYC / assigned operator
   - 原图：`assets/kyc-fiop-assigned.png`
   - 标注：`assets/kyc-fiop-assigned.svg`
6. Legal / assigned operator
   - 原图：`assets/legal-fiop-assigned.png`
   - 标注：`assets/legal-fiop-assigned.svg`
7. Pricing / assigned operator
   - 原图：`assets/pricing-fiop-assigned.png`
   - 标注：`assets/pricing-fiop-assigned.svg`
8. Pricing Approval / `FI_SUPERVISOR`
   - 原图：`assets/pricing-approval-fi-supervisor.png`
   - 标注：`assets/pricing-approval-fi-supervisor.svg`
