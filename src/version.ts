declare const __BUILD__: string;
/**
 * Added to the address of every data file, so a new version of the app can
 * never be served data left over from an older one (which broke Study 18).
 */
export const VER = '?v=' + encodeURIComponent(__BUILD__.split(' ')[0]);
