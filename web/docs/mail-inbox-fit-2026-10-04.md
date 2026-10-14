<!-- documentation-status-20261013 -->
> **Documento histórico o de planificación.** Conserva propuestas, resultados y límites de su fecha; no acredita el estado ni la publicación actuales. Consultar la [referencia vigente](../README.md) y el código antes de ejecutar sus instrucciones. Clasificado el 13 de octubre de 2026.

# Bandeja de correo ocupa el cuerpo completo del drawer

Aplicado y publicado `mail-inbox-fit-20261004-1`. La vista interna `mail/[id]/inbox` tenía dos niveles de padding, una tarjeta con bordes y altura fija `calc(100dvh - 6rem)`. Su contenido podía llegar por debajo de la paginación visible. Las reglas específicas del drawer eliminan el padding y la tarjeta exterior, ocultan el toolbar vacío y hacen que la bandeja use el cuerpo disponible mediante flex y min-height:0. Conserva el drawer de92vw, cabecera, pie y desplazamiento de carpetas/lista/lector.

Solo cambió frontend/src/styles/panel-workspace.css. Publicación selectiva de un CSS con URL nueva y el manifiesto SSR, conservando el CSS anterior y todos los cambios concurrentes de Expo, React Bits y Correos. Reinicio únicamente del frontend; backend permanece con el mismo PID.

QA de navegador antes/después: candidato y público, ocho casos1440×900/390×844/320×568/844×390 en claro/oscuro. Confirma drawer visible, coincidencia de los cuatro bordes del cuerpo y bandeja, ausencia de scroll exterior, lista con scroll interno, paginación dentro y cambio de cuenta manteniendo geometría. Fixtures de buzones/mensajes; no se modificaron cuentas ni mensajes reales. Evidencia .cache/mail-inbox-fit/verification.json y capturas live-*.png. La QA final usa la entrada desde el módulo Correos y exige visibility/data-open; una geometría de un drawer oculto no valida la pantalla. No se atribuye al cambio CSS el fallo de carga de primera entrada directa observado en el ensayo inicial.

Rollback de producción: node /var/www/LUXIPANEL/.cache/mail-inbox-fit/publish.mjs --rollback. Validación de SHA antes de revertir; no revertir sobre publicaciones posteriores. Para revertir fuentes, retirar únicamente el bloque que comienza “Mailbox uses the available drawer body”.
