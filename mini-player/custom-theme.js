const bgColorInput = document.getElementById('bg-color');
const textColorInput = document.getElementById('text-color');
const emphasisColorInput = document.getElementById('emphasis-color');
const blurOpacityInput = document.getElementById('blur-opacity');
const bgOpacityInput = document.getElementById('bg-opacity');
const blurInput = document.getElementById('blur-strength');

const bgColorHex = document.getElementById('bg-color-hex');
const textColorHex = document.getElementById('text-color-hex');
const emphasisColorHex = document.getElementById('emphasis-color-hex');
const blurOpacityVal = document.getElementById('blur-opacity-val');
const bgOpacityVal = document.getElementById('bg-opacity-val');
const blurVal = document.getElementById('blur-val');

const resetBtn = document.getElementById('reset-btn');

let currentTheme = {};

async function init() {
    currentTheme = await window.electronAPI.getCustomTheme();
    updateUI(currentTheme);
    applyTranslations();
}

function updateUI(theme) {
    bgColorInput.value = theme['bg-color'];
    textColorInput.value = theme['text-color'];
    emphasisColorInput.value = theme['emphasis-color'];
    blurOpacityInput.value = theme['blur-opacity'];
    bgOpacityInput.value = theme['bg-opacity'];
    blurInput.value = theme['blur-strength'];

    bgColorHex.textContent = theme['bg-color'].toUpperCase();
    textColorHex.textContent = theme['text-color'].toUpperCase();
    emphasisColorHex.textContent = theme['emphasis-color'].toUpperCase();
    blurOpacityVal.textContent = theme['blur-opacity'];
    bgOpacityVal.textContent = theme['bg-opacity'];
    blurVal.textContent = `${theme['blur-strength']}px`;

    // Apply colors to editor body for preview
    document.body.style.setProperty('--custom-bg-color', theme['bg-color']);
    document.body.style.setProperty('--custom-text-color', theme['text-color']);
    document.body.style.setProperty('--custom-emphasis-color', theme['emphasis-color']);
    document.body.style.setProperty('--custom-opacity', theme['blur-opacity']);
    document.body.style.setProperty('--custom-bg-opacity', theme['bg-opacity']);
    document.body.style.setProperty('--custom-blur-strength', `${theme['blur-strength']}px`);

    // Adapt for light backgrounds
    if (isColorLight(theme['bg-color'])) {
        document.body.style.setProperty('--surface-color', 'rgba(0, 0, 0, 0.1)');
        document.body.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.15)');
    } else {
        document.body.style.setProperty('--surface-color', 'rgba(255, 255, 255, 0.1)');
        document.body.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.15)');
    }
}

function isColorLight(color) {
    if (!color) return false;
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return brightness > 155;
}

function updateTheme() {
    const theme = {
        'bg-color': bgColorInput.value,
        'text-color': textColorInput.value,
        'emphasis-color': emphasisColorInput.value,
        'blur-opacity': parseFloat(blurOpacityInput.value),
        'bg-opacity': parseFloat(bgOpacityInput.value),
        'blur-strength': parseInt(blurInput.value)
    };

    currentTheme = theme;
    updateUI(theme);
    window.electronAPI.setCustomTheme(theme);
}

bgColorInput.addEventListener('input', updateTheme);
textColorInput.addEventListener('input', updateTheme);
emphasisColorInput.addEventListener('input', updateTheme);
blurOpacityInput.addEventListener('input', updateTheme);
bgOpacityInput.addEventListener('input', updateTheme);
blurInput.addEventListener('input', updateTheme);

resetBtn.addEventListener('click', () => {
    const defaultTheme = {
        'bg-color': '#000000',
        'text-color': '#eeeeee',
        'emphasis-color': '#ff5858',
        'blur-opacity': 0.28,
        'bg-opacity': 0.55,
        'blur-strength': 14
    };
    updateUI(defaultTheme);
    window.electronAPI.setCustomTheme(defaultTheme);
});

async function applyTranslations() {
    try {
        const translations = await window.electronAPI.getTranslations([
            'bg_color', 'text_color', 'emphasis_color', 'blur_opacity', 'background_opacity', 'blur_strength', 'reset', 'custom_theme'
        ]);

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (translations[key]) el.textContent = translations[key];
        });

        if (translations['custom_theme']) {
            document.title = translations['custom_theme'];
        }
    } catch (error) {
        console.error('Error applying translations:', error);
    }
}

init();
