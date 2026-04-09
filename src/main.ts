import { createApp } from 'vue';
import { createPinia } from 'pinia';
import {
  Avatar,
  Breadcrumb,
  Button,
  Card,
  Cascader,
  Checkbox,
  Col,
  Collapse,
  ConfigProvider,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Layout,
  Menu,
  Modal,
  Popover,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Steps,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Upload,
} from 'ant-design-vue';
import App from './App.vue';
import 'ant-design-vue/dist/reset.css';
import './style.css';

const app = createApp(App);
const pinia = createPinia();

const antComponents = [
  Avatar,
  Breadcrumb,
  Button,
  Card,
  Cascader,
  Checkbox,
  Col,
  Collapse,
  ConfigProvider,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Layout,
  Menu,
  Modal,
  Popover,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Steps,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Upload,
];

app.use(pinia);
antComponents.forEach((component) => {
  app.use(component);
});

app.mount('#app');
