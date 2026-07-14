// El subpath de polyfill no trae tipos; es un import de efecto secundario
// que instala globalThis.BarcodeDetector en navegadores sin soporte nativo
// (p. ej. iOS Safari). Ver BarcodeScanner.tsx.
declare module 'react-barcode-scanner/polyfill'
