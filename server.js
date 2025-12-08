
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { Database } = require('@replit/database');

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

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
