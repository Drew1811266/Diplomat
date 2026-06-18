export const zh = {
  app: {
    name: "Diplomat",
    subtitle: "字幕工作台"
  },
  nav: {
    projects: "项目",
    workbench: "工作台",
    models: "模型",
    tasks: "任务",
    help: "帮助",
    settings: "设置"
  },
  projectCenter: {
    title: "项目中心",
    description: "打开最近的字幕项目，或导入视频创建新项目。",
    recentProjects: "最近项目",
    createProject: "创建项目",
    importVideo: "导入视频",
    untitledProject: "未命名项目",
    creationTitle: "新建项目",
    importFallbackHint: "使用桌面选择器或粘贴本地视频路径，然后创建项目。",
    creatingProject: "正在创建项目...",
    noProjects: "暂无最近项目",
    noProjectsHint: "导入一个视频来创建第一个本地项目。",
    workerReady: "Worker 已就绪",
    workerStarting: "Worker 启动中",
    workerUnavailable: "Worker 不可用",
    retryWorker: "重试 Worker",
    search: "搜索项目",
    searchPlaceholder: "名称、源路径、语言或项目 ID",
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
    actionsFor: "{{name}} 的项目操作",
    openProjectFolder: "打开项目文件夹",
    openExportsFolder: "打开导出文件夹",
    openLogsFolder: "打开日志文件夹",
    cleanCache: "清理缓存",
    cleanExports: "清理导出",
    backupProject: "备份项目",
    importBackup: "导入备份",
    deleteProject: "删除项目",
    confirmDelete: "确认删除",
    deleteFiles: "删除项目文件",
    deleteConfirmationBody: "这会将 {{name}} 从项目库移除。启用文件删除后无法撤销。",
    backupPackagePath: "备份包路径",
    restoreName: "恢复名称",
    table: {
      project: "项目",
      source: "来源",
      languages: "语言",
      subtitles: "字幕",
      duration: "时长",
      actions: "项目操作"
    }
  },
  toolbar: {
    import: "导入",
    analyze: "分析",
    translate: "翻译",
    save: "保存",
    export: "导出"
  },
  workbench: {
    title: "工作台",
    labels: {
      projectTools: "项目工具",
      projectContext: "项目上下文",
      videoPreview: "视频预览",
      videoPreviewMedia: "视频预览媒体",
      inspector: "检查器",
      timeline: "时间线"
    },
    timeline: {
      subtitleRows: "{{count}} 行字幕"
    },
    noProject: "未选择项目",
    noDocument: "暂无字幕文档",
    unsaved: "有未保存修改",
    saved: "已保存",
    loadingProject: "正在加载项目...",
    loadingSubtitle: "正在加载字幕文档...",
    projectLoadError: "无法加载项目。",
    subtitleLoadError: "无法加载字幕文档。",
    previewUnavailable: "视频预览不可用",
    subtitleGrid: "字幕表格"
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
    analysis: "分析",
    translation: "翻译",
    export: "导出",
    emptyLine: "请选择一条字幕来编辑时间和文本。",
    exportDisabledNoLines: "暂无可导出的字幕行。",
    exportDisabledUnsaved: "请先保存字幕修改再导出。",
    exportDisabledTaskActive: "请等待分析或翻译任务完成。",
    exportDisabledDataError: "请先解决项目或字幕错误再导出。",
    exportDisabledTiming: "请先修复时间错误再导出。",
    exportResult: "{{format}} 已导出：{{exportPath}}",
    selectModel: "选择模型",
    noAsrModelAvailable: "没有已安装的 ASR 模型",
    installAsrModelFirst: "请先在“模型”中安装 ASR 模型，再开始本地转写。",
    noTranslationModelAvailable: "没有已安装的翻译模型",
    installTranslationModelFirst: "请先在“模型”中安装翻译模型，再开始本地翻译。",
    translationPairUnsupported: "所选翻译模型不支持当前语言方向。",
    translationModelUnavailable: "请先安装这个翻译模型再开始翻译。",
    localTranslationPending: "本地翻译模型执行将在 0.25 实现。",
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
    title: "设置",
    language: "界面语言",
    theme: "主题",
    themeLight: "浅色",
    worker: "Worker",
    workerUrl: "Worker URL",
    runtime: "运行时",
    desktopRuntimeUnavailable: "浏览器模式下无法使用桌面运行时控制。",
    workerEndpoint: "Worker 地址",
    workerStatus: "Worker 状态",
    workerLauncher: "Worker 启动方式",
    ffmpegStatus: "FFmpeg 状态",
    ffprobeStatus: "FFprobe 状态",
    ffmpegVersion: "FFmpeg 版本",
    ffprobeVersion: "FFprobe 版本",
    startWorker: "启动 Worker",
    stopWorker: "停止 Worker",
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
    defaults: "默认值",
    defaultSourceLanguage: "默认源语言",
    defaultTargetLanguage: "默认目标语言",
    defaultExportMode: "默认导出模式"
  },
  help: {
    title: "帮助中心",
    subtitle: "本地字幕生产、诊断和发布检查的操作指南。",
    sections: {
      firstRun: {
        title: "首次使用",
        items: [
          "启动桌面应用，并在“设置”中确认 Worker 可连接。",
          "先从“项目中心”导入本地视频，再进入工作台。",
          "在分析和翻译流程中保持源语言、目标语言代码一致。"
        ]
      },
      models: {
        title: "模型管理",
        items: [
          "只安装“模型”页列出的内置开源模型。",
          "等待下载、校验和安装状态完成后再开始任务。",
          "下载中断时使用重试操作，不手动添加模型路径。"
        ]
      },
      localWorkflow: {
        title: "本地工作流",
        items: [
          "每个源视频创建或导入一个独立项目。",
          "先运行分析，需要目标字幕时再运行翻译。",
          "使用“任务”页跟踪排队、运行、完成、失败和取消的后台任务。"
        ]
      },
      longVideo: {
        title: "长视频工作流",
        items: [
          "ASR 前优先使用语音感知切分，避免在一句话中间截断。",
          "让 ASR 完成并释放内存后，再加载本地翻译模型。",
          "使用恢复检查点，让三小时任务失败后可以按阶段恢复，而不是从头开始。"
        ]
      },
      editing: {
        title: "编辑",
        items: [
          "导出前检查时间警告。",
          "大批量修改时间或文本前使用自动草稿和快照。",
          "让说话人、样式和双语布局与最终导出目标保持一致。"
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
      diagnostics: {
        title: "诊断",
        items: [
          "在“设置”中检查 Worker、FFmpeg、FFprobe、数据、模型和日志路径。",
          "后台任务失败时从“设置”打开日志。",
          "先解决报错原因，再重试失败任务。"
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
      releaseChecklist: {
        title: "发布前检查",
        items: [
          "在“设置”中查看发布就绪面板。",
          "阻塞级检查必须视为停止发布的问题。",
          "打标签前确认打包、文档、FFmpeg、模型许可证、来源和校验和。"
        ]
      }
    }
  },
  models: {
    title: "模型",
    subtitle: "内置开源 ASR 与翻译模型。",
    taskFilter: "模型任务筛选",
    loading: "正在加载模型...",
    updating: "正在更新模型状态...",
    catalogCount: "{{count}} 个内置模型",
    catalog: "模型目录",
    noModels: "当前筛选下没有模型。",
    license: "许可证",
    profileAvailability: "{{available}}/{{total}} 个配置",
    recommendedProfile: "推荐配置",
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
    description: "跟踪长视频的本地切分、ASR、翻译、导出和恢复任务。",
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
