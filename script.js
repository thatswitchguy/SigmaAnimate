
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
    this.isDrawing = true;
    const pos = this.getMousePos(e);
    this.lastX = pos.x;
    this.lastY = pos.y;
  }
  
  draw(e) {
    if (!this.isDrawing) return;
    
    const pos = this.getMousePos(e);
    
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
      this.saveCurrentFrame();
    }
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
