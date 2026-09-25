# Sorei Saishi — Web móvil con GitHub + Supabase

Sistema web responsive para gestionar los oficios religiosos, antepasados, solicitudes, cultos y notificaciones.

## Arquitectura
- **Frontend:** HTML/CSS/JavaScript estático, listo para GitHub Pages.
- **Repositorio/deploy:** GitHub + GitHub Pages.
- **Backend:** Supabase (PostgreSQL + Auth + Row Level Security).
- **Roles:** Responsable de iglesia y Administrador general.
- Se usa **Departamento de iglesia** en lugar de "unidad de iglesia".
- Los formularios no incluyen el término que se solicitó retirar.

## Configuración de Supabase
1. Crea un proyecto en Supabase.
2. Abre **SQL Editor** y ejecuta `supabase-schema.sql`.
3. Copia `supabase-config.example.js` como `supabase-config.js`.
4. Coloca la URL del proyecto y la clave **anon/public** de Supabase.
5. En Supabase > Authentication, crea el primer usuario.
6. Busca su UUID en `auth.users` y conviértelo en administrador ejecutando el comentario indicado al final de `supabase-schema.sql`.

**Nunca coloques la `service_role` key en GitHub ni en el navegador.**

## GitHub Pages
### Configuración para GitHub Pages
1. Crea un repositorio y sube este proyecto.
2. En GitHub, entra a **Settings → Secrets and variables → Actions → Variables**.
3. Crea `SUPABASE_URL` y `SUPABASE_ANON_KEY` con los valores públicos de tu proyecto Supabase.
4. El workflow `.github/workflows/deploy.yml` generará `supabase-config.js` durante el despliegue.
5. En **Settings → Pages**, selecciona **GitHub Actions**.
6. Cada push a `main` publicará el sistema.

Para probar localmente, copia `supabase-config.example.js` como `supabase-config.js` y completa los valores de Supabase.

## Notificaciones
La aplicación contempla notificaciones de:
- próximos cultos;
- solicitudes pendientes;
- vencimientos de Nensai/Ireisai;
- proximidad de los 50 días de Shinrei Saishi;
- cambios de estado.

La tabla `notifications` queda preparada para notificaciones persistentes. Para push real en segundo plano se recomienda añadir una Edge Function de Supabase y Web Push/VAPID sin exponer claves privadas.

## Seguridad
El frontend utiliza la clave anon/public de Supabase y la protección real está en **RLS**. Los datos se separan por `department_id`. El Administrador general puede administrar usuarios, mientras el Responsable de iglesia opera sobre su departamento.
