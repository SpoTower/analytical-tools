import dayjs from 'dayjs';


export function convertKeysToCamelCase(row: Record<string, any>) {
    return Object.fromEntries(
        Object.entries(row).map(([key, value]) => [this.snakeToCamel(key), value])
    );
}

/**
 * Converts snake_case to camelCase.
 */
export function  snakeToCamel(s: string) {
    return s.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}


 
 
export function getDateRange(daysBack: number, dateFormat: string) {
    return {
        endDate: dayjs().format(dateFormat), // Current date formatted
        startDate: dayjs().subtract(daysBack, 'day').format(dateFormat) // Subtracted date formatted
    };
}
