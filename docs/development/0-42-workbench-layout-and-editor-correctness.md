# Diplomat 0.42 Workbench Layout and Editor Correctness

> 基线：`main` 分支 `v0.41.0`
> 文档性质：修正版开发规范和阶段目标
> 最后更新：2026-06-21

## 1. 本轮结论

0.41 已经完成了工作台专业化的第一轮：删除冗余顶部信息区、引入右侧选项卡、增强预览控件、升级基础时间线，并在 Worker 侧增加句级字幕 cue 生成。

0.42 不再重复这些工作。本轮目标是继续把工作台从“页面式编辑器”推进到“成熟桌面生产力工具”的使用体验，优先解决以下问题：

1. 右侧选项卡仍不够像专业参数面板，字幕表格列信息优先级错误。
2. 视频预览仍由 `selectedLine` 驱动字幕覆盖层，播放时会显示错误字幕。
3. 时间线的拖动换算仍受可视宽度影响，缩放或横向滚动时不可靠。
4. 字幕编辑历史仍保存完整 `SubtitleDocument` 快照，长项目风险高。
5. 中文拆分和合并仍沿用英文空格逻辑。

## 2. 必须遵守的产品决策

以下是用户明确确认过的布局原则，优先级高于外部分析文档：

- 不新增左侧 `TranscriptPanel`。
- 不把完整字幕列表移到左侧。
- 工作台保持三大区：左侧/中左视频预览、右侧选项卡参数区、底部时间线。
- 右侧选项卡区域可以更宽，字幕列表保留在右侧的“字幕”选项卡中。
- 字幕列表不需要大改成交互复杂的卡片列表，先优化表格信息层级和列宽。
- 字幕表格主要展示：`ID / 原文 / 译文 / 开始 / 结束`。
- ID 是用户可读序号：`1, 2, 3...`，不直接显示内部 `line-1`。
- 开始和结束时间放在后面，因为它们应该主要通过自动化和时间线校准处理。
- 软件整体继续以浅色、白色、简约高级为主；视频监视器和时间线可以局部使用深色编辑表面。
- 系统设置通过右上角齿轮进入；项目设置保留在工作台右侧选项卡中。

## 3. 设计原则

### 3.1 工作台布局

目标布局：

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ 顶部应用栏：项目库 / 工作台 / 任务队列 / 本地运行时 / 系统设置齿轮        │
├──────────────────────────────────────────────┬─────────────────────────────┤
│ 视频监视器                                   │ 右侧选项卡参数区             │
│ Program Monitor                              │ Media / Project / ASR /      │
│                                              │ Translate / Subtitles /      │
│ 当前播放字幕覆盖层                           │ Style / Export               │
├──────────────────────────────────────────────┴─────────────────────────────┤
│ 命令栏：撤销 / 重做 / 拆分 / 合并 / 偏移 / 吸附 / 快捷操作                │
├────────────────────────────────────────────────────────────────────────────┤
│ 时间线：标尺 / 波形 / 字幕轨 / 播放头 / 缩放 / 横向滚动                  │
└────────────────────────────────────────────────────────────────────────────┘
```

默认尺寸建议：

- 右侧选项卡：默认 `420px`，可调整范围 `360px-560px`。
- 底部时间线：默认 `240px`，可调整范围 `160px-420px`。
- 顶部应用栏：保持紧凑，不新增大面积说明区。
- 视频区：拿到除右侧参数区和底部时间线以外的主要空间。

### 3.2 右侧选项卡

右侧选项卡是项目内设置与对象编辑区域，不是系统设置。

建议 tab：

- `媒体`：导入视频、当前媒体列表、使用/删除媒体。
- `项目`：当前项目级默认语言、字幕样式默认值、项目备注。
- `转写`：ASR 模型、设备、计算类型、提示词、开始/取消/重试。
- `翻译`：翻译模型、源语言、目标语言、术语表、翻译模式。
- `字幕`：完整字幕表格、筛选、搜索、当前字幕轻量编辑入口。
- `样式`：字幕预览样式、预设、应用样式。
- `导出`：SRT/VTT/ASS/烧录视频导出设置。

系统级模型目录、运行时、语言、快捷键、隐私、诊断等继续放在系统设置页面。

### 3.3 字幕表格

当前 `SubtitleGrid` 的问题不是“位置一定错误”，而是“列设计错误”：

- 840px 最小宽度不适合右侧参数区。
- `ID` 过宽且显示内部 ID。
- `开始 / 结束` 过早占据核心空间。
- `review / status` 独立列使原文和译文空间被压缩。

目标：

```text
┌────┬──────────────────────┬──────────────────────┬──────────┬──────────┐
│ ID │ 原文                 │ 译文                 │ 开始     │ 结束     │
├────┼──────────────────────┼──────────────────────┼──────────┼──────────┤
│ 1  │ Hello, everyone...   │ 大家好，今天...      │ 00:00.0  │ 00:04.2  │
│ 2  │ The next section...  │ 下一部分...          │ 00:04.2  │ 00:08.8  │
└────┴──────────────────────┴──────────────────────┴──────────┴──────────┘
```

细节：

- ID 列宽约 `40-48px`。
- 原文和译文是主列，占据剩余空间。
- 开始和结束放在最后，约 `72-88px`。
- 状态、审核、缺失译文、时间问题改成行内 badge，不再占用独立宽列。
- 内部 `line.id` 继续保留在数据层，只在 UI 层显示顺序号。
- 支持筛选后仍显示原始全局序号，避免用户在筛选前后混淆。
- 行高可以略高于当前 40px，但必须保持密集可扫读。

## 4. P0 修复清单

### P0-1 右侧字幕表格和面板宽度

主要文件：

- `apps/web/src/components/SubtitleGrid.tsx`
- `apps/web/src/components/SubtitleGrid.test.tsx`
- `apps/web/src/state/uiStore.ts`
- `apps/web/src/state/uiStore.test.ts`
- `apps/web/src/pages/WorkbenchPage.tsx`

验收：

- 右侧默认宽度不低于 `420px`。
- 右侧最大宽度至少允许到 `560px`。
- 字幕表格不再需要 840px 最小宽度。
- 字幕表格列顺序为 `ID / 原文 / 译文 / 开始 / 结束`。
- ID 显示 `1, 2, 3...`。
- 内部 `line.id` 不在主 ID 列直接暴露。

### P0-2 播放字幕正确性

主要文件：

- `apps/web/src/pages/WorkbenchPage.tsx`
- `apps/web/src/components/VideoPreviewPanel.tsx`
- `apps/web/src/components/VideoPreviewPanel.test.tsx`
- 新建 `apps/web/src/editor/playback/activeSubtitle.ts`

目标：

- 新增纯函数 `findActiveSubtitle(lines, timeMs)`。
- 播放时预览覆盖层显示 `activeLine`。
- 暂停时如用户主动选中字幕，可以显示 `selectedLine` 方便编辑。
- 选中其他字幕不应污染正在播放的画面。

验收：

- 播放中切换选中行，画面仍显示当前时间对应字幕。
- 暂停后选择字幕，画面可预览选中字幕。
- 空隙、边界、重叠字幕都有单元测试。

### P0-3 时间线拖动换算

主要文件：

- `apps/web/src/components/TimelineEditor.tsx`
- `apps/web/src/components/TimelineEditor.test.tsx`
- 新建 `apps/web/src/editor/timeline/TimelineClock.ts`
- 新建 `apps/web/src/editor/timeline/TimelineClock.test.ts`

目标：

- 所有时间和像素换算集中到 `TimelineClock`。
- 当前阶段先修复拖动增量，完整逻辑视口可放到后续阶段。
- 拖动公式必须基于实际时间线内容比例：`deltaMs = deltaPx / pixelsPerMs`。
- 不再用可视容器 `rect.width` 推导完整视频时长。

验收：

- 缩放到 2x 或 4x 后，拖动 100px 的毫秒变化符合 `pixelsPerMs`。
- 横向滚动后点击定位仍正确。
- 现有 move / resize 功能不回归。

### P0-4 事务式编辑历史

主要文件：

- `apps/web/src/pages/WorkbenchPage.tsx`
- `apps/web/src/lib/subtitleEditing.ts`
- 新建 `apps/web/src/editor/commands/EditorHistory.ts`
- 新建 `apps/web/src/editor/commands/subtitleCommands.ts`
- 新建 `apps/web/src/editor/commands/EditorHistory.test.ts`

目标：

- 拖动和 resize 使用 `begin / preview / commit` 模型。
- 一次拖动只生成一次撤销记录。
- 文本输入合并为一次逻辑编辑。
- 历史记录保存 command 或 patch，不再无上限保存完整文档数组。
- 自动保存只监听提交后的稳定文档。

0.42 可以先实现最小可用版本：

- 保留 `SubtitleDocument` 作为命令 apply/revert 的输入输出。
- 历史栈保存 command 对象和必要前后值。
- 设置历史上限，例如 `100`。
- 先覆盖 move、resize、line text edit、split、merge、offset。

### P0-5 中文拆分和合并

主要文件：

- `apps/web/src/lib/subtitleEditing.ts`
- `apps/web/src/lib/subtitleEditing.test.ts`

目标：

- 拆分优先使用 `line.words` 时间戳。
- 没有词级时间戳时，使用 `Intl.Segmenter` 或 Unicode 字符分割。
- 中文、日文合并不自动插入英文空格。
- 英文合并保留单词间空格。

验收：

- `这是第一句这是第二句` 拆分不会得到空字符串。
- `你好` + `世界` 合并为 `你好世界`，不是 `你好 世界`。
- `hello` + `world` 合并为 `hello world`。

## 5. P1 后续架构路线

以下内容正确，但不进入 0.42 第一轮实现，避免一次性改动过大：

1. 完整 `PlaybackController`，使用 `requestVideoFrameCallback` 降低 React 每帧渲染。
2. 完整时间线逻辑视口，避免长视频百万像素 DOM。
3. 时间线可见字幕虚拟化。
4. Canvas 标尺、Canvas 波形和吸附线。
5. 波形 V2：多分辨率瓦片、Worker 流式 FFmpeg。
6. 媒体元数据和代理视频。
7. CPS、重叠、最短时长、缺失译文等质量检查的批量修复。

这些应该在 P0 行为正确且用户确认布局方向后推进。

## 6. 第一轮执行范围

第一轮只执行：

1. 右侧面板默认宽度和边界调整。
2. `SubtitleGrid` 列重排与序号显示。
3. `activeLine` 与 `selectedLine` 的预览显示规则。
4. `TimelineClock` 最小实现和拖动换算修复。
5. 中文拆分/合并修复。

事务式编辑历史属于高价值改造，但触及面更大。如果第一轮风险过高，可以作为第二轮独立 PR 执行。

## 7. 测试策略

每一轮至少运行相关测试：

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/components/SubtitleGrid.test.tsx --reporter=dot
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/components/VideoPreviewPanel.test.tsx --reporter=dot
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/components/TimelineEditor.test.tsx --reporter=dot
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/lib/subtitleEditing.test.ts --reporter=dot
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\tsc.CMD' --noEmit
```

阶段合并前再运行更宽范围：

```powershell
corepack pnpm --dir apps/web test
corepack pnpm --dir apps/web typecheck
python -m pytest worker/tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

如变更只触及前端，不强制每个小提交都运行 Python 和 Rust 全量测试，但合并前必须说明是否运行。

## 8. 验收标准

- 创建项目后进入工作台，用户在工作台中导入和管理多个视频。
- 工作台视觉仍是浅色专业桌面工具，不回到黑色后台感。
- 右侧 tab 面板足够宽，字幕表格无需横向滚动即可读原文和译文。
- 预览画面显示的字幕与播放时间一致。
- 选中字幕、时间线播放头、右侧字幕表格高亮互相同步。
- 时间线拖动在缩放后仍准确。
- 中文字幕拆分和合并符合中文阅读习惯。
- 现有转写、翻译、保存、导出、草稿和任务队列不回归。
