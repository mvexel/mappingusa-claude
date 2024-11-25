import { osmAPI, localAPI } from "./api.js";
import { UIManager } from "./ui.js";
import { urlUtils, parseUtils } from "./utils.js";

class ChangesetViewer {
    constructor() {
        this.ui = new UIManager();
        this.changesetId = urlUtils.getParams().get("changeset");

        if (!this.changesetId) {
            this.ui.showError(
                "No changeset ID provided",
                "Please provide a changeset ID in the URL (e.g., ?changeset=123456789)",
            );
            return;
        }

        this.initialize();
    }

    async initialize() {
        try {
            const [changesetData, metaData] = await Promise.all([
                osmAPI.getChangesetData(this.changesetId),
                osmAPI.getChangeset(this.changesetId),
            ]);

            const parser = new DOMParser();
            const changeset = parseUtils.xmlToJSON(
                parser.parseFromString(metaData, "text/xml"),
                "changeset",
            );

            if (changeset?.uid) {
                this.loadUserInfo(changeset.uid);
            }

            await this.processChangeset(
                parser.parseFromString(changesetData, "text/xml"),
                changeset,
            );
        } catch (error) {
            this.ui.showError("Error loading changeset data", error.message);
        }
    }

    async loadUserInfo(uid) {
        try {
            const userInfo = await osmAPI.getUserInfo(uid);
            this.ui.updateUserInfo(userInfo);
        } catch (error) {
            console.error("Error loading user info:", error);
        }
    }

    async processChangeset(xmlDoc, changeset) {
        const changes = this.parseChangeset(xmlDoc);

        try {
            const summary = await this.getAISummary(changes);
            if (summary) {
                // First edit - show AI summary
                this.ui.updateWelcomeMessage(summary);
            } else {
                // Returning user - show changeset info
                this.ui.updateChangesetInfo(changeset, changes);
            }
        } catch (error) {
            this.ui.showError("Error getting AI summary", error.message);
            return;
        }

        this.initializeMap(changeset);
    }

    parseChangeset(xmlDoc) {
        const changes = {
            created: [],
            modified: [],
            deleted: [],
        };

        const actionMap = {
            create: "created",
            modify: "modified",
            delete: "deleted",
        };

        Object.entries(actionMap).forEach(([xmlAction, arrayName]) => {
            const section = xmlDoc.getElementsByTagName(xmlAction)[0];
            if (section) {
                Array.from(section.children).forEach((element) => {
                    changes[arrayName].push({
                        type: element.tagName,
                        id: element.getAttribute("id"),
                        tags: parseUtils.extractTags(element),
                    });
                });
            }
        });

        return changes;
    }

    async getAISummary(changes) {
        const prompt = this.formatChangesPrompt(changes);
        try {
            const data = await localAPI.getSummary(this.changesetId, prompt);
            return data.summary;
        } catch (error) {
            if (error.status === 403) {
                // Not a first edit
                return null;
            }
            throw error;
        }
    }

    formatChangesPrompt(changes) {
        let prompt = `Please analyze these OpenStreetMap changes and describe them in a friendly, first-person statement that would work well for social media sharing. Start with "I just..." and focus on the impact. Keep it to one sentence, be specific about what was changed, and include one relevant emoji.\n\n`;

        const sections = {
            created: "Added",
            modified: "Modified",
            deleted: "Removed",
        };

        Object.entries(sections).forEach(([arrayName, label]) => {
            if (changes[arrayName]?.length > 0) {
                prompt += `\n${label}:\n`;
                changes[arrayName].forEach((item) => {
                    prompt += `- ${item.type} with tags: ${JSON.stringify(item.tags)}\n`;
                });
            }
        });

        return prompt;
    }

    initializeMap(changeset) {
        const bounds = {
            minLat: parseFloat(changeset.min_lat),
            maxLat: parseFloat(changeset.max_lat),
            minLon: parseFloat(changeset.min_lon),
            maxLon: parseFloat(changeset.max_lon),
        };

        const center = {
            lat: (bounds.minLat + bounds.maxLat) / 2,
            lon: (bounds.minLon + bounds.maxLon) / 2,
        };

        this.ui.toggleLoading(false);
        const mapElement = document.getElementById("map");
        mapElement.style.display = "block";

        const map = L.map("map");
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors",
        }).addTo(map);

        const latLngBounds = L.latLngBounds(
            [bounds.minLat, bounds.minLon],
            [bounds.maxLat, bounds.maxLon],
        );

        L.rectangle(latLngBounds, {
            color: "#ff7800",
            weight: 1,
            fillOpacity: 0.2,
        }).addTo(map);

        L.marker([center.lat, center.lon])
            .addTo(map)
            .bindPopup("Your edit was here!")
            .openPopup();

        map.fitBounds(latLngBounds, {
            padding: [50, 50],
            maxZoom: 18,
        });
    }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    new ChangesetViewer();
});
