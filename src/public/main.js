const form = document.getElementById('form');
const statusBox = document.getElementById('status');
const emailInput = document.getElementById('email');
const repoInput = document.getElementById('repo');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const repoPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function validateForm(email, repo) {
    if (!emailPattern.test(email)) {
        return 'Please enter a valid email.';
    }

    if (!repoPattern.test(repo)) {
        return 'Repository must use owner/repo format.';
    }

    return null;
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusBox.style.display = 'block';
    const email = emailInput.value.trim();
    const repo = repoInput.value.trim();
    const validationError = validateForm(email, repo);

    if (validationError) {
        statusBox.textContent = validationError;
        return;
    }

    statusBox.textContent = 'Submitting...';
    const payload = {
        email,
        repo
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