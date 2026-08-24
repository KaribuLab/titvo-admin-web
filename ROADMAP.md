# Roadmap de implementación — Titvo Admin Web

Este roadmap agrupa las funcionalidades que identifiqué que le faltan al admin console para cubrir todo lo que la plataforma Titvo hace hoy. Las ordené por valor para el usuario y por facilidad de implementación contra el BFF actual.

## Estado actual (lo que ya funciona)

- Login/logout con roles `admin` / `member`.
- Dashboard con resumen de repos, scans, API keys y usuarios.
- Listado de repositorios con último scan y trigger manual de scan.
- Detalle de un scan (`args` + `result` en JSON).
- Gestión de API keys (crear, revocar).
- Gestión de usuarios (crear, activar/desactivar, cambiar rol).
- Configuración de parámetros y secretos.

---

## Fase 1 — Mejorar la experiencia de scans (mayor ROI, datos ya disponibles)

### 1.1 Hallazgos estructurados en Scan Detail
**Por qué.** Hoy el `result` del scan se muestra como JSON crudo. El agente ya genera `issues` con severidad, archivo, línea, título, descripción y recomendación.

**Qué hacer.** Reemplazar el JSON crudo por una tabla de hallazgos filtrable por severidad (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), con búsqueda por archivo o título, y link al scan/branch en el repo.

**Datos.** Tabla `task`, campo `result` / `scan_result`.

**Criterio de éxito.** Un admin puede abrir un scan y entender los hallazgos sin leer JSON.

### 1.2 Polling de estado en vivo en Scan Detail
**Por qué.** Hoy hay que recargar la página para ver si un scan `IN_PROGRESS` terminó.

**Qué hacer.** Usar `titvo-task-status-aws` (`POST /task-status`) o un wrapper del BFF para consultar estado cada 5-10 segundos mientras el scan no esté terminal, y actualizar el badge y el `result` en pantalla.

**Datos.** `titvo-task-status-aws`.

**Criterio de éxito.** El usuario ve el scan pasar a `SUCCESS`/`FAILED` sin recargar.

### 1.3 Reporte HTML embebido + links a issues creados
**Por qué.** El agente genera un reporte HTML (`report_url`) y notifica a GitHub/Bitbucket. Hoy esos artefactos no se muestran.

**Qué hacer.** En Scan Detail, mostrar:
- Botón "Ver reporte" que abra/abstraiga el HTML generado.
- Links a los issues de GitHub (`html_url`) o anotaciones de Bitbucket Code Insights.

**Datos.** `result.report_url`, notificaciones generadas por `titvo-github-issue-aws` y `titvo-bitbucket-code-insights-aws`.

**Criterio de éxito.** Desde el admin se puede saltar directamente al issue/reporte del scan.

---

## Fase 2 — Visibilidad operativa (requiere nuevos endpoints o lecturas)

### 2.1 Historial global de scans
**Por qué.** Hoy solo se ve el último scan de cada repo. No hay forma de listar todos los scans de la plataforma.

**Qué hacer.** Pantalla `/scans` con tabla paginada, filtros por repo, estado, fecha y origen (`github`, `bitbucket`, `cli`, `admin`).

**Datos.** Tabla `task` (con GSI `repository_id_index`).

**Criterio de éxito.** Buscar y paginar scans de cualquier repo en segundos.

### 2.2 Panel de índices RAG
**Por qué.** `titvo-rag-indexer` deja artefactos en S3 (`index.db`, `meta.json`, locks por branch). Hoy no hay visibilidad de qué está indexado ni si hay un lock stale.

**Qué hacer.** Pantalla `/rag-indexes` con:
- Último commit indexado por repo/rama.
- Fecha, tipo (`full`/`delta`) y tamaño aproximado.
- Estado del lock distribuido (`locks/{branch}.json`).
- Botón "Reindexar" para forzar un job full.

**Datos.** S3 bajo la convención `{repo_host}/{owner}/{repo}/branches/{branch}/...`.

**Criterio de éxito.** Detectar rápido por qué un scan falla por índice corrupto o lock stale.

### 2.3 Centro de integraciones CI
**Por qué.** Los usuarios instalan Titvo vía GitHub Action y Bitbucket Pipe, pero hoy no hay una pantalla que explique cómo integrarlo ni muestre scans por origen.

**Qué hacer.** Pantalla `/integrations` con:
- Snippets YAML listos para copiar.
- Tabla de últimos scans por origen (`github`, `bitbucket`, `cli`, `admin`).

**Datos.** Tabla `task`, campo `source`.

**Criterio de éxito.** Un nuevo equipo puede integrar Titvo en su CI sin salir del admin.

---

## Fase 3 — Administración y gobernanza

### 3.1 Audit log
**Por qué.** No hay trazabilidad de quién disparó un scan, creó/revocó una API key o cambió un usuario/secret.

**Qué hacer.** Tabla de eventos con actor, acción, recurso y timestamp. Idealmente backend primero, luego UI.

**Datos.** Nuevo flujo de eventos (requiere trabajo backend).

### 3.2 Perfil de usuario y sesiones
**Por qué.** Hoy un usuario no puede cambiar su propia contraseña ni ver sus sesiones activas.

**Qué hacer.**
- Página `/profile` para cambiar contraseña.
- Listado de sesiones activas con opción de cerrarlas (si el backend lo soporta).

**Datos.** `titvo-auth` (ya integrado en el BFF).

### 3.3 Configuración visual de proveedores
**Por qué.** Hoy los parámetros `github_access_token`, `bitbucket_api_token`, `default_github_assignee` se configuran como claves sueltas en Config.

**Qué hacer.** Pantalla `/providers` con cards de GitHub/Bitbucket que validen que los parámetros requeridos estén seteados.

**Datos.** Tabla de config.

---

## Fase 4 — Avanzado / exploratorio

### 4.1 Catálogo y playground MCP
**Por qué.** `titvo-mcp-gateway` expone tools MCP (`mcp.tool.git.commit-files`, etc.) que hoy solo se usan internamente.

**Qué hacer.**
- Catálogo de tools con schemas.
- Formulario para invocar una tool y ver resultado.
- Monitoreo de jobs MCP.

**Datos.** `titvo-mcp-gateway`.

### 4.2 Alertas y notificaciones
**Por qué.** Hoy el usuario tiene que entrar al admin para saber si algo falló.

**Qué hacer.** Configurar canales (Slack, email) para alertas de scan fallido, finding crítico, etc.

**Datos.** Nuevo backend o integración con servicio existente.

### 4.3 Wizard de onboarding
**Por qué.** El primer setup hoy se hace con `titvo-installer` CLI.

**Qué hacer.** Wizard web post-login para conectar el primer repo, configurar tokens y probar un scan.

---

## Criterios generales de prioridad

1. **Mayor valor, menor costo:** Fase 1 (hallazgos, polling, reportes).
2. **Operación diaria:** Fase 2 (historial de scans, índices RAG, integraciones CI).
3. **Gobernanza:** Fase 3 (audit log, perfil, proveedores).
4. **Diferenciación futura:** Fase 4 (MCP, alertas, onboarding).

---

## Notas

- Este roadmap asume que el BFF (`titvo-admin-bff-aws`) sigue siendo la única interfaz entre el SPA y el resto del ecosistema.
- Algunas funcionalidades requieren nuevos endpoints en el BFF; eso se indica en cada ítem.
- Las funcionalidades de Fase 1 usan datos que ya existen en DynamoDB o en los resultados del agente, por lo que deberían ser implementables sin cambios grandes en backend.
