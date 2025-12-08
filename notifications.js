
class NotificationManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10001; display: flex; flex-direction: column; gap: 10px; max-width: 350px;';
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', duration = 4000) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    const colors = {
      success: { bg: '#28a745', border: '#218838' },
      error: { bg: '#dc3545', border: '#c82333' },
      info: { bg: '#0078d4', border: '#0056a3' },
      warning: { bg: '#ffc107', border: '#e0a800' }
    };
    
    const color = colors[type] || colors.info;
    
    notification.style.cssText = `
      background: ${color.bg};
      color: #fff;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      border: 1px solid ${color.border};
      display: flex;
      align-items: center;
      gap: 10px;
      animation: slideIn 0.3s ease;
      cursor: pointer;
      min-width: 250px;
    `;
    
    const icon = {
      success: '✓',
      error: '✕',
      info: 'ℹ',
      warning: '⚠'
    }[type] || 'ℹ';
    
    notification.innerHTML = `
      <span style="font-size: 18px; font-weight: bold;">${icon}</span>
      <span style="flex: 1;">${message}</span>
      <span style="opacity: 0.7; font-size: 12px;">✕</span>
    `;
    
    this.container.appendChild(notification);
    
    const remove = () => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          this.container.removeChild(notification);
        }
      }, 300);
    };
    
    notification.addEventListener('click', remove);
    
    if (duration > 0) {
      setTimeout(remove, duration);
    }
    
    return notification;
  }

  success(message, duration) {
    return this.show(message, 'success', duration);
  }

  error(message, duration) {
    return this.show(message, 'error', duration);
  }

  info(message, duration) {
    return this.show(message, 'info', duration);
  }

  warning(message, duration) {
    return this.show(message, 'warning', duration);
  }
}

const notify = new NotificationManager();
