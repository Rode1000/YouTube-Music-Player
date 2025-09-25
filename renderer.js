// Wait for the DOM content to be fully loaded before executing the script
document.addEventListener('DOMContentLoaded', async () => {
    // Fetch translations from the electron main process
    const translations = await window.electronAPI.getTranslations();

    // Get DOM elements
    const filterListDiv = document.getElementById('filter-list');
    const saveButton = document.getElementById('save-button');
    const cancelButton = document.getElementById('cancel-button');
    const addFilterLink = document.getElementById('add-filter');
    const resetButton = document.getElementById('reset-button');
    const configTitle = document.getElementById('config-title');

    // Get specific text spans for icons (NEW)
    const addFilterTextSpan = addFilterLink.querySelector('span');
    const saveButtonTextSpan = saveButton.querySelector('span');
    const cancelButtonTextSpan = cancelButton.querySelector('span');
    const resetButtonTextSpan = resetButton.querySelector('span');


    // Set text content based on translations
    configTitle.textContent = translations.ad_filter_config_title;
    
    // Set text content for elements containing icons (UPDATED)
    addFilterTextSpan.textContent = translations.add_new_filter;
    saveButtonTextSpan.textContent = translations.save;
    cancelButtonTextSpan.textContent = translations.cancel;
    resetButtonTextSpan.textContent = translations.reset;

    // Array to hold all filter objects
    let allFilters = [];

    // Function to render the list of filters to the DOM
    const renderFilters = () => {
        // Clear existing filter list content
        filterListDiv.innerHTML = '';
        
        // Iterate over all filters and create their corresponding DOM elements
        allFilters.forEach((filter, index) => {
            // Create container for the filter item
            const filterItem = document.createElement('div');
            filterItem.className = 'filter-item';
            
            // Create label and checkbox for filter enablement
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = filter.enabled;
            // Update filter model when checkbox state changes
            checkbox.addEventListener('change', (e) => {
                filter.enabled = e.target.checked;
            });
            
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(translations.enabled));

            // Create input for filter name
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.placeholder = translations.filter_name;
            nameInput.value = filter.name;
            // Disable input for default filters
            nameInput.disabled = filter.isDefault;
            nameInput.setAttribute('aria-label', translations.filter_name);
            // Update filter model when name changes
            nameInput.addEventListener('input', (e) => {
                filter.name = e.target.value;
            });

            // Create input for filter URL
            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.placeholder = translations.filter_url;
            urlInput.value = filter.url;
            // Disable input for default filters
            urlInput.disabled = filter.isDefault;
            urlInput.setAttribute('aria-label', translations.filter_url);
            // Update filter model when URL changes
            urlInput.addEventListener('input', (e) => {
                filter.url = e.target.value;
            });
            
            // Append elements to the filter item container
            filterItem.appendChild(label);
            filterItem.appendChild(nameInput);
            filterItem.appendChild(urlInput);

            // Add delete button for non-default filters
            if (!filter.isDefault) {
                const deleteButton = document.createElement('button');
                // Add icon and span for text
                deleteButton.innerHTML = `<i class="bi bi-trash"></i>`; 
                // Use 'danger-red' class for delete button styling
                deleteButton.className = 'outline danger-red'; 
                // Remove filter from array and re-render the list on click
                deleteButton.addEventListener('click', () => {
                    allFilters.splice(index, 1);
                    renderFilters();
                });
                filterItem.appendChild(deleteButton);
            }

            // Append the filter item to the main list container
            filterListDiv.appendChild(filterItem);
        });
    };

    // Load initial filters, populate allFilters, and render
    const initialFilters = await window.electronAPI.getFilters();
    allFilters = initialFilters;
    
    renderFilters();

    // Event listener for the Save button
    saveButton.addEventListener('click', () => {
        // Filter out default filters and map to a structure suitable for saving
        const userFiltersToSave = allFilters.filter(f => !f.isDefault).map(f => ({
            name: f.name,
            url: f.url,
            enabled: f.enabled
        }));
        // Call electron API to save the filters
        window.electronAPI.saveFilters(userFiltersToSave);
        // Close the window
        window.close();
    });

    // Event listener for the Cancel button (just closes the window)
    cancelButton.addEventListener('click', () => {
        window.close();
    });

    // Event listener for the Add Filter link
    addFilterLink.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent default link behavior
        // Add a new empty filter object to the array
        allFilters.push({ name: '', url: '', enabled: true, isDefault: false });
        // Re-render the list to show the new filter
        renderFilters();
    });

    // Event listener for the Reset button
    resetButton.addEventListener('click', () => {
        // Call electron API to reset filters and close window
        window.electronAPI.resetFilters();
        window.close();
    });
});