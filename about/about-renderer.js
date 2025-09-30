document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Request application information and translations
        const info = await window.aboutAPI.getAboutInfo();

        // Apply dynamic/translated content
        document.getElementById('windowTitle').textContent = info.translations.about_app || info.appName;
        document.getElementById('appName').textContent = info.appName;
        document.getElementById('appVersion').textContent = info.translations.version;
        document.getElementById('appDescription').textContent = info.appDescription;

        // Configure GitHub link
        const githubLink = document.getElementById('githubLink');
        githubLink.textContent = info.translations.github_link;
        githubLink.addEventListener('click', (event) => {
            event.preventDefault(); // Stop the default browser navigation
            window.aboutAPI.openExternal(info.githubUrl); // Open in external shell
        });

        // Configure close button
        document.getElementById('closeButton').textContent = info.translations.accept;

        // Calculate and send final size to the main process
        const { clientWidth, clientHeight } = document.body;
        
        // Add an extra margin (e.g., 20px) to avoid cutting off borders
        const finalWidth = clientWidth;
        const finalHeight = clientHeight + 20; 
        
        // Send the required size to the main process
        window.aboutAPI.resizeWindow(finalWidth, finalHeight);
    } catch (error) {
        console.error('Failed to load about info:', error);
        // Fallback content in case of error
        document.getElementById('appName').textContent = 'Error Loading Info';
    }
});