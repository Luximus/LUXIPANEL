import { expect, it } from "vitest";
import { applyEditorEdit } from "./editor-edits";
it("aplica cambios por rango respetando columnas UTF-16 del editor",()=>{
 expect(applyEditorEdit("uno\nA😀B\nfin",{mode:"replaceRange",range:{startLineNumber:2,startColumn:2,endLineNumber:2,endColumn:4},content:"X"})).toBe("uno\nAXB\nfin");
 expect(applyEditorEdit("uno\ndos\nfin",{mode:"replaceRange",range:{startLineNumber:1,startColumn:2,endLineNumber:2,endColumn:3},content:"!"})).toBe("u!s\nfin");
});
it("rechaza rangos invertidos o fuera del borrador",()=>{
 expect(()=>applyEditorEdit("abc",{mode:"replaceRange",range:{startLineNumber:2,startColumn:1,endLineNumber:2,endColumn:2},content:"x"})).toThrow();
 expect(()=>applyEditorEdit("abc",{mode:"replaceRange",range:{startLineNumber:1,startColumn:3,endLineNumber:1,endColumn:1},content:"x"})).toThrow();
});
