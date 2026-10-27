# Redirecciones de compatibilidad

Esta carpeta solo contiene **atajos HTML** que redirigen a la SPA en `/index.html#…`.

La aplicación real vive en:

- `index.html` — shell de la SPA
- `js/app.js` + `js/pages.js` + `js/forms.js` + `js/lib/*` — frontend modular
- `backend/` — API REST

No uses estos archivos como pantallas independientes ni esperes `localStorage` aquí: la persistencia es la API + `sessionStorage` del token JWT.
