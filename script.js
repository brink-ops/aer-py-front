// frontend/script.js
document.addEventListener('DOMContentLoaded', () => {
    const fetchButton = document.getElementById('fetchButton');
    const backendMessageSpan = document.getElementById('backendMessage');

    const fetchMessage = async () => {
        try {
            // --- CRITICAL CHANGE HERE ---
            // Now call a relative path on the frontend server, which Nginx will proxy
            const response = await fetch('/api/message');
            // ---------------------------

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            backendMessageSpan.textContent = data.message;
        } catch (error) {
            console.error('Error fetching message:', error);
            backendMessageSpan.textContent = `Error: ${error.message}`;
        }
    };

    fetchButton.addEventListener('click', fetchMessage);

    // Fetch message automatically when the page loads
    fetchMessage();
});
