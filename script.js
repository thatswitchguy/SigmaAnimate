// Fallback implementation for notify if window.notify is not available
const notify = {
  success: (message) => {
    if (window.notify) {
      window.notify.success(message);
    } else {
      alert(`SUCCESS: ${message}`); // Use alert as a simple fallback
      console.log(`SUCCESS: ${message}`);
    }
  },
  error: (message) => {
    if (window.notify) {
      window.notify.error(message);
    } else {
      alert(`ERROR: ${message}`);
      console.error(`ERROR: ${message}`);
    }
  },
  info: (message) => {
    if (window.notify) {
      window.notify.info(message);
    } else {
      alert(`INFO: ${message}`);
      console.log(`INFO: ${message}`);
    }
  },
  warning: (message) => {
    if (window.notify) {
      window.notify.warning(message);
    } else {
      alert(`WARNING: ${message}`);
      console.warn(`WARNING: ${message}`);
    }
  },
};

class AnimationStudio {
  constructor() {
    this.canvas = document.getElementById("drawCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.canvas.width = 800;
    this.canvas.height = 600;

    this.frames = [this.createEmptyFrame()];
    this.currentFrameIndex = 0;
    this.isDrawing = false;
    this.tool = "pencil";
    this.color = "#000000";
    this.brushSize = 7;
    this.isPlaying = false;
    this.fps = 12;
    this.animationInterval = null;
    this.onionSkinEnabled = false;
    this.smartDrawEnabled = true;
    this.backgroundColor = "#ffffff";
    this.backgroundImage = null;

    // Connect auth manager studio reference
    this.authManager = new AuthManager(this);
    window.authManager = this.authManager;
    window.studio = this;

    this.lastX = 0;
    this.lastY = 0;

    this.selectedShape = null;
    this.shapeWidth = 100;
    this.shapeHeight = 100;

    // Text properties
    this.textContent = "";
    this.fontSize = 24;
    this.fontFamily = "Arial";
    this.textUnderline = false;
    this.textBoxStart = null;
    this.tempTextBox = null;

    // Clipboard
    this.clipboard = [];

    // Smart draw properties
    this.drawPoints = [];
    this.tempCanvas = document.createElement("canvas");
    this.tempCanvas.width = this.canvas.width;
    this.tempCanvas.height = this.canvas.height;
    this.tempCtx = this.tempCanvas.getContext("2d");

    // Object system for movable/resizable shapes
    this.objects = [];
    this.selectedObjects = [];
    this.isDragging = false;
    this.isResizing = false;
    this.isRotating = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.resizeHandle = null;
    this.rotationHandle = null;
    this.selectionBox = null;
    this.isSelecting = false;

    // History for undo/redo
    this.history = [];
    this.historyIndex = -1;

    this.initializeEventListeners();
    this.initializeResizers();
    this.render();
    this.updateTimeline();
    // Save initial state to history
    this.saveCurrentFrame();
    // Set initial cursor after a small delay to ensure canvas is ready
    setTimeout(() => this.setTool("pencil"), 0);
  }

  initializeResizers() {
    // Sidebar resizer
    const sidebar = document.querySelector(".sidebar");
    const sidebarResizer = document.getElementById("sidebarResizer");
    const sidebarCollapseBtn = document.getElementById("sidebarCollapseBtn");

    let isResizingSidebar = false;

    sidebarResizer.addEventListener("mousedown", (e) => {
      isResizingSidebar = true;
      document.body.style.cursor = "ew-resize";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (isResizingSidebar) {
        const newWidth = e.clientX;
        if (newWidth >= 150 && newWidth <= 400) {
          sidebar.style.width = newWidth + "px";
        }
      }
    });

    document.addEventListener("mouseup", () => {
      if (isResizingSidebar) {
        isResizingSidebar = false;
        document.body.style.cursor = "";
      }
    });

    sidebarCollapseBtn.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      sidebarCollapseBtn.textContent = sidebar.classList.contains("collapsed")
        ? "▶"
        : "◀";
    });

    // Animation controls resizer
    const animationControls = document.querySelector(".animation-controls");
    const animationResizer = document.getElementById("animationResizer");
    const animationCollapseBtn = document.getElementById(
      "animationCollapseBtn",
    );

    let isResizingAnimation = false;

    animationResizer.addEventListener("mousedown", (e) => {
      isResizingAnimation = true;
      document.body.style.cursor = "ns-resize";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (isResizingAnimation) {
        const rect = animationControls.getBoundingClientRect();
        const newHeight = rect.bottom - e.clientY;
        if (newHeight >= 100 && newHeight <= 600) {
          animationControls.style.height = newHeight + "px";
        }
      }
    });

    document.addEventListener("mouseup", () => {
      if (isResizingAnimation) {
        isResizingAnimation = false;
        document.body.style.cursor = "";
      }
    });

    animationCollapseBtn.addEventListener("click", () => {
      animationControls.classList.toggle("collapsed");
      animationCollapseBtn.textContent = animationControls.classList.contains(
        "collapsed",
      )
        ? "▲"
        : "▼";
    });
  }

  createEmptyFrame() {
    return { objects: [] };
  }

  initializeEventListeners() {
    // Keyboard events
    document.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        if (this.selectedObjects.length > 0) {
          e.preventDefault();
          this.deleteSelectedObjects();
        }
      } else if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        this.undo();
      } else if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        this.redo();
      } else if (e.ctrlKey && e.key === "c") {
        e.preventDefault();
        this.copySelectedObjects();
      } else if (e.ctrlKey && e.key === "v") {
        e.preventDefault();
        this.pasteObjects();
      } else if (e.ctrlKey && e.key === "d") {
        e.preventDefault();
        this.duplicateSelectedObjects();
      }
    });

    // Drawing events
    this.canvas.addEventListener("mousedown", (e) => this.startDrawing(e));
    this.canvas.addEventListener("mousemove", (e) => this.draw(e));
    this.canvas.addEventListener("mouseup", () => this.stopDrawing());
    this.canvas.addEventListener("mouseout", () => this.stopDrawing());
    this.canvas.addEventListener("dblclick", (e) => this.handleDoubleClick(e));
    this.canvas.addEventListener("contextmenu", (e) =>
      this.handleContextMenu(e),
    );

    // Touch events for mobile
    this.canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent("mousedown", {
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
      this.canvas.dispatchEvent(mouseEvent);
    });

    this.canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent("mousemove", {
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
      this.canvas.dispatchEvent(mouseEvent);
    });

    this.canvas.addEventListener("touchend", (e) => {
      e.preventDefault();
      const mouseEvent = new MouseEvent("mouseup", {});
      this.canvas.dispatchEvent(mouseEvent);
    });

    // Tool buttons
    document
      .getElementById("pencilBtn")
      .addEventListener("click", () => this.setTool("pencil"));
    document
      .getElementById("smartDrawBtn")
      .addEventListener("click", () => this.setTool("mouse"));
    document
      .getElementById("fillBtn")
      .addEventListener("click", () => this.setTool("fill"));
    document
      .getElementById("eraserBtn")
      .addEventListener("click", () => this.setTool("eraser"));
    document
      .getElementById("textBtn")
      .addEventListener("click", () => this.setTool("text"));
    document
      .getElementById("clearBtn")
      .addEventListener("click", () => this.clearFrame());

    // Color and brush
    document.getElementById("colorPicker").addEventListener("change", (e) => {
      this.color = e.target.value;
    });

    document.getElementById("brushSize").addEventListener("input", (e) => {
      this.brushSize = parseInt(e.target.value);
      document.getElementById("brushSizeLabel").textContent =
        this.brushSize + "px";
    });

    // Set initial brush size label
    document.getElementById("brushSizeLabel").textContent =
      this.brushSize + "px";

    // Playback controls
    document.getElementById("playBtn").addEventListener("click", () => {
      if (this.isPlaying) {
        this.stop();
      } else {
        this.play();
      }
    });
    document
      .getElementById("stopBtn")
      .addEventListener("click", () => this.stop());
    document.getElementById("fpsInput").addEventListener("change", (e) => {
      this.fps = parseInt(e.target.value);
      if (this.isPlaying) {
        this.stop();
        this.play();
      }
    });

    // Frame controls
    document
      .getElementById("addFrameBtn")
      .addEventListener("click", () => this.addFrame());
    document
      .getElementById("deleteFrameBtn")
      .addEventListener("click", () => this.deleteFrame());
    document
      .getElementById("duplicateFrameBtn")
      .addEventListener("click", () => this.duplicateFrame());
    document.getElementById("onionSkin").addEventListener("change", (e) => {
      this.onionSkinEnabled = e.target.checked;
      this.render();
    });

    document
      .getElementById("smartDrawToggle")
      .addEventListener("change", (e) => {
        this.smartDrawEnabled = e.target.checked;
      });

    // Background controls
    document
      .getElementById("backgroundColorPicker")
      .addEventListener("change", (e) => {
        this.backgroundColor = e.target.value;
        this.render();
      });

    document
      .getElementById("uploadBackgroundBtn")
      .addEventListener("click", () => {
        document.getElementById("backgroundUpload").click();
      });

    document
      .getElementById("backgroundUpload")
      .addEventListener("change", (e) => this.uploadBackground(e));

    document
      .getElementById("clearBackgroundBtn")
      .addEventListener("click", () => {
        this.backgroundImage = null;
        this.render();
      });

    // File controls
    document
      .getElementById("cloudSaveBtn")
      .addEventListener("click", () => this.handleSave());
    document
      .getElementById("cloudLoadBtn")
      .addEventListener("click", () => this.authManager.showProjectDialog());
    document
      .getElementById("loadBtn")
      .addEventListener("click", () => {
        document.getElementById("imageUpload").click();
      });
    document
      .getElementById("uploadAnimationBtn")
      .addEventListener("click", () => {
        document.getElementById("animationUpload").click();
      });
    document
      .getElementById("animationUpload")
      .addEventListener("change", (e) => this.uploadAnimation(e));
    document
      .getElementById("exportBtn")
      .addEventListener("click", () => this.exportGIF());

    // Insert controls
    document.getElementById("uploadImageBtn").addEventListener("click", () => {
      document.getElementById("imageUpload").click();
    });

    document
      .getElementById("imageUpload")
      .addEventListener("change", (e) => this.uploadImage(e));
    document
      .getElementById("circleBtn")
      .addEventListener("click", () => this.insertShape("circle"));
    document
      .getElementById("squareBtn")
      .addEventListener("click", () => this.insertShape("square"));
    document
      .getElementById("triangleBtn")
      .addEventListener("click", () => this.insertShape("triangle"));
    document
      .getElementById("lineBtn")
      .addEventListener("click", () => this.insertLine());

    // Group/Ungroup controls
    document
      .getElementById("groupBtn")
      .addEventListener("click", () => this.groupSelectedObjects());
    document
      .getElementById("ungroupBtn")
      .addEventListener("click", () => this.ungroupSelectedObjects());
    document
      .getElementById("deleteSelectedBtn")
      .addEventListener("click", () => this.deleteSelectedObjects());

    // Rotation controls
    document.getElementById("rotationInput").addEventListener("input", (e) => {
      const angle = parseInt(e.target.value);
      document.getElementById("rotationValue").textContent = angle + "°";
      this.applyRotation(angle);
    });

    // Resize controls
    document.getElementById("shapeWidth").addEventListener("input", (e) => {
      this.shapeWidth = parseInt(e.target.value);
    });

    document.getElementById("shapeHeight").addEventListener("input", (e) => {
      this.shapeHeight = parseInt(e.target.value);
    });

    document.getElementById("applyResize").addEventListener("click", () => {
      if (this.selectedShape) {
        this.drawShape(this.selectedShape, this.shapeWidth, this.shapeHeight);
        this.saveCurrentFrame();
      }
    });

    // Undo/Redo buttons
    document
      .getElementById("undoBtn")
      .addEventListener("click", () => this.undo());
    document
      .getElementById("redoBtn")
      .addEventListener("click", () => this.redo());

    // Preview button
    document
      .getElementById("previewBtn")
      .addEventListener("click", () => this.openPreview());

    // Logout and Projects buttons
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await this.authManager.logout();
    });

    document.getElementById("projectsBtn").addEventListener("click", () => {
      window.location.href = "projects.html";
    });

    // Clipboard controls
    document
      .getElementById("copyBtn")
      .addEventListener("click", () => this.copySelectedObjects());
    document
      .getElementById("pasteBtn")
      .addEventListener("click", () => this.pasteObjects());
    document
      .getElementById("duplicateBtn")
      .addEventListener("click", () => this.duplicateSelectedObjects());
    document
      .getElementById("renameBtn")
      .addEventListener("click", () => this.renameSelectedObject());
  }

  setTool(tool) {
    this.tool = tool;
    document
      .querySelectorAll(".tool-btn")
      .forEach((btn) => btn.classList.remove("active"));

    // Remove all cursor classes
    this.canvas.classList.remove(
      "cursor-pencil",
      "cursor-mouse",
      "cursor-fill",
      "cursor-eraser",
      "cursor-text",
    );

    if (tool === "pencil") {
      document.getElementById("pencilBtn").classList.add("active");
      this.canvas.classList.add("cursor-pencil");
    } else if (tool === "mouse") {
      document.getElementById("smartDrawBtn").classList.add("active");
      this.canvas.classList.add("cursor-mouse");
    } else if (tool === "fill") {
      document.getElementById("fillBtn").classList.add("active");
      this.canvas.classList.add("cursor-fill");
    } else if (tool === "eraser") {
      document.getElementById("eraserBtn").classList.add("active");
      this.canvas.classList.add("cursor-eraser");
    } else if (tool === "text") {
      document.getElementById("textBtn").classList.add("active");
      this.canvas.classList.add("cursor-text");
    }
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();

    // Calculate position relative to canvas, accounting for scaling
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    return { x, y };
  }

  handleDoubleClick(e) {
    const pos = this.getMousePos(e);

    // Check if double-clicking on a text object
    const clickedObject = this.getObjectAtPoint(pos.x, pos.y);
    if (clickedObject && clickedObject.type === "text") {
      this.editTextObject(clickedObject);
    }
  }

  handleContextMenu(e) {
    e.preventDefault();

    const pos = this.getMousePos(e);
    const clickedObject = this.getObjectAtPoint(pos.x, pos.y);

    if (!clickedObject) return;

    // Remove any existing context menu
    const existingMenu = document.querySelector(".context-menu");
    if (existingMenu) {
      existingMenu.remove();
    }

    // Create context menu
    const menu = document.createElement("div");
    menu.className = "context-menu";
    menu.style.cssText = `
      position: fixed;
      left: ${e.clientX}px;
      top: ${e.clientY}px;
      background: #2d2d2d;
      border: 1px solid #555;
      border-radius: 4px;
      padding: 8px 0;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      z-index: 10000;
      min-width: 200px;
    `;

    // Color option
    const colorOption = document.createElement("div");
    colorOption.className = "context-menu-item";
    colorOption.style.cssText =
      "padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 10px;";
    colorOption.innerHTML = "<span>Change Color:</span>";

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = clickedObject.color || "#000000";
    colorInput.style.cssText = "cursor: pointer; border: none;";
    colorInput.addEventListener("click", (evt) => evt.stopPropagation());
    colorInput.addEventListener("change", (evt) => {
      clickedObject.color = evt.target.value;
      this.saveCurrentFrame();
      this.render();
    });

    colorOption.appendChild(colorInput);
    menu.appendChild(colorOption);

    // Border radius option (only for applicable shapes)
    if (["square", "circle", "triangle"].includes(clickedObject.type)) {
      const radiusOption = document.createElement("div");
      radiusOption.className = "context-menu-item";
      radiusOption.style.cssText = "padding: 8px 12px; cursor: pointer;";
      radiusOption.innerHTML =
        '<span style="display: block; margin-bottom: 5px;">Border Radius:</span>';

      const radiusContainer = document.createElement("div");
      radiusContainer.style.cssText =
        "display: flex; align-items: center; gap: 8px;";

      const radiusSlider = document.createElement("input");
      radiusSlider.type = "range";
      radiusSlider.min = "0";
      radiusSlider.max = "50";
      radiusSlider.value = clickedObject.borderRadius || 0;
      radiusSlider.style.cssText = "flex: 1; cursor: pointer;";

      const radiusValue = document.createElement("span");
      radiusValue.textContent = (clickedObject.borderRadius || 0) + "px";
      radiusValue.style.cssText =
        "color: #aaa; font-size: 12px; min-width: 35px;";

      radiusSlider.addEventListener("input", (evt) => {
        const value = parseInt(evt.target.value);
        clickedObject.borderRadius = value;
        radiusValue.textContent = value + "px";
        this.render();
      });

      radiusSlider.addEventListener("change", () => {
        this.saveCurrentFrame();
      });

      radiusContainer.appendChild(radiusSlider);
      radiusContainer.appendChild(radiusValue);
      radiusOption.appendChild(radiusContainer);
      menu.appendChild(radiusOption);
    }

    // Close menu when clicking outside
    const closeMenu = (evt) => {
      if (!menu.contains(evt.target)) {
        menu.remove();
        document.removeEventListener("mousedown", closeMenu);
      }
    };

    setTimeout(() => {
      document.addEventListener("mousedown", closeMenu);
    }, 0);

    document.body.appendChild(menu);
  }

  editTextObject(textObj) {
    // Create modal for editing text
    const modal = document.createElement("div");
    modal.style.cssText =
      "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000;";

    const dialog = document.createElement("div");
    dialog.style.cssText =
      "background: #2d2d2d; padding: 20px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); min-width: 400px;";

    const title = document.createElement("h3");
    title.textContent = "Edit Text";
    title.style.cssText = "margin-bottom: 15px; color: #fff;";

    const textarea = document.createElement("textarea");
    textarea.value = textObj.text;
    textarea.style.cssText =
      "width: 100%; min-height: 100px; padding: 8px; background: #3d3d3d; color: #fff; border: 1px solid #555; border-radius: 4px; margin-bottom: 15px; font-size: 14px; font-family: inherit; resize: vertical;";

    // Font size control
    const fontSizeContainer = document.createElement("div");
    fontSizeContainer.style.cssText = "margin-bottom: 15px;";

    const fontSizeLabel = document.createElement("label");
    fontSizeLabel.style.cssText =
      "display: block; margin-bottom: 5px; color: #ccc;";
    fontSizeLabel.textContent = "Font Size: ";

    const fontSizeInput = document.createElement("input");
    fontSizeInput.type = "range";
    fontSizeInput.min = "10";
    fontSizeInput.max = "72";
    fontSizeInput.value = textObj.fontSize || 24;
    fontSizeInput.style.cssText = "width: 100%;";

    const fontSizeValue = document.createElement("span");
    fontSizeValue.style.cssText = "font-size: 12px; color: #aaa;";
    fontSizeValue.textContent = (textObj.fontSize || 24) + "px";

    fontSizeInput.addEventListener("input", (e) => {
      fontSizeValue.textContent = e.target.value + "px";
    });

    fontSizeLabel.appendChild(fontSizeInput);
    fontSizeContainer.appendChild(fontSizeLabel);
    fontSizeContainer.appendChild(fontSizeValue);

    // Font family control
    const fontFamilyContainer = document.createElement("div");
    fontFamilyContainer.style.cssText = "margin-bottom: 15px;";

    const fontFamilyLabel = document.createElement("label");
    fontFamilyLabel.style.cssText =
      "display: block; margin-bottom: 5px; color: #ccc;";
    fontFamilyLabel.textContent = "Font Family:";

    const fontFamilySelect = document.createElement("select");
    fontFamilySelect.style.cssText =
      "width: 100%; padding: 6px; background: #3d3d3d; color: #fff; border: 1px solid #555; border-radius: 4px;";

    const fonts = [
      "Arial",
      "Times New Roman",
      "Courier New",
      "Comic Sans MS",
      "Impact",
      "Verdana",
      "Georgia",
      "Trebuchet MS",
    ];
    fonts.forEach((font) => {
      const option = document.createElement("option");
      option.value = font;
      option.textContent = font;
      if (font === (textObj.fontFamily || "Arial")) {
        option.selected = true;
      }
      fontFamilySelect.appendChild(option);
    });

    fontFamilyContainer.appendChild(fontFamilyLabel);
    fontFamilyContainer.appendChild(fontFamilySelect);

    // Underline control
    const underlineContainer = document.createElement("div");
    underlineContainer.style.cssText = "margin-bottom: 15px;";

    const underlineLabel = document.createElement("label");
    underlineLabel.style.cssText =
      "display: flex; align-items: center; gap: 8px; color: #ccc; cursor: pointer;";

    const underlineCheckbox = document.createElement("input");
    underlineCheckbox.type = "checkbox";
    underlineCheckbox.checked = textObj.underline || false;
    underlineCheckbox.style.cssText = "cursor: pointer;";

    const underlineText = document.createElement("span");
    underlineText.textContent = "Underline";

    underlineLabel.appendChild(underlineCheckbox);
    underlineLabel.appendChild(underlineText);
    underlineContainer.appendChild(underlineLabel);

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText =
      "display: flex; gap: 10px; justify-content: flex-end;";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText =
      "padding: 8px 16px; background: #3d3d3d; color: #fff; border: none; border-radius: 4px; cursor: pointer;";

    const okBtn = document.createElement("button");
    okBtn.textContent = "OK";
    okBtn.style.cssText =
      "padding: 8px 16px; background: #0078d4; color: #fff; border: none; border-radius: 4px; cursor: pointer;";

    const closeModal = () => {
      document.body.removeChild(modal);
    };

    const applyEdit = () => {
      const newText = textarea.value.trim();
      if (newText !== "") {
        textObj.text = newText;
        textObj.fontSize = parseInt(fontSizeInput.value);
        textObj.fontFamily = fontFamilySelect.value;
        textObj.underline = underlineCheckbox.checked;
        textObj.name = "Text: " + newText.substring(0, 20);
        this.saveCurrentFrame();
        this.render();
      }
      closeModal();
    };

    cancelBtn.addEventListener("click", closeModal);
    okBtn.addEventListener("click", applyEdit);
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal();
      }
    });

    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(okBtn);
    dialog.appendChild(title);
    dialog.appendChild(textarea);
    dialog.appendChild(fontSizeContainer);
    dialog.appendChild(fontFamilyContainer);
    dialog.appendChild(underlineContainer);
    dialog.appendChild(buttonContainer);
    modal.appendChild(dialog);
    document.body.appendChild(modal);

    textarea.focus();
    textarea.select();
  }

  startDrawing(e) {
    const pos = this.getMousePos(e);

    if (this.tool === "fill") {
      this.floodFill(Math.floor(pos.x), Math.floor(pos.y));
      this.saveCurrentFrame();
      return;
    }

    if (this.tool === "text") {
      // Start creating a text box - user must drag
      this.isDrawing = true;
      this.textBoxStart = { x: pos.x, y: pos.y };
      this.tempTextBox = {
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
      };
      return;
    }

    if (this.tool === "mouse") {
      // Check if clicking on rotation handle
      if (
        this.getRotationHandle(pos.x, pos.y) &&
        this.selectedObjects.length === 1
      ) {
        this.isRotating = true;
        this.dragStartX = pos.x;
        this.dragStartY = pos.y;
        return;
      }

      // Check if clicking on resize handle
      const handle = this.getResizeHandle(pos.x, pos.y);
      if (handle && this.selectedObjects.length === 1) {
        this.isResizing = true;
        this.resizeHandle = handle;
        this.dragStartX = pos.x;
        this.dragStartY = pos.y;
        return;
      }

      // Check if clicking on object
      const clickedObject = this.getObjectAtPoint(pos.x, pos.y);
      if (clickedObject) {
        if (!e.shiftKey) {
          this.selectedObjects = [clickedObject];
        } else {
          const index = this.selectedObjects.indexOf(clickedObject);
          if (index === -1) {
            this.selectedObjects.push(clickedObject);
          } else {
            this.selectedObjects.splice(index, 1);
          }
        }
        this.isDragging = true;
        this.dragStartX = pos.x;
        this.dragStartY = pos.y;
        this.render();
        return;
      }

      // Start selection box
      this.isSelecting = true;
      this.selectionBox = {
        startX: pos.x,
        startY: pos.y,
        endX: pos.x,
        endY: pos.y,
      };
      this.selectedObjects = [];
      this.render();
      return;
    }

    if (this.tool === "eraser") {
      this.isDrawing = true;
      const clickedObject = this.getObjectAtPoint(pos.x, pos.y);
      if (clickedObject) {
        this.deleteObject(clickedObject);
        this.render();
      }
      return;
    }

    this.isDrawing = true;
    this.lastX = pos.x;
    this.lastY = pos.y;
    this.drawPoints = [{ x: pos.x, y: pos.y }];
    this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
  }

  draw(e) {
    const pos = this.getMousePos(e);

    if (this.tool === "text" && this.isDrawing) {
      // Update text box size
      this.tempTextBox.width = pos.x - this.tempTextBox.x;
      this.tempTextBox.height = pos.y - this.tempTextBox.y;
      this.render();
      return;
    }

    if (this.tool === "eraser" && this.isDrawing) {
      const clickedObject = this.getObjectAtPoint(pos.x, pos.y);
      if (clickedObject) {
        this.deleteObject(clickedObject);
        this.render();
      }
      return;
    }

    if (this.tool === "mouse") {
      if (this.isRotating && this.selectedObjects.length === 1) {
        const obj = this.selectedObjects[0];
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;

        const angle =
          (Math.atan2(pos.y - centerY, pos.x - centerX) * 180) / Math.PI;
        obj.rotation = angle + 90;

        document.getElementById("rotationInput").value = Math.round(
          obj.rotation,
        );
        this.render();
        return;
      }

      if (this.isResizing && this.selectedObjects.length === 1) {
        const obj = this.selectedObjects[0];
        const dx = pos.x - this.dragStartX;
        const dy = pos.y - this.dragStartY;

        // Special handling for line objects
        if (obj.type === "line") {
          if (this.resizeHandle === "se" || this.resizeHandle === "e") {
            // Move end point
            obj.endX += dx;
            obj.endY += dy;
          } else if (this.resizeHandle === "nw" || this.resizeHandle === "w") {
            // Move start point
            obj.startX += dx;
            obj.startY += dy;
          }

          // Recalculate bounding box for line
          const minX = Math.min(obj.startX, obj.endX);
          const maxX = Math.max(obj.startX, obj.endX);
          const minY = Math.min(obj.startY, obj.endY);
          const maxY = Math.max(obj.startY, obj.endY);

          obj.x = minX;
          obj.y = minY;
          obj.width = maxX - minX;
          obj.height = maxY - minY;
        } else {
          // Normal resize mode for other shapes
          if (this.resizeHandle === "se") {
            obj.width += dx;
            obj.height += dy;
          } else if (this.resizeHandle === "sw") {
            obj.x += dx;
            obj.width -= dx;
            obj.height += dy;
          } else if (this.resizeHandle === "ne") {
            obj.y += dy;
            obj.width += dx;
            obj.height -= dy;
          } else if (this.resizeHandle === "nw") {
            obj.x += dx;
            obj.y += dy;
            obj.width -= dx;
            obj.height -= dy;
          } else if (this.resizeHandle === "n") {
            obj.y += dy;
            obj.height -= dy;
          } else if (this.resizeHandle === "s") {
            obj.height += dy;
          } else if (this.resizeHandle === "e") {
            obj.width += dx;
          } else if (this.resizeHandle === "w") {
            obj.x += dx;
            obj.width -= dx;
          }

          // Normalize negative dimensions (flip the shape)
          if (obj.width < 0) {
            obj.x += obj.width;
            obj.width = Math.abs(obj.width);
            if (this.resizeHandle === "se") this.resizeHandle = "sw";
            else if (this.resizeHandle === "sw") this.resizeHandle = "se";
            else if (this.resizeHandle === "ne") this.resizeHandle = "nw";
            else if (this.resizeHandle === "nw") this.resizeHandle = "ne";
            else if (this.resizeHandle === "e") this.resizeHandle = "w";
            else if (this.resizeHandle === "w") this.resizeHandle = "e";
          }

          if (obj.height < 0) {
            obj.y += obj.height;
            obj.height = Math.abs(obj.height);
            if (this.resizeHandle === "se") this.resizeHandle = "ne";
            else if (this.resizeHandle === "sw") this.resizeHandle = "nw";
            else if (this.resizeHandle === "ne") this.resizeHandle = "se";
            else if (this.resizeHandle === "nw") this.resizeHandle = "sw";
            else if (this.resizeHandle === "s") this.resizeHandle = "n";
            else if (this.resizeHandle === "n") this.resizeHandle = "s";
          }
        }

        this.dragStartX = pos.x;
        this.dragStartY = pos.y;
        this.render();
        return;
      }

      if (this.isDragging) {
        const dx = pos.x - this.dragStartX;
        const dy = pos.y - this.dragStartY;

        for (const obj of this.selectedObjects) {
          obj.x += dx;
          obj.y += dy;

          // Update line endpoints if it's a line object
          if (obj.type === "line") {
            obj.startX += dx;
            obj.startY += dy;
            obj.endX += dx;
            obj.endY += dy;
          }
        }

        this.dragStartX = pos.x;
        this.dragStartY = pos.y;
        this.render();
        return;
      }

      if (this.isSelecting) {
        this.selectionBox.endX = pos.x;
        this.selectionBox.endY = pos.y;
        this.render();
        return;
      }

      return;
    }

    if (!this.isDrawing) return;

    this.drawPoints.push({ x: pos.x, y: pos.y });

    // Draw temporary preview
    this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
    this.tempCtx.strokeStyle = this.color;
    this.tempCtx.lineWidth = this.brushSize;
    this.tempCtx.lineCap = "round";
    this.tempCtx.lineJoin = "round";
    this.tempCtx.globalCompositeOperation =
      this.tool === "eraser" ? "destination-out" : "source-over";

    this.tempCtx.beginPath();
    this.tempCtx.moveTo(this.drawPoints[0].x, this.drawPoints[0].y);
    for (let i = 1; i < this.drawPoints.length; i++) {
      this.tempCtx.lineTo(this.drawPoints[i].x, this.drawPoints[i].y);
    }
    this.tempCtx.stroke();

    this.render();
  }

  stopDrawing() {
    if (this.tool === "eraser" && this.isDrawing) {
      this.isDrawing = false;
      this.saveCurrentFrame();
      return;
    }

    if (this.tool === "text" && this.isDrawing) {
      this.isDrawing = false;

      // Only create text box if user actually dragged
      const width = Math.abs(this.tempTextBox.width);
      const height = Math.abs(this.tempTextBox.height);

      if (width < 30 || height < 30) {
        // If box is too small, don't create it - user probably just clicked
        this.tempTextBox = null;
        this.render();
        return;
      }

      // Normalize coordinates if dragged backwards
      const x =
        this.tempTextBox.width < 0
          ? this.tempTextBox.x + this.tempTextBox.width
          : this.tempTextBox.x;
      const y =
        this.tempTextBox.height < 0
          ? this.tempTextBox.y + this.tempTextBox.height
          : this.tempTextBox.y;

      const newTextObj = {
        type: "text",
        x: x,
        y: y,
        text: this.textContent || "Double-click to edit",
        fontSize: this.fontSize,
        fontFamily: this.fontFamily,
        underline: this.textUnderline,
        color: this.color,
        width: width,
        height: height,
        name:
          "Text: " +
          (this.textContent || "Double-click to edit").substring(0, 20),
      };

      this.addObject(newTextObj);
      this.tempTextBox = null;
      this.saveCurrentFrame();
      this.render();

      // Automatically open edit dialog for new text box
      setTimeout(() => {
        this.editTextObject(newTextObj);
      }, 100);

      return;
    }

    if (this.tool === "mouse") {
      if (this.isRotating) {
        this.isRotating = false;
        this.saveCurrentFrame();
        return;
      }

      if (this.isResizing) {
        this.isResizing = false;
        this.resizeHandle = null;
        this.saveCurrentFrame();
        return;
      }

      if (this.isDragging) {
        this.isDragging = false;
        this.saveCurrentFrame();
        return;
      }

      if (this.isSelecting) {
        this.isSelecting = false;
        // Select objects in box
        const box = this.selectionBox;
        const minX = Math.min(box.startX, box.endX);
        const maxX = Math.max(box.startX, box.endX);
        const minY = Math.min(box.startY, box.endY);
        const maxY = Math.max(box.startY, box.endY);

        this.selectedObjects = this.getCurrentFrameObjects().filter((obj) => {
          return (
            obj.x + obj.width > minX &&
            obj.x < maxX &&
            obj.y + obj.height > minY &&
            obj.y < maxY
          );
        });

        this.selectionBox = null;
        this.render();
        return;
      }

      return;
    }

    if (this.isDrawing) {
      this.isDrawing = false;

      if (this.tool === "pencil" && this.drawPoints.length > 2) {
        let shapeToAdd;
        if (this.smartDrawEnabled) {
          shapeToAdd = this.recognizeShape();
        } else {
          // Just create a path without shape recognition
          shapeToAdd = {
            type: "path",
            points: [...this.drawPoints],
            color: this.color,
            lineWidth: this.brushSize,
            x: Math.min(...this.drawPoints.map((p) => p.x)),
            y: Math.min(...this.drawPoints.map((p) => p.y)),
            width:
              Math.max(...this.drawPoints.map((p) => p.x)) -
              Math.min(...this.drawPoints.map((p) => p.x)),
            height:
              Math.max(...this.drawPoints.map((p) => p.y)) -
              Math.min(...this.drawPoints.map((p) => p.y)),
          };
        }
        this.addObject(shapeToAdd);
      }

      this.drawPoints = [];
      this.tempCtx.clearRect(
        0,
        0,
        this.tempCanvas.width,
        this.tempCanvas.height,
      );
      this.saveCurrentFrame();
      this.render();
    }
  }

  recognizeShape() {
    if (this.drawPoints.length < 5) {
      // Return original path for very short strokes
      return {
        type: "path",
        points: [...this.drawPoints],
        color: this.color,
        lineWidth: this.brushSize,
        x: Math.min(...this.drawPoints.map((p) => p.x)),
        y: Math.min(...this.drawPoints.map((p) => p.y)),
        width:
          Math.max(...this.drawPoints.map((p) => p.x)) -
          Math.min(...this.drawPoints.map((p) => p.x)),
        height:
          Math.max(...this.drawPoints.map((p) => p.y)) -
          Math.min(...this.drawPoints.map((p) => p.y)),
      };
    }

    const firstPoint = this.drawPoints[0];
    const lastPoint = this.drawPoints[this.drawPoints.length - 1];

    // Check if it's a closed shape (circle)
    const distance = Math.sqrt(
      Math.pow(lastPoint.x - firstPoint.x, 2) +
        Math.pow(lastPoint.y - firstPoint.y, 2),
    );

    if (distance < 30 && this.drawPoints.length > 10) {
      // Likely a circle
      const centerX =
        this.drawPoints.reduce((sum, p) => sum + p.x, 0) /
        this.drawPoints.length;
      const centerY =
        this.drawPoints.reduce((sum, p) => sum + p.y, 0) /
        this.drawPoints.length;
      const radius =
        this.drawPoints.reduce((sum, p) => {
          return (
            sum +
            Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2))
          );
        }, 0) / this.drawPoints.length;

      return {
        type: "circle",
        x: centerX - radius,
        y: centerY - radius,
        width: radius * 2,
        height: radius * 2,
        color: this.color,
        lineWidth: this.brushSize,
      };
    } else {
      // Check if it's a straight line
      const isLine = this.isApproximatelyLine();

      if (isLine) {
        return {
          type: "line",
          x: Math.min(firstPoint.x, lastPoint.x),
          y: Math.min(firstPoint.y, lastPoint.y),
          width: Math.abs(lastPoint.x - firstPoint.x),
          height: Math.abs(lastPoint.y - firstPoint.y),
          startX: firstPoint.x,
          startY: firstPoint.y,
          endX: lastPoint.x,
          endY: lastPoint.y,
          color: this.color,
          lineWidth: this.brushSize,
        };
      }
    }

    // If not recognized as circle or line, return original path
    return {
      type: "path",
      points: [...this.drawPoints],
      color: this.color,
      lineWidth: this.brushSize,
      x: Math.min(...this.drawPoints.map((p) => p.x)),
      y: Math.min(...this.drawPoints.map((p) => p.y)),
      width:
        Math.max(...this.drawPoints.map((p) => p.x)) -
        Math.min(...this.drawPoints.map((p) => p.x)),
      height:
        Math.max(...this.drawPoints.map((p) => p.y)) -
        Math.min(...this.drawPoints.map((p) => p.y)),
    };
  }

  isApproximatelyLine() {
    if (this.drawPoints.length < 5) return false;

    const firstPoint = this.drawPoints[0];
    const lastPoint = this.drawPoints[this.drawPoints.length - 1];

    const dx = lastPoint.x - firstPoint.x;
    const dy = lastPoint.y - firstPoint.y;
    const lineLength = Math.sqrt(dx * dx + dy * dy);

    if (lineLength < 20) return false;

    let maxDeviation = 0;
    for (const point of this.drawPoints) {
      const deviation = Math.abs(
        (dy * point.x -
          dx * point.y +
          lastPoint.x * firstPoint.y -
          lastPoint.y * firstPoint.x) /
          lineLength,
      );
      maxDeviation = Math.max(maxDeviation, deviation);
    }

    return maxDeviation < 15;
  }

  floodFill(startX, startY) {
    const imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    const pixels = imageData.data;

    const r = parseInt(this.color.substr(1, 2), 16);
    const g = parseInt(this.color.substr(3, 2), 16);
    const b = parseInt(this.color.substr(5, 2), 16);

    const getPixelIndex = (x, y) => (y * this.canvas.width + x) * 4;

    const startIndex = getPixelIndex(startX, startY);
    const targetR = pixels[startIndex];
    const targetG = pixels[startIndex + 1];
    const targetB = pixels[startIndex + 2];
    const targetA = pixels[startIndex + 3];

    if (targetR === r && targetG === g && targetB === b) return;

    const pixelsToFill = [[startX, startY]];
    const visited = new Set();

    while (pixelsToFill.length > 0) {
      const [x, y] = pixelsToFill.pop();
      const key = `${x},${y}`;

      if (visited.has(key)) continue;
      if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height)
        continue;

      visited.add(key);

      const index = getPixelIndex(x, y);
      const currentR = pixels[index];
      const currentG = pixels[index + 1];
      const currentB = pixels[index + 2];
      const currentA = pixels[index + 3];

      if (
        currentR !== targetR ||
        currentG !== targetG ||
        currentB !== targetB ||
        currentA !== targetA
      ) {
        continue;
      }

      pixels[index] = r;
      pixels[index + 1] = g;
      pixels[index + 2] = b;
      pixels[index + 3] = 255;

      pixelsToFill.push([x + 1, y]);
      pixelsToFill.push([x - 1, y]);
      pixelsToFill.push([x, y + 1]);
      pixelsToFill.push([x, y - 1]);
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  clearFrame() {
    this.frames[this.currentFrameIndex].objects = [];
    this.selectedObjects = [];
    this.render();
    this.saveCurrentFrame();
  }

  uploadImage(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const width = Math.min(img.width, 300);
        const height = (img.height / img.width) * width;

        const imageObj = {
          type: "image",
          x: (this.canvas.width - width) / 2,
          y: (this.canvas.height - height) / 2,
          width: width,
          height: height,
          src: event.target.result,
          rotation: 0,
          name: "Image " + (this.getCurrentFrameObjects().length + 1),
        };

        this.addObject(imageObj);

        // Automatically select the image so user can resize/rotate it
        this.selectedObjects = [imageObj];
        this.setTool("mouse");

        this.saveCurrentFrame();
        this.render();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  uploadBackground(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        this.backgroundImage = img;
        this.render();
        this.updateTimeline();
      };
      img.onerror = () => {
        notify.error("Error loading background image");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  insertShape(shape) {
    this.selectedShape = shape;
    this.drawShape(shape, this.shapeWidth, this.shapeHeight);
    this.saveCurrentFrame();
  }

  insertLine() {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const lineLength = 100;

    const lineObj = {
      type: "line",
      startX: centerX - lineLength / 2,
      startY: centerY,
      endX: centerX + lineLength / 2,
      endY: centerY,
      x: centerX - lineLength / 2,
      y: centerY - 10,
      width: lineLength,
      height: 20,
      color: this.color,
      lineWidth: this.brushSize,
      rotation: 0,
      name: "Line " + (this.getCurrentFrameObjects().length + 1),
    };

    this.addObject(lineObj);
    this.selectedObjects = [lineObj];
    this.setTool("mouse");
    this.saveCurrentFrame();
    this.render();
  }

  drawShape(shape, width, height) {
    const x = (this.canvas.width - width) / 2;
    const y = (this.canvas.height - height) / 2;

    this.addObject({
      type: shape,
      x: x,
      y: y,
      width: width,
      height: height,
      color: this.color,
      lineWidth: 2,
    });

    this.render();
  }

  addObject(obj) {
    if (obj.rotation === undefined) {
      obj.rotation = 0;
    }
    if (!obj.name) {
      obj.name =
        obj.type.charAt(0).toUpperCase() +
        obj.type.slice(1) +
        " " +
        (this.getCurrentFrameObjects().length + 1);
    }
    // Pre-load image if it's an image object
    if (obj.type === "image" && obj.src && !obj.imageElement) {
      const img = new Image();
      img.onload = () => {
        obj.imageElement = img;
        this.render();
      };
      img.src = obj.src;
    }
    this.getCurrentFrameObjects().push(obj);
  }

  deleteObject(obj) {
    const objects = this.getCurrentFrameObjects();
    const index = objects.indexOf(obj);
    if (index !== -1) {
      objects.splice(index, 1);
    }
  }

  getCurrentFrameObjects() {
    return this.frames[this.currentFrameIndex].objects;
  }

  getObjectAtPoint(x, y) {
    const objects = this.getCurrentFrameObjects();
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (
        x >= obj.x &&
        x <= obj.x + obj.width &&
        y >= obj.y &&
        y <= obj.y + obj.height
      ) {
        return obj;
      }
    }
    return null;
  }

  getResizeHandle(x, y) {
    if (this.selectedObjects.length !== 1) return null;

    const obj = this.selectedObjects[0];
    const handleSize = 8;
    const rotation = obj.rotation || 0;
    const centerX = obj.x + obj.width / 2;
    const centerY = obj.y + obj.height / 2;

    // Calculate rotated handle positions
    const rotatePoint = (px, py, cx, cy, angle) => {
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const dx = px - cx;
      const dy = py - cy;
      return {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos,
      };
    };

    // For line objects, only show handles at the endpoints
    if (obj.type === "line") {
      const startHandle = rotatePoint(
        obj.startX,
        obj.startY,
        centerX,
        centerY,
        rotation,
      );
      const endHandle = rotatePoint(
        obj.endX,
        obj.endY,
        centerX,
        centerY,
        rotation,
      );

      if (
        x >= startHandle.x - handleSize &&
        x <= startHandle.x + handleSize &&
        y >= startHandle.y - handleSize &&
        y <= startHandle.y + handleSize
      ) {
        return "nw"; // Start point
      }

      if (
        x >= endHandle.x - handleSize &&
        x <= endHandle.x + handleSize &&
        y >= endHandle.y - handleSize &&
        y <= endHandle.y + handleSize
      ) {
        return "se"; // End point
      }

      return null;
    }

    // Corner handles for other shapes
    const corners = {
      nw: { x: obj.x, y: obj.y },
      ne: { x: obj.x + obj.width, y: obj.y },
      sw: { x: obj.x, y: obj.y + obj.height },
      se: { x: obj.x + obj.width, y: obj.y + obj.height },
    };

    for (const [name, pos] of Object.entries(corners)) {
      const rotated = rotatePoint(pos.x, pos.y, centerX, centerY, rotation);
      if (
        x >= rotated.x - handleSize &&
        x <= rotated.x + handleSize &&
        y >= rotated.y - handleSize &&
        y <= rotated.y + handleSize
      ) {
        return name;
      }
    }

    // Edge handles
    const edges = {
      n: { x: obj.x + obj.width / 2, y: obj.y },
      s: { x: obj.x + obj.width / 2, y: obj.y + obj.height },
      e: { x: obj.x + obj.width, y: obj.y + obj.height / 2 },
      w: { x: obj.x, y: obj.y + obj.height / 2 },
    };

    for (const [name, pos] of Object.entries(edges)) {
      const rotated = rotatePoint(pos.x, pos.y, centerX, centerY, rotation);
      if (
        x >= rotated.x - handleSize &&
        x <= rotated.x + handleSize &&
        y >= rotated.y - handleSize &&
        y <= rotated.y + handleSize
      ) {
        return name;
      }
    }

    return null;
  }

  getRotationHandle(x, y) {
    if (this.selectedObjects.length !== 1) return null;

    const obj = this.selectedObjects[0];
    const handleSize = 8;
    const rotation = obj.rotation || 0;
    const centerX = obj.x + obj.width / 2;
    const centerY = obj.y + obj.height / 2;

    // Calculate rotated handle position
    const rotatePoint = (px, py, cx, cy, angle) => {
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const dx = px - cx;
      const dy = py - cy;
      return {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos,
      };
    };

    const rotateHandleOffset = rotatePoint(
      obj.x + obj.width / 2,
      obj.y - 20,
      centerX,
      centerY,
      rotation,
    );

    if (
      x >= rotateHandleOffset.x - handleSize &&
      x <= rotateHandleOffset.x + handleSize &&
      y >= rotateHandleOffset.y - handleSize &&
      y <= rotateHandleOffset.y + handleSize
    ) {
      return true;
    }

    return false;
  }

  groupSelectedObjects() {
    if (this.selectedObjects.length < 2) {
      notify.info("Select at least 2 objects to group");
      return;
    }

    const minX = Math.min(...this.selectedObjects.map((o) => o.x));
    const minY = Math.min(...this.selectedObjects.map((o) => o.y));
    const maxX = Math.max(...this.selectedObjects.map((o) => o.x + o.width));
    const maxY = Math.max(...this.selectedObjects.map((o) => o.y + o.height));

    // Convert children coordinates to relative positions within the group
    const children = this.selectedObjects.map((obj) => {
      const childCopy = JSON.parse(JSON.stringify(obj));
      childCopy.x = obj.x - minX;
      childCopy.y = obj.y - minY;
      return childCopy;
    });

    const group = {
      type: "group",
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      children: children,
      rotation: 0,
    };

    const objects = this.getCurrentFrameObjects();
    for (const obj of this.selectedObjects) {
      const index = objects.indexOf(obj);
      if (index !== -1) {
        objects.splice(index, 1);
      }
    }

    objects.push(group);
    this.selectedObjects = [group];
    this.saveCurrentFrame();
    this.render();
  }

  ungroupSelectedObjects() {
    if (
      this.selectedObjects.length !== 1 ||
      this.selectedObjects[0].type !== "group"
    ) {
      notify.info("Select a single group to ungroup");
      return;
    }

    const group = this.selectedObjects[0];
    const objects = this.getCurrentFrameObjects();
    const index = objects.indexOf(group);

    if (index !== -1) {
      // Convert children back to absolute coordinates
      const restoredChildren = group.children.map((child) => {
        const restored = JSON.parse(JSON.stringify(child));
        restored.x = child.x + group.x;
        restored.y = child.y + group.y;

        // Reload image if it's an image object
        if (restored.type === "image" && restored.src) {
          const img = new Image();
          img.onload = () => {
            restored.imageElement = img;
            this.render();
          };
          img.src = restored.src;
        }

        return restored;
      });

      objects.splice(index, 1);
      objects.push(...restoredChildren);
      this.selectedObjects = [...restoredChildren];
      this.saveCurrentFrame();
      this.render();
    }
  }

  deleteSelectedObjects() {
    const objects = this.getCurrentFrameObjects();
    for (const obj of this.selectedObjects) {
      const index = objects.indexOf(obj);
      if (index !== -1) {
        objects.splice(index, 1);
      }
    }
    this.selectedObjects = [];
    this.saveCurrentFrame();
    this.render();
  }

  applyRotation(angle) {
    if (this.selectedObjects.length === 0) return;

    for (const obj of this.selectedObjects) {
      obj.rotation = angle;
    }

    this.saveCurrentFrame();
    this.render();
  }

  copySelectedObjects() {
    if (this.selectedObjects.length === 0) {
      notify.info("No objects selected to copy");
      return;
    }
    this.clipboard = JSON.parse(JSON.stringify(this.selectedObjects));
    notify.info(`Copied ${this.clipboard.length} object(s)`);
  }

  pasteObjects() {
    if (this.clipboard.length === 0) {
      notify.info("Nothing to paste");
      return;
    }

    const objects = this.getCurrentFrameObjects();
    const pastedObjects = [];

    for (const obj of this.clipboard) {
      const newObj = JSON.parse(JSON.stringify(obj));
      newObj.x += 20;
      newObj.y += 20;
      newObj.name = (newObj.name || "Object") + " (Copy)";

      // Re-load images if needed
      if (newObj.type === "image" && newObj.src) {
        const img = new Image();
        img.onload = () => {
          newObj.imageElement = img;
          this.render();
        };
        img.src = newObj.src;
      }

      objects.push(newObj);
      pastedObjects.push(newObj);
    }

    this.selectedObjects = pastedObjects;
    this.saveCurrentFrame();
    this.render();
  }

  duplicateSelectedObjects() {
    if (this.selectedObjects.length === 0) {
      notify.info("No objects selected to duplicate");
      return;
    }

    this.clipboard = JSON.parse(JSON.stringify(this.selectedObjects));
    this.pasteObjects();
  }

  renameSelectedObject() {
    if (this.selectedObjects.length !== 1) {
      notify.info("Please select exactly one object to rename");
      return;
    }

    const obj = this.selectedObjects[0];

    // Create modal
    const modal = document.createElement("div");
    modal.style.cssText =
      "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000;";

    const dialog = document.createElement("div");
    dialog.style.cssText =
      "background: #2d2d2d; padding: 20px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); min-width: 300px;";

    const title = document.createElement("h3");
    title.textContent = "Rename Object";
    title.style.cssText = "margin-bottom: 15px; color: #fff;";

    const input = document.createElement("input");
    input.type = "text";
    input.value = obj.name || "";
    input.style.cssText =
      "width: 100%; padding: 8px; background: #3d3d3d; color: #fff; border: 1px solid #555; border-radius: 4px; margin-bottom: 15px; font-size: 14px;";

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText =
      "display: flex; gap: 10px; justify-content: flex-end;";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText =
      "padding: 8px 16px; background: #3d3d3d; color: #fff; border: none; border-radius: 4px; cursor: pointer;";

    const okBtn = document.createElement("button");
    okBtn.textContent = "OK";
    okBtn.style.cssText =
      "padding: 8px 16px; background: #0078d4; color: #fff; border: none; border-radius: 4px; cursor: pointer;";

    const closeModal = () => {
      document.body.removeChild(modal);
    };

    const applyRename = () => {
      const newName = input.value.trim();
      if (newName !== "") {
        obj.name = newName;
        this.render();
      }
      closeModal();
    };

    cancelBtn.addEventListener("click", closeModal);
    okBtn.addEventListener("click", applyRename);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        applyRename();
      } else if (e.key === "Escape") {
        closeModal();
      }
    });

    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(okBtn);
    dialog.appendChild(title);
    dialog.appendChild(input);
    dialog.appendChild(buttonContainer);
    modal.appendChild(dialog);
    document.body.appendChild(modal);

    input.focus();
    input.select();
  }

  saveCurrentFrame() {
    // If we're not at the end of history, remove everything after current position
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // Add to history
    this.history.push({
      frames: JSON.parse(JSON.stringify(this.frames)),
      currentFrameIndex: this.currentFrameIndex,
      selectedObjects: JSON.parse(JSON.stringify(this.selectedObjects)),
      backgroundColor: this.backgroundColor,
      backgroundImage: this.backgroundImage ? this.backgroundImage.src : null,
    });

    // Move index to the new state
    this.historyIndex = this.history.length - 1;

    // Trim history if it exceeds a certain limit (e.g., 50 states)
    if (this.history.length > 50) {
      this.history.shift();
      this.historyIndex--;
    }

    this.updateTimeline();
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreHistoryState(this.history[this.historyIndex]);
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreHistoryState(this.history[this.historyIndex]);
    }
  }

  restoreHistoryState(state) {
    this.frames = JSON.parse(JSON.stringify(state.frames));
    this.currentFrameIndex = state.currentFrameIndex;
    this.selectedObjects = JSON.parse(JSON.stringify(state.selectedObjects));
    this.backgroundColor = state.backgroundColor;

    // Restore background image
    if (state.backgroundImage) {
      const img = new Image();
      img.onload = () => {
        this.backgroundImage = img;
        this.render();
      };
      img.src = state.backgroundImage;
    } else {
      this.backgroundImage = null;
    }

    // Reload all images in frames and groups
    const reloadImages = (obj) => {
      if (obj.type === "image" && obj.src) {
        const img = new Image();
        img.onload = () => {
          obj.imageElement = img;
          this.render();
        };
        img.src = obj.src;
      } else if (obj.type === "group" && obj.children) {
        for (const child of obj.children) {
          reloadImages(child);
        }
      }
    };

    for (const frame of this.frames) {
      for (const obj of frame.objects) {
        reloadImages(obj);
      }
    }

    document.getElementById("backgroundColorPicker").value =
      this.backgroundColor;
    this.render();
    this.updateTimeline();
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw background
    if (this.backgroundImage) {
      this.ctx.drawImage(
        this.backgroundImage,
        0,
        0,
        this.canvas.width,
        this.canvas.height,
      );
    } else {
      this.ctx.fillStyle = this.backgroundColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Onion skin - show light silhouette of previous frame (only when not playing)
    if (
      this.onionSkinEnabled &&
      this.currentFrameIndex > 0 &&
      !this.isPlaying
    ) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.2;
      this.ctx.strokeStyle = "#888888";
      this.ctx.fillStyle = "rgba(200, 200, 200, 0.1)";
      this.renderFrame(this.frames[this.currentFrameIndex - 1]);
      this.ctx.restore();
    }

    // Current frame
    this.renderFrame(this.frames[this.currentFrameIndex]);

    // Draw temp canvas (for drawing preview)
    if (this.isDrawing && this.tool === "pencil") {
      this.ctx.drawImage(this.tempCanvas, 0, 0);
    }

    // Draw text box preview
    if (this.tool === "text" && this.isDrawing && this.tempTextBox) {
      this.ctx.strokeStyle = "#0078d4";
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this.ctx.strokeRect(
        this.tempTextBox.x,
        this.tempTextBox.y,
        this.tempTextBox.width,
        this.tempTextBox.height,
      );
      this.ctx.setLineDash([]);

      // Show preview text
      this.ctx.fillStyle = this.color;
      this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
      this.ctx.textBaseline = "top";
      const previewText = this.textContent || "Enter text...";
      this.ctx.fillText(
        previewText,
        this.tempTextBox.x + 5,
        this.tempTextBox.y + 5,
      );
    }

    // Draw selection box
    if (this.isSelecting && this.selectionBox) {
      const box = this.selectionBox;
      this.ctx.strokeStyle = "#0078d4";
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this.ctx.strokeRect(
        Math.min(box.startX, box.endX),
        Math.min(box.startY, box.endY),
        Math.abs(box.endX - box.startX),
        Math.abs(box.endY - box.startY),
      );
      this.ctx.setLineDash([]);
    }

    // Draw selection highlights and resize handles
    if (this.tool === "mouse" && this.selectedObjects.length > 0) {
      this.ctx.strokeStyle = "#0078d4";
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);

      for (const obj of this.selectedObjects) {
        const rotation = obj.rotation || 0;
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;

        this.ctx.save();
        this.ctx.translate(centerX, centerY);
        this.ctx.rotate((rotation * Math.PI) / 180);
        this.ctx.translate(-centerX, -centerY);
        this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
        this.ctx.restore();
      }

      this.ctx.setLineDash([]);

      // Draw resize handles for single selection
      if (this.selectedObjects.length === 1) {
        const obj = this.selectedObjects[0];
        const handleSize = 8;
        this.ctx.fillStyle = "#0078d4";

        const rotation = obj.rotation || 0;
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;

        const rotatePoint = (px, py, cx, cy, angle) => {
          const rad = (angle * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const dx = px - cx;
          const dy = py - cy;
          return {
            x: cx + dx * cos - dy * sin,
            y: cy + dx * sin + dy * cos,
          };
        };

        // For line objects, only show handles at endpoints
        if (obj.type === "line") {
          const startHandle = rotatePoint(
            obj.startX,
            obj.startY,
            centerX,
            centerY,
            rotation,
          );
          const endHandle = rotatePoint(
            obj.endX,
            obj.endY,
            centerX,
            centerY,
            rotation,
          );

          this.ctx.fillRect(
            startHandle.x - handleSize / 2,
            startHandle.y - handleSize / 2,
            handleSize,
            handleSize,
          );
          this.ctx.fillRect(
            endHandle.x - handleSize / 2,
            endHandle.y - handleSize / 2,
            handleSize,
            handleSize,
          );
        } else {
          // Corner handles for other shapes
          const corners = [
            { x: obj.x, y: obj.y },
            { x: obj.x + obj.width, y: obj.y },
            { x: obj.x, y: obj.y + obj.height },
            { x: obj.x + obj.width, y: obj.y + obj.height },
          ];

          const rotatedCorners = corners.map((corner) =>
            rotatePoint(corner.x, corner.y, centerX, centerY, rotation),
          );

          for (const handle of rotatedCorners) {
            this.ctx.fillRect(
              handle.x - handleSize / 2,
              handle.y - handleSize / 2,
              handleSize,
              handleSize,
            );
          }

          // Edge handles
          const edges = [
            { x: obj.x + obj.width / 2, y: obj.y },
            { x: obj.x + obj.width / 2, y: obj.y + obj.height },
            { x: obj.x + obj.width, y: obj.y + obj.height / 2 },
            { x: obj.x, y: obj.y + obj.height / 2 },
          ];

          const rotatedEdges = edges.map((edge) =>
            rotatePoint(edge.x, edge.y, centerX, centerY, rotation),
          );

          for (const handle of rotatedEdges) {
            this.ctx.fillRect(
              handle.x - handleSize / 2,
              handle.y - handleSize / 2,
              handleSize,
              handleSize,
            );
          }
        }

        // Draw rotation handle
        const rotateHandleOffset = rotatePoint(
          obj.x + obj.width / 2,
          obj.y - 20,
          centerX,
          centerY,
          rotation,
        );

        this.ctx.beginPath();
        this.ctx.arc(
          rotateHandleOffset.x,
          rotateHandleOffset.y,
          handleSize / 2,
          0,
          Math.PI * 2,
        );
        this.ctx.fill();

        // Draw line connecting rotation handle
        this.ctx.strokeStyle = "#0078d4";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(rotateHandleOffset.x, rotateHandleOffset.y);

        const topCenterRotated = rotatePoint(
          obj.x + obj.width / 2,
          obj.y,
          centerX,
          centerY,
          rotation,
        );

        this.ctx.lineTo(topCenterRotated.x, topCenterRotated.y);
        this.ctx.stroke();
      }
    }
  }

  renderFrame(frame, ctx = this.ctx) {
    for (const obj of frame.objects) {
      this.renderObject(obj, ctx);
    }
  }

  renderObject(obj, ctx = this.ctx, groupOffsetX = 0, groupOffsetY = 0) {
    const rotation = obj.rotation || 0;
    const centerX = obj.x + groupOffsetX + obj.width / 2;
    const centerY = obj.y + groupOffsetY + obj.height / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);

    if (obj.type === "circle") {
      const currentStroke = ctx.strokeStyle;
      const currentFill = ctx.fillStyle;
      ctx.strokeStyle = currentStroke === "#888888" ? currentStroke : obj.color;
      ctx.fillStyle = currentFill.includes("rgba") ? currentFill : obj.color;
      ctx.lineWidth = obj.lineWidth;
      ctx.beginPath();
      ctx.arc(
        obj.x + groupOffsetX + obj.width / 2,
        obj.y + groupOffsetY + obj.height / 2,
        obj.width / 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
    } else if (obj.type === "square") {
      const currentStroke = ctx.strokeStyle;
      const currentFill = ctx.fillStyle;
      const useObjColor =
        currentStroke !== "#888888" && !currentFill.includes("rgba");

      ctx.strokeStyle = useObjColor ? obj.color : currentStroke;
      ctx.fillStyle = useObjColor ? obj.color : currentFill;
      ctx.lineWidth = obj.lineWidth || 2;

      const x = obj.x + groupOffsetX;
      const y = obj.y + groupOffsetY;
      const radius = obj.borderRadius || 0;

      if (radius > 0) {
        // Draw rounded rectangle
        const maxRadius = Math.min(radius, obj.width / 2, obj.height / 2);
        ctx.beginPath();
        ctx.moveTo(x + maxRadius, y);
        ctx.lineTo(x + obj.width - maxRadius, y);
        ctx.quadraticCurveTo(x + obj.width, y, x + obj.width, y + maxRadius);
        ctx.lineTo(x + obj.width, y + obj.height - maxRadius);
        ctx.quadraticCurveTo(
          x + obj.width,
          y + obj.height,
          x + obj.width - maxRadius,
          y + obj.height,
        );
        ctx.lineTo(x + maxRadius, y + obj.height);
        ctx.quadraticCurveTo(x, y + obj.height, x, y + obj.height - maxRadius);
        ctx.lineTo(x, y + maxRadius);
        ctx.quadraticCurveTo(x, y, x + maxRadius, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(x, y, obj.width, obj.height);
        ctx.strokeRect(x, y, obj.width, obj.height);
      }
    } else if (obj.type === "triangle") {
      const currentStroke = ctx.strokeStyle;
      const currentFill = ctx.fillStyle;
      const useObjColor =
        currentStroke !== "#888888" && !currentFill.includes("rgba");

      ctx.strokeStyle = useObjColor ? obj.color : currentStroke;
      ctx.fillStyle = useObjColor ? obj.color : currentFill;
      ctx.lineWidth = obj.lineWidth || 2;

      const x = obj.x + groupOffsetX;
      const y = obj.y + groupOffsetY;
      const radius = obj.borderRadius || 0;

      ctx.beginPath();
      if (radius > 0) {
        // Triangle with rounded corners (simplified)
        const maxRadius = Math.min(radius, obj.width / 4, obj.height / 4);
        const topX = x + obj.width / 2;
        const topY = y;
        const leftX = x;
        const leftY = y + obj.height;
        const rightX = x + obj.width;
        const rightY = y + obj.height;

        ctx.moveTo(topX, topY + maxRadius);
        ctx.lineTo(leftX + maxRadius, leftY - maxRadius);
        ctx.quadraticCurveTo(leftX, leftY, leftX + maxRadius, leftY);
        ctx.lineTo(rightX - maxRadius, rightY);
        ctx.quadraticCurveTo(
          rightX,
          rightY,
          rightX - maxRadius,
          rightY - maxRadius,
        );
        ctx.lineTo(topX + maxRadius, topY + maxRadius);
        ctx.quadraticCurveTo(topX, topY, topX - maxRadius, topY + maxRadius);
        ctx.closePath();
      } else {
        ctx.moveTo(x + obj.width / 2, y);
        ctx.lineTo(x, y + obj.height);
        ctx.lineTo(x + obj.width, y + obj.height);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
    } else if (obj.type === "line") {
      const currentStroke = ctx.strokeStyle;
      ctx.strokeStyle = currentStroke === "#888888" ? currentStroke : obj.color;
      ctx.lineWidth = obj.lineWidth;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(obj.startX + groupOffsetX, obj.startY + groupOffsetY);
      ctx.lineTo(obj.endX + groupOffsetX, obj.endY + groupOffsetY);
      ctx.stroke();
    } else if (obj.type === "path") {
      const currentStroke = ctx.strokeStyle;
      ctx.strokeStyle = currentStroke === "#888888" ? currentStroke : obj.color;
      ctx.lineWidth = obj.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(
        obj.points[0].x + groupOffsetX,
        obj.points[0].y + groupOffsetY,
      );
      for (let i = 1; i < obj.points.length; i++) {
        ctx.lineTo(
          obj.points[i].x + groupOffsetX,
          obj.points[i].y + groupOffsetY,
        );
      }
      ctx.stroke();
    } else if (obj.type === "image") {
      if (obj.imageElement) {
        ctx.drawImage(
          obj.imageElement,
          obj.x + groupOffsetX,
          obj.y + groupOffsetY,
          obj.width,
          obj.height,
        );
      } else if (obj.src) {
        // Fallback: create and cache the image element
        const img = new Image();
        img.onload = () => {
          obj.imageElement = img;
          this.render();
        };
        img.src = obj.src;
      }
    } else if (obj.type === "text") {
      const currentFill = ctx.fillStyle;
      ctx.fillStyle = currentFill.includes("rgba") ? currentFill : obj.color;
      ctx.font = `${obj.fontSize}px ${obj.fontFamily}`;
      ctx.textBaseline = "top";

      // Word wrap text within the box
      const words = obj.text.split(" ");
      const lines = [];
      let currentLine = "";
      const maxWidth = obj.width - 10; // 5px padding on each side

      for (const word of words) {
        const testLine = currentLine + (currentLine ? " " : "") + word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }

      // Draw each line
      const lineHeight = obj.fontSize * 1.2;
      for (let i = 0; i < lines.length; i++) {
        const lineX = obj.x + groupOffsetX + 5;
        const lineY = obj.y + groupOffsetY + 5 + i * lineHeight;
        ctx.fillText(lines[i], lineX, lineY);

        // Draw underline if enabled
        if (obj.underline) {
          const textWidth = ctx.measureText(lines[i]).width;
          const underlineY = lineY + obj.fontSize + 2;
          ctx.strokeStyle = currentFill.includes("rgba")
            ? currentFill
            : obj.color;
          ctx.lineWidth = Math.max(1, obj.fontSize / 16);
          ctx.beginPath();
          ctx.moveTo(lineX, underlineY);
          ctx.lineTo(lineX + textWidth, underlineY);
          ctx.stroke();
        }
      }

      // Draw box outline for reference (optional, can be removed)
      ctx.strokeStyle = "rgba(0, 120, 212, 0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(
        obj.x + groupOffsetX,
        obj.y + groupOffsetY,
        obj.width,
        obj.height,
      );
      ctx.setLineDash([]);
    } else if (obj.type === "group") {
      // Render children with group position as offset
      const childOffsetX = obj.x + groupOffsetX;
      const childOffsetY = obj.y + groupOffsetY;

      for (const child of obj.children) {
        this.renderObject(child, ctx, childOffsetX, childOffsetY);
      }
    }

    ctx.restore();
  }

  addFrame() {
    this.currentFrameIndex = this.frames.length;
    this.frames.push(this.createEmptyFrame());
    this.updateTimeline();
    this.render();
  }

  deleteFrame() {
    if (this.frames.length > 1) {
      this.frames.splice(this.currentFrameIndex, 1);
      if (this.currentFrameIndex >= this.frames.length) {
        this.currentFrameIndex = this.frames.length - 1;
      }
      this.updateTimeline();
      this.render();
    }
  }

  duplicateFrame() {
    const duplicatedFrame = {
      objects: JSON.parse(
        JSON.stringify(this.frames[this.currentFrameIndex].objects),
      ),
    };
    this.frames.splice(this.currentFrameIndex + 1, 0, duplicatedFrame);
    this.currentFrameIndex++;
    this.updateTimeline();
  }

  selectFrame(index) {
    this.currentFrameIndex = index;
    this.selectedObjects = [];
    this.render();
    this.updateTimeline();
  }

  updateTimeline() {
    const timeline = document.getElementById("timeline");
    timeline.innerHTML = "";

    this.frames.forEach((frame, index) => {
      const thumbContainer = document.createElement("div");
      thumbContainer.className = "frame-thumb";
      thumbContainer.draggable = true;
      thumbContainer.dataset.index = index;

      if (index === this.currentFrameIndex) {
        thumbContainer.classList.add("active");
      }

      const thumbCanvas = document.createElement("canvas");
      thumbCanvas.width = 80;
      thumbCanvas.height = 60;
      const thumbCtx = thumbCanvas.getContext("2d");

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = this.canvas.width;
      tempCanvas.height = this.canvas.height;
      const tempCtx = tempCanvas.getContext("2d");

      // Draw background on temp canvas
      if (this.backgroundImage) {
        tempCtx.drawImage(
          this.backgroundImage,
          0,
          0,
          this.canvas.width,
          this.canvas.height,
        );
      } else {
        tempCtx.fillStyle = this.backgroundColor;
        tempCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }

      // Render frame objects to temp canvas
      for (const obj of frame.objects) {
        this.renderObject(obj, tempCtx);
      }

      thumbCtx.drawImage(tempCanvas, 0, 0, 80, 60);

      const frameNumber = document.createElement("div");
      frameNumber.className = "frame-number";
      frameNumber.textContent = index + 1;

      thumbContainer.appendChild(thumbCanvas);
      thumbContainer.appendChild(frameNumber);
      thumbContainer.addEventListener("click", () => this.selectFrame(index));

      // Drag and drop events
      thumbContainer.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/html", index);
        thumbContainer.classList.add("dragging");
      });

      thumbContainer.addEventListener("dragend", () => {
        thumbContainer.classList.remove("dragging");
      });

      thumbContainer.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        thumbContainer.classList.add("drag-over");
      });

      thumbContainer.addEventListener("dragleave", () => {
        thumbContainer.classList.remove("drag-over");
      });

      thumbContainer.addEventListener("drop", (e) => {
        e.preventDefault();
        thumbContainer.classList.remove("drag-over");

        const fromIndex = parseInt(e.dataTransfer.getData("text/html"));
        const toIndex = parseInt(thumbContainer.dataset.index);

        if (fromIndex !== toIndex) {
          this.reorderFrames(fromIndex, toIndex);
        }
      });

      timeline.appendChild(thumbContainer);
    });

    // Update timeline scrubber
    this.updateTimelineScrubber();
  }

  updateTimelineScrubber() {
    const timelineContainer = document.getElementById("timeline").parentElement;

    // Remove existing scrubber and indicator
    const existingScrubber =
      timelineContainer.querySelector(".timeline-scrubber");
    const existingIndicator = timelineContainer.querySelector(
      ".video-length-indicator",
    );
    if (existingScrubber) existingScrubber.remove();
    if (existingIndicator) existingIndicator.remove();

    // Calculate video info
    const videoLength = this.frames.length / this.fps;
    const minutes = Math.floor(videoLength / 60);
    const seconds = (videoLength % 60).toFixed(2);
    const currentTime = this.currentFrameIndex / this.fps;
    const currentMinutes = Math.floor(currentTime / 60);
    const currentSeconds = (currentTime % 60).toFixed(2);

    // Create timeline scrubber
    const scrubber = document.createElement("div");
    scrubber.className = "timeline-scrubber";

    const progress = document.createElement("div");
    progress.className = "timeline-scrubber-progress";
    const progressPercent =
      this.frames.length > 0
        ? ((this.currentFrameIndex + 1) / this.frames.length) * 100
        : 0;
    progress.style.width = progressPercent + "%";

    const handle = document.createElement("div");
    handle.className = "timeline-scrubber-handle";
    handle.style.left = progressPercent + "%";

    const timeDisplay = document.createElement("div");
    timeDisplay.className = "timeline-scrubber-time";
    timeDisplay.textContent = `${currentMinutes}:${currentSeconds.padStart(5, "0")} / ${minutes}:${seconds.padStart(5, "0")}`;

    scrubber.appendChild(progress);
    scrubber.appendChild(handle);
    scrubber.appendChild(timeDisplay);

    // Add scrubber interaction - click only
    const updateScrubberPosition = (e) => {
      const rect = scrubber.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      const frameIndex = Math.min(
        Math.floor(percent * this.frames.length),
        this.frames.length - 1,
      );

      if (frameIndex >= 0 && frameIndex < this.frames.length) {
        this.selectFrame(frameIndex);
      }
    };

    scrubber.addEventListener("click", (e) => {
      updateScrubberPosition(e);
    });

    timelineContainer.appendChild(scrubber);
  }

  reorderFrames(fromIndex, toIndex) {
    const movedFrame = this.frames.splice(fromIndex, 1)[0];
    this.frames.splice(toIndex, 0, movedFrame);

    // Update current frame index if needed
    if (this.currentFrameIndex === fromIndex) {
      this.currentFrameIndex = toIndex;
    } else if (
      fromIndex < this.currentFrameIndex &&
      toIndex >= this.currentFrameIndex
    ) {
      this.currentFrameIndex--;
    } else if (
      fromIndex > this.currentFrameIndex &&
      toIndex <= this.currentFrameIndex
    ) {
      this.currentFrameIndex++;
    }

    this.updateTimeline();
    this.render();
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    // Update button to show pause
    const playBtn = document.getElementById("playBtn");
    playBtn.textContent = "⏸ Pause";

    let frameIndex = this.currentFrameIndex;
    this.animationInterval = setInterval(() => {
      this.currentFrameIndex = frameIndex;
      this.render();
      this.updateTimeline();
      frameIndex = (frameIndex + 1) % this.frames.length;
    }, 1000 / this.fps);
  }

  stop() {
    this.isPlaying = false;
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }

    // Update button to show play
    const playBtn = document.getElementById("playBtn");
    playBtn.textContent = "▶ Play";
  }

  async handleSave() {
    const isLoggedIn = await this.authManager.verify();
    if (!isLoggedIn) {
      this.authManager.showAuthDialog();
      return;
    }
    this.authManager.showProjectDialog();
  }

  async handleLoad() {
    const isLoggedIn = await this.authManager.verify();
    if (!isLoggedIn) {
      this.authManager.showAuthDialog();
      return;
    }
    this.authManager.showProjectDialog();
  }

  downloadProject() {
    const projectData = {
      width: this.canvas.width,
      height: this.canvas.height,
      fps: this.fps,
      frames: this.frames,
      backgroundColor: this.backgroundColor,
      backgroundImageSrc: this.backgroundImage
        ? this.backgroundImage.src
        : null,
    };

    const dataStr = JSON.stringify(projectData);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "animation_project.json";
    link.click();

    URL.revokeObjectURL(url);
  }

  loadProject() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const projectData = JSON.parse(event.target.result);
          const projectName = file.name.replace(".json", "");

          this.canvas.width = projectData.width;
          this.canvas.height = projectData.height;
          this.fps = projectData.fps;
          document.getElementById("fpsInput").value = this.fps;

          this.frames = projectData.frames;
          this.currentFrameIndex = 0;
          this.selectedObjects = [];

          this.backgroundColor = projectData.backgroundColor || "#ffffff";
          document.getElementById("backgroundColorPicker").value =
            this.backgroundColor;

          if (projectData.backgroundImageSrc) {
            const img = new Image();
            img.onload = () => {
              this.backgroundImage = img;
              // Pre-load all images in the frames
              const imageLoadPromises = [];
              for (const frame of this.frames) {
                for (const obj of frame.objects) {
                  if (obj.type === "image" && obj.src) {
                    const promise = new Promise((resolve) => {
                      const imgElement = new Image();
                      imgElement.onload = () => {
                        obj.imageElement = imgElement;
                        resolve();
                      };
                      imgElement.onerror = () => resolve(); // Resolve even if image fails to load
                      imgElement.src = obj.src;
                    });
                    imageLoadPromises.push(promise);
                  } else if (obj.type === "group" && obj.children) {
                    for (const child of obj.children) {
                      if (child.type === "image" && child.src) {
                        const promise = new Promise((resolve) => {
                          const imgElement = new Image();
                          imgElement.onload = () => {
                            child.imageElement = imgElement;
                            resolve();
                          };
                          imgElement.onerror = () => resolve();
                          imgElement.src = child.src;
                        });
                        imageLoadPromises.push(promise);
                      }
                    }
                  }
                }
              }

              Promise.all(imageLoadPromises).then(() => {
                this.saveCurrentFrame();
                notify.success(`Loaded project "${projectName}"`);
              });
            };
            img.onerror = () => {
              notify.error("Error loading background image for the project.");
              this.backgroundImage = null; // Ensure background is cleared if it fails
              this.render();
              this.updateTimeline();
              this.history = [];
              this.historyIndex = -1;
              this.saveCurrentFrame();
              notify.success(
                `Loaded project "${projectName}" (background image failed to load)`,
              );
            };
            img.src = projectData.backgroundImageSrc;
          } else {
            this.backgroundImage = null;
            // Pre-load all images in the frames even if no background
            const imageLoadPromises = [];
            for (const frame of this.frames) {
              for (const obj of frame.objects) {
                if (obj.type === "image" && obj.src) {
                  const promise = new Promise((resolve) => {
                    const imgElement = new Image();
                    imgElement.onload = () => {
                      obj.imageElement = imgElement;
                      resolve();
                    };
                    imgElement.onerror = () => resolve();
                    imgElement.src = obj.src;
                  });
                  imageLoadPromises.push(promise);
                } else if (obj.type === "group" && obj.children) {
                  for (const child of obj.children) {
                    if (child.type === "image" && child.src) {
                      const promise = new Promise((resolve) => {
                        const imgElement = new Image();
                        imgElement.onload = () => {
                          child.imageElement = imgElement;
                          resolve();
                        };
                        imgElement.onerror = () => resolve();
                        imgElement.src = child.src;
                      });
                      imageLoadPromises.push(promise);
                    }
                  }
                }
              }
            }

            Promise.all(imageLoadPromises).then(() => {
              this.updateTimeline();
              this.render();
              this.history = [];
              this.historyIndex = -1;
              this.saveCurrentFrame();
              notify.success(`Loaded project "${projectName}"`);
            });
          }
        } catch (error) {
          notify.error("Error loading project: " + error.message);
        }
      };

      reader.readAsText(file);
    });

    input.click();
  }

  async uploadAnimation(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.includes("webm")) {
      notify.error("Please upload a WebM video file");
      return;
    }

    try {
      const video = document.createElement("video");
      video.src = URL.createObjectURL(file);
      video.muted = true;

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });

      // Extract frames from video
      const extractCanvas = document.createElement("canvas");
      const extractCtx = extractCanvas.getContext("2d");

      // Set canvas size to match video
      extractCanvas.width = video.videoWidth;
      extractCanvas.height = video.videoHeight;
      this.canvas.width = video.videoWidth;
      this.canvas.height = video.videoHeight;

      const duration = video.duration;
      const frameRate = 12; // Default frame rate for extraction
      const frameCount = Math.floor(duration * frameRate);

      this.frames = [];

      for (let i = 0; i < frameCount; i++) {
        const time = i / frameRate;
        video.currentTime = time;

        await new Promise((resolve) => {
          video.onseeked = resolve;
        });

        // Draw current video frame to canvas
        extractCtx.drawImage(
          video,
          0,
          0,
          extractCanvas.width,
          extractCanvas.height,
        );

        // Convert canvas to image and create frame object
        const imageData = extractCanvas.toDataURL("image/png");

        const frame = {
          objects: [
            {
              type: "image",
              x: 0,
              y: 0,
              width: extractCanvas.width,
              height: extractCanvas.height,
              src: imageData,
              rotation: 0,
            },
          ],
        };

        this.frames.push(frame);
      }

      URL.revokeObjectURL(video.src);

      this.currentFrameIndex = 0;
      this.selectedObjects = [];
      this.fps = frameRate;
      document.getElementById("fpsInput").value = this.fps;

      this.updateTimeline();
      this.render();

      notify.success(
        `Animation loaded successfully! ${frameCount} frames extracted.`,
      );
    } catch (error) {
      notify.error("Error loading animation: " + error.message);
    }
  }

  openPreview() {
    if (this.frames.length === 0) {
      notify.info("No frames to preview!");
      return;
    }

    // Create preview window
    const previewWindow = window.open(
      "",
      "Animation Preview",
      "width=900,height=700",
    );

    if (!previewWindow) {
      notify.error("Please allow popups to use the preview feature");
      return;
    }

    // Build the preview HTML
    const previewHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Animation Preview</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      background: #1e1e1e;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #fff;
    }
    .controls {
      background: #2d2d2d;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: flex;
      gap: 10px;
      align-items: center;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    }
    button {
      padding: 8px 16px;
      background: #3d3d3d;
      color: #fff;
      border: 2px solid #555;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }
    button:hover {
      background: #4d4d4d;
    }
    button.playing {
      background: #0078d4;
      border-color: #0078d4;
    }
    #previewCanvas {
      background: #fff;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      max-width: 90vw;
      max-height: 70vh;
      image-rendering: crisp-edges;
    }
    .info {
      margin-top: 15px;
      color: #aaa;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="controls">
    <button id="playBtn">▶ Play</button>
    <button id="stopBtn">⏸ Stop</button>
    <button id="restartBtn">⏮ Restart</button>
    <span class="info">FPS: ${this.fps} | Frames: ${this.frames.length}</span>
  </div>
  <canvas id="previewCanvas" width="${this.canvas.width}" height="${this.canvas.height}"></canvas>
  <div class="info">Press Escape to close(It will take you out of fullscreen)</div>
  <script>
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const playBtn = document.getElementById('playBtn');
    const stopBtn = document.getElementById('stopBtn');
    const restartBtn = document.getElementById('restartBtn');

    const fps = ${this.fps};
    const backgroundColor = '${this.backgroundColor}';
    const backgroundImageSrc = ${this.backgroundImage ? `'${this.backgroundImage.src}'` : "null"};
    let backgroundImage = null;

    if (backgroundImageSrc) {
      backgroundImage = new Image();
      backgroundImage.src = backgroundImageSrc;
    }

    const frames = ${JSON.stringify(this.frames)};
    let currentFrame = 0;
    let isPlaying = false;
    let animationInterval = null;

    // Pre-load all images
    const imageLoadPromises = [];
    for (const frame of frames) {
      for (const obj of frame.objects) {
        if (obj.type === 'image' && obj.src) {
          const promise = new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              obj.imageElement = img;
              resolve();
            };
            img.onerror = () => resolve();
            img.src = obj.src;
          });
          imageLoadPromises.push(promise);
        } else if (obj.type === 'group' && obj.children) {
          for (const child of obj.children) {
            if (child.type === 'image' && child.src) {
              const promise = new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                  child.imageElement = img;
                  resolve();
                };
                img.onerror = () => resolve();
                img.src = child.src;
              });
              imageLoadPromises.push(promise);
            }
          }
        }
      }
    }

    Promise.all(imageLoadPromises).then(() => {
      renderFrame();
      play();
    });

    function renderFrame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const frame = frames[currentFrame];
      for (const obj of frame.objects) {
        renderObject(obj);
      }
    }

    function renderObject(obj, groupOffsetX = 0, groupOffsetY = 0) {
      const rotation = obj.rotation || 0;
      const centerX = obj.x + groupOffsetX + obj.width / 2;
      const centerY = obj.y + groupOffsetY + obj.height / 2;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation * Math.PI / 180);
      ctx.translate(-centerX, -centerY);

      if (obj.type === 'circle') {
        ctx.strokeStyle = obj.color;
        ctx.fillStyle = obj.color;
        ctx.lineWidth = obj.lineWidth;
        ctx.beginPath();
        ctx.arc(obj.x + groupOffsetX + obj.width / 2, obj.y + groupOffsetY + obj.height / 2, obj.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (obj.type === 'square') {
        ctx.strokeStyle = obj.color;
        ctx.fillStyle = obj.color;
        ctx.lineWidth = obj.lineWidth || 2;
        const x = obj.x + groupOffsetX;
        const y = obj.y + groupOffsetY;
        const radius = obj.borderRadius || 0;
        if (radius > 0) {
          const maxRadius = Math.min(radius, obj.width / 2, obj.height / 2);
          ctx.beginPath();
          ctx.moveTo(x + maxRadius, y);
          ctx.lineTo(x + obj.width - maxRadius, y);
          ctx.quadraticCurveTo(x + obj.width, y, x + obj.width, y + maxRadius);
          ctx.lineTo(x + obj.width, y + obj.height - maxRadius);
          ctx.quadraticCurveTo(x + obj.width, y + obj.height, x + obj.width - maxRadius, y + obj.height);
          ctx.lineTo(x + maxRadius, y + obj.height);
          ctx.quadraticCurveTo(x, y + obj.height, x, y + obj.height - maxRadius);
          ctx.lineTo(x, y + maxRadius);
          ctx.quadraticCurveTo(x, y, x + maxRadius, y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(x, y, obj.width, obj.height);
          ctx.strokeRect(x, y, obj.width, obj.height);
        }
      } else if (obj.type === 'triangle') {
        ctx.strokeStyle = obj.color;
        ctx.fillStyle = obj.color;
        ctx.lineWidth = obj.lineWidth || 2;
        const x = obj.x + groupOffsetX;
        const y = obj.y + groupOffsetY;
        ctx.beginPath();
        ctx.moveTo(x + obj.width / 2, y);
        ctx.lineTo(x, y + obj.height);
        ctx.lineTo(x + obj.width, y + obj.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (obj.type === 'line') {
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = obj.lineWidth;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(obj.startX + groupOffsetX, obj.startY + groupOffsetY);
        ctx.lineTo(obj.endX + groupOffsetX, obj.endY + groupOffsetY);
        ctx.stroke();
      } else if (obj.type === 'path') {
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = obj.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(obj.points[0].x + groupOffsetX, obj.points[0].y + groupOffsetY);
        for (let i = 1; i < obj.points.length; i++) {
          ctx.lineTo(obj.points[i].x + groupOffsetX, obj.points[i].y + groupOffsetY);
        }
        ctx.stroke();
      } else if (obj.type === 'image' && obj.imageElement) {
        ctx.drawImage(obj.imageElement, obj.x + groupOffsetX, obj.y + groupOffsetY, obj.width, obj.height);
      } else if (obj.type === 'text') {
        ctx.fillStyle = obj.color;
        ctx.font = obj.fontSize + 'px ' + obj.fontFamily;
        ctx.textBaseline = 'top';
        const words = obj.text.split(' ');
        const lines = [];
        let currentLine = '';
        const maxWidth = obj.width - 10;
        for (const word of words) {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);
        const lineHeight = obj.fontSize * 1.2;
        for (let i = 0; i < lines.length; i++) {
          const lineX = obj.x + groupOffsetX + 5;
          const lineY = obj.y + groupOffsetY + 5 + (i * lineHeight);
          ctx.fillText(lines[i], lineX, lineY);
          if (obj.underline) {
            const textWidth = ctx.measureText(lines[i]).width;
            const underlineY = lineY + obj.fontSize + 2;
            ctx.strokeStyle = obj.color;
            ctx.lineWidth = Math.max(1, obj.fontSize / 16);
            ctx.beginPath();
            ctx.moveTo(lineX, underlineY);
            ctx.lineTo(lineX + textWidth, underlineY);
            ctx.stroke();
          }
        }
      } else if (obj.type === 'group') {
        const childOffsetX = obj.x + groupOffsetX;
        const childOffsetY = obj.y + groupOffsetY;
        for (const child of obj.children) {
          renderObject(child, childOffsetX, childOffsetY);
        }
      }

      ctx.restore();
    }

    function play() {
      if (isPlaying) return;
      isPlaying = true;
      playBtn.classList.add('playing');
      playBtn.textContent = '⏸ Pause';

      animationInterval = setInterval(() => {
        currentFrame = (currentFrame + 1) % frames.length;
        renderFrame();
      }, 1000 / fps);
    }

    function stop() {
      isPlaying = false;
      playBtn.classList.remove('playing');
      playBtn.textContent = '▶ Play';
      if (animationInterval) {
        clearInterval(animationInterval);
        animationInterval = null;
      }
    }

    function restart() {
      stop();
      currentFrame = 0;
      renderFrame();
    }

    playBtn.addEventListener('click', () => {
      if (isPlaying) {
        stop();
      } else {
        play();
      }
    });

    stopBtn.addEventListener('click', stop);
    restartBtn.addEventListener('click', restart);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.close();
      }
    });
  </script>
</body>
</html>
    `;

    previewWindow.document.write(previewHTML);
    previewWindow.document.close();
  }

  async exportGIF() {
    if (this.frames.length === 0) {
      notify.info("No frames to export!");
      return;
    }

    try {
      // Pre-load all images before recording
      const imagePromises = [];
      for (const frame of this.frames) {
        for (const obj of frame.objects) {
          if (obj.type === "image") {
            const promise = new Promise((resolve) => {
              const img = new Image();
              img.onload = () => {
                obj.imageElement = img;
                resolve();
              };
              img.onerror = () => resolve();
              img.src = obj.src;
            });
            imagePromises.push(promise);
          } else if (obj.type === "group") {
            for (const child of obj.children) {
              if (child.type === "image") {
                const promise = new Promise((resolve) => {
                  const img = new Image();
                  img.onload = () => {
                    child.imageElement = img;
                    resolve();
                  };
                  img.onerror = () => resolve();
                  img.src = child.src;
                });
                imagePromises.push(promise);
              }
            }
          }
        }
      }

      await Promise.all(imagePromises);

      // Use WebM format (browsers don't actually support MP4 in MediaRecorder)
      const mimeType = "video/webm";

      const stream = this.canvas.captureStream(this.fps);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 5000000,
      });

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = "animation.webm";
        link.click();

        URL.revokeObjectURL(url);

        // Return to first frame
        this.currentFrameIndex = 0;
        this.render();
        this.updateTimeline();
      };

      // Start recording
      mediaRecorder.start();

      // Play through all frames exactly once
      let frameIndex = 0;

      const recordInterval = setInterval(() => {
        this.currentFrameIndex = frameIndex;

        // Clear and render frame with background
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background
        if (this.backgroundImage) {
          this.ctx.drawImage(
            this.backgroundImage,
            0,
            0,
            this.canvas.width,
            this.canvas.height,
          );
        } else {
          this.ctx.fillStyle = this.backgroundColor;
          this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Render each object in the frame
        for (const obj of this.frames[this.currentFrameIndex].objects) {
          this.renderObjectForExport(obj);
        }

        frameIndex++;
        if (frameIndex >= this.frames.length) {
          clearInterval(recordInterval);
          // Wait to ensure all frames are captured
          setTimeout(() => {
            mediaRecorder.stop();
          }, 500);
        }
      }, 1000 / this.fps);
    } catch (error) {
      notify.error(
        "Error exporting video: " +
          error.message +
          "\n\nNote: Your browser may not support video export. Try Chrome or Edge.",
      );
    }
  }

  renderObjectForExport(obj, groupOffsetX = 0, groupOffsetY = 0) {
    const rotation = obj.rotation || 0;
    const centerX = obj.x + groupOffsetX + obj.width / 2;
    const centerY = obj.y + groupOffsetY + obj.height / 2;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate((rotation * Math.PI) / 180);
    this.ctx.translate(-centerX, -centerY);

    if (obj.type === "circle") {
      this.ctx.strokeStyle = obj.color;
      this.ctx.fillStyle = obj.color;
      this.ctx.lineWidth = obj.lineWidth;
      this.ctx.beginPath();
      this.ctx.arc(
        obj.x + groupOffsetX + obj.width / 2,
        obj.y + groupOffsetY + obj.height / 2,
        obj.width / 2,
        0,
        Math.PI * 2,
      );
      this.ctx.fill();
      this.ctx.stroke();
    } else if (obj.type === "square") {
      this.ctx.strokeStyle = obj.color;
      this.ctx.fillStyle = obj.color;
      this.ctx.lineWidth = obj.lineWidth || 2;

      const x = obj.x + groupOffsetX;
      const y = obj.y + groupOffsetY;
      const radius = obj.borderRadius || 0;

      if (radius > 0) {
        const maxRadius = Math.min(radius, obj.width / 2, obj.height / 2);
        this.ctx.beginPath();
        this.ctx.moveTo(x + maxRadius, y);
        this.ctx.lineTo(x + obj.width - maxRadius, y);
        this.ctx.quadraticCurveTo(
          x + obj.width,
          y,
          x + obj.width,
          y + maxRadius,
        );
        this.ctx.lineTo(x + obj.width, y + obj.height - maxRadius);
        this.ctx.quadraticCurveTo(
          x + obj.width,
          y + obj.height,
          x + obj.width - maxRadius,
          y + obj.height,
        );
        this.ctx.lineTo(x + maxRadius, y + obj.height);
        this.ctx.quadraticCurveTo(
          x,
          y + obj.height,
          x,
          y + obj.height - maxRadius,
        );
        this.ctx.lineTo(x, y + maxRadius);
        this.ctx.quadraticCurveTo(x, y, x + maxRadius, y);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      } else {
        this.ctx.fillRect(x, y, obj.width, obj.height);
        this.ctx.strokeRect(x, y, obj.width, obj.height);
      }
    } else if (obj.type === "triangle") {
      this.ctx.strokeStyle = obj.color;
      this.ctx.fillStyle = obj.color;
      this.ctx.lineWidth = obj.lineWidth || 2;

      const x = obj.x + groupOffsetX;
      const y = obj.y + groupOffsetY;
      const radius = obj.borderRadius || 0;

      this.ctx.beginPath();
      if (radius > 0) {
        const maxRadius = Math.min(radius, obj.width / 4, obj.height / 4);
        const topX = x + obj.width / 2;
        const topY = y;
        const leftX = x;
        const leftY = y + obj.height;
        const rightX = x + obj.width;
        const rightY = y + obj.height;

        this.ctx.moveTo(topX, topY + maxRadius);
        this.ctx.lineTo(leftX + maxRadius, leftY - maxRadius);
        this.ctx.quadraticCurveTo(leftX, leftY, leftX + maxRadius, leftY);
        this.ctx.lineTo(rightX - maxRadius, rightY);
        this.ctx.quadraticCurveTo(
          rightX,
          rightY,
          rightX - maxRadius,
          rightY - maxRadius,
        );
        this.ctx.lineTo(topX + maxRadius, topY + maxRadius);
        this.ctx.quadraticCurveTo(
          topX,
          topY,
          topX - maxRadius,
          topY + maxRadius,
        );
        this.ctx.closePath();
      } else {
        this.ctx.moveTo(x + obj.width / 2, y);
        this.ctx.lineTo(x, y + obj.height);
        this.ctx.lineTo(x + obj.width, y + obj.height);
        this.ctx.closePath();
      }
      this.ctx.fill();
      this.ctx.stroke();
    } else if (obj.type === "line") {
      this.ctx.strokeStyle = obj.color;
      this.ctx.lineWidth = obj.lineWidth;
      this.ctx.lineCap = "round";
      this.ctx.beginPath();
      this.ctx.moveTo(obj.startX + groupOffsetX, obj.startY + groupOffsetY);
      this.ctx.lineTo(obj.endX + groupOffsetX, obj.endY + groupOffsetY);
      this.ctx.stroke();
    } else if (obj.type === "path") {
      this.ctx.strokeStyle = obj.color;
      this.ctx.lineWidth = obj.lineWidth;
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";
      this.ctx.beginPath();
      this.ctx.moveTo(
        obj.points[0].x + groupOffsetX,
        obj.points[0].y + groupOffsetY,
      );
      for (let i = 1; i < obj.points.length; i++) {
        this.ctx.lineTo(
          obj.points[i].x + groupOffsetX,
          obj.points[i].y + groupOffsetY,
        );
      }
      this.ctx.stroke();
    } else if (obj.type === "image") {
      if (obj.imageElement) {
        this.ctx.drawImage(
          obj.imageElement,
          obj.x + groupOffsetX,
          obj.y + groupOffsetY,
          obj.width,
          obj.height,
        );
      }
    } else if (obj.type === "text") {
      this.ctx.fillStyle = obj.color;
      this.ctx.font = `${obj.fontSize}px ${obj.fontFamily}`;
      this.ctx.textBaseline = "top";
      const textX = obj.x + groupOffsetX;
      const textY = obj.y + groupOffsetY;
      this.ctx.fillText(obj.text, textX, textY);

      // Draw underline if enabled
      if (obj.underline) {
        const textWidth = this.ctx.measureText(obj.text).width;
        const underlineY = textY + obj.fontSize + 2;
        this.ctx.strokeStyle = obj.color;
        this.ctx.lineWidth = Math.max(1, obj.fontSize / 16);
        this.ctx.beginPath();
        this.ctx.moveTo(textX, underlineY);
        this.ctx.lineTo(textX + textWidth, underlineY);
        this.ctx.stroke();
      }
    } else if (obj.type === "group") {
      // Render children with group position as offset
      const childOffsetX = obj.x + groupOffsetX;
      const childOffsetY = obj.y + groupOffsetY;

      for (const child of obj.children) {
        this.renderObjectForExport(child, childOffsetX, childOffsetY);
      }
    }

    this.ctx.restore();
  }
}

// Ensure the studio is initialized after the DOM and AuthManager are ready
document.addEventListener("DOMContentLoaded", async () => {
  // Check if AuthManager is defined (it's in auth.js)
  if (typeof AuthManager !== 'undefined') {
    window.studio = new AnimationStudio();
    
    // Check for project to load in URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const projectToLoad = urlParams.get('project') || localStorage.getItem('current_project');
    
    // Automatically redirect to login page if not logged in
    const isLoggedIn = await window.studio.authManager.verify();
    if (!isLoggedIn) {
      window.location.href = "login.html";
      return;
    }

    if (projectToLoad) {
      try {
        await window.studio.authManager.loadProject(projectToLoad);
      } catch (e) {
        console.error("Failed to auto-load project:", e);
      }
    }
  } else {
    // ... rest of fallback logic
    console.error("AuthManager not found. Ensure auth.js is loaded before script.js.");
    // Fallback: wait a bit more or try to initialize anyway if script.js is module
    setTimeout(async () => {
        if (typeof AuthManager !== 'undefined') {
            window.studio = new AnimationStudio();
            const isLoggedIn = await window.studio.authManager.verify();
            if (!isLoggedIn) {
              window.location.href = "login.html";
            }
        } else {
            alert("Critical Error: Authentication system failed to load.");
        }
    }, 500);
  }
});
