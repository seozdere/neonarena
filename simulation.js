const { Engine, Render, Runner, Bodies, Composite, Body, Events, Vector } = Matter;

// Configuration
let config = {
    team1: { name: 'FENERBAHÇE', color: '#fbbf24', color2: '#1e3a8a', color3: '#ffffff', useColor3: false, score: 0, logo: null },
    team2: { name: 'GALATASARAY', color: '#ef4444', color2: '#fbbf24', color3: '#ffffff', useColor3: false, score: 0, logo: null },
    rotationSpeed: 0.020,
    ballLaunchSpeed: 12,
    matchDuration: 60,
    matchType: 'normal',
    ballBounciness: 1.0,
    ballDamping: 0.005,
    ballSize: 18,
    circleRadius: 155,
    segmentCount: 80,
    gapSize: 8,
    centerX: 250,
    centerY: 250,
    arenaBackground: 'assets/images/arenas/pitch.png',
    timerStyle: 'classic',
    matchClockStoppageMinutes: 0,
    autoModePriority: 'mixed',
    autoModePool: [],
    videoEditVsDuration: 3,
    oddsFavoriteTeam: 1,
    oddsFavoritePercent: 58,
    miniThreatEnabled: true,
    coldOpenEnabled: true,
    allowDraw: false,
    scenarioEnabled: false,
    scenarioLeadTeam: 1,
    scenarioLeadUntil: 20,
    scenarioWinnerTeam: 2,
    scenarioStrength: 'medium',
    scenarioFailsafe: true,
    winnerFx: true,
    finalRushFx: true,
    extraGlowFx: true,
    soundPriorityFx: true,
    lowPerformanceMode: false
};

// --- SES AYARLARI ---
const AUDIO_DIR = 'assets/audio/';
const VIDEO_DIR = 'assets/video/';
const BEST_FRAME_EXPORT_MAX_SIZE = 720;
const audioAsset = (file) => `${AUDIO_DIR}${file}`;
const videoAsset = (file) => `${VIDEO_DIR}${file}`;
const AMBIENT_VOLUME = 0.60;
const BOUNCE_VOLUME_NORMAL = 1.0;
const BOUNCE_VOLUME_BUSY = 0.48;
const BUMBUM_VOLUME = 0.50;
const WINNER_INTERFACE_VOLUME = 1.0;
const MATCH_END_GERILIM_VOLUME = 1.0;
const MATCH_END_GERILIM_LAYER_VOLUME = 0.72;
const BUMBUM_TICK_INTERVAL = 16;
const GOAL_SOUND_COOLDOWN_MS = 160;
const NET_SOUND_COOLDOWN_MS = 120;
const SOUND_PRIORITY = { bounce: 0, tick: 1, ambient: 1, ui: 2, mode: 3, goal: 4, winner: 5 };
let activeSoundPriority = 0;
let activeSoundPriorityUntil = 0;

const sounds = {
    ambient: new Audio(audioAsset('ortamsesi.wav')),
    goal: new Audio(audioAsset('golsesi.wav')),
    tick: new Audio('https://www.soundjay.com/buttons/sounds/button-20.mp3'),
    beep: new Audio(audioAsset('bip.wav')),
    whistle: new Audio(audioAsset('düdük.mp3')),
    bounce: new Audio(audioAsset('topsesi.mp3')),
    net: new Audio(audioAsset('filesesi.mp3')),
    bumbum: new Audio(audioAsset('bumbum.mp3')),
    kalesesi: null,
    riser: new Audio(audioAsset('riserwav.wav')),
    doubleGoal: new Audio(audioAsset('doublegoal.wav')),
    gerilim: new Audio(audioAsset('gerilim.wav')),
    reverse: new Audio(audioAsset('reverse.wav')),
    tight: new Audio(audioAsset('tight.mp3')),
    double: new Audio(audioAsset('double.wav')),
    golden: new Audio(audioAsset('golden.wav')),
    freeze: new Audio(audioAsset('freeze.wav')),
    engel: new Audio(audioAsset('engel.wav')),
    oneBall: new Audio(audioAsset('oneball.mp3')),
    goalSwap: new Audio(audioAsset('goalswap.mp3')),
    stopRing: new Audio(audioAsset('stopring.mp3')),
    stealPoints: new Audio(audioAsset('stealpoints.wav')),
    stealPoints2: new Audio(audioAsset('stealpoints2.mp3')),
    eraseGoal: new Audio(audioAsset('erasegoal.mp3')),
    blackout: new Audio(audioAsset('blackout.mp3')),
    lastGoalWin: new Audio(audioAsset('lastgoalwin.mp3')),
    arenaDepth: new Audio(audioAsset('arenadepth.mp3')),
    glassHit: new Audio(audioAsset('glasshit.wav')),
    countdown: new Audio(audioAsset('countdown.wav')),
    interfacePercent: new Audio(audioAsset('interfacepercent.mp3')),
    interface11: new Audio(audioAsset('interface11.mp3'))
};
sounds.ambient.loop = true;
sounds.ambient.volume = AMBIENT_VOLUME;
if (sounds.bumbum) sounds.bumbum.volume = BUMBUM_VOLUME;
if (sounds.goal) sounds.goal.volume = 0.6;
if (sounds.tick) sounds.tick.volume = 0.4;
if (sounds.whistle) sounds.whistle.volume = 1.0;
if (sounds.gerilim) sounds.gerilim.volume = 1.0;
if (sounds.riser) sounds.riser.volume = 1.0;
if (sounds.doubleGoal) sounds.doubleGoal.volume = 1.0;
[
    'reverse', 'tight', 'double', 'golden', 'freeze', 'engel', 'oneBall',
    'goalSwap', 'stopRing', 'stealPoints', 'stealPoints2', 'eraseGoal',
    'blackout', 'lastGoalWin', 'arenaDepth', 'glassHit', 'countdown',
    'interfacePercent', 'interface11'
].forEach(key => { if (sounds[key]) sounds[key].volume = 1.0; });

function unlockAudio() {
    Object.values(sounds).forEach(s => {
        if (s && s.play && s !== sounds.whistle && s !== sounds.bumbum) { s.play().then(() => { s.pause(); s.currentTime = 0; }).catch(e => console.log("Unlock wait...")); }
    });
}

// State
let engine, render, runner;
let segments = [];
let goalSensor;
let extraGoalSensor;
let balls = [];
let modeBumpers = [];
let tempModeState = {};
let isRunning = false;
let isGameStarted = false;
let isEnding = false;
let timeLeft = 30;
let overtimeCount = 0;
let isPaused = false;
let isMuted = false;
let timerInterval = null;
let uiSwapTimeout = null;
let viewportEffectTimeouts = {
    introZoom: null,
    goalZoom: null,
    glitch: null,
    freezeZoom: null
};
let currentRotation = Math.random() * Math.PI * 2;
let trails = [];
let sparks = [];
let explosions = [];
let ambientParticles = [];
let confetti = [];
let bursts = []; // New burst particles
let shakeTime = 0;
let lastBounceSoundAt = 0;
let highSpeedAudioCooldownUntil = 0;
let lastGoalSoundAt = 0;
let lastNetSoundAt = 0;
let audioContext = null;
let reverseAudioCache = {};
let isSlowMotion = false;
let bumbumCounter = 0;
let currentLang = 'tr';
const UI_SWAP_DELAY_MS = 4500;
let lastScoringTeam = null;
const BASE_ENGINE_TIME_SCALE = 1.25;
const TIMER_INTERVAL_MS = 800;
const SLOW_TIMER_INTERVAL_MS = 1600;
const TEMP_MODE_MS = 5000;
const FINAL_RUSH_SECONDS = 5;
const TEMP_MODE_INTRO_SLOW_MS = 500;
const FREEZE_FRAME_SLOW_MS = 400;
const BLACKOUT_MODE_MS = 2000;
const BLACKOUT_EXIT_SLOW_MS = 260;
const VIDEO_EDIT_PAUSE_MS = 2000;
const VIDEO_EDIT_READY_DELAY_MS = 1000;
const DEFAULT_VIDEO_EDIT_VS_SECONDS = 3;
const SETTINGS_VERSION = 2;
const SPEED_MODE_MIN_BALL_SPEED = 5.5;
const NORMAL_MODE_MIN_BALL_SPEED = 1.15;
const NORMAL_MODE_RESCUE_COOLDOWN_MS = 900;
const AUTO_MODE_TRIGGER_CHARGE = 100;
const AUTO_MODE_COOLDOWN_MS = 9000;
const TEMP_MODE_ARENA_COLORS = {
    speed: ['#00f2ff', '#67e8f9', '#ffffff'],
    speed4: ['#ff2bd6', '#facc15', '#ffffff'],
    twoGoals: ['#f97316', '#facc15', '#fff7ed'],
    singleBallGoals: ['#f8fafc', '#67e8f9', '#ffffff'],
    reverse: ['#a855f7', '#ec4899', '#f5d0fe'],
    shrink: ['#10b981', '#2dd4bf', '#d1fae5'],
    multiBall: ['#3b82f6', '#f43f5e', '#dbeafe'],
    goldenTouch: ['#facc15', '#f97316', '#fff7ad'],
    freezeFrame: ['#bfdbfe', '#60a5fa', '#ffffff'],
    bumper: ['#22c55e', '#84cc16', '#f7fee7'],
    tinyBall: ['#2dd4bf', '#60a5fa', '#ccfbf1'],
    heavyBall: ['#f59e0b', '#78716c', '#ffedd5'],
    goalSwap: ['#d946ef', '#0ea5e9', '#fae8ff'],
    stopCircle: ['#f8fafc', '#38bdf8', '#a78bfa'],
    stealPoint: ['#f43f5e', '#facc15', '#ffe4e6'],
    goalErase: ['#f8fafc', '#ef4444', '#94a3b8'],
    blackout: ['#0f172a', '#38bdf8', '#f8fafc'],
    lastGoalWins: ['#f43f5e', '#facc15', '#ffffff'],
    arenaDepth: ['#22d3ee', '#818cf8', '#f8fafc'],
    clutch: ['#ef4444', '#fb923c', '#ffffff']
};
let activeTempMode = null;
let tempModeTimeout = null;
let tempModeIntroTimeout = null;
let blackoutExitHold = false;
let blackoutExitTimeout = null;
let overtimeTimerFxTimeout = null;
let overtimeResumeTimeout = null;
let tempModeTriggeredByAuto = false;
let finalRushActive = false;
let finalRushSoundPlayed = false;
let autoModeEnabled = false;
let autoModeCharge = 0;
let autoModeLastUpdate = performance.now();
let autoModeLastTriggerAt = 0;
let autoModeLastEventAt = 0;
let autoModeLastMode = null;
let isGoalCinematic = false;
let scenarioLastFailsafeAt = 0;
let videoEditMode = false;
let preMatchTimeouts = [];
let preMatchCountdownInterval = null;
let hookOddsInterval = null;
let hookOddsSettleTimeout = null;
let hookOddsSoundTimeout = null;
let subscribeVideo, subscribeCanvas, subscribeCtx;
let subscribeFinalTimeout = null;
let subscribeHideTimeout = null;
let matchEndSlowTimeout = null;
let matchEndSpotlightTimeout = null;
let matchEndGlitchTimeout = null;
let matchEndImpactTimeout = null;
let goalCinematicTimeout = null;
let goalScoreSpinInterval = null;
let modeFadeTimeout = null;
let scoringStreakTeam = null;
let scoringStreakCount = 0;
let lastGoalGameSecond = null;
let lastAutoManualBurstAt = 0;
let lastUnrealBurstAt = 0;
let pendingUnrealBurstTimeout = null;
let fuseSparkRandomizerInterval = null;
let matchClockFrameId = null;
let matchClockTickStartedAt = performance.now();
let matchClockTickBaseTimeLeft = 0;
let bestFrameDataUrl = null;
let bestFrameScore = 0;
let bestFrameReason = '';
let bestFrameCapturedAt = 0;
let lastBestFrameCheckAt = 0;
let bestFrameCaptureScheduled = false;
let bestFrameCaptureGeneration = 0;

const i18n = {
    tr: {
        simSettings: '<i class="icon-settings"></i> SİMÜLASYON AYARLARI',
        genSettings: 'GENEL AYARLAR',
        simTitle: 'Simülasyon Başlığı',
        matchDuration: 'Maç Süresi (Saniye)',
        matchType: 'Maç Tipi',
        matchTypeNormal: 'Normal',
        matchTypeDerby: 'Derbi',
        matchTypeFinal: 'Final',
        matchTypeChaos: 'Kaos',
        matchTypeRematch: 'Rövanş',
        autoModeToggle: 'Kaos Barı',
        autoModeBar: 'KAOS BARI',
        autoModePriority: 'Kaos Önceliği',
        autoModePriorityMixed: 'Karışık',
        autoModePool: 'Kaos Mod Havuzu',
        timerStyle: 'Süre Görünümü',
        timerStyleClassic: 'Klasik Sayaç',
        timerStyleFuse: 'Fitil Bar',
        timerStyleMatchClock: '90 Dakika Saati',
        matchClockLabel: 'MAÇ SAATİ',
        allowDrawToggle: 'Beraberlik Modu',
        oddsFavoriteTeam: 'Oran Favorisi',
        oddsFavoritePercent: 'Favori Oranı',
        miniThreatToggle: 'Hook Yazısı',
        coldOpenToggle: 'Cold Open Video',
        scenarioModeToggle: 'Senaryo Modu',
        scenarioLeadTeam: 'İlk Önde Gidecek',
        scenarioLeadUntil: 'Kaçıncı Saniyeye Kadar',
        scenarioWinnerTeam: 'Final Kazanan',
        scenarioStrength: 'Müdahale Gücü',
        scenarioLow: 'Düşük',
        scenarioMedium: 'Orta',
        scenarioHigh: 'Yüksek',
        scenarioFailsafeToggle: 'Son Saniye Garantisi',
        experimentalFxSettings: 'DENEYSEL EFEKTLER',
        winnerFxToggle: 'Winner FX',
        finalRushFxToggle: 'Final Rush FX',
        extraGlowFxToggle: 'Extra Glow',
        soundPriorityToggle: 'Sound Priority',
        lowPerformanceToggle: 'Low Performance Mode',
        videoEditModeToggle: 'Video Edit Modu',
        videoEditVsDuration: 'Edit VS Süresi',
        arenaSelect: 'Arena / Pitch',
        arenaUpload: 'Arena Görselleri',
        selectArenas: 'Arena Seç',
        deleteArenaPreset: 'ARENAYI SİL',
        deleteTeamPreset: 'TAKIMI SİL',
        presetDeleteOnlyCustom: 'Sadece kaydettiğin özel kayıtlar silinebilir.',
        confirmDeletePreset: 'Bu kaydı silmek istiyor musunuz?',
        manualTextSettings: 'MANUEL YAZILAR',
        manualCustomPlaceholder: 'Kendi yazını yaz',
        manualCustomShow: 'GÖSTER',
        manualLetsGo: 'BAŞLIYOR!',
        manualSoClose: 'ÇOK YAKIN!',
        manualWhatASave: 'KURTARDI!',
        manualPost: 'DİREKTEN!',
        manualChaos: 'KAOS!',
        manualNextGoal: 'SIRADAKİ GOL?',
        manualClutch: 'KRİTİK AN!',
        manualLastSecond: 'SON SANİYE!',
        manualComeback: 'GERİ DÖNÜŞ?',
        manualUnreal: 'İNANILMAZ!',
        teamConfig: 'TAKIM YAPILANDIRMASI',
        team1: '1. TAKIM',
        team2: '2. TAKIM',
        teamPreset: 'Hazır Takım',
        manualTeam: 'Manuel',
        saveTeamPreset: 'TAKIMI KAYDET',
        teamPresetSaved: 'KAYDEDİLDİ',
        teamPresetStorageError: 'Takım kaydedilemedi. Logo veya arena görseli çok büyük olabilir.',
        color: 'Renk 1',
        color2: 'Renk 2',
        logo: 'Logo',
        color3: 'Renk 3',
        addColor: '+ RENK',
        select: 'Seç',
        physicsSettings: 'FİZİK VE HIZ AYARLARI',
        rotSpeed: 'Dönüş Hızı',
        launchPower: 'Fırlatma Gücü',
        bounciness: 'Sekme Oranı',
        airRes: 'Hava Direnci',
        modeSettings: 'ANLIK MODLAR',
        speedMode: '2X HIZ',
        speed4Mode: '4X HIZ',
        twoGoalMode: '2 KALE',
        singleBallGoalMode: 'TEK TOP 2 KALE',
        reverseMode: 'TERS DÖNÜŞ',
        shrinkMode: 'DAR ÇEMBER',
        multiBallMode: 'ÇİFT TOP',
        goldenTouchMode: 'ALTIN DOKUNUŞ',
        freezeFrameMode: 'ZAMANI DONDUR',
        bumperMode: 'TAMPON MODU',
        tinyBallMode: 'MİNİ TOP',
        heavyBallMode: 'AĞIR TOP',
        goalSwapMode: 'KALE DEĞİŞ',
        stopCircleMode: 'DAİRE DUR',
        stealPointMode: 'PUAN ÇAL',
        goalEraseMode: 'GOL SİL',
        blackoutMode: 'BLACKOUT',
        lastGoalWinsMode: 'SON GOL KAZANIR',
        arenaDepthMode: 'ARENA DERİNLİĞİ',
        clutchMode: 'KRİTİK AN',
        speedModeOverlay: '2X HIZ!',
        speed4ModeOverlay: '4X HIZ!',
        twoGoalModeOverlay: 'ÇİFT KALE!',
        singleBallGoalModeOverlay: 'TEK TOP!',
        reverseModeOverlay: 'TERS DÖNÜŞ!',
        shrinkModeOverlay: 'DAR ÇEMBER!',
        multiBallModeOverlay: 'ÇİFT TOP!',
        goldenTouchModeOverlay: 'ÇİFT PUAN!',
        freezeFrameModeOverlay: 'ZAMAN DONDU!',
        bumperModeOverlay: 'TAMPON MODU!',
        tinyBallModeOverlay: 'MİNİ TOP!',
        heavyBallModeOverlay: 'AĞIR TOP!',
        goalSwapModeOverlay: 'KALE DEĞİŞTİ!',
        stopCircleModeOverlay: 'DAİRE DURDU!',
        stealPointModeOverlay: 'PUAN ÇAL!',
        goalEraseModeOverlay: 'GOL SİL!',
        blackoutModeOverlay: 'BLACKOUT!',
        lastGoalWinsModeOverlay: 'SON GOL KAZANIR!',
        arenaDepthModeOverlay: 'ARENA DERİNLİĞİ!',
        clutchModeOverlay: 'KRİTİK AN!',
        pause: 'DURDUR',
        resume: 'DEVAM ET',
        sound: 'SES',
        muted: 'SES KAPALI',
        showBestFrame: 'En İyi Kareyi Göster',
        bestFrameTitle: 'EN İYİ KARE',
        bestFrameEmpty: 'Henüz kare yakalanmadı',
        bestFrameGoal: 'Gol anı',
        bestFrameMode: 'Mod başlangıcı',
        bestFrameNearGoal: 'Kaleye yakın an',
        bestFrameFinal: 'Son saniye baskısı',
        startSim: 'SİMÜLASYONU BAŞLAT',
        resetMatch: 'Maçı Sıfırla',
        resetAll: 'Tüm Ayarları Sıfırla',
        winner: 'KAZANAN',
        drawResult: 'BERABERE',
        drawName: 'MAÇ BERABERE',
        overtime: 'UZATMALAR',
        whoWillWin: 'KİM KAZANACAK?',
        goal: 'GOOOL!',
        newMatch: 'YENİ MAÇ',
        defaultTitle: 'KİM KAZANACAK?',
        confirmReset: 'Tüm ayarlar orijinal referans değerlerine sıfırlanacak. Emin misiniz?',
        confirmMatchReset: 'Maç sıfırlanacak; logo, arena, renk ve ayarlar korunacak. Emin misiniz?'
    },
    en: {
        simSettings: '<i class="icon-settings"></i> SIMULATION SETTINGS',
        genSettings: 'GENERAL SETTINGS',
        simTitle: 'Simulation Title',
        matchDuration: 'Match Duration (Seconds)',
        matchType: 'Match Type',
        matchTypeNormal: 'Normal',
        matchTypeDerby: 'Derby',
        matchTypeFinal: 'Final',
        matchTypeChaos: 'Chaos',
        matchTypeRematch: 'Rematch',
        autoModeToggle: 'Chaos Bar',
        autoModeBar: 'CHAOS BAR',
        autoModePriority: 'Chaos Priority',
        autoModePriorityMixed: 'Mixed',
        autoModePool: 'Chaos Mode Pool',
        timerStyle: 'Timer Style',
        timerStyleClassic: 'Classic Timer',
        timerStyleFuse: 'Fuse Bar',
        timerStyleMatchClock: '90 Minute Clock',
        matchClockLabel: 'MATCH TIME',
        allowDrawToggle: 'Draw Mode',
        oddsFavoriteTeam: 'Odds Favorite',
        oddsFavoritePercent: 'Favorite Odds',
        miniThreatToggle: 'Hook Line',
        coldOpenToggle: 'Cold Open Video',
        scenarioModeToggle: 'Scenario Mode',
        scenarioLeadTeam: 'Early Leader',
        scenarioLeadUntil: 'Lead Until Second',
        scenarioWinnerTeam: 'Final Winner',
        scenarioStrength: 'Intervention Strength',
        scenarioLow: 'Low',
        scenarioMedium: 'Medium',
        scenarioHigh: 'High',
        scenarioFailsafeToggle: 'Last-Second Guarantee',
        experimentalFxSettings: 'EXPERIMENTAL FX',
        winnerFxToggle: 'Winner FX',
        finalRushFxToggle: 'Final Rush FX',
        extraGlowFxToggle: 'Extra Glow',
        soundPriorityToggle: 'Sound Priority',
        lowPerformanceToggle: 'Low Performance Mode',
        videoEditModeToggle: 'Video Edit Mode',
        videoEditVsDuration: 'Edit VS Duration',
        arenaSelect: 'Arena / Pitch',
        arenaUpload: 'Arena Images',
        selectArenas: 'Select Arenas',
        deleteArenaPreset: 'DELETE ARENA',
        deleteTeamPreset: 'DELETE TEAM',
        presetDeleteOnlyCustom: 'Only custom saved presets can be deleted.',
        confirmDeletePreset: 'Delete this saved preset?',
        manualTextSettings: 'MANUAL TEXTS',
        manualCustomPlaceholder: 'Write your text',
        manualCustomShow: 'SHOW',
        manualLetsGo: "LET'S GO!",
        manualSoClose: 'SO CLOSE!',
        manualWhatASave: 'WHAT A SAVE!',
        manualPost: 'OFF THE POST!',
        manualChaos: 'CHAOS!',
        manualNextGoal: 'NEXT GOAL?',
        manualClutch: 'CLUTCH!',
        manualLastSecond: 'LAST SECOND!',
        manualComeback: 'COMEBACK?',
        manualUnreal: 'UNREAL!',
        teamConfig: 'TEAM CONFIGURATION',
        team1: 'TEAM 1',
        team2: 'TEAM 2',
        teamPreset: 'Team Preset',
        manualTeam: 'Manual',
        saveTeamPreset: 'SAVE TEAM',
        teamPresetSaved: 'SAVED',
        teamPresetStorageError: 'Team could not be saved. The logo or arena image may be too large.',
        color: 'Color 1',
        color2: 'Color 2',
        logo: 'Logo',
        color3: 'Color 3',
        addColor: '+ COLOR',
        select: 'Select',
        physicsSettings: 'PHYSICS AND SPEED SETTINGS',
        rotSpeed: 'Rotation Speed',
        launchPower: 'Launch Power',
        bounciness: 'Bounciness',
        airRes: 'Air Resistance',
        modeSettings: 'LIVE MODES',
        speedMode: '2X SPEED',
        speed4Mode: '4X SPEED',
        twoGoalMode: '2 GOALS',
        singleBallGoalMode: 'ONE BALL 2 GOALS',
        reverseMode: 'REVERSE SPIN',
        shrinkMode: 'SHRINK RING',
        multiBallMode: 'DOUBLE BALL',
        goldenTouchMode: 'GOLDEN TOUCH',
        freezeFrameMode: 'FREEZE FRAME',
        bumperMode: 'BUMPER MODE',
        tinyBallMode: 'TINY BALL',
        heavyBallMode: 'HEAVY BALL',
        goalSwapMode: 'GOAL SWAP',
        stopCircleMode: 'STOP RING',
        stealPointMode: 'STEAL POINT',
        goalEraseMode: 'ERASE GOAL',
        blackoutMode: 'BLACKOUT',
        lastGoalWinsMode: 'LAST GOAL WINS',
        arenaDepthMode: 'ARENA DEPTH',
        clutchMode: 'CLUTCH TIME',
        speedModeOverlay: '2X SPEED!',
        speed4ModeOverlay: '4X SPEED!',
        twoGoalModeOverlay: 'DOUBLE GOAL!',
        singleBallGoalModeOverlay: 'ONE BALL!',
        reverseModeOverlay: 'REVERSE SPIN!',
        shrinkModeOverlay: 'SHRINK RING!',
        multiBallModeOverlay: 'DOUBLE BALL!',
        goldenTouchModeOverlay: 'DOUBLE POINTS!',
        freezeFrameModeOverlay: 'FREEZE FRAME!',
        bumperModeOverlay: 'BUMPER MODE!',
        tinyBallModeOverlay: 'TINY BALL!',
        heavyBallModeOverlay: 'HEAVY BALL!',
        goalSwapModeOverlay: 'GOAL SWAP!',
        stopCircleModeOverlay: 'RING STOP!',
        stealPointModeOverlay: 'STEAL POINT!',
        goalEraseModeOverlay: 'ERASE GOAL!',
        blackoutModeOverlay: 'BLACKOUT!',
        lastGoalWinsModeOverlay: 'LAST GOAL WINS!',
        arenaDepthModeOverlay: 'ARENA DEPTH!',
        clutchModeOverlay: 'CLUTCH TIME!',
        pause: 'PAUSE',
        resume: 'RESUME',
        sound: 'SOUND',
        muted: 'MUTED',
        showBestFrame: 'Show Best Frame',
        bestFrameTitle: 'BEST FRAME',
        bestFrameEmpty: 'No frame captured yet',
        bestFrameGoal: 'Goal moment',
        bestFrameMode: 'Mode start',
        bestFrameNearGoal: 'Near-goal moment',
        bestFrameFinal: 'Final pressure',
        startSim: 'START SIMULATION',
        resetMatch: 'Reset Match',
        resetAll: 'Reset All Settings',
        winner: 'WINNER',
        drawResult: 'DRAW',
        drawName: 'MATCH DRAW',
        overtime: 'OVERTIME',
        whoWillWin: 'WHO WILL WIN?',
        goal: 'GOAAL!',
        newMatch: 'NEW MATCH',
        defaultTitle: 'WHO WILL WIN?',
        confirmReset: 'All settings will be reset to original reference values. Are you sure?',
        confirmMatchReset: 'The match will reset while logos, arena, colors and settings stay as they are. Are you sure?'
    }
};

function setLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[lang][key]) {
            el.innerHTML = i18n[lang][key];
        }
    });
    setTempModeVisuals(activeTempMode);
    const titleInput = document.getElementById('mainTitle');
    if (titleInput.value === i18n['tr'].defaultTitle || titleInput.value === i18n['en'].defaultTitle) {
        titleInput.value = i18n[lang].defaultTitle;
    }
    titleInput.placeholder = i18n[lang].defaultTitle;
    
    const pBtn = document.getElementById('pauseGame');
    if (pBtn) {
        if (pBtn.classList.contains('active')) {
            pBtn.innerText = i18n[lang].resume;
        } else {
            pBtn.innerText = i18n[lang].pause;
        }
    }
    
    const sBtn = document.getElementById('muteSound');
    if (sBtn) {
        if (isMuted) {
            sBtn.innerText = i18n[lang].muted;
        } else {
            sBtn.innerText = i18n[lang].sound;
        }
    }
    const customTextInput = document.getElementById('manualCustomText');
    if (customTextInput) customTextInput.placeholder = i18n[lang].manualCustomPlaceholder;
}

function normalizeSavedTitle(title) {
    const knownDefaults = new Set([
        i18n.tr.defaultTitle,
        i18n.en.defaultTitle,
        'KİM KAZANACAK?',
        ['K', '\u00c4', '\u00b0', 'M KAZANACAK?'].join(''),
        'WHO WILL WIN?'
    ]);
    return knownDefaults.has(title) ? i18n[currentLang].defaultTitle : title;
}

const DEFAULT_ARENA_SRC = config.arenaBackground;
const TEAM_PRESET_MANUAL = 'manual';
const CUSTOM_TEAM_PRESETS_KEY = 'reelsSimCustomTeamPresets';
const CUSTOM_ARENAS_KEY = 'reelsSimCustomArenas';
const SAVED_LOGO_MAX_SIZE = 360;
const SAVED_ARENA_MAX_WIDTH = 720;
const SAVED_ARENA_MAX_HEIGHT = 1280;
const MAX_STORED_DATA_URL_LENGTH = 900000;
let arenaOptions = [];
let teamPresetOptions = [];
let arenaBackgroundImage = null;
let arenaBackgroundImageSrc = '';

function getArenaManifestOptions() {
    const manifest = Array.isArray(window.REELSSIM_ARENAS) && window.REELSSIM_ARENAS.length
        ? window.REELSSIM_ARENAS
        : [{ name: 'Neon Pitch', file: 'pitch.png' }];

    const builtInArenas = manifest.map((entry) => {
        const item = typeof entry === 'string' ? { file: entry } : entry;
        const file = item.file || item.src || 'pitch.png';
        const src = item.src || `assets/images/arenas/${file}`;
        const name = item.name || file.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
        return { name, src, persistable: true };
    });
    const customArenas = getStoredCustomArenas();
    return [...builtInArenas, ...customArenas].filter((arena, index, list) =>
        arena.src && list.findIndex(item => item.src === arena.src) === index
    );
}

function getStoredCustomArenas() {
    try {
        const saved = JSON.parse(localStorage.getItem(CUSTOM_ARENAS_KEY) || '[]');
        const cleaned = Array.isArray(saved)
            ? saved.filter(item => item && item.src).map(item => ({
                name: item.name || 'Custom Arena',
                src: item.src,
                persistable: true,
                custom: true
            })).filter(item => !isOversizedStoredImage(item.src))
            : [];
        if (Array.isArray(saved) && cleaned.length !== saved.length) saveStoredCustomArenas(cleaned);
        return cleaned;
    } catch (error) {
        console.warn('Custom arenas could not be loaded', error);
        return [];
    }
}

function saveStoredCustomArenas(arenas) {
    const custom = arenas
        .filter(arena => arena.custom && arena.src)
        .filter(arena => !isOversizedStoredImage(arena.src))
        .filter((arena, index, list) => list.findIndex(item => item.src === arena.src) === index)
        .slice(-12)
        .map(arena => ({ name: arena.name || 'Custom Arena', src: arena.src }));
    try {
        localStorage.setItem(CUSTOM_ARENAS_KEY, JSON.stringify(custom));
    } catch (error) {
        console.warn('Custom arenas could not be saved', error);
    }
}

function isOversizedStoredImage(src) {
    return typeof src === 'string' && src.startsWith('data:image/') && src.length > MAX_STORED_DATA_URL_LENGTH;
}

function setArenaBackground(src = DEFAULT_ARENA_SRC) {
    config.arenaBackground = src || DEFAULT_ARENA_SRC;
    document.documentElement.style.setProperty('--arena-bg', `url("${config.arenaBackground.replace(/"/g, '\\"')}")`);
    if (arenaBackgroundImage && arenaBackgroundImageSrc === config.arenaBackground) return;
    arenaBackgroundImageSrc = config.arenaBackground;
    arenaBackgroundImage = new Image();
    arenaBackgroundImage.onload = () => {};
    arenaBackgroundImage.onerror = () => {
        if (arenaBackgroundImageSrc === config.arenaBackground) arenaBackgroundImage = null;
    };
    arenaBackgroundImage.src = config.arenaBackground;
}

function populateArenaSelect(selectedSrc = config.arenaBackground) {
    const select = document.getElementById('arenaSelect');
    if (!select) return;
    if (selectedSrc && !arenaOptions.some(arena => arena.src === selectedSrc)) {
        arenaOptions.push({ name: 'Saved Arena', src: selectedSrc, persistable: true, custom: true });
    }
    arenaOptions = arenaOptions.filter((arena, index, list) =>
        arena.src && list.findIndex(item => item.src === arena.src) === index
    );
    select.innerHTML = '';
    arenaOptions.forEach((arena, index) => {
        const option = document.createElement('option');
        option.value = arena.src;
        option.innerText = arena.name;
        option.dataset.persistable = arena.persistable ? 'true' : 'false';
        option.dataset.custom = arena.custom ? 'true' : 'false';
        if (arena.src === selectedSrc || (!selectedSrc && index === 0)) option.selected = true;
        select.appendChild(option);
    });
    if (!select.value && arenaOptions[0]) select.value = arenaOptions[0].src;
    setArenaBackground(select.value || DEFAULT_ARENA_SRC);
    updatePresetDeleteButtons();
}

function getPersistableArenaSelection() {
    const select = document.getElementById('arenaSelect');
    if (!select || !select.value) return DEFAULT_ARENA_SRC;
    const option = select.options[select.selectedIndex];
    return option && option.dataset.persistable === 'true' ? select.value : DEFAULT_ARENA_SRC;
}

function getSelectedArenaOption() {
    const select = document.getElementById('arenaSelect');
    if (!select || select.selectedIndex < 0) return null;
    return select.options[select.selectedIndex];
}

function getStoredTeamPresets() {
    try {
        const saved = JSON.parse(localStorage.getItem(CUSTOM_TEAM_PRESETS_KEY) || '[]');
        if (!Array.isArray(saved)) return [];
        const cleaned = saved.map(entry => ({
            ...entry,
            logo: isOversizedStoredImage(entry.logo) ? '' : entry.logo,
            arena: isOversizedStoredImage(entry.arena) ? '' : entry.arena
        }));
        const changed = cleaned.some((entry, index) => entry.logo !== saved[index]?.logo || entry.arena !== saved[index]?.arena);
        if (changed) localStorage.setItem(CUSTOM_TEAM_PRESETS_KEY, JSON.stringify(cleaned));
        return cleaned;
    } catch (error) {
        console.warn('Custom team presets could not be loaded', error);
        return [];
    }
}

function saveStoredTeamPresets(presets) {
    try {
        localStorage.setItem(CUSTOM_TEAM_PRESETS_KEY, JSON.stringify(presets));
    } catch (error) {
        const compact = presets.slice(-24);
        localStorage.setItem(CUSTOM_TEAM_PRESETS_KEY, JSON.stringify(compact));
    }
}

function slugifyPresetName(name) {
    return (name || 'team')
        .toString()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'team';
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function loadImageSource(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

async function resizeImageSourceToDataUrl(src, options = {}) {
    if (!src || !String(src).startsWith('data:image/')) return src;
    const {
        maxWidth = 720,
        maxHeight = 1280,
        type = 'image/jpeg',
        quality = 0.78,
        square = false,
        circle = false
    } = options;
    try {
        const img = await loadImageSource(src);
        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = img.naturalWidth || img.width;
        let sourceHeight = img.naturalHeight || img.height;
        if (square) {
            const size = Math.min(sourceWidth, sourceHeight);
            sourceX = (sourceWidth - size) / 2;
            sourceY = (sourceHeight - size) / 2;
            sourceWidth = size;
            sourceHeight = size;
        }
        const ratio = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
        const width = Math.max(1, Math.round(sourceWidth * ratio));
        const height = Math.max(1, Math.round(sourceHeight * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return src;
        if (type === 'image/jpeg') {
            ctx.fillStyle = '#050816';
            ctx.fillRect(0, 0, width, height);
        }
        if (circle) {
            ctx.beginPath();
            ctx.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
        }
        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
        return canvas.toDataURL(type, quality);
    } catch (error) {
        console.warn('Image could not be optimized for storage', error);
        return src;
    }
}

async function optimizeArenaSourceForStorage(src, compact = false) {
    return resizeImageSourceToDataUrl(src, {
        maxWidth: compact ? 540 : SAVED_ARENA_MAX_WIDTH,
        maxHeight: compact ? 960 : SAVED_ARENA_MAX_HEIGHT,
        type: 'image/jpeg',
        quality: compact ? 0.62 : 0.78
    });
}

async function optimizeLogoSourceForStorage(src, compact = false) {
    return resizeImageSourceToDataUrl(src, {
        maxWidth: compact ? 240 : SAVED_LOGO_MAX_SIZE,
        maxHeight: compact ? 240 : SAVED_LOGO_MAX_SIZE,
        type: 'image/png',
        quality: 0.9,
        square: true,
        circle: true
    });
}

function normalizePresetAssetPath(value, basePath) {
    if (!value) return '';
    if (/^(https?:|data:|blob:|assets\/)/i.test(value)) return value;
    return `${basePath}${value}`;
}

function getTeamPresetManifestOptions() {
    const manifest = Array.isArray(window.REELSSIM_TEAMS) ? window.REELSSIM_TEAMS : [];
    const builtInPresets = manifest
        .map((entry) => {
            if (!entry || entry.manual) return null;
            const id = entry.id || (entry.name || '').toLowerCase().replace(/\s+/g, '-');
            const name = entry.name || entry.shortName || id;
            if (!id || !name) return null;
            const logoFile = entry.logo || entry.logoFile || entry.file || '';
            const arenaFile = entry.arena || entry.arenaFile || '';
            return {
                id,
                name,
                shortName: entry.shortName || name,
                color: entry.color || '#ffffff',
                color2: entry.color2 || entry.secondaryColor || '#111827',
                color3: entry.color3 || '#ffffff',
                useColor3: !!entry.useColor3,
                logo: normalizePresetAssetPath(logoFile, 'assets/images/teams/'),
                arena: normalizePresetAssetPath(arenaFile, 'assets/images/arenas/')
            };
        })
        .filter(Boolean);

    const storedPresets = getStoredTeamPresets()
        .map((entry) => ({
            id: entry.id,
            name: entry.name,
            shortName: entry.shortName || entry.name,
            color: entry.color || '#ffffff',
            color2: entry.color2 || '#111827',
            color3: entry.color3 || '#ffffff',
            useColor3: !!entry.useColor3,
            logo: entry.logo || '',
            arena: entry.arena || '',
            custom: true
        }))
        .filter(entry => entry.id && entry.name);

    return [...builtInPresets, ...storedPresets];
}

function populateTeamPresetSelects(selected1 = TEAM_PRESET_MANUAL, selected2 = TEAM_PRESET_MANUAL) {
    [1, 2].forEach((teamNum) => {
        const select = document.getElementById(`team${teamNum}Preset`);
        if (!select) return;
        const selected = teamNum === 1 ? selected1 : selected2;
        select.innerHTML = '';
        const manualOption = document.createElement('option');
        manualOption.value = TEAM_PRESET_MANUAL;
        manualOption.dataset.i18n = 'manualTeam';
        manualOption.innerText = i18n[currentLang]?.manualTeam || 'Manual';
        select.appendChild(manualOption);
        teamPresetOptions.forEach((preset) => {
            const option = document.createElement('option');
            option.value = preset.id;
            option.innerText = preset.custom ? `${preset.name} ★` : preset.name;
            select.appendChild(option);
        });
        select.value = teamPresetOptions.some(preset => preset.id === selected) ? selected : TEAM_PRESET_MANUAL;
    });
}

function getTeamPresetById(presetId) {
    return teamPresetOptions.find(preset => preset.id === presetId) || null;
}

function updatePresetDeleteButtons() {
    const arenaOption = getSelectedArenaOption();
    const deleteArena = document.getElementById('deleteArenaPreset');
    if (deleteArena) deleteArena.disabled = !(arenaOption && arenaOption.dataset.custom === 'true');
    [1, 2].forEach((teamNum) => {
        const select = document.getElementById(`team${teamNum}Preset`);
        const button = document.getElementById(`deleteTeam${teamNum}Preset`);
        const preset = getTeamPresetById(select?.value);
        if (button) button.disabled = !(preset && preset.custom);
    });
}

function getTeamLogoElementIds(teamNum) {
    return teamNum === 1 ? ['introLogo1', 'idleLogo1', 'hookLogo1'] : ['introLogo2', 'idleLogo2', 'hookLogo2'];
}

function setTeamLogoBackgrounds(teamNum, src = '') {
    getTeamLogoElementIds(teamNum).forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.backgroundImage = src ? `url(${src})` : '';
    });
}

function clearTeamLogo(teamNum) {
    const team = teamNum === 1 ? config.team1 : config.team2;
    team.logo = null;
    setTeamLogoBackgrounds(teamNum, '');
}

function loadTeamLogoFromSource(teamNum, src) {
    if (!src) {
        clearTeamLogo(teamNum);
        updateIntroUI();
        return;
    }

    const team = teamNum === 1 ? config.team1 : config.team2;
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, size, size);

        const circularDataUrl = canvas.toDataURL('image/png');
        const logo = new Image();
        logo.onload = () => {
            team.logo = logo;
            updateIntroUI();
        };
        logo.src = circularDataUrl;
    };
    img.onerror = () => {
        clearTeamLogo(teamNum);
        updateIntroUI();
    };
    img.src = src;
}

function selectArenaFromPreset(src, label = 'Preset Arena') {
    if (!src) return;
    const select = document.getElementById('arenaSelect');
    if (!select) return;
    if (!arenaOptions.some(arena => arena.src === src)) {
        arenaOptions.push({ name: label, src, persistable: true });
        populateArenaSelect(src);
        return;
    }
    select.value = src;
    setArenaBackground(src);
    updateTimerVisuals();
}

function loadPresetLogoOnly(teamNum, presetId) {
    const preset = getTeamPresetById(presetId);
    if (!preset) {
        clearTeamLogo(teamNum);
        return;
    }
    loadTeamLogoFromSource(teamNum, preset.logo);
}

function applyTeamPreset(teamNum, presetId, options = {}) {
    const preset = getTeamPresetById(presetId);
    if (!preset) {
        saveCurrentSettings();
        return;
    }

    const nameInput = document.getElementById(`team${teamNum}Name`);
    const colorInput = document.getElementById(`team${teamNum}Color`);
    const color2Input = document.getElementById(`team${teamNum}Color2`);
    const color3Input = document.getElementById(`team${teamNum}Color3`);
    if (nameInput) nameInput.value = preset.name;
    if (colorInput) colorInput.value = preset.color;
    if (color2Input) color2Input.value = preset.color2;
    if (color3Input) color3Input.value = preset.color3;
    setThirdColorEnabled(teamNum, !!preset.useColor3);
    loadTeamLogoFromSource(teamNum, preset.logo);

    if (preset.arena) {
        selectArenaFromPreset(preset.arena, `${preset.name} Arena`);
    }

    applySettingsToConfig();
    if (options.save !== false) saveCurrentSettings();
}

function getCurrentArenaForTeamPreset() {
    const select = document.getElementById('arenaSelect');
    return select?.value || config.arenaBackground || DEFAULT_ARENA_SRC;
}

function refreshTeamPresetOptions(selected1 = document.getElementById('team1Preset')?.value, selected2 = document.getElementById('team2Preset')?.value) {
    teamPresetOptions = getTeamPresetManifestOptions();
    populateTeamPresetSelects(selected1, selected2);
}

function flashTeamSaveButton(teamNum) {
    const button = document.getElementById(`saveTeam${teamNum}Preset`);
    if (!button) return;
    const original = i18n[currentLang].saveTeamPreset;
    button.innerText = i18n[currentLang].teamPresetSaved;
    button.classList.add('active');
    setTimeout(() => {
        button.innerText = original;
        button.classList.remove('active');
    }, 900);
}

async function saveCurrentTeamAsPreset(teamNum) {
    applySettingsToConfig();
    const team = teamNum === 1 ? config.team1 : config.team2;
    const name = (document.getElementById(`team${teamNum}Name`)?.value || team.name || `Team ${teamNum}`).trim();
    const id = `custom-${slugifyPresetName(name)}`;
    const logoSrc = await optimizeLogoSourceForStorage(team.logo?.src || '');
    const arenaSrc = await optimizeArenaSourceForStorage(getCurrentArenaForTeamPreset());
    const preset = {
        id,
        name,
        shortName: name.substring(0, 3).toUpperCase(),
        color: document.getElementById(`team${teamNum}Color`)?.value || team.color,
        color2: document.getElementById(`team${teamNum}Color2`)?.value || team.color2,
        color3: document.getElementById(`team${teamNum}Color3`)?.value || team.color3,
        useColor3: !!team.useColor3,
        logo: logoSrc,
        arena: arenaSrc
    };

    try {
        const stored = getStoredTeamPresets().filter(entry => entry.id !== id);
        stored.push(preset);
        saveStoredTeamPresets(stored);
        const otherSelected = document.getElementById(`team${teamNum === 1 ? 2 : 1}Preset`)?.value || TEAM_PRESET_MANUAL;
        refreshTeamPresetOptions(teamNum === 1 ? id : otherSelected, teamNum === 2 ? id : otherSelected);
        const currentSelect = document.getElementById(`team${teamNum}Preset`);
        if (currentSelect) currentSelect.value = id;
        saveCurrentSettings();
        flashTeamSaveButton(teamNum);
    } catch (error) {
        try {
            localStorage.removeItem(CUSTOM_ARENAS_KEY);
            preset.logo = await optimizeLogoSourceForStorage(preset.logo, true);
            preset.arena = await optimizeArenaSourceForStorage(preset.arena, true);
            const stored = getStoredTeamPresets().filter(entry => entry.id !== id);
            stored.push(preset);
            saveStoredTeamPresets(stored.slice(-16));
            const otherSelected = document.getElementById(`team${teamNum === 1 ? 2 : 1}Preset`)?.value || TEAM_PRESET_MANUAL;
            refreshTeamPresetOptions(teamNum === 1 ? id : otherSelected, teamNum === 2 ? id : otherSelected);
            const currentSelect = document.getElementById(`team${teamNum}Preset`);
            if (currentSelect) currentSelect.value = id;
            saveCurrentSettings();
            flashTeamSaveButton(teamNum);
        } catch (fallbackError) {
            console.warn('Custom team preset could not be saved', fallbackError);
            alert(i18n[currentLang].teamPresetStorageError);
        }
    }
}

function deleteSelectedArenaPreset() {
    const select = document.getElementById('arenaSelect');
    const option = getSelectedArenaOption();
    if (!select || !option || option.dataset.custom !== 'true') {
        alert(i18n[currentLang].presetDeleteOnlyCustom);
        return;
    }
    if (!confirm(i18n[currentLang].confirmDeletePreset)) return;
    const src = select.value;
    arenaOptions = arenaOptions.filter(arena => arena.src !== src);
    saveStoredCustomArenas(arenaOptions);

    const updatedTeams = getStoredTeamPresets().map((preset) => ({
        ...preset,
        arena: preset.arena === src ? '' : preset.arena
    }));
    saveStoredTeamPresets(updatedTeams);
    refreshTeamPresetOptions();
    populateArenaSelect(DEFAULT_ARENA_SRC);
    saveCurrentSettings();
    updateIntroUI();
}

function deleteSelectedTeamPreset(teamNum) {
    const select = document.getElementById(`team${teamNum}Preset`);
    const preset = getTeamPresetById(select?.value);
    if (!select || !preset || !preset.custom) {
        alert(i18n[currentLang].presetDeleteOnlyCustom);
        return;
    }
    if (!confirm(i18n[currentLang].confirmDeletePreset)) return;
    const stored = getStoredTeamPresets().filter(entry => entry.id !== preset.id);
    saveStoredTeamPresets(stored);
    const otherSelect = document.getElementById(`team${teamNum === 1 ? 2 : 1}Preset`);
    const otherSelected = otherSelect?.value === preset.id ? TEAM_PRESET_MANUAL : (otherSelect?.value || TEAM_PRESET_MANUAL);
    refreshTeamPresetOptions(teamNum === 1 ? TEAM_PRESET_MANUAL : otherSelected, teamNum === 2 ? TEAM_PRESET_MANUAL : otherSelected);
    const currentSelect = document.getElementById(`team${teamNum}Preset`);
    if (currentSelect) currentSelect.value = TEAM_PRESET_MANUAL;
    saveCurrentSettings();
    updatePresetDeleteButtons();
}

function getVideoEditVsDurationMs() {
    const input = document.getElementById('videoEditVsDuration');
    const seconds = Math.max(2, Math.min(15, parseFloat(input?.value) || DEFAULT_VIDEO_EDIT_VS_SECONDS));
    if (input && input.value !== String(seconds)) input.value = seconds;
    return seconds * 1000;
}

function getConfiguredOdds() {
    const favoriteTeam = parseInt(document.getElementById('oddsFavoriteTeam')?.value, 10) === 2 ? 2 : 1;
    const input = document.getElementById('oddsFavoritePercent');
    const favoritePercent = Math.max(50, Math.min(90, parseInt(input?.value, 10) || 58));
    if (input && input.value !== String(favoritePercent)) input.value = favoritePercent;
    const team1Percent = favoriteTeam === 1 ? favoritePercent : 100 - favoritePercent;
    return {
        team1: team1Percent,
        team2: 100 - team1Percent,
        favoriteTeam,
        favoritePercent
    };
}

function getRandomizedHookOdds() {
    const base = getConfiguredOdds();
    const drift = Math.floor(Math.random() * 9) - 4;
    const favoritePercent = Math.max(52, Math.min(64, base.favoritePercent + drift));
    const team1Percent = base.favoriteTeam === 1 ? favoritePercent : 100 - favoritePercent;
    return {
        team1: team1Percent,
        team2: 100 - team1Percent,
        favoriteTeam: base.favoriteTeam,
        favoritePercent
    };
}

function getScenarioSettingsFromPanel() {
    const strength = document.getElementById('scenarioStrength')?.value || 'medium';
    const leadUntilInput = document.getElementById('scenarioLeadUntil');
    const leadUntil = Math.max(5, Math.min(config.matchDuration - 1, parseInt(leadUntilInput?.value, 10) || 20));
    if (leadUntilInput && leadUntilInput.value !== String(leadUntil)) leadUntilInput.value = leadUntil;
    return {
        enabled: !!document.getElementById('scenarioModeToggle')?.checked,
        leadTeam: parseInt(document.getElementById('scenarioLeadTeam')?.value, 10) === 2 ? 2 : 1,
        leadUntil,
        winnerTeam: parseInt(document.getElementById('scenarioWinnerTeam')?.value, 10) === 1 ? 1 : 2,
        strength: ['low', 'medium', 'high'].includes(strength) ? strength : 'medium',
        failsafe: !!document.getElementById('scenarioFailsafeToggle')?.checked
    };
}

function getScenarioStrengthValue() {
    if (config.scenarioStrength === 'high') return 0.052;
    if (config.scenarioStrength === 'low') return 0.016;
    return 0.032;
}

function getScenarioPhase() {
    if (!config.scenarioEnabled || !isRunning || !isGameStarted || isEnding || overtimeCount > 0) return null;
    const elapsed = Math.max(0, config.matchDuration - timeLeft);
    const isLeadPhase = elapsed <= config.scenarioLeadUntil;
    const targetTeamNum = isLeadPhase ? config.scenarioLeadTeam : config.scenarioWinnerTeam;
    const target = targetTeamNum === 1 ? config.team1 : config.team2;
    const opponent = targetTeamNum === 1 ? config.team2 : config.team1;
    return { elapsed, isLeadPhase, targetTeamNum, target, opponent };
}

function chooseScenarioGoalPosition(ball) {
    if (hasOppositeGoalMode() && extraGoalSensor) {
        const d1 = Vector.magnitude(Vector.sub(goalSensor.position, ball.position));
        const d2 = Vector.magnitude(Vector.sub(extraGoalSensor.position, ball.position));
        return d2 < d1 ? extraGoalSensor.position : goalSensor.position;
    }
    return goalSensor.position;
}

function applyScenarioIntervention(ball, now) {
    const phase = getScenarioPhase();
    if (!phase || !ball || !ball.team) return;
    const targetScore = phase.target.score;
    const opponentScore = phase.opponent.score;
    const targetNeedsGoal = phase.isLeadPhase
        ? targetScore <= opponentScore
        : (targetScore <= opponentScore || (timeLeft <= 12 && targetScore <= opponentScore + 1));
    if (!targetNeedsGoal) return;

    const base = getScenarioStrengthValue();
    const urgency = phase.isLeadPhase ? 1 : (timeLeft <= 8 ? 1.85 : 1.25);
    const modeScale = activeTempMode ? 0.55 : 1;
    const force = base * urgency * modeScale;

    if (ball.team === phase.targetTeamNum) {
        const goalPos = chooseScenarioGoalPosition(ball);
        const toGoal = Vector.sub(goalPos, ball.position);
        const distance = Math.max(1, Vector.magnitude(toGoal));
        const dir = Vector.div(toGoal, distance);
        const tangentSign = ((phase.targetTeamNum + Math.floor(now / 1300)) % 2 === 0) ? 1 : -1;
        const tangent = { x: -dir.y * tangentSign, y: dir.x * tangentSign };
        const jitter = Math.sin(now * 0.004 + ball.id) * 0.18;
        const nearGoalScale = distance < 120 ? 0.36 : (distance < 175 ? 0.62 : 1);
        const stealthForce = force * nearGoalScale;
        const currentSpeed = Vector.magnitude(ball.velocity);
        const maxSpeed = config.ballLaunchSpeed * (activeTempMode === 'speed4' ? 2.2 : 1.7);
        const assistX = dir.x * 0.68 + tangent.x * (0.26 + jitter);
        const assistY = dir.y * 0.68 + tangent.y * (0.26 - jitter);
        let vx = ball.velocity.x * 0.996 + assistX * config.ballLaunchSpeed * stealthForce;
        let vy = ball.velocity.y * 0.996 + assistY * config.ballLaunchSpeed * stealthForce;
        if (currentSpeed < config.ballLaunchSpeed * 0.55) {
            vx += assistX * config.ballLaunchSpeed * stealthForce * 0.85;
            vy += assistY * config.ballLaunchSpeed * stealthForce * 0.85;
        }
        const newSpeed = Math.max(0.1, Math.hypot(vx, vy));
        if (newSpeed > maxSpeed) {
            vx = (vx / newSpeed) * maxSpeed;
            vy = (vy / newSpeed) * maxSpeed;
        }
        Body.setVelocity(ball, { x: vx, y: vy });
    } else if (!phase.isLeadPhase && timeLeft <= 10) {
        Body.setVelocity(ball, { x: ball.velocity.x * (1 - force * 0.18), y: ball.velocity.y * (1 - force * 0.18) });
    }
}

function applyScenarioFailsafe(now) {
    if (!config.scenarioEnabled || !config.scenarioFailsafe || !isRunning || !isGameStarted || isEnding || overtimeCount > 0) return;
    if (timeLeft > 5 || now - scenarioLastFailsafeAt < 900) return;
    const winnerTeamNum = config.scenarioWinnerTeam;
    const target = winnerTeamNum === 1 ? config.team1 : config.team2;
    const opponent = winnerTeamNum === 1 ? config.team2 : config.team1;
    if (target.score > opponent.score) return;

    scenarioLastFailsafeAt = now;
    const ball = balls.find(item => item.team === winnerTeamNum && !item.isExtraModeBall) || balls.find(item => item.team === winnerTeamNum);
    if (!ball) return;
    const goalPos = chooseScenarioGoalPosition(ball);
    const toGoal = Vector.sub(goalPos, ball.position);
    const distance = Vector.magnitude(toGoal);
    const dir = distance > 1 ? Vector.div(toGoal, distance) : { x: 0, y: -1 };
    if (timeLeft <= 2 && config.scenarioStrength !== 'low') {
        Body.setPosition(ball, {
            x: config.centerX + dir.x * (getActiveCircleRadius() - 26),
            y: config.centerY + dir.y * (getActiveCircleRadius() - 26)
        });
    }
    const failsafePower = config.scenarioStrength === 'low' ? 1.05 : (config.scenarioStrength === 'high' ? 1.75 : 1.38);
    Body.setVelocity(ball, {
        x: dir.x * config.ballLaunchSpeed * failsafePower,
        y: dir.y * config.ballLaunchSpeed * failsafePower
    });
    Body.setAngularVelocity(ball, (Math.random() - 0.5) * 0.22);
}

function renderHookOdds(team1Percent, isFinal = false) {
    const odds1 = document.getElementById('hookOdds1');
    const odds2 = document.getElementById('hookOdds2');
    const choice1 = document.querySelector('.hook-choice-1');
    const choice2 = document.querySelector('.hook-choice-2');
    if (choice1) choice1.style.setProperty('--odds-pct', `${team1Percent}%`);
    if (choice2) choice2.style.setProperty('--odds-pct', `${100 - team1Percent}%`);
    if (odds1) {
        odds1.innerText = `${team1Percent}%`;
        odds1.classList.toggle('settled', isFinal);
    }
    if (odds2) {
        odds2.innerText = `${100 - team1Percent}%`;
        odds2.classList.toggle('settled', isFinal);
    }
}

function stopHookOddsAnimation() {
    if (hookOddsInterval) {
        clearInterval(hookOddsInterval);
        hookOddsInterval = null;
    }
    if (hookOddsSettleTimeout) {
        clearTimeout(hookOddsSettleTimeout);
        hookOddsSettleTimeout = null;
    }
    if (hookOddsSoundTimeout) {
        clearTimeout(hookOddsSoundTimeout);
        hookOddsSoundTimeout = null;
    }
}

function animateHookOdds(durationMs = PRE_VS_HOOK_MS) {
    stopHookOddsAnimation();
    hookOddsSoundTimeout = setTimeout(() => {
        hookOddsSoundTimeout = null;
        playSoundEffect(sounds.interfacePercent, 0.50, 'Interface percent sound');
    }, PRE_VS_PERCENT_SOUND_DELAY_MS);
    const finalOdds = getRandomizedHookOdds();
    const oddsEls = [document.getElementById('hookOdds1'), document.getElementById('hookOdds2')].filter(Boolean);
    oddsEls.forEach(el => el.classList.remove('settled'));
    const settleDelay = Math.max(520, durationMs - 260);
    hookOddsInterval = setInterval(() => {
        const swing = 38 + Math.floor(Math.random() * 25);
        const randomTeam1 = Math.random() > 0.5 ? swing : 100 - swing;
        renderHookOdds(randomTeam1, false);
    }, 74);
    hookOddsSettleTimeout = setTimeout(() => {
        stopHookOddsAnimation();
        renderHookOdds(finalOdds.team1, true);
    }, settleDelay);
}

function initArenaControls() {
    const select = document.getElementById('arenaSelect');
    const fileInput = document.getElementById('arenaFiles');
    arenaOptions = getArenaManifestOptions();
    populateArenaSelect(DEFAULT_ARENA_SRC);

    if (select) {
        select.addEventListener('change', () => {
            setArenaBackground(select.value);
            updateTimerVisuals();
            updatePresetDeleteButtons();
            saveCurrentSettings();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('click', () => { fileInput.value = ''; });
        fileInput.addEventListener('change', async () => {
            const files = Array.from(fileInput.files || []).filter(file => file.type.startsWith('image/'));
            if (!files.length) return;
            const loadedArenas = await Promise.all(files.map(async (file) => ({
                name: file.name,
                src: await optimizeArenaSourceForStorage(await readFileAsDataUrl(file)),
                persistable: true,
                custom: true
            })));
            const firstNewSrc = loadedArenas[0].src;
            arenaOptions.push(...loadedArenas);
            populateArenaSelect(firstNewSrc);
            saveStoredCustomArenas(arenaOptions);
            saveCurrentSettings();
        });
    }
    const deleteArenaButton = document.getElementById('deleteArenaPreset');
    if (deleteArenaButton) deleteArenaButton.addEventListener('click', deleteSelectedArenaPreset);
}

function initTeamPresetControls() {
    teamPresetOptions = getTeamPresetManifestOptions();
    populateTeamPresetSelects();

    [1, 2].forEach((teamNum) => {
        const select = document.getElementById(`team${teamNum}Preset`);
        if (!select) return;
        select.addEventListener('change', () => {
            applyTeamPreset(teamNum, select.value);
            updatePresetDeleteButtons();
        });
    });

    const saveTeam1 = document.getElementById('saveTeam1Preset');
    const saveTeam2 = document.getElementById('saveTeam2Preset');
    const deleteTeam1 = document.getElementById('deleteTeam1Preset');
    const deleteTeam2 = document.getElementById('deleteTeam2Preset');
    if (saveTeam1) saveTeam1.addEventListener('click', () => saveCurrentTeamAsPreset(1));
    if (saveTeam2) saveTeam2.addEventListener('click', () => saveCurrentTeamAsPreset(2));
    if (deleteTeam1) deleteTeam1.addEventListener('click', () => deleteSelectedTeamPreset(1));
    if (deleteTeam2) deleteTeam2.addEventListener('click', () => deleteSelectedTeamPreset(2));
    updatePresetDeleteButtons();
}

document.getElementById('langSelect').addEventListener('change', (e) => {
    setLanguage(e.target.value);
    localStorage.setItem('reelsSimLang', e.target.value);
});

function loadSavedSettings() {
    const savedLang = localStorage.getItem('reelsSimLang');
    if (savedLang) {
        document.getElementById('langSelect').value = savedLang;
        setLanguage(savedLang);
    } else {
        setLanguage('tr');
    }
    const saved = localStorage.getItem('reelsSimSettings');
    if (saved) {
        const s = JSON.parse(saved);
        document.getElementById('mainTitle').value = normalizeSavedTitle(s.title || i18n[currentLang].defaultTitle);
        document.getElementById('team1Name').value = s.t1Name || 'Fenerbahçe';
        document.getElementById('team1Color').value = s.t1Color || '#fbbf24';
        document.getElementById('team1Color2').value = s.t1Color2 || '#1e3a8a';
        document.getElementById('team1Color3').value = s.t1Color3 || '#ffffff';
        setThirdColorEnabled(1, !!s.t1UseColor3);
        const team1PresetSelect = document.getElementById('team1Preset');
        if (team1PresetSelect) team1PresetSelect.value = getTeamPresetById(s.t1Preset) ? s.t1Preset : TEAM_PRESET_MANUAL;
        document.getElementById('team2Name').value = s.t2Name || 'Galatasaray';
        document.getElementById('team2Color').value = s.t2Color || '#ef4444';
        document.getElementById('team2Color2').value = s.t2Color2 || '#fbbf24';
        document.getElementById('team2Color3').value = s.t2Color3 || '#ffffff';
        setThirdColorEnabled(2, !!s.t2UseColor3);
        const team2PresetSelect = document.getElementById('team2Preset');
        if (team2PresetSelect) team2PresetSelect.value = getTeamPresetById(s.t2Preset) ? s.t2Preset : TEAM_PRESET_MANUAL;
        document.getElementById('simSpeed').value = s.simSpeed || 20;
        document.getElementById('ballLaunchSpeed').value = s.ballSpeed || 20;
        document.getElementById('ballBounciness').value = s.bounciness || 20;
        document.getElementById('ballDamping').value = s.damping || 25;
        document.getElementById('matchDuration').value = s.duration || 60;
        const matchTypeSelect = document.getElementById('matchType');
        if (matchTypeSelect) matchTypeSelect.value = ['normal', 'derby', 'final', 'chaos', 'rematch'].includes(s.matchType) ? s.matchType : 'normal';
        const timerStyleSelect = document.getElementById('timerStyle');
        if (timerStyleSelect) timerStyleSelect.value = s.timerStyle || 'classic';
        const autoPrioritySelect = document.getElementById('autoModePriority');
        if (autoPrioritySelect) autoPrioritySelect.value = s.autoModePriority || 'mixed';
        setAutoModePoolControls(s.autoModePool || AUTO_MODE_IDS);
        document.getElementById('oddsFavoriteTeam').value = s.oddsFavoriteTeam || 1;
        document.getElementById('oddsFavoritePercent').value = s.oddsFavoritePercent || 58;
        const miniThreatToggle = document.getElementById('miniThreatToggle');
        if (miniThreatToggle) miniThreatToggle.checked = s.miniThreatEnabled !== false;
        const coldOpenToggle = document.getElementById('coldOpenToggle');
        if (coldOpenToggle) coldOpenToggle.checked = s.coldOpenEnabled !== false;
        const allowDrawToggle = document.getElementById('allowDrawToggle');
        if (allowDrawToggle) allowDrawToggle.checked = !!s.allowDraw;
        document.getElementById('scenarioModeToggle').checked = !!s.scenarioEnabled;
        document.getElementById('scenarioLeadTeam').value = s.scenarioLeadTeam || 1;
        document.getElementById('scenarioLeadUntil').value = s.scenarioLeadUntil || 20;
        document.getElementById('scenarioWinnerTeam').value = s.scenarioWinnerTeam || 2;
        document.getElementById('scenarioStrength').value = s.scenarioStrength || 'medium';
        document.getElementById('scenarioFailsafeToggle').checked = s.scenarioFailsafe !== false;
        document.getElementById('winnerFxToggle').checked = s.winnerFx !== false;
        document.getElementById('finalRushFxToggle').checked = s.finalRushFx !== false;
        document.getElementById('extraGlowFxToggle').checked = s.extraGlowFx !== false;
        document.getElementById('soundPriorityToggle').checked = s.soundPriorityFx !== false;
        document.getElementById('lowPerformanceToggle').checked = !!s.lowPerformanceMode;
        document.getElementById('autoModeToggle').checked = !!s.autoModeEnabled;
        const videoEditToggle = document.getElementById('videoEditModeToggle');
        if (videoEditToggle) videoEditToggle.checked = !!s.videoEditMode;
        const savedVsDuration = parseFloat(s.videoEditVsDuration);
        const migratedVsDuration = (s.settingsVersion || 1) < SETTINGS_VERSION && savedVsDuration === 5 ? DEFAULT_VIDEO_EDIT_VS_SECONDS : savedVsDuration;
        document.getElementById('videoEditVsDuration').value = Number.isFinite(migratedVsDuration) ? migratedVsDuration : DEFAULT_VIDEO_EDIT_VS_SECONDS;
        videoEditMode = !!s.videoEditMode;
        if (s.arenaBackground) populateArenaSelect(s.arenaBackground);
        const manualCustomText = document.getElementById('manualCustomText');
        if (manualCustomText) manualCustomText.value = s.manualCustomText || '';
        autoModeEnabled = !!s.autoModeEnabled;
        updateAutoModeBar();
        applySettingsToConfig();
        loadPresetLogoOnly(1, document.getElementById('team1Preset')?.value);
        loadPresetLogoOnly(2, document.getElementById('team2Preset')?.value);
    }
}

function saveCurrentSettings() {
    const s = {
        settingsVersion: SETTINGS_VERSION,
        title: document.getElementById('mainTitle').value,
        t1Name: document.getElementById('team1Name').value,
        t1Color: document.getElementById('team1Color').value,
        t1Color2: document.getElementById('team1Color2').value,
        t1Color3: document.getElementById('team1Color3').value,
        t1UseColor3: config.team1.useColor3,
        t1Preset: document.getElementById('team1Preset')?.value || TEAM_PRESET_MANUAL,
        t2Name: document.getElementById('team2Name').value,
        t2Color: document.getElementById('team2Color').value,
        t2Color2: document.getElementById('team2Color2').value,
        t2Color3: document.getElementById('team2Color3').value,
        t2UseColor3: config.team2.useColor3,
        t2Preset: document.getElementById('team2Preset')?.value || TEAM_PRESET_MANUAL,
        simSpeed: document.getElementById('simSpeed').value,
        ballSpeed: document.getElementById('ballLaunchSpeed').value,
        bounciness: document.getElementById('ballBounciness').value,
        damping: document.getElementById('ballDamping').value,
        duration: document.getElementById('matchDuration').value,
        matchType: document.getElementById('matchType')?.value || 'normal',
        timerStyle: document.getElementById('timerStyle')?.value || 'classic',
        autoModePriority: document.getElementById('autoModePriority')?.value || 'mixed',
        autoModePool: getSelectedAutoModePool(),
        oddsFavoriteTeam: document.getElementById('oddsFavoriteTeam').value,
        oddsFavoritePercent: document.getElementById('oddsFavoritePercent').value,
        miniThreatEnabled: !!document.getElementById('miniThreatToggle')?.checked,
        coldOpenEnabled: !!document.getElementById('coldOpenToggle')?.checked,
        allowDraw: !!document.getElementById('allowDrawToggle')?.checked,
        scenarioEnabled: !!document.getElementById('scenarioModeToggle')?.checked,
        scenarioLeadTeam: document.getElementById('scenarioLeadTeam').value,
        scenarioLeadUntil: document.getElementById('scenarioLeadUntil').value,
        scenarioWinnerTeam: document.getElementById('scenarioWinnerTeam').value,
        scenarioStrength: document.getElementById('scenarioStrength').value,
        scenarioFailsafe: !!document.getElementById('scenarioFailsafeToggle')?.checked,
        winnerFx: !!document.getElementById('winnerFxToggle')?.checked,
        finalRushFx: !!document.getElementById('finalRushFxToggle')?.checked,
        extraGlowFx: !!document.getElementById('extraGlowFxToggle')?.checked,
        soundPriorityFx: !!document.getElementById('soundPriorityToggle')?.checked,
        lowPerformanceMode: !!document.getElementById('lowPerformanceToggle')?.checked,
        autoModeEnabled: document.getElementById('autoModeToggle').checked,
        videoEditMode: !!document.getElementById('videoEditModeToggle')?.checked,
        videoEditVsDuration: document.getElementById('videoEditVsDuration').value,
        arenaBackground: getPersistableArenaSelection(),
        manualCustomText: document.getElementById('manualCustomText')?.value || ''
    };
    try {
        localStorage.setItem('reelsSimSettings', JSON.stringify(s));
    } catch (error) {
        console.warn('Settings could not be saved', error);
    }
}

function setThirdColorEnabled(teamNum, enabled) {
    const wrap = document.getElementById(`team${teamNum}Color3Wrap`);
    const btn = document.getElementById(`team${teamNum}AddColor`);
    if (wrap) wrap.classList.toggle('hidden', !enabled);
    if (btn) btn.classList.toggle('hidden', enabled);
    const team = teamNum === 1 ? config.team1 : config.team2;
    team.useColor3 = enabled;
}

function getTimerIntervalMs() {
    return hasOppositeGoalMode() || activeTempMode === 'clutch' ? SLOW_TIMER_INTERVAL_MS : TIMER_INTERVAL_MS;
}

function updateTimerVisuals() {
    const timerDisplay = document.getElementById('timerDisplay');
    const timerBox = timerDisplay ? timerDisplay.closest('.timer-container') : null;
    const fuseBurn = document.getElementById('fuseTimerBurn');
    const matchClockDisplay = document.getElementById('matchClockDisplay');
    const matchClockStoppage = document.getElementById('matchClockStoppage');
    if (timerDisplay) timerDisplay.innerText = formatTime(timeLeft);
    const matchClockVisualTimeLeft = getMatchClockVisualTimeLeft();
    if (matchClockDisplay) matchClockDisplay.innerText = formatMatchClock(matchClockVisualTimeLeft);
    updateMatchClockStoppage(matchClockVisualTimeLeft);
    if (timerBox) {
        timerBox.classList.toggle('fuse-mode', config.timerStyle === 'fuse');
        timerBox.classList.toggle('match-clock-mode', config.timerStyle === 'matchClock');
        if (config.timerStyle === 'matchClock') setMatchClockColorVars(timerBox, getFusePercent(matchClockVisualTimeLeft));
    }
    if (fuseBurn) {
        const pct = getFusePercent();
        setFuseColorVars(timerBox, pct);
        if (timerBox && !timerBox.classList.contains('fuse-running')) {
            timerBox.style.setProperty('--fuse-pct', `${pct}%`);
            timerBox.style.setProperty('--fuse-start-pct', `${pct}%`);
            fuseBurn.style.width = `${pct}%`;
        }
    }
}

function updateRunningFuseColor() {
    const timerDisplay = document.getElementById('timerDisplay');
    const timerBox = timerDisplay ? timerDisplay.closest('.timer-container') : null;
    if (timerBox && config.timerStyle === 'fuse') setFuseColorVars(timerBox, getFusePercent());
    if (timerBox && config.timerStyle === 'matchClock') setMatchClockColorVars(timerBox, getFusePercent());
}

function getFusePercent(seconds = timeLeft) {
    const total = Math.max(1, config.matchDuration);
    return Math.max(0, Math.min(100, (seconds / total) * 100));
}

function getFuseColor(pct) {
    const hue = Math.round((Math.max(0, Math.min(100, pct)) / 100) * 126);
    return {
        main: `hsl(${hue}, 86%, 52%)`,
        dim: `hsl(${hue}, 78%, 24%)`,
        glow: `hsla(${hue}, 88%, 56%, 0.58)`
    };
}

function setFuseColorVars(timerBox, pct = getFusePercent()) {
    if (!timerBox) return;
    const color = getFuseColor(pct);
    timerBox.style.setProperty('--fuse-color', color.main);
    timerBox.style.setProperty('--fuse-color-dim', color.dim);
    timerBox.style.setProperty('--fuse-glow', color.glow);
}

function setMatchClockColorVars(timerBox, pct = getFusePercent()) {
    if (!timerBox) return;
    const hue = Math.round((Math.max(0, Math.min(100, pct)) / 100) * 126);
    timerBox.style.setProperty('--match-clock-color', `hsl(${hue}, 78%, 56%)`);
    timerBox.style.setProperty('--match-clock-dim', `hsl(${hue}, 70%, 28%)`);
    timerBox.style.setProperty('--match-clock-glow', `hsla(${hue}, 78%, 58%, 0.42)`);
}

function getSoundPriorityValue(priority) {
    return SOUND_PRIORITY[priority] ?? SOUND_PRIORITY.ui;
}

function canPlaySoundPriority(priority = 'ui') {
    if (!config.soundPriorityFx) return !isMuted;
    if (isMuted) return false;
    const now = performance.now();
    if (now > activeSoundPriorityUntil) {
        activeSoundPriority = 0;
        activeSoundPriorityUntil = 0;
    }
    return getSoundPriorityValue(priority) >= activeSoundPriority;
}

function registerSoundPriority(priority = 'ui', holdMs = 260) {
    if (!config.soundPriorityFx) return;
    const value = getSoundPriorityValue(priority);
    if (value >= activeSoundPriority || performance.now() > activeSoundPriorityUntil) {
        activeSoundPriority = value;
        activeSoundPriorityUntil = performance.now() + holdMs;
    }
}

function playSoundEffect(sound, volume = 1.0, label = 'Sound', priority = 'ui', holdMs = 260) {
    if (!sound || isMuted) return;
    if (!canPlaySoundPriority(priority)) return;
    registerSoundPriority(priority, holdMs);
    sound.currentTime = 0;
    sound.volume = Math.max(0, Math.min(1, volume));
    sound.play().catch(e => console.log(`${label} blocked:`, e));
}

function playSoundLayer(sound, volume = 1.0, label = 'Sound layer', priority = 'ui', holdMs = 260) {
    if (!sound || isMuted) return;
    if (!canPlaySoundPriority(priority)) return;
    registerSoundPriority(priority, holdMs);
    const layer = sound.cloneNode();
    layer.volume = Math.max(0, Math.min(1, volume));
    layer.play().catch(e => console.log(`${label} blocked:`, e));
}

function playWinnerInterfaceSound() {
    if (isMuted) return;
    playSoundLayer(sounds.interface11, WINNER_INTERFACE_VOLUME, 'Winner interface sound', 'winner', 1500);
}

function playMatchEndGerilimSound() {
    if (!sounds.gerilim || isMuted) return;
    sounds.gerilim.currentTime = 0;
    sounds.gerilim.volume = MATCH_END_GERILIM_VOLUME;
    sounds.gerilim.play().catch(e => console.log('Gerilim sound error:', e));
    playSoundLayer(sounds.gerilim, MATCH_END_GERILIM_LAYER_VOLUME, 'Gerilim sound layer', 'winner', 900);
}

function getAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContext) audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') audioContext.resume().catch(e => console.log('Audio context resume blocked:', e));
    return audioContext;
}

async function getReversedAudioBuffer(file) {
    if (reverseAudioCache[file]) return reverseAudioCache[file];
    const ctx = getAudioContext();
    if (!ctx) return null;
    const response = await fetch(audioAsset(file));
    const arrayBuffer = await response.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    const reversed = ctx.createBuffer(decoded.numberOfChannels, decoded.length, decoded.sampleRate);
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
        const src = decoded.getChannelData(channel);
        const dst = reversed.getChannelData(channel);
        for (let i = 0, j = src.length - 1; i < src.length; i++, j--) dst[i] = src[j];
    }
    reverseAudioCache[file] = reversed;
    return reversed;
}

function playReversedAudioAsset(file, volume = 1.0, label = 'Reverse audio') {
    if (isMuted) return;
    getReversedAudioBuffer(file).then(buffer => {
        const ctx = getAudioContext();
        if (!ctx || !buffer) return;
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        gain.gain.value = Math.max(0, Math.min(1, volume));
        source.buffer = buffer;
        source.connect(gain).connect(ctx.destination);
        source.start(0);
    }).catch(e => console.log(`${label} blocked:`, e));
}

function getBounceAudioCooldownMs(now = performance.now()) {
    if (activeTempMode === 'speed4' || now < highSpeedAudioCooldownUntil) return 90;
    if (activeTempMode === 'speed') return 70;
    if (['multiBall', 'bumper', 'tinyBall', 'heavyBall', 'singleBallGoals'].includes(activeTempMode)) return 58;
    return 36;
}

function playGoalAudioPack({ quick = false, netLayers = 1 } = {}) {
    if (isMuted) return;
    const now = performance.now();
    registerSoundPriority('goal', quick ? 520 : 900);
    if (sounds.goal && now - lastGoalSoundAt >= GOAL_SOUND_COOLDOWN_MS) {
        lastGoalSoundAt = now;
        const goalSound = quick ? sounds.goal.cloneNode() : sounds.goal;
        goalSound.currentTime = 0;
        goalSound.volume = quick ? 0.34 : 0.42;
        goalSound.play().catch(e => console.log('Goal audio blocked:', e));
    }
    if (sounds.net && now - lastNetSoundAt >= NET_SOUND_COOLDOWN_MS) {
        lastNetSoundAt = now;
        const safeLayerCount = quick ? 1 : Math.max(1, Math.min(netLayers, 2));
        for (let i = 0; i < safeLayerCount; i++) {
            const netSound = i === 0 ? sounds.net : sounds.net.cloneNode();
            netSound.currentTime = 0;
            netSound.volume = quick ? 0.58 : (i === 0 ? 0.78 : 0.46);
            netSound.play().catch(e => console.log('Net audio blocked:', e));
        }
    }
}

function rollMatchClockStoppageMinutes() {
    config.matchClockStoppageMinutes = config.timerStyle === 'matchClock' ? (Math.random() < 0.5 ? 2 : 3) : 0;
}

function getMatchClockElapsedSeconds(seconds) {
    if (overtimeCount > 0) return 90 * 60;
    const ratio = Math.max(0, Math.min(1, seconds / Math.max(1, config.matchDuration)));
    return Math.min(90 * 60, (1 - ratio) * 90 * 60);
}

function updateMatchClockStoppage(seconds = timeLeft) {
    const el = document.getElementById('matchClockStoppage');
    if (!el) return;
    const stoppage = config.timerStyle === 'matchClock' ? (config.matchClockStoppageMinutes || 0) : 0;
    const matchClockSeconds = getMatchClockElapsedSeconds(seconds);
    const showStoppage = stoppage > 0 && (overtimeCount > 0 || matchClockSeconds >= 85 * 60);
    el.innerText = showStoppage ? `+${stoppage}` : '';
}

function getMatchClockVisualTimeLeft() {
    if (!(timerInterval && isGameStarted && !isPaused && !isEnding) || isMatchTimerFrozen()) return timeLeft;
    const isHeldAtLastSecond = (getSpeedModeMultiplier() > 1 || tempModeTriggeredByAuto || activeTempMode === 'lastGoalWins') && timeLeft <= 1;
    if (isHeldAtLastSecond) return timeLeft;
    const elapsed = (performance.now() - matchClockTickStartedAt) / Math.max(1, getTimerIntervalMs());
    return Math.max(0, matchClockTickBaseTimeLeft - Math.min(0.999, elapsed));
}

function updateMatchClockFrame() {
    if (config.timerStyle !== 'matchClock' || !timerInterval || isPaused || isEnding || isMatchTimerFrozen()) {
        matchClockFrameId = null;
        return;
    }
    const visualTimeLeft = getMatchClockVisualTimeLeft();
    const matchClockDisplay = document.getElementById('matchClockDisplay');
    const timerBox = matchClockDisplay ? matchClockDisplay.closest('.timer-container') : null;
    if (matchClockDisplay) matchClockDisplay.innerText = formatMatchClock(visualTimeLeft);
    updateMatchClockStoppage(visualTimeLeft);
    if (timerBox) setMatchClockColorVars(timerBox, getFusePercent(visualTimeLeft));
    matchClockFrameId = requestAnimationFrame(updateMatchClockFrame);
}

function startMatchClockTicker() {
    if (matchClockFrameId) cancelAnimationFrame(matchClockFrameId);
    matchClockTickStartedAt = performance.now();
    matchClockTickBaseTimeLeft = timeLeft;
    if (config.timerStyle === 'matchClock') matchClockFrameId = requestAnimationFrame(updateMatchClockFrame);
}

function stopMatchClockTicker() {
    if (matchClockFrameId) {
        cancelAnimationFrame(matchClockFrameId);
        matchClockFrameId = null;
    }
}

function randomizeFuseSpark(timerBox) {
    if (!timerBox) return;
    timerBox.style.setProperty('--spark-y-a', `${(Math.random() * 14 - 7).toFixed(1)}px`);
    timerBox.style.setProperty('--spark-y-b', `${(Math.random() * 16 - 8).toFixed(1)}px`);
    timerBox.style.setProperty('--spark-y-c', `${(Math.random() * 18 - 9).toFixed(1)}px`);
    timerBox.style.setProperty('--spark-x-a', `${(5 + Math.random() * 9).toFixed(1)}px`);
    timerBox.style.setProperty('--spark-x-b', `${(13 + Math.random() * 13).toFixed(1)}px`);
    timerBox.style.setProperty('--spark-x-c', `${(23 + Math.random() * 17).toFixed(1)}px`);
    timerBox.style.setProperty('--spark-rot-a', `${(Math.random() * 18 - 9).toFixed(1)}deg`);
    timerBox.style.setProperty('--spark-rot-b', `${(Math.random() * 22 - 11).toFixed(1)}deg`);
}

function startFuseSparkRandomizer(timerBox) {
    if (fuseSparkRandomizerInterval) clearInterval(fuseSparkRandomizerInterval);
    randomizeFuseSpark(timerBox);
    fuseSparkRandomizerInterval = setInterval(() => randomizeFuseSpark(timerBox), 430);
}

function stopFuseSparkRandomizer() {
    if (fuseSparkRandomizerInterval) {
        clearInterval(fuseSparkRandomizerInterval);
        fuseSparkRandomizerInterval = null;
    }
}

function setFuseTimerRunning(isActive) {
    const timerDisplay = document.getElementById('timerDisplay');
    const timerBox = timerDisplay ? timerDisplay.closest('.timer-container') : null;
    const fuseBurn = document.getElementById('fuseTimerBurn');
    if (!timerBox || !fuseBurn) return;
    timerBox.classList.toggle('fuse-running', !!isActive && config.timerStyle === 'fuse');
    timerBox.classList.toggle('match-clock-running', !!isActive && config.timerStyle === 'matchClock');
    if (isActive && config.timerStyle === 'matchClock') startMatchClockTicker();
    if (isActive && config.timerStyle === 'fuse') {
        const pct = getFusePercent();
        setFuseColorVars(timerBox, pct);
        const color = getFuseColor(pct);
        const durationMs = Math.max(1, timeLeft) * getTimerIntervalMs();
        timerBox.style.setProperty('--fuse-duration', `${durationMs}ms`);
        timerBox.style.setProperty('--fuse-pct', `${pct}%`);
        timerBox.style.setProperty('--fuse-start-pct', `${pct}%`);
        timerBox.style.setProperty('--fuse-start-color', color.main);
        timerBox.style.setProperty('--fuse-start-color-dim', color.dim);
        startFuseSparkRandomizer(timerBox);
        fuseBurn.style.width = `${pct}%`;
        fuseBurn.style.animation = 'none';
        void fuseBurn.offsetWidth;
        fuseBurn.style.animation = '';
    } else {
        timerBox.classList.remove('fuse-running');
        if (!isActive || config.timerStyle !== 'matchClock') timerBox.classList.remove('match-clock-running');
        if (!isActive || config.timerStyle !== 'matchClock') stopMatchClockTicker();
        stopFuseSparkRandomizer();
        const pct = getFusePercent();
        setFuseColorVars(timerBox, pct);
        setMatchClockColorVars(timerBox, pct);
        timerBox.style.setProperty('--fuse-pct', `${pct}%`);
        timerBox.style.setProperty('--fuse-start-pct', `${pct}%`);
        fuseBurn.style.width = `${pct}%`;
    }
}

function getFxToggleValue(id, fallback = true) {
    const el = document.getElementById(id);
    return el ? !!el.checked : fallback;
}

function applyFxClasses() {
    const viewport = document.getElementById('mainViewport');
    if (!viewport) return;
    viewport.classList.toggle('fx-extra-glow', !!config.extraGlowFx && !config.lowPerformanceMode);
    viewport.classList.toggle('low-performance-mode', !!config.lowPerformanceMode);
}

function applyMatchTypeClass() {
    const viewport = document.getElementById('mainViewport');
    if (!viewport) return;
    viewport.classList.remove('match-type-normal', 'match-type-derby', 'match-type-final', 'match-type-chaos', 'match-type-rematch');
    viewport.classList.add(`match-type-${config.matchType || 'normal'}`);
}

function resetBestFrameCapture() {
    bestFrameDataUrl = null;
    bestFrameScore = 0;
    bestFrameReason = '';
    bestFrameCapturedAt = 0;
    lastBestFrameCheckAt = 0;
    bestFrameCaptureScheduled = false;
    bestFrameCaptureGeneration++;
    const meta = document.getElementById('bestFrameMeta');
    if (meta) meta.innerText = i18n[currentLang].bestFrameEmpty;
}

function drawImageCover(ctx, image, width, height) {
    const imageRatio = image.naturalWidth / image.naturalHeight;
    const canvasRatio = width / height;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;
    let sourceX = 0;
    let sourceY = 0;
    if (imageRatio > canvasRatio) {
        sourceWidth = sourceHeight * canvasRatio;
        sourceX = (image.naturalWidth - sourceWidth) / 2;
    } else {
        sourceHeight = sourceWidth / canvasRatio;
        sourceY = (image.naturalHeight - sourceHeight) / 2;
    }
    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
}

function canvasToDataUrlSafe(canvas) {
    try {
        if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null;
        const dataUrl = canvas.toDataURL('image/png');
        return dataUrl && dataUrl !== 'data:,' ? dataUrl : null;
    } catch (error) {
        console.log('Best frame export failed:', error);
        return null;
    }
}

function getBestFrameExportSize(sourceCanvas) {
    const sourceWidth = sourceCanvas?.width || 500;
    const sourceHeight = sourceCanvas?.height || 500;
    const scale = Math.min(1, BEST_FRAME_EXPORT_MAX_SIZE / Math.max(sourceWidth, sourceHeight));
    return {
        width: Math.max(1, Math.round(sourceWidth * scale)),
        height: Math.max(1, Math.round(sourceHeight * scale)),
        sourceWidth,
        sourceHeight
    };
}

function drawBestFrameBackground(ctx, width, height) {
    if (arenaBackgroundImage?.complete && arenaBackgroundImage.naturalWidth > 0) {
        drawImageCover(ctx, arenaBackgroundImage, width, height);
        return true;
    }
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#041216');
    bg.addColorStop(0.48, '#0b2424');
    bg.addColorStop(1, '#061014');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    return false;
}

function drawBestFrameFallbackScene(ctx, width, height) {
    drawBestFrameBackground(ctx, width, height);
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.36)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(34, 211, 238, 0.62)';
    ctx.shadowBlur = 12;
    for (let i = 0; i < 7; i++) {
        const x = 52 + i * 66;
        ctx.beginPath();
        ctx.moveTo(x, 40);
        ctx.lineTo(width - x * 0.48, height - 38);
        ctx.stroke();
    }
    ctx.restore();

    const drawBody = (body, fill, stroke = 'rgba(255,255,255,0.35)') => {
        if (!body?.vertices?.length) return;
        ctx.save();
        ctx.beginPath();
        body.vertices.forEach((vertex, index) => {
            if (index === 0) ctx.moveTo(vertex.x, vertex.y);
            else ctx.lineTo(vertex.x, vertex.y);
        });
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.shadowColor = stroke;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    };

    segments.forEach((segment) => {
        drawBody(segment, 'rgba(129, 140, 248, 0.58)', 'rgba(165, 180, 252, 0.78)');
    });

    [goalSensor, hasOppositeGoalMode() ? extraGoalSensor : null].filter(Boolean).forEach((goal, index) => {
        drawBody(goal, index === 0 ? 'rgba(34, 211, 238, 0.65)' : 'rgba(251, 191, 36, 0.65)', index === 0 ? '#22d3ee' : '#fbbf24');
    });

    balls.forEach((ball) => {
        const team = ball.team === 1 ? config.team1 : config.team2;
        const r = ball.circleRadius || ball.modeBallSize || config.ballSize;
        ctx.save();
        ctx.translate(ball.position.x, ball.position.y);
        const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.36, team.color);
        grad.addColorStop(1, team.color2);
        ctx.fillStyle = grad;
        ctx.strokeStyle = team.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = team.color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.58)';
        ctx.font = `900 ${Math.max(10, r * 0.62)}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(ball.team), 0, 1);
        ctx.restore();
    });
}

function createManualBestFrameDataUrl(sourceCanvas) {
    const size = getBestFrameExportSize(sourceCanvas);
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = size.width;
    frameCanvas.height = size.height;
    const ctx = frameCanvas.getContext('2d');
    if (!ctx) return null;
    ctx.save();
    ctx.scale(size.width / size.sourceWidth, size.height / size.sourceHeight);
    drawBestFrameFallbackScene(ctx, size.sourceWidth, size.sourceHeight);
    ctx.restore();
    return canvasToDataUrlSafe(frameCanvas);
}

function createBestFrameDataUrl() {
    const sourceCanvas = render?.canvas;
    if (!sourceCanvas) return null;
    const size = getBestFrameExportSize(sourceCanvas);
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = size.width;
    frameCanvas.height = size.height;
    const ctx = frameCanvas.getContext('2d');
    if (!ctx) return canvasToDataUrlSafe(sourceCanvas) || createManualBestFrameDataUrl(sourceCanvas);

    try {
        drawBestFrameBackground(ctx, frameCanvas.width, frameCanvas.height);
        ctx.drawImage(sourceCanvas, 0, 0, frameCanvas.width, frameCanvas.height);
        return canvasToDataUrlSafe(frameCanvas) || canvasToDataUrlSafe(sourceCanvas) || createManualBestFrameDataUrl(sourceCanvas);
    } catch (error) {
        console.log('Best frame compose failed:', error);
    }

    return canvasToDataUrlSafe(sourceCanvas) || createManualBestFrameDataUrl(sourceCanvas);
}

function captureBestFrame(reasonKey = 'bestFrameNearGoal', score = 0) {
    if (!render?.canvas) return;
    const now = performance.now();
    if (score < bestFrameScore && now - bestFrameCapturedAt < 900) return;
    if (bestFrameCaptureScheduled && score <= bestFrameScore + 8) return;
    const nextReason = i18n[currentLang][reasonKey] || reasonKey;
    bestFrameCaptureScheduled = true;
    const captureGeneration = bestFrameCaptureGeneration;
    const runCapture = () => {
        bestFrameCaptureScheduled = false;
        if (captureGeneration !== bestFrameCaptureGeneration) return;
        if (!render?.canvas) return;
        if (isEnding && !bestFrameDataUrl) return;
        try {
            const dataUrl = createBestFrameDataUrl();
            if (!dataUrl) return;
            bestFrameDataUrl = dataUrl;
            bestFrameScore = score;
            bestFrameReason = nextReason;
            bestFrameCapturedAt = performance.now();
        } catch (error) {
            console.log('Best frame capture failed:', error);
        }
    };
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(runCapture, { timeout: 800 });
    } else {
        setTimeout(runCapture, 160);
    }
}

function captureBestFrameNow(reasonKey = 'bestFrameNearGoal', score = 0) {
    if (!render?.canvas) return false;
    try {
        const dataUrl = createBestFrameDataUrl();
        if (!dataUrl) return false;
        bestFrameDataUrl = dataUrl;
        bestFrameScore = score;
        bestFrameReason = i18n[currentLang][reasonKey] || reasonKey;
        bestFrameCapturedAt = performance.now();
        return !!bestFrameDataUrl;
    } catch (error) {
        console.log('Best frame capture failed:', error);
        return false;
    }
}

function evaluateBestFrameCapture() {
    if (!render?.canvas || !isGameStarted || isEnding || isPaused) return;
    const now = performance.now();
    if (now - lastBestFrameCheckAt < 520) return;
    lastBestFrameCheckAt = now;
    let score = 0;
    let reasonKey = 'bestFrameNearGoal';
    const activeGoalPositions = [goalSensor, hasOppositeGoalMode() ? extraGoalSensor : null].filter(Boolean).map(goal => goal.position);
    balls.forEach(ball => {
        const speed = Vector.magnitude(ball.velocity);
        const nearestGoalDistance = activeGoalPositions.reduce((min, pos) => Math.min(min, Vector.magnitude(Vector.sub(pos, ball.position))), Infinity);
        const nearGoalScore = Math.max(0, 150 - nearestGoalDistance) * 0.38;
        score = Math.max(score, nearGoalScore + speed * 2.8);
    });
    if (activeTempMode) {
        score += 28;
        reasonKey = 'bestFrameMode';
    }
    if (timeLeft <= 8 && timeLeft > 0) {
        score += 22;
        reasonKey = 'bestFrameFinal';
    }
    if (Math.abs(config.team1.score - config.team2.score) <= 1) score += 10;
    if (score > Math.max(bestFrameScore + 4, 34)) captureBestFrame(reasonKey, score);
}

function showBestFrameOverlay() {
    const overlay = document.getElementById('bestFrameOverlay');
    const image = document.getElementById('bestFrameImage');
    const meta = document.getElementById('bestFrameMeta');
    if (!overlay || !image || !meta) return;
    if (!bestFrameDataUrl && render?.canvas) captureBestFrameNow('bestFrameNearGoal', 1);
    image.classList.toggle('hidden', !bestFrameDataUrl);
    if (bestFrameDataUrl) image.src = bestFrameDataUrl;
    else image.removeAttribute('src');
    meta.innerText = bestFrameDataUrl ? bestFrameReason : i18n[currentLang].bestFrameEmpty;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
}

function hideBestFrameOverlay() {
    const overlay = document.getElementById('bestFrameOverlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
}

function stopMatchTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    setFuseTimerRunning(false);
}

function startMatchTimer() {
    stopMatchTimer();
    matchClockTickStartedAt = performance.now();
    matchClockTickBaseTimeLeft = timeLeft;
    setFuseTimerRunning(true);
    timerInterval = setInterval(updateTimer, getTimerIntervalMs());
}

function isMatchTimerFrozen() {
    return !!activeTempMode;
}

const TEMP_MODE_CLASSES = {
    speed: 'mode-speed',
    speed4: 'mode-speed4',
    twoGoals: 'mode-two-goals',
    singleBallGoals: 'mode-single-ball-goals',
    reverse: 'mode-reverse',
    shrink: 'mode-shrink',
    multiBall: 'mode-multiball',
    goldenTouch: 'mode-golden',
    freezeFrame: 'mode-freeze',
    bumper: 'mode-bumper',
    tinyBall: 'mode-tiny',
    heavyBall: 'mode-heavy',
    goalSwap: 'mode-goal-swap',
    stopCircle: 'mode-stop-circle',
    stealPoint: 'mode-steal',
    goalErase: 'mode-goal-erase',
    blackout: 'mode-blackout',
    lastGoalWins: 'mode-last-goal',
    arenaDepth: 'mode-arena-depth',
    clutch: 'mode-clutch'
};

const TEMP_MODE_BUTTONS = {
    speed: 'speedMode',
    speed4: 'speed4Mode',
    twoGoals: 'twoGoalMode',
    singleBallGoals: 'singleBallGoalMode',
    reverse: 'reverseMode',
    shrink: 'shrinkMode',
    multiBall: 'multiBallMode',
    goldenTouch: 'goldenTouchMode',
    freezeFrame: 'freezeFrameMode',
    bumper: 'bumperMode',
    tinyBall: 'tinyBallMode',
    heavyBall: 'heavyBallMode',
    goalSwap: 'goalSwapMode',
    stopCircle: 'stopCircleMode',
    stealPoint: 'stealPointMode',
    goalErase: 'goalEraseMode',
    blackout: 'blackoutMode',
    lastGoalWins: 'lastGoalWinsMode',
    arenaDepth: 'arenaDepthMode',
    clutch: 'clutchMode'
};

const AUTO_MODE_IDS = [
    'speed', 'speed4', 'twoGoals', 'singleBallGoals', 'reverse', 'shrink', 'multiBall', 'goldenTouch',
    'freezeFrame', 'bumper', 'tinyBall', 'heavyBall', 'goalSwap', 'stopCircle', 'stealPoint', 'goalErase',
    'blackout', 'lastGoalWins', 'arenaDepth'
];

const MANUAL_TEXT_BURSTS = {
    letsGo: { key: 'manualLetsGo', style: 'goal' },
    soClose: { key: 'manualSoClose', style: 'neon' },
    whatASave: { key: 'manualWhatASave', style: 'goal' },
    post: { key: 'manualPost', style: 'neon' },
    chaos: { key: 'manualChaos', style: 'alert' },
    nextGoal: { key: 'manualNextGoal', style: 'alert' },
    clutch: { key: 'manualClutch', style: 'goal' },
    lastSecond: { key: 'manualLastSecond', style: 'neon' },
    comeback: { key: 'manualComeback', style: 'alert' },
    unreal: { key: 'manualUnreal', style: 'goal' }
};

function getModeCssClass(mode = activeTempMode) {
    return TEMP_MODE_CLASSES[mode] || '';
}

function getModeClassList() {
    return Object.values(TEMP_MODE_CLASSES);
}

function getModeArenaPalette(mode = activeTempMode) {
    if (mode === 'singleBallGoals') return [config.team1.color, config.team2.color, '#ffffff'];
    return TEMP_MODE_ARENA_COLORS[mode] || ['#6366f1', '#e0e7ff', '#ffffff'];
}

function hasOppositeGoalMode(mode = activeTempMode) {
    return mode === 'twoGoals' || mode === 'singleBallGoals';
}

function getSpeedModeMultiplier(mode = activeTempMode) {
    if (mode === 'speed4') return 4;
    if (mode === 'speed') return 2;
    return 1;
}

function updateScoreboardTieState() {
    const scoreboard = document.querySelector('.scoreboard');
    if (!scoreboard) return;
    const isTie = config.team1.score === config.team2.score && (config.team1.score + config.team2.score) > 0 && !isEnding;
    scoreboard.classList.toggle('tie-fire', isTie);
}

function setFinalRushActive(active) {
    const viewport = document.getElementById('mainViewport');
    const shouldActivate = !!active && !!config.finalRushFx && !config.lowPerformanceMode && isGameStarted && !isEnding && timeLeft > 0;
    if (finalRushActive === shouldActivate) return;
    finalRushActive = shouldActivate;
    if (viewport) viewport.classList.toggle('final-rush', finalRushActive);
    if (finalRushActive && !finalRushSoundPlayed) {
        if (sounds.ambient && !isMuted) sounds.ambient.volume = Math.min(0.72, AMBIENT_VOLUME + 0.1);
    }
    if (!finalRushActive && sounds.ambient) sounds.ambient.volume = AMBIENT_VOLUME;
}

function shouldStartFinalRush() {
    if (!config.finalRushFx || config.lowPerformanceMode || finalRushSoundPlayed || isEnding || !isGameStarted) return false;
    return timeLeft <= FINAL_RUSH_SECONDS && timeLeft > 0;
}

function resetScoresForNewMatch() {
    config.team1.score = 0;
    config.team2.score = 0;
    const score1 = document.getElementById('score1');
    const score2 = document.getElementById('score2');
    if (score1) score1.innerText = '0';
    if (score2) score2.innerText = '0';
    updateScoreboardTieState();
}

function getSelectedAutoModePool() {
    const selected = Array.from(document.querySelectorAll('[data-chaos-mode]'))
        .filter(input => input.checked)
        .map(input => input.dataset.chaosMode)
        .filter(mode => AUTO_MODE_IDS.includes(mode));
    return selected.length ? selected : [...AUTO_MODE_IDS];
}

function setAutoModePoolControls(pool = AUTO_MODE_IDS) {
    const allowed = new Set(Array.isArray(pool) && pool.length ? pool : AUTO_MODE_IDS);
    document.querySelectorAll('[data-chaos-mode]').forEach(input => {
        input.checked = allowed.has(input.dataset.chaosMode);
    });
}

function updateAutoModeBar() {
    const bar = document.getElementById('autoModeBar');
    const fill = document.getElementById('autoModeFill');
    const percent = document.getElementById('autoModePercent');
    const toggle = document.getElementById('autoModeToggle');
    if (toggle) toggle.disabled = isGameStarted && !isEnding;
    if (!bar || !fill || !percent) return;
    const visible = autoModeEnabled && isGameStarted && !isEnding && !activeTempMode;
    bar.classList.toggle('hidden', !visible);
    const value = Math.max(0, Math.min(AUTO_MODE_TRIGGER_CHARGE, autoModeCharge));
    fill.style.width = `${value}%`;
    percent.innerText = `${Math.floor(value)}%`;
    bar.classList.toggle('hot', value >= 70 && value < AUTO_MODE_TRIGGER_CHARGE);
    bar.classList.toggle('charged', value >= AUTO_MODE_TRIGGER_CHARGE);
}

function clearViewportEffectTimeout(key) {
    if (!viewportEffectTimeouts[key]) return;
    clearTimeout(viewportEffectTimeouts[key]);
    viewportEffectTimeouts[key] = null;
}

function clearAllViewportEffectTimeouts() {
    Object.keys(viewportEffectTimeouts).forEach(clearViewportEffectTimeout);
}

function scheduleViewportEffectRemoval(viewport, classes, delay, key) {
    clearViewportEffectTimeout(key);
    viewportEffectTimeouts[key] = setTimeout(() => {
        viewport.classList.remove(...classes);
        viewportEffectTimeouts[key] = null;
    }, delay);
}

function resetAutoModeCharge() {
    autoModeCharge = 0;
    autoModeLastUpdate = performance.now();
    updateAutoModeBar();
}

function addAutoModeCharge(amount, now = performance.now()) {
    if (!autoModeEnabled || isEnding || isPaused) return;
    if (activeTempMode) return;
    autoModeCharge = Math.min(AUTO_MODE_TRIGGER_CHARGE, autoModeCharge + amount);
    updateAutoModeBar();
    if (autoModeCharge >= AUTO_MODE_TRIGGER_CHARGE) triggerAutoMode(now);
}

function getAutoModePool() {
    const selected = getSelectedAutoModePool();
    return selected
        .filter(mode => mode !== autoModeLastMode)
        .filter(mode => mode !== 'lastGoalWins' || timeLeft <= 5);
}

function triggerAutoMode(now = performance.now()) {
    if (!autoModeEnabled || activeTempMode || !isGameStarted || isEnding || isPaused || isGoalCinematic) return;
    if (now - autoModeLastTriggerAt < AUTO_MODE_COOLDOWN_MS) return;
    let pool = getAutoModePool();
    if (!pool.length) pool = getSelectedAutoModePool();
    pool = pool.filter(mode => mode !== 'lastGoalWins' || timeLeft <= 5);
    if (!pool.length) return;
    const priority = document.getElementById('autoModePriority')?.value || config.autoModePriority || 'mixed';
    const mode = priority !== 'mixed' && pool.includes(priority) && Math.random() < 0.68
        ? priority
        : pool[Math.floor(Math.random() * pool.length)];
    autoModeCharge = 0;
    autoModeLastMode = mode;
    autoModeLastTriggerAt = now;
    updateAutoModeBar();
    showManualTextBurst('chaos', true);
    activateTempMode(mode, true);
}

function updateAutoModeCharge(now, maxSpeed) {
    if (!autoModeEnabled || !isRunning || !isGameStarted || isEnding || isPaused || activeTempMode) {
        autoModeLastUpdate = now;
        updateAutoModeBar();
        return;
    }
    const deltaSeconds = Math.min(1, Math.max(0, (now - autoModeLastUpdate) / 1000));
    autoModeLastUpdate = now;
    let gain = deltaSeconds * 0.82;
    if (maxSpeed > config.ballLaunchSpeed * 1.05) gain += deltaSeconds * 0.48;
    if (timeLeft <= 10 && timeLeft > 0) gain += deltaSeconds * 0.55;
    addAutoModeCharge(gain, now);
}

function applyLowSpeedBoost(ball, minSpeed, minBoost, maxBoost, cooldownMs) {
    const currentSpeed = Vector.magnitude(ball.velocity);
    if (currentSpeed >= minSpeed) return currentSpeed;
    const now = performance.now();
    if (now - (ball.lastRescueBoostAt || 0) < cooldownMs) return currentSpeed;

    const angleToCenter = Math.atan2(config.centerY - ball.position.y, config.centerX - ball.position.x);
    const jitter = (Math.random() - 0.5) * Math.PI * 1.25;
    const randomAngle = Math.random() * Math.PI * 2;
    const boostAngle = Math.random() > 0.25 ? angleToCenter + jitter : randomAngle;
    const boostSpeed = minBoost + Math.random() * Math.max(0, maxBoost - minBoost);

    Body.setVelocity(ball, {
        x: Math.cos(boostAngle) * boostSpeed,
        y: Math.sin(boostAngle) * boostSpeed
    });
    Body.setAngularVelocity(ball, (Math.random() - 0.5) * 0.18);
    if (activeTempMode === 'speed4') Body.setAngularVelocity(ball, (Math.random() - 0.5) * 0.34);
    ball.lastRescueBoostAt = now;
    return boostSpeed;
}

function getMinimumVisibleBallSpeed() {
    if (!isRunning || !isGameStarted || isGoalCinematic || isSlowMotion || isEnding) return 0;
    if (activeTempMode === 'blackout' || activeTempMode === 'freezeFrame') return 0;
    const speedMultiplier = getSpeedModeMultiplier();
    if (speedMultiplier >= 4) return 7.2;
    if (speedMultiplier > 1) return 5.0;
    if (activeTempMode === 'singleBallGoals') return 3.8;
    if (activeTempMode) return 2.65;
    return 2.15;
}

function enforceMinimumVisibleBallMotion(ball, currentSpeed = Vector.magnitude(ball.velocity)) {
    const minSpeed = getMinimumVisibleBallSpeed();
    if (!minSpeed || currentSpeed >= minSpeed) return currentSpeed;
    const centerAngle = Math.atan2(config.centerY - ball.position.y, config.centerX - ball.position.x);
    const velocityAngle = currentSpeed > 0.2 ? Math.atan2(ball.velocity.y, ball.velocity.x) : centerAngle;
    const blend = currentSpeed > 0.2 ? 0.68 : 0.35;
    const angle = velocityAngle * blend + (centerAngle + (Math.random() - 0.5) * 1.4) * (1 - blend);
    const targetSpeed = minSpeed + Math.random() * 0.85;
    Body.setVelocity(ball, {
        x: Math.cos(angle) * targetSpeed,
        y: Math.sin(angle) * targetSpeed
    });
    Body.setAngularVelocity(ball, (ball.angularVelocity || 0) + (Math.random() - 0.5) * 0.045);
    return targetSpeed;
}

function setModeButtonsState() {
    const buttons = document.querySelectorAll('.mode-btn');
    buttons.forEach(btn => {
        if (!btn) return;
        btn.disabled = !!activeTempMode || (btn.id === 'lastGoalWinsMode' && (!isGameStarted || timeLeft > 5));
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(TEMP_MODE_BUTTONS[activeTempMode]);
    if (activeBtn) activeBtn.classList.add('active');
}

function showModeOverlay(text) {
    const viewport = document.getElementById('mainViewport');
    if (!viewport) return;
    document.querySelectorAll('.temp-mode-overlay').forEach(el => el.remove());
    const overlay = document.createElement('div');
    overlay.className = `temp-mode-overlay ${activeTempMode === 'speed' ? 'speed-overlay' : (activeTempMode === 'speed4' ? 'four-speed-overlay' : (hasOppositeGoalMode() ? 'two-goals-overlay' : ''))}`;
    overlay.innerText = text;
    viewport.appendChild(overlay);
    setTimeout(() => overlay.remove(), 1800);
}

function setManualTextOverlayContent(overlay, text, fitMode = 'single') {
    overlay.innerHTML = '';
    const line = document.createElement('span');
    line.className = 'manual-text-line';
    line.innerText = text;
    overlay.appendChild(line);

    requestAnimationFrame(() => {
        const baseSize = parseFloat(getComputedStyle(overlay).fontSize) || 48;
        let scale = 1;
        overlay.style.fontSize = `${baseSize}px`;
        const minScale = fitMode === 'wrap' ? 0.58 : 0.7;
        const isOverflowing = () => line.scrollWidth > overlay.clientWidth || (fitMode === 'single' && line.getClientRects().length > 1);
        while (isOverflowing() && scale > minScale) {
            scale -= 0.04;
            overlay.style.fontSize = `${baseSize * scale}px`;
        }
    });
}

function showManualTextBurst(id, automatic = false) {
    const config = MANUAL_TEXT_BURSTS[id];
    const viewport = document.getElementById('mainViewport');
    if (!config || !viewport) return;
    if (automatic) {
        const now = performance.now();
        if (now - lastAutoManualBurstAt < 1300) return;
        lastAutoManualBurstAt = now;
    }
    const overlay = document.createElement('div');
    overlay.className = `manual-text-overlay manual-text-${config.style}`;
    setManualTextOverlayContent(overlay, i18n[currentLang][config.key] || config.key, 'single');
    viewport.appendChild(overlay);
    setTimeout(() => overlay.remove(), 1700);
}

function recordGoalForHype(teamNum) {
    const gameSecond = Math.max(0, config.matchDuration - timeLeft);
    const closeEnough = lastGoalGameSecond === null || gameSecond - lastGoalGameSecond <= 12;
    if (scoringStreakTeam === teamNum && closeEnough) {
        scoringStreakCount++;
    } else {
        scoringStreakTeam = teamNum;
        scoringStreakCount = 1;
    }
    lastGoalGameSecond = gameSecond;
    const now = performance.now();
    const isStrongStreak = scoringStreakCount >= 3 || (scoringStreakCount >= 2 && timeLeft <= 8);
    const passesChance = Math.random() < (timeLeft <= 8 ? 0.45 : 0.28);
    if (isStrongStreak && passesChance && now - lastUnrealBurstAt > 9000 && !pendingUnrealBurstTimeout) {
        pendingUnrealBurstTimeout = setTimeout(() => {
            pendingUnrealBurstTimeout = null;
            if (isEnding || activeTempMode || !isGameStarted) return;
            lastUnrealBurstAt = performance.now();
            showManualTextBurst('unreal', true);
        }, activeTempMode ? 600 : 1150);
        scoringStreakCount = 0;
    }
}

function showCustomManualTextBurst() {
    const input = document.getElementById('manualCustomText');
    const viewport = document.getElementById('mainViewport');
    if (!input || !viewport) return;
    const text = input.value.trim();
    if (!text) return;
    const overlay = document.createElement('div');
    overlay.className = 'manual-text-overlay manual-text-custom-title';
    setManualTextOverlayContent(overlay, text, 'wrap');
    viewport.appendChild(overlay);
    saveCurrentSettings();
    setTimeout(() => overlay.remove(), 2200);
}

function getTempModeLabelText(mode = activeTempMode) {
    if (mode === 'speed') return i18n[currentLang].speedModeOverlay;
    if (mode === 'speed4') return i18n[currentLang].speed4ModeOverlay;
    if (mode === 'twoGoals') return i18n[currentLang].twoGoalModeOverlay;
    if (mode === 'singleBallGoals') return i18n[currentLang].singleBallGoalModeOverlay;
    if (mode === 'reverse') return i18n[currentLang].reverseModeOverlay;
    if (mode === 'shrink') return i18n[currentLang].shrinkModeOverlay;
    if (mode === 'multiBall') return i18n[currentLang].multiBallModeOverlay;
    if (mode === 'goldenTouch') return i18n[currentLang].goldenTouchModeOverlay;
    if (mode === 'freezeFrame') return i18n[currentLang].freezeFrameModeOverlay;
    if (mode === 'bumper') return i18n[currentLang].bumperModeOverlay;
    if (mode === 'tinyBall') return i18n[currentLang].tinyBallModeOverlay;
    if (mode === 'heavyBall') return i18n[currentLang].heavyBallModeOverlay;
    if (mode === 'goalSwap') return i18n[currentLang].goalSwapModeOverlay;
    if (mode === 'stopCircle') return i18n[currentLang].stopCircleModeOverlay;
    if (mode === 'stealPoint') return i18n[currentLang].stealPointModeOverlay;
    if (mode === 'goalErase') return i18n[currentLang].goalEraseModeOverlay;
    if (mode === 'blackout') return i18n[currentLang].blackoutModeOverlay;
    if (mode === 'lastGoalWins') return i18n[currentLang].lastGoalWinsModeOverlay;
    if (mode === 'arenaDepth') return i18n[currentLang].arenaDepthModeOverlay;
    if (mode === 'clutch') return i18n[currentLang].clutchModeOverlay;
    return '';
}

function playTempModeSound(mode) {
    if (isMuted) return;
    const modeSounds = {
        speed: 'riser',
        speed4: 'riser',
        twoGoals: 'doubleGoal',
        singleBallGoals: 'oneBall',
        reverse: 'reverse',
        shrink: 'tight',
        multiBall: 'double',
        goldenTouch: 'golden',
        freezeFrame: 'freeze',
        bumper: 'engel',
        goalSwap: 'goalSwap',
        stopCircle: 'stopRing',
        goalErase: 'eraseGoal',
        blackout: 'blackout',
        lastGoalWins: 'lastGoalWin',
        arenaDepth: 'arenaDepth',
        tinyBall: 'riser',
        heavyBall: 'riser',
        clutch: 'riser'
    };
    if (mode === 'stealPoint') {
        playSoundEffect(sounds.stealPoints, 1.0, 'Steal points sound', 'mode', 1050);
        playSoundLayer(sounds.stealPoints, 0.65, 'Steal points boost', 'mode', 1050);
        playSoundLayer(sounds.stealPoints2, 1.0, 'Steal points layer', 'mode', 1050);
        return;
    }
    const sound = sounds[modeSounds[mode]] || sounds.riser;
    if (!sound) return;
    const layerCount = ['multiBall', 'speed', 'twoGoals'].includes(mode) ? 2 : 1;
    for (let i = 0; i < layerCount; i++) {
        if (i === 0) playSoundEffect(sound, 1.0, 'Mode sound', 'mode', 1050);
        else playSoundLayer(sound, 1.0, 'Mode sound layer', 'mode', 1050);
    }
}

function setTempModeVisuals(mode) {
    const viewport = document.getElementById('mainViewport');
    const label = document.getElementById('tempModeLabel');
        if (viewport) {
            if (mode) clearModeFadeTimeout();
            viewport.classList.remove('mode-fading');
            viewport.style.removeProperty('--mode-glow-a');
            viewport.style.removeProperty('--mode-glow-b');
            if (mode) {
                viewport.classList.remove('mode-active', ...getModeClassList());
                if (mode === 'singleBallGoals') {
                    viewport.style.setProperty('--mode-glow-a', config.team1.color);
                    viewport.style.setProperty('--mode-glow-b', config.team2.color);
                }
                viewport.classList.add('mode-active', getModeCssClass(mode));
        } else if (!viewport.classList.contains('mode-fading')) {
            viewport.classList.remove('mode-active', ...getModeClassList());
        }
    }
    if (label) {
        label.innerText = getTempModeLabelText(mode);
        label.classList.toggle('active', !!mode);
    }
}

function getActiveCircleRadius() {
    return activeTempMode === 'shrink' ? config.circleRadius * 0.82 : config.circleRadius;
}

function getActiveGoalStartIndex() {
    if (activeTempMode === 'goalSwap') return Math.floor(config.segmentCount / 2);
    return 0;
}

function getActiveGapSize() {
    if (activeTempMode === 'heavyBall') return Math.min(config.segmentCount - 2, config.gapSize + 5);
    if (activeTempMode === 'tinyBall') return Math.max(6, config.gapSize - 1);
    return config.gapSize;
}

function getModeBallScale() {
    if (activeTempMode === 'tinyBall') return 0.62;
    if (activeTempMode === 'heavyBall') return 1.38;
    return 1;
}

function clearExtraModeBalls() {
    if (!engine) return;
    const extraBalls = balls.filter(ball => ball.isExtraModeBall);
    extraBalls.forEach(ball => Composite.remove(engine.world, ball));
    balls = balls.filter(ball => !ball.isExtraModeBall);
}

function activateSingleBallGoals() {
    if (!engine || balls.length < 2) return;
    const regularBalls = balls.filter(ball => !ball.isExtraModeBall);
    if (!regularBalls.length) return;
    const sharedBall = regularBalls.reduce((fastest, ball) => {
        return Vector.magnitude(ball.velocity) > Vector.magnitude(fastest.velocity) ? ball : fastest;
    }, regularBalls[0]);
    const removedBalls = balls.filter(ball => ball !== sharedBall);
    removedBalls.forEach(ball => Composite.remove(engine.world, ball));
    tempModeState.singleBallGoals = {
        sharedBall,
        removedBalls,
        restitution: sharedBall.restitution,
        frictionAir: sharedBall.frictionAir
    };
    balls = [sharedBall];
    sharedBall.sharedMode = true;
    sharedBall.restitution = Math.max(sharedBall.restitution || config.ballBounciness, 1.02);
    sharedBall.frictionAir = Math.min(sharedBall.frictionAir || config.ballDamping, config.ballDamping * 0.45);
    Body.setPosition(sharedBall, { x: config.centerX, y: config.centerY });
    const launchAngle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
    Body.setVelocity(sharedBall, {
        x: Math.cos(launchAngle) * config.ballLaunchSpeed * 1.08,
        y: Math.sin(launchAngle) * config.ballLaunchSpeed * 1.08
    });
    Body.setAngularVelocity(sharedBall, (Math.random() - 0.5) * 0.28);
}

function restoreSingleBallGoals() {
    const state = tempModeState.singleBallGoals;
    if (!state || !engine) return;
    const { sharedBall, removedBalls, restitution, frictionAir } = state;
    if (sharedBall) {
        sharedBall.sharedMode = false;
        sharedBall.restitution = restitution;
        sharedBall.frictionAir = frictionAir;
    }
    removedBalls.forEach(ball => {
        if (!balls.includes(ball)) {
            balls.push(ball);
            Composite.add(engine.world, ball);
        }
    });
    balls.forEach(ball => resetBall(ball));
    tempModeState.singleBallGoals = null;
}

function clearModeBumpers() {
    if (!engine || !modeBumpers.length) {
        modeBumpers = [];
        return;
    }
    modeBumpers.forEach(bumper => Composite.remove(engine.world, bumper));
    modeBumpers = [];
}

function spawnExtraModeBalls() {
    clearExtraModeBalls();
    const extra1 = createBall(1, { extra: true, x: config.centerX - 62, y: config.centerY + 18, size: config.ballSize * 0.76 });
    const extra2 = createBall(2, { extra: true, x: config.centerX + 62, y: config.centerY + 18, size: config.ballSize * 0.76 });
    [extra1, extra2].forEach(ball => {
        const angle = Math.random() * Math.PI * 2;
        Body.setVelocity(ball, {
            x: Math.cos(angle) * config.ballLaunchSpeed * 0.82,
            y: Math.sin(angle) * config.ballLaunchSpeed * 0.82
        });
    });
}

function spawnModeBumpers() {
    clearModeBumpers();
    const placements = [
        { x: config.centerX - 72, y: config.centerY - 18 },
        { x: config.centerX + 72, y: config.centerY - 18 },
        { x: config.centerX, y: config.centerY + 78 }
    ];
    modeBumpers = placements.map((pos, index) => {
        const bumper = Bodies.circle(pos.x, pos.y, 19, {
            isStatic: true,
            restitution: 1.55,
            friction: 0,
            render: { visible: false }
        });
        bumper.label = 'bumper';
        bumper.modeColor = index === 0 ? '#22c55e' : (index === 1 ? '#84cc16' : '#facc15');
        return bumper;
    });
    Composite.add(engine.world, modeBumpers);
}

function applyModeBallScale(scale) {
    restoreModeBallScale();
    if (scale === 1) return;
    tempModeState.ballScales = balls.map(ball => ({ ball, scale }));
    balls.forEach(ball => {
        Body.scale(ball, scale, scale);
        ball.modeBallSize = config.ballSize * scale;
        if (activeTempMode === 'tinyBall') {
            Body.setVelocity(ball, {
                x: ball.velocity.x * 1.22 + (Math.random() - 0.5) * 3,
                y: ball.velocity.y * 1.22 + (Math.random() - 0.5) * 3
            });
        }
        if (activeTempMode === 'heavyBall') {
            Body.setVelocity(ball, {
                x: ball.velocity.x * 0.72,
                y: ball.velocity.y * 0.72
            });
        }
    });
}

function restoreModeBallScale() {
    if (!tempModeState.ballScales) return;
    tempModeState.ballScales.forEach(({ ball, scale }) => {
        if (!ball || !balls.includes(ball)) return;
        Body.scale(ball, 1 / scale, 1 / scale);
        ball.modeBallSize = config.ballSize;
    });
    tempModeState.ballScales = null;
}

function getTempModeDurationMs(mode) {
    if (mode === 'blackout') return BLACKOUT_MODE_MS;
    return TEMP_MODE_MS;
}

function activateBlackoutPowerLoss() {
    getReversedAudioBuffer('blackout.mp3').catch(() => {});
    tempModeState.blackoutVelocities = balls.map(ball => ({
        ball,
        velocity: { x: ball.velocity.x, y: ball.velocity.y },
        angularVelocity: ball.angularVelocity || 0
    }));
    balls.forEach(ball => {
        Body.setVelocity(ball, { x: ball.velocity.x * 0.12, y: ball.velocity.y * 0.12 });
        Body.setAngularVelocity(ball, (ball.angularVelocity || 0) * 0.12);
    });
}

function releaseBlackoutPower(velocityState = tempModeState.blackoutVelocities) {
    const state = velocityState;
    if (!state || !engine) return;
    state.forEach(({ ball, velocity, angularVelocity }) => {
        if (!ball || !balls.includes(ball)) return;
        const vx = velocity.x * 1.22 + (Math.random() - 0.5) * 2.2;
        const vy = velocity.y * 1.22 + (Math.random() - 0.5) * 2.2;
        const rawSpeed = Math.hypot(vx, vy);
        const speed = Math.max(3.5, rawSpeed);
        const fallbackAngle = Math.random() * Math.PI * 2;
        const dir = rawSpeed > 0.2 ? { x: vx / rawSpeed, y: vy / rawSpeed } : { x: Math.cos(fallbackAngle), y: Math.sin(fallbackAngle) };
        Body.setVelocity(ball, { x: dir.x * speed, y: dir.y * speed });
        Body.setAngularVelocity(ball, angularVelocity * 1.35 + (Math.random() - 0.5) * 0.08);
    });
}

function endTempMode() {
    const endingMode = activeTempMode;
    const blackoutVelocityState = endingMode === 'blackout' ? tempModeState.blackoutVelocities : null;
    if (endingMode === 'speed4' || endingMode === 'speed') {
        highSpeedAudioCooldownUntil = performance.now() + (endingMode === 'speed4' ? 1600 : 900);
    }
    if (tempModeTimeout) {
        clearTimeout(tempModeTimeout);
        tempModeTimeout = null;
    }
    if (tempModeIntroTimeout) {
        clearTimeout(tempModeIntroTimeout);
        tempModeIntroTimeout = null;
    }
    restoreModeBallScale();
    restoreSingleBallGoals();
    clearExtraModeBalls();
    clearModeBumpers();
    if (blackoutExitTimeout) {
        clearTimeout(blackoutExitTimeout);
        blackoutExitTimeout = null;
    }
    if (endingMode === 'blackout') blackoutExitHold = true;
    tempModeState = {};
    activeTempMode = null;
    tempModeTriggeredByAuto = false;
    if (engine) {
        engine.timing.timeScale = endingMode === 'blackout' ? BASE_ENGINE_TIME_SCALE * 0.08 : BASE_ENGINE_TIME_SCALE;
        if (endingMode === 'blackout') {
            blackoutExitTimeout = setTimeout(() => {
                blackoutExitTimeout = null;
                playReversedAudioAsset('blackout.mp3', 0.9, 'Blackout reverse sound');
                releaseBlackoutPower(blackoutVelocityState);
                blackoutExitHold = false;
                if (engine && !activeTempMode && !isPaused) {
                    engine.timing.timeScale = BASE_ENGINE_TIME_SCALE * 0.38;
                    blackoutExitTimeout = setTimeout(() => {
                        blackoutExitTimeout = null;
                        if (engine && !activeTempMode && !isPaused) engine.timing.timeScale = BASE_ENGINE_TIME_SCALE;
                    }, BLACKOUT_EXIT_SLOW_MS);
                }
            }, 900);
        }
    }
    if (goalSensor) goalSensor.modeTeam = null;
    if (extraGoalSensor) {
        extraGoalSensor.modeTeam = null;
        Body.setPosition(extraGoalSensor, { x: -1000, y: -1000 });
    }
    if (isGameStarted && !isEnding && !isPaused) startMatchTimer();
    const viewport = document.getElementById('mainViewport');
    if (viewport) {
        viewport.classList.add('mode-fading');
        const endingClass = getModeCssClass(endingMode);
        if (endingMode === 'blackout') {
            viewport.classList.remove('glitch-active');
            void viewport.offsetWidth;
            viewport.classList.add('glitch-active');
            scheduleViewportEffectRemoval(viewport, ['glitch-active'], 520, 'glitch');
        }
        clearModeFadeTimeout();
        modeFadeTimeout = setTimeout(() => {
            modeFadeTimeout = null;
            viewport.classList.remove('mode-fading');
            if (!activeTempMode) {
                viewport.classList.remove('mode-active');
                if (endingClass) viewport.classList.remove(endingClass);
            } else if (endingClass && endingClass !== getModeCssClass(activeTempMode)) {
                viewport.classList.remove(endingClass);
            }
        }, 900);
    }
    const label = document.getElementById('tempModeLabel');
    if (label) {
        label.innerText = '';
        label.classList.remove('active');
    }
    updateAutoModeBar();
    setModeButtonsState();
}

function activateTempMode(mode, triggeredByAuto = false) {
    if (!isGameStarted || isEnding || isPaused || activeTempMode) return;
    if (mode === 'lastGoalWins' && timeLeft > 5) return;
    if (!triggeredByAuto && autoModeEnabled) autoModeLastTriggerAt = performance.now();
    activeTempMode = mode;
    tempModeTriggeredByAuto = triggeredByAuto;
    tempModeState = { startedAt: performance.now() };
    setFuseTimerRunning(false);
    const introSlowMs = mode === 'freezeFrame' ? FREEZE_FRAME_SLOW_MS : TEMP_MODE_INTRO_SLOW_MS;
    if (engine) engine.timing.timeScale = mode === 'freezeFrame' ? BASE_ENGINE_TIME_SCALE * 0.03 : (mode === 'blackout' ? BASE_ENGINE_TIME_SCALE * 0.08 : BASE_ENGINE_TIME_SCALE * 0.35);
    if (mode === 'freezeFrame') stopMatchTimer();
    if (mode === 'blackout') activateBlackoutPowerLoss();
    if (hasOppositeGoalMode(mode) || mode === 'clutch') startMatchTimer();
    if (mode === 'singleBallGoals') activateSingleBallGoals();
    if (mode === 'multiBall') spawnExtraModeBalls();
    if (mode === 'bumper') spawnModeBumpers();
    if (mode === 'tinyBall' || mode === 'heavyBall') applyModeBallScale(getModeBallScale());
    setModeButtonsState();
    setTempModeVisuals(mode);
    updateAutoModeBar();
    showModeOverlay(getTempModeLabelText(mode));
    const viewport = document.getElementById('mainViewport');
    if (mode === 'freezeFrame' && viewport) {
        clearViewportEffectTimeout('introZoom');
        clearViewportEffectTimeout('goalZoom');
        viewport.classList.remove('zoom-burst', 'glitch-active');
        void viewport.offsetWidth;
        viewport.classList.add('zoom-burst', 'glitch-active');
        scheduleViewportEffectRemoval(viewport, ['glitch-active'], 450, 'glitch');
        scheduleViewportEffectRemoval(viewport, ['zoom-burst'], 1600, 'freezeZoom');
    }
    if (mode === 'blackout' && viewport) {
        clearViewportEffectTimeout('glitch');
        viewport.classList.remove('glitch-active');
        void viewport.offsetWidth;
        viewport.classList.add('glitch-active');
        scheduleViewportEffectRemoval(viewport, ['glitch-active'], 620, 'glitch');
    }
    if (mode === 'arenaDepth' && balls.length) {
        balls.forEach(ball => {
            Body.setVelocity(ball, {
                x: ball.velocity.x * 1.08 + (Math.random() - 0.5) * 2.2,
                y: ball.velocity.y * 1.08 + (Math.random() - 0.5) * 2.2
            });
        });
    }
    playTempModeSound(mode);
    setTimeout(() => captureBestFrame('bestFrameMode', bestFrameScore + 18), 140);
    tempModeIntroTimeout = setTimeout(() => {
        tempModeIntroTimeout = null;
        if (!activeTempMode || !engine) return;
        if (getSpeedModeMultiplier() > 1) engine.timing.timeScale = BASE_ENGINE_TIME_SCALE * getSpeedModeMultiplier();
        else if (activeTempMode === 'freezeFrame') engine.timing.timeScale = BASE_ENGINE_TIME_SCALE * 2.2;
        else if (activeTempMode === 'blackout') engine.timing.timeScale = BASE_ENGINE_TIME_SCALE * 0.08;
        else engine.timing.timeScale = BASE_ENGINE_TIME_SCALE;
    }, introSlowMs);
    tempModeTimeout = setTimeout(endTempMode, getTempModeDurationMs(mode));
}

function isIndexInCircularGap(index, start, size, total) {
    return ((index - start + total) % total) < size;
}

function applySettingsToConfig() {
    autoModeEnabled = document.getElementById('autoModeToggle').checked;
    videoEditMode = !!document.getElementById('videoEditModeToggle')?.checked;
    if (!autoModeEnabled) resetAutoModeCharge();
    config.team1.name = document.getElementById('team1Name').value;
    config.team1.color = document.getElementById('team1Color').value;
    config.team1.color2 = document.getElementById('team1Color2').value;
    config.team1.color3 = document.getElementById('team1Color3').value;
    config.team2.name = document.getElementById('team2Name').value;
    config.team2.color = document.getElementById('team2Color').value;
    config.team2.color2 = document.getElementById('team2Color2').value;
    config.team2.color3 = document.getElementById('team2Color3').value;
    const rawRotation = parseFloat(document.getElementById('simSpeed').value) || 20;
    config.rotationSpeed = rawRotation / 1000;
    config.ballLaunchSpeed = parseFloat(document.getElementById('ballLaunchSpeed').value) || 20;
    const rawBouncy = parseFloat(document.getElementById('ballBounciness').value) || 30;
    config.ballBounciness = Math.min(0.7 + (rawBouncy / 100), 1.1);
    const rawDamping = parseFloat(document.getElementById('ballDamping').value) || 15;
    config.ballDamping = (rawDamping / 5000);
    config.matchDuration = parseInt(document.getElementById('matchDuration').value) || 30;
    const matchTypeValue = document.getElementById('matchType')?.value || 'normal';
    config.matchType = ['normal', 'derby', 'final', 'chaos', 'rematch'].includes(matchTypeValue) ? matchTypeValue : 'normal';
    applyMatchTypeClass();
    const timerStyleValue = document.getElementById('timerStyle')?.value;
    config.timerStyle = ['classic', 'fuse', 'matchClock'].includes(timerStyleValue) ? timerStyleValue : 'classic';
    rollMatchClockStoppageMinutes();
    config.autoModePriority = document.getElementById('autoModePriority')?.value || 'mixed';
    config.autoModePool = getSelectedAutoModePool();
    config.videoEditVsDuration = getVideoEditVsDurationMs() / 1000;
    const odds = getConfiguredOdds();
    config.oddsFavoriteTeam = odds.favoriteTeam;
    config.oddsFavoritePercent = odds.favoritePercent;
    config.miniThreatEnabled = !!document.getElementById('miniThreatToggle')?.checked;
    config.coldOpenEnabled = !!document.getElementById('coldOpenToggle')?.checked;
    config.allowDraw = !!document.getElementById('allowDrawToggle')?.checked;
    const scenario = getScenarioSettingsFromPanel();
    config.scenarioEnabled = scenario.enabled;
    config.scenarioLeadTeam = scenario.leadTeam;
    config.scenarioLeadUntil = scenario.leadUntil;
    config.scenarioWinnerTeam = scenario.winnerTeam;
    config.scenarioStrength = scenario.strength;
    config.scenarioFailsafe = scenario.failsafe;
    config.winnerFx = getFxToggleValue('winnerFxToggle', true);
    config.finalRushFx = getFxToggleValue('finalRushFxToggle', true);
    config.extraGlowFx = getFxToggleValue('extraGlowFxToggle', true);
    config.soundPriorityFx = getFxToggleValue('soundPriorityToggle', true);
    config.lowPerformanceMode = getFxToggleValue('lowPerformanceToggle', false);
    applyFxClasses();
    const arenaSelect = document.getElementById('arenaSelect');
    if (arenaSelect && arenaSelect.value) setArenaBackground(arenaSelect.value);
    if (!isGameStarted && !isEnding) timeLeft = config.matchDuration;
    const titleText = document.getElementById('mainTitle').value || 'KİM KAZANACAK?';
    document.getElementById('displayTitle').innerText = titleText;
    const idleTitleEl = document.getElementById('idleTitle'); if (idleTitleEl) idleTitleEl.innerText = titleText;
    document.getElementById('scoreName1').innerText = config.team1.name.substring(0, 3).toUpperCase();
    document.getElementById('scoreName2').innerText = config.team2.name.substring(0, 3).toUpperCase();
    updateTimerVisuals();
    const si1 = document.querySelector('.score-item.team1');
    const si2 = document.querySelector('.score-item.team2');
    if (si1) { 
        si1.style.setProperty('--team-color', config.team1.color);
        si1.style.setProperty('--team-color2', config.team1.color2);
    }
    if (si2) { 
        si2.style.setProperty('--team-color', config.team2.color);
        si2.style.setProperty('--team-color2', config.team2.color2);
    }
    updateIntroUI();
}

function init() {
    if (engine) { Render.stop(render); if (runner) Runner.stop(runner); stopMatchTimer(); Composite.clear(engine.world); }
    engine = Engine.create(); engine.positionIterations = 30; engine.velocityIterations = 30; engine.gravity.y = 0;
    engine.timing.timeScale = getSpeedModeMultiplier() > 1 ? BASE_ENGINE_TIME_SCALE * getSpeedModeMultiplier() : (activeTempMode === 'freezeFrame' ? BASE_ENGINE_TIME_SCALE * 2.2 : BASE_ENGINE_TIME_SCALE);
    const container = document.getElementById('canvas-container'); container.innerHTML = '';
    const dpr = config.lowPerformanceMode ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    render = Render.create({ element: container, engine: engine, options: { width: 500, height: 500, pixelRatio: dpr, wireframes: false, background: 'transparent' } });
    segments = [];
    modeBumpers = [];
    ambientParticles = [];
    const ambientParticleCount = config.lowPerformanceMode ? 24 : 60;
    for (let i = 0; i < ambientParticleCount; i++) {
        ambientParticles.push({ x: Math.random() * 500, y: Math.random() * 500, size: Math.random() * 2.5 + 0.5, speed: Math.random() * 0.4 + 0.1, alpha: Math.random() * 0.4 + 0.1 });
    }
    for (let i = 0; i < config.segmentCount; i++) {
        const segment = Bodies.rectangle(0, 0, 40, 50, { isStatic: true, render: { fillStyle: 'transparent' }, friction: 0.001, restitution: config.ballBounciness });
        segments.push(segment);
    }
    goalSensor = Bodies.rectangle(0, 0, 120, 60, { isSensor: true, isStatic: true, render: { visible: false } });
    goalSensor.label = 'goal';
    extraGoalSensor = Bodies.rectangle(-1000, -1000, 120, 60, { isSensor: true, isStatic: true, render: { visible: false } });
    extraGoalSensor.label = 'goal';
    const safetyWalls = [Bodies.rectangle(250, -300, 1500, 100, { isStatic: true, render: { visible: false } }), Bodies.rectangle(250, 800, 1500, 100, { isStatic: true, render: { visible: false } }), Bodies.rectangle(-300, 250, 100, 1500, { isStatic: true, render: { visible: false } }), Bodies.rectangle(800, 250, 100, 1500, { isStatic: true, render: { visible: false } })];
    Composite.add(engine.world, [...segments, goalSensor, extraGoalSensor, ...safetyWalls]);
    balls = []; createBall(1); createBall(2);
    Render.run(render); 
    runner = Runner.create();
    Events.on(runner, 'beforeUpdate', () => { 
        if (!isRunning) return; 
        const subSteps = 2; 
        for (let i = 0; i < subSteps; i++) { Engine.update(engine, (1000 / 60) / subSteps); } 
    });
    Runner.run(runner, engine);

    const angleStep = (Math.PI * 2) / config.segmentCount; const startOffset = -Math.PI / 2;
    
    Events.on(engine, 'beforeUpdate', () => {
        if (isPaused) return;
        
        const ts = engine.timing.timeScale;
        
        // Handle rotation always
        let currentDynamicSpeed = 0;
        if (isRunning) {
            currentDynamicSpeed = config.rotationSpeed + Math.sin(Date.now() * 0.001) * 0.004;
        } else {
            currentDynamicSpeed = 0.004; // Idle rotation
        }
        currentDynamicSpeed *= getSpeedModeMultiplier();
        if (activeTempMode === 'reverse') currentDynamicSpeed *= -1.25;
        if (activeTempMode === 'stopCircle' || activeTempMode === 'blackout' || blackoutExitHold) currentDynamicSpeed = 0;
        currentRotation += currentDynamicSpeed;
        const activeCircleRadius = getActiveCircleRadius();
        const activeGapSize = getActiveGapSize();
        const activeGoalStart = getActiveGoalStartIndex();
        const now = performance.now();
        
        segments.forEach((seg, i) => {
            const isGap = isIndexInCircularGap(i, activeGoalStart, activeGapSize, config.segmentCount);
            const isOppositeGap = hasOppositeGoalMode() && isIndexInCircularGap(i, Math.floor(config.segmentCount / 2), activeGapSize, config.segmentCount);
            if (isGap || isOppositeGap) { Body.setPosition(seg, { x: -1000, y: -1000 }); }
            else {
                const angle = (i * angleStep) + currentRotation + startOffset;
                const x = config.centerX + Math.cos(angle) * activeCircleRadius; const y = config.centerY + Math.sin(angle) * activeCircleRadius;
                Body.setPosition(seg, { x, y }); Body.setAngle(seg, angle + Math.PI / 2);
            }
        });
        
        const sAngle = ((activeGoalStart + activeGapSize / 2) * angleStep) + currentRotation + startOffset;
        Body.setPosition(goalSensor, { x: config.centerX + Math.cos(sAngle) * (activeCircleRadius + 45), y: config.centerY + Math.sin(sAngle) * (activeCircleRadius + 45) });
        Body.setAngle(goalSensor, sAngle + Math.PI / 2);
        const oppositeAngle = ((config.segmentCount / 2 + activeGapSize / 2) * angleStep) + currentRotation + startOffset;
        goalSensor.modeTeam = activeTempMode === 'singleBallGoals' ? 1 : null;
        extraGoalSensor.modeTeam = activeTempMode === 'singleBallGoals' ? 2 : null;
        if (hasOppositeGoalMode()) {
            Body.setPosition(extraGoalSensor, { x: config.centerX + Math.cos(oppositeAngle) * (activeCircleRadius + 45), y: config.centerY + Math.sin(oppositeAngle) * (activeCircleRadius + 45) });
            Body.setAngle(extraGoalSensor, oppositeAngle + Math.PI / 2);
        } else if (extraGoalSensor) {
            Body.setPosition(extraGoalSensor, { x: -1000, y: -1000 });
        }

        if (!isRunning && !isEnding) {
            // Keep balls at reset position during idle to prevent scoring (only if not ending)
            const viewport = document.getElementById('mainViewport');
            const isReadyHold = videoEditMode && viewport && viewport.classList.contains('video-edit-ready');
            balls.forEach(ball => {
                const ox = ball.team === 1 ? -30 : 30;
                const phase = now * 0.008 + ball.team * Math.PI;
                const readyX = isReadyHold ? Math.sin(phase) * 3.2 : 0;
                const readyY = isReadyHold ? Math.cos(phase * 0.85) * 2.2 : 0;
                Body.setPosition(ball, { x: config.centerX + ox + readyX, y: config.centerY + readyY });
                Body.setVelocity(ball, { x: 0, y: 0 });
                Body.setAngularVelocity(ball, isReadyHold ? Math.sin(phase) * 0.018 : 0);
            });
            return;
        }

        applyScenarioFailsafe(now);

        balls.forEach(ball => {
            const team = ball.team === 1 ? config.team1 : config.team2;
            let speed = Vector.magnitude(ball.velocity);
            const modeMaxMultiplier = activeTempMode === 'tinyBall' ? 2.05 : (activeTempMode === 'heavyBall' ? 1.32 : 1.6);
            const maxSpeed = config.ballLaunchSpeed * modeMaxMultiplier;
            if (speed > maxSpeed) { const newVel = Vector.mult(Vector.normalise(ball.velocity), maxSpeed); Body.setVelocity(ball, newVel); }
            if (getSpeedModeMultiplier() > 1 && isRunning && speed < SPEED_MODE_MIN_BALL_SPEED) {
                const speedMultiplier = getSpeedModeMultiplier();
                const minSpeed = SPEED_MODE_MIN_BALL_SPEED * (speedMultiplier === 4 ? 1.8 : 1);
                const boostMin = speedMultiplier === 4 ? Math.max(minSpeed, config.ballLaunchSpeed * 0.95) : minSpeed;
                const boostMax = speedMultiplier === 4 ? Math.max(boostMin + 4.5, config.ballLaunchSpeed * 1.45) : minSpeed + 2.5;
                speed = applyLowSpeedBoost(ball, minSpeed, boostMin, boostMax, speedMultiplier === 4 ? 120 : 220);
            } else if (activeTempMode === 'singleBallGoals' && isRunning && speed < 2.4) {
                const modeBoostMin = Math.max(4.2, config.ballLaunchSpeed * 0.38);
                const modeBoostMax = Math.max(modeBoostMin + 1.6, config.ballLaunchSpeed * 0.58);
                speed = applyLowSpeedBoost(ball, 2.4, modeBoostMin, modeBoostMax, 300);
            } else if (activeTempMode && isRunning && speed < 1.6) {
                const modeBoostMin = Math.max(3.0, config.ballLaunchSpeed * 0.28);
                const modeBoostMax = Math.max(modeBoostMin + 1, config.ballLaunchSpeed * 0.42);
                speed = applyLowSpeedBoost(ball, 1.6, modeBoostMin, modeBoostMax, 520);
            } else if (!activeTempMode && !isSlowMotion && isRunning && speed < NORMAL_MODE_MIN_BALL_SPEED) {
                const normalBoostMin = Math.max(2.4, config.ballLaunchSpeed * 0.22);
                const normalBoostMax = Math.max(normalBoostMin + 0.8, config.ballLaunchSpeed * 0.36);
                speed = applyLowSpeedBoost(ball, NORMAL_MODE_MIN_BALL_SPEED, normalBoostMin, normalBoostMax, NORMAL_MODE_RESCUE_COOLDOWN_MS);
            }
            applyScenarioIntervention(ball, now);
            speed = enforceMinimumVisibleBallMotion(ball, Vector.magnitude(ball.velocity));

            if (speed > 0.5) {
                const speedRatio = Math.min(speed / (config.ballLaunchSpeed * 1.6), 1);
                const trailCount = config.lowPerformanceMode ? 1 : (speed > 11 ? 3 : (speed > 5 ? 2 : 1));
                const trailLimit = config.lowPerformanceMode ? 52 : 120;
                if (trails.length < trailLimit) {
                    for (let k = 0; k < trailCount; k++) {
                        trails.push({
                            x: ball.position.x + (Math.random() - 0.5) * 8, y: ball.position.y + (Math.random() - 0.5) * 8,
                            vx: ball.velocity.x * -0.12 + (Math.random() - 0.5) * 0.9, vy: ball.velocity.y * -0.12 + (Math.random() - 0.5) * 0.9,
                            size: config.ballSize * (0.35 + speedRatio * 0.7) * (0.85 + Math.random() * 0.25),
                            life: 0.55 + speedRatio * 0.75 + Math.random() * 0.18,
                            color: Math.random() > 0.35 ? team.color : (team.useColor3 && Math.random() > 0.5 ? team.color3 : team.color2),
                            streak: speed > 5,
                            width: 2 + speedRatio * 7
                        });
                    }
                }
                const sparkLimit = config.lowPerformanceMode ? 34 : 80;
                if (!config.lowPerformanceMode && speed > 12 && sparks.length < sparkLimit) {
                    for (let k = 0; k < 3 + Math.floor(speedRatio * 4); k++) {
                        sparks.push({
                            x: ball.position.x + (Math.random() - 0.5) * 5, y: ball.position.y + (Math.random() - 0.5) * 5,
                            vx: (Math.random() - 0.5) * (5 + speedRatio * 5), vy: (Math.random() - 0.5) * (5 + speedRatio * 5),
                            life: 0.55 + speedRatio * 0.35,
                            color: Math.random() > 0.35 ? '#ffffff' : team.color,
                            size: Math.random() * 3.2 + 0.8
                        });
                    }
                }
            }
            if (ball.position.y > 500 || ball.position.y < -100 || ball.position.x > 500 || ball.position.x < -100) resetBall(ball);
        });

        // Particles update - always run even if isRunning is false (for end of match)
        trails.forEach(p => { p.x += p.vx * ts; p.y += p.vy * ts; p.life -= 0.025 * ts; p.size *= Math.pow(0.96, ts); });
        trails = trails.filter(p => p.life > 0);
        sparks.forEach(p => { p.x += p.vx * ts; p.y += p.vy * ts; p.vx *= 0.96; p.vy *= 0.96; p.life -= 0.03 * ts; p.size *= 0.98; });
        sparks = sparks.filter(p => p.life > 0);
        explosions.forEach(p => { p.x += p.vx * ts; p.y += p.vy * ts; p.vx *= 0.92; p.vy *= 0.92; p.life -= 0.015 * ts; p.size *= 0.98; });
        explosions = explosions.filter(p => p.life > 0);
        confetti.forEach(p => { p.x += p.vx * ts; p.y += p.vy * ts; p.vy += 0.2 * ts; p.vx *= 0.99; p.life -= 0.01 * ts; p.rotation += p.rSpeed; });
        confetti = confetti.filter(p => p.life > 0);
        bursts.forEach(p => { p.life -= 0.05 * ts; p.size += 2 * ts; });
        bursts = bursts.filter(p => p.life > 0);
        ambientParticles.forEach(p => { p.y -= p.speed * ts; if (p.y < -10) { p.y = 510; p.x = Math.random() * 500; } });
        if (shakeTime > 0) shakeTime -= ts;
        
        // Dynamic Chromatic Aberration based on ball speed
        let maxSpeed = 0;
        balls.forEach(b => { const s = Vector.magnitude(b.velocity); if(s > maxSpeed) maxSpeed = s; });
        updateAutoModeCharge(performance.now(), maxSpeed);
        if (maxSpeed > 15) {
            render.canvas.classList.add('chromatic-aberration');
        } else if (!isEnding) {
            render.canvas.classList.remove('chromatic-aberration');
        }
    });

    Events.on(render, 'beforeRender', () => {
        if (isPaused) return;
        const ctx = render.context;
        if (shakeTime > 0) { ctx.save(); ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8); }
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)';
        ctx.lineWidth = 1;
        const gridSize = 50;
        const gridOffset = (Date.now() * 0.02) % gridSize;
        for (let x = gridOffset; x < 500; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 500); ctx.stroke(); }
        for (let y = gridOffset; y < 500; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(500, y); ctx.stroke(); }
        ctx.fillStyle = '#fff';
        ambientParticles.forEach(p => { ctx.globalAlpha = p.alpha; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); });
        ctx.globalAlpha = 1.0;
    });

    Events.on(render, 'afterRender', () => {
        const ctx = render.context; ctx.globalCompositeOperation = 'lighter';
        trails.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.life * (p.streak ? 0.28 : 0.18);
            if (p.streak) {
                ctx.strokeStyle = p.color;
                ctx.lineWidth = p.width || 4;
                ctx.lineCap = 'round';
                ctx.shadowBlur = 14;
                ctx.shadowColor = p.color;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + p.vx * 8, p.y + p.vy * 8);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
            }
            ctx.restore();
        });
        sparks.forEach(p => { ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); });
        explosions.forEach(p => { ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); });
        bursts.forEach(p => { ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size); grd.addColorStop(0, p.color); grd.addColorStop(1, 'transparent'); ctx.fillStyle = grd; ctx.globalAlpha = p.life * 0.4; ctx.fill(); ctx.restore(); });
        confetti.forEach(p => { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size); ctx.restore(); });
        ctx.save();
        const grd = ctx.createRadialGradient(250, -50, 50, 250, 0, 300);
        grd.addColorStop(0, 'rgba(255, 255, 255, 0.15)'); grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd; ctx.fillRect(0, 0, 500, 200); ctx.restore();
        ctx.globalAlpha = 1.0; ctx.globalCompositeOperation = 'source-over';
        ctx.save();
        const renderAngleStep = (Math.PI * 2) / config.segmentCount;
        const renderStartOffset = -Math.PI / 2;
        const activeCircleRadius = getActiveCircleRadius();
        const activeGapSize = getActiveGapSize();
        const activeGoalStart = getActiveGoalStartIndex();
        const solidStartAngle = (activeGoalStart + activeGapSize - 0.5) * renderAngleStep + currentRotation + renderStartOffset;
        const solidEndAngle = (activeGoalStart - 0.5) * renderAngleStep + currentRotation + renderStartOffset + Math.PI * 2;
        const oppositeGapStartAngle = (config.segmentCount / 2 - 0.5) * renderAngleStep + currentRotation + renderStartOffset;
        const oppositeGapEndAngle = (config.segmentCount / 2 + activeGapSize - 0.5) * renderAngleStep + currentRotation + renderStartOffset;
        const drawArenaArc = () => {
            if (hasOppositeGoalMode()) {
                ctx.beginPath(); ctx.arc(config.centerX, config.centerY, activeCircleRadius, solidStartAngle, oppositeGapStartAngle); ctx.stroke();
                ctx.beginPath(); ctx.arc(config.centerX, config.centerY, activeCircleRadius, oppositeGapEndAngle, solidEndAngle); ctx.stroke();
            } else {
                ctx.beginPath(); ctx.arc(config.centerX, config.centerY, activeCircleRadius, solidStartAngle, solidEndAngle); ctx.stroke();
            }
        };
        const circlePulse = Math.sin(Date.now() / 150); // Faster pulse rate
        const arcadePulse = Math.sin(Date.now() / 74) * 0.5 + 0.5;
        const modePalette = getModeArenaPalette();
        const isModeArcade = !!activeTempMode;
        const glowFx = !!config.extraGlowFx && !config.lowPerformanceMode;
        const circleBlurAmount = isModeArcade ? (glowFx ? 30 + arcadePulse * 20 : 18 + arcadePulse * 9) : (glowFx ? 25 + circlePulse * 15 : 14 + circlePulse * 5);
        const circleAlpha = isModeArcade ? (glowFx ? 0.64 + arcadePulse * 0.22 : 0.5 + arcadePulse * 0.12) : (glowFx ? 0.6 + circlePulse * 0.3 : 0.52 + circlePulse * 0.12);
        ctx.lineCap = 'round';
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowBlur = circleBlurAmount;
        ctx.shadowColor = modePalette[0];
        ctx.strokeStyle = isModeArcade ? modePalette[0] : `rgba(99, 102, 241, ${circleAlpha})`;
        ctx.globalAlpha = circleAlpha;
        ctx.lineWidth = isModeArcade ? (glowFx ? 22 : 18) : 26;
        drawArenaArc();

        if (isModeArcade) {
            ctx.shadowBlur = glowFx ? 20 + arcadePulse * 14 : 10 + arcadePulse * 5;
            ctx.shadowColor = modePalette[1];
            ctx.strokeStyle = modePalette[1];
            ctx.globalAlpha = glowFx ? 0.44 + arcadePulse * 0.28 : 0.28 + arcadePulse * 0.16;
            ctx.lineWidth = glowFx ? 7 : 4;
            drawArenaArc();

            ctx.shadowBlur = glowFx ? 10 : 4;
            ctx.shadowColor = modePalette[2];
            ctx.strokeStyle = modePalette[2];
            ctx.globalAlpha = glowFx ? 0.6 + arcadePulse * 0.2 : 0.38 + arcadePulse * 0.12;
            ctx.lineWidth = glowFx ? 2 : 1;
            drawArenaArc();
        } else {
            ctx.shadowBlur = 10;
            ctx.strokeStyle = `rgba(224, 231, 255, ${0.8 + circlePulse * 0.2})`;
            ctx.globalAlpha = 1;
            ctx.lineWidth = 6; // Reverted to original thickness
            drawArenaArc();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
        const pulse = Math.sin(Date.now() / 400);
        const blurAmount = 12 + pulse * 8;
        const alpha = 0.7 + pulse * 0.3;
        const drawGoalFrame = (sensor, color, blurBoost = 0) => {
            ctx.save(); ctx.translate(sensor.position.x, sensor.position.y); ctx.rotate(sensor.angle);
            ctx.shadowBlur = blurAmount + blurBoost; ctx.shadowColor = color; ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath(); ctx.moveTo(-55, 20); ctx.lineTo(-55, -20); ctx.lineTo(55, -20); ctx.lineTo(55, 20); ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 + pulse * 0.2})`; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(-55, 20); ctx.lineTo(-55, -20); ctx.lineTo(55, -20); ctx.lineTo(55, 20); ctx.stroke(); ctx.restore();
        };
        drawGoalFrame(goalSensor, activeTempMode === 'singleBallGoals' ? config.team1.color : '#00f2ff');
        if (hasOppositeGoalMode() && extraGoalSensor) {
            drawGoalFrame(extraGoalSensor, activeTempMode === 'singleBallGoals' ? config.team2.color : '#fbbf24', 8);
        }
        modeBumpers.forEach((bumper, index) => {
            const bumperPulse = Math.sin(Date.now() / 180 + index) * 0.5 + 0.5;
            ctx.save();
            ctx.translate(bumper.position.x, bumper.position.y);
            ctx.globalCompositeOperation = 'lighter';
            ctx.shadowBlur = 20 + bumperPulse * 16;
            ctx.shadowColor = bumper.modeColor || '#22c55e';
            ctx.fillStyle = bumper.modeColor || '#22c55e';
            ctx.globalAlpha = 0.18 + bumperPulse * 0.12;
            ctx.beginPath();
            ctx.arc(0, 0, 34 + bumperPulse * 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.85;
            ctx.lineWidth = 4;
            ctx.strokeStyle = bumper.modeColor || '#22c55e';
            ctx.beginPath();
            ctx.arc(0, 0, 19, 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(255,255,255,0.75)';
            ctx.beginPath();
            ctx.arc(0, 0, 11, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        });
        balls.forEach(ball => { 
            const isSharedBall = !!ball.sharedMode;
            const team = ball.team === 1 ? config.team1 : config.team2;
            const sharedTeamA = config.team1;
            const sharedTeamB = config.team2;
            const speed = Vector.magnitude(ball.velocity);
            const speedRatio = Math.min(speed / (config.ballLaunchSpeed * 1.6), 1);
            const isHot = (isSharedBall ? !!lastScoringTeam : lastScoringTeam === ball.team) && !isEnding;
            const pulse = Math.sin(Date.now() / 170 + ball.team) * 0.5 + 0.5;
            const r = ball.modeBallSize || config.ballSize;

            ctx.save();
            ctx.translate(ball.position.x, ball.position.y);

            if (isHot && config.extraGlowFx && !config.lowPerformanceMode) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.22 + pulse * 0.16;
                const hotGlow = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.2, 0, 0, r * 2.7);
                hotGlow.addColorStop(0, 'rgba(255,255,255,0.9)');
                hotGlow.addColorStop(0.18, isSharedBall ? sharedTeamA.color : team.color);
                hotGlow.addColorStop(0.5, isSharedBall ? sharedTeamB.color : (team.useColor3 ? team.color3 : team.color2));
                hotGlow.addColorStop(1, 'transparent');
                ctx.fillStyle = hotGlow;
                ctx.beginPath();
                ctx.arc(0, 0, r * 2.7, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 0.18 + pulse * 0.1;
                ctx.shadowBlur = 18 + pulse * 20;
                ctx.shadowColor = isSharedBall ? sharedTeamA.color : team.color;
                ctx.strokeStyle = isSharedBall ? sharedTeamA.color : team.color;
                ctx.lineWidth = 8 + pulse * 3;
                ctx.beginPath();
                ctx.arc(0, 0, r * 1.55 + pulse * 3, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // Subtle team shell, soft and solid so it does not read as a dashed ring.
            ctx.save();
            ctx.globalAlpha = isHot ? 0.34 + pulse * 0.14 : 0.2 + speedRatio * 0.14;
            ctx.shadowBlur = isHot ? 28 + pulse * 18 : 12 + speedRatio * 12;
            ctx.shadowColor = isSharedBall ? sharedTeamA.color : team.color;
            ctx.strokeStyle = isSharedBall ? sharedTeamA.color : team.color;
            ctx.lineWidth = isHot ? 2.6 : 1.1;
            ctx.beginPath();
            ctx.arc(0, 0, r + 5 + (isHot ? pulse * 3 : 0), 0, Math.PI * 2);
            ctx.stroke();
            if (isHot) {
                ctx.globalAlpha = 0.18 + pulse * 0.1;
                ctx.strokeStyle = isSharedBall ? sharedTeamB.color : (team.useColor3 ? team.color3 : team.color2);
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.arc(0, 0, r + 10 + pulse * 4, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();

            ctx.rotate(ball.angle);
            ctx.shadowBlur = 14 + speedRatio * 18 + (isHot ? 14 : 0);
            ctx.shadowColor = isSharedBall ? sharedTeamA.color : team.color;

            const bodyGradient = ctx.createRadialGradient(-r * 0.45, -r * 0.55, r * 0.08, 0, 0, r * 1.12);
            bodyGradient.addColorStop(0, 'rgba(255,255,255,0.62)');
            bodyGradient.addColorStop(0.18, isSharedBall ? sharedTeamA.color : team.color);
            bodyGradient.addColorStop(0.62, isSharedBall ? sharedTeamB.color : (team.useColor3 ? team.color3 : team.color2));
            bodyGradient.addColorStop(1, isSharedBall ? sharedTeamA.color : team.color);
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fillStyle = bodyGradient;
            ctx.fill();

            // Mini-kit panels: two team colors, with a soft seam.
            ctx.save();
            ctx.globalAlpha = 0.88;
            ctx.beginPath();
            ctx.arc(0, 0, r - 1.5, -Math.PI * 0.9, Math.PI * (team.useColor3 ? -0.22 : 0.1));
            ctx.lineTo(0, 0);
            ctx.closePath();
            ctx.fillStyle = isSharedBall ? sharedTeamA.color : team.color;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(0, 0, r - 1.5, Math.PI * (team.useColor3 ? -0.22 : 0.1), Math.PI * (team.useColor3 ? 0.46 : 1.1));
            ctx.lineTo(0, 0);
            ctx.closePath();
            ctx.fillStyle = isSharedBall ? sharedTeamB.color : team.color2;
            ctx.fill();
            if (team.useColor3) {
                ctx.beginPath();
                ctx.arc(0, 0, r - 1.5, Math.PI * 0.46, Math.PI * 1.1);
                ctx.lineTo(0, 0);
                ctx.closePath();
                ctx.fillStyle = team.color3;
                ctx.fill();
            }
            ctx.restore();

            ctx.save();
            ctx.globalAlpha = 0.16;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-r * 0.72, -r * 0.72);
            ctx.bezierCurveTo(-r * 0.15, -r * 0.2, r * 0.2, r * 0.15, r * 0.72, r * 0.72);
            ctx.stroke();
            ctx.restore();

            // Team-colored premium ring.
            ctx.shadowBlur = 8 + speedRatio * 10;
            ctx.shadowColor = isSharedBall ? sharedTeamA.color : team.color;
            ctx.beginPath();
            ctx.arc(0, 0, r + 0.5, 0, Math.PI * 2);
            ctx.strokeStyle = isSharedBall ? sharedTeamA.color : team.color;
            ctx.lineWidth = 3.1;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, r - 3, 0, Math.PI * 2);
            ctx.strokeStyle = isSharedBall ? sharedTeamB.color : (team.useColor3 ? team.color3 : team.color2);
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, r + 2.2, -Math.PI * 0.78, -Math.PI * 0.18);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.36)';
            ctx.lineWidth = 1.1;
            ctx.stroke();

            // Glass badge behind logo for readability.
            const badgeR = r * 0.48;
            ctx.save();
            ctx.rotate(-ball.angle);
            const badgeGradient = ctx.createRadialGradient(-badgeR * 0.35, -badgeR * 0.35, 1, 0, 0, badgeR);
            badgeGradient.addColorStop(0, 'rgba(255,255,255,0.68)');
            badgeGradient.addColorStop(0.58, 'rgba(255,255,255,0.20)');
            badgeGradient.addColorStop(1, 'rgba(0,0,0,0.18)');
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(255,255,255,0.7)';
            ctx.beginPath();
            ctx.arc(0, 0, badgeR, 0, Math.PI * 2);
            ctx.fillStyle = badgeGradient;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.75)';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            if (!isSharedBall && team.logo && team.logo.complete) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(0, 0, badgeR * 0.78, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(team.logo, -badgeR * 0.78, -badgeR * 0.78, badgeR * 1.56, badgeR * 1.56);
                ctx.restore();
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.font = `900 ${Math.max(9, isSharedBall ? r * 0.38 : r * 0.45)}px Outfit, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(isSharedBall ? 'VS' : (ball.team === 1 ? '1' : '2'), 0, 1);
            }

            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(-badgeR * 0.28, -badgeR * 0.34, badgeR * 0.28, badgeR * 0.12, -0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.restore(); 
        });
        evaluateBestFrameCapture();
        if (shakeTime > 0) render.context.restore();
    });

    Matter.Resolver._restitutionMinSpeed = 0.01;
    Events.on(engine, 'collisionStart', (event) => {
        if (!isRunning || !isGameStarted) return;
        event.pairs.forEach(pair => {
            const labels = [pair.bodyA.label, pair.bodyB.label];
            if (labels.includes('goal')) {
                const goalBody = pair.bodyA.label === 'goal' ? pair.bodyA : pair.bodyB;
                const ball = pair.bodyA.label === 'goal' ? pair.bodyB : pair.bodyA;
                if (ball.team) {
                    const scoringTeam = activeTempMode === 'singleBallGoals' ? (goalBody.modeTeam || 1) : ball.team;
                    score(scoringTeam, ball);
                    if (!activeTempMode) resetBall(ball);
                }
            } else if (labels.includes('ball')) {
                const ball = pair.bodyA.label === 'ball' ? pair.bodyA : pair.bodyB;
                const other = pair.bodyA.label === 'ball' ? pair.bodyB : pair.bodyA;
                const now = performance.now();
                if (!activeTempMode && now - autoModeLastEventAt > 650) {
                    autoModeLastEventAt = now;
                    addAutoModeCharge(other.label === 'ball' ? 2.2 : 1.35, now);
                }
                if (other.label === 'bumper') {
                    const angle = Math.atan2(ball.position.y - other.position.y, ball.position.x - other.position.x);
                    const bumperKick = config.ballLaunchSpeed * 1.05;
                    Body.setVelocity(ball, {
                        x: Math.cos(angle) * bumperKick,
                        y: Math.sin(angle) * bumperKick
                    });
                    bursts.push({ x: other.position.x, y: other.position.y, size: 58, life: 1.0, color: other.modeColor || '#22c55e' });
                    shakeTime = 9;
                }
                if ((!other.label || other.label !== 'ball') && other.label !== 'bumper') {
                    if (ball.position.y > config.centerY) {
                        const kickX = (Math.random() - 0.5) * 15;
                        const kickY = -(Math.random() * 8 + 6);
                        Body.setVelocity(ball, { x: ball.velocity.x * 0.8 + kickX, y: kickY });
                    }
                    const speed = Vector.magnitude(ball.velocity);
                    if (speed > 2 && sounds.bounce && canPlaySoundPriority('bounce')) {
                        const now = performance.now();
                        if (now - lastBounceSoundAt >= getBounceAudioCooldownMs(now)) {
                            lastBounceSoundAt = now;
                            registerSoundPriority('bounce', 80);
                            const bSound = sounds.bounce.cloneNode();
                            const busyMode = ['speed4', 'multiBall', 'bumper', 'tinyBall', 'heavyBall', 'singleBallGoals'].includes(activeTempMode) || now < highSpeedAudioCooldownUntil;
                            const bounceScale = busyMode ? BOUNCE_VOLUME_BUSY : BOUNCE_VOLUME_NORMAL;
                            bSound.volume = Math.min(1, speed / 14) * bounceScale;
                            bSound.play().catch(e=>console.log(e));
                        }
                    }
                    if (speed > 5) {
                        const teamColor = ball.team === 1 ? config.team1.color : config.team2.color;
                        for (let k = 0; k < 8; k++) {
                            sparks.push({
                                x: ball.position.x + (Math.random() - 0.5) * config.ballSize,
                                y: ball.position.y + (Math.random() - 0.5) * config.ballSize,
                                vx: ball.velocity.x * -0.4 + (Math.random() - 0.5) * 8,
                                vy: ball.velocity.y * -0.4 + (Math.random() - 0.5) * 8,
                                life: 0.8, color: Math.random() > 0.5 ? teamColor : '#ffffff', size: Math.random() * 3 + 1
                            });
                        }
                        shakeTime = 8; // Increased shake
                    }
                }
            }
        });
    });
}

function createBall(teamNum, options = {}) {
    const size = options.size || config.ballSize;
    const x = options.x || config.centerX + (teamNum === 1 ? -30 : 30);
    const y = options.y || config.centerY - config.circleRadius + 40;
    const ball = Bodies.circle(x, y, size, { restitution: config.ballBounciness, frictionAir: config.ballDamping, friction: 0.001 });
    ball.team = teamNum;
    ball.label = 'ball';
    ball.modeBallSize = size;
    ball.isExtraModeBall = !!options.extra;
    balls.push(ball);
    Composite.add(engine.world, ball);
    return ball;
}
function resetBall(ball) {
    const ox = ball.team === 1 ? -30 : 30;
    const extraOffset = ball.isExtraModeBall ? (ball.team === 1 ? -28 : 28) : 0;
    Body.setPosition(ball, { x: config.centerX + ox + extraOffset, y: config.centerY + (ball.isExtraModeBall ? 24 : 0) });
    Body.setVelocity(ball, { x: (Math.random() - 0.5) * config.ballLaunchSpeed, y: -config.ballLaunchSpeed });
}

function scoreDuringTempMode(teamNum, scoringBody = null) {
    const team = teamNum === 1 ? config.team1 : config.team2;
    const scoringBall = scoringBody || balls.find(ball => ball.team === teamNum);
    const burstX = scoringBall ? scoringBall.position.x : goalSensor.position.x;
    const burstY = scoringBall ? scoringBall.position.y : goalSensor.position.y;

    playGoalAudioPack({ quick: true, netLayers: 1 });

    const opponentNum = teamNum === 1 ? 2 : 1;
    const opponent = opponentNum === 1 ? config.team1 : config.team2;
    const isStealScore = activeTempMode === 'stealPoint' && opponent.score > 0;
    const isGoalEraseScore = activeTempMode === 'goalErase';
    const isLastGoalWinsScore = activeTempMode === 'lastGoalWins';
    const scoreIncrement = activeTempMode === 'goldenTouch' ? 2 : 1;
    if (isStealScore) {
        opponent.score = Math.max(0, opponent.score - 1);
    }
    if (isGoalEraseScore) {
        opponent.score = Math.max(0, opponent.score - 1);
    } else if (isLastGoalWinsScore) {
        team.score = Math.max(team.score + 1, opponent.score + 1);
    } else {
        team.score += scoreIncrement;
    }
    lastScoringTeam = teamNum;
    recordGoalForHype(teamNum);

    const scoreEl = document.getElementById(`score${teamNum}`);
    if (scoreEl) {
        scoreEl.innerText = team.score;
        scoreEl.classList.add('slot-animate');
        setTimeout(() => scoreEl.classList.remove('slot-animate'), 260);
    }
    const opponentScoreEl = document.getElementById(`score${opponentNum}`);
    if ((isStealScore || isGoalEraseScore) && opponentScoreEl) {
        opponentScoreEl.innerText = opponent.score;
        opponentScoreEl.classList.add('slot-animate');
        setTimeout(() => opponentScoreEl.classList.remove('slot-animate'), 260);
    }
    updateScoreboardTieState();

    const scoreItem = scoreEl ? scoreEl.parentElement : null;
    if (scoreItem) {
        scoreItem.classList.add('score-change');
        setTimeout(() => scoreItem.classList.remove('score-change'), 420);
    }

    const scoreboard = document.querySelector('.scoreboard');
    if (scoreboard) {
        scoreboard.style.boxShadow = `0 8px 50px ${team.color}`;
        scoreboard.classList.add('goal-reaction');
        setTimeout(() => {
            scoreboard.classList.remove('goal-reaction');
            scoreboard.style.boxShadow = 'none';
        }, 520);
    }

    const vignette = document.querySelector('.vignette');
    if (vignette) {
        vignette.classList.add(`flash-team${teamNum}`);
        setTimeout(() => vignette.classList.remove(`flash-team${teamNum}`), 360);
    }

    for (let i = 0; i < 45; i++) {
        explosions.push({
            x: burstX,
            y: burstY,
            vx: (Math.random() - 0.5) * 18,
            vy: (Math.random() - 0.5) * 18,
            life: 0.85,
            color: Math.random() > 0.4 ? team.color : (team.useColor3 && Math.random() > 0.5 ? team.color3 : team.color2),
            size: Math.random() * 4 + 1.5
        });
    }

    const overlay = document.createElement('div');
    overlay.className = 'goal-overlay quick-mode-goal';
    overlay.innerText = isGoalEraseScore ? i18n[currentLang].goalEraseModeOverlay : (isLastGoalWinsScore ? i18n[currentLang].lastGoalWinsModeOverlay : (isStealScore ? i18n[currentLang].stealPointModeOverlay : (scoreIncrement > 1 ? '+2!' : i18n[currentLang].goal)));
    overlay.style.color = team.color;
    document.querySelector('#mainViewport').appendChild(overlay);
    setTimeout(() => overlay.remove(), 760);
    setTimeout(() => captureBestFrame('bestFrameGoal', bestFrameScore + 22), 80);

    if (scoringBall) {
        if (activeTempMode === 'singleBallGoals') {
            Body.setPosition(scoringBall, { x: config.centerX, y: config.centerY });
            const angle = Math.random() * Math.PI * 2;
            Body.setVelocity(scoringBall, {
                x: Math.cos(angle) * config.ballLaunchSpeed * 1.02,
                y: Math.sin(angle) * config.ballLaunchSpeed * 1.02
            });
        } else {
            resetBall(scoringBall);
        }
    }
}

function score(teamNum, scoringBody = null) {
    if (!isRunning || !isGameStarted || isEnding) return;
    if (activeTempMode) {
        scoreDuringTempMode(teamNum, scoringBody);
        return;
    }
    isGoalCinematic = true;
    addAutoModeCharge(18);
    isRunning = false; isGameStarted = false; stopMatchTimer();
    playGoalAudioPack({ quick: false, netLayers: 2 });
    if (sounds.kalesesi && !isMuted) {
        sounds.kalesesi.currentTime = 0; sounds.kalesesi.play().catch(e => console.log('Kalesesi blocked:', e));
    }
    balls.forEach(ball => { Body.setVelocity(ball, { x: 0, y: 0 }); Body.setAngularVelocity(ball, 0); });
    const team = teamNum === 1 ? config.team1 : config.team2; team.score++;
    lastScoringTeam = teamNum;
    recordGoalForHype(teamNum);
    
    const scoreEl = document.getElementById(`score${teamNum}`);
    let spinCount = 0;
    const finalScore = team.score;
    clearGoalCinematicTimers();
    goalScoreSpinInterval = setInterval(() => {
        scoreEl.innerText = Math.floor(Math.random() * 10);
        spinCount++;
        if (spinCount > 8) {
            clearInterval(goalScoreSpinInterval);
            goalScoreSpinInterval = null;
            scoreEl.innerText = finalScore;
            scoreEl.classList.add('slot-animate');
            updateScoreboardTieState();
            setTimeout(() => scoreEl.classList.remove('slot-animate'), 400);
        }
    }, 40);

    const scoreItem = scoreEl.parentElement;
    if (scoreItem) { scoreItem.classList.add('score-change'); setTimeout(() => scoreItem.classList.remove('score-change'), 600); }
    document.querySelector('.scoreboard').style.boxShadow = `0 10px 60px ${team.color}`;

    const vignette = document.querySelector('.vignette');
    const canvas = render.canvas;
    const viewport = document.getElementById('mainViewport');
    
    if (vignette) { vignette.classList.add(`flash-team${teamNum}`); setTimeout(() => vignette.classList.remove(`flash-team${teamNum}`), 600); }
    if (canvas) { canvas.classList.add('chromatic-aberration'); setTimeout(() => canvas.classList.remove('chromatic-aberration'), 200); }
    if (viewport) { 
        clearViewportEffectTimeout('introZoom');
        clearViewportEffectTimeout('goalZoom');
        clearViewportEffectTimeout('glitch');
        clearViewportEffectTimeout('freezeZoom');
        // Remove first to reset if called rapidly
        viewport.classList.remove('glitch-active', 'goal-flash', 'zoom-burst');
        void viewport.offsetWidth; // Force reflow
        
        viewport.classList.add('glitch-active', 'goal-flash', 'zoom-burst'); 
        
        // Glitch is short and intense
        scheduleViewportEffectRemoval(viewport, ['glitch-active'], 300, 'glitch');
        // Flash and Zoom are longer and smoother
        scheduleViewportEffectRemoval(viewport, ['goal-flash', 'zoom-burst'], 1200, 'goalZoom'); 
    }

    shakeTime = 20;
    for (let i = 0; i < 80; i++) {
        explosions.push({
            x: goalSensor.position.x, y: goalSensor.position.y,
            vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20,
            life: 1.0, color: Math.random() > 0.5 ? team.color : '#ffffff', size: Math.random() * 5 + 2
        });
    }

    const overlay = document.createElement('div'); overlay.className = 'goal-overlay'; overlay.innerText = i18n[currentLang].goal; overlay.style.color = team.color;
    document.querySelector('#mainViewport').appendChild(overlay);
    setTimeout(() => captureBestFrame('bestFrameGoal', bestFrameScore + 28), 120);
    
    const scoreboard = document.querySelector('.scoreboard');
    if (scoreboard) {
        scoreboard.classList.add('goal-reaction');
        setTimeout(() => scoreboard.classList.remove('goal-reaction'), 1000);
    }

    goalCinematicTimeout = setTimeout(() => {
        goalCinematicTimeout = null;
        overlay.remove();
        document.querySelector('.scoreboard').style.boxShadow = 'none';
        bursts = [];
        trails = [];
        balls.forEach(ball => resetBall(ball));
        isGoalCinematic = false;
        if (timeLeft > 0 && !isEnding) {
            isRunning = true;
            isGameStarted = true;
            startMatchTimer();
            if (autoModeEnabled && autoModeCharge >= AUTO_MODE_TRIGGER_CHARGE) triggerAutoMode();
        }
    }, 1000);
}

function formatTime(seconds) { const m = Math.floor(seconds / 60); const s = seconds % 60; return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; }

function formatMatchClock(seconds) {
    const totalMatchSeconds = getMatchClockElapsedSeconds(seconds);
    const m = Math.floor(totalMatchSeconds / 60);
    const wholeSeconds = Math.floor(totalMatchSeconds);
    const s = wholeSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function spawnWinnerCelebration(winner, isDraw = false, count = 220, fromCenter = false, teamOnly = false) {
    const colorA = isDraw ? config.team1.color : winner.color;
    const colorB = teamOnly ? colorA : (isDraw ? config.team2.color : '#fbbf24');
    for (let i = 0; i < count; i++) {
        const isLeft = Math.random() > 0.5;
        const x = fromCenter ? 250 + (Math.random() - 0.5) * 90 : (isLeft ? 0 : 500);
        const y = fromCenter ? 420 + Math.random() * 90 : 800;
        confetti.push({
            x,
            y,
            vx: fromCenter ? (Math.random() - 0.5) * 20 : (isLeft ? (Math.random() * 15 + 5) : -(Math.random() * 15 + 5)),
            vy: fromCenter ? -(Math.random() * 18 + 8) : -(Math.random() * 25 + 15),
            size: Math.random() * 10 + 5,
            color: Math.random() > 0.5 ? colorA : colorB,
            life: fromCenter ? 2.8 : 3.5,
            rotation: Math.random() * Math.PI,
            rSpeed: (Math.random() - 0.5) * 0.4
        });
    }
    for (let i = 0; i < 52; i++) {
        explosions.push({
            x: 250 + (Math.random() - 0.5) * 80,
            y: 410 + (Math.random() - 0.5) * 90,
            vx: (Math.random() - 0.5) * 18,
            vy: (Math.random() - 0.5) * 18,
            life: 1.0,
            color: Math.random() > 0.5 ? colorA : colorB,
            size: Math.random() * 7 + 3
        });
    }
}

function setDrawSpotlightTeam(teamNum, team) {
    const card = document.querySelector(`.draw-team-card.team${teamNum}`);
    const logo = document.getElementById(`drawLogo${teamNum}`);
    const name = document.getElementById(`drawName${teamNum}`);
    const score = document.getElementById(`drawScore${teamNum}`);
    if (card) card.style.setProperty('--team-glow', team.color);
    if (logo) logo.style.backgroundImage = team.logo ? `url(${team.logo.src})` : '';
    if (name) {
        name.innerText = team.name;
        name.style.color = team.color;
    }
    if (score) score.innerText = team.score;
}

function setWinnerSpotlightCard(winner) {
    const card = document.getElementById('winnerFinalCard');
    const logo = document.getElementById('spotlightLogo');
    const name = document.getElementById('winnerCardName');
    if (card) card.style.setProperty('--winner-glow', winner.color);
    if (logo) logo.style.backgroundImage = winner.logo ? `url(${winner.logo.src})` : '';
    if (name) {
        name.innerText = winner.name;
        name.style.color = winner.color;
    }
}

function resetWinnerSpotlightState(spotlight) {
    if (!spotlight) return;
    clearSubscribeTimers();
    spotlight.classList.remove('active', 'winner-blast', 'draw-mode');
    spotlight.style.removeProperty('--draw-team1');
    spotlight.style.removeProperty('--draw-team2');
    const title = document.getElementById('spotlightTitle');
    if (title) title.innerText = i18n[currentLang].winner;
    const winnerCardName = document.getElementById('winnerCardName');
    const winnerCardScore = document.getElementById('winnerCardScore');
    const winnerCard = document.getElementById('winnerFinalCard');
    if (winnerCard) winnerCard.style.removeProperty('--winner-glow');
    if (winnerCardName) {
        winnerCardName.innerText = '';
        winnerCardName.style.removeProperty('color');
    }
    if (winnerCardScore) winnerCardScore.innerText = '0';
    spotlight.querySelectorAll('.replay-ball-btn').forEach(btn => btn.remove());
}

function fitTextToWidth(element, maxRem = 1.1, minRem = 0.66) {
    if (!element) return;
    element.style.fontSize = `${maxRem}rem`;
    requestAnimationFrame(() => {
        let size = maxRem;
        while (element.scrollWidth > element.clientWidth && size > minRem) {
            size -= 0.04;
            element.style.fontSize = `${size}rem`;
        }
    });
}

function clearSubscribeTimers() {
    if (subscribeFinalTimeout) {
        clearTimeout(subscribeFinalTimeout);
        subscribeFinalTimeout = null;
    }
    if (subscribeHideTimeout) {
        clearTimeout(subscribeHideTimeout);
        subscribeHideTimeout = null;
    }
}

function clearMatchEndTimeouts() {
    if (matchEndSlowTimeout) {
        clearTimeout(matchEndSlowTimeout);
        matchEndSlowTimeout = null;
    }
    if (matchEndSpotlightTimeout) {
        clearTimeout(matchEndSpotlightTimeout);
        matchEndSpotlightTimeout = null;
    }
    if (matchEndGlitchTimeout) {
        clearTimeout(matchEndGlitchTimeout);
        matchEndGlitchTimeout = null;
    }
    if (matchEndImpactTimeout) {
        clearTimeout(matchEndImpactTimeout);
        matchEndImpactTimeout = null;
    }
    clearSubscribeTimers();
}

function clearGoalCinematicTimers() {
    if (goalCinematicTimeout) {
        clearTimeout(goalCinematicTimeout);
        goalCinematicTimeout = null;
    }
    if (goalScoreSpinInterval) {
        clearInterval(goalScoreSpinInterval);
        goalScoreSpinInterval = null;
    }
}

function clearModeFadeTimeout() {
    if (modeFadeTimeout) {
        clearTimeout(modeFadeTimeout);
        modeFadeTimeout = null;
    }
}

function clearOvertimeTimerVisuals(resetInlineStyles = false) {
    if (overtimeTimerFxTimeout) {
        clearTimeout(overtimeTimerFxTimeout);
        overtimeTimerFxTimeout = null;
    }
    if (overtimeResumeTimeout) {
        clearTimeout(overtimeResumeTimeout);
        overtimeResumeTimeout = null;
    }
    const timerDisplay = document.getElementById('timerDisplay');
    const timerBox = timerDisplay ? timerDisplay.closest('.timer-container') : null;
    if (timerDisplay) {
        timerDisplay.classList.remove('overtime-gold');
        if (resetInlineStyles) {
            timerDisplay.style.color = '';
            timerDisplay.style.textShadow = '';
        }
    }
    if (timerBox) timerBox.classList.remove('overtime-gold');
}

function updateTimer() {
    if (timeLeft <= 0) {
        return;
    }

    updateRunningFuseColor();

    if (isMatchTimerFrozen()) {
        updateTimerVisuals();
        return;
    }

    if ((getSpeedModeMultiplier() > 1 || tempModeTriggeredByAuto || activeTempMode === 'lastGoalWins') && timeLeft <= 1) {
        updateTimerVisuals();
        return;
    }
    
    if (timeLeft <= 5 && timeLeft > 0) {
        if (sounds.beep) { sounds.beep.currentTime = 0; sounds.beep.play().catch(e => console.log('Beep blocked')); }
    } else {
        if (sounds.tick) { sounds.tick.currentTime = 0; sounds.tick.play().catch(e => console.log('Tick blocked')); }
    }
    
    timeLeft--;
    matchClockTickStartedAt = performance.now();
    matchClockTickBaseTimeLeft = timeLeft;
    updateTimerVisuals();
    updateRunningFuseColor();
    if (shouldStartFinalRush()) setFinalRushActive(true);
    if (timeLeft <= 5) setModeButtonsState();
    
    bumbumCounter++;
    if (bumbumCounter >= BUMBUM_TICK_INTERVAL) {
        bumbumCounter = 0;
        if (timeLeft > 5 && sounds.bumbum && !isMuted) {
            sounds.bumbum.currentTime = 0;
            sounds.bumbum.volume = BUMBUM_VOLUME;
            sounds.bumbum.play().catch(e=>console.log(e));
        }
    }
    
    if (timeLeft <= 10 && timeLeft > 0) { 
        document.getElementById('timerDisplay').style.color = '#ef4444'; 
        document.getElementById('timerDisplay').style.textShadow = '0 0 15px #ef4444'; 
        render.canvas.classList.add('dramatic-mode');
    }
    if (timeLeft <= 0) {
        setFinalRushActive(false);
        document.getElementById('timerDisplay').style.color = '#ef4444'; 
        document.getElementById('timerDisplay').style.textShadow = '0 0 15px #ef4444'; 
        render.canvas.classList.add('dramatic-mode');
        if (!finalRushSoundPlayed) {
            finalRushSoundPlayed = true;
            playMatchEndGerilimSound();
        }
        
        if (!isSlowMotion && !isEnding) {
            isEnding = true;
            isSlowMotion = true;
            engine.timing.timeScale = 0.15;
            stopMatchTimer();
            if (matchEndSlowTimeout) clearTimeout(matchEndSlowTimeout);
            matchEndSlowTimeout = setTimeout(() => {
                matchEndSlowTimeout = null;
                if (!isEnding || !isGameStarted) return;
                engine.timing.timeScale = 1.0;
                isSlowMotion = false;
                endMatch();
            }, 3000);
        }
    }
}

function endMatch() {
    // Allow endMatch to proceed if it's a draw or if the game is still considered 'started'
    if (isEnding && !isGameStarted) return; 
    clearMatchEndTimeouts();
    if (activeTempMode) endTempMode();
    setFinalRushActive(false);
    const isDraw = config.team1.score === config.team2.score;
    if (isDraw && !config.allowDraw) { startOvertime(); return; }

    isEnding = true; isRunning = true; isGameStarted = false;
    updateAutoModeBar();
    updateScoreboardTieState();
    stopMatchTimer();

    registerSoundPriority('winner', 1400);
    if (sounds.goal && canPlaySoundPriority('winner')) { sounds.goal.currentTime = 0; sounds.goal.play().catch(e => console.log('Audio blocked:', e)); }
    if (sounds.whistle && !isMuted) { 
        for(let i=0; i<3; i++) {
            const w = sounds.whistle.cloneNode();
            w.volume = 1.0;
            w.play().catch(e=>console.log(e));
        }
    }

    const winner = isDraw ? null : (config.team1.score > config.team2.score ? config.team1 : config.team2);
    const endGlow = isDraw ? '#facc15' : winner.color;
    const viewport = document.getElementById('mainViewport');
    if (viewport) {
        viewport.style.setProperty('--winner-burst-color', endGlow);
        viewport.classList.add('glitch-active');
        matchEndGlitchTimeout = setTimeout(() => {
            matchEndGlitchTimeout = null;
            if (!isEnding) return;
            viewport.classList.remove('glitch-active');
            viewport.classList.add('match-focus', 'darken-bg', 'match-end-state', 'winner-impact');
            matchEndImpactTimeout = setTimeout(() => {
                matchEndImpactTimeout = null;
                viewport.classList.remove('winner-impact');
            }, 900);
        }, 180);
    }

    document.querySelectorAll('.match-end-overlay, .goal-overlay, .overtime-overlay, .epic-shockwave').forEach(el => el.remove());
    
    // Epic Shockwave
    const shockwave = document.createElement('div');
    shockwave.className = 'epic-shockwave';
    document.querySelector('#mainViewport').appendChild(shockwave);
    
    const overlay = document.createElement('div'); overlay.className = 'match-end-overlay';
    overlay.style.setProperty('--winner-glow', endGlow);
    const createFlapHTML = (finalScore, delay) => `
        <div class="flap-item">
            <div class="flap-top"><span>${finalScore}</span></div>
            <div class="flap-bottom"><span></span></div>
            <div class="flap-card" style="animation-delay: ${delay}s"><span></span></div>
            <div class="flap-card-bottom" style="animation-delay: ${delay}s"><span>${finalScore}</span></div>
        </div>`;
    
    const flapScoreboard = `
        <div class="flap-scoreboard">
            ${createFlapHTML(config.team1.score, 0.2)}
            <div class="flap-divider">-</div>
            ${createFlapHTML(config.team2.score, 0.6)}
        </div>`;
        
    const endTitle = isDraw ? i18n[currentLang].drawResult : i18n[currentLang].winner;
    const endName = isDraw ? i18n[currentLang].drawName : winner.name;
    overlay.innerHTML = `<div class="title">${endTitle}</div><div class="winner-name">${endName}</div>${flapScoreboard}`;
    document.querySelector('#mainViewport').appendChild(overlay);

    if (!isDraw && config.winnerFx) spawnWinnerCelebration(winner, false, 180, false);

    matchEndSpotlightTimeout = setTimeout(() => {
        matchEndSpotlightTimeout = null;
        if (!isEnding) {
            overlay.remove();
            return;
        }
        overlay.remove();
        isRunning = false;
            const spotlight = document.getElementById('winnerSpotlight');
            if (spotlight) {
                const spotlightTitle = document.getElementById('spotlightTitle');
                const spotlightName = document.getElementById('spotlightName');
                spotlight.style.setProperty('--winner-glow', endGlow);
                spotlight.style.setProperty('--draw-team1', config.team1.color);
                spotlight.style.setProperty('--draw-team2', config.team2.color);
                spotlight.classList.toggle('draw-mode', isDraw);
                if (spotlightTitle) spotlightTitle.innerText = endTitle;
                if (spotlightName) spotlightName.innerText = endName;
                if (isDraw) {
                    setDrawSpotlightTeam(1, config.team1);
                    setDrawSpotlightTeam(2, config.team2);
                } else if (winner) {
                    setWinnerSpotlightCard(winner);
                }
                spotlight.classList.remove('winner-blast');
                void spotlight.offsetWidth;
                spotlight.classList.add('active');
                if (config.winnerFx) spotlight.classList.add('winner-blast');
                playWinnerInterfaceSound();
                if (!isDraw && config.winnerFx) spawnWinnerCelebration(winner, false, 180, true, true);
            clearSubscribeTimers();
            subscribeFinalTimeout = setTimeout(() => {
                subscribeFinalTimeout = null;
                if (!isEnding) return;
                startSubscribeAnimation(true);
            }, isDraw ? 2200 : 300); // Trigger winner mode subscribe video
            spotlight.querySelectorAll('.replay-ball-btn').forEach(existingBtn => existingBtn.remove());
            const btn = document.createElement('div'); 
            btn.className = 'replay-ball-btn';
            btn.onclick = () => document.getElementById('applySettings').click();
            spotlight.appendChild(btn);
        } else {
            setSettingsPanelOpen(true);
        }
    }, 1600);
}

function startOvertime() {
    isEnding = false;
    isRunning = false; isGameStarted = false; stopMatchTimer();
    setFinalRushActive(false);
    finalRushSoundPlayed = false;
    updateAutoModeBar();
    bumbumCounter = 0;
    overtimeCount++; timeLeft = 5;
    clearOvertimeTimerVisuals();
    const timerDisplay = document.getElementById('timerDisplay');
    const timerBox = timerDisplay ? timerDisplay.closest('.timer-container') : null;
    if (timerDisplay) {
        updateTimerVisuals();
        timerDisplay.style.color = '#facc15';
        timerDisplay.style.textShadow = '0 0 12px #facc15, 0 0 30px rgba(250,204,21,0.9)';
        timerDisplay.classList.add('overtime-gold');
    }
    if (timerBox) timerBox.classList.add('overtime-gold');
    overtimeTimerFxTimeout = setTimeout(() => {
        overtimeTimerFxTimeout = null;
        if (timerDisplay) {
            timerDisplay.classList.remove('overtime-gold');
            timerDisplay.style.color = '#ef4444';
            timerDisplay.style.textShadow = '0 0 15px #ef4444';
        }
        if (timerBox) timerBox.classList.remove('overtime-gold');
    }, 1650);
    const overlay = document.createElement('div'); overlay.className = 'overtime-overlay'; overlay.innerText = i18n[currentLang].overtime;
    document.querySelector('#mainViewport').appendChild(overlay);
    if (sounds.whistle && !isMuted) { 
        for(let i=0; i<3; i++) {
            const w = sounds.whistle.cloneNode();
            w.volume = 1.0;
            w.play().catch(e=>console.log(e));
        }
    }
    if (sounds.bumbum && !isMuted) { sounds.bumbum.currentTime = 0; sounds.bumbum.volume = BUMBUM_VOLUME; sounds.bumbum.play().catch(e=>console.log(e)); }
    overtimeResumeTimeout = setTimeout(() => {
        overtimeResumeTimeout = null;
        if (isPaused || isEnding || overtimeCount <= 0) return;
        overlay.remove();
        isRunning = true;
        isGameStarted = true;
        startMatchTimer();
        balls.forEach(ball => resetBall(ball));
    }, 2500);
}

function updateIntroUI() {
    document.getElementById('introName1').innerText = config.team1.name;
    document.getElementById('introName1').style.color = config.team1.color;
    document.querySelector('.team1-side').style.setProperty('--team-glow', config.team1.color);
    document.getElementById('introName2').innerText = config.team2.name;
    document.getElementById('introName2').style.color = config.team2.color;
    document.querySelector('.team2-side').style.setProperty('--team-glow', config.team2.color);
    const introOverlay = document.getElementById('matchIntro');
    if (introOverlay) {
        introOverlay.style.setProperty('--vs-team1', config.team1.color);
        introOverlay.style.setProperty('--vs-team2', config.team2.color);
    }
    const idleOverlay = document.getElementById('idleOverlay');
    if (idleOverlay) {
        idleOverlay.style.setProperty('--idle-team1', config.team1.color);
        idleOverlay.style.setProperty('--idle-team2', config.team2.color);
    }
    updateTimerVisuals();
    
    const idle1 = document.getElementById('idleTeam1Name'); 
    const idle2 = document.getElementById('idleTeam2Name');
    if (idle1) {
        idle1.innerText = config.team1.name;
        idle1.style.color = config.team1.color;
        idle1.closest('.idle-team-card')?.style.setProperty('--idle-card-color', config.team1.color);
        fitTextToWidth(idle1);
    }
    if (idle2) {
        idle2.innerText = config.team2.name;
        idle2.style.color = config.team2.color;
        idle2.closest('.idle-team-card')?.style.setProperty('--idle-card-color', config.team2.color);
        fitTextToWidth(idle2);
    }
    
    setTeamLogoBackgrounds(1, config.team1.logo ? config.team1.logo.src : '');
    setTeamLogoBackgrounds(2, config.team2.logo ? config.team2.logo.src : '');
    updatePreVsHook();
}

function processLogoUpload(file, teamObj, introElementId, idleElementId) {
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const sourceSize = Math.min(img.width, img.height);
            const size = Math.min(SAVED_LOGO_MAX_SIZE, sourceSize);
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.beginPath();
            ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, (img.width - sourceSize)/2, (img.height - sourceSize)/2, sourceSize, sourceSize, 0, 0, size, size);
            
            const circularDataUrl = canvas.toDataURL('image/png');
            const newImg = new Image();
            newImg.onload = () => {
                teamObj.logo = newImg;
                const el = document.getElementById(introElementId);
                if (el) el.style.backgroundImage = `url(${circularDataUrl})`;
                const idleEl = document.getElementById(idleElementId);
                if (idleEl) idleEl.style.backgroundImage = `url(${circularDataUrl})`;
                updateIntroUI();
            };
            newImg.src = circularDataUrl;
        };
        img.src = event.target.result;
    };
    if (file) reader.readAsDataURL(file);
}

document.getElementById('team1Logo').onchange = (e) => {
    const presetSelect = document.getElementById('team1Preset');
    if (presetSelect) presetSelect.value = TEAM_PRESET_MANUAL;
    processLogoUpload(e.target.files[0], config.team1, 'introLogo1', 'idleLogo1');
    saveCurrentSettings();
};
document.getElementById('team2Logo').onchange = (e) => {
    const presetSelect = document.getElementById('team2Preset');
    if (presetSelect) presetSelect.value = TEAM_PRESET_MANUAL;
    processLogoUpload(e.target.files[0], config.team2, 'introLogo2', 'idleLogo2');
    saveCurrentSettings();
};
document.getElementById('team1AddColor').onclick = () => setThirdColorEnabled(1, true);
document.getElementById('team2AddColor').onclick = () => setThirdColorEnabled(2, true);
document.getElementById('team1RemoveColor3').onclick = () => setThirdColorEnabled(1, false);
document.getElementById('team2RemoveColor3').onclick = () => setThirdColorEnabled(2, false);

function updatePreVsHook() {
    const hook = document.getElementById('preVsHook');
    if (!hook) return;
    const hookEyebrow = document.getElementById('hookEyebrow');
    const hookQuestion = document.getElementById('hookQuestion');
    const hookLogo1 = document.getElementById('hookLogo1');
    const hookLogo2 = document.getElementById('hookLogo2');
    const hookThreat = document.getElementById('hookThreat');
    if (hookEyebrow) hookEyebrow.innerText = currentLang === 'en' ? 'PICK ONE' : 'SENCE';
    if (hookQuestion) hookQuestion.innerText = currentLang === 'en' ? 'WHO WINS?' : 'KİM KAZANIR?';
    hook.classList.toggle('mini-threat-on', !!config.miniThreatEnabled);
    if (hookThreat) {
        hookThreat.innerText = config.miniThreatEnabled ? getHookThreatText() : '';
        hookThreat.classList.toggle('hidden', !config.miniThreatEnabled);
    }
    const choice1 = hook.querySelector('.hook-choice-1');
    const choice2 = hook.querySelector('.hook-choice-2');
    if (choice1) choice1.style.setProperty('--hook-color', config.team1.color);
    if (choice2) choice2.style.setProperty('--hook-color', config.team2.color);
    renderHookOdds(getConfiguredOdds().team1, false);
    if (hookLogo1) {
        hookLogo1.style.setProperty('--hook-color', config.team1.color);
        hookLogo1.style.backgroundImage = config.team1.logo ? `url(${config.team1.logo.src})` : '';
    }
    if (hookLogo2) {
        hookLogo2.style.setProperty('--hook-color', config.team2.color);
        hookLogo2.style.backgroundImage = config.team2.logo ? `url(${config.team2.logo.src})` : '';
    }
}

function schedulePreMatch(fn, delay) {
    const id = setTimeout(() => {
        preMatchTimeouts = preMatchTimeouts.filter(timeoutId => timeoutId !== id);
        fn();
    }, delay);
    preMatchTimeouts.push(id);
    return id;
}

function clearPreMatchTimeline() {
    preMatchTimeouts.forEach(clearTimeout);
    preMatchTimeouts = [];
    stopHookOddsAnimation();
    if (preMatchCountdownInterval) {
        clearInterval(preMatchCountdownInterval);
        preMatchCountdownInterval = null;
    }
    const viewport = document.getElementById('mainViewport');
    if (viewport) viewport.classList.remove('video-edit-hold', 'video-edit-ready');
    stopColdOpenVideo();
}

const PRE_MATCH_BANNER_MS = 500;
const PRE_VS_HOOK_MS = 2000;
const PRE_VS_PERCENT_SOUND_DELAY_MS = 650;
const COLD_OPEN_VIDEO_MS = 1150;
const COLD_OPEN_FADE_MS = 420;
const COLD_OPEN_CANDIDATES = [
    'intro1.mp4', 'intro2.mp4', 'intro3.mp4', 'intro4.mp4', 'intro5.mp4', 'intro6.mp4', 'intro7.mp4', 'intro8.mp4',
    'intro1.webm', 'intro2.webm', 'intro3.webm', 'intro4.webm', 'intro5.webm', 'intro6.webm', 'intro7.webm', 'intro8.webm'
];
const HOOK_THREAT_LINES = {
    tr: [
        'BURADA BİR TERSLİK VAR',
        'BİR ANDA HER ŞEY DEĞİŞEBİLİR',
        'O KADAR KOLAY DEĞİL',
        'BİR ANLIK HATA YETER',
        'GERGİN BİR MAÇ',
        'İŞLER KARIŞABİLİR',
        'BU MAÇTA BİR GARİPLİK VAR'
    ],
    en: [
        'SOMETHING FEELS OFF HERE',
        'EVERYTHING CAN CHANGE FAST',
        'IT IS NOT THAT SIMPLE',
        'ONE MISTAKE IS ENOUGH',
        'THIS ONE FEELS TENSE',
        'THINGS CAN GET MESSY',
        'THIS MATCH FEELS STRANGE'
    ]
};
let availableColdOpenVideos = null;
let coldOpenProbeStarted = false;
let coldOpenProbeComplete = false;
let preMatchBannerAvailable = true;
const preMatchBannerImg = document.getElementById('preMatchBannerImg');
if (preMatchBannerImg) {
    preMatchBannerImg.addEventListener('error', () => {
        preMatchBannerAvailable = false;
    });
}

function playPreMatchBanner() {
    const banner = document.getElementById('preMatchBanner');
    if (!banner || !preMatchBannerAvailable) return 0;
    const editPauseMs = videoEditMode ? VIDEO_EDIT_PAUSE_MS : 0;
    banner.classList.add('active');
    schedulePreMatch(() => banner.classList.remove('active'), PRE_MATCH_BANNER_MS);
    return PRE_MATCH_BANNER_MS + editPauseMs;
}

function probeColdOpenVideo(file) {
    return new Promise(resolve => {
        const video = document.createElement('video');
        const done = (ok) => {
            video.onloadedmetadata = null;
            video.onerror = null;
            resolve(ok ? file : null);
        };
        const timeout = setTimeout(() => done(false), 900);
        video.onloadedmetadata = () => {
            clearTimeout(timeout);
            done(true);
        };
        video.onerror = () => {
            clearTimeout(timeout);
            done(false);
        };
        video.preload = 'metadata';
        video.src = videoAsset(`intros/${file}`);
    });
}

function refreshColdOpenCandidates() {
    if (coldOpenProbeStarted) return;
    coldOpenProbeStarted = true;
    Promise.all(COLD_OPEN_CANDIDATES.map(probeColdOpenVideo)).then(results => {
        availableColdOpenVideos = results.filter(Boolean);
        coldOpenProbeComplete = true;
    }).catch(() => {
        availableColdOpenVideos = [];
        coldOpenProbeComplete = true;
    });
}

function pickColdOpenVideo() {
    if (!coldOpenProbeComplete) return null;
    const pool = availableColdOpenVideos || [];
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

function stopColdOpenVideo() {
    const overlay = document.getElementById('coldOpenOverlay');
    const video = document.getElementById('coldOpenVideo');
    if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
    }
    if (overlay) overlay.classList.remove('active', 'dissolve-out');
}

function playColdOpenVideo(delay = 0) {
    if (!config.coldOpenEnabled) return delay;
    const overlay = document.getElementById('coldOpenOverlay');
    const video = document.getElementById('coldOpenVideo');
    const file = pickColdOpenVideo();
    if (!overlay || !video || !file) return delay;

    schedulePreMatch(() => {
        video.src = videoAsset(`intros/${file}`);
        video.currentTime = 0;
        video.volume = 0.85;
        video.muted = isMuted;
        overlay.classList.remove('dissolve-out');
        overlay.classList.add('active');
        const playPromise = video.play();
        if (playPromise) playPromise.catch(() => {
            overlay.classList.remove('active', 'dissolve-out');
        });
    }, delay);
    schedulePreMatch(() => overlay.classList.add('dissolve-out'), delay + Math.max(260, COLD_OPEN_VIDEO_MS - 80));
    schedulePreMatch(stopColdOpenVideo, delay + COLD_OPEN_VIDEO_MS + COLD_OPEN_FADE_MS);
    return delay + COLD_OPEN_VIDEO_MS;
}

function getHookThreatText() {
    const lines = HOOK_THREAT_LINES[currentLang] || HOOK_THREAT_LINES.tr;
    return lines[Math.floor(Math.random() * lines.length)];
}

function playPreVsHook(delay = 0) {
    const hook = document.getElementById('preVsHook');
    if (!hook) return delay;
    const editPauseMs = videoEditMode ? VIDEO_EDIT_PAUSE_MS : 0;
    updatePreVsHook();
    schedulePreMatch(() => {
        hook.classList.remove('active');
        void hook.offsetWidth;
        hook.classList.add('active');
        animateHookOdds(PRE_VS_HOOK_MS);
    }, delay);
    schedulePreMatch(() => { hook.classList.remove('active'); stopHookOddsAnimation(); }, delay + PRE_VS_HOOK_MS);
    return delay + PRE_VS_HOOK_MS + editPauseMs;
}

function setSettingsPanelOpen(isOpen) {
    const panel = document.getElementById('settingsPanel');
    const toggle = document.getElementById('settingsPanelToggle');
    if (!panel || !toggle) return;

    panel.classList.toggle('active', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    toggle.setAttribute('aria-label', isOpen ? 'Ayar panelini kapat' : 'Ayar panelini aç');
    const icon = toggle.querySelector('span');
    if (icon) icon.innerHTML = isOpen ? '&lsaquo;' : '&rsaquo;';
}

function initSettingsPanelToggle() {
    const panel = document.getElementById('settingsPanel');
    const toggle = document.getElementById('settingsPanelToggle');
    if (!panel || !toggle) return;

    toggle.onclick = () => setSettingsPanelOpen(!panel.classList.contains('active'));

    let touchStartX = 0;
    let touchStartY = 0;
    panel.addEventListener('touchstart', (event) => {
        const touch = event.changedTouches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
    }, { passive: true });
    panel.addEventListener('touchend', (event) => {
        const touch = event.changedTouches[0];
        const dx = touch.clientX - touchStartX;
        const dy = Math.abs(touch.clientY - touchStartY);
        if (panel.classList.contains('active') && dx < -60 && dy < 70) setSettingsPanelOpen(false);
    }, { passive: true });

    setSettingsPanelOpen(true);
}

function wrapPanelContent(container, trigger, contentClass) {
    if (!container || !trigger || container.querySelector(`:scope > .${contentClass}`)) return;
    const content = document.createElement('div');
    content.className = contentClass;
    Array.from(container.children)
        .filter(child => child !== trigger)
        .forEach(child => content.appendChild(child));
    container.appendChild(content);
}

function initCollapsibleControl(container, trigger) {
    if (!container || !trigger || trigger.dataset.collapseReady === 'true') return;
    trigger.dataset.collapseReady = 'true';
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('tabindex', '0');
    const toggle = () => container.classList.toggle('collapsed');
    trigger.addEventListener('click', toggle);
    trigger.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggle();
    });
}

function markScenarioSettingRows() {
    ['scenarioLeadTeam', 'scenarioLeadUntil', 'scenarioWinnerTeam', 'scenarioStrength', 'scenarioFailsafeToggle'].forEach(id => {
        const input = document.getElementById(id);
        const row = input?.closest('.setting-item, .toggle-setting');
        if (row) row.classList.add('scenario-setting');
    });
}

function updateScenarioSettingsVisibility() {
    markScenarioSettingRows();
    const enabled = !!document.getElementById('scenarioModeToggle')?.checked;
    document.querySelectorAll('.scenario-setting').forEach(row => row.classList.toggle('hidden', !enabled));
}

function initCollapsibleSettings() {
    markScenarioSettingRows();
    document.querySelectorAll('.settings-section.collapsible-section').forEach(section => {
        const title = section.querySelector(':scope > .section-title');
        wrapPanelContent(section, title, 'section-content');
        initCollapsibleControl(section, title);
    });
    document.querySelectorAll('.collapsible-block').forEach(block => {
        const title = block.querySelector(':scope > .mini-section-title');
        wrapPanelContent(block, title, 'collapsible-content');
        initCollapsibleControl(block, title);
    });
    document.querySelectorAll('.collapsible-setting').forEach(item => {
        const label = item.querySelector(':scope > label');
        wrapPanelContent(item, label, 'setting-collapse-content');
        initCollapsibleControl(item, label);
    });
    updateScenarioSettingsVisibility();
}

function resetMatchRuntimeState(showIdle = true) {
    clearPreMatchTimeline();
    clearAllViewportEffectTimeouts();
    clearMatchEndTimeouts();
    clearGoalCinematicTimers();
    clearModeFadeTimeout();
    stopMatchTimer();
    if (tempModeTimeout) { clearTimeout(tempModeTimeout); tempModeTimeout = null; }
    if (tempModeIntroTimeout) { clearTimeout(tempModeIntroTimeout); tempModeIntroTimeout = null; }
    if (blackoutExitTimeout) { clearTimeout(blackoutExitTimeout); blackoutExitTimeout = null; }
    blackoutExitHold = false;
    if (pendingUnrealBurstTimeout) { clearTimeout(pendingUnrealBurstTimeout); pendingUnrealBurstTimeout = null; }
    if (overtimeResumeTimeout) { clearTimeout(overtimeResumeTimeout); overtimeResumeTimeout = null; }
    restoreModeBallScale();
    restoreSingleBallGoals();
    clearExtraModeBalls();
    clearModeBumpers();
    if (goalSensor) goalSensor.modeTeam = null;
    if (extraGoalSensor) {
        extraGoalSensor.modeTeam = null;
        Body.setPosition(extraGoalSensor, { x: -1000, y: -1000 });
    }
    activeTempMode = null;
    tempModeState = {};
    tempModeTriggeredByAuto = false;
    isRunning = false;
    isGameStarted = false;
    isEnding = false;
    isPaused = false;
    isSlowMotion = false;
    isGoalCinematic = false;
    finalRushActive = false;
    finalRushSoundPlayed = false;
    overtimeCount = 0;
    bumbumCounter = 0;
    lastScoringTeam = null;
    scenarioLastFailsafeAt = 0;
    scoringStreakTeam = null;
    scoringStreakCount = 0;
    lastGoalGameSecond = null;
    lastUnrealBurstAt = 0;
    lastBounceSoundAt = 0;
    highSpeedAudioCooldownUntil = 0;
    lastGoalSoundAt = 0;
    lastNetSoundAt = 0;
    activeSoundPriority = 0;
    activeSoundPriorityUntil = 0;
    if (engine) engine.timing.timeScale = BASE_ENGINE_TIME_SCALE;
    clearOvertimeTimerVisuals(true);
    resetAutoModeCharge();
    resetBestFrameCapture();
    setTempModeVisuals(null);
    setModeButtonsState();
    trails = [];
    sparks = [];
    explosions = [];
    bursts = [];
    confetti = [];
    shakeTime = 0;

    const viewport = document.getElementById('mainViewport');
    if (viewport) {
        viewport.classList.remove('match-focus', 'darken-bg', 'glitch-active', 'goal-flash', 'zoom-burst', 'match-end-state', 'ui-swapped', 'video-edit-hold', 'video-edit-ready', 'winner-impact', 'mode-fading', 'mode-active', 'final-rush', ...getModeClassList());
    }
    if (uiSwapTimeout) { clearTimeout(uiSwapTimeout); uiSwapTimeout = null; }
    document.querySelectorAll('.match-end-overlay, .goal-overlay, .overtime-overlay, .epic-shockwave, .temp-mode-overlay, .manual-text-overlay, .referee-start-ripple').forEach(el => el.remove());
    const banner = document.getElementById('preMatchBanner'); if (banner) banner.classList.remove('active');
    stopColdOpenVideo();
    const hook = document.getElementById('preVsHook'); if (hook) hook.classList.remove('active');
    const intro = document.getElementById('matchIntro'); if (intro) intro.classList.remove('active', 'glitch-out');
    const spotlight = document.getElementById('winnerSpotlight'); resetWinnerSpotlightState(spotlight);
    const subscribe = document.getElementById('subscribeContainer'); if (subscribe) subscribe.classList.remove('active', 'winner-mode');
    hideBestFrameOverlay();
    const header = document.querySelector('.simulation-header'); if (header) header.classList.add('hidden');
    const idleOverlay = document.getElementById('idleOverlay'); if (idleOverlay) idleOverlay.classList.toggle('hidden', !showIdle);
    const pBtn = document.getElementById('pauseGame'); if(pBtn) { pBtn.innerText = i18n[currentLang].pause; pBtn.classList.remove('active'); }
    if (sounds.ambient) sounds.ambient.pause();
    if (render?.canvas) render.canvas.classList.remove('dramatic-mode', 'chromatic-aberration');
}

document.getElementById('applySettings').onclick = () => {
    clearPreMatchTimeline();
    clearMatchEndTimeouts();
    clearGoalCinematicTimers();
    clearModeFadeTimeout();
    document.querySelector('.simulation-header').classList.add('hidden');
    const idleOverlay = document.getElementById('idleOverlay'); if (idleOverlay) idleOverlay.classList.add('hidden');
    clearAllViewportEffectTimeouts();
    const viewport = document.getElementById('mainViewport'); if (viewport) viewport.classList.remove('match-focus', 'darken-bg', 'glitch-active', 'goal-flash', 'zoom-burst', 'match-end-state', 'ui-swapped', 'video-edit-hold', 'video-edit-ready', 'winner-impact', 'mode-fading', 'mode-active', 'final-rush', ...getModeClassList());
    if (uiSwapTimeout) { clearTimeout(uiSwapTimeout); uiSwapTimeout = null; }
    const banner = document.getElementById('preMatchBanner'); if (banner) banner.classList.remove('active');
    stopColdOpenVideo();
    const hook = document.getElementById('preVsHook'); if (hook) hook.classList.remove('active');
    const spotlight = document.getElementById('winnerSpotlight'); resetWinnerSpotlightState(spotlight);
    hideBestFrameOverlay();
    if (tempModeTimeout) { clearTimeout(tempModeTimeout); tempModeTimeout = null; }
    if (tempModeIntroTimeout) { clearTimeout(tempModeIntroTimeout); tempModeIntroTimeout = null; }
    if (blackoutExitTimeout) { clearTimeout(blackoutExitTimeout); blackoutExitTimeout = null; }
    blackoutExitHold = false;
    clearOvertimeTimerVisuals(true);
    activeTempMode = null;
    tempModeState = {};
    tempModeTriggeredByAuto = false;
    setTempModeVisuals(null);
    if (pendingUnrealBurstTimeout) { clearTimeout(pendingUnrealBurstTimeout); pendingUnrealBurstTimeout = null; }
    isEnding = false; overtimeCount = 0; isPaused = false; bumbumCounter = 0; lastScoringTeam = null; isGoalCinematic = false; finalRushActive = false; finalRushSoundPlayed = false; tempModeTriggeredByAuto = false; scenarioLastFailsafeAt = 0; scoringStreakTeam = null; scoringStreakCount = 0; lastGoalGameSecond = null; lastUnrealBurstAt = 0; lastBounceSoundAt = 0; highSpeedAudioCooldownUntil = 0; lastGoalSoundAt = 0; lastNetSoundAt = 0; activeSoundPriority = 0; activeSoundPriorityUntil = 0; resetAutoModeCharge();
    scenarioLastFailsafeAt = 0;
    resetScoresForNewMatch();
    resetBestFrameCapture();
    setModeButtonsState();
    const pBtn = document.getElementById('pauseGame'); if(pBtn) { pBtn.innerText = i18n[currentLang].pause; pBtn.classList.remove('active'); }
    unlockAudio(); applySettingsToConfig(); saveCurrentSettings(); init();
    if (videoEditMode && viewport) viewport.classList.add('video-edit-hold');
    if (sounds.ambient) { 
        sounds.ambient.volume = AMBIENT_VOLUME; 
        schedulePreMatch(() => { sounds.ambient.play().catch(e => console.log('Ambience error:', e)); }, 100); 
    }
    render.canvas.classList.remove('dramatic-mode');
    
    const preMatchBannerDelay = playPreMatchBanner();
    const coldOpenDelay = playColdOpenVideo(preMatchBannerDelay);
    const preVsDelay = playPreVsHook(coldOpenDelay);
    const editVsTotalMs = videoEditMode ? getVideoEditVsDurationMs() : 0;
    const vsPreCountdownPause = videoEditMode ? 0 : 1000;
    const countdownStepMs = videoEditMode ? editVsTotalMs / 3 : 300;
    const matchStartDelay = videoEditMode ? preVsDelay + editVsTotalMs : preVsDelay + vsPreCountdownPause + (countdownStepMs * 3);
    const introExitFxMs = videoEditMode ? 0 : 600;
    const readyDelayMs = videoEditMode ? VIDEO_EDIT_READY_DELAY_MS : 0;
    const actualMatchStartDelay = matchStartDelay + introExitFxMs + readyDelayMs;

    // Intro Screen opens after the optional hook screens
    const intro = document.getElementById('matchIntro'); 
    schedulePreMatch(() => intro.classList.add('active'), preVsDelay);
    schedulePreMatch(() => playSoundEffect(sounds.glassHit, 1.0, 'Glass hit sound'), preVsDelay + 350);
    
    // Wait 1 second of silence/pause before starting the countdown
    schedulePreMatch(() => {
        const countdownEl = document.getElementById('giantCountdown');
        if (countdownEl) {
            countdownEl.innerText = '3';
            playSoundEffect(sounds.countdown, 1.0, 'Countdown sound');
            countdownEl.classList.remove('pulse');
            void countdownEl.offsetWidth;
            countdownEl.classList.add('pulse');
            
            let count = 2;
            preMatchCountdownInterval = setInterval(() => {
                if (count > 0) {
                    countdownEl.innerText = count.toString();
                    countdownEl.classList.remove('pulse');
                    void countdownEl.offsetWidth;
                    countdownEl.classList.add('pulse');
                    count--;
                } else {
                    clearInterval(preMatchCountdownInterval);
                    preMatchCountdownInterval = null;
                }
            }, countdownStepMs);
        }
        
        if (!videoEditMode && sounds.bumbum && !isMuted) { 
            sounds.bumbum.currentTime = 0; 
            sounds.bumbum.volume = BUMBUM_VOLUME;
            sounds.bumbum.play().catch(e=>console.log(e)); 
        }
    }, preVsDelay + vsPreCountdownPause);
    
    schedulePreMatch(() => { 
        if (!videoEditMode) intro.classList.add('glitch-out'); 
        schedulePreMatch(() => { 
            intro.classList.remove('active', 'glitch-out'); 
            if (preMatchCountdownInterval) {
                clearInterval(preMatchCountdownInterval);
                preMatchCountdownInterval = null;
            }
            
            const vp = document.getElementById('mainViewport');
            if (vp) {
                vp.classList.remove('video-edit-hold');
                if (videoEditMode) vp.classList.add('video-edit-ready');
            }
            if (vp && !videoEditMode) {
                clearViewportEffectTimeout('goalZoom');
                clearViewportEffectTimeout('freezeZoom');
                vp.classList.add('zoom-burst');
                scheduleViewportEffectRemoval(vp, ['zoom-burst'], 1600, 'introZoom');
            }

        }, introExitFxMs); 
    }, matchStartDelay);

    schedulePreMatch(() => {
            const vp = document.getElementById('mainViewport');
            if (vp) vp.classList.remove('video-edit-ready');

            document.querySelector('.simulation-header').classList.remove('hidden'); 
            balls.forEach(ball => resetBall(ball)); 
            isRunning = true; 
            isGameStarted = true;
            updateAutoModeBar();
            startMatchTimer();
            uiSwapTimeout = setTimeout(() => {
                const vp = document.getElementById('mainViewport');
                if (vp && !isEnding) vp.classList.add('ui-swapped');
            }, UI_SWAP_DELAY_MS);

            schedulePreMatch(() => {
                showManualTextBurst('letsGo', true);
            }, 520);

            schedulePreMatch(() => {
                if (videoEditMode && sounds.bumbum && !isMuted) {
                    sounds.bumbum.currentTime = 0;
                    sounds.bumbum.volume = BUMBUM_VOLUME;
                    sounds.bumbum.play().catch(e=>console.log(e));
                }

                if (sounds.whistle && !isMuted) { 
                    for(let i=0; i<3; i++) {
                        const w = sounds.whistle.cloneNode();
                        w.volume = 1.0;
                        w.play().catch(e=>console.log(e));
                    }
                }
                const ripple = document.createElement('div');
                ripple.className = 'referee-start-ripple';
                document.getElementById('mainViewport').appendChild(ripple);
                schedulePreMatch(() => ripple.remove(), 1200);
            }, 80);
    }, actualMatchStartDelay);
};

document.getElementById('fullResetSim').onclick = () => { 
    if (!confirm(i18n[currentLang].confirmReset)) return;
    clearPreMatchTimeline();
    
    // Reset inputs
    document.getElementById('mainTitle').value = i18n[currentLang].defaultTitle;
    document.getElementById('team1Name').value = 'Fenerbahçe';
    document.getElementById('team2Name').value = 'Galatasaray';
    document.getElementById('team1Color').value = '#fbbf24';
    document.getElementById('team1Color2').value = '#1e3a8a';
    document.getElementById('team2Color').value = '#ef4444';
    document.getElementById('team2Color2').value = '#fbbf24';
    const team1PresetSelect = document.getElementById('team1Preset');
    const team2PresetSelect = document.getElementById('team2Preset');
    if (team1PresetSelect) team1PresetSelect.value = TEAM_PRESET_MANUAL;
    if (team2PresetSelect) team2PresetSelect.value = TEAM_PRESET_MANUAL;
    const team1LogoInput = document.getElementById('team1Logo');
    const team2LogoInput = document.getElementById('team2Logo');
    if (team1LogoInput) team1LogoInput.value = '';
    if (team2LogoInput) team2LogoInput.value = '';
    config.team1.logo = null;
    config.team2.logo = null;
    ['introLogo1', 'idleLogo1', 'introLogo2', 'idleLogo2', 'spotlightLogo', 'drawLogo1', 'drawLogo2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.backgroundImage = '';
    });
    document.getElementById('matchDuration').value = 60;
    const matchTypeSelect = document.getElementById('matchType');
    if (matchTypeSelect) matchTypeSelect.value = 'normal';
    const timerStyleSelect = document.getElementById('timerStyle');
    if (timerStyleSelect) timerStyleSelect.value = 'classic';
    const autoPrioritySelect = document.getElementById('autoModePriority');
    if (autoPrioritySelect) autoPrioritySelect.value = 'mixed';
    setAutoModePoolControls(AUTO_MODE_IDS);
    document.getElementById('oddsFavoriteTeam').value = 1;
    document.getElementById('oddsFavoritePercent').value = 58;
    const miniThreatToggle = document.getElementById('miniThreatToggle');
    if (miniThreatToggle) miniThreatToggle.checked = true;
    const coldOpenToggle = document.getElementById('coldOpenToggle');
    if (coldOpenToggle) coldOpenToggle.checked = true;
    const allowDrawToggle = document.getElementById('allowDrawToggle');
    if (allowDrawToggle) allowDrawToggle.checked = false;
    document.getElementById('scenarioModeToggle').checked = false;
    document.getElementById('scenarioLeadTeam').value = 1;
    document.getElementById('scenarioLeadUntil').value = 20;
    document.getElementById('scenarioWinnerTeam').value = 2;
    document.getElementById('scenarioStrength').value = 'medium';
    document.getElementById('scenarioFailsafeToggle').checked = true;
    document.getElementById('winnerFxToggle').checked = true;
    document.getElementById('finalRushFxToggle').checked = true;
    document.getElementById('extraGlowFxToggle').checked = true;
    document.getElementById('soundPriorityToggle').checked = true;
    document.getElementById('lowPerformanceToggle').checked = false;
    const videoEditToggle = document.getElementById('videoEditModeToggle');
    if (videoEditToggle) videoEditToggle.checked = false;
    document.getElementById('videoEditVsDuration').value = DEFAULT_VIDEO_EDIT_VS_SECONDS;
    document.getElementById('simSpeed').value = 20;
    document.getElementById('ballLaunchSpeed').value = 12;
    document.getElementById('ballBounciness').value = 30;
    document.getElementById('ballDamping').value = 25;
    populateArenaSelect(DEFAULT_ARENA_SRC);
    document.getElementById('team1Color3').value = '#ffffff';
    document.getElementById('team2Color3').value = '#ffffff';
    setThirdColorEnabled(1, false);
    setThirdColorEnabled(2, false);
    
    // Reset config object to reference values
    config.rotationSpeed = 0.020;
    config.ballLaunchSpeed = 12;
    config.matchDuration = 60;
    config.matchType = 'normal';
    config.timerStyle = 'classic';
    config.matchClockStoppageMinutes = 0;
    config.autoModePriority = 'mixed';
    config.autoModePool = [...AUTO_MODE_IDS];
    config.ballBounciness = 1.0;
    config.ballDamping = 0.005;
    config.arenaBackground = DEFAULT_ARENA_SRC;
    config.videoEditVsDuration = DEFAULT_VIDEO_EDIT_VS_SECONDS;
    config.oddsFavoriteTeam = 1;
    config.oddsFavoritePercent = 58;
    config.miniThreatEnabled = true;
    config.coldOpenEnabled = true;
    config.allowDraw = false;
    config.scenarioEnabled = false;
    config.scenarioLeadTeam = 1;
    config.scenarioLeadUntil = 20;
    config.scenarioWinnerTeam = 2;
    config.scenarioStrength = 'medium';
    config.scenarioFailsafe = true;
    config.winnerFx = true;
    config.finalRushFx = true;
    config.extraGlowFx = true;
    config.soundPriorityFx = true;
    config.lowPerformanceMode = false;
    videoEditMode = false;
    
    clearAllViewportEffectTimeouts();
    clearMatchEndTimeouts();
    clearGoalCinematicTimers();
    clearModeFadeTimeout();
    const viewport = document.getElementById('mainViewport'); if (viewport) viewport.classList.remove('match-focus', 'darken-bg', 'glitch-active', 'goal-flash', 'zoom-burst', 'match-end-state', 'ui-swapped', 'winner-impact', 'final-rush');
    if (uiSwapTimeout) { clearTimeout(uiSwapTimeout); uiSwapTimeout = null; }
    const banner = document.getElementById('preMatchBanner'); if (banner) banner.classList.remove('active');
    stopColdOpenVideo();
    const hook = document.getElementById('preVsHook'); if (hook) hook.classList.remove('active');
    const spotlight = document.getElementById('winnerSpotlight'); resetWinnerSpotlightState(spotlight);
    hideBestFrameOverlay();
    const subscribe = document.getElementById('subscribeContainer'); if (subscribe) subscribe.classList.remove('active', 'winner-mode');
    clearOvertimeTimerVisuals(true);
    if (pendingUnrealBurstTimeout) { clearTimeout(pendingUnrealBurstTimeout); pendingUnrealBurstTimeout = null; }
    isEnding = false; overtimeCount = 0; isPaused = false; bumbumCounter = 0; lastScoringTeam = null; isGoalCinematic = false; finalRushActive = false; finalRushSoundPlayed = false; tempModeTriggeredByAuto = false; scoringStreakTeam = null; scoringStreakCount = 0; lastGoalGameSecond = null; lastUnrealBurstAt = 0; lastBounceSoundAt = 0; highSpeedAudioCooldownUntil = 0; lastGoalSoundAt = 0; lastNetSoundAt = 0; activeSoundPriority = 0; activeSoundPriorityUntil = 0; resetAutoModeCharge();
    const pBtn = document.getElementById('pauseGame'); if(pBtn) { pBtn.innerText = i18n[currentLang].pause; pBtn.classList.remove('active'); }
    isRunning = false; isGameStarted = false; stopMatchTimer(); endTempMode(); clearModeFadeTimeout(); if (viewport) viewport.classList.remove('mode-fading', 'mode-active', ...getModeClassList()); if (sounds.ambient) sounds.ambient.pause(); 
    resetScoresForNewMatch();
    applySettingsToConfig(); init(); updateIntroUI(); setSettingsPanelOpen(true); 
};

document.getElementById('resetMatchSim').onclick = () => {
    resetMatchRuntimeState(true);
    applySettingsToConfig();
    timeLeft = config.matchDuration;
    resetScoresForNewMatch();
    saveCurrentSettings();
    init();
    updateIntroUI();
    setSettingsPanelOpen(true);
};

document.getElementById('pauseGame').onclick = () => {
    if (!isGameStarted && !isPaused) return;
    isPaused = !isPaused; isRunning = !isPaused;
    const btn = document.getElementById('pauseGame');
    if (isPaused) { btn.innerText = i18n[currentLang].resume; btn.classList.add('active'); stopMatchTimer(); }
    else { btn.innerText = i18n[currentLang].pause; btn.classList.remove('active'); autoModeLastUpdate = performance.now(); if (isGameStarted && !isEnding && !isMatchTimerFrozen()) { startMatchTimer(); } }
};

document.getElementById('speedMode').onclick = () => activateTempMode('speed');
document.getElementById('speed4Mode').onclick = () => activateTempMode('speed4');
document.getElementById('twoGoalMode').onclick = () => activateTempMode('twoGoals');
document.getElementById('singleBallGoalMode').onclick = () => activateTempMode('singleBallGoals');
document.getElementById('reverseMode').onclick = () => activateTempMode('reverse');
document.getElementById('shrinkMode').onclick = () => activateTempMode('shrink');
document.getElementById('multiBallMode').onclick = () => activateTempMode('multiBall');
document.getElementById('goldenTouchMode').onclick = () => activateTempMode('goldenTouch');
document.getElementById('freezeFrameMode').onclick = () => activateTempMode('freezeFrame');
document.getElementById('bumperMode').onclick = () => activateTempMode('bumper');
document.getElementById('tinyBallMode').onclick = () => activateTempMode('tinyBall');
document.getElementById('heavyBallMode').onclick = () => activateTempMode('heavyBall');
document.getElementById('goalSwapMode').onclick = () => activateTempMode('goalSwap');
document.getElementById('stopCircleMode').onclick = () => activateTempMode('stopCircle');
document.getElementById('stealPointMode').onclick = () => activateTempMode('stealPoint');
document.getElementById('goalEraseMode').onclick = () => activateTempMode('goalErase');
document.getElementById('blackoutMode').onclick = () => activateTempMode('blackout');
document.getElementById('lastGoalWinsMode').onclick = () => activateTempMode('lastGoalWins');
document.getElementById('arenaDepthMode').onclick = () => activateTempMode('arenaDepth');
document.getElementById('clutchMode').onclick = () => activateTempMode('clutch');
document.querySelectorAll('[data-manual-burst]').forEach(btn => {
    btn.onclick = () => showManualTextBurst(btn.dataset.manualBurst);
});
const manualCustomShow = document.getElementById('manualCustomShow');
if (manualCustomShow) manualCustomShow.onclick = showCustomManualTextBurst;
const manualCustomText = document.getElementById('manualCustomText');
if (manualCustomText) {
    manualCustomText.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            showCustomManualTextBurst();
        }
    });
}
const showBestFrameBtn = document.getElementById('showBestFrame');
if (showBestFrameBtn) showBestFrameBtn.onclick = showBestFrameOverlay;
const bestFrameCloseBtn = document.getElementById('bestFrameClose');
if (bestFrameCloseBtn) bestFrameCloseBtn.onclick = hideBestFrameOverlay;
const bestFrameOverlay = document.getElementById('bestFrameOverlay');
if (bestFrameOverlay) {
    bestFrameOverlay.addEventListener('click', (event) => {
        if (event.target === bestFrameOverlay) hideBestFrameOverlay();
    });
}
document.querySelectorAll('[data-chaos-mode]').forEach(input => {
    input.addEventListener('change', () => {
        config.autoModePool = getSelectedAutoModePool();
        saveCurrentSettings();
    });
});
const matchTypeInput = document.getElementById('matchType');
if (matchTypeInput) {
    matchTypeInput.addEventListener('change', () => {
        applySettingsToConfig();
        saveCurrentSettings();
    });
}
['winnerFxToggle', 'finalRushFxToggle', 'extraGlowFxToggle', 'soundPriorityToggle', 'lowPerformanceToggle', 'miniThreatToggle', 'coldOpenToggle'].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('change', () => {
        applySettingsToConfig();
        if (!config.finalRushFx || config.lowPerformanceMode) setFinalRushActive(false);
        saveCurrentSettings();
    });
});
const scenarioModeToggle = document.getElementById('scenarioModeToggle');
if (scenarioModeToggle) {
    scenarioModeToggle.addEventListener('change', () => {
        updateScenarioSettingsVisibility();
        applySettingsToConfig();
        saveCurrentSettings();
    });
}

document.getElementById('muteSound').onclick = () => {
    isMuted = !isMuted;
    const btn = document.getElementById('muteSound');
    Object.values(sounds).forEach(s => { if (s) s.muted = isMuted; });
    if (isMuted) {
        btn.innerText = i18n[currentLang].muted;
        btn.classList.add('active');
    } else {
        btn.innerText = i18n[currentLang].sound;
        btn.classList.remove('active');
    }
};

initArenaControls(); initTeamPresetControls(); initCollapsibleSettings(); init(); isRunning = false; loadSavedSettings(); updateScenarioSettingsVisibility(); updateIntroUI(); setModeButtonsState(); initSettingsPanelToggle();

// --- SUBSCRIBE ANIMATION (SVG FILTER CHROMA KEY) ---
function initSubscribe() {
    subscribeVideo = document.getElementById('subscribeVideo');
    if (subscribeVideo) {
        subscribeVideo.preload = 'auto';
        subscribeVideo.playbackRate = 2.0;
        subscribeVideo.load();
    }
}

function startSubscribeAnimation(isWinnerMode = false) {
    if (!subscribeVideo) initSubscribe();
    const container = document.getElementById('subscribeContainer');
    if (container && subscribeVideo) {
        if (subscribeHideTimeout) {
            clearTimeout(subscribeHideTimeout);
            subscribeHideTimeout = null;
        }
        if (isWinnerMode) container.classList.add('winner-mode');
        else container.classList.remove('winner-mode');
        
        // Set source based on language
        const isEng = currentLang === 'en';
        const videoSrc = isEng ? videoAsset('aboneeng.mp4') : videoAsset('abone.mp4');
        const currentSrc = subscribeVideo.getAttribute('src');
        
        if (isEng) container.classList.add('is-english');
        else container.classList.remove('is-english');
        
        if (currentSrc !== videoSrc) {
            subscribeVideo.src = videoSrc;
            subscribeVideo.load();
        }

        subscribeVideo.currentTime = 0;
        subscribeVideo.playbackRate = 2.0;
        subscribeVideo.play().then(() => {
            container.classList.add('active');
        }).catch(e => console.log("Video play failed:", e));
        
        // Auto-hide when video ends or after safety timeout
        const hide = () => {
            subscribeHideTimeout = null;
            container.classList.remove('active');
        };
        subscribeVideo.onended = hide;
        subscribeHideTimeout = setTimeout(hide, 8000);
    }
}

// Ensure settings and subscribe are ready
window.addEventListener('load', () => {
    initSubscribe();
    refreshColdOpenCandidates();
});
