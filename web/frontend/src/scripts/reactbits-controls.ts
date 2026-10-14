import { startNativeControls } from "@/components/reactbits-controls/native-controls";
export { bindShredderOrder } from "@/components/reactbits-controls/native-controls";
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded",startNativeControls,{once:true});
else startNativeControls();
