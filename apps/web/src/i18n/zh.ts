export const zh = {
  app: {
    name: "Diplomat",
    subtitle: "字幕工作台"
  },
  nav: {
    projects: "项目",
    workbench: "工作台",
    tasks: "任务",
    settings: "设置"
  },
  projectCenter: {
    title: "项目中心",
    description: "打开最近的字幕项目，或导入视频创建新项目。",
    recentProjects: "最近项目",
    createProject: "创建项目",
    importVideo: "导入视频",
    noProjects: "暂无最近项目",
    noProjectsHint: "导入一个视频来创建第一个本地项目。",
    workerReady: "Worker 已就绪",
    workerStarting: "Worker 启动中",
    workerUnavailable: "Worker 不可用",
    retryWorker: "重试 Worker"
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
    previewUnavailable: "视频预览不可用",
    subtitleGrid: "字幕表格"
  },
  inspector: {
    line: "字幕行",
    analysis: "分析",
    translation: "翻译",
    export: "导出",
    emptyLine: "请选择一条字幕来编辑时间和文本。"
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
    device: "设备",
    computeType: "计算类型",
    initialPrompt: "初始提示词",
    endpoint: "服务地址",
    apiKeyEnv: "API key 环境变量",
    exportMode: "导出模式"
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
    worker: "Worker",
    defaults: "默认值",
    defaultExportMode: "默认导出模式"
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
