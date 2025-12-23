const themeOpts = document.querySelectorAll('.theme-opt');
const themeTitle = document.getElementById('theme-title');
const labels = document.querySelectorAll('[data-i18n]');

async function applyTranslations() {
    try {
        const translations = await window.electronAPI.getTranslations([
            'theme_settings', 'theme_light', 'theme_dark', 'theme_red', 'theme_blue', 'theme_green', 'theme_midnight'
        ]);

        themeTitle.textContent = translations['theme_settings'];
        labels.forEach(label => {
            const key = label.dataset.i18n;
            if (translations[key]) label.textContent = translations[key];
        });
    } catch (error) {
        console.error('Error applying translations:', error);
    }
}

async function initTheme() {
    const currentTheme = await window.electronAPI.getTheme();
    document.body.className = currentTheme;
    themeOpts.forEach(opt => {
        opt.classList.toggle('active', opt.dataset.theme === currentTheme);
    });
}

themeOpts.forEach(opt => {
    opt.addEventListener('click', () => {
        const theme = opt.dataset.theme;
        document.body.className = theme;
        themeOpts.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        window.electronAPI.setTheme(theme);
    });
});

applyTranslations();
initTheme();
