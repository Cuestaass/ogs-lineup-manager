# Despliegue en Cloudflare Pages + Supabase

La aplicación usa tres piezas independientes:

| Pieza | Servicio | Datos |
| --- | --- | --- |
| Frontend React | Cloudflare Pages | Artefactos estáticos de `public-build/` |
| API y cron JDM | Cloudflare Worker + D1 | Equipos, permisos, invitaciones, convocatorias y seguimientos |
| Identidad | Supabase Auth | Usuarios, contraseñas y sesiones |

Supabase no necesita tablas SQL propias para esta fase. Sólo se usa Auth; el modelo de producto continúa en D1.

## 1. Crear y configurar Supabase

1. Crea un proyecto en Supabase.
2. En **Authentication > Providers**, habilita **Email** y decide si exigirás confirmación de correo. Para producción es recomendable exigirla.
3. En **Project Settings > API Keys**, copia:
   - la URL del proyecto: `https://PROJECT_REF.supabase.co`;
   - la clave pública `sb_publishable_...`. Nunca uses una clave `sb_secret_...` ni `service_role` en el frontend.
4. En **Project Settings > JWT Keys**, activa una clave asimétrica **ES256** o **RS256**. El Worker valida por JWKS y deliberadamente no admite HS256.
5. En **Authentication > URL Configuration**, configura:
   - **Site URL:** `https://TU_PROYECTO.pages.dev` (o el dominio definitivo);
   - redirección de producción: `https://TU_DOMINIO/login/**`;
   - desarrollo: `http://localhost:5173/login/**`;
   - opcional para previews de Pages: `https://**.TU_PROYECTO.pages.dev/login/**`.

Usa la URL exacta en producción. Limita el comodín a previews.

## 2. Preparar el Worker y D1

Autentica Wrangler y, si la base configurada en `wrangler.jsonc` no pertenece a tu cuenta, crea otra:

```sh
npx wrangler login
npx wrangler d1 create ogs-jdm
```

Copia el `database_id` devuelto en `wrangler.jsonc`. Después aplica las migraciones:

```sh
npm run db:migrate:remote
```

Despliega una primera vez y registra las variables del Worker:

```sh
npm run deploy:api
npx wrangler secret put SUPABASE_URL
npx wrangler secret put FRONTEND_URL
npx wrangler secret put ALLOWED_ORIGINS
npx wrangler secret put JDM_REFRESH_TOKEN
npx wrangler secret put PILOT_BOOTSTRAP_TOKEN
npm run deploy:api
```

Valores esperados:

- `SUPABASE_URL`: `https://PROJECT_REF.supabase.co`.
- `FRONTEND_URL`: origen del frontend sin `/` final; también se usa al crear enlaces de invitación.
- `ALLOWED_ORIGINS`: orígenes adicionales separados por comas, sin rutas. Úsalo para previews concretas; no se admiten comodines CORS.
- `SUPABASE_JWT_AUDIENCE`: es opcional y por defecto vale `authenticated`.
- `JDM_REFRESH_TOKEN` y `PILOT_BOOTSTRAP_TOKEN`: secretos largos y diferentes.

En **Workers & Pages > Worker > Settings > Domains & Routes**, asigna preferiblemente un dominio como `api.tu-dominio.es`. Para una primera prueba puedes usar la URL `workers.dev`.

## 3. Crear el proyecto de Cloudflare Pages

Conecta el repositorio Git en **Workers & Pages > Create > Pages** y usa:

| Campo | Valor |
| --- | --- |
| Framework | React (Vite) o None |
| Build command | `npm run build` |
| Build output directory | `public-build` |
| Root directory | vacío (raíz del repositorio) |
| Node | 22 o posterior |

Añade estas variables tanto al entorno **Production** como a los previews que quieras probar:

```text
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REEMPLAZAR
VITE_API_URL=https://api.tu-dominio.es
```

Las variables `VITE_*` se incorporan al JavaScript compilado y son públicas. Esto es correcto para la URL y la clave publicable; no pongas secretos ahí.

También puedes hacer un despliegue directo después de crear el proyecto Pages:

```sh
npm run deploy:pages
```

Si cambia el dominio de Pages, actualiza `FRONTEND_URL`, `ALLOWED_ORIGINS` y las URLs permitidas en Supabase.

## 4. Alta de los tres pilotos

1. Crea las tres cuentas en Supabase Auth o deja que se registren.
2. Confirma sus correos e inicia sesión una vez con cada cuenta. Ese primer acceso crea su usuario en D1.
3. Copia `.env.example` a `.env.local`, rellena `APP_URL` con la URL del Worker, el secreto y los tres correos.
4. Ejecuta:

```sh
npm run bootstrap:pilots
```

Todos los resultados deben quedar en estado `ready`.

## 5. Comprobación final

```sh
npm test
npm run build
curl https://api.tu-dominio.es/api/invites/token-inexistente
```

Después verifica manualmente registro, confirmación de correo, inicio/cierre de sesión, recuperación de contraseña, creación de una invitación y acceso desde el enlace. Un `GET /api/me` sin JWT debe responder `401`; desde la aplicación autenticada debe responder `200`.
