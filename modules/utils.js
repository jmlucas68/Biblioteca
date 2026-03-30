export function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}

export function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

export function deleteCookie(name) {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

export function esc(s) {
    return String(s || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

export function hash(s){ let h=0; for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i); h|=0;} return String(Math.abs(h)); }

export function extractDriveId(inputUrl) {
    if (!inputUrl) return null;
    const p = inputUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (p?.[1]) return p[1];
    const d = inputUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)\//);
    return d?.[1] || null;
}

export function resolveCoverThumb(urlPortada) {
    if (!urlPortada) return '';
    const m = urlPortada.match(/\/d\/([^\/]+)\//);
    const id = m ? m[1] : null;
    if (!id) return urlPortada;
    return `https://drive.google.com/thumbnail?id=${id}&sz=w400`;
}

export function isHTML(str) {
    if (!str) return false;
    const doc = new DOMParser().parseFromString(str, "text/html");
    return Array.from(doc.body.childNodes).some(node => node.nodeType === 1);
}

export function normalizeText(str) {
    if (typeof str !== 'string') return '';
    return str.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
