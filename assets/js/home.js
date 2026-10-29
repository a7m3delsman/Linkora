const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();
const toggle = document.querySelector('#themeToggle');
const savedTheme = localStorage.getItem('linkora-theme');
if (savedTheme === 'light') document.body.classList.add('light');
toggle?.addEventListener('click', () => {
  document.body.classList.toggle('light');
  localStorage.setItem('linkora-theme', document.body.classList.contains('light') ? 'light' : 'dark');
});
