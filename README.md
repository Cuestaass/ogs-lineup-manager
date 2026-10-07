# FC OGS para ladderly.es

Aplicación web de fútbol 7. La carpeta `public/` contiene las pantallas que sirve el Worker. Conserva equipos, jugadores, formaciones, alineaciones y exportación PNG/PDF de la aplicación original.

## Desplegar la integración JDM en Cloudflare Workers

La aplicación se organiza en rutas `/organizador/`, `/tactica/` y `/jdm/`, con una navegación común en `public/shell.js`. El organizador usa módulos nativos para el estado y la importación PDF; conserva la clave `localStorage` existente. La pizarra táctica permite colocar jugadores, balones y conos, dibujar recorridos, deshacer cambios y exportar la jugada como PNG; en pantallas estrechas, el campo gira automáticamente a orientación vertical. No requiere React ni dependencias de ejecución. `node scripts/build-static.mjs` genera `public/app.bundle.js` a partir de los módulos del organizador.

La aplicación incorpora un Worker con D1 y una sincronización programada cada tres horas. El portal municipal publica los datos semanalmente; la programación oficial se fija el jueves a las 20:00 antes de la jornada. El Worker consulta la API CKAN del Ayuntamiento, guarda clasificaciones y partidos de FC OGS, FC OGS II e Inter Maccabi y registra cambios de fecha, hora, campo y estado. La primera lectura crea la referencia inicial y no genera avisos retroactivos.

1. Crea una base D1: `npx wrangler d1 create ogs-jdm`.
2. Copia su `database_id` en `wrangler.jsonc`, sustituyendo `REPLACE_WITH_D1_DATABASE_ID`.
3. Aplica el esquema: `npx wrangler d1 migrations apply ogs-jdm --remote`.
4. Configura un secreto para sincronizar manualmente: `npx wrangler secret put JDM_REFRESH_TOKEN`.
5. Despliega con `npx wrangler deploy` y configura el dominio del Worker en Cloudflare.
6. Tras el primer despliegue, ejecuta `POST /api/jdm/refresh` con la cabecera `Authorization: Bearer <token>` y comprueba `GET /api/jdm/teams`.

Si el nombre de un equipo corresponde a varios grupos o fases, el estado será `ambiguous` y la respuesta incluirá los candidatos. Configura la variable `JDM_TEAM_CODES` como JSON para vincular códigos oficiales, por ejemplo `{"fc-ogs":{"teamCode":"123","groupCode":"4"}}`. Se pueden añadir más equipos en `PILOTS` de `jdm.js`; la base de datos y las rutas no requieren cambios. La temporada se calcula automáticamente y empieza en agosto. Durante julio a septiembre puede no haber datos disponibles de la temporada siguiente.

**Avisos del piloto:** al seguir un equipo se guardan sus preferencias en el navegador y se consultan eventos cada cinco minutos mientras la página está abierta. Si se permite el permiso del navegador, aparece una notificación local. Esta versión no entrega notificaciones con la app cerrada ni identifica seguidores entre dispositivos. Para eso falta incorporar Web Push, suscripciones persistidas y una política de identidad/consentimiento. El Ayuntamiento no expone un mecanismo de publicación push en este conjunto de datos; la detección depende de la frecuencia de consulta y de publicación municipal.

Fuente: [Portal de datos abiertos del Ayuntamiento de Madrid](https://datos.madrid.es/dataset/211549-0-juegos-deportivos-actual), licencia CC BY 4.0.

## Alternativa estática

Puedes seguir sirviendo `public/` sin Worker, pero la ruta `/jdm/` no recibirá datos. La gestión local de alineaciones y la pizarra táctica siguen funcionando. El ZIP estático incluye las pantallas públicas, pero para consultar JDM debes desplegar el Worker.

## Datos guardados

Los datos se guardan en `localStorage` del navegador; no se envían al servidor ni se sincronizan entre usuarios o dispositivos. No hay cuentas de usuario. Si borras los datos del sitio o usas navegación privada, puedes perder los equipos.

La versión web no recupera automáticamente los datos de la aplicación de Windows. HTTP, HTTPS, www y el dominio sin www tienen almacenamientos distintos: utiliza siempre la dirección HTTPS definitiva. PNG y PDF son copias visuales, no copias restaurables de los datos.

## Importar una ficha de equipo

En la sección **Nuevo jugador**, arrastra el PDF de inscripción a la zona de importación o haz clic en ella para buscarlo. La app toma únicamente el nombre de la columna **Participante** (no el documento) y las filas con rol **Deportista**, crea el equipo si todavía no existe y añade los jugadores al banquillo. Los dorsales se asignan automáticamente y una segunda importación omite los nombres que ya estén en ese equipo. Puedes editar los nombres y dorsales desde la tabla de jugadores. La ficha debe ser un PDF con texto seleccionable, como la hoja de inscripción de la competición.

En cada tarjeta de equipo, la sección **Cambios naturales** permite vincular un suplente del banquillo con un titular. El emparejamiento queda guardado, se marca en el banquillo y aparece en la lista del equipo y en las exportaciones.

## Abrir la versión local

Abre `public/index.html` desde la carpeta del proyecto o `index.html` desde el ZIP descomprimido. La navegación utiliza rutas relativas y el organizador funciona con `file://`; los equipos continúan guardándose en el navegador. **Descomprime el ZIP completo antes de abrirlo**, para que las carpetas `organizador/` y `assets/` queden junto a `index.html`.

La ruta JDM necesita un servidor con `/api/jdm` y muestra un aviso cuando se abre como archivo local. Después de editar `public/app.js` o sus módulos, ejecuta `node scripts/build-static.mjs` antes de volver a empaquetar. `scripts/package.ps1` lo hace automáticamente.

## Probar en local

Con Python instalado, desde la raíz del repositorio:

```sh
python -m http.server 8080 --bind 127.0.0.1 --directory public
```

Abre `http://127.0.0.1:8080/organizador/` y visita también `/tactica/` y `/jdm/`. Crea un equipo y un jugador, pulsa «Alinear 7», recarga y comprueba que se conserva. En la pizarra táctica, añade fichas, dibuja una flecha, mueve un jugador y exporta la jugada. Prueba las exportaciones y la vista en móvil. Detén el servidor con Ctrl+C.

## Generar el ZIP tras hacer cambios

En PowerShell, desde la raíz del repositorio:

```powershell
./scripts/package.ps1
```

Si Windows bloquea los scripts, puedes ejecutarlo con una excepción que afecta solo a ese proceso:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/package.ps1
```

El paquete contiene únicamente los archivos públicos y reemplaza el ZIP anterior. La aplicación portátil original permanece en `FC-OGS-Portable-Windows/`.
