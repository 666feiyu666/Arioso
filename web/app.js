const translations = {
  "zh-CN": {
    pageTitle: "Arioso · AI 音乐工坊",
    newTask: "新建任务", tasks: "任务", musicTasks: "音乐任务", settings: "设置",
    entryEyebrow: "CHOOSE A WORKFLOW", entryTitle: "选择音乐的<br />创作方式。",
    entryCopy: "从单曲、Jazz 语料到多乐章作品，选择适合当前构想的创作方式。",
    workflowChoices: "生成方式", allStyles: "不限风格", jazzOnly: "仅限 Jazz",
    noCorpusTitle: "无语料生成", noCorpusDescription: "直接使用模型已有的音乐知识，将你的想法整理成完整编曲。",
    jazzCorpusTitle: "含语料生成", jazzCorpusDescription: "先检索本地 Jazz 语料，再结合参考信息完成编曲。",
    enterStudio: "进入创作台 →", enterJazzStudio: "进入 Jazz 创作台 →", backEntry: "← 返回生成方式选择",
    multiMovement: "多乐章", orchestralTitle: "管弦乐作曲",
    orchestralDescription: "由 Agent 规划统一主题与完整乐章，再依次生成一部连贯的管弦乐作品。",
    enterOrchestralStudio: "进入管弦乐创作台 →", sameThemeTracks: "同一主题 · 多曲目",
    albumTitle: "专辑作曲", albumDescription: "围绕同一音乐身份规划多首独立曲目，保持主题、音色与制作风格的一致性。",
    viewAlbumDevelopment: "查看开发进度 →", inDevelopment: "正在开发中",
    albumDevelopmentTitle: "让一组作品，拥有同一种声音。",
    albumDevelopmentCopy: "专辑作曲将复用管弦乐工作流中的共享音乐契约与多曲目任务模型。在 03 成熟后开放。",
    noCorpusBadge: "无语料 · 不限风格", jazzCorpusBadge: "Jazz 语料增强",
    localWorkspace: "本地创作空间", heroEyebrow: "COMPOSE WITH INTENT",
    heroTitle: "把一个念头，<br />写成一段音乐。",
    heroCopy: "描述场景、情绪或声音。Arioso 会先整理成完整乐曲规格，再交给 Lyria 生成。",
    jazzHeroEyebrow: "COMPOSE WITH JAZZ MEMORY",
    jazzHeroTitle: "从爵士记忆里，<br />找到新的声音。",
    jazzHeroCopy: "描述年代、编制、节奏或氛围。Arioso 会检索本地 Jazz 语料，再整理成完整乐曲规格。",
    orchestralBadge: "管弦乐 · 多乐章", orchestralHeroEyebrow: "COMPOSE ACROSS MOVEMENTS",
    orchestralHeroTitle: "让同一个主题，<br />走过完整的旅程。",
    orchestralHeroCopy: "描述作品的世界、情绪与戏剧走向。Agent 会建立共享音乐契约，构思完整乐章并自动依次生成。",
    generalExamplesTitle: "从一个声音画面开始", jazzExamplesTitle: "从一种爵士气质开始",
    generationSettings: "生成设置", generationMode: "生成模式", modeGenerate: "编曲并生成音乐",
    modeCompose: "仅生成编曲提示", lyriaModel: "Lyria 模型", lyriaClip: "Lyria 3 Clip · 30 秒",
    lyriaFull: "Lyria 3.5 · 完整歌曲", examplesTitle: "从一个声音画面开始",
    examplesHint: "选择示例后仍可自由修改", backHome: "← 返回创作台", nowPlaying: "正在播放",
    noMusicSelected: "未选择音乐", promptPlaceholder: "例如：慵懒的午后爵士，刷镲与温暖钢琴轻轻摇摆……",
    promptLabel: "描述想生成的音乐", startGeneration: "开始生成", vocalRule: "人声规则",
    vocalAuto: "自动", vocalInstrumental: "纯器乐", vocalEnabled: "人声", preferences: "PREFERENCES",
    close: "关闭", interfaceLanguage: "界面语言", apiConfiguration: "API 配置",
    apiNeverShown: "密钥只保存在本机，界面不会回显完整内容。",
    apiKeyPlaceholder: "输入新 Key；留空则保留当前配置", testConnection: "测试连接",
    removeSavedKey: "移除已保存的 Key", rememberApiKeys: "记住 API Key",
    rememberApiKeysHelp: "开启后写入本机 .env；关闭后仅在本次服务运行期间使用。",
    cancel: "取消", save: "保存", configuredKey: "已配置 · {masked}", missingKey: "尚未配置",
    settingsSaved: "设置已保存。", settingsLoadFailed: "无法读取设置。", settingsSaveFailed: "无法保存设置。",
    apiKeyRequired: "请先输入 API Key，或配置可用的环境变量。", testingConnection: "正在测试连接…",
    connectionOk: "连接成功。", connectionFailed: "连接失败，请检查 API Key 和网络连接。",
    keyCleared: "已移除保存的 API Key。", keyFallback: "已移除本地保存的 Key；当前仍检测到环境变量中的可用 Key。",
    emptyTasks: "还没有任务。<br />从一个声音画面开始吧。",
    workflow01: "01 无语料单曲", workflow02: "02 Jazz 语料单曲",
    workflow03: "03 管弦乐作品", workflow04: "04 主题专辑",
    noTasksInWorkflow: "暂无任务", albumComingSoon: "正在开发",
    movementProgress: "{completed}/{total} 乐章", totalDuration: "作品总时长", movementDuration: "乐章时长",
    durationAdjusted: "时长调整", minutes: "分钟",
    serverRestartRequired: "当前本地服务仍是旧版本，无法安全创建多乐章任务。请重启 Arioso 服务后再试。",
    queued: "等待开始", composing: "正在整理编曲", generating: "Lyria 正在生成", assembling: "正在组合完整作品", completed: "已完成",
    failed: "生成失败", pause: "暂停", play: "播放", pausePlayback: "暂停播放", resumePlayback: "继续播放",
    playInPlayer: "在播放器中播放", thisMusic: "这首音乐", finishedTrack: "完整成品",
    audioPlaybackFailed: "音频播放失败。", audioLoadFailed: "音频加载失败，请重启本地服务后重试。",
    unnamedWork: "未命名作品", thinking: "正在构思…", lyriaPrompt: "Lyria 生成提示", musicalDirection: "音乐方向",
    genre: "风格", mood: "情绪", tempo: "速度", tonality: "调性", instrumentation: "编制", vocals: "人声",
    noCorpusSource: "模型知识 · 无语料", jazzCorpusSource: "Jazz 本地语料",
    orchestralSource: "管弦乐多乐章", workContract: "作品音乐契约", movements: "乐章",
    identityMotif: "主题动机", tonalWorld: "调性世界", orchestra: "统一编制", acousticSpace: "声学空间",
    movementPlanning: "正在构思完整乐章", movementGenerating: "正在生成乐章音频", movementAssembling: "正在按顺序组合全部乐章",
    movementRole: "戏剧功能", motifDevelopment: "主题发展", orchestrationArc: "配器轨迹",
    entranceContract: "进入衔接", exitContract: "退出衔接", movementPrompt: "乐章 Lyria 提示",
    retrievalContext: "检索记录", retrievalQuery: "英文检索描述", retrievedReferences: "参考曲目",
    openTonality: "开放调性", enabled: "启用", instrumentalNoVocals: "纯器乐 · 无人声", listen: "试听成品",
    inProgress: "IN PROGRESS", generatingProgress: "编曲提示已经完成，正在等待 Lyria 返回音频。",
    composingProgress: "OpenAI Composer 正在把你的描述整理成一致的音乐规格。",
    taskInterrupted: "任务已中断", taskFailedFallback: "任务未能完成。", continueTask: "继续此任务",
    restoring: "正在恢复…", restoreFailed: "无法恢复任务。", createFailed: "无法创建任务。",
  },
  en: {
    pageTitle: "Arioso · AI Music Studio",
    newTask: "New task", tasks: "Tasks", musicTasks: "Music tasks", settings: "Settings",
    entryEyebrow: "CHOOSE A WORKFLOW", entryTitle: "Choose how to<br />create your music.",
    entryCopy: "Choose the workflow that fits your idea, from a single piece or Jazz corpus to a multi-movement work.",
    workflowChoices: "Generation workflows", allStyles: "All styles", jazzOnly: "Jazz only",
    noCorpusTitle: "Without corpus", noCorpusDescription: "Use the model's existing musical knowledge to shape your idea into a complete arrangement.",
    jazzCorpusTitle: "With corpus", jazzCorpusDescription: "Search the local Jazz corpus before composing with the retrieved references.",
    enterStudio: "Enter studio →", enterJazzStudio: "Enter Jazz studio →", backEntry: "← Back to workflow selection",
    multiMovement: "Multi-movement", orchestralTitle: "Orchestral composition",
    orchestralDescription: "Let an agent plan a shared identity and complete movements, then generate a coherent orchestral work in sequence.",
    enterOrchestralStudio: "Enter orchestral studio →", sameThemeTracks: "One identity · Multiple tracks",
    albumTitle: "Album composition", albumDescription: "Plan independent tracks around one musical identity with consistent themes, timbre, and production.",
    viewAlbumDevelopment: "View development status →", inDevelopment: "In development",
    albumDevelopmentTitle: "Give a collection of pieces one recognizable voice.",
    albumDevelopmentCopy: "Album composition will reuse the shared musical contract and multi-track task model proven by the orchestral workflow. It will open after workflow 03 matures.",
    noCorpusBadge: "No corpus · All styles", jazzCorpusBadge: "Jazz corpus enhanced",
    localWorkspace: "Local creative space", heroEyebrow: "COMPOSE WITH INTENT",
    heroTitle: "Turn an idea<br />into a piece of music.",
    heroCopy: "Describe a scene, feeling, or sound. Arioso shapes it into a complete music specification before sending it to Lyria.",
    jazzHeroEyebrow: "COMPOSE WITH JAZZ MEMORY",
    jazzHeroTitle: "Find a new sound<br />in Jazz memory.",
    jazzHeroCopy: "Describe an era, ensemble, rhythm, or mood. Arioso searches the local Jazz corpus before shaping a complete music specification.",
    orchestralBadge: "Orchestral · Multi-movement", orchestralHeroEyebrow: "COMPOSE ACROSS MOVEMENTS",
    orchestralHeroTitle: "Let one theme travel<br />through a complete work.",
    orchestralHeroCopy: "Describe the work's world, emotion, and dramatic direction. The agent establishes a shared musical contract, composes complete movements, and generates them automatically in sequence.",
    generalExamplesTitle: "Start with a sonic scene", jazzExamplesTitle: "Start with a Jazz character",
    generationSettings: "Generation settings", generationMode: "Mode", modeGenerate: "Compose and generate music",
    modeCompose: "Compose prompt only", lyriaModel: "Lyria model", lyriaClip: "Lyria 3 Clip · 30 seconds",
    lyriaFull: "Lyria 3.5 · Full song", examplesTitle: "Start with a sonic scene",
    examplesHint: "Choose an example, then edit it freely", backHome: "← Back to studio", nowPlaying: "NOW PLAYING",
    noMusicSelected: "No music selected", promptPlaceholder: "For example: lazy afternoon jazz with brushes and warm, gently swinging piano…",
    promptLabel: "Describe the music to create", startGeneration: "Start generation", vocalRule: "Vocal rule",
    vocalAuto: "Auto", vocalInstrumental: "Instrumental", vocalEnabled: "Vocals", preferences: "PREFERENCES",
    close: "Close", interfaceLanguage: "Interface language", apiConfiguration: "API configuration",
    apiNeverShown: "Keys stay on this computer and are never displayed in full.",
    apiKeyPlaceholder: "Enter a new key; leave blank to keep the current one", testConnection: "Test connection",
    removeSavedKey: "Remove saved key", rememberApiKeys: "Remember API keys",
    rememberApiKeysHelp: "When enabled, keys are written to the local .env; otherwise they last only for this server session.",
    cancel: "Cancel", save: "Save", configuredKey: "Configured · {masked}", missingKey: "Not configured",
    settingsSaved: "Settings saved.", settingsLoadFailed: "Settings could not be loaded.", settingsSaveFailed: "Settings could not be saved.",
    apiKeyRequired: "Enter an API key or configure a valid environment variable first.", testingConnection: "Testing connection…",
    connectionOk: "Connection successful.", connectionFailed: "Connection failed. Check the API key and network connection.",
    keyCleared: "The saved API key was removed.", keyFallback: "The locally saved key was removed; a key is still available from the environment.",
    emptyTasks: "No tasks yet.<br />Start with a sonic scene.",
    workflow01: "01 Single · No corpus", workflow02: "02 Single · Jazz corpus",
    workflow03: "03 Orchestral work", workflow04: "04 Themed album",
    noTasksInWorkflow: "No tasks", albumComingSoon: "In development",
    movementProgress: "{completed}/{total} movements", totalDuration: "Total work duration", movementDuration: "Movement duration",
    durationAdjusted: "Duration adjustment", minutes: "minutes",
    serverRestartRequired: "The local service is still running an older version and cannot safely create multi-movement tasks. Restart Arioso and try again.",
    queued: "Waiting to start", composing: "Composing", generating: "Lyria is generating", assembling: "Assembling complete work", completed: "Completed",
    failed: "Generation failed", pause: "Pause ", play: "Play ", pausePlayback: "Pause", resumePlayback: "Resume",
    playInPlayer: "Play in player", thisMusic: "this music", finishedTrack: "Finished track",
    audioPlaybackFailed: "Audio playback failed.", audioLoadFailed: "Audio failed to load. Restart the local server and try again.",
    unnamedWork: "Untitled work", thinking: "Thinking…", lyriaPrompt: "Lyria generation prompt", musicalDirection: "Musical direction",
    genre: "Genre", mood: "Mood", tempo: "Tempo", tonality: "Tonality", instrumentation: "Instrumentation", vocals: "Vocals",
    noCorpusSource: "Model knowledge · No corpus", jazzCorpusSource: "Local Jazz corpus",
    orchestralSource: "Multi-movement orchestral work", workContract: "Shared musical contract", movements: "Movements",
    identityMotif: "Identity motif", tonalWorld: "Tonal world", orchestra: "Orchestra", acousticSpace: "Acoustic space",
    movementPlanning: "Composing the complete movement", movementGenerating: "Generating movement audio", movementAssembling: "Assembling all movements in order",
    movementRole: "Dramatic role", motifDevelopment: "Motif development", orchestrationArc: "Orchestration arc",
    entranceContract: "Entrance contract", exitContract: "Exit contract", movementPrompt: "Movement Lyria prompt",
    retrievalContext: "Retrieval record", retrievalQuery: "English retrieval description", retrievedReferences: "Reference tracks",
    openTonality: "Open tonality", enabled: "Enabled", instrumentalNoVocals: "Instrumental · no vocals", listen: "Listen",
    inProgress: "IN PROGRESS", generatingProgress: "The composition prompt is ready. Waiting for Lyria to return audio.",
    composingProgress: "OpenAI Composer is turning your description into a coherent music specification.",
    taskInterrupted: "Task interrupted", taskFailedFallback: "The task could not be completed.", continueTask: "Continue task",
    restoring: "Restoring…", restoreFailed: "The task could not be restored.", createFailed: "The task could not be created.",
  },
};

const generalExamples = [
  {
    title: "午后爵士",
    description: "慵懒松弛的午后爵士，刷镲、低音提琴与温暖钢琴轻轻摇摆。",
    prompt: "一段 30 秒的慵懒午后爵士，纯器乐，78 BPM，轻柔的 swing 节奏。以刷镲、低音提琴和温暖的爵士钢琴为核心，加入少量圆润的次中音萨克斯即兴。整体松弛、惬意、带一点阳光洒进咖啡馆的暖意；动态克制，结尾自然收束并适合循环。不要人声。",
    tags: ["Jazz", "慵懒", "纯器乐"],
    vocalMode: "instrumental",
    en: {
      title: "Afternoon Jazz",
      description: "Loose afternoon jazz with brushes, double bass, and warm, gently swinging piano.",
      prompt: "A 30-second lazy afternoon jazz instrumental at 78 BPM with a gentle swing. Center the arrangement on brushed drums, double bass, and warm jazz piano, with a small amount of rounded tenor saxophone improvisation. Keep it relaxed, sunlit, and intimate, with restrained dynamics and a natural loop-friendly ending. Instrumental only, no vocals.",
      tags: ["Jazz", "Relaxed", "Instrumental"],
    },
  },
  {
    title: "中土远征",
    description: "大气磅礴的史诗奇幻配乐，描绘古老群山、辽阔原野与英雄远征。",
    prompt: "一段 30 秒的大气磅礴史诗级奇幻背景音乐，纯器乐，具有霍比特人式中土世界的古老、壮阔与远征感，但不要复刻任何具体旋律。以圆号、低音弦乐、定音鼓和宏大的交响乐团为主体，加入爱尔兰哨笛与民谣小提琴的遥远色彩。开头从群山晨雾般的低沉主题展开，中段逐层推进，结尾抵达英勇而震撼的高潮。不要人声或合唱。",
    tags: ["Epic", "奇幻史诗", "纯器乐"],
    vocalMode: "instrumental",
    en: {
      title: "Mythic Expedition",
      description: "Expansive epic-fantasy scoring for ancient mountains, open plains, and a heroic expedition.",
      prompt: "A 30-second grand epic-fantasy instrumental with an ancient, expansive sense of expedition, without copying any existing melody. Build around horns, low strings, timpani, and full orchestra, colored by distant tin whistle and folk fiddle. Begin with a low theme like morning mist over mountains, build in layers, and arrive at a heroic, powerful climax. Instrumental only, with no vocals or choir.",
      tags: ["Epic", "Fantasy", "Instrumental"],
    },
  },
  {
    title: "山野欢歌",
    description: "明亮欢快的中国民谣，竹笛、琵琶与扬琴奏出热闹的山野气息。",
    prompt: "一段 30 秒欢快明亮的中国民谣，纯器乐，112 BPM，轻快的 2/4 节拍。以竹笛演奏朗朗上口的五声音阶旋律，琵琶与扬琴活泼应答，二胡点缀流畅的副旋律，并用轻巧的堂鼓、木鱼和拍手感节奏增添喜庆活力。整体自然、质朴、热烈，像春日山野里的集市与踏青。不要人声。",
    tags: ["中国民谣", "欢快", "纯器乐"],
    vocalMode: "instrumental",
    en: {
      title: "Mountain Folk Song",
      description: "Bright Chinese folk music led by bamboo flute, pipa, and yangqin.",
      prompt: "A 30-second bright and joyful Chinese folk instrumental at 112 BPM in a light 2/4 meter. Feature bamboo flute on a memorable pentatonic melody, with lively responses from pipa and yangqin, a flowing erhu countermelody, and light tanggu, woodblock, and handclap-like percussion. Keep it natural, rustic, and celebratory, like a spring market in the mountains. Instrumental only, no vocals.",
      tags: ["Chinese folk", "Joyful", "Instrumental"],
    },
  },
];

const jazzExamples = [
  generalExamples[0],
  {
    title: "午夜硬波普",
    description: "锋利而有推进感的硬波普五重奏，铜管主题与鼓组彼此追逐。",
    prompt: "一段 30 秒的午夜硬波普爵士，纯器乐，约 148 BPM。以小号、次中音萨克斯、爵士钢琴、低音提琴与鼓组成五重奏；开头用紧凑有力的铜管齐奏主题，中段留出短促的萨克斯即兴，并用切分钢琴和富有推进感的 ride cymbal 支撑。声音应直接、热烈、有现场俱乐部感，但保持清晰的主题与自然收束。不要人声。",
    tags: ["Hard bop", "夜晚", "五重奏"],
    vocalMode: "instrumental",
    en: {
      title: "Midnight Hard Bop",
      description: "A driving hard-bop quintet with sharp horn themes and propulsive drums.",
      prompt: "A 30-second midnight hard-bop jazz instrumental around 148 BPM. Use a quintet of trumpet, tenor saxophone, jazz piano, double bass, and drums. Open with a tight, forceful horn theme, make room for a brief tenor saxophone improvisation, and support it with syncopated piano comping and a propulsive ride cymbal. Keep the sound direct, energetic, and club-like while preserving a clear theme and natural ending. Instrumental only, no vocals.",
      tags: ["Hard bop", "Night", "Quintet"],
    },
  },
  {
    title: "雾色调式爵士",
    description: "宽阔、克制的调式爵士，在留白与缓慢变化的和声中展开。",
    prompt: "一段 30 秒的调式爵士，纯器乐，约 92 BPM，宽阔而克制。以柔和小号、次中音萨克斯、钢琴、低音提琴和轻盈鼓组为核心；使用持续较久的调式和声、疏朗钢琴和弦与有呼吸感的旋律，让即兴从安静留白中逐渐展开。整体像清晨薄雾，冷静、内省，但不要阴沉。不要人声。",
    tags: ["Modal jazz", "克制", "留白"],
    vocalMode: "instrumental",
    en: {
      title: "Misty Modal Jazz",
      description: "Spacious, restrained modal jazz unfolding through silence and slowly changing harmony.",
      prompt: "A 30-second modal jazz instrumental around 92 BPM, spacious and restrained. Center it on muted trumpet, tenor saxophone, piano, double bass, and light drums. Use long modal harmonic areas, open piano voicings, and breathing melodic lines so the improvisation gradually emerges from quiet space. Keep it cool and introspective like early-morning mist, but not gloomy. Instrumental only, no vocals.",
      tags: ["Modal jazz", "Restrained", "Spacious"],
    },
  },
];

const orchestralExamples = [
  {
    title: "新大陆回声",
    description: "参考德沃夏克《自新大陆》的辽阔气质，展开四乐章晚期浪漫主义交响旅程。",
    prompt: "创作一部总时长约十一分钟、四乐章的原创晚期浪漫主义交响曲，以德沃夏克《自新大陆》所代表的辽阔、歌唱性与民间节奏活力作为高层美学参考，但不得引用、改写或近似复现其中任何可识别的旋律、和声进行或配器段落。建立一个原创而易辨识的主题动机；通过宽广圆号呼唤、富有歌唱性的木管、深沉弦乐、切分舞蹈节奏与厚重但自然的交响高潮，让它依次经历远行、沉思、舞蹈和归返。四个乐章共同分配约十一分钟，保持统一的管弦乐团、音乐厅声场和主题身份，终章给予明确而有重量的收束。纯器乐。",
    tags: ["晚期浪漫主义", "四乐章", "交响曲"],
    vocalMode: "instrumental",
    en: {
      title: "Echoes of a New Continent",
      description: "A four-movement late-Romantic journey with the breadth and lyricism associated with Dvořák's New World Symphony.",
      prompt: "Create an original four-movement late-Romantic symphony with a total duration of approximately eleven minutes, taking only high-level inspiration from the breadth, lyricism, and folk-rhythmic vitality associated with Dvořák's New World Symphony. Do not quote, paraphrase, or closely reproduce any identifiable melody, harmonic progression, or orchestral passage from it. Establish one original, memorable identity motif and carry it through a journey of departure, reflection, dance, and return using broad horn calls, singing woodwinds, dark strings, syncopated dance energy, and weighty but natural symphonic climaxes. Distribute the eleven-minute total across all four movements and preserve one orchestra, concert-hall perspective, and thematic identity, with decisive closure in the finale. Instrumental only.",
      tags: ["Late Romantic", "Four movements", "Symphony"],
    },
  },
  {
    title: "铁色狂欢",
    description: "以肖斯塔科维奇式的冷峻、讽刺与强烈对比构成四乐章现代交响曲。",
    prompt: "创作一部总时长约十分钟、四乐章的原创二十世纪现代主义交响曲，以肖斯塔科维奇作品中常见的尖锐戏剧、冷峻讽刺、机械进行曲、突然的动态断裂与深沉慢乐章作为高层风格参考，但不得引用或近似复现任何可识别作品。设计一个短促、棱角分明的原创动机，让它在压迫性的低弦与铜管、怪诞木管舞蹈、室内乐式孤独段落和矛盾而强烈的终章中不断变形。四个乐章共同分配约十分钟，保留清晰的主题逻辑、极端但可控的动态对比，以及带有疑问感而非廉价胜利的最终收束。纯器乐。",
    tags: ["现代主义", "四乐章", "冷峻讽刺"],
    vocalMode: "instrumental",
    en: {
      title: "Iron-Colored Carnival",
      description: "A four-movement modernist symphony shaped by the severity, irony, and extreme contrasts associated with Shostakovich.",
      prompt: "Create an original four-movement, approximately ten-minute twentieth-century modernist symphony using only high-level traits associated with Shostakovich: sharp drama, austere irony, mechanized marches, abrupt dynamic fractures, and a deeply inward slow movement. Do not quote or closely reproduce any identifiable work. Design one compact, angular original motif and transform it through oppressive low strings and brass, grotesque woodwind dances, chamber-like solitude, and a conflicted, forceful finale. Distribute the ten-minute total across all four movements, preserving clear motivic logic and extreme but controlled contrasts, and end with ambiguity and weight rather than easy triumph. Instrumental only.",
      tags: ["Modernist", "Four movements", "Austere irony"],
    },
  },
  {
    title: "雾与水的素描",
    description: "以德彪西式的印象主义和声与流动音色写成三幅管弦乐素描。",
    prompt: "创作一部总时长约九分钟、三乐章的原创印象主义管弦组曲，以德彪西作品所代表的流动音色、朦胧和声、调式与全音阶色彩、细腻木管、竖琴和弱音弦乐作为高层美学参考，但不得引用、改写或近似复现任何可识别旋律或段落。三个乐章分别描绘黎明水面、午后林影和夜间薄雾，并共同分配约九分钟。使用一个原创的短小音程细胞作为统一身份，让它通过音色转换、和声重着色、节奏伸缩和片段化自然显现，不采用厚重的德奥式发展。保持透明、富有空气感的管弦织体，并在终章安静而完整地消散。纯器乐。",
    tags: ["印象主义", "三乐章", "管弦素描"],
    vocalMode: "instrumental",
    en: {
      title: "Sketches of Mist and Water",
      description: "Three orchestral sketches shaped by the Impressionist harmony and fluid color associated with Debussy.",
      prompt: "Create an original three-movement Impressionist orchestral suite with a total duration of approximately nine minutes, using only high-level traits associated with Debussy: fluid color, veiled harmony, modal and whole-tone inflections, delicate woodwinds, harp, and muted strings. Do not quote, paraphrase, or closely reproduce any identifiable melody or passage. Let the movements portray dawn on water, afternoon shadows in a grove, and mist at night, sharing the nine-minute total. Use one original compact interval cell as the shared identity, revealed through timbral transfer, harmonic recoloring, rhythmic expansion, and fragmentation rather than heavy Germanic development. Preserve transparent, air-filled orchestration and let the finale dissolve quietly but completely. Instrumental only.",
      tags: ["Impressionist", "Three movements", "Orchestral sketches"],
    },
  },
];

const state = {
  tasks: [],
  selectedTaskId: null,
  playingTaskId: null,
  playingMovementId: null,
  corpusMode: "none",
  compositionMode: "single",
  workflowType: "01-general",
  expandedTaskGroup: "01-general",
  supportedWorkflows: new Set(["01-general", "02-jazz"]),
  submitting: false,
  language: "zh-CN",
  settings: null,
};
const elements = {
  entryView: document.querySelector("#entry-view"),
  developmentView: document.querySelector("#development-view"),
  entryMessage: document.querySelector("#entry-message"),
  homeView: document.querySelector("#home-view"),
  taskView: document.querySelector("#task-view"),
  composerDock: document.querySelector("#composer-dock"),
  heroEyebrow: document.querySelector("#hero-eyebrow"),
  heroTitle: document.querySelector("#hero-title"),
  heroCopy: document.querySelector("#hero-copy"),
  creationModeBadge: document.querySelector("#creation-mode-badge"),
  taskDetail: document.querySelector("#task-detail"),
  taskList: document.querySelector("#task-list"),
  taskCount: document.querySelector("#task-count"),
  form: document.querySelector("#composer-form"),
  input: document.querySelector("#prompt-input"),
  submit: document.querySelector("#submit-task"),
  message: document.querySelector("#form-message"),
  mode: document.querySelector("#mode-select"),
  lyriaModel: document.querySelector("#lyria-model-select"),
  vocalModes: document.querySelectorAll('input[name="vocal-mode"]'),
  vocalSetting: document.querySelector("#vocal-setting"),
  globalPlayer: document.querySelector("#global-player"),
  audio: document.querySelector("#audio-player"),
  playerTitle: document.querySelector("#player-title"),
  playerMeta: document.querySelector("#player-meta"),
  settingsDialog: document.querySelector("#settings-dialog"),
  settingsForm: document.querySelector("#settings-form"),
  settingsMessage: document.querySelector("#settings-message"),
  language: document.querySelector("#language-select"),
  openAiKey: document.querySelector("#openai-api-key"),
  geminiKey: document.querySelector("#gemini-api-key"),
  rememberApiKeys: document.querySelector("#remember-api-keys"),
  saveSettings: document.querySelector("#save-settings"),
};

function t(key, values = {}) {
  const catalog = translations[state.language] || translations["zh-CN"];
  const template = catalog[key] ?? translations["zh-CN"][key] ?? key;
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

function statusLabel(status) {
  return t(status);
}

function localizedExample(example) {
  return state.language === "en" ? { ...example, ...example.en } : example;
}

function normalizeCorpusMode(value) {
  return value === "jazz" ? "jazz" : "none";
}

function workflowTypeForTask(task) {
  if (["01-general", "02-jazz", "03-orchestral", "04-album"].includes(task.workflowType)) {
    return task.workflowType;
  }
  if (task.compositionMode === "orchestral") return "03-orchestral";
  if (normalizeCorpusMode(task.corpusMode) === "jazz" || task.retrievalQuery) return "02-jazz";
  return "01-general";
}

function workflowLabel(workflowType) {
  return t({
    "01-general": "workflow01",
    "02-jazz": "workflow02",
    "03-orchestral": "workflow03",
    "04-album": "workflow04",
  }[workflowType]);
}

function renderComposerContext() {
  const isJazz = state.corpusMode === "jazz";
  const isOrchestral = state.compositionMode === "orchestral";
  elements.heroEyebrow.textContent = t(
    isOrchestral ? "orchestralHeroEyebrow" : isJazz ? "jazzHeroEyebrow" : "heroEyebrow",
  );
  elements.heroTitle.innerHTML = t(
    isOrchestral ? "orchestralHeroTitle" : isJazz ? "jazzHeroTitle" : "heroTitle",
  );
  elements.heroCopy.textContent = t(
    isOrchestral ? "orchestralHeroCopy" : isJazz ? "jazzHeroCopy" : "heroCopy",
  );
  elements.creationModeBadge.textContent = t(
    isOrchestral ? "orchestralBadge" : isJazz ? "jazzCorpusBadge" : "noCorpusBadge",
  );
  document.querySelector("#examples-title").textContent = t(
    isOrchestral ? "orchestralTitle" : isJazz ? "jazzExamplesTitle" : "generalExamplesTitle",
  );
  elements.vocalSetting.hidden = isOrchestral;
}

function applyTranslations() {
  document.documentElement.lang = state.language;
  document.title = t("pageTitle");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((element) => {
    element.innerHTML = t(element.dataset.i18nHtml);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
  renderComposerContext();
  renderExamples();
  renderTaskList();
  const selected = state.tasks.find((task) => task.id === state.selectedTaskId);
  if (selected) renderTaskDetail(selected);
  if (state.playingTaskId) {
    const playing = state.tasks.find((task) => task.id === state.playingTaskId);
    const movement = playing?.movements?.find((item) => item.id === state.playingMovementId);
    if (playing && movement) {
      elements.playerTitle.textContent = `${movement.order}. ${movement.title}`;
      elements.playerMeta.textContent = `${playing.lyriaModel} · ${playing.title || playing.description}`;
    } else if (playing) {
      elements.playerMeta.textContent = `${playing.lyriaModel} · ${t("finishedTrack")}`;
    }
  }
  renderCredentialStatus();
}

function selectedVocalMode() {
  return [...elements.vocalModes].find((input) => input.checked)?.value ?? "auto";
}

function selectVocalMode(mode) {
  const input = [...elements.vocalModes].find((candidate) => candidate.value === mode);
  if (input) input.checked = true;
}

function escapeHtml(value = "") {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function statusClass(status) {
  if (["queued", "composing", "generating", "assembling"].includes(status)) return "running";
  return status;
}

function formatTime(value) {
  return new Intl.DateTimeFormat(state.language, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function taskIsPlaying(id) {
  return state.playingTaskId === id
    && !state.playingMovementId
    && !elements.audio.paused
    && !elements.audio.ended;
}

function movementIsPlaying(taskId, movementId) {
  return state.playingTaskId === taskId
    && state.playingMovementId === movementId
    && !elements.audio.paused
    && !elements.audio.ended;
}

function syncPlaybackControls() {
  document.querySelectorAll("[data-play-task]").forEach((button) => {
    const task = state.tasks.find((item) => item.id === button.dataset.playTask);
    const playing = taskIsPlaying(button.dataset.playTask);
    const title = task?.title || task?.description || t("thisMusic");

    if (button.classList.contains("task-play")) {
      button.textContent = playing ? "Ⅱ" : "▶";
      button.setAttribute("aria-label", `${playing ? t("pause") : t("play")}${title}`);
      button.title = `${playing ? t("pause") : t("play")}${title}`;
    } else {
      button.textContent = playing
        ? t("pausePlayback")
        : state.playingTaskId === button.dataset.playTask
          ? t("resumePlayback")
          : t("playInPlayer");
    }
  });
  document.querySelectorAll("[data-play-movement]").forEach((button) => {
    const playing = movementIsPlaying(button.dataset.parentTask, button.dataset.playMovement);
    button.textContent = playing ? t("pausePlayback") : t("playInPlayer");
  });
}

async function playTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task?.audioFile) return;

  try {
    if (state.playingTaskId === id && !state.playingMovementId) {
      if (elements.audio.paused) {
        await elements.audio.play();
      } else {
        elements.audio.pause();
      }
      return;
    }

    state.playingTaskId = id;
    state.playingMovementId = null;
    elements.playerTitle.textContent = task.title || task.description;
    elements.playerMeta.textContent = `${task.lyriaModel} · ${t("finishedTrack")}`;
    elements.globalPlayer.hidden = false;
    elements.audio.src = `/api/tasks/${encodeURIComponent(task.id)}/audio`;
    elements.audio.load();
    await elements.audio.play();
  } catch (error) {
    elements.message.textContent = error instanceof Error ? error.message : t("audioPlaybackFailed");
  } finally {
    syncPlaybackControls();
  }
}

async function playMovement(taskId, movementId) {
  const task = state.tasks.find((item) => item.id === taskId);
  const movement = task?.movements?.find((item) => item.id === movementId);
  if (!movement?.audioFile) return;

  try {
    if (state.playingTaskId === taskId && state.playingMovementId === movementId) {
      if (elements.audio.paused) await elements.audio.play();
      else elements.audio.pause();
      return;
    }

    state.playingTaskId = taskId;
    state.playingMovementId = movementId;
    elements.playerTitle.textContent = `${movement.order}. ${movement.title}`;
    elements.playerMeta.textContent = `${task.lyriaModel} · ${task.title || task.description}`;
    elements.globalPlayer.hidden = false;
    elements.audio.src = `/api/tasks/${encodeURIComponent(taskId)}/movements/${encodeURIComponent(movementId)}/audio`;
    elements.audio.load();
    await elements.audio.play();
  } catch (error) {
    elements.message.textContent = error instanceof Error ? error.message : t("audioPlaybackFailed");
  } finally {
    syncPlaybackControls();
  }
}

function renderExamples() {
  const activeExamples = state.compositionMode === "orchestral"
    ? orchestralExamples
    : state.corpusMode === "jazz" ? jazzExamples : generalExamples;
  document.querySelector("#example-grid").innerHTML = activeExamples.map((source, index) => {
    const example = localizedExample(source);
    return `
    <button class="example-card" type="button" data-example="${index}">
      <span class="example-art" aria-hidden="true"></span>
      <span class="example-copy">
        <h4>${escapeHtml(example.title)}</h4>
        <p>${escapeHtml(example.description)}</p>
        <span class="example-tags">${example.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</span>
      </span>
    </button>
  `;
  }).join("");

  document.querySelectorAll("[data-example]").forEach((button) => {
    button.addEventListener("click", () => {
      const source = activeExamples[Number(button.dataset.example)];
      if (!source) return;
      const example = localizedExample(source);
      elements.input.value = example.prompt;
      selectVocalMode(example.vocalMode);
      elements.input.focus();
      elements.input.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

function renderTaskList() {
  elements.taskCount.textContent = String(state.tasks.length);
  const workflowTypes = ["01-general", "02-jazz", "03-orchestral", "04-album"];
  elements.taskList.innerHTML = workflowTypes.map((workflowType) => {
    const tasks = state.tasks.filter((task) => workflowTypeForTask(task) === workflowType);
    const taskItems = tasks.map((task) => {
      const movements = task.movements || [];
      const completedMovements = movements.filter((movement) => movement.status === "completed").length;
      const progress = workflowType === "03-orchestral" && movements.length
        ? ` · ${t("movementProgress", { completed: completedMovements, total: movements.length })}`
        : "";
      return `
        <div class="task-list-item">
          <button class="task-button ${task.id === state.selectedTaskId ? "active" : ""}" type="button" data-task-id="${task.id}">
            <strong>${escapeHtml(task.title || task.description)}</strong>
            <span class="task-meta">
              <span class="task-state-dot ${statusClass(task.status)}"></span>
              ${escapeHtml(statusLabel(task.status))}${escapeHtml(progress)} · ${formatTime(task.updatedAt)}
            </span>
          </button>
          ${task.audioFile ? `<button class="task-play" type="button" data-play-task="${task.id}"></button>` : ""}
        </div>
      `;
    }).join("");
    const emptyLabel = workflowType === "04-album" ? t("albumComingSoon") : t("noTasksInWorkflow");
    return `
      <details class="task-group" data-task-group="${workflowType}" ${state.expandedTaskGroup === workflowType ? "open" : ""}>
        <summary>
          <strong>${escapeHtml(workflowLabel(workflowType))}</strong>
          <span class="task-group-summary-meta">
            <span class="task-group-count">${tasks.length}</span>
            <span class="task-group-chevron" aria-hidden="true"></span>
          </span>
        </summary>
        <div class="task-group-content">
          ${taskItems || `<p class="task-group-empty">${escapeHtml(emptyLabel)}</p>`}
        </div>
      </details>
    `;
  }).join("");
  elements.taskList.querySelectorAll("[data-task-group]").forEach((group) => {
    group.addEventListener("toggle", () => {
      const workflowType = group.dataset.taskGroup;
      if (group.open) {
        state.expandedTaskGroup = workflowType;
        elements.taskList.querySelectorAll("[data-task-group]").forEach((otherGroup) => {
          if (otherGroup !== group) otherGroup.open = false;
        });
      } else if (state.expandedTaskGroup === workflowType) {
        state.expandedTaskGroup = null;
      }
    });
  });
  elements.taskList.querySelectorAll("[data-task-id]").forEach((button) => {
    button.addEventListener("click", () => selectTask(button.dataset.taskId));
  });
  elements.taskList.querySelectorAll("[data-play-task]").forEach((button) => {
    button.addEventListener("click", () => playTask(button.dataset.playTask));
  });
  syncPlaybackControls();
}

function renderOrchestralTaskDetail(task) {
  const running = ["queued", "composing", "generating", "assembling"].includes(task.status);
  const plan = task.orchestralPlan;
  const movements = task.movements || [];
  const activeMovement = movements.find((movement) =>
    ["queued", "composing", "generating"].includes(movement.status),
  );
  const contractPanel = plan ? `
    <div class="panel orchestral-contract">
      <h3>${t("workContract")}</h3>
      <div class="spec-list">
        <div class="spec-row"><span>${t("totalDuration")}</span><strong>${escapeHtml(String(plan.plannedTotalDurationMinutes))} ${t("minutes")}</strong></div>
        ${plan.durationAdjustmentReason ? `<div class="spec-row"><span>${t("durationAdjusted")}</span><strong>${escapeHtml(plan.durationAdjustmentReason)}</strong></div>` : ""}
        <div class="spec-row"><span>${t("identityMotif")}</span><strong>${escapeHtml(plan.sharedContract.identityMotif)}</strong></div>
        <div class="spec-row"><span>${t("tonalWorld")}</span><strong>${escapeHtml(plan.sharedContract.tonalWorld)}</strong></div>
        <div class="spec-row"><span>${t("orchestra")}</span><strong>${escapeHtml(plan.sharedContract.orchestra)}</strong></div>
        <div class="spec-row"><span>${t("acousticSpace")}</span><strong>${escapeHtml(plan.sharedContract.acousticSpace)}</strong></div>
      </div>
    </div>
  ` : "";
  const movementCards = movements.map((movement) => {
    const movementPlan = movement.plan;
    const details = movementPlan ? `
      <div class="movement-details">
        <div class="spec-list">
          <div class="spec-row"><span>${t("movementRole")}</span><strong>${escapeHtml(movementPlan.dramaticRole)}</strong></div>
          <div class="spec-row"><span>${t("movementDuration")}</span><strong>${escapeHtml(String(movementPlan.targetDurationMinutes))} ${t("minutes")}</strong></div>
          <div class="spec-row"><span>${t("tempo")}</span><strong>${escapeHtml(movementPlan.tempoAndMeter)}</strong></div>
          <div class="spec-row"><span>${t("tonality")}</span><strong>${escapeHtml(movementPlan.tonalPlan)}</strong></div>
          <div class="spec-row"><span>${t("motifDevelopment")}</span><strong>${escapeHtml(movementPlan.motifDevelopment.join(" · "))}</strong></div>
          <div class="spec-row"><span>${t("orchestrationArc")}</span><strong>${escapeHtml(movementPlan.orchestrationArc)}</strong></div>
          <div class="spec-row"><span>${t("entranceContract")}</span><strong>${escapeHtml(movementPlan.entranceContract)}</strong></div>
          <div class="spec-row"><span>${t("exitContract")}</span><strong>${escapeHtml(movementPlan.exitContract)}</strong></div>
        </div>
        <details>
          <summary>${t("movementPrompt")}</summary>
          <div class="prompt-output">${escapeHtml(movementPlan.lyriaPrompt)}</div>
        </details>
      </div>
    ` : "";
    const movementError = movement.status === "failed" && movement.error
      ? `<p class="movement-error">${escapeHtml(movement.error)}</p>`
      : "";
    return `
      <article class="movement-card">
        <header>
          <div>
            <p class="eyebrow">${String(movement.order).padStart(2, "0")} · ${escapeHtml(t("movements").toUpperCase())}</p>
            <h3>${escapeHtml(movement.title)}</h3>
          </div>
          <span class="status-pill ${statusClass(movement.status)}">${escapeHtml(statusLabel(movement.status))}</span>
        </header>
        ${details}${movementError}
        ${movement.audioFile ? `<button class="listen-button movement-play" type="button" data-parent-task="${task.id}" data-play-movement="${movement.id}">${t("playInPlayer")}</button>` : ""}
      </article>
    `;
  }).join("");
  const progress = running ? `
    <div class="progress-card orchestral-progress">
      <p class="eyebrow accent">${t("inProgress")}</p>
      <h3>${activeMovement ? `${activeMovement.order}. ${escapeHtml(activeMovement.title)}` : escapeHtml(statusLabel(task.status))}</h3>
      <div class="progress-line"></div>
      <p>${task.status === "assembling" ? t("movementAssembling") : task.status === "generating" ? t("movementGenerating") : t("movementPlanning")}</p>
    </div>
  ` : "";
  const error = task.status === "failed" ? `
    <div class="error-box">
      <div><strong>${t("taskInterrupted")}</strong><p>${escapeHtml(task.error || t("taskFailedFallback"))}</p></div>
      <button class="retry-button" type="button" data-retry-task="${task.id}">${t("continueTask")}</button>
    </div>
  ` : "";

  elements.taskDetail.innerHTML = `
    <header class="task-header">
      <div>
        <p class="eyebrow">${escapeHtml(task.lyriaModel.toUpperCase())} · ${t("orchestralSource")}</p>
        <h2>${escapeHtml(task.title || (running ? t("thinking") : t("unnamedWork")))}</h2>
        <p>${escapeHtml(task.description)}</p>
      </div>
      <span class="status-pill ${statusClass(task.status)}">${escapeHtml(statusLabel(task.status))}</span>
    </header>
    ${progress}${error}${task.audioFile ? `<button class="listen-button" type="button" data-play-task="${task.id}">${t("playInPlayer")}</button>` : ""}${contractPanel}
    ${movements.length ? `<section class="movement-list"><h2>${t("movements")}</h2>${movementCards}</section>` : ""}
  `;
  elements.taskDetail.querySelectorAll("[data-play-movement]").forEach((button) => {
    button.addEventListener("click", () => {
      playMovement(button.dataset.parentTask, button.dataset.playMovement);
    });
  });
  elements.taskDetail.querySelectorAll("[data-play-task]").forEach((button) => {
    button.addEventListener("click", () => playTask(button.dataset.playTask));
  });
  elements.taskDetail.querySelectorAll("[data-retry-task]").forEach((button) => {
    button.addEventListener("click", () => retryTask(button.dataset.retryTask, button));
  });
  syncPlaybackControls();
}

function renderTaskDetail(task) {
  if (task.compositionMode === "orchestral") {
    renderOrchestralTaskDetail(task);
    return;
  }
  const running = ["queued", "composing", "generating"].includes(task.status);
  const title = task.title || (running ? t("thinking") : t("unnamedWork"));
  const spec = task.musicSpec;
  const promptPanel = spec ? `
    <div class="panel">
      <h3>${t("lyriaPrompt")}</h3>
      <div class="prompt-output">${escapeHtml(spec.lyriaPrompt)}</div>
    </div>
    <div class="panel">
      <h3>${t("musicalDirection")}</h3>
      <div class="spec-list">
        <div class="spec-row"><span>${t("genre")}</span><strong>${escapeHtml(spec.genres.join(" · "))}</strong></div>
        <div class="spec-row"><span>${t("mood")}</span><strong>${escapeHtml(spec.moods.join(" → "))}</strong></div>
        <div class="spec-row"><span>${t("tempo")}</span><strong>${spec.tempo.bpm ? `${spec.tempo.bpm} BPM · ` : ""}${escapeHtml(spec.tempo.feel)}</strong></div>
        <div class="spec-row"><span>${t("tonality")}</span><strong>${escapeHtml([spec.tonality.tonic, spec.tonality.mode].filter(Boolean).join(" ") || t("openTonality"))}</strong></div>
        <div class="spec-row"><span>${t("instrumentation")}</span><strong>${escapeHtml(spec.instrumentation.map((item) => item.name).join(" · "))}</strong></div>
        <div class="spec-row"><span>${t("vocals")}</span><strong>${spec.vocals.enabled ? escapeHtml([t("enabled"), spec.vocals.language, spec.vocals.style].filter(Boolean).join(" · ")) : t("instrumentalNoVocals")}</strong></div>
      </div>
    </div>
  ` : "";
  const retrievalPanel = task.retrievalQuery ? `
    <div class="panel">
      <h3>${t("retrievalContext")}</h3>
      <div class="spec-list">
        <div class="spec-row"><span>${t("retrievalQuery")}</span><strong>${escapeHtml(task.retrievalQuery)}</strong></div>
        <div class="spec-row"><span>${t("retrievedReferences")}</span><strong>${escapeHtml((task.retrievedReferenceIds || []).join(" · "))}</strong></div>
      </div>
    </div>
  ` : "";
  const audioPanel = task.audioFile ? `
    <div class="panel audio-panel">
      <div><h3>${t("listen")}</h3><p>${escapeHtml(task.lyriaModel)} · MP3</p></div>
      <button class="listen-button" type="button" data-play-task="${task.id}"></button>
    </div>
  ` : "";
  const progress = running ? `
    <div class="progress-card">
      <p class="eyebrow accent">${t("inProgress")}</p>
      <h3>${escapeHtml(statusLabel(task.status))}</h3>
      <div class="progress-line"></div>
      <p>${task.status === "generating" ? t("generatingProgress") : t("composingProgress")}</p>
    </div>
  ` : "";
  const error = task.status === "failed" ? `
    <div class="error-box">
      <div>
        <strong>${t("taskInterrupted")}</strong>
        <p>${escapeHtml(task.error || t("taskFailedFallback"))}</p>
      </div>
      <button class="retry-button" type="button" data-retry-task="${task.id}">${t("continueTask")}</button>
    </div>
  ` : "";

  elements.taskDetail.innerHTML = `
    <header class="task-header">
      <div>
        <p class="eyebrow">${escapeHtml(task.lyriaModel.toUpperCase())} · ${escapeHtml(t(normalizeCorpusMode(task.corpusMode) === "jazz" ? "jazzCorpusSource" : "noCorpusSource"))}</p>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(task.description)}</p>
      </div>
      <span class="status-pill ${statusClass(task.status)}">${escapeHtml(statusLabel(task.status))}</span>
    </header>
    ${progress}${error}
    ${spec || retrievalPanel ? `<div class="result-grid">${promptPanel}${retrievalPanel}${audioPanel}</div>` : ""}
  `;
  elements.taskDetail.querySelectorAll("[data-play-task]").forEach((button) => {
    button.addEventListener("click", () => playTask(button.dataset.playTask));
  });
  elements.taskDetail.querySelectorAll("[data-retry-task]").forEach((button) => {
    button.addEventListener("click", () => retryTask(button.dataset.retryTask, button));
  });
  syncPlaybackControls();
}

function showEntry() {
  state.selectedTaskId = null;
  elements.entryView.hidden = false;
  elements.developmentView.hidden = true;
  elements.homeView.hidden = true;
  elements.taskView.hidden = true;
  elements.composerDock.hidden = true;
  renderTaskList();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showComposer(
  corpusMode = "none",
  compositionMode = "single",
  workflowType = "01-general",
) {
  state.selectedTaskId = null;
  state.corpusMode = normalizeCorpusMode(corpusMode);
  state.compositionMode = compositionMode === "orchestral" ? "orchestral" : "single";
  state.workflowType = workflowType;
  state.expandedTaskGroup = workflowType;
  elements.entryView.hidden = true;
  elements.developmentView.hidden = true;
  elements.homeView.hidden = false;
  elements.taskView.hidden = true;
  elements.composerDock.hidden = false;
  renderComposerContext();
  renderExamples();
  if (state.compositionMode === "orchestral") {
    elements.lyriaModel.value = "lyria-3.5";
    selectVocalMode("instrumental");
  }
  renderTaskList();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showDevelopment() {
  state.selectedTaskId = null;
  elements.entryView.hidden = true;
  elements.developmentView.hidden = false;
  elements.homeView.hidden = true;
  elements.taskView.hidden = true;
  elements.composerDock.hidden = true;
  renderTaskList();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function selectTask(id) {
  state.selectedTaskId = id;
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  state.workflowType = workflowTypeForTask(task);
  state.expandedTaskGroup = state.workflowType;
  state.corpusMode = normalizeCorpusMode(task.corpusMode);
  state.compositionMode = task.compositionMode === "orchestral" ? "orchestral" : "single";
  elements.entryView.hidden = true;
  elements.developmentView.hidden = true;
  elements.homeView.hidden = true;
  elements.taskView.hidden = false;
  elements.composerDock.hidden = false;
  renderTaskList();
  renderTaskDetail(task);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function refreshTasks() {
  try {
    const response = await fetch("/api/tasks", { cache: "no-store" });
    if (!response.ok) return;
    const previousSelected = state.tasks.find((task) => task.id === state.selectedTaskId);
    state.tasks = await response.json();
    renderTaskList();
    if (state.selectedTaskId) {
      const selected = state.tasks.find((task) => task.id === state.selectedTaskId);
      if (selected && selected.updatedAt !== previousSelected?.updatedAt) {
        renderTaskDetail(selected);
      }
    }
    if (state.playingTaskId) {
      const playing = state.tasks.find((task) => task.id === state.playingTaskId);
      const movement = playing?.movements?.find((item) => item.id === state.playingMovementId);
      if (playing && movement) {
        elements.playerTitle.textContent = `${movement.order}. ${movement.title}`;
        elements.playerMeta.textContent = `${playing.lyriaModel} · ${playing.title || playing.description}`;
      } else if (playing) {
        elements.playerTitle.textContent = playing.title || playing.description;
        elements.playerMeta.textContent = `${playing.lyriaModel} · ${t("finishedTrack")}`;
      }
    }
  } catch {
    // A temporary polling failure should not replace the current interface.
  }
}

async function retryTask(id, button) {
  if (button.disabled) return;
  button.disabled = true;
  button.textContent = t("restoring");
  elements.message.textContent = "";

  try {
    const response = await fetch(`/api/tasks/${encodeURIComponent(id)}/retry`, {
      method: "POST",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t("restoreFailed"));

    const index = state.tasks.findIndex((task) => task.id === result.id);
    if (index >= 0) state.tasks[index] = result;
    renderTaskList();
    if (state.selectedTaskId === result.id) renderTaskDetail(result);
  } catch (error) {
    elements.message.textContent = error instanceof Error ? error.message : String(error);
    button.disabled = false;
    button.textContent = t("continueTask");
  }
}

async function submitTask(event) {
  event.preventDefault();
  if (state.submitting) return;
  if (!state.supportedWorkflows.has(state.workflowType)) {
    elements.message.textContent = t("serverRestartRequired");
    return;
  }
  state.submitting = true;
  elements.submit.disabled = true;
  elements.message.textContent = "";

  try {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: elements.input.value,
        mode: elements.mode.value,
        lyriaModel: elements.lyriaModel.value,
        vocalMode: selectedVocalMode(),
        corpusMode: state.corpusMode,
        compositionMode: state.compositionMode,
        workflowType: state.workflowType,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t("createFailed"));
    elements.input.value = "";
    state.tasks.unshift(result);
    selectTask(result.id);
  } catch (error) {
    elements.message.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    state.submitting = false;
    elements.submit.disabled = false;
  }
}

function setSettingsMessage(message, success = false) {
  elements.settingsMessage.textContent = message;
  elements.settingsMessage.classList.toggle("success", success);
}

function renderCredentialStatus() {
  if (!state.settings) return;
  for (const provider of ["openai", "gemini"]) {
    const summary = state.settings.credentials[provider];
    const status = document.querySelector(`#${provider}-key-status`);
    status.textContent = summary.configured
      ? t("configuredKey", { masked: summary.masked })
      : t("missingKey");
    status.classList.toggle("configured", summary.configured);
  }
}

async function loadSettings() {
  const response = await fetch("/api/settings", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || t("settingsLoadFailed"));
  state.settings = result;
  state.language = result.language;
  elements.language.value = result.language;
  elements.openAiKey.value = "";
  elements.geminiKey.value = "";
  applyTranslations();
}

async function loadCapabilities() {
  try {
    const response = await fetch("/api/capabilities", { cache: "no-store" });
    if (!response.ok) return;
    const result = await response.json();
    if (result.apiVersion < 2 || !Array.isArray(result.workflows)) return;
    state.supportedWorkflows = new Set(result.workflows);
  } catch {
    // An older local server has no capabilities endpoint. Keep orchestral creation blocked.
  }
}

async function openSettings() {
  setSettingsMessage("");
  try {
    await loadSettings();
    elements.settingsDialog.showModal();
  } catch (error) {
    elements.message.textContent = error instanceof Error ? error.message : t("settingsLoadFailed");
  }
}

async function saveSettings(event) {
  event.preventDefault();
  elements.saveSettings.disabled = true;
  setSettingsMessage("");

  const credentials = {};
  if (elements.openAiKey.value.trim()) credentials.openai = elements.openAiKey.value.trim();
  if (elements.geminiKey.value.trim()) credentials.gemini = elements.geminiKey.value.trim();

  try {
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: elements.language.value,
        remember: elements.rememberApiKeys.checked,
        ...(Object.keys(credentials).length ? { credentials } : {}),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t("settingsSaveFailed"));
    state.settings = result;
    state.language = result.language;
    elements.openAiKey.value = "";
    elements.geminiKey.value = "";
    applyTranslations();
    elements.settingsDialog.close();
  } catch (error) {
    setSettingsMessage(error instanceof Error ? error.message : t("settingsSaveFailed"));
  } finally {
    elements.saveSettings.disabled = false;
  }
}

async function testConnection(provider, button) {
  const input = provider === "openai" ? elements.openAiKey : elements.geminiKey;
  button.disabled = true;
  setSettingsMessage(t("testingConnection"));
  try {
    const response = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey: input.value.trim() || undefined }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t("connectionFailed"));
    setSettingsMessage(result.ok ? t("connectionOk") : t("connectionFailed"), result.ok);
  } catch (error) {
    setSettingsMessage(error instanceof Error ? error.message : t("connectionFailed"));
  } finally {
    button.disabled = false;
  }
}

async function clearCredential(provider, button) {
  button.disabled = true;
  setSettingsMessage("");
  try {
    const response = await fetch(`/api/settings/credentials/${provider}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t("settingsSaveFailed"));
    state.settings = result;
    const input = provider === "openai" ? elements.openAiKey : elements.geminiKey;
    input.value = "";
    renderCredentialStatus();
    setSettingsMessage(
      result.credentials[provider].configured ? t("keyFallback") : t("keyCleared"),
      true,
    );
  } catch (error) {
    setSettingsMessage(error instanceof Error ? error.message : t("settingsSaveFailed"));
  } finally {
    button.disabled = false;
  }
}

elements.form.addEventListener("submit", submitTask);
elements.settingsForm.addEventListener("submit", saveSettings);
elements.audio.addEventListener("play", syncPlaybackControls);
elements.audio.addEventListener("pause", syncPlaybackControls);
elements.audio.addEventListener("ended", syncPlaybackControls);
elements.audio.addEventListener("error", () => {
  elements.message.textContent = t("audioLoadFailed");
  syncPlaybackControls();
});
document.querySelector("#new-task").addEventListener("click", showEntry);
document.querySelector("#back-entry").addEventListener("click", showEntry);
document.querySelector("#back-development").addEventListener("click", showEntry);
document.querySelector("#back-home").addEventListener("click", () => {
  showComposer(state.corpusMode, state.compositionMode, state.workflowType);
});
document.querySelectorAll("[data-workflow-type]").forEach((button) => {
  button.addEventListener("click", () => {
    const workflowType = button.dataset.workflowType;
    elements.entryMessage.textContent = "";
    if (workflowType === "04-album") {
      showDevelopment();
      return;
    }
    if (!state.supportedWorkflows.has(workflowType)) {
      elements.entryMessage.textContent = t("serverRestartRequired");
      return;
    }
    showComposer(button.dataset.corpusMode, button.dataset.compositionMode, workflowType);
    elements.input.focus();
  });
});
document.querySelector("#open-settings").addEventListener("click", openSettings);
document.querySelector("#close-settings").addEventListener("click", () => elements.settingsDialog.close());
document.querySelector("#cancel-settings").addEventListener("click", () => elements.settingsDialog.close());
elements.language.addEventListener("change", () => {
  state.language = elements.language.value;
  applyTranslations();
});
elements.settingsDialog.addEventListener("close", () => {
  if (state.settings && state.language !== state.settings.language) {
    state.language = state.settings.language;
    elements.language.value = state.language;
    applyTranslations();
  }
});
document.querySelectorAll("[data-test-provider]").forEach((button) => {
  button.addEventListener("click", () => testConnection(button.dataset.testProvider, button));
});
document.querySelectorAll("[data-clear-provider]").forEach((button) => {
  button.addEventListener("click", () => clearCredential(button.dataset.clearProvider, button));
});

try {
  await loadCapabilities();
  await loadSettings();
} catch {
  applyTranslations();
}
refreshTasks();
setInterval(refreshTasks, 1500);
