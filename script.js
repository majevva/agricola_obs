// Add at the beginning of the file
function initTheme() {
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeIcon = themeToggleBtn.querySelector('i');
  
  // Check for saved theme preference or default to 'dark'
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(themeIcon, savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(themeIcon, newTheme);
  });
}

function updateThemeIcon(icon, theme) {
  if (theme === 'dark') {
    icon.className = 'fas fa-moon text-yellow-400';
  } else {
    icon.className = 'fas fa-sun text-yellow-400';
  }
}

// Add this to your existing initialization code
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  // ... rest of your initialization code
});
