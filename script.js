class AnimationStudio {
  constructor() {
    this.canvas = document.getElementById('drawCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = 800;
    this.canvas.height = 600;

    this.frames = [this.createEmptyFrame()];
    this.currentFrameIndex = 0;
    this.isDrawing = false;
    this.tool = 'pencil';
    this.color = '#000000';
    this.brushSize = 3;
    this.isPlaying = false;
    this.fps = 12;
    this.animationInterval = null;
    this.onionSkinEnabled = false;
    this.smartDrawEnabled = true;
    this.backgroundColor = '#ffffff';
    this.backgroundImage = null;

    this.lastX = 0;
    this.lastY = 0;

    this.selectedShape = null;
    this.shapeWidth = 100;
    this.shapeHeight = 100;

    // Text properties
    this.textContent = '';
    this.fontSize = 24;
    this.fontFamily = 'Arial';
    this.textBoxStart = null;
    this.tempTextBox = null;

    // Clipboard
    this.clipboard = [];

    // Smart draw properties
    this.drawPoints = [];
    this.tempCanvas = document.createElement('canvas');
    this.tempCanvas.width = this.canvas.width;
    this.tempCanvas.height = this.canvas.height;
    this.tempCtx = this.tempCanvas.getContext('2d');

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
    // Set initial cursor after a small delay to ensure canvas is ready
    setTimeout(() => this.setTool('pencil'), 0);
  }

  initializeResizers() {
    // Sidebar resizer
    const sidebar = document.querySelector('.sidebar');
    const sidebarResizer = document.getElementById('sidebarResizer');
    const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');

    let isResizingSidebar = false;

    sidebarResizer.addEventListener('mousedown', (e) => {
      isResizingSidebar = true;
      document.body.style.cursor = 'ew-resize';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (isResizingSidebar) {
        const newWidth = e.clientX;
        if (newWidth >= 150 && newWidth <= 400) {
          sidebar.style.width = newWidth + 'px';
        }
      }
    });

    document.addEventListener('mouseup', () => {
      if (isResizingSidebar) {
        isResizingSidebar = false;
        document.body.style.cursor = '';
      }
    });

    sidebarCollapseBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      sidebarCollapseBtn.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
    });

    // Animation controls resizer
    const animationControls = document.querySelector('.animation-controls');
    const animationResizer = document.getElementById('animationResizer');
    const animationCollapseBtn = document.getElementById('animationCollapseBtn');

    let isResizingAnimation = false;

    animationResizer.addEventListener('mousedown', (e) => {
      isResizingAnimation = true;
      document.body.style.cursor = 'ns-resize';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (isResizingAnimation) {
        const rect = animationControls.getBoundingClientRect();
        const newHeight = rect.bottom - e.clientY;
        if (newHeight >= 100 && newHeight <= 600) {
          animationControls.style.height = newHeight + 'px';
        }
      }
    });

    document.addEventListener('mouseup', () => {
      if (isResizingAnimation) {
        isResizingAnimation = false;
        document.body.style.cursor = '';
      }
    });

    animationCollapseBtn.addEventListener('click', () => {
      animationControls.classList.toggle('collapsed');
      animationCollapseBtn.textContent = animationControls.classList.contains('collapsed') ? '▲' : '▼';
    });
  }

  createEmptyFrame() {
    return { objects: [] };
  }

  initializeEventListeners() {
    // Keyboard events
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (this.selectedObjects.length > 0) {
          e.preventDefault();
          this.deleteSelectedObjects();
        }
      } else if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        this.undo();
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        this.redo();
      } else if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        this.copySelectedObjects();
      } else if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        this.pasteObjects();
      } else if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        this.duplicateSelectedObjects();
      }
    });

    // Drawing events
    this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    this.canvas.addEventListener('mousemove', (e) => this.draw(e));
    this.canvas.addEventListener('mouseup', () => this.stopDrawing());
    this.canvas.addEventListener('mouseout', () => this.stopDrawing());

    // Touch events for mobile
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.canvas.dispatchEvent(mouseEvent);
    });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.canvas.dispatchEvent(mouseEvent);
    });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const mouseEvent = new MouseEvent('mouseup', {});
      this.canvas.dispatchEvent(mouseEvent);
    });

    // Tool buttons
    document.getElementById('pencilBtn').addEventListener('click', () => this.setTool('pencil'));
    document.getElementById('smartDrawBtn').addEventListener('click', () => this.setTool('mouse'));
    document.getElementById('fillBtn').addEventListener('click', () => this.setTool('fill'));
    document.getElementById('eraserBtn').addEventListener('click', () => this.setTool('eraser'));
    document.getElementById('textBtn').addEventListener('click', () => this.setTool('text'));
    document.getElementById('clearBtn').addEventListener('click', () => this.clearFrame());

    // Color and brush
    document.getElementById('colorPicker').addEventListener('change', (e) => {
      this.color = e.target.value;
    });

    document.getElementById('brushSize').addEventListener('input', (e) => {
      this.brushSize = parseInt(e.target.value);
      document.getElementById('brushSizeLabel').textContent = this.brushSize + 'px';
    });

    // Playback controls
    document.getElementById('playBtn').addEventListener('click', () => this.play());
    document.getElementById('stopBtn').addEventListener('click', () => this.stop());
    document.getElementById('fpsInput').addEventListener('change', (e) => {
      this.fps = parseInt(e.target.value);
      if (this.isPlaying) {
        this.stop();
        this.play();
      }
    });

    // Frame controls
    document.getElementById('addFrameBtn').addEventListener('click', () => this.addFrame());
    document.getElementById('deleteFrameBtn').addEventListener('click', () => this.deleteFrame());
    document.getElementById('duplicateFrameBtn').addEventListener('click', () => this.duplicateFrame());
    document.getElementById('onionSkin').addEventListener('change', (e) => {
      this.onionSkinEnabled = e.target.checked;
      this.render();
    });

    document.getElementById('smartDrawToggle').addEventListener('change', (e) => {
      this.smartDrawEnabled = e.target.checked;
    });

    // Background controls
    document.getElementById('backgroundColorPicker').addEventListener('change', (e) => {
      this.backgroundColor = e.target.value;
      this.render();
    });

    document.getElementById('uploadBackgroundBtn').addEventListener('click', () => {
      document.getElementById('backgroundUpload').click();
    });

    document.getElementById('backgroundUpload').addEventListener('change', (e) => this.uploadBackground(e));

    document.getElementById('clearBackgroundBtn').addEventListener('click', () => {
      this.backgroundImage = null;
      this.render();
    });

    // File controls
    document.getElementById('cloudSaveBtn').addEventListener('click', () => this.saveToCloud());
    document.getElementById('cloudLoadBtn').addEventListener('click', () => this.loadFromCloud());
    document.getElementById('loadBtn').addEventListener('click', () => this.loadProject());
    document.getElementById('uploadAnimationBtn').addEventListener('click', () => {
      document.getElementById('animationUpload').click();
    });
    document.getElementById('animationUpload').addEventListener('change', (e) => this.uploadAnimation(e));
    document.getElementById('exportBtn').addEventListener('click', () => this.exportGIF());

    // Insert controls
    document.getElementById('uploadImageBtn').addEventListener('click', () => {
      document.getElementById('imageUpload').click();
    });

    document.getElementById('imageUpload').addEventListener('change', (e) => this.uploadImage(e));
    document.getElementById('circleBtn').addEventListener('click', () => this.insertShape('circle'));
    document.getElementById('squareBtn').addEventListener('click', () => this.insertShape('square'));
    document.getElementById('triangleBtn').addEventListener('click', () => this.insertShape('triangle'));

    // Group/Ungroup controls
    document.getElementById('groupBtn').addEventListener('click', () => this.groupSelectedObjects());
    document.getElementById('ungroupBtn').addEventListener('click', () => this.ungroupSelectedObjects());
    document.getElementById('deleteSelectedBtn').addEventListener('click', () => this.deleteSelectedObjects());

    // Rotation controls
    document.getElementById('rotationInput').addEventListener('input', (e) => {
      const angle = parseInt(e.target.value);
      document.getElementById('rotationValue').textContent = angle + '°';
      this.applyRotation(angle);
    });

    // Resize controls
    document.getElementById('shapeWidth').addEventListener('input', (e) => {
      this.shapeWidth = parseInt(e.target.value);
    });

    document.getElementById('shapeHeight').addEventListener('input', (e) => {
      this.shapeHeight = parseInt(e.target.value);
    });

    document.getElementById('applyResize').addEventListener('click', () => {
      if (this.selectedShape) {
        this.drawShape(this.selectedShape, this.shapeWidth, this.shapeHeight);
        this.saveCurrentFrame();
      }
    });

    // Undo/Redo buttons
    document.getElementById('undoBtn').addEventListener('click', () => this.undo());
    document.getElementById('redoBtn').addEventListener('click', () => this.redo());

    // Text controls
    document.getElementById('textInput').addEventListener('input', (e) => {
      this.textContent = e.target.value;
    });

    document.getElementById('fontSize').addEventListener('input', (e) => {
      this.fontSize = parseInt(e.target.value);
      document.getElementById('fontSizeLabel').textContent = this.fontSize + 'px';
    });

    document.getElementById('fontFamily').addEventListener('change', (e) => {
      this.fontFamily = e.target.value;
    });

    document.getElementById('addTextBtn').addEventListener('click', () => this.addText());

    // Clipboard controls
    document.getElementById('copyBtn').addEventListener('click', () => this.copySelectedObjects());
    document.getElementById('pasteBtn').addEventListener('click', () => this.pasteObjects());
    document.getElementById('duplicateBtn').addEventListener('click', () => this.duplicateSelectedObjects());
    document.getElementById('renameBtn').addEventListener('click', () => this.renameSelectedObject());
  }

  setTool(tool) {
    this.tool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));

    // Remove all cursor classes
    this.canvas.classList.remove('cursor-pencil', 'cursor-mouse', 'cursor-fill', 'cursor-eraser', 'cursor-text');

    if (tool === 'pencil') {
      document.getElementById('pencilBtn').classList.add('active');
      this.canvas.classList.add('cursor-pencil');
    } else if (tool === 'mouse') {
      document.getElementById('smartDrawBtn').classList.add('active');
      this.canvas.classList.add('cursor-mouse');
    } else if (tool === 'fill') {
      document.getElementById('fillBtn').classList.add('active');
      this.canvas.classList.add('cursor-fill');
    } else if (tool === 'eraser') {
      document.getElementById('eraserBtn').classList.add('active');
      this.canvas.classList.add('cursor-eraser');
    } else if (tool === 'text') {
      document.getElementById('textBtn').classList.add('active');
      this.canvas.classList.add('cursor-text');
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

  startDrawing(e) {
    const pos = this.getMousePos(e);

    if (this.tool === 'fill') {
      this.floodFill(Math.floor(pos.x), Math.floor(pos.y));
      this.saveCurrentFrame();
      return;
    }

    if (this.tool === 'text') {
      // Start creating a text box
      this.isDrawing = true;
      this.textBoxStart = { x: pos.x, y: pos.y };
      this.tempTextBox = {
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0
      };
      return;
    }

    if (this.tool === 'mouse') {
      // Check if clicking on rotation handle
      if (this.getRotationHandle(pos.x, pos.y) && this.selectedObjects.length === 1) {
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
      this.selectionBox = { startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y };
      this.selectedObjects = [];
      this.render();
      return;
    }

    if (this.tool === 'eraser') {
      const clickedObject = this.getObjectAtPoint(pos.x, pos.y);
      if (clickedObject) {
        this.deleteObject(clickedObject);
        this.saveCurrentFrame();
        this.render();
        return;
      }
    }

    this.isDrawing = true;
    this.lastX = pos.x;
    this.lastY = pos.y;
    this.drawPoints = [{ x: pos.x, y: pos.y }];
    this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
  }

  draw(e) {
    const pos = this.getMousePos(e);

    if (this.tool === 'text' && this.isDrawing) {
      // Update text box size
      this.tempTextBox.width = pos.x - this.tempTextBox.x;
      this.tempTextBox.height = pos.y - this.tempTextBox.y;
      this.render();
      return;
    }

    if (this.tool === 'mouse') {
      if (this.isRotating && this.selectedObjects.length === 1) {
        const obj = this.selectedObjects[0];
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;

        const angle = Math.atan2(pos.y - centerY, pos.x - centerX) * 180 / Math.PI;
        obj.rotation = angle + 90;

        document.getElementById('rotationInput').value = Math.round(obj.rotation);
        this.render();
        return;
      }

      if (this.isResizing && this.selectedObjects.length === 1) {
        const obj = this.selectedObjects[0];
        const dx = pos.x - this.dragStartX;
        const dy = pos.y - this.dragStartY;

        if (this.resizeHandle === 'se') {
          obj.width += dx;
          obj.height += dy;
        } else if (this.resizeHandle === 'sw') {
          obj.x += dx;
          obj.width -= dx;
          obj.height += dy;
        } else if (this.resizeHandle === 'ne') {
          obj.width += dx;
          obj.y += dy;
          obj.height -= dy;
        } else if (this.resizeHandle === 'nw') {
          obj.x += dx;
          obj.width -= dx;
          obj.y += dy;
          obj.height -= dy;
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
    this.tempCtx.lineCap = 'round';
    this.tempCtx.lineJoin = 'round';
    this.tempCtx.globalCompositeOperation = this.tool === 'eraser' ? 'destination-out' : 'source-over';

    this.tempCtx.beginPath();
    this.tempCtx.moveTo(this.drawPoints[0].x, this.drawPoints[0].y);
    for (let i = 1; i < this.drawPoints.length; i++) {
      this.tempCtx.lineTo(this.drawPoints[i].x, this.drawPoints[i].y);
    }
    this.tempCtx.stroke();

    this.render();
  }

  stopDrawing() {
    if (this.tool === 'text' && this.isDrawing) {
      this.isDrawing = false;
      
      // Only create text box if it has minimum size
      const width = Math.abs(this.tempTextBox.width);
      const height = Math.abs(this.tempTextBox.height);
      
      if (width < 20 || height < 20) {
        // If box is too small, use default size
        this.addObject({
          type: 'text',
          x: this.tempTextBox.x,
          y: this.tempTextBox.y,
          text: this.textContent || 'Enter text...',
          fontSize: this.fontSize,
          fontFamily: this.fontFamily,
          color: this.color,
          width: 200,
          height: Math.max(this.fontSize + 20, 50),
          name: 'Text: ' + (this.textContent || 'Enter text...').substring(0, 20)
        });
      } else {
        // Normalize coordinates if dragged backwards
        const x = this.tempTextBox.width < 0 ? this.tempTextBox.x + this.tempTextBox.width : this.tempTextBox.x;
        const y = this.tempTextBox.height < 0 ? this.tempTextBox.y + this.tempTextBox.height : this.tempTextBox.y;
        
        this.addObject({
          type: 'text',
          x: x,
          y: y,
          text: this.textContent || 'Enter text...',
          fontSize: this.fontSize,
          fontFamily: this.fontFamily,
          color: this.color,
          width: width,
          height: height,
          name: 'Text: ' + (this.textContent || 'Enter text...').substring(0, 20)
        });
      }
      
      this.tempTextBox = null;
      this.saveCurrentFrame();
      this.render();
      return;
    }

    if (this.tool === 'mouse') {
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

        this.selectedObjects = this.getCurrentFrameObjects().filter(obj => {
          return obj.x + obj.width > minX && obj.x < maxX &&
                 obj.y + obj.height > minY && obj.y < maxY;
        });

        this.selectionBox = null;
        this.render();
        return;
      }

      return;
    }

    if (this.isDrawing) {
      this.isDrawing = false;

      if (this.tool === 'pencil' && this.drawPoints.length > 2) {
        let shapeToAdd;
        if (this.smartDrawEnabled) {
          shapeToAdd = this.recognizeShape();
        } else {
          // Just create a path without shape recognition
          shapeToAdd = {
            type: 'path',
            points: [...this.drawPoints],
            color: this.color,
            lineWidth: this.brushSize,
            x: Math.min(...this.drawPoints.map(p => p.x)),
            y: Math.min(...this.drawPoints.map(p => p.y)),
            width: Math.max(...this.drawPoints.map(p => p.x)) - Math.min(...this.drawPoints.map(p => p.x)),
            height: Math.max(...this.drawPoints.map(p => p.y)) - Math.min(...this.drawPoints.map(p => p.y))
          };
        }
        this.addObject(shapeToAdd);
      }

      this.drawPoints = [];
      this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
      this.saveCurrentFrame();
      this.render();
    }
  }

  recognizeShape() {
    if (this.drawPoints.length < 5) {
      // Return original path for very short strokes
      return {
        type: 'path',
        points: [...this.drawPoints],
        color: this.color,
        lineWidth: this.brushSize,
        x: Math.min(...this.drawPoints.map(p => p.x)),
        y: Math.min(...this.drawPoints.map(p => p.y)),
        width: Math.max(...this.drawPoints.map(p => p.x)) - Math.min(...this.drawPoints.map(p => p.x)),
        height: Math.max(...this.drawPoints.map(p => p.y)) - Math.min(...this.drawPoints.map(p => p.y))
      };
    }

    const firstPoint = this.drawPoints[0];
    const lastPoint = this.drawPoints[this.drawPoints.length - 1];

    // Check if it's a closed shape (circle)
    const distance = Math.sqrt(
      Math.pow(lastPoint.x - firstPoint.x, 2) +
      Math.pow(lastPoint.y - firstPoint.y, 2)
    );

    if (distance < 30 && this.drawPoints.length > 10) {
      // Likely a circle
      const centerX = this.drawPoints.reduce((sum, p) => sum + p.x, 0) / this.drawPoints.length;
      const centerY = this.drawPoints.reduce((sum, p) => sum + p.y, 0) / this.drawPoints.length;
      const radius = this.drawPoints.reduce((sum, p) => {
        return sum + Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2));
      }, 0) / this.drawPoints.length;

      return {
        type: 'circle',
        x: centerX - radius,
        y: centerY - radius,
        width: radius * 2,
        height: radius * 2,
        color: this.color,
        lineWidth: this.brushSize
      };
    } else {
      // Check if it's a straight line
      const isLine = this.isApproximatelyLine();

      if (isLine) {
        return {
          type: 'line',
          x: Math.min(firstPoint.x, lastPoint.x),
          y: Math.min(firstPoint.y, lastPoint.y),
          width: Math.abs(lastPoint.x - firstPoint.x),
          height: Math.abs(lastPoint.y - firstPoint.y),
          startX: firstPoint.x,
          startY: firstPoint.y,
          endX: lastPoint.x,
          endY: lastPoint.y,
          color: this.color,
          lineWidth: this.brushSize
        };
      }
    }

    // If not recognized as circle or line, return original path
    return {
      type: 'path',
      points: [...this.drawPoints],
      color: this.color,
      lineWidth: this.brushSize,
      x: Math.min(...this.drawPoints.map(p => p.x)),
      y: Math.min(...this.drawPoints.map(p => p.y)),
      width: Math.max(...this.drawPoints.map(p => p.x)) - Math.min(...this.drawPoints.map(p => p.x)),
      height: Math.max(...this.drawPoints.map(p => p.y)) - Math.min(...this.drawPoints.map(p => p.y))
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
        (dy * point.x - dx * point.y + lastPoint.x * firstPoint.y - lastPoint.y * firstPoint.x) / lineLength
      );
      maxDeviation = Math.max(maxDeviation, deviation);
    }

    return maxDeviation < 15;
  }

  floodFill(startX, startY) {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
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
      if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) continue;

      visited.add(key);

      const index = getPixelIndex(x, y);
      const currentR = pixels[index];
      const currentG = pixels[index + 1];
      const currentB = pixels[index + 2];
      const currentA = pixels[index + 3];

      if (currentR !== targetR || currentG !== targetG || currentB !== targetB || currentA !== targetA) {
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

        this.addObject({
          type: 'image',
          x: (this.canvas.width - width) / 2,
          y: (this.canvas.height - height) / 2,
          width: width,
          height: height,
          src: event.target.result
        });

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
        alert('Error loading background image');
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
      lineWidth: 2
    });

    this.render();
  }

  addObject(obj) {
    if (obj.rotation === undefined) {
      obj.rotation = 0;
    }
    if (!obj.name) {
      obj.name = obj.type.charAt(0).toUpperCase() + obj.type.slice(1) + ' ' + (this.getCurrentFrameObjects().length + 1);
    }
    // Pre-load image if it's an image object
    if (obj.type === 'image' && obj.src && !obj.imageElement) {
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
      if (x >= obj.x && x <= obj.x + obj.width &&
          y >= obj.y && y <= obj.y + obj.height) {
        return obj;
      }
    }
    return null;
  }

  getResizeHandle(x, y) {
    if (this.selectedObjects.length !== 1) return null;

    const obj = this.selectedObjects[0];
    const handleSize = 8;

    const handles = {
      nw: { x: obj.x, y: obj.y },
      ne: { x: obj.x + obj.width, y: obj.y },
      sw: { x: obj.x, y: obj.y + obj.height },
      se: { x: obj.x + obj.width, y: obj.y + obj.height }
    };

    for (const [name, pos] of Object.entries(handles)) {
      if (x >= pos.x - handleSize && x <= pos.x + handleSize &&
          y >= pos.y - handleSize && y <= pos.y + handleSize) {
        return name;
      }
    }

    return null;
  }

  getRotationHandle(x, y) {
    if (this.selectedObjects.length !== 1) return null;

    const obj = this.selectedObjects[0];
    const handleSize = 8;
    const rotateHandleY = obj.y - 20;
    const rotateHandleX = obj.x + obj.width / 2;

    if (x >= rotateHandleX - handleSize && x <= rotateHandleX + handleSize &&
        y >= rotateHandleY - handleSize && y <= rotateHandleY + handleSize) {
      return true;
    }

    return false;
  }

  groupSelectedObjects() {
    if (this.selectedObjects.length < 2) {
      alert('Select at least 2 objects to group');
      return;
    }

    const minX = Math.min(...this.selectedObjects.map(o => o.x));
    const minY = Math.min(...this.selectedObjects.map(o => o.y));
    const maxX = Math.max(...this.selectedObjects.map(o => o.x + o.width));
    const maxY = Math.max(...this.selectedObjects.map(o => o.y + o.height));

    const group = {
      type: 'group',
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      children: [...this.selectedObjects]
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
    if (this.selectedObjects.length !== 1 || this.selectedObjects[0].type !== 'group') {
      alert('Select a single group to ungroup');
      return;
    }

    const group = this.selectedObjects[0];
    const objects = this.getCurrentFrameObjects();
    const index = objects.indexOf(group);

    if (index !== -1) {
      objects.splice(index, 1);
      objects.push(...group.children);
      this.selectedObjects = [...group.children];
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
      alert('No objects selected to copy');
      return;
    }
    this.clipboard = JSON.parse(JSON.stringify(this.selectedObjects));
    alert(`Copied ${this.clipboard.length} object(s)`);
  }

  pasteObjects() {
    if (this.clipboard.length === 0) {
      alert('Nothing to paste');
      return;
    }

    const objects = this.getCurrentFrameObjects();
    const pastedObjects = [];

    for (const obj of this.clipboard) {
      const newObj = JSON.parse(JSON.stringify(obj));
      newObj.x += 20;
      newObj.y += 20;
      newObj.name = (newObj.name || 'Object') + ' (Copy)';

      // Re-load images if needed
      if (newObj.type === 'image' && newObj.src) {
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
      alert('No objects selected to duplicate');
      return;
    }

    this.clipboard = JSON.parse(JSON.stringify(this.selectedObjects));
    this.pasteObjects();
  }

  renameSelectedObject() {
    if (this.selectedObjects.length !== 1) {
      alert('Please select exactly one object to rename');
      return;
    }

    const obj = this.selectedObjects[0];
    
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000;';
    
    const dialog = document.createElement('div');
    dialog.style.cssText = 'background: #2d2d2d; padding: 20px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); min-width: 300px;';
    
    const title = document.createElement('h3');
    title.textContent = 'Rename Object';
    title.style.cssText = 'margin-bottom: 15px; color: #fff;';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = obj.name || '';
    input.style.cssText = 'width: 100%; padding: 8px; background: #3d3d3d; color: #fff; border: 1px solid #555; border-radius: 4px; margin-bottom: 15px; font-size: 14px;';
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding: 8px 16px; background: #3d3d3d; color: #fff; border: none; border-radius: 4px; cursor: pointer;';
    
    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.cssText = 'padding: 8px 16px; background: #0078d4; color: #fff; border: none; border-radius: 4px; cursor: pointer;';
    
    const closeModal = () => {
      document.body.removeChild(modal);
    };
    
    const applyRename = () => {
      const newName = input.value.trim();
      if (newName !== '') {
        obj.name = newName;
        this.render();
      }
      closeModal();
    };
    
    cancelBtn.addEventListener('click', closeModal);
    okBtn.addEventListener('click', applyRename);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        applyRename();
      } else if (e.key === 'Escape') {
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

  addText() {
    // Switch to text tool to draw a text box
    this.setTool('text');
    alert('Click and drag on the canvas to create a text box');
  }

  saveCurrentFrame() {
    // Deep copy the current frame's objects
    const currentFrameState = JSON.parse(JSON.stringify(this.frames[this.currentFrameIndex].objects));

    // Add to history
    this.history.push({
      frames: JSON.parse(JSON.stringify(this.frames)),
      currentFrameIndex: this.currentFrameIndex,
      selectedObjects: JSON.parse(JSON.stringify(this.selectedObjects)),
      backgroundColor: this.backgroundColor,
      backgroundImage: this.backgroundImage ? this.backgroundImage.src : null // Store src for re-loading
    });
    this.historyIndex++;

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
      const prevState = this.history[this.historyIndex];
      this.frames = JSON.parse(JSON.stringify(prevState.frames));
      this.currentFrameIndex = prevState.currentFrameIndex;
      this.selectedObjects = JSON.parse(JSON.stringify(prevState.selectedObjects));
      this.backgroundColor = prevState.backgroundColor;
      this.backgroundImage = prevState.backgroundImage ? new Image() : null;
      if (this.backgroundImage) {
        this.backgroundImage.src = prevState.backgroundImage;
      }
      document.getElementById('backgroundColorPicker').value = this.backgroundColor;
      this.render();
      this.updateTimeline();
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const nextState = this.history[this.historyIndex];
      this.frames = JSON.parse(JSON.stringify(nextState.frames));
      this.currentFrameIndex = nextState.currentFrameIndex;
      this.selectedObjects = JSON.parse(JSON.stringify(nextState.selectedObjects));
      this.backgroundColor = nextState.backgroundColor;
      this.backgroundImage = nextState.backgroundImage ? new Image() : null;
      if (this.backgroundImage) {
        this.backgroundImage.src = nextState.backgroundImage;
      }
      document.getElementById('backgroundColorPicker').value = this.backgroundColor;
      this.render();
      this.updateTimeline();
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw background
    if (this.backgroundImage) {
      this.ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.ctx.fillStyle = this.backgroundColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Onion skin - show light silhouette of previous frame (only when not playing)
    if (this.onionSkinEnabled && this.currentFrameIndex > 0 && !this.isPlaying) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.2;
      this.ctx.strokeStyle = '#888888';
      this.ctx.fillStyle = 'rgba(200, 200, 200, 0.1)';
      this.renderFrame(this.frames[this.currentFrameIndex - 1]);
      this.ctx.restore();
    }

    // Current frame
    this.renderFrame(this.frames[this.currentFrameIndex]);

    // Draw temp canvas (for drawing preview)
    if (this.isDrawing && this.tool === 'pencil') {
      this.ctx.drawImage(this.tempCanvas, 0, 0);
    }

    // Draw text box preview
    if (this.tool === 'text' && this.isDrawing && this.tempTextBox) {
      this.ctx.strokeStyle = '#0078d4';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this.ctx.strokeRect(
        this.tempTextBox.x,
        this.tempTextBox.y,
        this.tempTextBox.width,
        this.tempTextBox.height
      );
      this.ctx.setLineDash([]);
      
      // Show preview text
      this.ctx.fillStyle = this.color;
      this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
      this.ctx.textBaseline = 'top';
      const previewText = this.textContent || 'Enter text...';
      this.ctx.fillText(previewText, this.tempTextBox.x + 5, this.tempTextBox.y + 5);
    }

    // Draw selection box
    if (this.isSelecting && this.selectionBox) {
      const box = this.selectionBox;
      this.ctx.strokeStyle = '#0078d4';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this.ctx.strokeRect(
        Math.min(box.startX, box.endX),
        Math.min(box.startY, box.endY),
        Math.abs(box.endX - box.startX),
        Math.abs(box.endY - box.startY)
      );
      this.ctx.setLineDash([]);
    }

    // Draw selection highlights and resize handles
    if (this.tool === 'mouse' && this.selectedObjects.length > 0) {
      this.ctx.strokeStyle = '#0078d4';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);

      for (const obj of this.selectedObjects) {
        this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
      }

      this.ctx.setLineDash([]);

      // Draw resize handles for single selection
      if (this.selectedObjects.length === 1) {
        const obj = this.selectedObjects[0];
        const handleSize = 8;
        this.ctx.fillStyle = '#0078d4';

        const handles = [
          { x: obj.x, y: obj.y },
          { x: obj.x + obj.width, y: obj.y },
          { x: obj.x, y: obj.y + obj.height },
          { x: obj.x + obj.width, y: obj.y + obj.height }
        ];

        for (const handle of handles) {
          this.ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
        }

        // Draw rotation handle
        const rotateHandleY = obj.y - 20;
        const rotateHandleX = obj.x + obj.width / 2;
        this.ctx.beginPath();
        this.ctx.arc(rotateHandleX, rotateHandleY, handleSize / 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw line connecting rotation handle
        this.ctx.strokeStyle = '#0078d4';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(rotateHandleX, rotateHandleY);
        this.ctx.lineTo(obj.x + obj.width / 2, obj.y);
        this.ctx.stroke();
      }
    }
  }

  renderFrame(frame, ctx = this.ctx) {
    for (const obj of frame.objects) {
      this.renderObject(obj, ctx);
    }
  }

  renderObject(obj, ctx = this.ctx) {
    const rotation = obj.rotation || 0;
    const centerX = obj.x + obj.width / 2;
    const centerY = obj.y + obj.height / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    if (obj.type === 'circle') {
      const currentStroke = ctx.strokeStyle;
      const currentFill = ctx.fillStyle;
      ctx.strokeStyle = currentStroke === '#888888' ? currentStroke : obj.color;
      ctx.fillStyle = currentFill.includes('rgba') ? currentFill : obj.color;
      ctx.lineWidth = obj.lineWidth;
      ctx.beginPath();
      ctx.arc(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (obj.type === 'square') {
      const currentStroke = ctx.strokeStyle;
      const currentFill = ctx.fillStyle;
      ctx.strokeStyle = currentStroke === '#888888' ? currentStroke : obj.color;
      ctx.fillStyle = currentFill.includes('rgba') ? currentFill : obj.color;
      ctx.lineWidth = obj.lineWidth;
      ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
      ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
    } else if (obj.type === 'triangle') {
      const currentStroke = ctx.strokeStyle;
      const currentFill = ctx.fillStyle;
      ctx.strokeStyle = currentStroke === '#888888' ? currentStroke : obj.color;
      ctx.fillStyle = currentFill.includes('rgba') ? currentFill : obj.color;
      ctx.lineWidth = obj.lineWidth;
      ctx.beginPath();
      ctx.moveTo(obj.x + obj.width / 2, obj.y);
      ctx.lineTo(obj.x, obj.y + obj.height);
      ctx.lineTo(obj.x + obj.width, obj.y + obj.height);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (obj.type === 'line') {
      const currentStroke = ctx.strokeStyle;
      ctx.strokeStyle = currentStroke === '#888888' ? currentStroke : obj.color;
      ctx.lineWidth = obj.lineWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(obj.startX, obj.startY);
      ctx.lineTo(obj.endX, obj.endY);
      ctx.stroke();
    } else if (obj.type === 'path') {
      const currentStroke = ctx.strokeStyle;
      ctx.strokeStyle = currentStroke === '#888888' ? currentStroke : obj.color;
      ctx.lineWidth = obj.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(obj.points[0].x, obj.points[0].y);
      for (let i = 1; i < obj.points.length; i++) {
        ctx.lineTo(obj.points[i].x, obj.points[i].y);
      }
      ctx.stroke();
    } else if (obj.type === 'image') {
      if (obj.imageElement) {
        ctx.drawImage(obj.imageElement, obj.x, obj.y, obj.width, obj.height);
      } else if (obj.src) {
        // Fallback: create and cache the image element
        const img = new Image();
        img.onload = () => {
          obj.imageElement = img;
          this.render();
        };
        img.src = obj.src;
      }
    } else if (obj.type === 'text') {
      const currentFill = ctx.fillStyle;
      ctx.fillStyle = currentFill.includes('rgba') ? currentFill : obj.color;
      ctx.font = `${obj.fontSize}px ${obj.fontFamily}`;
      ctx.textBaseline = 'top';
      
      // Word wrap text within the box
      const words = obj.text.split(' ');
      const lines = [];
      let currentLine = '';
      const maxWidth = obj.width - 10; // 5px padding on each side
      
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
      if (currentLine) {
        lines.push(currentLine);
      }
      
      // Draw each line
      const lineHeight = obj.fontSize * 1.2;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], obj.x + 5, obj.y + 5 + (i * lineHeight));
      }
      
      // Draw box outline for reference (optional, can be removed)
      ctx.strokeStyle = 'rgba(0, 120, 212, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
      ctx.setLineDash([]);
    } else if (obj.type === 'group') {
      for (const child of obj.children) {
        this.renderObject(child, ctx);
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
      objects: JSON.parse(JSON.stringify(this.frames[this.currentFrameIndex].objects))
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
    const timeline = document.getElementById('timeline');
    timeline.innerHTML = '';

    this.frames.forEach((frame, index) => {
      const thumbContainer = document.createElement('div');
      thumbContainer.className = 'frame-thumb';
      if (index === this.currentFrameIndex) {
        thumbContainer.classList.add('active');
      }

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 80;
      thumbCanvas.height = 60;
      const thumbCtx = thumbCanvas.getContext('2d');

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.canvas.width;
      tempCanvas.height = this.canvas.height;
      const tempCtx = tempCanvas.getContext('2d');

      // Draw background on temp canvas
      if (this.backgroundImage) {
        tempCtx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
      } else {
        tempCtx.fillStyle = this.backgroundColor;
        tempCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }

      // Render frame objects to temp canvas
      for (const obj of frame.objects) {
        this.renderObject(obj, tempCtx);
      }

      thumbCtx.drawImage(tempCanvas, 0, 0, 80, 60);

      const frameNumber = document.createElement('div');
      frameNumber.className = 'frame-number';
      frameNumber.textContent = index + 1;

      thumbContainer.appendChild(thumbCanvas);
      thumbContainer.appendChild(frameNumber);
      thumbContainer.addEventListener('click', () => this.selectFrame(index));

      timeline.appendChild(thumbContainer);
    });
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    let frameIndex = 0;
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
  }

  saveToCloud() {
    try {
      const projectData = {
        width: this.canvas.width,
        height: this.canvas.height,
        fps: this.fps,
        frames: this.frames,
        backgroundColor: this.backgroundColor,
        backgroundImageSrc: this.backgroundImage ? this.backgroundImage.src : null
      };

      const dataStr = JSON.stringify(projectData);
      localStorage.setItem('animation_project', dataStr);
      alert('Project saved successfully!');
    } catch (error) {
      alert('Error saving: ' + error.message);
    }
  }

  loadFromCloud() {
    try {
      const dataStr = localStorage.getItem('animation_project');
      if (!dataStr) {
        alert('No saved project found!');
        return;
      }

      const projectData = JSON.parse(dataStr);

      this.canvas.width = projectData.width;
      this.canvas.height = projectData.height;
      this.fps = projectData.fps;
      document.getElementById('fpsInput').value = this.fps;

      this.frames = projectData.frames;
      this.currentFrameIndex = 0;
      this.selectedObjects = [];

      this.backgroundColor = projectData.backgroundColor || '#ffffff';
      document.getElementById('backgroundColorPicker').value = this.backgroundColor;

      // Pre-load all images in frames
      const imageLoadPromises = [];
      for (const frame of this.frames) {
        for (const obj of frame.objects) {
          if (obj.type === 'image' && obj.src && !obj.imageElement) {
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
          }
        }
      }

      if (projectData.backgroundImageSrc) {
        const img = new Image();
        img.onload = () => {
          this.backgroundImage = img;
          Promise.all(imageLoadPromises).then(() => {
            this.updateTimeline();
            this.render();
            // Reset history after loading
            this.history = [];
            this.historyIndex = -1;
            this.saveToHistory();
          });
        };
        img.src = projectData.backgroundImageSrc;
      } else {
        this.backgroundImage = null;
        Promise.all(imageLoadPromises).then(() => {
          this.updateTimeline();
          this.render();
          // Reset history after loading
          this.history = [];
          this.historyIndex = -1;
          this.saveToHistory();
        });
      }

      alert('Project loaded successfully!');
    } catch (error) {
      alert('Error loading: ' + error.message);
    }
  }

  downloadProject() {
    const projectData = {
      width: this.canvas.width,
      height: this.canvas.height,
      fps: this.fps,
      frames: this.frames,
      backgroundColor: this.backgroundColor,
      backgroundImageSrc: this.backgroundImage ? this.backgroundImage.src : null
    };

    const dataStr = JSON.stringify(projectData);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'animation_project.json';
    link.click();

    URL.revokeObjectURL(url);
  }

  loadProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const projectData = JSON.parse(event.target.result);

          this.canvas.width = projectData.width;
          this.canvas.height = projectData.height;
          this.fps = projectData.fps;
          document.getElementById('fpsInput').value = this.fps;

          this.frames = projectData.frames;
          this.currentFrameIndex = 0;
          this.selectedObjects = [];

          this.backgroundColor = projectData.backgroundColor || '#ffffff';
          document.getElementById('backgroundColorPicker').value = this.backgroundColor;

          if (projectData.backgroundImageSrc) {
            const img = new Image();
            img.onload = () => {
              this.backgroundImage = img;
              this.render();
            };
            img.src = projectData.backgroundImageSrc;
          } else {
            this.backgroundImage = null;
          }

          this.updateTimeline();
          this.render();
          // Reset history after loading
          this.history = [];
          this.historyIndex = -1;
          this.saveToHistory();
        } catch (error) {
          alert('Error loading project: ' + error.message);
        }
      };

      reader.readAsText(file);
    });

    input.click();
  }

  async uploadAnimation(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.includes('webm')) {
      alert('Please upload a WebM video file');
      return;
    }

    try {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });

      // Extract frames from video
      const extractCanvas = document.createElement('canvas');
      const extractCtx = extractCanvas.getContext('2d');

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
        const time = (i / frameRate);
        video.currentTime = time;

        await new Promise((resolve) => {
          video.onseeked = resolve;
        });

        // Draw current video frame to canvas
        extractCtx.drawImage(video, 0, 0, extractCanvas.width, extractCanvas.height);

        // Convert canvas to image and create frame object
        const imageData = extractCanvas.toDataURL('image/png');

        const frame = {
          objects: [{
            type: 'image',
            x: 0,
            y: 0,
            width: extractCanvas.width,
            height: extractCanvas.height,
            src: imageData,
            rotation: 0
          }]
        };

        this.frames.push(frame);
      }

      URL.revokeObjectURL(video.src);

      this.currentFrameIndex = 0;
      this.selectedObjects = [];
      this.fps = frameRate;
      document.getElementById('fpsInput').value = this.fps;

      this.updateTimeline();
      this.render();

      alert(`Animation loaded successfully! ${frameCount} frames extracted.`);
    } catch (error) {
      alert('Error loading animation: ' + error.message);
    }
  }

  async exportGIF() {
    if (this.frames.length === 0) {
      alert('No frames to export!');
      return;
    }

    try {
      // Pre-load all images before recording
      const imagePromises = [];
      for (const frame of this.frames) {
        for (const obj of frame.objects) {
          if (obj.type === 'image') {
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
          } else if (obj.type === 'group') {
            for (const child of obj.children) {
              if (child.type === 'image') {
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
      const mimeType = 'video/webm';

      const stream = this.canvas.captureStream(this.fps);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 5000000
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

        const link = document.createElement('a');
        link.href = url;
        link.download = 'animation.webm';
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
          this.ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
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
      alert('Error exporting video: ' + error.message + '\n\nNote: Your browser may not support video export. Try Chrome or Edge.');
    }
  }

  renderObjectForExport(obj) {
    const rotation = obj.rotation || 0;
    const centerX = obj.x + obj.width / 2;
    const centerY = obj.y + obj.height / 2;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(rotation * Math.PI / 180);
    this.ctx.translate(-centerX, -centerY);

    if (obj.type === 'circle') {
      this.ctx.strokeStyle = obj.color;
      this.ctx.fillStyle = obj.color;
      this.ctx.lineWidth = obj.lineWidth;
      this.ctx.beginPath();
      this.ctx.arc(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.width / 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    } else if (obj.type === 'square') {
      this.ctx.strokeStyle = obj.color;
      this.ctx.fillStyle = obj.color;
      this.ctx.lineWidth = obj.lineWidth;
      this.ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
      this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
    } else if (obj.type === 'triangle') {
      this.ctx.strokeStyle = obj.color;
      this.ctx.fillStyle = obj.color;
      this.ctx.lineWidth = obj.lineWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(obj.x + obj.width / 2, obj.y);
      this.ctx.lineTo(obj.x, obj.y + obj.height);
      this.ctx.lineTo(obj.x + obj.width, obj.y + obj.height);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    } else if (obj.type === 'line') {
      this.ctx.strokeStyle = obj.color;
      this.ctx.lineWidth = obj.lineWidth;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(obj.startX, obj.startY);
      this.ctx.lineTo(obj.endX, obj.endY);
      this.ctx.stroke();
    } else if (obj.type === 'path') {
      this.ctx.strokeStyle = obj.color;
      this.ctx.lineWidth = obj.lineWidth;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(obj.points[0].x, obj.points[0].y);
      for (let i = 1; i < obj.points.length; i++) {
        this.ctx.lineTo(obj.points[i].x, obj.points[i].y);
      }
      this.ctx.stroke();
    } else if (obj.type === 'image') {
      if (obj.imageElement) {
        this.ctx.drawImage(obj.imageElement, obj.x, obj.y, obj.width, obj.height);
      }
    } else if (obj.type === 'text') {
      this.ctx.fillStyle = obj.color;
      this.ctx.font = `${obj.fontSize}px ${obj.fontFamily}`;
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(obj.text, obj.x, obj.y);
    } else if (obj.type === 'group') {
      for (const child of obj.children) {
        this.renderObjectForExport(child);
      }
    }

    this.ctx.restore();
  }
}

const app = new AnimationStudio();