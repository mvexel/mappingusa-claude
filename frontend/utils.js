// utils.js
export const dateUtils = {
    formatRelative(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 30) return `${diffDays} days ago`;
        if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            return `${months} month${months > 1 ? 's' : ''} ago`;
        }
        const years = Math.floor(diffDays / 365);
        return `${years} year${years > 1 ? 's' : ''} ago`;
    }
};

export const urlUtils = {
    getParams() {
        return new URLSearchParams(window.location.search);
    },

    createShareUrls(summary) {
        const baseUrl = encodeURIComponent(window.location.href);
        const text = encodeURIComponent(summary);
        return {
            mastodon: `https://openstreetmap.social/share?text=${text}&url=${baseUrl}`,
            telegram: `https://t.me/share/url?url=${baseUrl}&text=${text}`
        };
    },

    createOSMChaFilterUrl(username) {
        const filterTemplate = JSON.stringify({
            users: [{ label: username, value: username }]
        });
        return `https://osmcha.org/?filters=${encodeURIComponent(filterTemplate)}`;
    }
};

export const parseUtils = {
    xmlToJSON(xmlDoc, nodePath) {
        const node = xmlDoc.querySelector(nodePath);
        if (!node) return null;
        
        return [...node.attributes].reduce((obj, attr) => {
            obj[attr.name] = attr.value;
            return obj;
        }, {});
    },

    extractTags(element) {
        return Array.from(element.getElementsByTagName('tag'))
            .reduce((tags, tag) => {
                tags[tag.getAttribute('k')] = tag.getAttribute('v');
                return tags;
            }, {});
    }
};