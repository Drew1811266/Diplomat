export const zh = {
  app: {
    name: "Diplomat",
    subtitle: "字幕工作台"
  },
  appShell: {
    activityNav: "活动导航",
    contextNavigation: "上下文导航",
    systemUtilities: "系统工具",
    workspaceModesNav: "工作模式",
    editorWorkspacesNav: "编辑工作区",
    projectWorkspacesNav: "项目工作区",
    statusBar: "状态栏",
    localRuntime: "本地运行时",
    backgroundTasks: "后台任务",
    backgroundTasksPanel: "后台任务状态",
    backgroundTasksCount: "{{count}} 个运行中",
    tasksUpdating: "更新中",
    tasksUnavailable: "无法加载任务列表",
    noBackgroundTasks: "当前没有后台任务。",
    openTaskQueue: "打开任务中心",
    openCurrentPage: "打开当前页面",
    openProjectContext: "打开项目上下文",
    openRuntimeSettings: "打开运行时设置",
    runtime: {
      ready: "就绪",
      checking: "检查中",
      offline: "离线"
    }
  },
  commandPalette: {
    title: "命令面板",
    open: "打开命令面板",
    search: "搜索命令",
    placeholder: "搜索页面、设置、模型或任务",
    hint: "快速跳转到需要的工作区，不再增加新的导航栏。",
    empty: "当前搜索下没有命令。",
    commands: {
      projects: {
        description: "创建、打开、恢复和管理项目容器。"
      },
      workbench: {
        description: "回到当前项目工作区，并导入项目媒体。",
        disabledDescription: "请先打开一个项目，再进入工作台。"
      },
      tasks: {
        description: "查看运行中、排队、失败和完成的本地任务。"
      },
      models: {
        description: "在系统设置中管理 ASR 和翻译模型。"
      },
      runtime: {
        description: "检查本地运行时、FFmpeg、路径和日志。"
      },
      help: {
        description: "打开流程、诊断和发布指南。"
      },
      settings: {
        description: "打开应用级偏好设置和默认值。"
      }
    }
  },
  nav: {
    projects: "项目",
    workbench: "工作台",
    tasks: "任务",
    help: "帮助",
    settings: "设置",
    projectLibrary: "项目库",
    projectEditor: "工作台",
    taskQueue: "任务队列"
  },
  editorWorkspaces: {
    transcription: "转写",
    translation: "翻译",
    timing: "校时",
    style: "样式",
    delivery: "交付"
  },
  languages: {
    autoDetect: "自动检测",
    selectLanguage: "选择语言",
    zh: "中文",
    en: "英文",
    ja: "日文",
    ko: "韩文",
    es: "西班牙文",
    fr: "法文",
    de: "德文",
    it: "意大利文",
    pt: "葡萄牙文",
    ru: "俄文",
    ar: "阿拉伯文"
  },
  projectCenter: {
    title: "项目库",
    description: "创建和打开项目容器。打开项目后，再在工作台中导入视频素材。",
    startupRegion: "项目启动",
    recentProjectCards: "最近项目卡片",
    recentProjects: "最近项目",
    newProject: "新建项目",
    createProject: "保存项目",
    createProjectContainer: "创建项目容器",
    importVideo: "到工作台导入",
    projectLibraryActions: "项目库操作",
    projectLibraryToolbar: "项目库工具栏",
    recoverProject: "恢复",
    untitledProject: "未命名项目",
    creationTitle: "新建项目",
    creationNameOnlyHint: "现在只需要给项目命名。视频导入和替换在工作台中完成。",
    creationDesktopHint: "现在只需要输入项目名称；打开项目后，再到工作台导入视频。",
    creationBrowserHint: "新建项目只保存项目容器。视频素材在工作台中管理。",
    chooseVideo: "选择视频",
    noVideoSelected: "尚未选择视频",
    dropVideoHint: "打开项目后，把本地视频拖入工作台的项目媒体区。",
    selectVideoRequired: "请先打开项目，再从工作台导入源视频。",
    unsupportedVideoFile: "请选择支持的视频文件：MP4、MOV、MKV、WebM、AVI 或 M4V。",
    dropUnavailable: "当前桌面会话无法使用视频拖放。",
    creatingProject: "正在保存项目...",
    noProjects: "暂无最近项目",
    noProjectsHint: "先创建项目，再打开项目导入视频素材。",
    visibleProjectCount: "{{visible}}/{{total}} 可见",
    projectCount: "{{count}} 个项目",
    filteredProjectCount: "{{visible}}/{{total}} 个项目",
    workerReady: "本地运行时已就绪",
    workerStarting: "本地运行时启动中",
    workerUnavailable: "本地运行时不可用",
    runtimeReady: "本地运行时已就绪",
    runtimeChecking: "正在检查本地运行时",
    runtimeOffline: "本地运行时离线",
    retryWorker: "重试本地运行时",
    search: "搜索项目",
    searchPlaceholder: "名称、语言或项目 ID",
    statusFilter: "状态筛选",
    statusAll: "全部状态",
    statuses: {
      not_transcribed: "未转写",
      transcribed: "已转写",
      translated: "已翻译",
      dirty_draft: "草稿已变更",
      exported: "已导出",
      failed: "失败",
      corrupted: "已损坏",
      migration_failed: "迁移失败"
    },
    diskUsage: "磁盘占用",
    updated: "更新时间",
    warnings: "警告",
    noFilterMatches: "当前筛选下没有项目。",
    openProjectRowHint: "双击打开 {{name}}",
    actionsFor: "{{name}} 的项目操作",
    openProjectFolder: "打开项目文件夹",
    openExportsFolder: "打开导出文件夹",
    openLogsFolder: "打开日志文件夹",
    cleanCache: "清理缓存",
    cleanExports: "清理导出",
    backupProject: "备份项目",
    importBackup: "导入备份",
    chooseBackupPackage: "选择备份包",
    chooseBackupHint: "从电脑中选择 .diplomat-project.zip 备份包。",
    noBackupPackageSelected: "尚未选择备份包",
    deleteProject: "删除项目",
    confirmDelete: "确认删除",
    deleteFiles: "删除项目文件",
    deleteConfirmationBody: "这会将 {{name}} 从项目库移除。启用文件删除后无法撤销。",
    backupPackagePath: "备份包路径",
    restoreName: "恢复名称",
    table: {
      project: "项目",
      languages: "语言",
      status: "状态",
      subtitles: "字幕",
      duration: "时长",
      actions: "项目操作"
    },
    cards: {
      languages: "语言",
      status: "状态",
      subtitles: "字幕",
      duration: "时长",
      updated: "更新时间",
      diskUsage: "磁盘占用"
    },
    errors: {
      projectListFailed: "项目库暂时无法加载。",
      createFailed: "无法创建项目。",
      maintenanceFailed: "项目操作未能完成。",
      backupImportFailed: "无法导入备份。"
    }
  },
  toolbar: {
    import: "导入视频",
    analyze: "分析",
    translate: "翻译",
    save: "保存",
    export: "导出"
  },
  workbench: {
    title: "工作台",
    workspaces: {
      transcription: "转写工作区",
      translation: "翻译工作区",
      timing: "校时工作区",
      style: "样式工作区",
      delivery: "交付工作区"
    },
    productionStage: {
      label: "当前生产阶段",
      controls: "控制",
      transcription: {
        title: "转写",
        goal: "生成或复核源语言字幕",
        action: "打开转写控制"
      },
      translation: {
        title: "翻译",
        goal: "补齐缺失译文",
        action: "打开翻译控制"
      },
      timing: {
        title: "校时",
        goal: "修复时间与阅读问题",
        action: "打开校时控制"
      },
      style: {
        title: "样式",
        goal: "预览字幕样式",
        action: "打开样式控制"
      },
      delivery: {
        title: "交付",
        goal: "导出字幕或视频",
        action: "打开导出控制"
      }
    },
    labels: {
      projectTools: "项目工具",
      projectContext: "项目上下文",
      videoPreview: "视频预览",
      videoPreviewMedia: "视频预览媒体",
      inspector: "检查器",
      timeline: "时间线"
    },
    layout: {
      resizeInspector: "调整检查器面板",
      resizeTimeline: "调整时间线面板",
      collapseInspector: "折叠检查器",
      expandInspector: "展开检查器",
      collapseTimeline: "折叠时间线",
      expandTimeline: "展开时间线"
    },
    timeline: {
      subtitleRows: "{{count}} 行字幕"
    },
    media: {
      title: "项目媒体",
      count: "{{count}} 个视频",
      dropTitle: "把视频拖到这里",
      empty: "点击导入按钮，或把本地视频拖入工作台。",
      active: "当前",
      missing: "缺失",
      localFile: "本地视频文件",
      use: "使用",
      remove: "删除",
      useAsset: "使用 {{name}}",
      removeAsset: "删除 {{name}}"
    },
    noProject: "未选择项目",
    emptyStateLabel: "工作台空状态",
    emptyStateDescription: "请先在项目库创建或打开项目，再导入视频素材。",
    openProjectLibrary: "打开项目库",
    projectSettings: "项目设置",
    noSourceVideo: "未导入源视频",
    importVideoToStart: "点击导入视频按钮，添加或替换当前项目视频。",
    importVideoAction: "导入视频",
    noDocument: "暂无字幕文档",
    unsaved: "有未保存修改",
    saved: "已保存",
    loadingProject: "正在加载项目...",
    loadingSubtitle: "正在加载字幕文档...",
    projectLoadError: "无法加载项目。",
    subtitleLoadError: "无法加载字幕文档。",
    previewUnavailable: "视频预览不可用",
    subtitleGrid: "字幕表格",
    errors: {
      projectLoadFailed: "项目详情暂时无法加载。",
      subtitleLoadFailed: "字幕文档暂时无法加载。",
      saveFailed: "无法保存字幕。",
      saveFailedHint: "本次会话中的本地编辑仍会保留。",
      analysisFailed: "无法开始转写。",
      translationFailed: "无法开始翻译。",
      styleFailed: "无法更新字幕样式。",
      exportFailed: "无法开始导出。",
      operationFailed: "操作失败。请重试；如果反复出现，请打开诊断。"
    }
  },
  subtitleGrid: {
    region: "字幕表格面板",
    rows: "{{count}} 行",
    filters: {
      label: "字幕筛选",
      all: "全部",
      missing: "缺失译文"
    },
    columns: {
      id: "ID",
      start: "开始",
      end: "结束",
      source: "源文",
      translation: "译文",
      review: "审阅",
      status: "状态"
    },
    selectLine: "选择字幕 {{id}}",
    timingIssueCount: "{{count}} 个时间问题",
    translationQualityIssueCount: "{{count}} 个质量问题",
    empty: "暂无字幕行",
    noFilterMatches: "当前筛选下没有字幕行。",
    noSourceText: "无源文",
    noTranslatedText: "无译文",
    reviewStatus: {
      draft: "草稿",
      reviewed: "已审阅",
      approved: "已批准"
    },
    translationStatus: {
      not_requested: "未请求",
      queued: "排队中",
      translated: "已翻译",
      edited: "已编辑",
      failed: "失败"
    }
  },
  timelineEditor: {
    region: "时间线编辑器",
    title: "时间线",
    zoom: "缩放时间线",
    blockLabel: "时间线字幕块 {{id}}",
    resizeStart: "调整 {{id}} 开始时间",
    resizeEnd: "调整 {{id}} 结束时间",
    generateWaveform: "生成波形"
  },
  editorCommands: {
    toolbar: "编辑命令",
    undo: "撤销",
    redo: "重做",
    split: "分割字幕",
    mergePrevious: "合并上一条",
    mergeNext: "合并下一条",
    offsetMs: "偏移毫秒",
    offsetScope: "偏移范围",
    applyOffset: "应用偏移",
    shortcuts: "键盘快捷键",
    scopes: {
      selected: "选中",
      all: "全部",
      afterPlayhead: "播放头之后"
    }
  },
  recovery: {
    region: "恢复",
    autosavedDraft: "自动保存草稿",
    draftMeta: "{{count}} 行 · {{updatedAt}}",
    snapshots: "快照",
    restoreDraft: "恢复草稿",
    discardDraft: "丢弃草稿",
    createSnapshot: "创建快照",
    restoreSnapshot: "恢复快照 {{label}}",
    manualSnapshotLabel: "手动检查点",
    batchTimingSnapshotLabel: "批量校时前"
  },
  shortcuts: {
    title: "键盘快捷键",
    split: "分割选中字幕",
    undo: "撤销编辑",
    redo: "重做编辑"
  },
  inspector: {
    line: "字幕行",
    analysis: "项目分析设置",
    translation: "项目翻译设置",
    style: "项目样式设置",
    export: "项目导出设置",
    projectSettings: "当前项目设置",
    projectScopeLabel: "当前项目",
    projectScopeDescription: "只应用于当前打开的项目。系统默认值保留在设置中。",
    projectSettingsDescription:
      "这些语言与交付默认值只应用于当前项目。应用级默认值保留在系统设置中。",
    emptyLine: "请选择一条字幕来编辑时间和文本。",
    exportDisabledNoLines: "暂无可导出的字幕行。",
    exportDisabledUnsaved: "请先保存字幕修改再导出。",
    exportDisabledTaskActive: "请等待分析或翻译任务完成。",
    exportDisabledDataError: "请先解决项目或字幕错误再导出。",
    exportDisabledTiming: "请先修复时间错误再导出。",
    exportResult: "{{format}} 已导出：{{exportPath}}",
    selectModel: "选择模型",
    noAsrModelAvailable: "没有已安装的 ASR 模型",
    installAsrModelFirst: "请先在“设置 > 模型”中安装 ASR 模型，再开始本地转写。",
    noTranslationModelAvailable: "没有已安装的翻译模型",
    installTranslationModelFirst: "请先在“设置 > 模型”中安装翻译模型，再开始本地翻译。",
    translationPairUnsupported: "所选翻译模型不支持当前语言方向。",
    translationModelUnavailable: "请先安装这个翻译模型再开始翻译。",
    localTranslationPending: "本地翻译模型执行将在 0.25 实现。",
    advancedOptions: "高级选项",
    runtimeProfile: "{{device}} · {{computeType}} · 批量 {{batchSize}}",
    emptyGlossary: "暂无术语",
    translationQualityIssues: "质量检查"
  },
  fields: {
    projectName: "项目名称",
    sourceVideoPath: "源视频路径",
    sourceLanguage: "源语言",
    targetLanguage: "目标语言",
    startMs: "开始毫秒",
    endMs: "结束毫秒",
    sourceText: "源文",
    translatedText: "译文",
    provider: "提供方",
    model: "模型",
    installedAsrModel: "已安装 ASR 模型",
    translationModel: "翻译模型",
    device: "设备",
    computeType: "计算类型",
    initialPrompt: "初始提示词",
    translationMode: "翻译模式",
    glossary: "术语表",
    sourceTerm: "源术语",
    targetTerm: "目标术语",
    endpoint: "服务地址",
    apiKeyEnv: "API key 环境变量",
    exportMode: "导出模式",
    exportFormat: "格式"
  },
  translationModes: {
    missing_only: "仅缺失项",
    overwrite_all: "覆盖全部"
  },
  exportModes: {
    source: "源文",
    target: "译文",
    bilingual: "双语"
  },
  exportFormats: {
    srt: "SRT",
    vtt: "VTT",
    ass: "ASS"
  },
  videoExport: {
    render: "渲染视频",
    cancel: "取消渲染",
    retry: "重试渲染",
    openExportsFolder: "打开导出文件夹"
  },
  stylePresets: {
    select: "样式预设",
    name: "预设名称",
    save: "保存预设",
    apply: "应用预设",
    update: "更新预设",
    rename: "重命名",
    delete: "删除"
  },
  styleEditor: {
    fontFamily: "字体",
    fontSize: "字号",
    primaryColor: "主色",
    secondaryColor: "副色",
    outline: "描边",
    shadow: "阴影",
    backgroundBar: "背景条",
    backgroundColor: "背景色",
    alignment: "对齐",
    marginV: "垂直边距",
    lineSpacing: "行距",
    bilingualLayout: "双语布局",
    safeArea: "安全区",
    safeAreaMargin: "安全边距",
    alignments: {
      left: "左",
      center: "居中",
      right: "右"
    },
    bilingualLayouts: {
      "source-above-target": "源文在上",
      target_top: "译文在上"
    }
  },
  validation: {
    requiredField: "{{field}}为必填项。",
    languageCodeLength: "请输入 2 到 12 个字符。",
    exportErrors: "请先修复 {{count}} 个时间错误再导出。",
    exportWarnings: "将带着 {{count}} 个时间警告导出。"
  },
  actions: {
    start: "开始",
    cancel: "取消",
    retry: "重试",
    open: "打开",
    openLogs: "打开日志",
    save: "保存",
    close: "关闭",
    addTerm: "添加术语",
    removeTerm: "删除术语"
  },
  settings: {
    title: "系统设置",
    categoriesNav: "设置分类",
    everydaySettings: "常用设置",
    advancedTools: "高级工具",
    advancedToolsDescription: "诊断、原始详情与发布检查，仅在维护时使用。",
    categories: {
      general: "通用",
      appearance: "外观",
      language: "语言",
      runtime: "运行时",
      models: "模型",
      processing: "处理与性能",
      subtitles: "字幕与翻译",
      shortcuts: "快捷键",
      privacy: "隐私",
      advanced: "高级",
      diagnostics: "诊断",
      about: "关于",
      release: "发布",
      defaults: "新项目默认值"
    },
    language: "界面语言",
    theme: "主题",
    themeLight: "浅色",
    currentState: "当前状态",
    readOnlyCategoryNoticeTitle: "只读系统状态",
    readOnlyCategoryNoticeBody: "这些值展示当前应用状态。可编辑偏好会以表单控件呈现。",
    general: "通用",
    startupView: "启动视图",
    startupProjectLibrary: "项目库",
    settingsScope: "设置范围",
    settingsScopeSystem: "系统",
    processingPerformance: "处理与性能",
    processingMode: "处理模式",
    processingModeLocal: "本地运行时",
    taskConcurrency: "任务并发",
    taskConcurrencySingleHeavy: "一次运行一个重型任务",
    asrScheduling: "ASR 调度",
    asrSchedulingReleaseMemory: "翻译前释放转写内存",
    hardwarePolicy: "硬件策略",
    hardwarePolicyValue: "CPU 可兜底；优先使用 GPU",
    subtitlesTranslation: "字幕与翻译",
    defaultExportFormat: "默认导出格式",
    currentProjectOverrides: "当前项目语言和导出设置请在工作台检查器中调整。新项目默认值在单独分类中管理。",
    privacy: "隐私",
    defaultProcessing: "默认处理",
    defaultProcessingLocal: "本机设备",
    remoteServices: "远程服务",
    remoteServicesDisabled: "默认关闭",
    modelDownloadSources: "模型下载来源",
    modelDownloadSourcesCurated: "内置开源来源",
    projectDataLocation: "项目数据位置",
    projectDataLocationLocal: "本地数据目录",
    advanced: "高级",
    workerEndpointRaw: "原始本地运行时端点",
    runtimeProfile: "运行时配置",
    runtimeProfileValue: "开发版桌面运行时",
    dataContract: "数据契约",
    dataContractStable: "稳定项目文件与任务结构",
    diagnostics: "诊断",
    desktopDiagnosticsUnavailable: "浏览器模式下无法使用桌面诊断。",
    runtimeDiagnostics: "运行时诊断",
    diagnosticsDirectory: "诊断目录",
    workerStdoutLog: "本地运行时标准输出日志",
    workerStderrLog: "本地运行时错误日志",
    about: "关于",
    version: "版本",
    application: "应用",
    applicationValue: "本地字幕生产工作台",
    licenseSummary: "许可证",
    licenseSummaryValue: "应用为 MIT；模型许可证随模型包而定",
    appearance: "外观",
    density: "密度",
    densityCompact: "紧凑",
    interfaceScale: "界面缩放",
    subtitleEditorFontSize: "字幕编辑器字号",
    timecodeFormat: "时间码格式",
    reducedMotion: "减少动态效果",
    followsSystem: "跟随系统",
    resetWorkspaceLayout: "恢复默认工作区布局",
    resetWorkspaceLayoutBody: "这会重置所有工作区的面板尺寸和折叠状态。",
    resetWorkspaceLayoutAction: "重置布局",
    shortcuts: "快捷键",
    searchCommands: "搜索命令",
    shortcutCategory: "分类",
    shortcutCommand: "命令",
    shortcutBinding: "绑定",
    shortcutAction: "操作",
    rebindShortcut: "重新绑定",
    shortcutBindingFor: "{{command}} 的快捷键绑定",
    shortcutConflict: "{{binding}} 已分配给 {{command}}。",
    saveShortcut: "保存快捷键",
    cancelShortcutEdit: "取消",
    importShortcuts: "导入快捷键",
    exportShortcuts: "导出快捷键",
    shortcutImportFailed: "无法导入快捷键配置。",
    resetShortcuts: "恢复默认快捷键",
    noShortcuts: "当前搜索下没有快捷键。",
    shortcutCategories: {
      editing: "编辑",
      timeline: "时间线",
      workflow: "流程",
      delivery: "交付"
    },
    shortcutCommands: {
      splitLine: "分割选中字幕",
      undoEdit: "撤销编辑",
      redoEdit: "重做编辑",
      playPause: "播放或暂停预览",
      importVideo: "导入视频",
      exportSubtitles: "导出字幕"
    },
    worker: "本地处理服务",
    workerUrl: "本地运行时 URL",
    runtime: "运行时",
    advancedDetails: "高级详情",
    desktopRuntimeUnavailable: "浏览器模式下无法使用桌面运行时控制。",
    workerEndpoint: "本地运行时地址",
    workerStatus: "本地运行时状态",
    workerLauncher: "本地运行时启动方式",
    ffmpegStatus: "FFmpeg 状态",
    ffprobeStatus: "FFprobe 状态",
    ffmpegVersion: "FFmpeg 版本",
    ffprobeVersion: "FFprobe 版本",
    startWorker: "启动本地运行时",
    stopWorker: "停止本地运行时",
    restartWorker: "重启本地运行时",
    runDiagnostics: "运行诊断",
    dataDirectory: "数据目录",
    modelsDirectory: "模型目录",
    logsDirectory: "日志目录",
    openData: "打开数据",
    openModels: "打开模型",
    openLogs: "打开日志",
    releaseReadiness: "发布就绪检查",
    releaseReadinessLoading: "正在检查发布就绪状态...",
    releaseReadinessVersion: "Diplomat {{version}} 的发布就绪报告。",
    releaseReady: "可发布",
    releaseBlocked: "发布被阻塞",
    releasePassCount: "{{count}} 项通过",
    releaseWarningCount: "{{count}} 项警告",
    releaseBlockerCount: "{{count}} 项阻塞",
    releaseCheckRemediation: "整改方式",
    releaseSeverities: {
      pass: "通过",
      warning: "警告",
      blocker: "阻塞"
    },
    defaults: "新项目默认值",
    projectDefaultsDescription: "只在创建新项目时使用。当前项目的语言和导出设置请在工作台检查器中调整。",
    defaultSourceLanguage: "默认源语言",
    defaultTargetLanguage: "默认目标语言",
    defaultExportMode: "默认导出模式"
  },
  help: {
    title: "帮助中心",
    subtitle: "本地字幕生产、诊断和发布检查的操作指南。",
    search: "搜索帮助",
    topicsNav: "帮助主题",
    articleSectionsNav: "文章目录",
    noResults: "没有匹配的帮助主题。",
    context: {
      openFor: "打开 {{topic}} 的帮助"
    },
    sections: {
      quickStart: {
        title: "快速开始",
        items: [
          "启动桌面应用，并在“设置”中确认本地运行时可连接。",
          "先在“项目库”创建项目，打开项目后在“工作台”中导入本地视频。",
          "在分析和翻译流程中保持源语言、目标语言代码一致。"
        ]
      },
      projectsMedia: {
        title: "项目与媒体",
        items: [
          "先创建命名项目；视频导入、替换和移除都在工作台中完成。",
          "使用项目媒体区拖放或桌面文件选择器，不需要手动输入文件路径。",
          "每个交付物使用一个项目容器，让导出、日志、草稿和备份保持在一起。"
        ]
      },
      transcription: {
        title: "转写",
        items: [
          "开始本地转写前，先在转写检查器中选择已安装的 ASR 模型。",
          "长视频先等待切分和 ASR 完成，再加载翻译模型。",
          "把生成字幕视为可交付前，先复查置信度和时间警告。"
        ]
      },
      translation: {
        title: "翻译",
        items: [
          "源语言和目标语言在当前项目设置中调整，不写入系统默认值。",
          "选择支持当前语言对的翻译模型。",
          "逐段复核目标字幕，不覆盖已确认文本。"
        ]
      },
      timingQa: {
        title: "校时与质检",
        items: [
          "把字幕表格、行检查器、视频监视器和时间轴作为一个联动编辑界面使用。",
          "导出前修复重叠、空文本、过短时长和阅读速度警告。",
          "使用自动草稿、撤销、重做、拆分、合并和偏移工具进行可控编辑。"
        ]
      },
      style: {
        title: "样式",
        items: [
          "渲染内嵌字幕前，先对照视频安全区预览字幕位置。",
          "有意识地应用样式预设；项目样式不会改变系统默认值。",
          "最终交付前检查双语布局、说话人标签、字号、描边和阴影。"
        ]
      },
      export: {
        title: "导出",
        items: [
          "导出 SRT、VTT、ASS 或内嵌字幕视频前先保存字幕修改。",
          "开始视频渲染前先解决阻塞级校验问题。",
          "渲染完成后可从项目操作打开导出文件夹。"
        ]
      },
      models: {
        title: "模型管理",
        items: [
          "只安装“设置 > 模型”中列出的内置开源模型。",
          "等待下载、校验和安装状态完成后再开始任务。",
          "下载中断时使用重试操作，不手动添加模型路径。"
        ]
      },
      tasksRecovery: {
        title: "任务与恢复",
        items: [
          "使用“任务队列”查看跨项目真实任务，包括运行中、排队、失败和已完成任务。",
          "从任务行操作取消或重试任务，重复失败时打开日志。",
          "长任务使用恢复检查点，让失败阶段可以恢复而不是从头开始。"
        ]
      },
      runtime: {
        title: "运行时",
        items: [
          "使用“设置 > 运行时”启动、停止、重启和诊断本地处理服务。",
          "本地运行时离线时，项目浏览和已保存字幕编辑仍可继续。",
          "技术端点、端口和原始日志只放在诊断中，不进入主工作流。"
        ]
      },
      shortcuts: {
        title: "快捷键",
        items: [
          "使用命令面板在项目、工作区、任务、设置和帮助之间快速跳转。",
          "保持播放、选择、保存、撤销、重做、拆分、合并和时间轴缩放快捷键一致。",
          "重新绑定快捷键时，先解决冲突再保存新的键位配置。"
        ]
      },
      privacy: {
        title: "隐私",
        items: [
          "默认 ASR、翻译、编辑和导出流程都在本地运行。",
          "内置模型下载来自已审计的开源来源。",
          "远程服务不属于 v0.3 的正式工作流。"
        ]
      },
      troubleshooting: {
        title: "故障排除",
        items: [
          "先查看当前可见的用户错误，再打开“设置 > 诊断”查看技术详情。",
          "检查本地运行时状态、FFmpeg、FFprobe、模型安装、磁盘路径和任务日志。",
          "先解决报告的原因，再重试失败任务。"
        ]
      }
    }
  },
  models: {
    title: "模型",
    subtitle: "内置开源 ASR 与翻译模型。",
    taskFilter: "模型任务筛选",
    search: "搜索模型",
    searchPlaceholder: "名称、运行时、语言或许可证",
    statusFilter: "安装状态",
    refresh: "刷新模型",
    loading: "正在加载模型...",
    updating: "正在更新模型状态...",
    catalogCount: "{{count}} 个内置模型",
    catalogUnavailableTitle: "模型目录不可用",
    catalogUnavailableBody: "模型管理需要本地运行时。打开运行时设置以启动、重启或运行诊断。",
    openRuntimeSettings: "打开运行时设置",
    recommendedSetup: "推荐配置",
    recommendedSetupDescription: "为常规本地字幕流程安装一个 ASR 模型和一个翻译模型。",
    advancedCatalog: "高级模型目录",
    advancedCatalogDescription: "仅在需要切换运行时、硬件配置或许可证时打开完整目录。",
    recommendedEmpty: "没有可用模型",
    recommendedEmptyDescription: "本地运行时没有返回此任务的模型。",
    catalog: "模型目录",
    visibleCatalogCount: "{{visible}}/{{total}} 可见",
    noModels: "当前筛选下没有模型。",
    license: "许可证",
    profileAvailability: "{{available}}/{{total}} 个配置",
    recommendedProfile: "推荐配置",
    recommendedTasks: {
      asr: "ASR 模型",
      translation: "翻译模型"
    },
    details: {
      title: "模型详情",
      packageDetails: "模型包详情",
      selected: "已选中",
      empty: "选择一个模型以查看模型包详情。"
    },
    reasons: {
      modelNotInstalled: "模型未安装。",
      modelLicenseAcceptanceRequired: "需要先接受模型许可证。",
      modelLicenseAcceptanceIncomplete: "模型许可证接受记录不完整。"
    },
    summary: {
      installed: "已安装",
      usable: "可用",
      activeDownloads: "下载中",
      runtimeProfiles: "可用运行配置"
    },
    filters: {
      all: "全部",
      asr: "ASR",
      translation: "翻译"
    },
    statusFilters: {
      all: "全部状态"
    },
    tasks: {
      asr: "ASR",
      translation: "翻译"
    },
    tiers: {
      light: "轻量",
      high_quality: "高质量"
    },
    statuses: {
      not_installed: "未安装",
      queued: "排队中",
      downloading: "下载中",
      verifying: "校验中",
      installed: "已安装",
      failed: "失败",
      canceled: "已取消"
    },
    actions: {
      installModel: "安装 {{name}}",
      cancelModel: "取消 {{name}}",
      retryModel: "重试 {{name}}",
      deleteModel: "删除 {{name}}"
    },
    actionLabels: {
      install: "安装",
      cancel: "取消",
      retry: "重试",
      delete: "删除"
    },
    table: {
      model: "模型",
      task: "任务",
      runtime: "运行时",
      languages: "语言",
      size: "大小",
      license: "许可证",
      status: "状态",
      hardware: "硬件",
      actions: "模型操作"
    }
  },
  tasks: {
    title: "任务",
    description: "跨项目监控真实本地任务，查看进度、恢复操作和诊断信息。",
    loading: "正在更新",
    error: "无法加载任务。",
    errorHint: "任务状态暂时不可用。如果反复出现，请打开运行时诊断。",
    visibleTaskCount: "{{visible}}/{{total}} 可见",
    queue: {
      title: "任务队列",
      description: "跟踪运行中、排队中、失败、取消和已完成的本地任务。",
      stage: "阶段",
      status: "状态",
      progress: "进度",
      updated: "更新",
      action: "操作",
      notStarted: "未开始"
    },
    filters: {
      search: "搜索任务",
      searchPlaceholder: "任务、项目、状态或错误",
      status: "状态",
      type: "类型",
      project: "项目",
      allStatuses: "全部状态",
      allTypes: "全部类型",
      allProjects: "全部项目"
    },
    metrics: {
      total: "总数",
      active: "进行中",
      failed: "失败",
      completed: "已完成"
    },
    messages: {
      analysisCanceled: "转写已取消",
      analysisCompleted: "转写已完成",
      analysisQueued: "转写已加入队列",
      burnInExportCompleted: "视频渲染已完成",
      modelDownloadQueued: "模型下载已加入队列。",
      modelNotInstalled: "模型未安装",
      queuedBurnInExport: "视频渲染已加入队列",
      taskCompleted: "任务已完成",
      transcribingAudio: "正在转写音频",
      translationCompleted: "翻译已完成",
      waveformQueued: "波形已加入队列",
      installTranslationModelBeforeRetrying: "请先安装翻译模型再重试。"
    },
    table: {
      task: "任务",
      project: "项目",
      status: "状态",
      progress: "进度",
      updated: "更新",
      resource: "资源",
      actions: "操作",
      noTasks: "暂无后台任务。",
      noMatches: "当前筛选下没有任务。"
    },
    types: {
      analysis: "分析",
      translation: "翻译",
      waveform: "波形",
      export: "导出"
    },
    resources: {
      localRuntime: "本地运行时"
    },
    actions: {
      cancelTask: "取消任务 {{taskId}}",
      retryTask: "重试任务 {{taskId}}",
      openLogs: "打开任务 {{taskId}} 的日志",
      viewDetails: "查看任务 {{taskId}} 详情",
      recoverFromCheckpoint: "从检查点恢复",
      openDiagnosticLog: "打开诊断日志"
    },
    details: {
      title: "任务详情",
      currentStep: "当前步骤",
      pipeline: "流水线",
      noSelection: "选择一个任务以查看进度、恢复操作和日志。"
    },
    pipelineStages: {
      prepare: "准备媒体",
      segmentation: "智能切分",
      asr: "ASR 转写",
      translation: "翻译",
      export: "导出与渲染"
    },
    pipelineStatuses: {
      completed: "已完成",
      running: "运行中 {{progress}}",
      queued: "排队中 {{progress}}",
      canceling: "取消中 {{progress}}",
      failed: "失败 {{progress}}",
      canceled: "已取消 {{progress}}",
      waiting: "等待中"
    },
    overview: {
      title: "长视频流水线",
      description: "Diplomat 会把各阶段隔离执行，让 ASR、翻译和导出使用硬件资源时不互相抢占。"
    },
    stages: {
      segmentation: {
        title: "智能切分",
        description: "在转写前尽量围绕语音边界切分音频。",
        status: "规划中"
      },
      asr: {
        title: "ASR 转写",
        description: "语音转文字任务会处理已准备的片段，并写入可恢复的字幕草稿。",
        status: "本地"
      },
      translation: {
        title: "翻译",
        description: "ASR 释放内存后，翻译片段会结合术语表和上下文处理。",
        status: "本地"
      },
      export: {
        title: "导出与渲染",
        description: "校验通过后再执行字幕文件导出和内嵌字幕视频渲染。",
        status: "可恢复"
      }
    },
    recovery: {
      title: "恢复控制",
      description: "取消或失败的任务会保留足够状态，便于重试、诊断和按阶段恢复。"
    }
  },
  status: {
    ready: "就绪",
    running: "运行中",
    queued: "排队中",
    canceling: "取消中",
    completed: "已完成",
    failed: "失败",
    canceled: "已取消",
    blocked: "已阻塞"
  }
} as const;
