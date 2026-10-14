# LUXIPANEL

Revisado el 13 de octubre de 2026

LUXIPANEL se instala en tu servidor Linux y administra recursos locales y destinos SSH. LP-LICENSE-SERVER gestiona la cuenta, pagos, tokens, catálogo de módulos y servicios editoriales de luxipanel.com. Crear una cuenta no instala un panel ni registra un servidor.

[en](../README.md) | [es](../translations/README.es.md) | [fr](../translations/README.fr.md) | [de](../translations/README.de.md) | [it](../translations/README.it.md) | [pt](../translations/README.pt.md) | [ru](../translations/README.ru.md) | [ar](../translations/README.ar.md) | [hi](../translations/README.hi.md) | [bn](../translations/README.bn.md) | [ja](../translations/README.ja.md) | [ko](../translations/README.ko.md)

## Antes de instalar

Necesitas un servidor Debian/Ubuntu con acceso de administrador, un dominio y DNS funcionando. Los paquetes actuales requieren Node.js 22.12 o posterior y declaran pnpm 11.5.0. Deben estar disponibles Redis, nginx y los servicios que utilicen los módulos habilitados. Revisa install.sh antes de ejecutarlo: instala dependencias y modifica la configuración del sistema.

## Instalar e iniciar sesión

Desde el repositorio LUXIPANEL, ejecuta el instalador con tu dominio. Usa --https si el origen público utiliza TLS o --cloudflare cuando corresponda. Configura DNS y un certificado válido; abre /login e inicia sesión con un usuario Linux existente. El primer usuario apto del grupo sudo/wheel puede convertirse en administrador. Hay un único modo autohospedado; la configuración antigua «managed» ya no es la vía de instalación vigente.

```bash
sudo bash install.sh --domain panel.example.com --https
```

## Acceso local

El panel autentica contra el sistema Linux y aplica sus roles y permisos de módulos. Las credenciales de la web y las claves API de cuenta no sustituyen el inicio de sesión Linux. El ejecutor local opera en la máquina que aloja LUXIPANEL.

## Selecciona el destino antes de actuar

Elige el servidor local o una conexión SSH en el panel instalado. Archivos, terminal, servicios y otras operaciones compatibles se ejecutan sobre el destino seleccionado según capacidades y permisos. Comprueba su nombre antes de escribir archivos, reiniciar servicios o eliminar recursos.

## Añadir y utilizar un destino SSH

En el selector de servidores del panel instalado, añade host, puerto, usuario SSH y credencial. Las credenciales se guardan cifradas en ese panel, no en el inventario retirado de la web. Verifica el destino, selecciónalo y prueba una lectura antes de realizar cambios. Tener acceso SSH no garantiza que todos los módulos funcionen en cualquier sistema operativo.

## Diagnosticar una conexión

Comprueba conectividad, puerto SSH, credenciales y privilegios del usuario remoto. La política del servidor restringe las direcciones privadas; SERVERS_ALLOW_PRIVATE es un ajuste de administrador para redes privadas legítimas. No desactives la verificación del host ni expongas credenciales para resolver un fallo. Vuelve a conectar si caduca la sesión SSH.

## Crear una clave API con nombre

Abre Seguridad → API KEY en tu cuenta web, completa las comprobaciones de seguridad y crea una clave con un nombre descriptivo. Copia el secreto cuando se muestre e introdúcelo mediante API KEY en tu LUXIPANEL instalado. No debes seleccionar un servidor, IP ni credencial SSH en luxipanel.com. La clave identifica tu cuenta para los servicios que autoriza.

## Rotar o revocar una clave

El secreto completo solo se muestra al crear o rotar la clave. Después de rotarla, reemplázala en todas las instalaciones que la utilicen. Revocarla detiene la autorización y cancela sus suscripciones activas de módulos. No incluyas claves en capturas, registros, repositorios ni mensajes de soporte.

## Instalar y gestionar módulos

Abre Módulos en el panel instalado para consultar catálogo, permisos, dependencias y disponibilidad. Habilita o instala el módulo según tu rol. Las funciones integradas y los módulos del marketplace pueden tener requisitos distintos. Antes de suscribirte a un módulo de pago, consulta su precio y condiciones reales en el catálogo.

## Configurar integraciones en el panel instalado

Configura cada proveedor en su módulo: Cloudflare para DNS y operaciones de zona, GitHub para repositorios, Expo para flujos EAS y proveedores o conectores del asistente cuando estén habilitados. Cada integración necesita sus credenciales y permisos. La antigua importación cloud y asignación de subdominios gestionados desde la web ya no es el flujo de configuración.

## App móvil: acceso directo al panel

Añade la URL de un LUXIPANEL ya instalado, selecciona la conexión e inicia sesión con el usuario del panel/Linux. La app activa utiliza pantallas nativas React Native para los módulos. Recordarme guarda datos de sesión en almacenamiento seguro, no la contraseña Linux. Los módulos y acciones disponibles dependen del servidor seleccionado y sus permisos.

## Escritorio: perfiles y pestañas

Guarda un perfil con nombre y URL de un panel instalado, prueba la conexión y abre una pestaña. Desktop muestra la interfaz web de ese panel en una vista aislada de Electron. Las pestañas del mismo perfil comparten sesión; distintos perfiles separan su almacenamiento. Cambiar la URL borra el almacenamiento anterior del perfil. Cerrar la ventana conserva la bandeja; Salir termina la aplicación.

## Actualizar y recuperar

Respalda la configuración y las credenciales cifradas antes de actualizar. Conserva la clave del almacén de credenciales: cambiarla impide descifrar los datos existentes. Compila un proyecto a la vez. En Astro, limpia dist y usa NODE_OPTIONS=--max-old-space-size=2560; después reinicia el proceso y comprueba HTTP. Si cambias un archivo de entorno bajo PM2, reinicia evaluando el ecosystem con --only y --update-env.

## Preparar un informe útil

Incluye producto, versiones del cliente y panel, hora del fallo, destino seleccionado, error exacto y pasos para reproducirlo. Explica el resultado esperado y adjunta una captura o fragmento de registro sin secretos. Nunca envíes contraseñas, llaves privadas, claves API completas, cookies ni códigos de recuperación de dos factores.

## Guías relacionadas

- [Self-hosting](../SELF-HOSTING.md)
- [Despliegue](../DESPLIEGUE-STANDALONE.md)
- [Module SDK](../MODULE-SDK-SPEC.md)
- [Testing](../TESTING.md)
- [Contributing](../CONTRIBUTING.md)
- [Security](../SECURITY.md)
- [License](../LICENSE)
