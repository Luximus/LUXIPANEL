# Base de conocimiento vigente

Revisión 2026-10-13. Referencia documental para personas y asistentes; no implica que exista un chatbot de soporte ni tickets activos.

## Dos productos, responsabilidades distintas

LUXIPANEL se instala en tu servidor Linux y administra recursos locales y destinos SSH. LP-LICENSE-SERVER gestiona la cuenta, pagos, tokens, catálogo de módulos y servicios editoriales de luxipanel.com. Crear una cuenta no instala un panel ni registra un servidor.

## Instalar e iniciar sesión

Desde el repositorio LUXIPANEL, ejecuta el instalador con tu dominio. Usa --https si el origen público utiliza TLS o --cloudflare cuando corresponda. Configura DNS y un certificado válido; abre /login e inicia sesión con un usuario Linux existente. El primer usuario apto del grupo sudo/wheel puede convertirse en administrador. Hay un único modo autohospedado; la configuración antigua «managed» ya no es la vía de instalación vigente.

## Acceso local

El panel autentica contra el sistema Linux y aplica sus roles y permisos de módulos. Las credenciales de la web y las claves API de cuenta no sustituyen el inicio de sesión Linux. El ejecutor local opera en la máquina que aloja LUXIPANEL.

## Añadir y utilizar un destino SSH

En el selector de servidores del panel instalado, añade host, puerto, usuario SSH y credencial. Las credenciales se guardan cifradas en ese panel, no en el inventario retirado de la web. Verifica el destino, selecciónalo y prueba una lectura antes de realizar cambios. Tener acceso SSH no garantiza que todos los módulos funcionen en cualquier sistema operativo.

## Diagnosticar una conexión

Comprueba conectividad, puerto SSH, credenciales y privilegios del usuario remoto. La política del servidor restringe las direcciones privadas; SERVERS_ALLOW_PRIVATE es un ajuste de administrador para redes privadas legítimas. No desactives la verificación del host ni expongas credenciales para resolver un fallo. Vuelve a conectar si caduca la sesión SSH.

## App móvil: acceso directo al panel

Añade la URL de un LUXIPANEL ya instalado, selecciona la conexión e inicia sesión con el usuario del panel/Linux. La app activa utiliza pantallas nativas React Native para los módulos. Recordarme guarda datos de sesión en almacenamiento seguro, no la contraseña Linux. Los módulos y acciones disponibles dependen del servidor seleccionado y sus permisos.

## Escritorio: perfiles y pestañas

Guarda un perfil con nombre y URL de un panel instalado, prueba la conexión y abre una pestaña. Desktop muestra la interfaz web de ese panel en una vista aislada de Electron. Las pestañas del mismo perfil comparten sesión; distintos perfiles separan su almacenamiento. Cambiar la URL borra el almacenamiento anterior del perfil. Cerrar la ventana conserva la bandeja; Salir termina la aplicación.

## Instalar y gestionar módulos

Abre Módulos en el panel instalado para consultar catálogo, permisos, dependencias y disponibilidad. Habilita o instala el módulo según tu rol. Las funciones integradas y los módulos del marketplace pueden tener requisitos distintos. Antes de suscribirte a un módulo de pago, consulta su precio y condiciones reales en el catálogo.

## ¿Por qué falta un módulo o una acción?

Revisa destino seleccionado, rol, instalación y habilitación del módulo, dependencias y posibles requisitos de suscripción. Web, móvil y escritorio pueden mostrar capacidades de forma diferente. Que una guía antigua mencione una acción no demuestra que esté disponible.

## ¿De dónde vienen las notificaciones de servidores?

Se retiró el monitor central de servidores de la web. El panel instalado conserva notificaciones y alertas de servidor cuando están habilitadas. Revisa sus reglas, permisos y preferencias de entrega por separado de las notificaciones de cuenta y del blog.

## Preparar un informe útil

Incluye producto, versiones del cliente y panel, hora del fallo, destino seleccionado, error exacto y pasos para reproducirlo. Explica el resultado esperado y adjunta una captura o fragmento de registro sin secretos. Nunca envíes contraseñas, llaves privadas, claves API completas, cookies ni códigos de recuperación de dos factores.
