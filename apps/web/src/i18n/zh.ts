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
      videoPreview: "视频预览",
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
    exportResult: "SRT 已导出：{{exportPath}}",
    selectModel: "选择模型",
    noAsrModelAvailable: "没有已安装的 ASR 模型",
    installAsrModelFirst: "请先在“模型”中安装 ASR 模型，再开始本地转写。",
    translationModelUnavailable: "请先安装这个翻译模型再开始翻译。",
    localTranslationPending: "本地翻译模型执行将在 0.25 实现。"
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
    endpoint: "服务地址",
    apiKeyEnv: "API key 环境变量",
    exportMode: "导出模式"
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
  validation: {
    requiredField: "{{field}}为必填项。",
    languageCodeLength: "请输入 2 到 12 个字符。"
  },
  actions: {
    start: "开始",
    cancel: "取消",
    retry: "重试",
    open: "打开",
    save: "保存",
    close: "关闭"
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
    defaults: "默认值",
    defaultSourceLanguage: "默认源语言",
    defaultTargetLanguage: "默认目标语言",
    defaultExportMode: "默认导出模式"
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
    description: "后台分析、翻译和导出任务历史会显示在这里。"
  },
  status: {
    ready: "就绪",
    running: "运行中",
    queued: "排队中",
    completed: "已完成",
    failed: "失败",
    canceled: "已取消",
    blocked: "已阻塞"
  }
} as const;
