# Guardado de alineaciones

La pizarra guarda automáticamente el estado completo (formación, posiciones, cambios naturales, convocatoria y refuerzos temporales) en `localStorage`, con la clave existente `ogs-organizer-v2:<teamId>`. Conserva la migración del formato anterior. No se ha añadido persistencia remota ni modificado los roles o permisos.

La API actual ofrece `GET /api/teams/:teamId/lineup-options`, protegido con `lineups.manage`, para leer plantilla y convocatorias. No tiene una operación para persistir alineaciones. La actualización de la plantilla desde esa API no equivale a sincronizar la alineación.

El indicador confirma el guardado solo después de completar la escritura local. Ante un error, mantiene el estado en memoria, muestra cambios pendientes y permite reintentar. Intenta guardarlos al ocultar la página y avisa al salir si siguen pendientes. Antes de cambiar de equipo o cerrar sesión, reintenta y permite cancelar la salida; la clave del equipo original queda capturada. Si falla la lectura o el registro resulta ilegible, detiene las escrituras y la edición para no sustituir la copia previa por una pizarra vacía.

El guardado local depende del navegador y dispositivo utilizados. No sobrevive a borrar sus datos. Los navegadores pueden no mostrar avisos de salida al finalizar una aplicación desde el sistema operativo; por eso los cambios se escriben inmediatamente, sin esperar al cierre.

## Sincronización futura (sin implementar)

Serían necesarios:

- Una tabla de alineaciones relacionada con el equipo, con identificador, estado validado, versión, fecha de actualización y usuario autor.
- Operaciones autenticadas de lectura y escritura por equipo, verificando pertenencia y `lineups.manage` en el servidor y respetando los permisos existentes.
- Control de versiones para detectar escrituras concurrentes y resolver conflictos entre dispositivos o pestañas sin sobrescribir cambios silenciosamente.
- Un contrato que distinga referencias a jugadores oficiales de refuerzos temporales, con validación de convocatoria y pertenencia al equipo.
- En el cliente, recuperación remota, cola de cambios locales y estados separados de guardado local y confirmación remota. Solo una confirmación del servidor permitiría indicar sincronización.

## Validación

- Pruebas unitarias de recuperación y aislamiento entre equipos, fallos de lectura/escritura y reintento con el último estado.
- Chrome: recarga, selección por toque, sustitución, intercambio, retirada y búsqueda de jugadores.
- Chrome sobre la aplicación compilada: cambio real de equipo, recuperación del estado propio de cada equipo y cancelación del cambio cuando falla el guardado.
- Anchos de 375, 768 y 1440 px: sin desbordamiento horizontal, relación de aspecto del campo conservada y paneles desplegables en móvil.
