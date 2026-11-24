let savedLocale
try {
  savedLocale = localStorage.getItem('watchparty.locale')
} catch {
  // Fall back to browser language when storage is unavailable.
}
const browserLocale = navigator.languages.map((language) => language.toLowerCase().split('-')[0])
  .find((language) => language === 'uk' || language === 'en')
const locale = savedLocale === 'en' || savedLocale === 'uk' ? savedLocale : browserLocale
const retry = document.querySelector('button')

if (locale === 'en') {
  document.documentElement.lang = 'en'
  document.title = 'Screening Room · No connection'
  document.getElementById('brand').textContent = 'Screening Room'
  document.querySelector('h1').textContent = 'No connection'
  document.querySelector('p').textContent = 'Connect to the internet to open your room and keep watching.'
  retry.textContent = 'Try again'
}

retry.addEventListener('click', () => location.reload())
