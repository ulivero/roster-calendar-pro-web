# Roster Calendar Pro Web v2

Versión web estática basada en la v6.6 de escritorio.

## Probar local en Mac

```bash
cd roster-calendar-pro-web-v1
python3 -m http.server 3000
```

Abrir:
http://localhost:3000

## Subir a Vercel

Opción simple:
1. Crear cuenta en Vercel.
2. New Project.
3. Importar este proyecto desde GitHub o subir carpeta.
4. Framework: Other.
5. Deploy.

## Uso en iPhone

1. Abrir la URL de Vercel en Safari.
2. Elegir PDF del roster desde Archivos.
3. Procesar PDF.
4. Descargar ICS.
5. Abrir el ICS con Calendario.

## Privacidad

El PDF se procesa en el navegador con PDF.js. No se sube al servidor.


## v2 Mobile

Agrega botones:
- 📅 Agregar a Apple Calendar
- 📅 Android / Google Calendar

En iPhone/Android usa Web Share API cuando está disponible. Si no, abre/descarga el ICS como fallback.


## v2.1 PWA
Agrega ícono propio y manifest para iPhone/Android.


## v2.7 line parser date fix

- Parser por líneas para respetar fecha real de cada duty.
- Corrige bug donde el primer tramo del duty caía el día anterior.
- Cache busting en parser/app/ics.
- Android desactivado temporalmente.


## v2.8 space day parser fix

- Acepta fechas con o sin espacio:
  - 22MON
  - 22 MON
- Agrega muestra de líneas en debug si vuelve a fallar.
