
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
    
    this.lastX = 0;
    this.lastY = 0;
    
    this.selectedShape = null;
    this.shapeWidth = 100;
    this.shapeHeight = 100;
    
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
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.resizeHandle = null;
    this.selectionBox = null;
    this.isSelecting = false;
    
    this.initializeEventListeners();
    this.render();
    this.updateTimeline();
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
    
    // File controls
    document.getElementById('cloudSaveBtn').addEventListener('click', () => this.saveToCloud());
    document.getElementById('cloudLoadBtn').addEventListener('click', () => this.loadFromCloud());
    document.getElementById('downloadBtn').addEventListener('click', () => this.downloadProject());
    document.getElementById('loadBtn').addEventListener('click', () => this.loadProject());
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
  }
  
  setTool(tool) {
    this.tool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    if (tool === 'pencil') {
      document.getElementById('pencilBtn').classList.add('active');
    } else if (tool === 'mouse') {
      document.getElementById('smartDrawBtn').classList.add('active');
    } else if (tool === 'fill') {
      document.getElementById('fillBtn').classList.add('active');
    } else if (tool === 'eraser') {
      document.getElementById('eraserBtn').classList.add('active');
    }
  }
  
  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }
  
  startDrawing(e) {
    const pos = this.getMousePos(e);
    
    if (this.tool === 'fill') {
      this.floodFill(Math.floor(pos.x), Math.floor(pos.y));
      this.saveCurrentFrame();
      return;
    }
    
    if (this.tool === 'mouse') {
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
    
    if (this.tool === 'mouse') {
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
    if (this.tool === 'mouse') {
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
  
  saveCurrentFrame() {
    this.updateTimeline();
  }
  
  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
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
      }
    }
  }
  
  renderFrame(frame) {
    for (const obj of frame.objects) {
      this.renderObject(obj);
    }
  }
  
  renderObject(obj) {
    if (obj.type === 'circle') {
      const currentStroke = this.ctx.strokeStyle;
      const currentFill = this.ctx.fillStyle;
      this.ctx.strokeStyle = currentStroke === '#888888' ? currentStroke : obj.color;
      this.ctx.fillStyle = currentFill.includes('rgba') ? currentFill : obj.color;
      this.ctx.lineWidth = obj.lineWidth;
      this.ctx.beginPath();
      this.ctx.arc(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.width / 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    } else if (obj.type === 'square') {
      const currentStroke = this.ctx.strokeStyle;
      const currentFill = this.ctx.fillStyle;
      this.ctx.strokeStyle = currentStroke === '#888888' ? currentStroke : obj.color;
      this.ctx.fillStyle = currentFill.includes('rgba') ? currentFill : obj.color;
      this.ctx.lineWidth = obj.lineWidth;
      this.ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
      this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
    } else if (obj.type === 'triangle') {
      const currentStroke = this.ctx.strokeStyle;
      const currentFill = this.ctx.fillStyle;
      this.ctx.strokeStyle = currentStroke === '#888888' ? currentStroke : obj.color;
      this.ctx.fillStyle = currentFill.includes('rgba') ? currentFill : obj.color;
      this.ctx.lineWidth = obj.lineWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(obj.x + obj.width / 2, obj.y);
      this.ctx.lineTo(obj.x, obj.y + obj.height);
      this.ctx.lineTo(obj.x + obj.width, obj.y + obj.height);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    } else if (obj.type === 'line') {
      const currentStroke = this.ctx.strokeStyle;
      this.ctx.strokeStyle = currentStroke === '#888888' ? currentStroke : obj.color;
      this.ctx.lineWidth = obj.lineWidth;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(obj.startX, obj.startY);
      this.ctx.lineTo(obj.endX, obj.endY);
      this.ctx.stroke();
    } else if (obj.type === 'path') {
      const currentStroke = this.ctx.strokeStyle;
      this.ctx.strokeStyle = currentStroke === '#888888' ? currentStroke : obj.color;
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
      const img = new Image();
      img.src = obj.src;
      this.ctx.drawImage(img, obj.x, obj.y, obj.width, obj.height);
    } else if (obj.type === 'group') {
      for (const child of obj.children) {
        this.renderObject(child);
      }
    }
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
      
      for (const obj of frame.objects) {
        this.ctx = tempCtx;
        this.renderObject(obj);
        this.ctx = this.canvas.getContext('2d');
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
        frames: this.frames
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
      this.updateTimeline();
      this.render();
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
      frames: this.frames
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
          this.updateTimeline();
          this.render();
        } catch (error) {
          alert('Error loading project: ' + error.message);
        }
      };
      
      reader.readAsText(file);
    });
    
    input.click();
  }
  
  async exportGIF() {
    if (this.frames.length === 0) {
      alert('No frames to export!');
      return;
    }

    try {
      // Create a video stream from the canvas
      const stream = this.canvas.captureStream(this.fps);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000
      });

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
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

      // Play through all frames twice to ensure smooth recording
      const totalCycles = 2;
      let currentCycle = 0;
      let frameIndex = 0;

      const recordInterval = setInterval(() => {
        this.currentFrameIndex = frameIndex;
        
        // Render frame directly to canvas without updating timeline
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.renderFrame(this.frames[this.currentFrameIndex]);
        
        frameIndex++;
        if (frameIndex >= this.frames.length) {
          frameIndex = 0;
          currentCycle++;
          
          if (currentCycle >= totalCycles) {
            clearInterval(recordInterval);
            // Wait a bit before stopping to ensure last frame is captured
            setTimeout(() => {
              mediaRecorder.stop();
            }, 100);
          }
        }
      }, 1000 / this.fps);

    } catch (error) {
      alert('Error exporting video: ' + error.message + '\n\nTry using Chrome or Edge for best compatibility.');
    }
  }
}

const app = new AnimationStudio();
