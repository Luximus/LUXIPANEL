/// <reference types="astro/client" />

import type { SessionUser } from "@/lib/auth";

/**
 * El `declare global` NO es decorativo.
 *
 * Este fichero tiene un `import` de nivel superior, y eso lo convierte en un
 * MÓDULO. Dentro de un módulo, un `declare namespace App` suelto NO aumenta el
 * namespace global: se queda local al fichero y Astro nunca llega a verlo — de
 * ahí el "Property 'user' does not exist on type 'Locals'" en `middleware.ts`
 * pese a que la declaración estaba aquí delante. Envolverlo en `declare global`
 * es lo que la publica de verdad.
 */
declare global {
  namespace App {
    interface Locals {
      user?: SessionUser;
      uiBootstrap?: import("./lib/ui-bootstrap").UiBootstrap;
    }
  }
}

export {};
