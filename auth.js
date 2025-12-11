class AuthManager {
  constructor(studio) {
    this.studio = studio;
    this.token = localStorage.getItem('auth_token');
    this.username = localStorage.getItem('username');
    this.currentProject = null;
  }

  async apiCall(endpoint, method = 'GET', body = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (this.token) {
      options.headers['Authorization'] = this.token;
    }

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`/api${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  async register(username, password) {
    const data = await this.apiCall('/register', 'POST', { username, password });
    return data;
  }

  async login(username, password) {
    const data = await this.apiCall('/login', 'POST', { username, password });
    this.token = data.token;
    this.username = data.username;
    localStorage.setItem('auth_token', this.token);
    localStorage.setItem('username', this.username);
    return data;
  }

  async logout() {
    try {
      await this.apiCall('/logout', 'POST');
    } catch (e) {
      console.error('Logout error:', e);
    }
    this.token = null;
    this.username = null;
    this.currentProject = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('username');
    localStorage.removeItem('current_project');
    window.location.href = 'login.html';
  }

  async verify() {
    if (!this.token) return false;
    try {
      await this.apiCall('/verify');
      return true;
    } catch (e) {
      this.logout();
      return false;
    }
  }

  async getProjects() {
    const data = await this.apiCall('/projects');
    return data.projects;
  }

  async saveProject(projectName) {
    const projectData = {
      width: this.studio.canvas.width,
      height: this.studio.canvas.height,
      fps: this.studio.fps,
      frames: this.studio.frames,
      backgroundColor: this.studio.backgroundColor,
      backgroundImageSrc: this.studio.backgroundImage ? this.studio.backgroundImage.src : null
    };

    await this.apiCall('/projects', 'POST', { projectName, projectData });
    this.currentProject = projectName;
    localStorage.setItem('current_project', projectName);
  }

  async loadProject(projectName) {
    const data = await this.apiCall(`/projects/${encodeURIComponent(projectName)}`);
    const projectData = data.project.data;

    this.studio.canvas.width = projectData.width;
    this.studio.canvas.height = projectData.height;
    this.studio.fps = projectData.fps;
    document.getElementById('fpsInput').value = this.studio.fps;

    this.studio.frames = projectData.frames;
    this.studio.currentFrameIndex = 0;
    this.studio.selectedObjects = [];

    this.studio.backgroundColor = projectData.backgroundColor || '#ffffff';
    document.getElementById('backgroundColorPicker').value = this.studio.backgroundColor;

    const imageLoadPromises = [];
    for (const frame of this.studio.frames) {
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
        this.studio.backgroundImage = img;
        Promise.all(imageLoadPromises).then(() => {
          this.studio.updateTimeline();
          this.studio.render();
          this.studio.history = [];
          this.studio.historyIndex = -1;
          this.studio.saveCurrentFrame();
        });
      };
      img.src = projectData.backgroundImageSrc;
    } else {
      this.studio.backgroundImage = null;
      Promise.all(imageLoadPromises).then(() => {
        this.studio.updateTimeline();
        this.studio.render();
        this.studio.history = [];
        this.studio.historyIndex = -1;
        this.studio.saveCurrentFrame();
      });
    }

    this.currentProject = projectName;
    localStorage.setItem('current_project', projectName);
  }

  async deleteProject(projectName) {
    await this.apiCall(`/projects/${encodeURIComponent(projectName)}`, 'DELETE');
    if (this.currentProject === projectName) {
      this.currentProject = null;
      localStorage.removeItem('current_project');
    }
  }

  async renameProject(oldName, newName) {
    await this.apiCall(`/projects/${encodeURIComponent(oldName)}`, 'PUT', { newName });
    if (this.currentProject === oldName) {
      this.currentProject = newName;
      localStorage.setItem('current_project', newName);
    }
  }

  showNotification(message, type = 'info') {
    const notificationContainer = document.getElementById('notificationContainer') || this.createNotificationContainer();
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      padding: 10px 15px;
      margin-bottom: 10px;
      border-radius: 4px;
      color: white;
      font-size: 14px;
      opacity: 0;
      transition: opacity 0.3s ease-in-out;
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10001;
    `;

    if (type === 'success') {
      notification.style.backgroundColor = '#28a745';
    } else if (type === 'error') {
      notification.style.backgroundColor = '#dc3545';
    } else {
      notification.style.backgroundColor = '#007bff';
    }

    notificationContainer.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.addEventListener('transitionend', () => {
        notification.remove();
        if (notificationContainer.children.length === 0) {
          notificationContainer.remove();
        }
      });
    }, 3000);
  }

  createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notificationContainer';
    container.style.cssText = 'position: fixed; top: 20px; left: 0; width: 100%; display: flex; flex-direction: column; align-items: center; z-index: 10001;';
    document.body.appendChild(container);
    return container;
  }

  showAuthDialog() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;';

    const dialog = document.createElement('div');
    dialog.style.cssText = 'background: #2d2d2d; padding: 30px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); min-width: 350px;';

    const title = document.createElement('h2');
    title.textContent = 'Login / Register';
    title.style.cssText = 'margin-bottom: 20px; color: #fff; text-align: center;';

    const usernameInput = document.createElement('input');
    usernameInput.type = 'text';
    usernameInput.placeholder = 'Username (min 3 chars)';
    usernameInput.style.cssText = 'width: 100%; padding: 10px; background: #3d3d3d; color: #fff; border: 1px solid #555; border-radius: 4px; margin-bottom: 15px; font-size: 14px;';

    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.placeholder = 'Password (min 6 chars)';
    passwordInput.style.cssText = 'width: 100%; padding: 10px; background: #3d3d3d; color: #fff; border: 1px solid #555; border-radius: 4px; margin-bottom: 20px; font-size: 14px;';

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 10px;';

    const loginBtn = document.createElement('button');
    loginBtn.textContent = 'Login';
    loginBtn.style.cssText = 'flex: 1; padding: 10px; background: #0078d4; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;';

    const registerBtn = document.createElement('button');
    registerBtn.textContent = 'Register';
    registerBtn.style.cssText = 'flex: 1; padding: 10px; background: #28a745; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'width: 100%; margin-top: 10px; padding: 10px; background: #3d3d3d; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;';

    const handleAuth = async (isLogin) => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      try {
        if (isLogin) {
          await this.login(username, password);
          this.showNotification(`Welcome back, ${username}!`, 'success');
        } else {
          await this.register(username, password);
          this.showNotification(`Account created for ${username}. Please log in.`, 'success');
          return;
        }
        this.safeRemoveModal(modal);
        this.showProjectDialog();
      } catch (e) {
        this.showNotification(e.message, 'error');
      }
    };

    loginBtn.addEventListener('click', () => handleAuth(true));
    registerBtn.addEventListener('click', () => handleAuth(false));
    cancelBtn.addEventListener('click', () => this.safeRemoveModal(modal));

    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAuth(true);
    });

    buttonContainer.appendChild(loginBtn);
    buttonContainer.appendChild(registerBtn);
    dialog.appendChild(title);
    dialog.appendChild(usernameInput);
    dialog.appendChild(passwordInput);
    dialog.appendChild(buttonContainer);
    dialog.appendChild(cancelBtn);
    modal.appendChild(dialog);
    document.body.appendChild(modal);

    usernameInput.focus();
  }

  async showProjectDialog() {
    const projects = await this.getProjects();

    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;';

    const dialog = document.createElement('div');
    dialog.style.cssText = 'background: #2d2d2d; padding: 30px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); min-width: 400px; max-width: 600px; max-height: 80vh; overflow-y: auto;';

    const title = document.createElement('h2');
    title.textContent = `Projects (${projects.length}/10)`;
    title.style.cssText = 'margin-bottom: 20px; color: #fff;';

    const userInfo = document.createElement('div');
    userInfo.textContent = `Logged in as: ${this.username}`;
    userInfo.style.cssText = 'margin-bottom: 15px; color: #aaa; font-size: 14px;';

    const projectList = document.createElement('div');
    projectList.style.cssText = 'margin-bottom: 20px;';

    if (projects.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = 'No projects yet. Save your current work or create a new project.';
      emptyMsg.style.cssText = 'color: #aaa; font-style: italic;';
      projectList.appendChild(emptyMsg);
    } else {
      projects.forEach(project => {
        const projectItem = document.createElement('div');
        projectItem.style.cssText = 'background: #3d3d3d; padding: 12px; border-radius: 4px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;';

        const projectNameSpan = document.createElement('span');
        projectNameSpan.textContent = project.name;
        projectNameSpan.style.cssText = 'color: #fff; flex: 1;';

        const projectDate = document.createElement('span');
        projectDate.textContent = new Date(project.updatedAt).toLocaleString();
        projectDate.style.cssText = 'color: #aaa; font-size: 12px; margin: 0 10px;';

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 5px;';

        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Load';
        loadBtn.style.cssText = 'padding: 6px 12px; background: #0078d4; color: #fff; border: none; border-radius: 4px; cursor: pointer;';
        loadBtn.addEventListener('click', async () => {
          try {
            await this.loadProject(project.name);
            this.showNotification(`Project "${project.name}" loaded!`, 'success');
            this.safeRemoveModal(modal);
          } catch (e) {
            this.showNotification(e.message, 'error');
          }
        });

        const renameInput = document.createElement('input');
        renameInput.type = 'text';
        renameInput.value = project.name;
        renameInput.style.cssText = 'display: none; padding: 6px; background: #3d3d3d; color: #fff; border: 1px solid #555; border-radius: 4px;';

        const renameBtn = document.createElement('button');
        renameBtn.textContent = 'Rename';
        renameBtn.style.cssText = 'padding: 6px 12px; background: #ffc107; color: #000; border: none; border-radius: 4px; cursor: pointer;';
        renameBtn.addEventListener('click', () => {
          projectNameSpan.style.display = 'none';
          projectDate.style.display = 'none';
          renameBtn.style.display = 'none';
          deleteBtn.style.display = 'none';
          loadBtn.style.display = 'none';
          renameInput.style.display = 'inline-block';
          renameInput.focus();
          renameInput.select();
        });

        const saveRenameBtn = document.createElement('button');
        saveRenameBtn.textContent = 'Save';
        saveRenameBtn.style.cssText = 'display: none; padding: 6px 12px; background: #28a745; color: #fff; border: none; border-radius: 4px; cursor: pointer;';
        saveRenameBtn.addEventListener('click', async () => {
          const newName = renameInput.value.trim();
          if (newName && newName !== project.name) {
            try {
              await this.renameProject(project.name, newName);
              this.showNotification(`Project renamed to "${newName}"!`, 'success');
              project.name = newName; // Update in-memory object
              projectNameSpan.textContent = newName;
              projectNameSpan.style.display = 'block';
              renameInput.style.display = 'none';
              renameBtn.style.display = 'inline-block';
              deleteBtn.style.display = 'inline-block';
              loadBtn.style.display = 'inline-block';
              projectDate.style.display = 'block';
            } catch (e) {
              this.showNotification(e.message, 'error');
            }
          } else {
            projectNameSpan.style.display = 'block';
            renameInput.style.display = 'none';
            renameBtn.style.display = 'inline-block';
            deleteBtn.style.display = 'inline-block';
            loadBtn.style.display = 'inline-block';
            projectDate.style.display = 'block';
          }
        });

        renameInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') saveRenameBtn.click();
          if (e.key === 'Escape') {
            projectNameSpan.style.display = 'block';
            renameInput.style.display = 'none';
            renameBtn.style.display = 'inline-block';
            deleteBtn.style.display = 'inline-block';
            loadBtn.style.display = 'inline-block';
            projectDate.style.display = 'block';
            renameInput.value = project.name;
          }
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.style.cssText = 'padding: 6px 12px; background: #dc3545; color: #fff; border: none; border-radius: 4px; cursor: pointer;';
        deleteBtn.addEventListener('click', async () => {
          if (confirm(`Delete project "${project.name}"?`)) {
            try {
              await this.deleteProject(project.name);
              this.showNotification('Project deleted!', 'success');
              projectItem.remove();
              if (projectList.children.length === 0) {
                const emptyMsg = document.createElement('p');
                emptyMsg.textContent = 'No projects yet. Save your current work or create a new project.';
                emptyMsg.style.cssText = 'color: #aaa; font-style: italic;';
                projectList.appendChild(emptyMsg);
              }
              if (this.currentProject === project.name) {
                this.currentProject = null;
                localStorage.removeItem('current_project');
              }
            } catch (e) {
              this.showNotification(e.message, 'error');
            }
          }
        });

        buttonContainer.appendChild(loadBtn);
        buttonContainer.appendChild(renameBtn);
        buttonContainer.appendChild(saveRenameBtn);
        buttonContainer.appendChild(deleteBtn);

        projectItem.appendChild(projectNameSpan);
        projectItem.appendChild(projectDate);
        projectItem.appendChild(renameInput);
        projectItem.appendChild(buttonContainer);
        projectList.appendChild(projectItem);
      });
    }

    const newProjectInput = document.createElement('input');
    newProjectInput.type = 'text';
    newProjectInput.placeholder = 'New project name...';
    newProjectInput.style.cssText = 'width: 100%; padding: 10px; background: #3d3d3d; color: #fff; border: 1px solid #555; border-radius: 4px; margin-bottom: 15px; font-size: 14px;';

    const actionButtonContainer = document.createElement('div');
    actionButtonContainer.style.cssText = 'display: flex; gap: 10px;';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = this.currentProject ? 'Update Current' : 'Save New';
    saveBtn.style.cssText = 'flex: 1; padding: 10px; background: #28a745; color: #fff; border: none; border-radius: 4px; cursor: pointer;';
    saveBtn.addEventListener('click', async () => {
      const projectName = newProjectInput.value.trim() || this.currentProject;
      if (!projectName) {
        this.showNotification('Please enter a project name', 'error');
        return;
      }
      try {
        await this.saveProject(projectName);
        this.showNotification(`Project "${projectName}" saved!`, 'success');
        this.safeRemoveModal(modal);
      } catch (e) {
        this.showNotification(e.message, 'error');
      }
    });

    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = 'Logout';
    logoutBtn.style.cssText = 'flex: 1; padding: 10px; background: #dc3545; color: #fff; border: none; border-radius: 4px; cursor: pointer;';
    logoutBtn.addEventListener('click', async () => {
      await this.logout();
      this.showNotification('Logged out successfully', 'success');
      this.safeRemoveModal(modal);
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'width: 100%; margin-top: 10px; padding: 10px; background: #3d3d3d; color: #fff; border: none; border-radius: 4px; cursor: pointer;';
    closeBtn.addEventListener('click', () => this.safeRemoveModal(modal));

    actionButtonContainer.appendChild(saveBtn);
    actionButtonContainer.appendChild(logoutBtn);
    dialog.appendChild(title);
    dialog.appendChild(userInfo);
    dialog.appendChild(projectList);
    dialog.appendChild(newProjectInput);
    dialog.appendChild(actionButtonContainer);
    dialog.appendChild(closeBtn);
    modal.appendChild(dialog);
    document.body.appendChild(modal);

    if (this.currentProject) {
      newProjectInput.value = this.currentProject;
    }
  }

  safeRemoveModal(modal) {
    if (modal && modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
  }
}