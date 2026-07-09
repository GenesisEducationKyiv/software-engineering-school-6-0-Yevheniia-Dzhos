const form = document.getElementById('form');
const statusBox = document.getElementById('status');
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusBox.style.display = 'block';
    statusBox.textContent = 'Submitting...';
    const payload = {
        email: document.getElementById('email').value,
        repo: document.getElementById('repo').value
    };
    try {
        const response = await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        statusBox.textContent = response.ok ? data.message : data.error;
    } catch {
        statusBox.textContent = 'Request failed';
    }
});