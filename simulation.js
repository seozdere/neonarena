const { Engine, Render, Runner, Bodies, Composite, Body, Events, Vector } = Matter;

// Configuration
let config = {
    team1: { name: 'FENERBAHÇE', color: '#fbbf24', color2: '#1e3a8a', color3: '#ffffff', useColor3: false, score: 0, logo: null },
    team2: { name: 'GALATASARAY', color: '#ef4444', color2: '#fbbf24', color3: '#ffffff', useColor3: false, score: 0, logo: null },
    rotationSpeed: 0.020,
    ballLaunchSpeed: 12,
    matchDuration: 60,
    ballBounciness: 0.90,
    ballDamping: 0.005,
    ballSize: 18,
    circleRadius: 155,
    segmentCount: 80,
    gapSize: 8,
    centerX: 250,
    centerY: 250,
    arenaBackground: 'assets/images/arenas/pitch.png',
    videoEditVsDuration: 5
};

// --- SES AYARLARI ---
const AUDIO_DIR = 'assets/audio/';
const VIDEO_DIR = 'assets/video/';
const audioAsset = (file) => `${AUDIO_DIR}${file}`;
const videoAsset = (file) => `${VIDEO_DIR}${file}`;

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
    engel: new Audio(audioAsset('engel.wav'))
};
sounds.ambient.loop = true;
if (sounds.goal) sounds.goal.volume = 0.6;
if (sounds.tick) sounds.tick.volume = 0.4;
if (sounds.whistle) sounds.whistle.volume = 1.0;
if (sounds.gerilim) sounds.gerilim.volume = 1.0;
if (sounds.riser) sounds.riser.volume = 1.0;
if (sounds.doubleGoal) sounds.doubleGoal.volume = 1.0;
['reverse', 'tight', 'double', 'golden', 'freeze', 'engel'].forEach(key => { if (sounds[key]) sounds[key].volume = 1.0; });

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
let isSlowMotion = false;
let bumbumCounter = 0;
let currentLang = 'tr';
const UI_SWAP_DELAY_MS = 4500;
let lastScoringTeam = null;
const BASE_ENGINE_TIME_SCALE = 1.25;
const TIMER_INTERVAL_MS = 800;
const SLOW_TIMER_INTERVAL_MS = 1600;
const TEMP_MODE_MS = 5000;
const TEMP_MODE_INTRO_SLOW_MS = 500;
const FREEZE_FRAME_SLOW_MS = 400;
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
    twoGoals: ['#f97316', '#facc15', '#fff7ed'],
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
    clutch: ['#ef4444', '#fb923c', '#ffffff']
};
let activeTempMode = null;
let tempModeTimeout = null;
let tempModeIntroTimeout = null;
let overtimeTimerFxTimeout = null;
let tempModeTriggeredByAuto = false;
let autoModeEnabled = false;
let autoModeCharge = 0;
let autoModeLastUpdate = performance.now();
let autoModeLastTriggerAt = 0;
let autoModeLastEventAt = 0;
let autoModeLastMode = null;
let isGoalCinematic = false;
let videoEditMode = false;
let preMatchTimeouts = [];
let preMatchCountdownInterval = null;
let subscribeVideo, subscribeCanvas, subscribeCtx;

const i18n = {
    tr: {
        simSettings: '<i class="icon-settings"></i> SİMÜLASYON AYARLARI',
        genSettings: 'GENEL AYARLAR',
        simTitle: 'Simülasyon Başlığı',
        matchDuration: 'Maç Süresi (Saniye)',
        autoModeToggle: 'Kaos Barı',
        autoModeBar: 'KAOS BARI',
        videoEditModeToggle: 'Video Edit Modu',
        videoEditVsDuration: 'Edit VS Süresi',
        arenaSelect: 'Arena / Pitch',
        arenaUpload: 'Arena Görselleri',
        selectArenas: 'Arena Seç',
        manualTextSettings: 'MANUEL YAZILAR',
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
        twoGoalMode: '2 KALE',
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
        clutchMode: 'KRİTİK AN',
        speedModeOverlay: '2X HIZ!',
        twoGoalModeOverlay: 'ÇİFT KALE!',
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
        clutchModeOverlay: 'KRİTİK AN!',
        pause: 'DURDUR',
        resume: 'DEVAM ET',
        sound: 'SES',
        muted: 'SES KAPALI',
        startSim: 'SİMÜLASYONU BAŞLAT',
        resetAll: 'Tüm Ayarları Sıfırla',
        winner: 'KAZANAN',
        overtime: 'UZATMALAR',
        whoWillWin: 'KİM KAZANACAK?',
        goal: 'GOOOL!',
        newMatch: 'YENİ MAÇ',
        defaultTitle: 'KİM KAZANACAK?',
        confirmReset: 'Tüm ayarlar orijinal referans değerlerine sıfırlanacak. Emin misiniz?'
    },
    en: {
        simSettings: '<i class="icon-settings"></i> SIMULATION SETTINGS',
        genSettings: 'GENERAL SETTINGS',
        simTitle: 'Simulation Title',
        matchDuration: 'Match Duration (Seconds)',
        autoModeToggle: 'Chaos Bar',
        autoModeBar: 'CHAOS BAR',
        videoEditModeToggle: 'Video Edit Mode',
        videoEditVsDuration: 'Edit VS Duration',
        arenaSelect: 'Arena / Pitch',
        arenaUpload: 'Arena Images',
        selectArenas: 'Select Arenas',
        manualTextSettings: 'MANUAL TEXTS',
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
        twoGoalMode: '2 GOALS',
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
        clutchMode: 'CLUTCH TIME',
        speedModeOverlay: '2X SPEED!',
        twoGoalModeOverlay: 'DOUBLE GOAL!',
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
        clutchModeOverlay: 'CLUTCH TIME!',
        pause: 'PAUSE',
        resume: 'RESUME',
        sound: 'SOUND',
        muted: 'MUTED',
        startSim: 'START SIMULATION',
        resetAll: 'Reset All Settings',
        winner: 'WINNER',
        overtime: 'OVERTIME',
        whoWillWin: 'WHO WILL WIN?',
        goal: 'GOAAL!',
        newMatch: 'NEW MATCH',
        defaultTitle: 'WHO WILL WIN?',
        confirmReset: 'All settings will be reset to original reference values. Are you sure?'
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
let arenaOptions = [];

function getArenaManifestOptions() {
    const manifest = Array.isArray(window.REELSSIM_ARENAS) && window.REELSSIM_ARENAS.length
        ? window.REELSSIM_ARENAS
        : [{ name: 'Neon Pitch', file: 'pitch.png' }];

    return manifest.map((entry) => {
        const item = typeof entry === 'string' ? { file: entry } : entry;
        const file = item.file || item.src || 'pitch.png';
        const src = item.src || `assets/images/arenas/${file}`;
        const name = item.name || file.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
        return { name, src, persistable: true };
    });
}

function setArenaBackground(src = DEFAULT_ARENA_SRC) {
    config.arenaBackground = src || DEFAULT_ARENA_SRC;
    document.documentElement.style.setProperty('--arena-bg', `url("${config.arenaBackground.replace(/"/g, '\\"')}")`);
}

function populateArenaSelect(selectedSrc = config.arenaBackground) {
    const select = document.getElementById('arenaSelect');
    if (!select) return;
    select.innerHTML = '';
    arenaOptions.forEach((arena, index) => {
        const option = document.createElement('option');
        option.value = arena.src;
        option.innerText = arena.name;
        option.dataset.persistable = arena.persistable ? 'true' : 'false';
        if (arena.src === selectedSrc || (!selectedSrc && index === 0)) option.selected = true;
        select.appendChild(option);
    });
    if (!select.value && arenaOptions[0]) select.value = arenaOptions[0].src;
    setArenaBackground(select.value || DEFAULT_ARENA_SRC);
}

function getPersistableArenaSelection() {
    const select = document.getElementById('arenaSelect');
    if (!select || !select.value) return DEFAULT_ARENA_SRC;
    const option = select.options[select.selectedIndex];
    return option && option.dataset.persistable === 'true' ? select.value : DEFAULT_ARENA_SRC;
}

function getVideoEditVsDurationMs() {
    const input = document.getElementById('videoEditVsDuration');
    const seconds = Math.max(2, Math.min(15, parseFloat(input?.value) || DEFAULT_VIDEO_EDIT_VS_SECONDS));
    if (input && input.value !== String(seconds)) input.value = seconds;
    return seconds * 1000;
}

function initArenaControls() {
    const select = document.getElementById('arenaSelect');
    const fileInput = document.getElementById('arenaFiles');
    arenaOptions = getArenaManifestOptions();
    populateArenaSelect(DEFAULT_ARENA_SRC);

    if (select) {
        select.addEventListener('change', () => {
            setArenaBackground(select.value);
            saveCurrentSettings();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            const files = Array.from(fileInput.files || []).filter(file => file.type.startsWith('image/'));
            if (!files.length) return;
            const firstNewSrc = URL.createObjectURL(files[0]);
            arenaOptions.push({ name: files[0].name, src: firstNewSrc, persistable: false });
            files.slice(1).forEach(file => {
                arenaOptions.push({ name: file.name, src: URL.createObjectURL(file), persistable: false });
            });
            populateArenaSelect(firstNewSrc);
        });
    }
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
        document.getElementById('team2Name').value = s.t2Name || 'Galatasaray';
        document.getElementById('team2Color').value = s.t2Color || '#ef4444';
        document.getElementById('team2Color2').value = s.t2Color2 || '#fbbf24';
        document.getElementById('team2Color3').value = s.t2Color3 || '#ffffff';
        setThirdColorEnabled(2, !!s.t2UseColor3);
        document.getElementById('simSpeed').value = s.simSpeed || 20;
        document.getElementById('ballLaunchSpeed').value = s.ballSpeed || 20;
        document.getElementById('ballBounciness').value = s.bounciness || 20;
        document.getElementById('ballDamping').value = s.damping || 25;
        document.getElementById('matchDuration').value = s.duration || 60;
        document.getElementById('autoModeToggle').checked = !!s.autoModeEnabled;
        const videoEditToggle = document.getElementById('videoEditModeToggle');
        if (videoEditToggle) videoEditToggle.checked = !!s.videoEditMode;
        const savedVsDuration = parseFloat(s.videoEditVsDuration);
        const migratedVsDuration = (s.settingsVersion || 1) < SETTINGS_VERSION && savedVsDuration === 5 ? DEFAULT_VIDEO_EDIT_VS_SECONDS : savedVsDuration;
        document.getElementById('videoEditVsDuration').value = Number.isFinite(migratedVsDuration) ? migratedVsDuration : DEFAULT_VIDEO_EDIT_VS_SECONDS;
        videoEditMode = !!s.videoEditMode;
        if (s.arenaBackground) populateArenaSelect(s.arenaBackground);
        autoModeEnabled = !!s.autoModeEnabled;
        updateAutoModeBar();
        applySettingsToConfig();
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
        t2Name: document.getElementById('team2Name').value,
        t2Color: document.getElementById('team2Color').value,
        t2Color2: document.getElementById('team2Color2').value,
        t2Color3: document.getElementById('team2Color3').value,
        t2UseColor3: config.team2.useColor3,
        simSpeed: document.getElementById('simSpeed').value,
        ballSpeed: document.getElementById('ballLaunchSpeed').value,
        bounciness: document.getElementById('ballBounciness').value,
        damping: document.getElementById('ballDamping').value,
        duration: document.getElementById('matchDuration').value,
        autoModeEnabled: document.getElementById('autoModeToggle').checked,
        videoEditMode: !!document.getElementById('videoEditModeToggle')?.checked,
        videoEditVsDuration: document.getElementById('videoEditVsDuration').value,
        arenaBackground: getPersistableArenaSelection()
    };
    localStorage.setItem('reelsSimSettings', JSON.stringify(s));
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
    return activeTempMode === 'twoGoals' || activeTempMode === 'clutch' ? SLOW_TIMER_INTERVAL_MS : TIMER_INTERVAL_MS;
}

function stopMatchTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function startMatchTimer() {
    stopMatchTimer();
    timerInterval = setInterval(updateTimer, getTimerIntervalMs());
}

function isMatchTimerFrozen() {
    return activeTempMode === 'freezeFrame';
}

const TEMP_MODE_CLASSES = {
    speed: 'mode-speed',
    twoGoals: 'mode-two-goals',
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
    clutch: 'mode-clutch'
};

const TEMP_MODE_BUTTONS = {
    speed: 'speedMode',
    twoGoals: 'twoGoalMode',
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
    clutch: 'clutchMode'
};

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
    return TEMP_MODE_ARENA_COLORS[mode] || ['#6366f1', '#e0e7ff', '#ffffff'];
}

function updateScoreboardTieState() {
    const scoreboard = document.querySelector('.scoreboard');
    if (!scoreboard) return;
    const isTie = config.team1.score === config.team2.score && (config.team1.score + config.team2.score) > 0 && !isEnding;
    scoreboard.classList.toggle('tie-fire', isTie);
}

function updateAutoModeBar() {
    const bar = document.getElementById('autoModeBar');
    const fill = document.getElementById('autoModeFill');
    const percent = document.getElementById('autoModePercent');
    const toggle = document.getElementById('autoModeToggle');
    if (toggle) toggle.disabled = isGameStarted && !isEnding;
    if (!bar || !fill || !percent) return;
    const visible = autoModeEnabled && isGameStarted && !isEnding;
    bar.classList.toggle('hidden', !visible);
    const value = Math.max(0, Math.min(AUTO_MODE_TRIGGER_CHARGE, autoModeCharge));
    fill.style.width = `${value}%`;
    percent.innerText = `${Math.floor(value)}%`;
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
    return [
        'speed', 'twoGoals', 'reverse', 'shrink', 'multiBall', 'goldenTouch',
        'freezeFrame', 'bumper', 'tinyBall', 'heavyBall', 'goalSwap', 'stopCircle',
        'stealPoint'
    ].filter(mode => mode !== autoModeLastMode);
}

function triggerAutoMode(now = performance.now()) {
    if (!autoModeEnabled || activeTempMode || !isGameStarted || isEnding || isPaused || isGoalCinematic) return;
    if (now - autoModeLastTriggerAt < AUTO_MODE_COOLDOWN_MS) return;
    const pool = getAutoModePool();
    const mode = pool[Math.floor(Math.random() * pool.length)];
    autoModeCharge = 0;
    autoModeLastMode = mode;
    autoModeLastTriggerAt = now;
    updateAutoModeBar();
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
    ball.lastRescueBoostAt = now;
    return boostSpeed;
}

function setModeButtonsState() {
    const buttons = document.querySelectorAll('.mode-btn');
    buttons.forEach(btn => {
        if (!btn) return;
        btn.disabled = !!activeTempMode;
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
    overlay.className = `temp-mode-overlay ${activeTempMode === 'speed' ? 'speed-overlay' : (activeTempMode === 'twoGoals' ? 'two-goals-overlay' : '')}`;
    overlay.innerText = text;
    viewport.appendChild(overlay);
    setTimeout(() => overlay.remove(), 1800);
}

function showManualTextBurst(id) {
    const config = MANUAL_TEXT_BURSTS[id];
    const viewport = document.getElementById('mainViewport');
    if (!config || !viewport) return;
    const overlay = document.createElement('div');
    overlay.className = `manual-text-overlay manual-text-${config.style}`;
    overlay.innerText = i18n[currentLang][config.key] || config.key;
    viewport.appendChild(overlay);
    setTimeout(() => overlay.remove(), 1700);
}

function getTempModeLabelText(mode = activeTempMode) {
    if (mode === 'speed') return i18n[currentLang].speedModeOverlay;
    if (mode === 'twoGoals') return i18n[currentLang].twoGoalModeOverlay;
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
    if (mode === 'clutch') return i18n[currentLang].clutchModeOverlay;
    return '';
}

function playTempModeSound(mode) {
    if (isMuted) return;
    const modeSounds = {
        twoGoals: 'doubleGoal',
        reverse: 'reverse',
        shrink: 'tight',
        multiBall: 'double',
        goldenTouch: 'golden',
        freezeFrame: 'freeze',
        bumper: 'engel'
    };
    const sound = sounds[modeSounds[mode]] || sounds.riser;
    if (!sound) return;
    const layerCount = mode === 'multiBall' ? 3 : 2;
    for (let i = 0; i < layerCount; i++) {
        const layer = i === 0 ? sound : sound.cloneNode();
        layer.currentTime = 0;
        layer.volume = 1.0;
        layer.play().catch(e => console.log('Mode sound blocked:', e));
    }
}

function setTempModeVisuals(mode) {
    const viewport = document.getElementById('mainViewport');
    const label = document.getElementById('tempModeLabel');
    if (viewport) {
        viewport.classList.remove('mode-fading');
        if (mode) {
            viewport.classList.remove('mode-active', ...getModeClassList());
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

function endTempMode() {
    if (tempModeTimeout) {
        clearTimeout(tempModeTimeout);
        tempModeTimeout = null;
    }
    if (tempModeIntroTimeout) {
        clearTimeout(tempModeIntroTimeout);
        tempModeIntroTimeout = null;
    }
    restoreModeBallScale();
    clearExtraModeBalls();
    clearModeBumpers();
    tempModeState = {};
    activeTempMode = null;
    tempModeTriggeredByAuto = false;
    if (engine) engine.timing.timeScale = BASE_ENGINE_TIME_SCALE;
    if (extraGoalSensor) Body.setPosition(extraGoalSensor, { x: -1000, y: -1000 });
    if (isGameStarted && !isEnding && !isPaused) startMatchTimer();
    const viewport = document.getElementById('mainViewport');
    if (viewport) {
        viewport.classList.add('mode-fading');
        setTimeout(() => viewport.classList.remove('mode-fading', 'mode-active', ...getModeClassList()), 900);
    }
    const label = document.getElementById('tempModeLabel');
    if (label) {
        label.innerText = '';
        label.classList.remove('active');
    }
    setModeButtonsState();
}

function activateTempMode(mode, triggeredByAuto = false) {
    if (!isGameStarted || isEnding || isPaused || activeTempMode) return;
    if (!triggeredByAuto && autoModeEnabled) autoModeLastTriggerAt = performance.now();
    activeTempMode = mode;
    tempModeTriggeredByAuto = triggeredByAuto;
    tempModeState = { startedAt: performance.now() };
    const introSlowMs = mode === 'freezeFrame' ? FREEZE_FRAME_SLOW_MS : TEMP_MODE_INTRO_SLOW_MS;
    if (engine) engine.timing.timeScale = mode === 'freezeFrame' ? BASE_ENGINE_TIME_SCALE * 0.03 : BASE_ENGINE_TIME_SCALE * 0.35;
    if (mode === 'freezeFrame') stopMatchTimer();
    if (mode === 'twoGoals' || mode === 'clutch') startMatchTimer();
    if (mode === 'multiBall') spawnExtraModeBalls();
    if (mode === 'bumper') spawnModeBumpers();
    if (mode === 'tinyBall' || mode === 'heavyBall') applyModeBallScale(getModeBallScale());
    if (mode === 'stopCircle') currentRotation = Math.random() * Math.PI * 2;
    setModeButtonsState();
    setTempModeVisuals(mode);
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
    playTempModeSound(mode);
    tempModeIntroTimeout = setTimeout(() => {
        tempModeIntroTimeout = null;
        if (!activeTempMode || !engine) return;
        if (activeTempMode === 'speed') engine.timing.timeScale = BASE_ENGINE_TIME_SCALE * 2;
        else if (activeTempMode === 'freezeFrame') engine.timing.timeScale = BASE_ENGINE_TIME_SCALE * 2.2;
        else engine.timing.timeScale = BASE_ENGINE_TIME_SCALE;
    }, introSlowMs);
    tempModeTimeout = setTimeout(endTempMode, TEMP_MODE_MS);
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
    config.videoEditVsDuration = getVideoEditVsDurationMs() / 1000;
    const arenaSelect = document.getElementById('arenaSelect');
    if (arenaSelect && arenaSelect.value) setArenaBackground(arenaSelect.value);
    timeLeft = config.matchDuration;
    const titleText = document.getElementById('mainTitle').value || 'KİM KAZANACAK?';
    document.getElementById('displayTitle').innerText = titleText;
    const idleTitleEl = document.getElementById('idleTitle'); if (idleTitleEl) idleTitleEl.innerText = titleText;
    document.getElementById('scoreName1').innerText = config.team1.name.substring(0, 3).toUpperCase();
    document.getElementById('scoreName2').innerText = config.team2.name.substring(0, 3).toUpperCase();
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
    engine.timing.timeScale = activeTempMode === 'speed' ? BASE_ENGINE_TIME_SCALE * 2 : (activeTempMode === 'freezeFrame' ? BASE_ENGINE_TIME_SCALE * 2.2 : BASE_ENGINE_TIME_SCALE);
    const container = document.getElementById('canvas-container'); container.innerHTML = '';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    render = Render.create({ element: container, engine: engine, options: { width: 500, height: 500, pixelRatio: dpr, wireframes: false, background: 'transparent' } });
    segments = [];
    modeBumpers = [];
    ambientParticles = [];
    for (let i = 0; i < 60; i++) {
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
        if (activeTempMode === 'speed') currentDynamicSpeed *= 2;
        if (activeTempMode === 'reverse') currentDynamicSpeed *= -1.25;
        if (activeTempMode === 'stopCircle') currentDynamicSpeed = 0;
        currentRotation += currentDynamicSpeed;
        const activeCircleRadius = getActiveCircleRadius();
        const activeGapSize = getActiveGapSize();
        const activeGoalStart = getActiveGoalStartIndex();
        const now = performance.now();
        
        segments.forEach((seg, i) => {
            const isGap = isIndexInCircularGap(i, activeGoalStart, activeGapSize, config.segmentCount);
            const isOppositeGap = activeTempMode === 'twoGoals' && isIndexInCircularGap(i, Math.floor(config.segmentCount / 2), activeGapSize, config.segmentCount);
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
        if (activeTempMode === 'twoGoals') {
            Body.setPosition(extraGoalSensor, { x: config.centerX + Math.cos(oppositeAngle) * (activeCircleRadius + 45), y: config.centerY + Math.sin(oppositeAngle) * (activeCircleRadius + 45) });
            Body.setAngle(extraGoalSensor, oppositeAngle + Math.PI / 2);
        } else if (extraGoalSensor) {
            Body.setPosition(extraGoalSensor, { x: -1000, y: -1000 });
        }

        if (!isRunning && !isEnding) {
            // Keep balls at reset position during idle to prevent scoring (only if not ending)
            balls.forEach(ball => {
                const ox = ball.team === 1 ? -30 : 30;
                Body.setPosition(ball, { x: config.centerX + ox, y: config.centerY });
                Body.setVelocity(ball, { x: 0, y: 0 });
            });
            return;
        }

        balls.forEach(ball => {
            const team = ball.team === 1 ? config.team1 : config.team2;
            let speed = Vector.magnitude(ball.velocity);
            const modeMaxMultiplier = activeTempMode === 'tinyBall' ? 2.05 : (activeTempMode === 'heavyBall' ? 1.32 : 1.6);
            const maxSpeed = config.ballLaunchSpeed * modeMaxMultiplier;
            if (speed > maxSpeed) { const newVel = Vector.mult(Vector.normalise(ball.velocity), maxSpeed); Body.setVelocity(ball, newVel); }
            if (activeTempMode === 'speed' && isRunning && speed < SPEED_MODE_MIN_BALL_SPEED) {
                speed = applyLowSpeedBoost(ball, SPEED_MODE_MIN_BALL_SPEED, SPEED_MODE_MIN_BALL_SPEED, SPEED_MODE_MIN_BALL_SPEED + 2.5, 260);
            } else if (activeTempMode && isRunning && speed < 1.6) {
                const modeBoostMin = Math.max(3.0, config.ballLaunchSpeed * 0.28);
                const modeBoostMax = Math.max(modeBoostMin + 1, config.ballLaunchSpeed * 0.42);
                speed = applyLowSpeedBoost(ball, 1.6, modeBoostMin, modeBoostMax, 520);
            } else if (!activeTempMode && !isSlowMotion && isRunning && speed < NORMAL_MODE_MIN_BALL_SPEED) {
                const normalBoostMin = Math.max(2.4, config.ballLaunchSpeed * 0.22);
                const normalBoostMax = Math.max(normalBoostMin + 0.8, config.ballLaunchSpeed * 0.36);
                speed = applyLowSpeedBoost(ball, NORMAL_MODE_MIN_BALL_SPEED, normalBoostMin, normalBoostMax, NORMAL_MODE_RESCUE_COOLDOWN_MS);
            }

            if (speed > 0.5) {
                const speedRatio = Math.min(speed / (config.ballLaunchSpeed * 1.6), 1);
                const trailCount = speed > 11 ? 3 : (speed > 5 ? 2 : 1);
                if (trails.length < 120) {
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
                if (speed > 12 && sparks.length < 80) {
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
            if (activeTempMode === 'twoGoals') {
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
        const circleBlurAmount = isModeArcade ? 34 + arcadePulse * 28 : 25 + circlePulse * 15;
        const circleAlpha = isModeArcade ? 0.7 + arcadePulse * 0.28 : 0.6 + circlePulse * 0.3;
        ctx.lineCap = 'round';
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowBlur = circleBlurAmount;
        ctx.shadowColor = modePalette[0];
        ctx.strokeStyle = isModeArcade ? modePalette[0] : `rgba(99, 102, 241, ${circleAlpha})`;
        ctx.globalAlpha = circleAlpha;
        ctx.lineWidth = isModeArcade ? 28 : 26;
        drawArenaArc();

        if (isModeArcade) {
            ctx.shadowBlur = 24 + arcadePulse * 20;
            ctx.shadowColor = modePalette[1];
            ctx.strokeStyle = modePalette[1];
            ctx.globalAlpha = 0.5 + arcadePulse * 0.35;
            ctx.lineWidth = 12;
            drawArenaArc();

            ctx.shadowBlur = 14;
            ctx.shadowColor = modePalette[2];
            ctx.strokeStyle = modePalette[2];
            ctx.globalAlpha = 0.72 + arcadePulse * 0.24;
            ctx.lineWidth = 4;
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
        ctx.save(); ctx.translate(goalSensor.position.x, goalSensor.position.y); ctx.rotate(goalSensor.angle);
        const pulse = Math.sin(Date.now() / 400);
        const blurAmount = 12 + pulse * 8;
        const alpha = 0.7 + pulse * 0.3;
        ctx.shadowBlur = blurAmount; ctx.shadowColor = '#00f2ff'; ctx.strokeStyle = `rgba(0, 242, 255, ${alpha})`; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(-55, 20); ctx.lineTo(-55, -20); ctx.lineTo(55, -20); ctx.lineTo(55, 20); ctx.stroke();
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 + pulse * 0.2})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(-55, 20); ctx.lineTo(-55, -20); ctx.lineTo(55, -20); ctx.lineTo(55, 20); ctx.stroke(); ctx.restore();
        if (activeTempMode === 'twoGoals' && extraGoalSensor) {
            ctx.save(); ctx.translate(extraGoalSensor.position.x, extraGoalSensor.position.y); ctx.rotate(extraGoalSensor.angle);
            ctx.shadowBlur = blurAmount + 8; ctx.shadowColor = '#fbbf24'; ctx.strokeStyle = `rgba(251, 191, 36, ${alpha})`; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath(); ctx.moveTo(-55, 20); ctx.lineTo(-55, -20); ctx.lineTo(55, -20); ctx.lineTo(55, 20); ctx.stroke();
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 + pulse * 0.2})`; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(-55, 20); ctx.lineTo(-55, -20); ctx.lineTo(55, -20); ctx.lineTo(55, 20); ctx.stroke(); ctx.restore();
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
            const team = ball.team === 1 ? config.team1 : config.team2;
            const speed = Vector.magnitude(ball.velocity);
            const speedRatio = Math.min(speed / (config.ballLaunchSpeed * 1.6), 1);
            const isHot = lastScoringTeam === ball.team && !isEnding;
            const pulse = Math.sin(Date.now() / 170 + ball.team) * 0.5 + 0.5;
            const r = ball.modeBallSize || config.ballSize;

            ctx.save();
            ctx.translate(ball.position.x, ball.position.y);

            if (isHot) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.22 + pulse * 0.16;
                const hotGlow = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.2, 0, 0, r * 2.7);
                hotGlow.addColorStop(0, 'rgba(255,255,255,0.9)');
                hotGlow.addColorStop(0.18, team.color);
                hotGlow.addColorStop(0.5, team.useColor3 ? team.color3 : team.color2);
                hotGlow.addColorStop(1, 'transparent');
                ctx.fillStyle = hotGlow;
                ctx.beginPath();
                ctx.arc(0, 0, r * 2.7, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 0.18 + pulse * 0.1;
                ctx.shadowBlur = 18 + pulse * 20;
                ctx.shadowColor = team.color;
                ctx.strokeStyle = team.color;
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
            ctx.shadowColor = team.color;
            ctx.strokeStyle = team.color;
            ctx.lineWidth = isHot ? 2.6 : 1.1;
            ctx.beginPath();
            ctx.arc(0, 0, r + 5 + (isHot ? pulse * 3 : 0), 0, Math.PI * 2);
            ctx.stroke();
            if (isHot) {
                ctx.globalAlpha = 0.18 + pulse * 0.1;
                ctx.strokeStyle = team.useColor3 ? team.color3 : team.color2;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.arc(0, 0, r + 10 + pulse * 4, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();

            ctx.rotate(ball.angle);
            ctx.shadowBlur = 14 + speedRatio * 18 + (isHot ? 14 : 0);
            ctx.shadowColor = team.color;

            const bodyGradient = ctx.createRadialGradient(-r * 0.45, -r * 0.55, r * 0.08, 0, 0, r * 1.12);
            bodyGradient.addColorStop(0, 'rgba(255,255,255,0.62)');
            bodyGradient.addColorStop(0.18, team.color);
            bodyGradient.addColorStop(0.62, team.useColor3 ? team.color3 : team.color2);
            bodyGradient.addColorStop(1, team.color);
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
            ctx.fillStyle = team.color;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(0, 0, r - 1.5, Math.PI * (team.useColor3 ? -0.22 : 0.1), Math.PI * (team.useColor3 ? 0.46 : 1.1));
            ctx.lineTo(0, 0);
            ctx.closePath();
            ctx.fillStyle = team.color2;
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
            ctx.shadowColor = team.color;
            ctx.beginPath();
            ctx.arc(0, 0, r + 0.5, 0, Math.PI * 2);
            ctx.strokeStyle = team.color;
            ctx.lineWidth = 3.1;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, r - 3, 0, Math.PI * 2);
            ctx.strokeStyle = team.useColor3 ? team.color3 : team.color2;
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

            if (team.logo && team.logo.complete) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(0, 0, badgeR * 0.78, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(team.logo, -badgeR * 0.78, -badgeR * 0.78, badgeR * 1.56, badgeR * 1.56);
                ctx.restore();
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.font = `900 ${Math.max(9, r * 0.45)}px Outfit, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(ball.team === 1 ? '1' : '2', 0, 1);
            }

            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(-badgeR * 0.28, -badgeR * 0.34, badgeR * 0.28, badgeR * 0.12, -0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.restore(); 
        });
        if (shakeTime > 0) render.context.restore();
    });

    Matter.Resolver._restitutionMinSpeed = 0.01;
    Events.on(engine, 'collisionStart', (event) => {
        if (!isRunning || !isGameStarted) return;
        event.pairs.forEach(pair => {
            const labels = [pair.bodyA.label, pair.bodyB.label];
            if (labels.includes('goal')) {
                const ball = pair.bodyA.label === 'goal' ? pair.bodyB : pair.bodyA;
                if (ball.team) {
                    score(ball.team, ball);
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
                    if (speed > 2 && sounds.bounce && !isMuted) {
                        const bSound = sounds.bounce.cloneNode();
                        bSound.volume = Math.min(1, speed / 30) * 0.4;
                        bSound.play().catch(e=>console.log(e));
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
                        // Glow Burst on impact - Increased size
                        bursts.push({ x: ball.position.x, y: ball.position.y, size: 45, life: 1.0, color: ball.team === 1 ? config.team1.color : config.team2.color });
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

    if (sounds.goal && !isMuted) {
        const goalSound = sounds.goal.cloneNode();
        goalSound.volume = 0.45;
        goalSound.play().catch(e => console.log('Audio blocked:', e));
    }
    if (sounds.net && !isMuted) {
        const netSound = sounds.net.cloneNode();
        netSound.volume = 0.85;
        netSound.play().catch(e => console.log('Net audio blocked:', e));
    }

    const opponentNum = teamNum === 1 ? 2 : 1;
    const opponent = opponentNum === 1 ? config.team1 : config.team2;
    const isStealScore = activeTempMode === 'stealPoint' && opponent.score > 0;
    const scoreIncrement = activeTempMode === 'goldenTouch' ? 2 : 1;
    if (isStealScore) {
        opponent.score = Math.max(0, opponent.score - 1);
    }
    team.score += scoreIncrement;
    lastScoringTeam = teamNum;

    const scoreEl = document.getElementById(`score${teamNum}`);
    if (scoreEl) {
        scoreEl.innerText = team.score;
        scoreEl.classList.add('slot-animate');
        setTimeout(() => scoreEl.classList.remove('slot-animate'), 260);
    }
    const opponentScoreEl = document.getElementById(`score${opponentNum}`);
    if (isStealScore && opponentScoreEl) {
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
    overlay.innerText = isStealScore ? i18n[currentLang].stealPointModeOverlay : (scoreIncrement > 1 ? '+2!' : i18n[currentLang].goal);
    overlay.style.color = team.color;
    document.querySelector('#mainViewport').appendChild(overlay);
    setTimeout(() => overlay.remove(), 760);

    if (scoringBall) resetBall(scoringBall);
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
    if (sounds.goal && !isMuted) { sounds.goal.currentTime = 0; sounds.goal.play().catch(e => console.log('Audio blocked:', e)); }
    if (sounds.net && !isMuted) { 
        sounds.net.currentTime = 0; sounds.net.volume = 1.0; sounds.net.play().catch(e => console.log('Net audio blocked:', e)); 
        const netBoost = sounds.net.cloneNode(); netBoost.volume = 1.0; netBoost.play().catch(e=>{});
        const netBoost2 = sounds.net.cloneNode(); netBoost2.volume = 1.0; netBoost2.play().catch(e=>{});
    }
    if (sounds.kalesesi && !isMuted) {
        sounds.kalesesi.currentTime = 0; sounds.kalesesi.play().catch(e => console.log('Kalesesi blocked:', e));
    }
    balls.forEach(ball => { Body.setVelocity(ball, { x: 0, y: 0 }); Body.setAngularVelocity(ball, 0); });
    const team = teamNum === 1 ? config.team1 : config.team2; team.score++;
    lastScoringTeam = teamNum;
    
    const scoreEl = document.getElementById(`score${teamNum}`);
    let spinCount = 0;
    const finalScore = team.score;
    const spinInterval = setInterval(() => {
        scoreEl.innerText = Math.floor(Math.random() * 10);
        spinCount++;
        if (spinCount > 8) {
            clearInterval(spinInterval);
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
    
    const scoreboard = document.querySelector('.scoreboard');
    if (scoreboard) {
        scoreboard.classList.add('goal-reaction');
        setTimeout(() => scoreboard.classList.remove('goal-reaction'), 1000);
    }

    setTimeout(() => {
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
    }, 2000);
}

function formatTime(seconds) { const m = Math.floor(seconds / 60); const s = seconds % 60; return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; }

function clearOvertimeTimerVisuals(resetInlineStyles = false) {
    if (overtimeTimerFxTimeout) {
        clearTimeout(overtimeTimerFxTimeout);
        overtimeTimerFxTimeout = null;
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

    if (isMatchTimerFrozen()) {
        document.getElementById('timerDisplay').innerText = formatTime(timeLeft);
        return;
    }

    if ((activeTempMode === 'speed' || tempModeTriggeredByAuto) && timeLeft <= 1) {
        document.getElementById('timerDisplay').innerText = formatTime(timeLeft);
        return;
    }
    
    if (timeLeft <= 5 && timeLeft > 0) {
        if (sounds.beep) { sounds.beep.currentTime = 0; sounds.beep.play().catch(e => console.log('Beep blocked')); }
    } else {
        if (sounds.tick) { sounds.tick.currentTime = 0; sounds.tick.play().catch(e => console.log('Tick blocked')); }
    }
    
    timeLeft--; 
    document.getElementById('timerDisplay').innerText = formatTime(timeLeft);
    
    bumbumCounter++;
    if (bumbumCounter >= 10) {
        bumbumCounter = 0;
        if (timeLeft > 5 && sounds.bumbum && !isMuted) {
            sounds.bumbum.currentTime = 0;
            sounds.bumbum.play().catch(e=>console.log(e));
        }
    }
    
    if (timeLeft <= 10 && timeLeft > 0) { 
        document.getElementById('timerDisplay').style.color = '#ef4444'; 
        document.getElementById('timerDisplay').style.textShadow = '0 0 15px #ef4444'; 
        render.canvas.classList.add('dramatic-mode');
    }
    if (timeLeft <= 0) {
        document.getElementById('timerDisplay').style.color = '#ef4444'; 
        document.getElementById('timerDisplay').style.textShadow = '0 0 15px #ef4444'; 
        render.canvas.classList.add('dramatic-mode');
        
        if (sounds.gerilim && !isMuted) {
            if (sounds.ambient) sounds.ambient.volume = 0.2;
            sounds.gerilim.currentTime = 0;
            sounds.gerilim.play().catch(e => console.log('Gerilim sound error:', e));
        }
        
        if (!isSlowMotion && !isEnding) {
            isEnding = true;
            isSlowMotion = true;
            engine.timing.timeScale = 0.15;
            stopMatchTimer();
            setTimeout(() => {
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
    if (activeTempMode) endTempMode();
    if (config.team1.score === config.team2.score) { startOvertime(); return; }

    isEnding = true; isRunning = false; isGameStarted = false;
    updateAutoModeBar();
    updateScoreboardTieState();
    stopMatchTimer();

    if (sounds.goal) { sounds.goal.currentTime = 0; sounds.goal.play().catch(e => console.log('Audio blocked:', e)); }
    if (sounds.whistle && !isMuted) { 
        for(let i=0; i<3; i++) {
            const w = sounds.whistle.cloneNode();
            w.volume = 1.0;
            w.play().catch(e=>console.log(e));
        }
    }

    const viewport = document.getElementById('mainViewport');
    if (viewport) {
        viewport.classList.add('glitch-active');
        setTimeout(() => { viewport.classList.remove('glitch-active'); viewport.classList.add('match-focus', 'darken-bg', 'match-end-state'); }, 300);
    }

    document.querySelectorAll('.match-end-overlay, .goal-overlay, .overtime-overlay, .epic-shockwave').forEach(el => el.remove());
    
    // Epic Shockwave
    const shockwave = document.createElement('div');
    shockwave.className = 'epic-shockwave';
    document.querySelector('#mainViewport').appendChild(shockwave);
    
    const overlay = document.createElement('div'); overlay.className = 'match-end-overlay';
    const winner = config.team1.score > config.team2.score ? config.team1 : config.team2;
    overlay.style.setProperty('--winner-glow', winner.color);
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
        
    overlay.innerHTML = `<div class="title">${i18n[currentLang].winner}</div><div class="winner-name">${winner.name}</div>${flapScoreboard}`;
    document.querySelector('#mainViewport').appendChild(overlay);

    // Golden Tornado Confetti
    for (let i = 0; i < 200; i++) {
        const isLeft = Math.random() > 0.5;
        confetti.push({
            x: isLeft ? 0 : 500, 
            y: 800, // Bottom corners
            vx: isLeft ? (Math.random() * 15 + 5) : -(Math.random() * 15 + 5), // Shoot towards center
            vy: -(Math.random() * 25 + 15), // Shoot UP
            size: Math.random() * 10 + 5, 
            color: Math.random() > 0.5 ? winner.color : '#fbbf24', // Team color or Gold
            life: 3.5, 
            rotation: Math.random() * Math.PI, 
            rSpeed: (Math.random() - 0.5) * 0.4
        });
    }

    setTimeout(() => {
        overlay.remove();
        const spotlight = document.getElementById('winnerSpotlight');
        if (spotlight) {
            const spotlightLogo = document.getElementById('spotlightLogo');
            const spotlightName = document.getElementById('spotlightName');
            if (winner.logo) spotlightLogo.style.backgroundImage = `url(${winner.logo.src})`;
            spotlightName.innerText = winner.name;
            spotlight.classList.add('active');
            startSubscribeAnimation(true); // Trigger winner mode subscribe video
            const btn = document.createElement('div'); 
            btn.className = 'replay-ball-btn';
            btn.onclick = () => document.getElementById('fullResetSim').onclick();
            spotlight.appendChild(btn);
        } else {
            setSettingsPanelOpen(true);
        }
    }, 2500); // Set to 2.5 seconds for a better cinematic feel
}

function startOvertime() {
    isEnding = false;
    isRunning = false; isGameStarted = false; stopMatchTimer();
    updateAutoModeBar();
    bumbumCounter = 0;
    overtimeCount++; timeLeft = 5;
    clearOvertimeTimerVisuals();
    const timerDisplay = document.getElementById('timerDisplay');
    const timerBox = timerDisplay ? timerDisplay.closest('.timer-container') : null;
    if (timerDisplay) {
        timerDisplay.innerText = formatTime(timeLeft);
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
    if (sounds.bumbum && !isMuted) { sounds.bumbum.currentTime = 0; sounds.bumbum.play().catch(e=>console.log(e)); }
    setTimeout(() => { overlay.remove(); isRunning = true; isGameStarted = true; startMatchTimer(); balls.forEach(ball => resetBall(ball)); }, 2500);
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
    document.getElementById('timerDisplay').innerText = formatTime(config.matchDuration);
    
    const idle1 = document.getElementById('idleTeam1Name'); 
    const idle2 = document.getElementById('idleTeam2Name');
    if (idle1) { idle1.innerText = config.team1.name; idle1.style.color = config.team1.color; }
    if (idle2) { idle2.innerText = config.team2.name; idle2.style.color = config.team2.color; }
    
    // Update logos
    if (config.team1.logo) {
        const i1 = document.getElementById('introLogo1'); if(i1) i1.style.backgroundImage = `url(${config.team1.logo.src})`;
        const id1 = document.getElementById('idleLogo1'); if(id1) id1.style.backgroundImage = `url(${config.team1.logo.src})`;
    }
    if (config.team2.logo) {
        const i2 = document.getElementById('introLogo2'); if(i2) i2.style.backgroundImage = `url(${config.team2.logo.src})`;
        const id2 = document.getElementById('idleLogo2'); if(id2) id2.style.backgroundImage = `url(${config.team2.logo.src})`;
    }
    updatePreVsHook();
}

function processLogoUpload(file, teamObj, introElementId, idleElementId) {
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = Math.min(img.width, img.height);
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.beginPath();
            ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, (img.width - size)/2, (img.height - size)/2, size, size, 0, 0, size, size);
            
            const circularDataUrl = canvas.toDataURL('image/png');
            const newImg = new Image();
            newImg.onload = () => {
                teamObj.logo = newImg;
                const el = document.getElementById(introElementId);
                if (el) el.style.backgroundImage = `url(${circularDataUrl})`;
                const idleEl = document.getElementById(idleElementId);
                if (idleEl) idleEl.style.backgroundImage = `url(${circularDataUrl})`;
            };
            newImg.src = circularDataUrl;
        };
        img.src = event.target.result;
    };
    if (file) reader.readAsDataURL(file);
}

document.getElementById('team1Logo').onchange = (e) => processLogoUpload(e.target.files[0], config.team1, 'introLogo1', 'idleLogo1');
document.getElementById('team2Logo').onchange = (e) => processLogoUpload(e.target.files[0], config.team2, 'introLogo2', 'idleLogo2');
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
    if (hookEyebrow) hookEyebrow.innerText = currentLang === 'en' ? 'PICK ONE' : 'SENCE';
    if (hookQuestion) hookQuestion.innerText = currentLang === 'en' ? 'WHO WINS?' : 'KİM KAZANIR?';
    const choice1 = hook.querySelector('.hook-choice-1');
    const choice2 = hook.querySelector('.hook-choice-2');
    if (choice1) choice1.style.setProperty('--hook-color', config.team1.color);
    if (choice2) choice2.style.setProperty('--hook-color', config.team2.color);
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
    if (preMatchCountdownInterval) {
        clearInterval(preMatchCountdownInterval);
        preMatchCountdownInterval = null;
    }
    const viewport = document.getElementById('mainViewport');
    if (viewport) viewport.classList.remove('video-edit-hold', 'video-edit-ready');
}

const PRE_MATCH_BANNER_MS = 500;
const PRE_VS_HOOK_MS = 1000;
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

function playPreVsHook(delay = 0) {
    const hook = document.getElementById('preVsHook');
    if (!hook) return delay;
    const editPauseMs = videoEditMode ? VIDEO_EDIT_PAUSE_MS : 0;
    updatePreVsHook();
    schedulePreMatch(() => {
        hook.classList.remove('active');
        void hook.offsetWidth;
        hook.classList.add('active');
    }, delay);
    schedulePreMatch(() => hook.classList.remove('active'), delay + PRE_VS_HOOK_MS);
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

document.getElementById('applySettings').onclick = () => {
    clearPreMatchTimeline();
    document.querySelector('.simulation-header').classList.add('hidden');
    const idleOverlay = document.getElementById('idleOverlay'); if (idleOverlay) idleOverlay.classList.add('hidden');
    clearAllViewportEffectTimeouts();
    const viewport = document.getElementById('mainViewport'); if (viewport) viewport.classList.remove('match-focus', 'darken-bg', 'glitch-active', 'goal-flash', 'zoom-burst', 'match-end-state', 'ui-swapped', 'video-edit-hold', 'video-edit-ready');
    if (uiSwapTimeout) { clearTimeout(uiSwapTimeout); uiSwapTimeout = null; }
    const banner = document.getElementById('preMatchBanner'); if (banner) banner.classList.remove('active');
    const hook = document.getElementById('preVsHook'); if (hook) hook.classList.remove('active');
    const spotlight = document.getElementById('winnerSpotlight'); if (spotlight) { spotlight.classList.remove('active'); const btn = spotlight.querySelector('.replay-ball-btn'); if (btn) btn.remove(); }
    if (tempModeTimeout) { clearTimeout(tempModeTimeout); tempModeTimeout = null; }
    if (tempModeIntroTimeout) { clearTimeout(tempModeIntroTimeout); tempModeIntroTimeout = null; }
    clearOvertimeTimerVisuals(true);
    activeTempMode = null;
    tempModeTriggeredByAuto = false;
    setTempModeVisuals(null);
    isEnding = false; overtimeCount = 0; isPaused = false; bumbumCounter = 0; lastScoringTeam = null; isGoalCinematic = false; tempModeTriggeredByAuto = false; resetAutoModeCharge();
    config.team1.score = 0; config.team2.score = 0;
    document.getElementById('score1').innerText = '0'; document.getElementById('score2').innerText = '0';
    updateScoreboardTieState();
    setModeButtonsState();
    const pBtn = document.getElementById('pauseGame'); if(pBtn) { pBtn.innerText = i18n[currentLang].pause; pBtn.classList.remove('active'); }
    unlockAudio(); applySettingsToConfig(); saveCurrentSettings(); init();
    if (videoEditMode && viewport) viewport.classList.add('video-edit-hold');
    if (sounds.ambient) { 
        sounds.ambient.volume = 1.0; 
        schedulePreMatch(() => { sounds.ambient.play().catch(e => console.log('Ambience error:', e)); }, 100); 
    }
    render.canvas.classList.remove('dramatic-mode');
    
    const preMatchBannerDelay = playPreMatchBanner();
    const preVsDelay = playPreVsHook(preMatchBannerDelay);
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
    
    // Wait 1 second of silence/pause before starting the countdown
    schedulePreMatch(() => {
        const countdownEl = document.getElementById('giantCountdown');
        if (countdownEl) {
            countdownEl.innerText = '3';
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

            if (videoEditMode && sounds.bumbum && !isMuted) {
                sounds.bumbum.currentTime = 0;
                sounds.bumbum.play().catch(e=>console.log(e));
            }

            // Referee Start Effect & Whistle (Boosted)
            if (sounds.whistle && !isMuted) { 
                for(let i=0; i<3; i++) {
                    const w = sounds.whistle.cloneNode();
                    w.volume = 1.0;
                    w.play().catch(e=>console.log(e));
                }
            }
            startSubscribeAnimation();
            const ripple = document.createElement('div');
            ripple.className = 'referee-start-ripple';
            document.getElementById('mainViewport').appendChild(ripple);
            schedulePreMatch(() => ripple.remove(), 1200);

            document.querySelector('.simulation-header').classList.remove('hidden'); 
            isRunning = true; 
            isGameStarted = true;
                updateAutoModeBar();
                startMatchTimer();
                uiSwapTimeout = setTimeout(() => {
                    const vp = document.getElementById('mainViewport');
                    if (vp && !isEnding) vp.classList.add('ui-swapped');
                }, UI_SWAP_DELAY_MS);
                balls.forEach(ball => resetBall(ball)); 
    }, actualMatchStartDelay);
};

document.getElementById('fullResetSim').onclick = () => { 
    if (!confirm(i18n[currentLang].confirmReset)) return;
    clearPreMatchTimeline();
    
    // Reset inputs
    document.getElementById('mainTitle').value = i18n[currentLang].defaultTitle;
    document.getElementById('matchDuration').value = 60;
    const videoEditToggle = document.getElementById('videoEditModeToggle');
    if (videoEditToggle) videoEditToggle.checked = false;
    document.getElementById('videoEditVsDuration').value = DEFAULT_VIDEO_EDIT_VS_SECONDS;
    document.getElementById('simSpeed').value = 20;
    document.getElementById('ballLaunchSpeed').value = 12;
    document.getElementById('ballBounciness').value = 20;
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
    config.ballBounciness = 0.90;
    config.ballDamping = 0.005;
    config.arenaBackground = DEFAULT_ARENA_SRC;
    config.videoEditVsDuration = DEFAULT_VIDEO_EDIT_VS_SECONDS;
    videoEditMode = false;
    
    clearAllViewportEffectTimeouts();
    const viewport = document.getElementById('mainViewport'); if (viewport) viewport.classList.remove('match-focus', 'darken-bg', 'glitch-active', 'goal-flash', 'zoom-burst', 'match-end-state', 'ui-swapped');
    if (uiSwapTimeout) { clearTimeout(uiSwapTimeout); uiSwapTimeout = null; }
    const banner = document.getElementById('preMatchBanner'); if (banner) banner.classList.remove('active');
    clearOvertimeTimerVisuals(true);
    isEnding = false; overtimeCount = 0; isPaused = false; bumbumCounter = 0; lastScoringTeam = null; isGoalCinematic = false; tempModeTriggeredByAuto = false; resetAutoModeCharge();
    const pBtn = document.getElementById('pauseGame'); if(pBtn) { pBtn.innerText = i18n[currentLang].pause; pBtn.classList.remove('active'); }
    isRunning = false; isGameStarted = false; stopMatchTimer(); endTempMode(); if (sounds.ambient) sounds.ambient.pause(); 
    config.team1.score = 0; config.team2.score = 0; document.getElementById('score1').innerText = '0'; document.getElementById('score2').innerText = '0'; updateScoreboardTieState();
    applySettingsToConfig(); init(); updateIntroUI(); setSettingsPanelOpen(true); 
};

document.getElementById('pauseGame').onclick = () => {
    if (!isGameStarted && !isPaused) return;
    isPaused = !isPaused; isRunning = !isPaused;
    const btn = document.getElementById('pauseGame');
    if (isPaused) { btn.innerText = i18n[currentLang].resume; btn.classList.add('active'); stopMatchTimer(); }
    else { btn.innerText = i18n[currentLang].pause; btn.classList.remove('active'); autoModeLastUpdate = performance.now(); if (isGameStarted && !isEnding && !isMatchTimerFrozen()) { startMatchTimer(); } }
};

document.getElementById('speedMode').onclick = () => activateTempMode('speed');
document.getElementById('twoGoalMode').onclick = () => activateTempMode('twoGoals');
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
document.getElementById('clutchMode').onclick = () => activateTempMode('clutch');
document.querySelectorAll('[data-manual-burst]').forEach(btn => {
    btn.onclick = () => showManualTextBurst(btn.dataset.manualBurst);
});

document.getElementById('muteSound').onclick = () => { isMuted = !isMuted; const btn = document.getElementById('muteSound'); Object.values(sounds).forEach(s => { if (s) s.muted = isMuted; }); if (isMuted) { btn.innerText = i18n[currentLang].muted; btn.classList.add('active'); } else { btn.innerText = i18n[currentLang].sound; btn.classList.remove('active'); } };

initArenaControls(); init(); isRunning = false; loadSavedSettings(); updateIntroUI(); setModeButtonsState(); initSettingsPanelToggle();

// --- SUBSCRIBE ANIMATION (SVG FILTER CHROMA KEY) ---
function initSubscribe() {
    subscribeVideo = document.getElementById('subscribeVideo');
    if (subscribeVideo) subscribeVideo.playbackRate = 2.0;
}

function startSubscribeAnimation(isWinnerMode = false) {
    if (!subscribeVideo) initSubscribe();
    const container = document.getElementById('subscribeContainer');
    if (container && subscribeVideo) {
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
        const hide = () => container.classList.remove('active');
        subscribeVideo.onended = hide;
        setTimeout(hide, 8000);
    }
}

// Ensure settings and subscribe are ready
window.addEventListener('load', () => {
    initSubscribe();
});
