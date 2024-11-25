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
    const statusDiv = document.createElement("div");
    statusDiv.className = "status";
    statusDiv.textContent = "INITIALIZING...";
    this.contentEl.appendChild(statusDiv);

    await new Promise((resolve) => setTimeout(resolve, 1000));
    statusDiv.textContent = "ANALYZING...";

    try {
      const prompt = await this.generatePrompt(id);
      const response = await fetch("http://localhost:5000/api/summarize", {
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
      const messageDiv = document.createElement("div");
      messageDiv.className = "message";
      this.contentEl.appendChild(messageDiv);

      await this.typeText(data.summary.toUpperCase(), messageDiv);

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
      `https://api.openstreetmap.org/api/0.6/changeset/${id}/download`,
    );
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    const changes = this.parseChangeset(xmlDoc);
    return this.formatChangesPrompt(changes);
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
            tags: this.extractTags(element),
          });
        });
      }
    });

    return changes;
  }

  extractTags(element) {
    const tags = {};
    Array.from(element.getElementsByTagName("tag")).forEach((tag) => {
      tags[tag.getAttribute("k")] = tag.getAttribute("v");
    });
    return tags;
  }
  formatChangesPrompt(changes) {
    let prompt = `Please analyze these OpenStreetMap changes and describe them in a friendly, first-person statement that would work well for social media sharing. Focus on the positive impact for map users. Start with "I just made my first edit to #OpenStreetMap!". Be specific about what was changed. End with #osm #firstedit hashtags. Do not use any emoji. Your response should be just the message\n\n`;

    ["created", "modified", "deleted"].forEach((action) => {
      if (changes[action].length > 0) {
        prompt += `\n${action.charAt(0).toUpperCase() + action.slice(1)}:\n`;
        changes[action].forEach((item) => {
          prompt += `- ${item.type} with tags: ${JSON.stringify(item.tags)}\n`;
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
  async showCelebration(data) {
    // Show initial status
    const statusDiv = document.createElement("div");
    statusDiv.className = "status";
    statusDiv.textContent = "INITIALIZING...";
    this.contentEl.appendChild(statusDiv);

    await new Promise((resolve) => setTimeout(resolve, 1000));
    statusDiv.textContent = "ANALYZING...";

    // Start fetching data during the "analyzing" phase
    const response = await fetch("http://localhost:5000/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        changeset_id: data.changesetId,
        prompt: data.prompt,
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    statusDiv.remove();

    const messageDiv = document.createElement("div");
    messageDiv.className = "message";
    this.contentEl.appendChild(messageDiv);

    const result = await response.json();
    await this.typeText(result.summary.toUpperCase(), messageDiv);

    const button = document.createElement("button");
    button.className = "share-button";
    button.textContent = "COPY TEXT >>";
    button.addEventListener("click", () => this.copyText(result.summary));
    this.contentEl.appendChild(button);

    this.cursor.style.display = "block";
  }

  async copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
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
