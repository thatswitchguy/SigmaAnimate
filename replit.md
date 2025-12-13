# Sigma Animate

## Overview

Sigma Animate is a web-based animation studio application that allows users to create, edit, and export frame-by-frame animations. The application features user authentication, cloud-based project storage, and various drawing tools including pencil, eraser, fill, text, and smart draw capabilities. Users can manage multiple animation projects, preview their work, and export animations as video files.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Single Page Application**: Pure vanilla JavaScript with HTML/CSS, no frontend framework
- **Canvas-based Drawing**: Uses HTML5 Canvas API for frame rendering and drawing tools
- **Modular JavaScript Classes**:
  - `AnimationStudio` (script.js) - Core animation and drawing logic
  - `AuthManager` (auth.js) - Handles authentication state and API calls
  - `NotificationManager` (notifications.js) - Toast-style user notifications
- **Multiple HTML Pages**: Separate pages for login, register, projects list, and main editor

### Backend Architecture
- **Express.js Server**: Node.js with Express for REST API and static file serving
- **RESTful API Design**: Endpoints prefixed with `/api` for user and project operations
- **Session-based Authentication**: In-memory session storage using JavaScript Map, with SHA-256 password hashing
- **Middleware Pattern**: Custom `requireAuth` middleware for protected routes

### Data Storage
- **Replit Database**: Uses `@replit/database` for persistent key-value storage
- **Data Schema**:
  - Users stored as `user:{username}` keys with hashed passwords
  - Projects stored with user association for cloud save/load functionality
- **Client-side Storage**: localStorage for auth tokens and username persistence

### Authentication Flow
1. User registers/logs in via dedicated pages
2. Server generates random 32-byte hex token on successful login
3. Token stored in localStorage and sent via Authorization header
4. Server validates token against in-memory session Map

### Key Features Architecture
- **Frame Management**: Array-based frame storage with undo/redo support
- **Drawing Tools**: Pencil, eraser, fill bucket, text tool, shape tools
- **Smart Draw**: AI-assisted drawing feature (toggle-able)
- **Onion Skinning**: Overlay previous frames for animation reference
- **Export**: WebM video export capability
- **Cloud Sync**: Save/load projects to Replit Database
- **Project Sharing**: Share projects between users with owner-controlled revocation

### Shared Projects System
- **Sharing API**: 
  - `POST /api/projects/:projectName/share` - Share with another user
  - `GET /api/shared-projects` - Get projects shared with current user
  - `POST /api/shared-projects/:owner/:projectName/copy` - Copy shared project to own projects
  - `DELETE /api/shared-projects/:owner/:projectName` - Remove from received shares
  - `DELETE /api/projects/:projectName/unshare/:targetUser` - Owner revokes access
  - `GET /api/projects/:projectName/shares` - Get list of users project is shared with
- **Data Keys**: `shared:{username}` for received shares, `projectShares:{owner}:{projectName}` for share tracking
- **UI**: Share button on each project, share dialog shows current shares with revoke buttons

## External Dependencies

### NPM Packages
- **express** (^4.18.2) - Web server framework
- **body-parser** (^1.20.2) - JSON request body parsing with 50MB limit for animation data
- **@replit/database** (^2.0.5) - Replit's key-value database for persistent storage

### Client-side Resources
- External icon from Freepik CDN for save button
- Local icon assets in `/icons` directory (fill, eraser, clear, export, upload)

### Security Considerations
- Passwords hashed with SHA-256 (crypto module)
- Session tokens generated using crypto.randomBytes
- No HTTPS enforcement at application level (handled by Replit infrastructure)