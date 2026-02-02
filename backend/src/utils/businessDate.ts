/**
 * @fileoverview Funciones utilitarias para el calculo de la fecha de negocio.
 *
 * Centraliza la logica de fecha de negocio con corte a las 6 AM.
 * Este concepto es fundamental para la gastronomia: un restaurante que cierra
 * a las 3 AM necesita que las operaciones de madrugada se agrupen con el dia
 * anterior para reportes, numeracion de ordenes y cierre de caja.
 *
 * @module utils/businessDate
 *
 * REGLA DE NEGOCIO:
 * Las ordenes creadas antes de las 6 AM pertenecen al dia calendario anterior.
 * Esto asegura que las operaciones nocturnas (ej: 2 AM) se agrupen con el
 * dia de negocio anterior para reportes y numeracion de ordenes.
 *
 * Ejemplo: Una orden a las 3:00 AM del 20 de enero pertenece al dia de negocio 19 de enero.
 */

/**
 * Calcula la fecha de negocio para un datetime dado.
 *
 * Si la hora es anterior a las 6 AM, retrocede un dia calendario.
 * Luego normaliza a medianoche para comparaciones consistentes de fechas.
 *
 * @param date - El datetime para el cual calcular la fecha de negocio (por defecto: ahora)
 * @returns Objeto Date establecido a medianoche del dia de negocio
 *
 * @example
 * // Si son las 5:30 AM del 2026-01-19:
 * getBusinessDate() // Retorna 2026-01-18 00:00:00 (dia anterior)
 *
 * // Si son las 6:00 AM o mas tarde del 2026-01-19:
 * getBusinessDate() // Retorna 2026-01-19 00:00:00 (mismo dia)
 */
export function getBusinessDate(date: Date = new Date()): Date {
    const businessDate = new Date(date);

    // Si es antes de las 6 AM, la operacion pertenece al dia de negocio anterior
    if (businessDate.getHours() < 6) {
        businessDate.setDate(businessDate.getDate() - 1);
    }

    // Normaliza a medianoche para que las comparaciones de fecha sean consistentes
    businessDate.setHours(0, 0, 0, 0);

    return businessDate;
}

/**
 * Obtiene la clave de fecha de negocio en formato YYYYMMDD.
 * Usada para el sharding de OrderSequence (sharding diario, legacy).
 *
 * @param date - El datetime para el cual calcular la fecha de negocio (por defecto: ahora)
 * @returns String en formato "YYYYMMDD" (ej: "20260119")
 *
 * @example
 * getBusinessDateKey() // "20260119"
 *
 * @deprecated Usar getBusinessDateKeyHourly() para mejor rendimiento bajo concurrencia.
 * La version diaria genera contention de locks en horas pico.
 */
export function getBusinessDateKey(date: Date = new Date()): string {
    const businessDate = getBusinessDate(date);

    const year = businessDate.getFullYear();
    const month = String(businessDate.getMonth() + 1).padStart(2, '0');
    const day = String(businessDate.getDate()).padStart(2, '0');

    return `${year}${month}${day}`;
}

/**
 * Obtiene la clave de fecha de negocio con granularidad HORARIA en formato YYYYMMDDHH.
 *
 * OPTIMIZACION DE RENDIMIENTO:
 * - Reduce la contention de locks en OrderSequence 24x (1 fila por dia -> 24 filas por dia)
 * - Mejora de latencia esperada: 1200ms -> 50ms en horas pico
 * - Cada hora obtiene su propio contador de secuencia (locking aislado)
 * - Esto es critico en restaurantes con alto volumen de ordenes simultaneas
 *
 * REGLA DE NEGOCIO:
 * - La hora se toma del timestamp ORIGINAL (antes del ajuste de 6 AM)
 * - Esto asegura ordenamiento cronologico dentro del dia de negocio
 * - Ejemplo: a las 2 AM del dia 20, la clave es "2026011902" (fecha negocio: 19, hora: 02)
 *
 * @param date - El datetime para el cual calcular la clave (por defecto: ahora)
 * @returns String en formato "YYYYMMDDHH" (ej: "2026011914" para las 2 PM)
 *
 * @example
 * // Si son las 14:30 (2:30 PM) del 2026-01-19:
 * getBusinessDateKeyHourly() // "2026011914"
 *
 * // Si son las 02:30 AM del 2026-01-20 (antes del corte de 6 AM):
 * getBusinessDateKeyHourly() // "2026011902" (fecha negocio es 2026-01-19, hora es 02)
 */
export function getBusinessDateKeyHourly(date: Date = new Date()): string {
    const businessDate = getBusinessDate(date);

    const year = businessDate.getFullYear();
    const month = String(businessDate.getMonth() + 1).padStart(2, '0');
    const day = String(businessDate.getDate()).padStart(2, '0');

    // CRITICO: Usa la hora ORIGINAL (no la hora de la fecha de negocio ajustada).
    // La fecha de negocio siempre queda en medianoche (00), asi que necesitamos
    // la hora real del timestamp para particionar correctamente la secuencia.
    const hour = String(date.getHours()).padStart(2, '0');

    return `${year}${month}${day}${hour}`;
}
