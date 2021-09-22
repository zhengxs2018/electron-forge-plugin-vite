# @zhengxs/electron-forge-plugin-vite

主进程使用 `rollup` 打包，渲染进程使用 `vite` 打包。

## 配置

- **mainRoot** - 主进程根路径，默认当前位置
  - **类型:** `string`
- **configFile** - 主进程 rollup 配置文件路径，相对于 **mainRoot**
  - **类型:** `string`
- **renderer** - 渲染进程配置
  - **类型:** `import('vite').InlineConfig`

## 待办事项

- [ ] 主应用代码修改自动重启 `electron`

## License

- MIT
