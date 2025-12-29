document.addEventListener('DOMContentLoaded', async () => {
    const translations = await window.electronAPI.getTranslations();

    const filterListDiv = document.getElementById('filter-list');
    const saveButton = document.getElementById('save-button');
    const cancelButton = document.getElementById('cancel-button');
    const addFilterLink = document.getElementById('add-filter');
    const moreFiltersLink = document.getElementById('more-filters');
    const resetButton = document.getElementById('reset-button');
    const configTitle = document.getElementById('config-title');

    configTitle.textContent = translations.ad_filter_config_title;
    document.getElementById('add-filter-text').textContent = translations.add_new_filter;
    document.getElementById('more-filters-text').textContent = translations.more_filters;
    document.getElementById('save-button-text').textContent = translations.save;
    document.getElementById('cancel-button-text').textContent = translations.cancel;
    document.getElementById('reset-button-text').textContent = translations.reset;

    let allFilters = [];

    //load ad skipper settings
    const adSkipperEnabled = document.getElementById('ad-skipper-enabled');
    const adSkipSpeed = document.getElementById('ad-skip-speed');

    const adSkipperSettings = await window.electronAPI.getAdSkipperSettings();
    adSkipperEnabled.checked = adSkipperSettings.enabled;
    adSkipSpeed.value = adSkipperSettings.speed;

    adSkipSpeed.addEventListener('change', () => {});

    const renderFilters = () => {
        filterListDiv.innerHTML = '';
        allFilters.forEach((filter, index) => {
            const filterItem = document.createElement('div');
            filterItem.className = 'filter-item';
            
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = filter.enabled;
            checkbox.addEventListener('change', (e) => {
                filter.enabled = e.target.checked;
            });
            
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(filter.name));

            const content = document.createElement('div');
            content.className = 'filter-content';
            content.appendChild(label);

            const desc = document.createElement('div');
            desc.className = 'filter-desc';
            desc.textContent = filter.description || 'Custom filter list';
            content.appendChild(desc);

            filterItem.appendChild(content);

            if (!filter.isDefault) {
                const deleteButton = document.createElement('button');
                deleteButton.className = 'delete-btn';
                deleteButton.title = translations.delete;
                deleteButton.setAttribute('aria-label', translations.delete);
                
                const trashIcon = document.createElement('i');
                trashIcon.className = 'bi bi-trash';
                deleteButton.appendChild(trashIcon);
                
                deleteButton.addEventListener('click', () => {
                    allFilters.splice(index, 1);
                    renderFilters();
                });
                filterItem.appendChild(deleteButton);
            }

            filterListDiv.appendChild(filterItem);
        });
    };

    const initialFilters = await window.electronAPI.getFilters();
    allFilters = initialFilters;
    
    renderFilters();

    saveButton.addEventListener('click', (e) => {
        e.preventDefault();

        const filtersToSave = allFilters.map(f => ({
            name: f.name,
            url: f.url,
            description: f.description,
            enabled: f.enabled
        }));

        window.electronAPI.saveFilters(filtersToSave);

        window.electronAPI.saveAdSkipperSettings({
            enabled: adSkipperEnabled.checked,
            speed: parseInt(adSkipSpeed.value)
        });

        window.close();
    });

    cancelButton.addEventListener('click', (e) => {
        e.preventDefault();
        window.close();
    });

    addFilterLink.addEventListener('click', (e) => {
        e.preventDefault();
        allFilters.push({ name: '', url: '', enabled: true, isDefault: false });
        renderFilters();
    });

    moreFiltersLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.electronAPI.openExternal('https://github.com/uBlockOrigin/uAssets/tree/master');
    });

    resetButton.addEventListener('click', (e) => {
        e.preventDefault();
        window.electronAPI.resetFilters();
        window.close();
    });
});
