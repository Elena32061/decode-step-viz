/* =============================================================================
 * data.js — 一次 decode step 可视化用到的全部数字
 * =============================================================================
 *
 * 这个文件是整个可视化唯一的数字来源。index.html 里不应出现任何硬编码的量值；
 * 屏幕上显示的每一个数字都能在这里找到对应字段。
 *
 * 每个量都带一个出处标记：
 *
 *   measured     实测。profiler-on，每个配置每个测量目的 1 轮，
 *                8 rank × 8 cycle = 64 个样本，按 rank-step 求和后的 kernel 时长。
 *   derived      推导。完全由上面的实测值按本文件内写明的规则算出，不含新信息。
 *   illustrative 示意。仅仅是可视化选择（粒子数量、几何尺寸、单卡专家分布等），
 *                不是测量值，不能当结论引用。
 *
 * 加载方式说明：本文件是「传统脚本」而不是 ES module，因为 ES module 在
 * file:// 下会被浏览器的 CORS 规则拦住，而需求要求双击 index.html 也能看。
 * 它把唯一的导出对象挂在 globalThis.DECODE_STEP_DATA 上，index.html 的
 * module 脚本从那里读。语义上仍然是「一个对象、一处审计」。
 * =============================================================================
 */
(function () {
  "use strict";

  var M = "measured";
  var D = "derived";
  var I = "illustrative";

  // ---------------------------------------------------------------------------
  // 出处标记的显示方式
  // ---------------------------------------------------------------------------
  var provenance = {
    measured:     { tag: M, zh: "实测", marker: "●", color: "#9fd8a8" },
    derived:      { tag: D, zh: "推导", marker: "◐", color: "#d8c89f" },
    illustrative: { tag: I, zh: "示意", marker: "○", color: "#9fb0d8" }
  };

  // ===========================================================================
  // 1. 硬件与并行方式
  // ===========================================================================
  var system = {
    vendorModel:      { v: "NVIDIA GB200",    p: M, zh: "GPU 型号" },
    gpuCount:         { v: 8,                 p: M, zh: "GPU 总数" },
    nodeCount:        { v: 2,                 p: M, zh: "节点数" },
    gpusPerNode:      { v: 4,                 p: M, zh: "每节点 GPU 数" },
    hbmPerGpuGB:      { v: 189,               p: M, zh: "每卡 HBM 容量", unit: "GB" },
    hbmBandwidthTBs:  { v: 8,                 p: M, zh: "每卡 HBM 带宽（约）", unit: "TB/s" },
    smPerGpu:         { v: 152,               p: M, zh: "每卡 SM 数" },
    hostMemory:       { v: "Grace",           p: M, zh: "主机内存" },
    hostLink:         { v: "NVLink-C2C",      p: M, zh: "GPU↔主机内存互联" },
    gpuFabric:        { v: "NVLink fabric",   p: M, zh: "GPU 间互联" }
  };

  var parallelism = {
    attention: { v: "DP8",     p: M, zh: "注意力",  note: "每卡独占自己那 320 条请求的完整 KV" },
    moe:       { v: "EP8",     p: M, zh: "MoE",     note: "384 个路由专家按 48 个一份切到 8 卡" },
    cp:        { v: "CP1",     p: M, zh: "上下文并行", note: "不切上下文" },
    engram:    { v: "Engram8", p: M, zh: "Engram",  note: "表分 8 份，驻留在 Grace 主机内存" }
  };

  // ===========================================================================
  // 2. 负载
  // ===========================================================================
  var workload = {
    requestsPerGpu:      { v: 320,     p: M, zh: "每卡请求数" },
    inputTokens:         { v: 131072,  p: M, zh: "输入长度", unit: "token" },
    outputTokens:        { v: 512,     p: M, zh: "输出长度", unit: "token" },
    specQ:               { v: 8,       p: M, zh: "q8 投机：每请求查询位置数" },
    rowsPerGpuPerStep:   { v: 2560,    p: M, zh: "每卡每步查询行数", note: "320 请求 × 8 位置" },
    kvPoolGB:            { v: 98.5,    p: M, zh: "KV pool 占用", unit: "GB" },
    indexKeyResidentGB:  { v: 19.6,    p: M, zh: "index key 常驻", unit: "GB" }
  };

  // 每卡显存三段（剩余量由上面两项与总容量相减得到）
  var hbmFreeGB = +(system.hbmPerGpuGB.v - workload.kvPoolGB.v - workload.indexKeyResidentGB.v).toFixed(1);

  var memorySplit = [
    { id: "kv",       zh: "KV pool",   gb: workload.kvPoolGB.v,           p: M, color: "#3a6ea8" },
    { id: "indexkey", zh: "index key", gb: workload.indexKeyResidentGB.v, p: M, color: "#5cc08f" },
    { id: "free",     zh: "其余",      gb: hbmFreeGB,                     p: D, color: "#3a4049",
      note: "189 − 98.5 − 19.6" }
  ];

  // ===========================================================================
  // 3. 一次 decode step 的模块拆分（实测）
  // ===========================================================================
  var STEP_TOTAL_MS = 81.8446;   // measured
  var LAYER_COUNT   = 40;        // measured

  var modules = [
    { id: "moe",                      zh: "MoE 专家",        ms: 39.4623, pct: 48.2, launches: 86,   color: "#e8a33d" },
    { id: "attention_core",           zh: "注意力核心",      ms: 11.2302, pct: 13.7, launches: 111,  color: "#4fb8cf" },
    { id: "attention_projection",     zh: "注意力投影",      ms: 10.9542, pct: 13.4, launches: 176,  color: "#3a8aa0" },
    { id: "mhc_hyperconnection",      zh: "MHC 超连接",      ms:  6.0624, pct:  7.4, launches: 110,  color: "#7b7fd0" },
    { id: "indexer_dsa",              zh: "DSA 索引器",      ms:  4.6245, pct:  5.7, launches: 36,   color: "#5cc08f" },
    { id: "eager_gemm",               zh: "Eager GEMM",      ms:  4.1964, pct:  5.1, launches: 27,   color: "#6b7f99" },
    { id: "sampling_speculation_mtp", zh: "采样 / 投机 / MTP", ms: 2.78,  pct:  3.4, launches: 43,   color: "#a77fc4" },
    { id: "engram",                   zh: "Engram",          ms:  1.73,   pct:  2.1, launches: 7,    color: "#d9705f" },
    { id: "other",                    zh: "其它",            ms:  0.81,   pct:  1.0, launches: null, color: "#4a525e" }
  ];
  modules.forEach(function (m) { m.p = M; });

  var modulesById = {};
  modules.forEach(function (m) { modulesById[m.id] = m; });

  var launchesKnownSum = modules.reduce(function (a, m) { return a + (m.launches || 0); }, 0);

  var moduleSumMs = +modules.reduce(function (a, m) { return a + m.ms; }, 0).toFixed(4);

  var step = {
    totalMs:          { v: STEP_TOTAL_MS, p: M, zh: "一次 decode step 总时长", unit: "ms" },
    layerCount:       { v: LAYER_COUNT,   p: M, zh: "层数" },
    launchesKnownSum: { v: launchesKnownSum, p: D, zh: "已归类模块的 kernel launch 合计",
                        note: "八个具名模块相加；other 没有给 launch 数，未计入" },
    moduleSumMs:      { v: moduleSumMs, p: D, zh: "九个模块相加", unit: "ms" },
    moduleSumResidualMs: { v: +(moduleSumMs - STEP_TOTAL_MS).toFixed(4), p: D,
                        zh: "模块之和 − 总时长", unit: "ms",
                        note: "实测表里各模块是四舍五入后给出的，相加比总时长多 0.0054 ms。" +
                              "时间轴推导在最后做了一次整体缩放来吸收这个残差，没有改动任何实测值" },
    samplingBasis:    { v: "1 轮，profiler-on，8 rank × 8 cycle = 64 个样本", p: M, zh: "采样口径" }
  };

  // ===========================================================================
  // 4. 逐层结构
  // ===========================================================================
  var INDEXER_LAYERS = [2, 8, 14, 20, 24, 28, 32, 36];   // measured
  var ENGRAM_LAYERS  = [1, 14];                          // measured
  var POOL_LAYER     = 20;                               // measured

  // 实测的逐层时间。注意：这组数字和 81.8446 ms 的总时长不是同一口径
  // （8 个索引器层 + 32 × 0.530 只有 26.241 ms），它刻画的是层与层之间的
  // 相对轻重，不是每层的完整墙上时间。时间轴的排布见下面 schedule 的推导说明。
  var layerMeasuredMs = {
    2: 1.268, 8: 1.209, 14: 1.195, 20: 2.093,
    24: 0.947, 28: 0.863, 32: 0.852, 36: 0.854
  };
  var LAYER_BASELINE_MS       = 0.530;            // measured（代表值）
  var LAYER_BASELINE_RANGE_MS = [0.524, 0.537];   // measured（无索引器层的实测区间）

  // 候选池
  var candidatePool = {
    builderLayer:   { v: POOL_LAYER, p: M, zh: "建池层" },
    scannedTokens:  { v: 131072,     p: M, zh: "L20 扫描范围", unit: "token" },
    poolTokens:     { v: 16384,      p: M, zh: "候选池大小", unit: "token" },
    poolBlocks:     { v: 2048,       p: M, zh: "候选池块数" },
    tokensPerBlock: { v: 8,          p: M, zh: "每块 token 数" },
    consumerLayers: { v: [24, 28, 32, 36], p: M, zh: "复用候选池的层",
                      note: "L20 自己不用池" }
  };

  // 每层的 KV 压缩比：L0–L1 无压缩（0 表示不适用），L2–L19 为 2，L20–L39 为 1
  function kvCompressionOf(L) {
    if (L <= 1) return 0;
    if (L <= 19) return 2;
    return 1;
  }

  // 索引器实际扫描的位置数（实测口径）
  var indexerScanPositions = {
    2: 65536, 8: 65536, 14: 65536,
    20: 131072,
    24: 16384, 28: 16384, 32: 16384, 36: 16384
  };

  var layers = [];
  for (var L = 0; L < LAYER_COUNT; L++) {
    var hasIdx = INDEXER_LAYERS.indexOf(L) >= 0;
    layers.push({
      index: L,
      hasIndexer: hasIdx,
      hasEngram: ENGRAM_LAYERS.indexOf(L) >= 0,
      isPoolBuilder: L === POOL_LAYER,
      usesPool: candidatePool.consumerLayers.v.indexOf(L) >= 0,
      kvCompression: kvCompressionOf(L),
      scanPositions: hasIdx ? indexerScanPositions[L] : null,
      measuredMs: hasIdx ? layerMeasuredMs[L] : LAYER_BASELINE_MS,
      measuredIsBaseline: !hasIdx
    });
  }

  // ===========================================================================
  // 5. MoE
  // ===========================================================================
  var moe = {
    routedExperts:     { v: 384,  p: M, zh: "路由专家总数" },
    sharedExperts:     { v: 1,    p: M, zh: "共享专家", note: "与路由专家融合在同一个 kernel 里" },
    topK:              { v: 6,    p: M, zh: "每 token 选中专家数" },
    expertsPerGpu:     { v: 48,   p: M, zh: "每卡专家数" },
    tokensPerGpu:      { v: 2560, p: M, zh: "每卡 token 数" },
    routedRowsPerGpu:  { v: 15360, p: M, zh: "每卡路由行数", note: "2560 × 6" },
    rowsPerExpertMean: { v: 320,  p: M, zh: "每专家平均行数" },
    gemmM:             { v: 320,  p: M, zh: "单专家 GEMM M" },
    gemmK:             { v: 5120, p: M, zh: "单专家 GEMM K" },
    gemmN:             { v: 2304, p: M, zh: "单专家 GEMM N" },
    actDtype:          { v: "fp8", p: M, zh: "激活精度" },
    weightDtype:       { v: "fp4", p: M, zh: "权重精度" },
    imbalanceMaxOverMean:      { v: 1.96, p: M, zh: "负载不均衡（max/mean）" },
    imbalanceIdealMaxOverMean: { v: 1.05, p: M, zh: "理想重排后（无副本）" },
    a2aDistinctDestsPerToken:  { v: 4.41, p: M, zh: "每 token 平均去往的目标卡数" },
    a2aOutMBPerGpuPerLayer:    { v: 57.8, p: M, zh: "每卡每层 dispatch 出流量", unit: "MB" },
    fusedKernel: { v: true, p: M, zh: "dispatch→专家 GEMM→combine 融合为单个 kernel",
                   note: "profiler 打不开这个 kernel 的内部，48.2% 这一块只有总时长" }
  };

  // ===========================================================================
  // 6. Engram
  // ===========================================================================
  var engram = {
    tableLocation:     { v: "Grace 主机内存", p: M, zh: "表所在位置" },
    transport:         { v: "RDMA",  p: M, zh: "读回方式" },
    readsPerGpuPerStep:{ v: 122880,  p: M, zh: "每卡每步 RDMA 读次数" },
    bytesPerGpuPerStepMB: { v: 31.5, p: M, zh: "每卡每步读回量（约）", unit: "MB" },
    issueMsRange:      { v: [1.5, 1.85], p: M, zh: "发起这些读的开销", unit: "ms" },
    issueOccupiesSms:  { v: 152,     p: M, zh: "发起期间占用的 SM 数", note: "全部 SM" },
    waitUsRange:       { v: [4, 7],  p: M, zh: "消费前的 wait", unit: "µs" },
    layers:            { v: ENGRAM_LAYERS, p: M, zh: "Engram 层" },
    l14SlackNoteMs:    { v: 25,      p: M, zh: "L14 请求发出到数据被消费的间隔（约）", unit: "ms",
                         note: "请求在 step 最开始就发出；这段空档是本次 profiling 的关键发现——异步设计是有效的" }
  };

  // ===========================================================================
  // 7. DSA / index key
  // ===========================================================================
  var dsa = {
    dtype:            { v: "FP4 (E2M1 + UE8M0 scale)", p: M, zh: "index key 精度" },
    bytesPerPosition: { v: 72,    p: M, zh: "每个位置的 index key 大小（约）", unit: "B" },
    readGBPerGpuPerStep: { v: 9.06, p: M, zh: "每卡每步读取的 index key", unit: "GB" },
    sustainedGBs:     { v: 111,   p: M, zh: "整步平均持续带宽", unit: "GB/s" },
    topK:             { v: 512,   p: M, zh: "每个查询行保留的位置数" },
    indexerLayers:    { v: INDEXER_LAYERS, p: M, zh: "带索引器的层",
                        note: "其余 32 层没有索引器" }
  };

  // ===========================================================================
  // 8. 示意量（不是测量值）
  // ===========================================================================

  // 固定种子的小 PRNG，保证每次打开看到的「示意」分布完全一致、可复现
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 八张卡的相对负载。只有 max/mean = 1.96 是实测的；具体哪张卡多热、
  // 其余七张怎么分布，都是为了把不均衡画出来而选的示意分布。
  // 约束：平均值 = 1.0，最大值 = 1.96。
  var expertLoadPerGpu = [0.85, 1.96, 0.63, 1.05, 0.78, 0.57, 1.21, 0.95];

  // 单卡 48 个专家的行数分布，同样是示意；每张卡的均值被归一到
  // 320 × 该卡负载系数，使它与上面的卡间分布自洽。
  var perExpertRows = (function () {
    var rnd = mulberry32(20261102);
    var out = [];
    for (var g = 0; g < system.gpuCount.v; g++) {
      var raw = [], sum = 0;
      for (var e = 0; e < moe.expertsPerGpu.v; e++) {
        var x = 0.35 + rnd() * rnd() * 2.2;   // 偏斜分布，少数专家明显更忙
        raw.push(x); sum += x;
      }
      var target = moe.rowsPerExpertMean.v * expertLoadPerGpu[g];
      var k = target * moe.expertsPerGpu.v / sum;
      out.push(raw.map(function (x) { return Math.round(x * k); }));
    }
    return out;
  })();

  var illustrative = {
    note: "以下全部是可视化选择，不是测量值。粒子数量、几何尺寸、单卡专家分布、" +
          "动画时长都只为把结构讲清楚；它们不能被引用为性能结论。",

    defaultSpeed:        { v: 0.001,        p: I, zh: "默认播放速度（相对真实时间）" },
    speedRange:          { v: [0.0005, 1],  p: I, zh: "速度范围" },

    particleCapacity:    { v: 4096, p: I, zh: "粒子池容量" },
    moeParticleCount:    { v: 1600, p: I, zh: "MoE all-to-all 粒子数" },
    moeFlowCycles:       { v: 2.0,  p: I, zh: "每个 MoE 段内粒子循环次数" },
    indexKeyParticlesPerGpu: { v: 36, p: I, zh: "每卡 index key 流粒子数" },
    engramParticlesPerGpu:   { v: 26, p: I, zh: "每卡每批 Engram 粒子数" },
    engramConsumeVisualMs:   { v: 0.35, p: I, zh: "停泊粒子被吸入 GPU 的动画时长", unit: "ms",
                               note: "真实 wait 只有 4–7 µs，按原尺度画不出来；这里放大了" },
    waitHoldWallMs:          { v: 1100, p: I, zh: "经过 Engram wait 时的暂留时长（真实秒表）", unit: "ms",
                               note: "wait 只有 5.5 µs，而默认 0.001× 下一帧就要走 ~16 µs，" +
                                     "正常播放会整段跳过去。这里让播放头在 wait 上停一下，" +
                                     "否则这一段永远看不到。暂留的是播放，不是被测时间：" +
                                     "HUD 上的 µs 读数照常是真实时刻" },

    expertLoadPerGpu: { v: expertLoadPerGpu, p: I, zh: "八卡相对负载",
                        note: "唯一实测约束是 max/mean = 1.96；均值已归一到 1.0。" +
                              "具体是哪张卡最热、其余怎么分布，都是示意" },
    perExpertRows:    { v: perExpertRows, p: I, zh: "单卡 48 个专家的行数",
                        note: "固定种子生成的偏斜分布，均值与上一行自洽；不是实测直方图" },

    geometry: {
      gpuSize:     { v: [4.0, 2.6, 2.6], p: I, zh: "GPU 方块尺寸" },
      gpuSpacingX: { v: 5.0, p: I, zh: "同节点内 GPU 间距" },
      nodeSpacingZ:{ v: 7.2, p: I, zh: "两节点间距" },
      fabricY:     { v: -2.1, p: I, zh: "NVLink fabric 平面高度" },
      graceY:      { v: -5.0, p: I, zh: "Grace 内存块高度" }
    }
  };

  // ===========================================================================
  // 9. 时间轴推导
  // ===========================================================================
  //
  // 需要一条能拖动的时间轴，就必须把 81.8446 ms 分配到 40 层上。实测给了
  // 两组东西：整步的模块拆分，和逐层的相对时间。这两组不是同一口径，下面
  // 的分配规则把它们拼起来，规则本身写在代码里，可以逐条核对：
  //
  //  (1) Engram 的 1.73 ms 拆成「发起」和两次「wait」。两次 wait 取实测区间
  //      4–7 µs 的中点 5.5 µs；剩下的 1.719 ms 算作发起开销，落在实测区间
  //      1.5–1.85 ms 内。发起占满全部 152 个 SM，所以放在 step 最开头、
  //      与层计算串行。
  //  (2) 采样 / 投机 / MTP 的 2.78 ms 放在 40 层之后。
  //  (3) DSA 索引器的 4.6245 ms 只分给 8 个索引器层，按「该层实测时间 −
  //      无索引器层基线 0.530」的比例分配。L20 因此拿到最大的一份。
  //  (4) 剩下的时间按其余模块的实测占比平均分到 40 层；层内顺序是
  //      MHC → (Engram wait) → QKV 投影 → (索引器) → 注意力核心 →
  //      输出投影 → Eager GEMM → MoE → 其它。
  //  (5) 最后整体缩放一次，消掉浮点累积误差，使总长严格等于 81.8446 ms。
  //
  // 由此得到的「每层起止时刻」是 derived，不是 measured。层内模块的先后
  // 顺序反映的是结构，不是 profiler 记录的 kernel 时序。
  // ---------------------------------------------------------------------------

  var schedule = (function buildSchedule() {
    var segments = [];
    var layerSpans = [];

    var ENG_WAIT_MS  = (engram.waitUsRange.v[0] + engram.waitUsRange.v[1]) / 2 / 1000;
    var ENG_ISSUE_MS = modulesById.engram.ms - ENG_WAIT_MS * ENGRAM_LAYERS.length;
    var SAMPLING_MS  = modulesById.sampling_speculation_mtp.ms;
    var INDEXER_MS   = modulesById.indexer_dsa.ms;

    // (3) 索引器时间按「超出基线的部分」分配
    var deltas = {}, deltaSum = 0;
    INDEXER_LAYERS.forEach(function (L) {
      var d = layerMeasuredMs[L] - LAYER_BASELINE_MS;
      deltas[L] = d; deltaSum += d;
    });
    var indexerMsOf = {};
    INDEXER_LAYERS.forEach(function (L) {
      indexerMsOf[L] = INDEXER_MS * deltas[L] / deltaSum;
    });

    // (4) 其余模块的层内预算
    var W = {
      mhc:   modulesById.mhc_hyperconnection.ms,
      apIn:  modulesById.attention_projection.ms / 2,
      ac:    modulesById.attention_core.ms,
      apOut: modulesById.attention_projection.ms / 2,
      eager: modulesById.eager_gemm.ms,
      moe:   modulesById.moe.ms,
      other: modulesById.other.ms
    };
    var wSum = W.mhc + W.apIn + W.ac + W.apOut + W.eager + W.moe + W.other;
    var layerBudgetTotal = STEP_TOTAL_MS - ENG_ISSUE_MS
                         - ENG_WAIT_MS * ENGRAM_LAYERS.length
                         - SAMPLING_MS - INDEXER_MS;
    var k = layerBudgetTotal / wSum / LAYER_COUNT;

    var t = 0;
    function push(layer, moduleId, ms, phase) {
      if (ms <= 0) return;
      segments.push({ t0: t, t1: t + ms, dur: ms, layer: layer, module: moduleId, phase: phase || null });
      t += ms;
    }

    // (1) Engram 发起
    push(null, "engram", ENG_ISSUE_MS, "issue");

    for (var L2 = 0; L2 < LAYER_COUNT; L2++) {
      var start = t;
      push(L2, "mhc_hyperconnection", W.mhc * k, "hyper");
      if (ENGRAM_LAYERS.indexOf(L2) >= 0) push(L2, "engram", ENG_WAIT_MS, "wait");
      push(L2, "attention_projection", W.apIn * k, "qkv");
      if (INDEXER_LAYERS.indexOf(L2) >= 0) push(L2, "indexer_dsa", indexerMsOf[L2], "score");
      push(L2, "attention_core", W.ac * k, "attend");
      push(L2, "attention_projection", W.apOut * k, "out");
      push(L2, "eager_gemm", W.eager * k, "gemm");
      push(L2, "moe", W.moe * k, "fused");
      push(L2, "other", W.other * k, "misc");
      layerSpans.push({ layer: L2, t0: start, t1: t, dur: t - start });
    }

    // (2) 尾部采样
    push(null, "sampling_speculation_mtp", SAMPLING_MS, "sample");

    // (5) 归一到严格的总长
    var closureErrorMs = STEP_TOTAL_MS - t;
    var scale = STEP_TOTAL_MS / t;
    segments.forEach(function (s) { s.t0 *= scale; s.t1 *= scale; s.dur = s.t1 - s.t0; });
    layerSpans.forEach(function (s) { s.t0 *= scale; s.t1 *= scale; s.dur = s.t1 - s.t0; });

    return {
      p: D,
      zh: "推导出的时间轴",
      segments: segments,
      layerSpans: layerSpans,
      engramIssueMs: ENG_ISSUE_MS * scale,
      engramWaitMs: ENG_WAIT_MS * scale,
      samplingMs: SAMPLING_MS * scale,
      indexerMsOf: indexerMsOf,
      closureErrorMs: closureErrorMs,
      rule: "见 data.js 第 9 节的 (1)–(5)"
    };
  })();

  // L14 的 Engram 数据实际被消费的时刻（按上面的推导）。
  // 实测说法是「约 25 ms」，推导时间轴给出的位置略晚一些，两个都显示。
  var l14WaitSeg = schedule.segments.filter(function (s) {
    return s.module === "engram" && s.phase === "wait" && s.layer === 14;
  })[0] || null;

  var engramSlack = {
    issuedAtMs:   { v: 0, p: D, zh: "L14 的请求发出时刻", unit: "ms", note: "step 最开始" },
    statedMs:     { v: engram.l14SlackNoteMs.v, p: M, zh: "实测说法：数据被消费的时刻（约）", unit: "ms" },
    derivedMs:    { v: l14WaitSeg ? +l14WaitSeg.t0.toFixed(3) : null, p: D,
                    zh: "按本文件时间轴推导的消费时刻", unit: "ms",
                    note: "与实测说法的「约 25 ms」有出入，因为推导时间轴把 MoE 平均摊到了 40 层；" +
                          "这个差值是推导的产物，不是新的测量" }
  };

  // ===========================================================================
  // 10. 文案
  // ===========================================================================
  var copy = {
    title: "一次 decode step：8 卡 GB200 上的 81.8446 ms",
    subtitle: "Attention DP8 · MoE EP8 · CP1 · Engram8 · 40 层 · q8 投机解码",

    disclaimer: "实测数字口径：1 轮、profiler-on、EP8 / 8 卡，8 rank × 8 cycle = 64 个样本。" +
                "粒子数量、几何尺寸、单卡专家分布与动画时长均为示意，不是测量值。",

    annotations: {
      moe:    "MoE 是单个融合 kernel，profiler 打不开内部",
      engram: "Engram 已提前取回，wait 只要 4–7 µs",
      pool:   "L20 建 16K 候选池，后面 4 层共用"
    },

    moduleExplain: {
      moe: "MoE：384 个路由专家 + 1 个共享专家，每 token 取 top-6。本卡持有 48 个专家，" +
           "本步 15,360 行；单专家 GEMM 形状 [320, 5120] × [5120, 2304]，fp8 激活 × fp4 权重。" +
           "dispatch → 专家 GEMM → combine 融合在同一个 kernel 里。",
      attention_core: "注意力核心：DP8，每张卡独占自己那 320 条请求的完整 KV，本步 2,560 个查询行。" +
                      "卡之间不交换 KV。",
      attention_projection: "注意力投影：QKV 投影与输出投影的 GEMM。",
      mhc_hyperconnection: "MHC 超连接：层间残差的多路混合。",
      indexer_dsa: "DSA 索引器：用 FP4 的 index key 给上下文打分，每个查询行保留 top-512。",
      eager_gemm: "Eager GEMM：没有进 CUDA graph、逐个下发的零散 GEMM。",
      sampling_speculation_mtp: "采样 / 投机 / MTP：q8 投机解码，每条请求一步给出 8 个查询位置。",
      engram: "Engram：表放在 Grace 主机内存，经 RDMA 读回 GPU。",
      other: "其它：未单独归类的 kernel。"
    },

    phaseExplain: {
      "engram:issue": "step 一开始就把 L1 和 L14 两层需要的 Engram 表全部发出 RDMA 读：" +
                      "每卡 122,880 次读、约 31.5 MB。发起本身要 1.5–1.85 ms，并且占满全部 152 个 SM。",
      "engram:wait":  "数据早已在路上，这里只是确认它到了。wait 只有 4–7 µs——异步设计生效了。",
      "sampling_speculation_mtp:sample": "40 层跑完，采样与 MTP 收尾，一步产出 8 个投机位置。"
    },

    layerExplain: {
      poolBuilder: "L20 扫描完整的 131,072 上下文，建出 16,384 token 的候选池（2,048 块 × 8 token）。" +
                   "L20 自己不用这个池。",
      poolConsumer: "只在 L20 建好的 16,384 候选池里打分，不再碰完整上下文。",
      fullScan: "扫描 65,536 个位置（KV 压缩比 2），每个查询行保留 top-512。"
    },

    cameraPresets: {
      system: "整机",
      gpu: "单卡",
      grace: "Grace 链路"
    }
  };

  // ===========================================================================
  // 导出
  // ===========================================================================
  globalThis.DECODE_STEP_DATA = {
    version: "1.0.0",
    provenance: provenance,
    system: system,
    parallelism: parallelism,
    workload: workload,
    memorySplit: memorySplit,
    step: step,
    modules: modules,
    modulesById: modulesById,
    layers: layers,
    layerBaselineMs: { v: LAYER_BASELINE_MS, p: M, zh: "无索引器层的逐层时间（代表值）", unit: "ms" },
    layerBaselineRangeMs: { v: LAYER_BASELINE_RANGE_MS, p: M, zh: "无索引器层的实测区间", unit: "ms" },
    indexerLayers: INDEXER_LAYERS,
    engramLayers: ENGRAM_LAYERS,
    candidatePool: candidatePool,
    moe: moe,
    engram: engram,
    engramSlack: engramSlack,
    dsa: dsa,
    illustrative: illustrative,
    schedule: schedule,
    copy: copy
  };
})();
