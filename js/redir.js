// /activar (enlace de los correos S2/S4) y cualquier ruta desconocida → la app, conservando ?token_hash=…&type=… y el #fragmento.
location.replace('/' + location.search + location.hash);
