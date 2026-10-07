# Resumen y resultados de análisis

El dashboard separa ejecución, hallazgos y errores técnicos. Una evaluación
`FAILED` con cobertura completa se presenta como ejecución completada con
hallazgos; cobertura parcial se muestra incompleta. Los estados históricos
sin cobertura mantienen su estado original y no reciben tiempos/costos inventados.

Los reportes con `issues` muestran hallazgos ordenados por severidad, archivo y
línea, con búsqueda, filtro y paginación. Los resultados AWS que almacenan el
detalle en HTML muestran `issues_count` y un enlace HTTP(S) a `report_url`.
Si no hay datos suficientes, se muestra «No registrado».

Integrar primero `titvo-agent-aws/codex/cli-fullscan-aws` y
`titvo-admin-bff-aws/codex/scan-execution-summary`, luego esta rama.
El build productivo sigue usando los endpoints y la autenticación existentes.
No definir `VITE_TITVO_LAB=true` para producción. El despliegue AWS se hace por
el mecanismo existente después de integrar las ramas, no al publicarlas.

Para pruebas locales, clonar `titvo-dev` y `titvo-agent-aws` como carpetas
hermanas de este repositorio y seguir `titvo-dev/tools/cli/README.md`.
`titvo dashboard` habilita explícitamente el adaptador MiniStack de solo lectura
sobre loopback y muestra la identidad de laboratorio. No prueba autenticación,
permisos ni despliegue AWS.

Validación: 220 pruebas frontend, TypeScript y build Vite aprobados.
El lint global conserva infracciones previas; los archivos del nuevo resumen
y de estados pasan lint. No se ejecutan scans remotos durante estas pruebas.
