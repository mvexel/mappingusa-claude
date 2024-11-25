import { dateUtils, urlUtils } from "./utils.js";

function extractLinks(description) {
    if (!description) return [];
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const urlRegex = /(?<![\(\[])(https?:\/\/[^\s\)]+)/g;
    const links = [];

    let match;
    while ((match = markdownLinkRegex.exec(description)) !== null) {
        links.push({
            text: match[1],
            url: match[2],
        });
    }

    description.replace(markdownLinkRegex, "").replace(urlRegex, (url) => {
        links.push({
            text: url,
            url: url,
        });
    });

    return links;
}

export class UIManager {
    constructor() {
        this.elements = {
            userInfo: document.querySelector(".user-info-content"),
            mapperDetails: document.querySelector(".mapper-details"),
            welcome: document.getElementById("welcome-message"),
            loading: document.getElementById("loading"),
            map: document.getElementById("map"),
            editSummary: document.getElementById("edit-summary"),
            status: document.getElementById("status"),
            viewTools: document.getElementById("view-tools"),
        };

        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.warn(`Required element "${key}" not found in DOM`);
            }
        });
    }

    showError(message, details = "") {
        this.toggleLoading(false);
        const errorHtml = `
            <div class="error-message">
                <strong>Error:</strong> ${message}
                ${details ? `<div class="error-details">${details}</div>` : ""}
            </div>
        `;
        if (this.elements.editSummary) {
            this.elements.editSummary.innerHTML = errorHtml;
            this.elements.editSummary.style.display = "block";
        }
    }

    showWarning(message) {
        if (this.elements.welcome) {
            this.elements.welcome.innerHTML = message;
        }
    }

    updateUserInfo(userInfo) {
        if (!this.elements.mapperDetails) return;

        this.elements.mapperDetails.innerHTML = `
            <h3>${userInfo.display_name}</h3>
            <p>Joined ${dateUtils.formatRelative(userInfo.account_created)}</p>
            ${this.formatUserLinks(userInfo.description)}
        `;
    }

    formatUserLinks(description) {
        const links = extractLinks(description);
        if (links.length === 0) return "";

        return `
            <div class="user-links">
                ${links
                    .map(
                        (link, i) => `
                    <a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.text}</a>
                    ${i < links.length - 1 ? '<span class="link-separator">|</span>' : ""}
                `,
                    )
                    .join("")}
            </div>
        `;
    }

    updateWelcomeMessage(aiSummary) {
        if (!this.elements.welcome) return;

        const shareUrls = urlUtils.createShareUrls(aiSummary);
        this.elements.welcome.innerHTML = `
            <div class="celebration">
                <h1>${aiSummary}</h1>
                <div class="share-links">
                    <a href="${shareUrls.mastodon}" target="_blank" rel="noopener" class="share-button mastodon">
                        Share on Mastodon
                    </a>
                    <a href="${shareUrls.telegram}" target="_blank" rel="noopener" class="share-button telegram">
                        Share on Telegram
                    </a>
                </div>
            </div>
        `;
    }

    updateChangesetInfo(changeset, changes) {
        if (!this.elements.welcome) return;

        const breakdownItems = this.formatChangeBreakdown(changes);
        const links = [
            {
                name: "OpenStreetMap",
                url: `https://www.openstreetmap.org/changeset/${changeset.id}`,
                description: "View in main OpenStreetMap website"
            },
            {
                name: "OSMCha",
                url: `https://osmcha.org/changesets/${changeset.id}`,
                description: "Detailed validation and analysis"
            },
            {
                name: "Achavi",
                url: `https://overpass-api.de/achavi/?changeset=${changeset.id}`,
                description: "Visual comparison of changes"
            },
            {
                name: "OSM Changes Map",
                url: `http://osmlab.github.io/changeset-map/#${changeset.id}`,
                description: "A visual representation of your changeset"
            }
        ];

        const userTools = [
            {
                name: "How Did You Contribute?",
                url: `https://hdyc.neis-one.org/?${changeset.user}`,
                description: "Your detailed mapping statistics"
            },
            {
                name: "Your Changesets",
                url: `https://osmcha.org/changesets?filters=%7B%22users%22:%5B%7B%22label%22:%22${encodeURIComponent(changeset.user)}%22,%22value%22:%22${encodeURIComponent(changeset.user)}%22%7D%5D%7D`,
                description: "Browse all your changesets in OSMCha"
            },
            {
                name: "Your OSM Profile",
                url: `https://www.openstreetmap.org/user/${encodeURIComponent(changeset.user)}`,
                description: "Your OpenStreetMap profile page"
            }
        ];

        this.elements.welcome.innerHTML = `
            <div class="changeset-header">
                <h1>Changeset ${changeset.id} by ${changeset.user}</h1>
                <div class="changeset-meta">
                    <span class="meta-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="meta-icon">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        ${this.formatChangesetDate(changeset.created_at)}
                    </span>
                    ${this.formatComment(changeset.comment)}
                </div>
                <div class="change-breakdown">
                    ${breakdownItems.map(text => `
                        <span class="breakdown-item">${text}</span>
                    `).join("")}
                </div>
            </div>

            <div class="tool-section">
                <h3>View this change</h3>
                <div class="tool-grid">
                    ${links.map(link => `
                        <div class="tool-card">
                            <a href="${link.url}" target="_blank" rel="noopener noreferrer">
                                <h4>${link.name}</h4>
                                <p>${link.description}</p>
                            </a>
                        </div>
                    `).join("")}
                </div>

                <h3>Your contributions</h3>
                <div class="tool-grid">
                    ${userTools.map(tool => `
                        <div class="tool-card">
                            <a href="${tool.url}" target="_blank" rel="noopener noreferrer">
                                <h4>${tool.name}</h4>
                                <p>${tool.description}</p>
                            </a>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
    }
    formatComment(comment) {
        return comment
            ? `
            <span class="meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="meta-icon">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
                ${comment}
            </span>
        `
            : "";
    }

    formatChangesetDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
    }

    formatChangeBreakdown(changes) {
        const elementCounts = {
            nodes: { created: 0, modified: 0, deleted: 0 },
            ways: { created: 0, modified: 0, deleted: 0 },
            relations: { created: 0, modified: 0, deleted: 0 },
        };

        ["created", "modified", "deleted"].forEach((action) => {
            changes[action]?.forEach((change) => {
                elementCounts[change.type + "s"][action]++;
            });
        });

        return ["nodes", "ways", "relations"]
            .map((type) => {
                const counts = elementCounts[type];
                const parts = [];

                if (counts.created > 0) parts.push(`${counts.created} created`);
                if (counts.modified > 0)
                    parts.push(`${counts.modified} modified`);
                if (counts.deleted > 0) parts.push(`${counts.deleted} deleted`);

                return parts.length > 0 ? `${type}: ${parts.join(", ")}` : null;
            })
            .filter(Boolean);
    }

    setStatus(message) {
        if (this.elements.status) {
            this.elements.status.textContent = message;
        }
    }

    toggleLoading(show) {
        if (this.elements.loading) {
            this.elements.loading.style.display = show ? "block" : "none";
        }
    }
}
