# FI 前端交付包

本目录用于给开发团队交付 FI 前端权限说明与原型参考，默认和 [../backend/fi-role-responsibility-spec.md](../backend/fi-role-responsibility-spec.md) 配套阅读。

## 文档清单

- [fi-approval-flow-dev-test-guide.md](./fi-approval-flow-dev-test-guide.md)
  - 面向开发和测试的审批流总览文档，统一覆盖 KYC、法务、资金和上线四段流程的入口、状态、门禁、联动和验收场景。
- [fi-frontend-handoff-supplement.md](./fi-frontend-handoff-supplement.md)
  - 面向前端开发的主交付文档，覆盖角色定义、权限总表、页面权限地图、控件权限、接口依赖、验收用例和原型说明。
- [fi-permission-interface-contract.md](./fi-permission-interface-contract.md)
  - 面向后端/BFF/联调同学的接口契约说明，明确必须返回的权限事实和前端消费方式。

## 截图标注

- 截图与标注文件放在 `./assets/`。
- `*.png` 为原始页面截图。
- `*.svg` 为带说明标注的交付图，可直接发给开发或贴到文档平台。

## 使用原则

- 当前 Vue 仓库用于表达页面结构、交互关系和角色差异，不作为开发直接复用的技术基线。
- 权限真值以 [../backend/fi-role-responsibility-spec.md](../backend/fi-role-responsibility-spec.md) 和接口契约为准。
- 如果页面表现和文档暂时不一致，以文档和接口契约为准，再回头修正原型。
