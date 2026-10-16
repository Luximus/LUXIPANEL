# Notas de actualización para los usuarios

Cada aporte del asistente que cambie el producto debe añadir un archivo nuevo
`docs/changes/AAAA-MM-DD-descripcion-breve.json`. Usa un nombre distinto por tarea
y conserva las notas anteriores. El archivo se publica junto al código.

Formato:

```json
{
  "title": "Título breve de la mejora",
  "changes": [
    "Qué puede hacer ahora la persona que usa el panel.",
    "Qué problema se corrigió y qué comportamiento puede esperar."
  ]
}
```

Escribe de una a ocho frases concretas, verificadas y aptas para publicación.
No incluyas conversaciones, peticiones privadas, nombres de servidores, credenciales,
rutas de instalación, identificadores de tareas, códigos de commits ni promesas
de pruebas o despliegues que no se hayan realizado.

El publicador recoge únicamente las notas modificadas en el aporte capturado,
las valida y las adjunta al cambio publicado. El drawer muestra esas notas
en lugar de los mensajes técnicos de GitHub. El agente no hace commit ni push.
Las tareas de lectura no necesitan una nota.
