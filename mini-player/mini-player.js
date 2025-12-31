// This script runs in the mini player window (the renderer process)

// References to DOM elements
const prevBtn = document.getElementById('prev-btn');
const playPauseBtn = document.getElementById('play-pause-btn');
const nextBtn = document.getElementById('next-btn');
const likeBtn = document.getElementById('like-btn');
const dislikeBtn = document.getElementById('dislike-btn');
const maximizeBtn = document.getElementById('maximize-btn');

const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');

const titleEl = document.getElementById('title');
const artistEl = document.getElementById('artist');
const thumbnailEl = document.getElementById('thumbnail');
const timeInfoEl = document.getElementById('time-info');
const bufferingEl = document.getElementById('buffering-spinner');
const progressBar = document.getElementById('progress-bar');
let isUserSeeking = false;

// Fetch and apply translations for tooltips
async function applyTranslations() {
    try {
        const translations = await window.electronAPI.getTranslations([
            'previous', 'play_pause', 'next', 'like', 'dislike', 'expand'
        ]);

        prevBtn.title = translations['previous'];
        playPauseBtn.title = translations['play_pause'];
        nextBtn.title = translations['next'];
        likeBtn.title = translations['like'];
        dislikeBtn.title = translations['dislike'];
        maximizeBtn.title = translations['expand'];
    } catch (error) {
        console.error('Error applying translations:', error);
    }
}

async function initTheme() {
    const currentTheme = await window.electronAPI.getTheme();
    const allowedThemes = new Set(['midnight', 'blur']);

    const resolvedTheme = allowedThemes.has(currentTheme) ? currentTheme : 'midnight';
    if (resolvedTheme !== currentTheme) {
        window.electronAPI.setTheme(resolvedTheme);
    }

    document.body.className = resolvedTheme;
}

// Variable to simulate play/pause state
let isPlaying = false;

// Send an action to the main process (main.js)
function sendAction(action) {
    window.electronAPI.sendControl(action);
}

// Event listeners
prevBtn.addEventListener('click', () => sendAction('previous'));
playPauseBtn.addEventListener('click', () => sendAction('play-pause'));
nextBtn.addEventListener('click', () => sendAction('next'));
likeBtn.addEventListener('click', () => sendAction('like'));
dislikeBtn.addEventListener('click', () => sendAction('dislike'));
maximizeBtn.addEventListener('click', () => sendAction('maximize'));

// Helper to update progress bar background
const updateBarBackground = (value, max) => {
    if (!max || isNaN(max)) return;
    const percent = (value / max) * 100;
    const baseColor = 'rgba(255,255,255,0.2)';
    progressBar.style.background = `linear-gradient(to right, var(--accent-color) ${percent}%, ${baseColor} ${percent}%)`;
};

// Progress bar seeking handlers
progressBar.addEventListener('mousedown', () => { isUserSeeking = true; });
progressBar.addEventListener('mouseup', () => {
    // Delay resuming updates to allow YouTube to catch up
    setTimeout(() => { isUserSeeking = false; }, 1000);
});

progressBar.addEventListener('input', (e) => {
    updateBarBackground(e.target.value, e.target.max);
});

progressBar.addEventListener('change', (e) => {
    try {
        window.electronAPI.sendControl({ action: 'seek', value: e.target.value });
    } catch (err) {
        console.error('Error sending seek control:', err);
    }
});

// Double click to restore main window
document.body.addEventListener('dblclick', (e) => {
    if (e.target.tagName !== 'BUTTON' && !e.target.closest('button') && e.target !== progressBar) {
        sendAction('maximize');
    }
});

// Listen for theme changes from properties
window.electronAPI.onThemeChanged((theme) => {
    document.body.className = theme;
});

applyTranslations();
initTheme();

// Listen for state updates from the main process
window.electronAPI.onStateUpdate((state) => {
    isPlaying = state.isPlaying;

    // Update play/pause icon
    playIcon.classList.toggle('hidden', isPlaying);
    pauseIcon.classList.toggle('hidden', !isPlaying);

    // Update like/dislike buttons
    likeBtn.classList.toggle('disabled', !state.isLiked);
    dislikeBtn.classList.toggle('disabled', !state.isDisliked);

    // Update song info
    const safeTitle = state.title || 'No song playing';
    titleEl.textContent = safeTitle;
    artistEl.textContent = state.artist || '';
    timeInfoEl.textContent = state.timeInfo || '--:-- / --:--';

    if (thumbnailEl) {
        const src = state.thumbnail || '';
        thumbnailEl.classList.toggle('hidden', !src);
        if (src) {
            if (thumbnailEl.src !== src) thumbnailEl.src = src;
            thumbnailEl.alt = safeTitle;
        } else {
            thumbnailEl.removeAttribute('src');
            thumbnailEl.alt = '';
        }

        if (src) {
            const bSrc = encodeURI(src);
            document.body.style.setProperty('--bg-image', `url("${bSrc}")`);
        } else {
            document.body.style.setProperty('--bg-image', 'none');
        }
    }

    // Update progress bar
    if (!isUserSeeking && progressBar) {
        progressBar.max = state.progressMax || 100;
        progressBar.value = state.progress || 0;
        updateBarBackground(progressBar.value, progressBar.max);
    }

    // Update buffering state
    bufferingEl.classList.toggle('hidden', !state.isBuffering);
});
