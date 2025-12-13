
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const Database = require('@replit/database');

const app = express();
const db = new Database();

app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static('.'));

// Hash password helper
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Generate session token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Session storage (in-memory for this example)
const sessions = new Map();

// Middleware to verify session
function requireAuth(req, res, next) {
  const token = req.headers['authorization'];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.username = sessions.get(token);
  next();
}

// Register new user
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: 'Username must be 3+ chars, password 6+ chars' });
  }
  
  const userKey = `user:${username}`;
  const existingUser = await db.get(userKey);
  
  if (existingUser) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  
  const hashedPassword = hashPassword(password);
  await db.set(userKey, {
    username,
    password: hashedPassword,
    createdAt: Date.now()
  });
  
  res.json({ success: true, message: 'Account created successfully' });
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  const userKey = `user:${username}`;
  const user = await db.get(userKey);
  
  if (!user || user.password !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  
  const token = generateToken();
  sessions.set(token, username);
  
  res.json({ success: true, token, username });
});

// Logout
app.post('/api/logout', requireAuth, (req, res) => {
  const token = req.headers['authorization'];
  sessions.delete(token);
  res.json({ success: true });
});

// Get user's projects
app.get('/api/projects', requireAuth, async (req, res) => {
  const projectsKey = `projects:${req.username}`;
  const projects = await db.get(projectsKey) || [];
  res.json({ projects });
});

// Save project
app.post('/api/projects', requireAuth, async (req, res) => {
  const { projectName, projectData } = req.body;
  
  if (!projectName) {
    return res.status(400).json({ error: 'Project name required' });
  }
  
  const projectsKey = `projects:${req.username}`;
  const projects = await db.get(projectsKey) || [];
  
  if (projects.length >= 10 && !projects.find(p => p.name === projectName)) {
    return res.status(400).json({ error: 'Maximum 10 projects per account' });
  }
  
  const existingIndex = projects.findIndex(p => p.name === projectName);
  const project = {
    name: projectName,
    data: projectData,
    updatedAt: Date.now()
  };
  
  if (existingIndex >= 0) {
    projects[existingIndex] = project;
  } else {
    projects.push(project);
  }
  
  await db.set(projectsKey, projects);
  res.json({ success: true, project });
});

// Load specific project
app.get('/api/projects/:projectName', requireAuth, async (req, res) => {
  const projectName = decodeURIComponent(req.params.projectName);
  const projectsKey = `projects:${req.username}`;
  const projects = await db.get(projectsKey) || [];
  
  const project = projects.find(p => p.name === projectName);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  res.json({ project });
});

// Rename project
app.put('/api/projects/:projectName', requireAuth, async (req, res) => {
  const projectName = decodeURIComponent(req.params.projectName);
  const { newName } = req.body;
  
  if (!newName || newName.trim() === '') {
    return res.status(400).json({ error: 'New project name required' });
  }
  
  const projectsKey = `projects:${req.username}`;
  const projects = await db.get(projectsKey) || [];
  
  const projectIndex = projects.findIndex(p => p.name === projectName);
  
  if (projectIndex === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  if (projects.some(p => p.name === newName && p.name !== projectName)) {
    return res.status(400).json({ error: 'Project name already exists' });
  }
  
  projects[projectIndex].name = newName;
  await db.set(projectsKey, projects);
  res.json({ success: true, project: projects[projectIndex] });
});

// Delete project
app.delete('/api/projects/:projectName', requireAuth, async (req, res) => {
  const projectName = decodeURIComponent(req.params.projectName);
  const projectsKey = `projects:${req.username}`;
  const projects = await db.get(projectsKey) || [];
  
  const filteredProjects = projects.filter(p => p.name !== projectName);
  
  if (filteredProjects.length === projects.length) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  await db.set(projectsKey, filteredProjects);
  res.json({ success: true });
});

// Verify session
app.get('/api/verify', requireAuth, (req, res) => {
  res.json({ success: true, username: req.username });
});

// Share a project with another user
app.post('/api/projects/:projectName/share', requireAuth, async (req, res) => {
  const projectName = decodeURIComponent(req.params.projectName);
  const { shareWithUsername } = req.body;
  
  if (!shareWithUsername) {
    return res.status(400).json({ error: 'Username to share with is required' });
  }
  
  if (shareWithUsername === req.username) {
    return res.status(400).json({ error: 'Cannot share project with yourself' });
  }
  
  // Check if target user exists
  const targetUserKey = `user:${shareWithUsername}`;
  const targetUser = await db.get(targetUserKey);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Get owner's project
  const projectsKey = `projects:${req.username}`;
  const projects = await db.get(projectsKey) || [];
  const project = projects.find(p => p.name === projectName);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  // Get shared projects for target user
  const sharedKey = `shared:${shareWithUsername}`;
  const sharedProjects = await db.get(sharedKey) || [];
  
  // Check if already shared
  if (sharedProjects.find(p => p.name === projectName && p.owner === req.username)) {
    return res.status(400).json({ error: 'Project already shared with this user' });
  }
  
  // Add to shared projects
  sharedProjects.push({
    name: projectName,
    owner: req.username,
    data: project.data,
    sharedAt: Date.now()
  });
  
  await db.set(sharedKey, sharedProjects);
  
  // Track who the project is shared with (for owner's reference)
  const sharesKey = `projectShares:${req.username}:${projectName}`;
  const shares = await db.get(sharesKey) || [];
  if (!shares.includes(shareWithUsername)) {
    shares.push(shareWithUsername);
    await db.set(sharesKey, shares);
  }
  
  res.json({ success: true, message: `Project shared with ${shareWithUsername}` });
});

// Get projects shared with current user
app.get('/api/shared-projects', requireAuth, async (req, res) => {
  const sharedKey = `shared:${req.username}`;
  const sharedProjects = await db.get(sharedKey) || [];
  res.json({ projects: sharedProjects });
});

// Load a shared project (makes a copy for the user)
app.post('/api/shared-projects/:owner/:projectName/copy', requireAuth, async (req, res) => {
  const owner = decodeURIComponent(req.params.owner);
  const projectName = decodeURIComponent(req.params.projectName);
  
  // Get shared projects
  const sharedKey = `shared:${req.username}`;
  const sharedProjects = await db.get(sharedKey) || [];
  const sharedProject = sharedProjects.find(p => p.name === projectName && p.owner === owner);
  
  if (!sharedProject) {
    return res.status(404).json({ error: 'Shared project not found' });
  }
  
  // Get user's projects
  const projectsKey = `projects:${req.username}`;
  const projects = await db.get(projectsKey) || [];
  
  if (projects.length >= 10) {
    return res.status(400).json({ error: 'Maximum 10 projects per account. Delete some to make room.' });
  }
  
  // Create unique name
  let newName = `${projectName} (from ${owner})`;
  let counter = 1;
  while (projects.find(p => p.name === newName)) {
    newName = `${projectName} (from ${owner}) ${counter++}`;
  }
  
  // Add project
  projects.push({
    name: newName,
    data: sharedProject.data,
    updatedAt: Date.now()
  });
  
  await db.set(projectsKey, projects);
  res.json({ success: true, projectName: newName });
});

// Remove a shared project from list (recipient side)
app.delete('/api/shared-projects/:owner/:projectName', requireAuth, async (req, res) => {
  const owner = decodeURIComponent(req.params.owner);
  const projectName = decodeURIComponent(req.params.projectName);
  
  const sharedKey = `shared:${req.username}`;
  const sharedProjects = await db.get(sharedKey) || [];
  
  const filteredProjects = sharedProjects.filter(
    p => !(p.name === projectName && p.owner === owner)
  );
  
  if (filteredProjects.length === sharedProjects.length) {
    return res.status(404).json({ error: 'Shared project not found' });
  }
  
  await db.set(sharedKey, filteredProjects);
  res.json({ success: true });
});

// Unshare a project (owner revokes access)
app.delete('/api/projects/:projectName/unshare/:targetUser', requireAuth, async (req, res) => {
  const projectName = decodeURIComponent(req.params.projectName);
  const targetUser = decodeURIComponent(req.params.targetUser);
  
  // Verify the project belongs to current user
  const projectsKey = `projects:${req.username}`;
  const projects = await db.get(projectsKey) || [];
  const project = projects.find(p => p.name === projectName);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  // Remove from target user's shared list
  const sharedKey = `shared:${targetUser}`;
  const sharedProjects = await db.get(sharedKey) || [];
  
  const filteredProjects = sharedProjects.filter(
    p => !(p.name === projectName && p.owner === req.username)
  );
  
  if (filteredProjects.length === sharedProjects.length) {
    return res.status(404).json({ error: 'Share not found for this user' });
  }
  
  await db.set(sharedKey, filteredProjects);
  
  // Also update the owner's shares tracking
  const sharesKey = `projectShares:${req.username}:${projectName}`;
  const shares = await db.get(sharesKey) || [];
  const updatedShares = shares.filter(u => u !== targetUser);
  await db.set(sharesKey, updatedShares);
  
  res.json({ success: true, message: `Access revoked for ${targetUser}` });
});

// Get list of users a project is shared with (for owner)
app.get('/api/projects/:projectName/shares', requireAuth, async (req, res) => {
  const projectName = decodeURIComponent(req.params.projectName);
  
  // Verify the project belongs to current user
  const projectsKey = `projects:${req.username}`;
  const projects = await db.get(projectsKey) || [];
  const project = projects.find(p => p.name === projectName);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  // Get project shares key
  const sharesKey = `projectShares:${req.username}:${projectName}`;
  const shares = await db.get(sharesKey) || [];
  
  res.json({ shares });
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
