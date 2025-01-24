class FirstEditCelebrator {
  constructor() {
    this.contentEl = document.getElementById("content");
    this.cursor = document.querySelector(".cursor");
    this.cursor.style.display = "none";
    this.init();
  }

  async init() {
    const params = new URLSearchParams(window.location.search);
    const changesetId = params.get("changeset");

    if (!changesetId) {
      this.showError("NO CHANGESET ID");
      return;
    }

    try {
      await this.loadChangeset(changesetId);
    } catch (error) {
      this.showError(error.message);
    }
  }

  async typeText(text, element, minSpeed = 15, maxSpeed = 60) {
    let index = 0;
    while (index < text.length) {
      element.textContent += text[index];
      index++;
      await new Promise((resolve) => {
        const speed = Math.random() * (maxSpeed - minSpeed) + minSpeed;
        setTimeout(resolve, speed);
      });
    }
  }

  createBlinkingText(text) {
    const div = document.createElement("div");
    div.className = "blinking-text";
    div.textContent = text;
    return div;
  }

  async loadChangeset(id) {
    this.currentChangesetId = id;
    const statusDiv = document.createElement("div");
    statusDiv.className = "status";
    statusDiv.textContent = "INITIALIZING...";
    this.contentEl.appendChild(statusDiv);

    await new Promise((resolve) => setTimeout(resolve, 1000));
    statusDiv.textContent = "ANALYZING...";

    try {
      const prompt = await this.generatePrompt(id);
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changeset_id: id,
          prompt,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "SYSTEM ERROR");
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      statusDiv.remove();

      const data = await response.json();
      console.log(data);
      const messageDiv = document.createElement("div");
      messageDiv.className = "message";
      this.contentEl.appendChild(messageDiv);

      await this.typeText(
        `${data.summary} Check it out ➡️ https://osmcha.org/changesets/${this.currentChangesetId} | Make YOUR first edit ➡️ https://openstreetmap.us/get-involved/start-mapping/`,
        messageDiv
      );

      const button = document.createElement("button");
      button.className = "share-button";
      button.textContent = "COPY TEXT >>";
      button.addEventListener("click", () => this.copyText(data.summary));
      this.contentEl.appendChild(button);

      this.cursor.style.display = "block";
    } catch (error) {
      throw error;
    }
  }

  async generatePrompt(id) {
    const response = await fetch(
      `https://api.openstreetmap.org/api/0.6/changeset/${id}/download`
    );
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    const changes = this.parseChangeset(xmlDoc);
    return this.formatChangesPrompt(changes);
  }

  parseChangeset(xmlDoc) {
    const changes = {
      create: [],
      modify: [],
      delete: [],
    };

    ["create", "modify", "delete"].forEach((action) => {
      const elements = xmlDoc.getElementsByTagName(action);

      Array.from(elements).forEach((section) => {
        Array.from(section.children).forEach((element) => {
          const item = {
            type: element.tagName,
            id: element.getAttribute("id"),
            user: element.getAttribute("user"),
            timestamp: element.getAttribute("timestamp"),
            tags: {},
          };

          // Extract tags
          Array.from(element.getElementsByTagName("tag")).forEach((tag) => {
            item.tags[tag.getAttribute("k")] = tag.getAttribute("v");
          });

          // Extract node references only if it's a way
          if (element.tagName === "way") {
            item.nodes = Array.from(element.getElementsByTagName("nd")).map(
              (nd) => nd.getAttribute("ref")
            );
          }

          const key = action;
          if (!changes[key]) {
            console.error(`Unexpected key: ${key}`);
            return;
          }

          changes[key].push(item);
        });
      });
    });

    return changes;
  }

  extractTags(element) {
    const tags = {};
    const tagElements = element.getElementsByTagName("tag");
    if (tagElements) {
      Array.from(tagElements).forEach((tag) => {
        tags[tag.getAttribute("k")] = tag.getAttribute("v");
      });
    }
    return tags;
  }

  formatChangesPrompt(changes) {
    let prompt = `Please analyze these OpenStreetMap changes and describe them in a friendly, first-person statement that would work well for social media sharing. Focus on the positive impact for map users. Start with "I just made my first edit to #OpenStreetMap!". Be specific about what was changed. End with #osm #firstedit hashtags. Do not use any emoji. Your response should be just the message.\n\n`;

    ["create", "modify", "delete"].forEach((action) => {
      if (!changes[action]) return; // Ensure the action key exists

      // Filter out nodes with no tags
      let filteredItems = changes[action].filter(
        (item) =>
          item.type !== "node" ||
          (item.tags && Object.keys(item.tags).length > 0)
      );

      if (filteredItems.length > 0) {
        prompt += `\n${action.charAt(0).toUpperCase() + action.slice(1)}:\n`;
        filteredItems.forEach((item) => {
          prompt += `- ${item.type} (ID: ${
            item.id
          }) with tags: ${JSON.stringify(item.tags)}\n`;
        });
      }
    });

    console.log(prompt);
    return prompt;
  }

  showError(message) {
    this.contentEl.innerHTML = `
            <div class="error">
                ERROR: ${message.toUpperCase()}
            </div>
        `;
  }
  async copyText(text) {
    const fullText = `${text} Check it out ➡️ https://osmcha.org/changesets/${this.currentChangesetId} | Make YOUR first edit ➡️ https://openstreetmap.us/get-involved/start-mapping/`;
    try {
      await navigator.clipboard.writeText(fullText);
      const button = document.querySelector(".share-button");
      button.textContent = ">> COPIED <<";
      setTimeout(() => {
        button.textContent = "COPY TEXT >>";
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }
}

new FirstEditCelebrator();
