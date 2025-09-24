document.addEventListener('DOMContentLoaded', async () => {
    const translations = await window.electronAPI.getTranslations();

    const filterListDiv = document.getElementById('filter-list');
    const saveButton = document.getElementById('save-button');
    const cancelButton = document.getElementById('cancel-button');
    const addFilterLink = document.getElementById('add-filter');
    const resetButton = document.getElementById('reset-button');
    const configTitle = document.getElementById('config-title');

    configTitle.textContent = translations.ad_filter_config_title;
    addFilterLink.textContent = translations.add_new_filter;
    saveButton.textContent = translations.save;
    cancelButton.textContent = translations.cancel;
    resetButton.textContent = translations.reset;

    let allFilters = [];

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
            label.appendChild(document.createTextNode(translations.enabled));

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.placeholder = translations.filter_name;
            nameInput.value = filter.name;
            nameInput.disabled = filter.isDefault;
            nameInput.setAttribute('aria-label', translations.filter_name);
            nameInput.addEventListener('input', (e) => {
                filter.name = e.target.value;
            });

            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.placeholder = translations.filter_url;
            urlInput.value = filter.url;
            urlInput.disabled = filter.isDefault;
            urlInput.setAttribute('aria-label', translations.filter_url);
            urlInput.addEventListener('input', (e) => {
                filter.url = e.target.value;
            });
            
            filterItem.appendChild(label);
            filterItem.appendChild(nameInput);
            filterItem.appendChild(urlInput);

            if (!filter.isDefault) {
                const deleteButton = document.createElement('button');
                deleteButton.textContent = translations.delete;
                deleteButton.className = 'secondary outline';
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

    saveButton.addEventListener('click', () => {
        const userFiltersToSave = allFilters.filter(f => !f.isDefault).map(f => ({
            name: f.name,
            url: f.url,
            enabled: f.enabled
        }));
        window.electronAPI.saveFilters(userFiltersToSave);
        window.close();
    });

    cancelButton.addEventListener('click', () => {
        window.close();
    });

    addFilterLink.addEventListener('click', (e) => {
        e.preventDefault();
        allFilters.push({ name: '', url: '', enabled: true, isDefault: false });
        renderFilters();
    });

    resetButton.addEventListener('click', () => {
        window.electronAPI.resetFilters();
        window.close();
    });
});