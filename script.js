
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
    
    this.initializeEventListeners();
    this.render();
    this.updateTimeline();
  }
  
  createEmptyFrame() {
    const canvas = document.createElement('canvas');
    canvas.width = this.canvas.width;
    canvas.height = this.canvas.height;
    return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  }
  
  initializeEventListeners() {
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
    document.getElementById('smartDrawBtn').addEventListener('click', () => this.setTool('smartdraw'));
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
    } else if (tool === 'smartdraw') {
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
    
    this.isDrawing = true;
    this.lastX = pos.x;
    this.lastY = pos.y;
    
    if (this.tool === 'smartdraw') {
      this.drawPoints = [{ x: pos.x, y: pos.y }];
      this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
    }
  }
  
  draw(e) {
    if (!this.isDrawing) return;
    
    const pos = this.getMousePos(e);
    
    if (this.tool === 'smartdraw') {
      this.drawPoints.push({ x: pos.x, y: pos.y });
      
      // Draw temporary preview
      this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
      this.tempCtx.strokeStyle = this.color;
      this.tempCtx.lineWidth = this.brushSize;
      this.tempCtx.lineCap = 'round';
      this.tempCtx.lineJoin = 'round';
      this.tempCtx.globalCompositeOperation = 'source-over';
      
      this.tempCtx.beginPath();
      this.tempCtx.moveTo(this.drawPoints[0].x, this.drawPoints[0].y);
      for (let i = 1; i < this.drawPoints.length; i++) {
        this.tempCtx.lineTo(this.drawPoints[i].x, this.drawPoints[i].y);
      }
      this.tempCtx.stroke();
      
      // Overlay temp canvas on main canvas
      const currentFrame = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.putImageData(currentFrame, 0, 0);
      this.ctx.drawImage(this.tempCanvas, 0, 0);
      
      return;
    }
    
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(pos.x, pos.y);
    
    if (this.tool === 'pencil') {
      this.ctx.strokeStyle = this.color;
      this.ctx.globalCompositeOperation = 'source-over';
    } else if (this.tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
    }
    
    this.ctx.lineWidth = this.brushSize;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.stroke();
    
    this.lastX = pos.x;
    this.lastY = pos.y;
  }
  
  stopDrawing() {
    if (this.isDrawing) {
      this.isDrawing = false;
      
      if (this.tool === 'smartdraw' && this.drawPoints.length > 2) {
        this.recognizeAndDrawShape();
      }
      
      this.saveCurrentFrame();
    }
  }
  
  recognizeAndDrawShape() {
    if (this.drawPoints.length < 5) return;
    
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
      
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = this.color;
      this.ctx.lineWidth = this.brushSize;
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.stroke();
    } else {
      // Check if it's a straight line
      const isLine = this.isApproximatelyLine();
      
      if (isLine) {
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.strokeStyle = this.color;
        this.ctx.lineWidth = this.brushSize;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(firstPoint.x, firstPoint.y);
        this.ctx.lineTo(lastPoint.x, lastPoint.y);
        this.ctx.stroke();
      } else {
        // Draw as freehand
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.strokeStyle = this.color;
        this.ctx.lineWidth = this.brushSize;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(this.drawPoints[0].x, this.drawPoints[0].y);
        for (let i = 1; i < this.drawPoints.length; i++) {
          this.ctx.lineTo(this.drawPoints[i].x, this.drawPoints[i].y);
        }
        this.ctx.stroke();
      }
    }
    
    this.drawPoints = [];
  }
  
  isApproximatelyLine() {
    if (this.drawPoints.length < 5) return false;
    
    const firstPoint = this.drawPoints[0];
    const lastPoint = this.drawPoints[this.drawPoints.length - 1];
    
    // Calculate the ideal line
    const dx = lastPoint.x - firstPoint.x;
    const dy = lastPoint.y - firstPoint.y;
    const lineLength = Math.sqrt(dx * dx + dy * dy);
    
    if (lineLength < 20) return false;
    
    // Check how much points deviate from the line
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
    
    // Convert hex color to RGB
    const r = parseInt(this.color.substr(1, 2), 16);
    const g = parseInt(this.color.substr(3, 2), 16);
    const b = parseInt(this.color.substr(5, 2), 16);
    
    const getPixelIndex = (x, y) => (y * this.canvas.width + x) * 4;
    
    const startIndex = getPixelIndex(startX, startY);
    const targetR = pixels[startIndex];
    const targetG = pixels[startIndex + 1];
    const targetB = pixels[startIndex + 2];
    const targetA = pixels[startIndex + 3];
    
    // Don't fill if clicking on the same color
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
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.saveCurrentFrame();
    this.render();
  }
  
  uploadImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const width = Math.min(img.width, 300);
        const height = (img.height / img.width) * width;
        
        this.ctx.drawImage(img, centerX - width / 2, centerY - height / 2, width, height);
        this.saveCurrentFrame();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
  
  insertShape(shape) {
    this.selectedShape = shape;
    document.getElementById('resizeControls').style.display = 'block';
    this.drawShape(shape, this.shapeWidth, this.shapeHeight);
    this.saveCurrentFrame();
  }
  
  drawShape(shape, width, height) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    this.ctx.fillStyle = this.color;
    this.ctx.strokeStyle = this.color;
    this.ctx.lineWidth = 2;
    
    if (shape === 'circle') {
      const radius = Math.min(width, height) / 2;
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    } else if (shape === 'square') {
      this.ctx.fillRect(centerX - width / 2, centerY - height / 2, width, height);
      this.ctx.strokeRect(centerX - width / 2, centerY - height / 2, width, height);
    } else if (shape === 'triangle') {
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY - height / 2);
      this.ctx.lineTo(centerX - width / 2, centerY + height / 2);
      this.ctx.lineTo(centerX + width / 2, centerY + height / 2);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    }
  }
  
  saveCurrentFrame() {
    this.frames[this.currentFrameIndex] = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.updateTimeline();
  }
  
  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Onion skin
    if (this.onionSkinEnabled && this.currentFrameIndex > 0) {
      this.ctx.globalAlpha = 0.3;
      this.ctx.putImageData(this.frames[this.currentFrameIndex - 1], 0, 0);
      this.ctx.globalAlpha = 1.0;
    }
    
    // Current frame
    this.ctx.putImageData(this.frames[this.currentFrameIndex], 0, 0);
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
    const duplicatedFrame = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.frames.splice(this.currentFrameIndex + 1, 0, duplicatedFrame);
    this.currentFrameIndex++;
    this.updateTimeline();
  }
  
  selectFrame(index) {
    this.currentFrameIndex = index;
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
      tempCtx.putImageData(frame, 0, 0);
      
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
        frames: this.frames.map(frame => Array.from(frame.data))
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
      
      this.frames = projectData.frames.map(frameData => {
        const imageData = this.ctx.createImageData(projectData.width, projectData.height);
        imageData.data.set(frameData);
        return imageData;
      });
      
      this.currentFrameIndex = 0;
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
      frames: this.frames.map(frame => {
        return Array.from(frame.data);
      })
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
          
          this.frames = projectData.frames.map(frameData => {
            const imageData = this.ctx.createImageData(projectData.width, projectData.height);
            imageData.data.set(frameData);
            return imageData;
          });
          
          this.currentFrameIndex = 0;
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
  
  exportGIF() {
    alert('GIF export functionality:\n\nTo export as GIF, you would need a GIF encoding library. For now, you can:\n\n1. Save your project to cloud or download as JSON\n2. Use the Play feature to view your animation\n3. Use screen recording software to capture the animation\n\nAlternatively, frames are saved and can be exported individually by right-clicking the canvas during playback.');
  }
}

// Initialize the application
const app = new AnimationStudio();
