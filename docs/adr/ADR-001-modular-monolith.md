# ADR-001: Modular Monolith como arquitectura inicial

**Estado**: Aceptado  
**Fecha**: 2024-01  
**Autor**: Arquitectura REG-X

## Contexto

REG-X necesita arrancar rápido con un equipo pequeño. Los microservicios ofrecen escalabilidad máxima pero introducen complejidad operacional significativa (service discovery, distributed tracing, eventual consistency, network partitions) que ralentizaría el MVP.

## Decisión

Implementar un **Modular Monolith** con fronteras de módulos bien definidas:
- Cada módulo es autónomo (sus propias entidades, repositorios, casos de uso)
- Los módulos NO se llaman directamente entre sí — se comunican vía eventos
- Las interfaces (Ports) son explícitas, no hay dependencia directa en implementaciones
- Cada módulo puede probarse de forma aislada

## Consecuencias

✅ Despliegue simple (un proceso, un contenedor)  
✅ Transacciones ACID nativas sin coordinadores distribuidos  
✅ Desarrollo más rápido en fases tempranas  
✅ Preparado para extracción a microservicios en Fase 2  

⚠️ El despliegue de un módulo requiere desplegar todo el monolito  
⚠️ Si el monolito crece sin disciplina de módulos, se convierte en un "Big Ball of Mud"

## Reglas de oro

1. Un módulo NUNCA importa el repositorio de otro módulo
2. La comunicación entre módulos es SOLO vía `EventBusService`
3. Cada módulo tiene su propia carpeta `domain/`, `application/`, `infrastructure/`
4. Las migraciones de base de datos son compartidas pero cada módulo "posee" sus tablas
