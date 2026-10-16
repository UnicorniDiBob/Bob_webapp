import { describe, expect, it } from "vitest";
import { MAX_BYTE_PDF, ePdf, verificaPdf } from "./pdf";

const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");

describe("verificaPdf: decidono i byte e il peso", () => {
  it("un PDF vero passa", () => {
    expect(ePdf(PDF)).toBe(true);
    expect(verificaPdf(PDF)).toBe("ok");
  });

  it("una JPEG rinominata .pdf non e' un PDF", () => {
    expect(verificaPdf(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe("non_pdf");
  });

  it("testo che contiene %PDF- ma non all'inizio non e' un PDF", () => {
    expect(verificaPdf(Buffer.from("ciao %PDF-1.7"))).toBe("non_pdf");
  });

  it("sopra 4 MB e' rifiutato, anche se e' un PDF vero", () => {
    const grande = Buffer.alloc(MAX_BYTE_PDF + 1);
    PDF.copy(grande);
    expect(verificaPdf(grande)).toBe("troppo_grande");
  });

  it("esattamente 4 MB passa", () => {
    const giusto = Buffer.alloc(MAX_BYTE_PDF);
    PDF.copy(giusto);
    expect(verificaPdf(giusto)).toBe("ok");
  });
});
