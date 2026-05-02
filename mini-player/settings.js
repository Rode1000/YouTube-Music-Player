const themeOpts = document.querySelectorAll('.option-btn[data-theme]');
const themeTitle = document.getElementById('theme-title');
const labels = document.querySelectorAll('[data-i18n]');
const alwaysOnTopEl = document.getElementById('always-on-top');

async function applyTranslations() {
    try {
        const translations = await window.electronAPI.getTranslations([
            'mini_player_settings', 'theme', 'theme_dark', 'theme_light', 'theme_blur', 'theme_custom', 'always_on_top'
        ]);

        themeTitle.textContent = translations['mini_player_settings'];
        labels.forEach(label => {
            const key = label.dataset.i18n;
            if (translations[key]) label.textContent = translations[key];
        });

        // Resize window after translations are applied
        refreshSize();
    } catch (error) {
        console.error('Error applying translations:', error);
    }
}

async function initTheme() {
    const currentTheme = await window.electronAPI.getTheme();
    const allowedThemes = new Set(['dark', 'light', 'blur', 'custom']);

    const resolvedTheme = allowedThemes.has(currentTheme) ? currentTheme : 'dark';
    if (resolvedTheme !== currentTheme) {
        window.electronAPI.setTheme(resolvedTheme);
    }

    document.body.className = resolvedTheme;

    const customTheme = await window.electronAPI.getCustomTheme();
    applyCustomTheme(customTheme, resolvedTheme === 'custom');

    // Force a minor reflow to ensure the class is applied and variables updated
    void document.body.offsetHeight;

    themeOpts.forEach(opt => {
        opt.classList.toggle('active', opt.dataset.theme === resolvedTheme);
    });

    // Trigger resize after theme is applied
    refreshSize();
}

function applyCustomTheme(theme, applyGlobal = true) {
    if (!theme) return;
    const body = document.body;
    body.style.setProperty('--custom-bg-color', theme['bg-color']);
    body.style.setProperty('--custom-text-color', theme['text-color']);
    body.style.setProperty('--custom-emphasis-color', theme['emphasis-color']);
    body.style.setProperty('--custom-opacity', theme['blur-opacity']);
    body.style.setProperty('--custom-bg-opacity', theme['bg-opacity']);
    body.style.setProperty('--custom-blur-strength', `${theme['blur-strength']}px`);

    if (applyGlobal) {
        // Adapt for light backgrounds
        if (isColorLight(theme['bg-color'])) {
            body.style.setProperty('--surface-color', 'rgba(0, 0, 0, 0.1)');
            body.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.15)');
            body.style.setProperty('--knob-color', '#ffffff');
        } else {
            // Default for dark backgrounds
            body.style.setProperty('--surface-color', 'rgba(255, 255, 255, 0.1)');
            body.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.15)');
            body.style.removeProperty('--knob-color');
        }
    } else {
        // Remove global overrides so CSS classes control them
        body.style.removeProperty('--surface-color');
        body.style.removeProperty('--border-color');
        body.style.removeProperty('--knob-color');
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

function refreshSize() {
    requestAnimationFrame(() => {
        const panel = document.querySelector('.panel');
        if (!panel) return;

        // Temporarily set width to max-content to measure required width
        const originalWidth = panel.style.width;
        panel.style.width = 'max-content';

        const width = panel.offsetWidth;
        const height = panel.offsetHeight;

        // Reset width to allow responsiveness if needed
        panel.style.width = originalWidth;

        // Add body padding plus a small buffer
        const bodyStyle = window.getComputedStyle(document.body);
        const paddingX = parseFloat(bodyStyle.paddingLeft) + parseFloat(bodyStyle.paddingRight);
        const paddingY = parseFloat(bodyStyle.paddingTop) + parseFloat(bodyStyle.paddingBottom);

        // Add extra buffer specifically for cross-platform/high-DPI scenarios
        const totalWidth = Math.ceil(width + paddingX + 16);
        const totalHeight = Math.ceil(height + paddingY + 14);

        window.electronAPI.resizeWindow(totalWidth, totalHeight);
    });
}

async function initAlwaysOnTop() {
    if (!alwaysOnTopEl) return;

    const enabled = await window.electronAPI.getAlwaysOnTop();
    alwaysOnTopEl.checked = !!enabled;

    alwaysOnTopEl.addEventListener('change', () => {
        window.electronAPI.setAlwaysOnTop(alwaysOnTopEl.checked);
    });
}

themeOpts.forEach(opt => {
    opt.addEventListener('click', () => {
        const theme = opt.dataset.theme;
        const isActive = opt.classList.contains('active');

        if (isActive && theme === 'custom') {
            window.electronAPI.openCustomThemeEditor();
            return;
        }

        document.body.className = theme;
        themeOpts.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        window.electronAPI.setTheme(theme);

        window.electronAPI.getCustomTheme().then(t => {
            applyCustomTheme(t, theme === 'custom');
        });

        if (theme === 'custom') {
            window.electronAPI.openCustomThemeEditor();
        }

        refreshSize();
    });
});

initTheme().then(() => {
    applyTranslations();
    initAlwaysOnTop();
});

// Listen for theme changes from properties
window.electronAPI.onThemeChanged(async (theme) => {
    document.body.className = theme;
    const customTheme = await window.electronAPI.getCustomTheme();
    applyCustomTheme(customTheme, theme === 'custom');

    themeOpts.forEach(opt => {
        opt.classList.toggle('active', opt.dataset.theme === theme);
    });
    refreshSize();
});

window.electronAPI.onCustomThemeUpdated((theme) => {
    const isCustomActive = document.body.classList.contains('custom');
    applyCustomTheme(theme, isCustomActive);
});
