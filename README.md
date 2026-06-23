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


## v2.2 Android TZ fix

- Apple Calendar usa el ICS original.
- Android / Google Calendar usa ICS con:
  DTSTART;TZID=America/Argentina/Buenos_Aires
  DTEND;TZID=America/Argentina/Buenos_Aires
- Esto evita corrimientos por interpretación UTC/Z en Samsung/Google Calendar.


## v2.3 Crew fix

- Parser de tripulación más tolerante:
  - 08JUL.26
  - 08JUL26
  - 08 JUL.26
  - 08 JUL 26
- Corrige vuelos que salían como "tripulación no informada" cuando la web separaba la fecha.
- Mantiene Android TZ fix.
