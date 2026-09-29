# FC OGS para ladderly.es

Versión web estática del organizador de fútbol 7. La carpeta `public/` es la versión web que debes editar y publicar. Conserva equipos, jugadores, formaciones, alineaciones y exportación PNG/PDF de la aplicación original.

## Desplegar en Cloudflare Pages desde Git

1. Guarda los cambios en tu repositorio remoto.
2. En Cloudflare, abre **Workers & Pages**, crea un proyecto **Pages** y conecta el repositorio (o ajusta el proyecto Pages que ya utilizas).
3. Selecciona la rama de producción y estos valores:

| Ajuste | Valor |
| --- | --- |
| Framework preset | None |
| Root directory | Raíz del repositorio (dejar vacío) |
| Build command | `exit 0` |
| Build output directory | `public` |
| Variables de entorno | Ninguna |

4. Despliega y comprueba la URL `pages.dev` asignada al proyecto.
5. En **Custom domains > Set up a custom domain**, añade `ladderly.es` y sigue las indicaciones de DNS. Para el dominio raíz, la zona debe estar en la misma cuenta de Cloudflare y usar sus servidores DNS. Si el dominio ya sirve otra web, este cambio la sustituirá.
6. Espera a que el dominio y el certificado estén activos y abre **https://ladderly.es/**.

No necesitas dependencias, compilación real, backend ni base de datos. `_headers` configura las cabeceras de Cloudflare Pages y la revalidación de los archivos al actualizarlos.

Si el repositorio está configurado como **Workers Builds** en vez de Pages, `wrangler.jsonc` define el nombre `ogs-lineup-manager`, la fecha de compatibilidad y los archivos estáticos de `public`. En ese caso puedes mantener `npx wrangler deploy --assets ./public` como comando de despliegue.

## Alternativa: subir el ZIP

En un proyecto Pages de **Direct Upload**, sube `ladderly-web.zip` mediante la opción de arrastrar y soltar. También puedes subir directamente la carpeta `public`. El ZIP contiene los archivos en la raíz, sin el ejecutable de Windows. Después, configura el dominio como se indica arriba.

Elige Git si quieres despliegues automáticos con cada cambio: Cloudflare no permite convertir un proyecto Direct Upload a integración Git más adelante; tendrías que crear otro proyecto.

Documentación oficial: [HTML estático](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/), [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) y [dominios personalizados](https://developers.cloudflare.com/pages/configuration/custom-domains/).

## Datos guardados

Los datos se guardan en `localStorage` del navegador; no se envían al servidor ni se sincronizan entre usuarios o dispositivos. No hay cuentas de usuario. Si borras los datos del sitio o usas navegación privada, puedes perder los equipos.

La versión web no recupera automáticamente los datos de la aplicación de Windows. HTTP, HTTPS, www y el dominio sin www tienen almacenamientos distintos: utiliza siempre la dirección HTTPS definitiva. PNG y PDF son copias visuales, no copias restaurables de los datos.

## Importar una ficha de equipo

En la sección **Nuevo jugador**, arrastra el PDF de inscripción a la zona de importación o haz clic en ella para buscarlo. La app toma únicamente el nombre de la columna **Participante** (no el documento) y las filas con rol **Deportista**, crea el equipo si todavía no existe y añade los jugadores al banquillo. Los dorsales se asignan automáticamente y una segunda importación omite los nombres que ya estén en ese equipo. Puedes editar los nombres y dorsales desde la tabla de jugadores. La ficha debe ser un PDF con texto seleccionable, como la hoja de inscripción de la competición.

## Probar en local

Con Python instalado, desde la raíz del repositorio:

```sh
python -m http.server 8080 --bind 127.0.0.1 --directory public
```

Abre `http://127.0.0.1:8080`. Crea un equipo y un jugador, pulsa «Alinear 7», recarga y comprueba que se conserva. Prueba las exportaciones PNG y PDF y la vista en móvil. Detén el servidor con Ctrl+C.

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
