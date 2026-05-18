# src/components 文件夹说明

## 整体作用
存储可复用的 React 组件。这些组件不是完整的页面，而是用于构建页面的模块化组件。

## 核心文件

### 🔴 重要组件

**AuthModal.tsx** - ⭐ 认证弹窗（登录/注册）
- 支持三种模式：
  - `login` - 登录表单
  - `register` - 注册表单
  - `registerSuccess` - 注册成功显示
- 使用 Framer Motion 提供动画效果
- 包含完整的表单验证和错误提示
- 注册成功后显示 MuseLink ID 和复制按钮
- 适用于弹出式认证流程

**BGMGeneratorModal.tsx** - AI 背景音乐生成器
- 背景音乐相关 UI（占位 / 示例音频）
- 支持选择音乐风格和场景
- 生成完成后可预览和下载

**ProfileEditModal.tsx** - 用户资料编辑弹窗
- 编辑用户头像、昵称、简介等
- 图片上传预览
- 表单验证和提交

**SlideshowOverlay.tsx** - 幻灯片叠加层
- 全屏图片展示
- 支持前后翻页
- ESC 或点击关闭

## 组件特点

### 通用特性
- 所有组件都接收 `isOpen` 和 `onClose` props
- 使用 Tailwind CSS 构建样式，统一外观
- 支持暗色模式和响应式布局
- 集成 Lucide React 图标库

### 动画效果
- AuthModal 和其他弹窗使用 `motion/react` 库
- 进入/退出动画增强用户体验
- 背景使用 `backdrop-blur` 毛玻璃效果

## 使用示例

### AuthModal 使用
```jsx
const [isAuthOpen, setIsAuthOpen] = useState(false);

<AuthModal 
  isOpen={isAuthOpen}
  onClose={() => setIsAuthOpen(false)}
  onSuccess={() => {
    // 认证成功回调
    navigate("/home");
  }}
/>
```

### ProfileEditModal 使用
```jsx
const [isEditOpen, setIsEditOpen] = useState(false);

<ProfileEditModal
  isOpen={isEditOpen}
  onClose={() => setIsEditOpen(false)}
  onSave={(profile) => {
    // 保存用户资料
    updateUserProfile(profile);
  }}
/>
```

## 重要说明

### 为什么使用弹窗组件？

不同于页面路由方式，弹窗组件提供了：
- **无需跳转** - 用户留在当前页面
- **信息保留** - 后面的内容不会丢失
- **快速反馈** - 用户操作立即看到结果
- **灵活复用** - 同一组件可在不同页面使用

### 组件状态管理

所有弹窗都由父组件控制状态（Controlled Component）：
- `isOpen` - 弹窗是否显示
- `onClose` - 关闭回调
- `onSuccess` / `onSave` - 成功回调

这样做的好处是父组件完全控制弹窗的生命周期。

## 快速参考

| 组件 | 用途 | 位置 |
|------|------|------|
| AuthModal | 登录/注册 | 首页、App.tsx |
| ProfileEditModal | 编辑用户资料 | ProfilePage |
| BGMGeneratorModal | 生成背景音乐 | HomePage |
| SlideshowOverlay | 全屏图片查看 | HomePage |
