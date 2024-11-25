// api.js
const OSM_API_BASE = 'https://api.openstreetmap.org/api/0.6';
const LOCAL_API_BASE = 'http://localhost:5000/api';

class APIError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

export const osmAPI = {
    async getChangeset(id) {
        const response = await fetch(`${OSM_API_BASE}/changeset/${id}`);
        if (!response.ok) throw new APIError('Failed to fetch changeset', response.status);
        return response.text();
    },

    async getChangesetData(id) {
        const response = await fetch(`${OSM_API_BASE}/changeset/${id}/download`);
        if (!response.ok) throw new APIError('Failed to fetch changeset data', response.status);
        return response.text();
    },

    async getUserInfo(uid) {
        const response = await fetch(`${OSM_API_BASE}/user/${uid}.json`);
        if (!response.ok) throw new APIError('Failed to fetch user data', response.status);
        const data = await response.json();
        return data.user;
    }
};

export const localAPI = {
    async getSummary(changesetId, prompt) {
        const response = await fetch(`${LOCAL_API_BASE}/summarize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ changeset_id: changesetId, prompt })
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new APIError(`Invalid JSON response: ${text.substring(0, 100)}...`, response.status);
        }

        if (!response.ok) {
            throw new APIError(data.error || 'API error', response.status);
        }

        return data;
    }
};