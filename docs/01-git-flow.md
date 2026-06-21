# 01 - Flujo Git y GitHub

Guía del workflow de Git/GitHub para **client-automation-bot**.

> **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Vitest ·
> **pnpm** como gestor de paquetes.

> Esta guía está adaptada de la guía de flujo "Nimbo" (un proyecto Ionic/Angular). El
> flujo de ramas, issues y PRs es el mismo; los comandos, scripts y `.gitignore` se
> ajustaron a este stack Next.js.

---

## 🌳 Estructura de ramas

```
main (producción - protegida)
  ↑
  │ (PR al final de cada FASE)
  │
develop (integración - default)
  ↑
  │ (PRs de cada tarea)
  │
feature/[issue-number]-[descripcion] (tareas individuales)
```

- **`main`**: producción. Solo código estable y probado. Origen del deploy. Protegida:
  solo acepta PRs desde `develop`. Nunca se trabaja directo aquí.
- **`develop`**: integración. Rama por defecto y base de las `feature/*`. Siempre debe
  quedar funcional (lint + build + test OK).
- **`feature/[issue-number]-[descripcion]`**: una rama por tarea/issue, creada desde
  `develop`, fusionada de vuelta a `develop` vía PR y eliminada tras el merge.

---

## ☁️ Adaptación a Claude Code on the web

Parte del desarrollo se hace con **Claude Code on the web**, donde cada sesión trabaja
sobre una **rama de sesión** (`claude/<nombre>`) y, por seguridad, normalmente solo
puede hacer push a esa rama.

En este proyecto el usuario **autorizó explícitamente** a la sesión a crear y empujar
`develop` y ramas `feature/*`, así que el agente ejecuta el flujo completo (issues,
ramas, PRs y merge de `feature/* → develop`). El único PR que **no** se mergea solo es
`develop → main`: ese queda esperando aprobación manual.

Si en otro entorno el push a ramas no-sesión estuviera restringido, el flujo equivalente
es: el agente desarrolla en su rama de sesión y el mantenedor abre/mergea los PRs.

---

## 🔄 Flujo de trabajo por fase

```
┌──────────────────────────────────────┐
│  1. INICIO DE FASE / FEATURE         │
│  - Crear issues de cada tarea        │
└──────────────┬───────────────────────┘
               ▼
┌──────────────────────────────────────┐
│  2. POR CADA TAREA                   │
│  a) (issue ya creado)                │
│  b) Crear/usar rama feature          │
│  c) Desarrollar                      │
│  d) Commit (Closes #N) y push        │
│  e) PR feature → develop             │
│  f) Review + merge                   │
└──────────────┬───────────────────────┘
               ▼
┌──────────────────────────────────────┐
│  3. FIN DE FASE                      │
│  - pnpm lint + build + test          │
│  - PR develop → main                 │
│  - ⚠️ DETENER · 📢 NOTIFICAR · ⏸️ ESPERAR │
└──────────────┬───────────────────────┘
               ▼
┌──────────────────────────────────────┐
│  4. DESPUÉS DE APROBACIÓN            │
│  - Merge PR develop → main           │
└──────────────────────────────────────┘
```

En este repo, una **feature** agrupa varios issues (pasos) y se mergea a `develop` con un
PR. Cuando se completan todas las features del MVP se abre el PR final `develop → main`.

---

## 📝 Comandos detallados

### Por cada tarea

#### 1. Partir de `develop` actualizado

```bash
git checkout develop
git pull origin develop
```

#### 2. Crear issue de tarea (GitHub)

Vía la UI de GitHub o la API. Anota el número (ej. `#7`). Estructura sugerida:

```
## Objetivo
Qué se implementa.
## Archivos
- src/core/...
## Criterios de aceptación
- [ ] Funcionalidad implementada
- [ ] Sin errores de TypeScript / lint
- [ ] Tests en verde (si aplica)
```

#### 3. Crear rama feature

```bash
git checkout -b feature/7-templating
git branch --show-current
```

**Nomenclatura:** `feature/` + número de issue + descripción corta en minúsculas con
guiones.

#### 4. Desarrollar y commitear (Conventional Commits)

```bash
git add .
git commit -m "feat: add templating engine for message rendering

Closes #7"
```

#### 5. Push

```bash
git push -u origin feature/7-templating   # primera vez
git push                                   # siguientes
```

#### 6. Pull Request a `develop`

```bash
# Con GitHub CLI (si está disponible)
gh pr create --base develop --head feature/7-templating \
  --title "feat: templating engine" \
  --body "## Cambios
- Motor de plantillas {{var}}

## Testing
- ✅ pnpm lint
- ✅ pnpm test
- ✅ pnpm build

Closes #7"
```

> En Claude Code on the web los PRs se crean con las herramientas de GitHub (MCP); el
> resultado es el mismo.

#### 7. Review y merge

Checklist de auto-review:

```markdown
## Funcionalidad
- [ ] El código hace lo que dice
- [ ] pnpm lint / build / test en verde
- [ ] Sin console.log de debug
## Arquitectura
- [ ] core/ no importa next/* ni SDK de Meta
- [ ] Lógica específica de cliente vive en businesses/, no en core/
## Git
- [ ] Conventional Commits
- [ ] PR asociado al issue (Closes #N)
```

Merge a `develop` y limpieza:

```bash
git checkout develop
git pull origin develop
git branch -d feature/7-templating
```

### Fin de fase: PR `develop → main`

```bash
git checkout develop && git pull origin develop
pnpm install        # si cambiaron dependencias
pnpm lint
pnpm test
pnpm build
```

Luego se crea el PR `develop → main` y:

#### ⚠️ DETENER · 📢 NOTIFICAR · ⏸️ ESPERAR

**No se mergea `develop → main` automáticamente.** Se notifica y se espera la aprobación
manual del mantenedor, que revisa código, app y que todas las tareas estén completas.
Tras la aprobación, recién ahí se mergea.

---

## 🛠️ Comandos de referencia rápida

### Git

```bash
git status
git branch -a
git checkout -b nombre-rama
git diff [archivo]
git log --oneline --graph --all
git pull origin develop
```

### pnpm (Next.js)

```bash
pnpm install              # instalar dependencias
pnpm dev                  # dev server → http://localhost:3000
pnpm build                # build de producción
pnpm lint                 # ESLint
pnpm test                 # Vitest (tests del core)
pnpm sim "mensaje"        # simulador offline del bot
```

> ⚠️ **Usa siempre `pnpm`, nunca `npm` ni `yarn`.** El lockfile es `pnpm-lock.yaml`.

---

## 🔧 Problemas comunes

### Merge conflicts

```bash
git status
# resolver marcadores <<<<<<, ======, >>>>>>
git add archivo-resuelto.ts
git commit
git push
```

### Actualizar tu rama con cambios de develop

```bash
git fetch origin
git rebase origin/develop      # o: git merge origin/develop
git push --force-with-lease
```

### Corregir el último commit

```bash
git commit --amend -m "mensaje correcto"
git push --force-with-lease    # solo si ya habías hecho push
```

### Deshacer el último commit (local)

```bash
git reset --soft HEAD~1    # mantiene cambios
git reset --hard HEAD~1    # descarta cambios
```

---

## 🎯 Buenas prácticas

### ✅ HACER
- Commits frecuentes y descriptivos (Conventional Commits)
- Una rama por tarea (no mezclar)
- PRs pequeños y enfocados
- `pnpm lint && pnpm test && pnpm build` antes de push
- Mantener `develop` siempre funcional
- Cerrar issues con `Closes #N`

### ❌ NO HACER
- Trabajar directo en `develop` o `main`
- PRs gigantes con varias funcionalidades
- Mensajes vagos ("fix", "update", "wip")
- Push de código que no compila
- Mezclar `npm`/`yarn` con `pnpm`
- Force push a `develop` o `main`

---

## 📝 Conventional Commits

```
<tipo>: <descripción corta>

[cuerpo opcional con el porqué]

[Closes #N]
```

Tipos: `feat` · `fix` · `docs` · `style` · `refactor` · `test` · `chore`.

Ejemplos en este stack:

```
feat: add WhatsApp Cloud API send adapter
fix: normalize phone number in incoming message parser
refactor: extract lead state machine into its own module
test: add unit tests for follow-up scheduling
docs: document webhook signature verification
chore: configure Vitest and add test/sim scripts
```

---

## 🔐 Seguridad

### `.gitignore` esencial (Next.js)

```gitignore
# dependencies
/node_modules
# next.js
/.next/
/out/
# testing
/coverage
# datos locales del bot (leads en JSON)
/data
# variables de entorno con secretos
.env*
```

### ⚠️ NUNCA commitear
- ❌ Tokens / API keys / secretos (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`…)
- ❌ El archivo `.env.local`
- ❌ La carpeta `/data` con leads reales de clientes

Los secretos van en `.env.local` (gitignored). El repo solo trae `.env.example` con las
claves vacías. Ver [`05-whatsapp-setup.md`](./05-whatsapp-setup.md).

---

## 📞 Ayuda

- Git: https://git-scm.com/doc
- GitHub Flow: https://docs.github.com/en/get-started/using-github/github-flow
- Conventional Commits: https://www.conventionalcommits.org/
- pnpm: https://pnpm.io/
- Next.js: https://nextjs.org/docs

**¡Éxito con el flujo! 🚀** Un flujo limpio hace el desarrollo más fácil y el código más
mantenible.
