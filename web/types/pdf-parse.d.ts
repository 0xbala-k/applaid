type PdfParseFn = (
  dataBuffer: Buffer,
  options?: { pagerender?: (pageData: unknown) => Promise<string>; max?: number; version?: string }
) => Promise<{ numpages: number; numrender: number; text: string; info: unknown; metadata: unknown }>;

declare module "pdf-parse" {
  const pdfParse: PdfParseFn;
  export = pdfParse;
}

declare module "pdf-parse/lib/pdf-parse.js" {
  const pdfParse: PdfParseFn;
  export = pdfParse;
}
