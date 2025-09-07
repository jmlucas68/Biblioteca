document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('uploadForm');
    const fileInput = document.getElementById('file');
    const fileNameDisplay = document.getElementById('fileName');
    const dropZone = document.querySelector('.drop-zone');
    const submitBtn = document.getElementById('submitBtn');
    const statusMessage = document.getElementById('statusMessage');

    // URL del endpoint en el proxy
    const UPLOAD_URL = 'https://perplexity-proxy-backend.vercel.app/api/import';

    function showStatus(message, isError = false) {
        statusMessage.textContent = message;
        statusMessage.style.display = 'block';
        statusMessage.className = isError ? 'status-message error-message' : 'status-message success-message';
    }

    function handleFileSelect(file) {
        if (file) {
            fileNameDisplay.textContent = `Archivo seleccionado: ${file.name}`;
        } else {
            fileNameDisplay.textContent = '';
        }
    }

    fileInput.addEventListener('change', () => {
        handleFileSelect(fileInput.files[0]);
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = 'var(--primary-color)';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = 'var(--border-color)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = 'var(--border-color)';
        const file = e.dataTransfer.files[0];
        if (file) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelect(file);
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = 'Subiendo...';
        statusMessage.style.display = 'none';

        const formData = new FormData(form);

        try {
            const response = await fetch(UPLOAD_URL, {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.details || result.error || 'Ocurrió un error desconocido.');
            }

            showStatus(`¡Éxito! Libro \"${result.metadata.titulo}\" importado correctamente.`);
            form.reset();
            fileNameDisplay.textContent = '';

        } catch (error) {
            showStatus(`Error: ${error.message}`, true);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Subir Libro';
        }
    });
});
