export function getTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return (localStorage.getItem('qf-theme') as 'dark' | 'light') || 'dark';
}

export function setTheme(theme: 'dark' | 'light') {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('qf-theme', theme);
}

export function initTheme() {
  const t = getTheme();
  document.documentElement.setAttribute('data-theme', t);
  return t;
}
